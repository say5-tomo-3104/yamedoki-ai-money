// 収支計算・健康寿命判定・NPC進行ロジック（SPEC.md 第4章・第5章）
// 状態はすべてJSONで表現できる純粋なデータとして扱い、乱数も状態内のシードから引く。
import {
  REGIONS, JOBS, FAMILIES, HEALTHS, PENSION_TABLE, PENSION_AGES,
  WALL_BASE_HEALTHY, BASE_RETIRE_LIVING, heartAgeFactor,
} from '../data/tables.js'
import { STEPS, EVENTS } from '../data/events.js'
import { NPC_DATA, assignNpcAges, npcCumulative, npcHeart, npcPresent, reunionScene } from '../data/npcs.js'

export const SAVE_VERSION = 1
const ASSET_FLOOR = -300

// ---- 乱数（mulberry32）----
function nextRandom(state) {
  let t = (state.rng = (state.rng + 0x6d2b79f5) >>> 0)
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

function weightedPick(state, table) {
  const total = table.reduce((sum, row) => sum + row.rate, 0)
  let r = nextRandom(state) * total
  for (const row of table) {
    r -= row.rate
    if (r < 0) return row
  }
  return table[table.length - 1]
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const round1 = (v) => Math.round(v * 10) / 10

// ---- プロフィール参照 ----
export function getProfile(state) {
  const p = state.profile
  const region = REGIONS.find((r) => r.id === p.regionId)
  return {
    region,
    job: JOBS.find((j) => j.id === p.jobId),
    family: FAMILIES.find((f) => f.id === p.familyId),
    body: HEALTHS.find((h) => h.id === p.healthId),
    gender: p.gender,
    life: region.life[p.gender],
  }
}

// 受給開始年齢ごとの月額（額面・手取り）
export function monthlyPension(gross65, net65, pensionAge) {
  const row = PENSION_TABLE[pensionAge]
  return { gross: round1(gross65 * row.grossMult), net: round1(net65 * row.realMult) }
}

export function playerMonthly(state, pensionAge = state.pensionAge) {
  const { job } = getProfile(state)
  return monthlyPension(job.gross65, job.net65, pensionAge)
}

// ---- 新規ゲーム（初期ガチャ）----
export function createGame(seed = Date.now()) {
  const state = { version: SAVE_VERSION, rng: seed >>> 0 }
  const region = weightedPick(state, REGIONS)
  const gender = nextRandom(state) < 0.5 ? 'male' : 'female'
  const job = weightedPick(state, JOBS)
  const family = weightedPick(state, FAMILIES)
  const body = weightedPick(state, HEALTHS)
  return {
    ...state,
    profile: { regionId: region.id, gender, jobId: job.id, familyId: family.id, healthId: body.id },
    age: 50,
    assets: job.savings50,
    health: body.health,
    heart: 50,
    memory: 0,
    pensionAge: null,
    cumPension: 0,
    work: { perYear: 0, until: 0 },
    extraLiving: 0,
    flags: {},
    wall: null,
    // 同級生の運命は最初に決めておく（SPEC.md 第5章の確率）
    npcFate: {
      seiichiWall: nextRandom(state) < 0.7,
      harukaAlive: nextRandom(state) < 0.65,
    },
    fragments: [],
    log: [],
    yearly: [{ age: 50, assets: job.savings50, health: body.health, heart: 50 }],
    stepIndex: 0,
    pending: null,
    finished: false,
  }
}

// ---- 1年分の収支・心身の変化 ----
function simulateYear(s) {
  const { region, job, family } = getProfile(s)
  const a = s.age
  const pen = s.pensionAge ? PENSION_TABLE[s.pensionAge] : null

  if (a < 60) {
    const eduAdj = family.id === 'C2' && a >= 55 ? 0.08 : 0
    const rate = clamp(job.saveRate + family.saveAdj + eduAdj - (region.price - 1) * 0.2, -0.1, 0.4)
    s.assets += job.income50s * rate
  } else {
    if (a === 60) s.assets += job.retire60
    if (a < s.work.until) s.assets += s.work.perYear
    if (s.pensionAge && a >= s.pensionAge) {
      const annual = playerMonthly(s).net * 12
      s.assets += annual
      s.cumPension += annual
    }
    if (family.spousePension && a >= 65) s.assets += family.spousePension * 12
    let medical = a < 70 ? 6 : a < 75 ? 12 : 18
    if (a >= 70 && pen) medical += pen.copayExtra
    if (s.flags.mobilityLimited) medical += 24
    const living = BASE_RETIRE_LIVING * region.price * family.livingMult + family.rent + s.extraLiving
    s.assets -= living + medical
  }

  // 身体
  let dh = a < 60 ? -0.3 : a < 70 ? -0.6 : a < 80 ? -1.0 : -1.5
  if (s.flags.gym && a < 70) dh += 0.4
  if (s.flags.drinker && a < 70) dh -= 0.4
  if (family.oldHouse && a >= 75) dh -= 1.5
  const hardship = s.assets < 0
  if (hardship) dh -= 1
  s.health = clamp(s.health + dh, 0, 100)

  // 心
  let dHeart = 0
  if (a >= 75) dHeart += s.memory * 0.04 // アルバム配当（5年で memoryPoints × 0.2）
  if (family.lonely && a >= 70) dHeart -= s.flags.hobby ? 0.75 : 1.5
  if (hardship) dHeart -= 2
  s.heart = Math.max(0, s.heart + dHeart)
  if (hardship) s.flags.hardship = true
  // 貯蓄が尽きた後は生活保護などのセーフティネットが下支えする
  if (s.assets < ASSET_FLOOR) {
    s.assets = ASSET_FLOOR
    s.flags.safetyNet = true
  }

  s.age = a + 1
  s.yearly.push({ age: s.age, assets: Math.round(s.assets), health: Math.round(s.health), heart: Math.round(s.heart) })
}

function advanceTo(s, age) {
  while (s.age < age) simulateYear(s)
}

// ---- 効果の適用 ----
function applyEffect(s, effect = {}) {
  const d = { assets: 0, health: 0, heart: 0, memory: 0 }
  if (effect.assets) {
    s.assets += effect.assets
    d.assets = effect.assets
  }
  if (effect.health) {
    const before = s.health
    s.health = clamp(s.health + effect.health, 0, 100)
    d.health = s.health - before
  }
  if (effect.heart) {
    const v = effect.heart > 0 ? effect.heart * heartAgeFactor(s.age) : effect.heart
    s.heart = Math.max(0, s.heart + v)
    d.heart = round1(v)
  }
  if (effect.memory) {
    s.memory += effect.memory
    d.memory = effect.memory
  }
  if (effect.flags) Object.assign(s.flags, effect.flags)
  if (effect.work) s.work = { ...effect.work }
  if (effect.pensionAge) s.pensionAge = effect.pensionAge
  if (effect.extraLiving) s.extraLiving += effect.extraLiving
  return d
}

// 72歳の壁の突破確率（SPEC.md 4-②）
export function wallProbability(state) {
  const { life, body } = getProfile(state)
  const p = 50 + (life.healthy - WALL_BASE_HEALTHY) * 12 + (state.health - 60) * 0.8 + body.wallBonus
  return Math.round(clamp(p, 5, 95))
}

// イベント文面・選択肢の生成に渡す文脈
export function eventContext(state) {
  return { ...getProfile(state), wallProb: wallProbability(state) }
}

// ---- 選択肢の可否 ----
export function choiceAvailability(state, choice) {
  if (choice.requiresHealth && state.flags.mobilityLimited) {
    return { ok: false, reason: '行きたい場所があったのに、もう足が動かない' }
  }
  if (choice.minHealth && state.health < choice.minHealth) {
    return { ok: false, reason: `健康値${choice.minHealth}以上で選べる（いまの身体では難しい）` }
  }
  if (choice.minAssets != null && state.assets < choice.minAssets) {
    return { ok: false, reason: `資産${choice.minAssets.toLocaleString()}万円以上が必要` }
  }
  return { ok: true }
}

// ---- 進行 ----
function stepApplies(state, step) {
  if (step.type !== 'event') return true
  const ev = EVENTS[step.id]
  return !ev.when || ev.when(state, eventContext(state))
}

export function currentStep(state) {
  return STEPS[state.stepIndex]
}

// ステップに入るとき：その年齢まで時間を進める
function enterStep(s) {
  while (s.stepIndex < STEPS.length && !stepApplies(s, STEPS[s.stepIndex])) s.stepIndex++
  const step = STEPS[s.stepIndex]
  if (step?.age) advanceTo(s, step.age)
  if (step?.type === 'ending') {
    advanceTo(s, 85)
    s.finished = true
  }
}

export function startGame(state) {
  const s = structuredClone(state)
  s.stepIndex = 1
  enterStep(s)
  return s
}

export function choose(state, choiceId) {
  const s = structuredClone(state)
  const step = currentStep(s)
  const ev = EVENTS[step.id]
  const ctx = eventContext(s)
  const choice = ev.choices(s, ctx).find((c) => c.id === choiceId)
  if (!choice || !choiceAvailability(s, choice).ok) return state

  let outcome = { effect: choice.effect, fragment: choice.fragment, note: choice.note }
  if (choice.resolve) outcome = { ...outcome, ...choice.resolve(s, ctx, nextRandom(s)) }
  const deltas = applyEffect(s, outcome.effect)
  const fragment = typeof outcome.fragment === 'function' ? outcome.fragment(s, ctx) : outcome.fragment
  if (fragment) s.fragments.push({ act: ev.act, key: ev.id, text: fragment })
  s.log.push({ age: s.age, event: ev.title, choice: choice.label, deltas })
  s.pending = { eventId: ev.id, choiceLabel: choice.label, imageId: choice.imageId, fragment, note: outcome.note, deltas }
  return s
}

export function proceed(state) {
  const s = structuredClone(state)
  const step = currentStep(s)
  if (step.type === 'reunion') {
    const scene = getReunion(s, step.age)
    s.fragments.push({ act: step.act, key: `reunion_${step.age}`, text: scene.novel })
  }
  s.pending = null
  s.stepIndex++
  enterStep(s)
  return s
}

// ---- 同窓会・エンディング用の比較データ ----
export function getReunion(state, age) {
  return reunionScene({
    age, state, profile: getProfile(state), ages: assignNpcAges(state.pensionAge),
    fate: state.npcFate, playerCum: Math.round(state.cumPension),
  })
}

export function compareAt(state, age) {
  const ages = assignNpcAges(state.pensionAge)
  const rows = [
    {
      id: 'player', name: 'あなた', pensionAge: state.pensionAge, isPlayer: true, present: true,
      cum: Math.round(state.cumPension), heart: Math.round(state.heart),
    },
  ]
  for (const id of ['kenta', 'seiichi', 'haruka']) {
    const pAge = ages[id]
    rows.push({
      id, name: NPC_DATA[id].name, pensionAge: pAge, isPlayer: false,
      present: npcPresent(id, state.npcFate, pAge, age),
      cum: Math.round(npcCumulative(id, pAge, age, state.npcFate)),
      heart: Math.round(npcHeart(id, pAge, age, state.npcFate)),
    })
  }
  return rows
}

export { PENSION_AGES }
