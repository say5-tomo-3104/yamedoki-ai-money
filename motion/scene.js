// やめどきAI Money — 15 秒モーショングラフィック
//
// ルール（参考動画から借りた「考え方」）
// - すべての見た目は seek(t) の中で t から計算する。CSS transition / タイマー / フレーム間の状態は持たない
// - タイミングは秒ではなく「拍番号」で書く。拍の長さは beatmap.json（audio.py が出力）から読む
// - 1 拍ごとに必ず何かが起きる。切り替えはハードカット or 0.16 秒のワイプだけ
// - 動きは閉形式のスプリング（減衰振動のステップ応答）。オーバーシュートはごく小さく、すぐ止まって拍を待つ
// - 見出しは 1 語ずつ積み上がり、最新の語だけアクセント色
// - 実測値（キック位置・金額・スコア）を小さなタグで添えて「データで動いている」感を出す

const W = 1080
const H = 1920
const canvas = document.getElementById('c')
const ctx = canvas.getContext('2d')

const COL = {
  red: '#EE4323',
  yellow: '#F5C400',
  blue: '#2337E0',
  cream: '#F2ECE1',
  ink: '#151515',
}
const THEME = {
  red: { bg: COL.red, fg: COL.cream, accent: COL.ink, sub: COL.yellow, flash: '#FFA18A' },
  yellow: { bg: COL.yellow, fg: COL.ink, accent: COL.blue, sub: COL.red, flash: '#FFE88A' },
  blue: { bg: COL.blue, fg: COL.cream, accent: COL.yellow, sub: COL.red, flash: '#8E9AF7' },
  cream: { bg: COL.cream, fg: COL.ink, accent: COL.red, sub: COL.blue, flash: '#FFFFFF' },
  ink: { bg: COL.ink, fg: COL.cream, accent: COL.red, sub: COL.yellow, flash: '#454545' },
}
const JP = '"Noto Sans JP"'
const NUM = '"Anton"'
const MONO = '"JetBrains Mono", "Noto Sans JP"'

// ---------------------------------------------------------------------------
// time
// ---------------------------------------------------------------------------
let BM = null
let B = 14 / 30
const T = (b) => b * B
const since = (t, b) => t - T(b)

// critically-ish damped spring step response, pure function of dt
function spring(dt, w = 42, z = 0.74) {
  if (dt <= 0) return 0
  const wd = w * Math.sqrt(1 - z * z)
  return 1 - Math.exp(-z * w * dt) * (Math.cos(wd * dt) + ((z * w) / wd) * Math.sin(wd * dt))
}
const clamp01 = (x) => Math.max(0, Math.min(1, x))
const easeOutExpo = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(2, -10 * x))
const lerp = (a, b, p) => a + (b - a) * p

// value that changes target at several beats: sum of one spring per change
function stepper(keys, t, w = 34, z = 0.78) {
  let v = keys[0][1]
  for (let i = 1; i < keys.length; i++) v += (keys[i][1] - keys[i - 1][1]) * spring(since(t, keys[i][0]), w, z)
  return v
}
function lastHit(t, hits) {
  let i = -1
  for (let k = 0; k < hits.length; k++) if (t >= T(hits[k]) - 1e-9) i = k
  return i
}
function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function mix(a, b, p) {
  const A = hexToRgb(a)
  const Bc = hexToRgb(b)
  return `rgb(${A.map((v, i) => Math.round(lerp(v, Bc[i], p))).join(',')})`
}
const yen = (n) => '¥' + n.toLocaleString('ja-JP')
const pad2 = (n) => String(n).padStart(2, '0')

// ---------------------------------------------------------------------------
// font bookkeeping: record every (font, string) drawn so the renderer can preload
// ---------------------------------------------------------------------------
let RECORD = false
const USED = new Set()
const rawFill = ctx.fillText.bind(ctx)
ctx.fillText = (s, x, y) => {
  if (RECORD) USED.add(ctx.font + '\u0000' + s)
  rawFill(s, x, y)
}
const fnt = (weight, size, fam) => `${weight} ${Math.round(size)}px ${fam}`
function fitSize(str, fam, weight, maxW, maxSize) {
  ctx.font = fnt(weight, 100, fam)
  return Math.min(maxSize, (100 * maxW) / ctx.measureText(str).width)
}

// ---------------------------------------------------------------------------
// primitives
// ---------------------------------------------------------------------------
function fill(color) {
  ctx.fillStyle = color
  ctx.fillRect(0, 0, W, H)
}

// background that flashes light on the given beats and settles back to the theme colour
function flashBg(t, th, beats, dur = 0.26) {
  let dt = -1
  for (const b of beats) if (t >= T(b) - 1e-9) dt = since(t, b)
  fill(dt < 0 ? th.bg : mix(th.flash, th.bg, clamp01(dt / dur)))
}

// big dashed rings in the background; they tick round on every beat
function rings(t, th) {
  const bt = Math.max(0, t / B)
  const n = Math.floor(bt)
  const ang = (n + spring(t - T(n), 30, 0.8)) * 0.075
  ctx.save()
  ctx.globalAlpha = 0.13
  ctx.strokeStyle = th.fg
  ctx.translate(230, 1240)
  ctx.rotate(ang)
  ctx.lineWidth = 46
  ctx.setLineDash([120, 86])
  ctx.beginPath()
  ctx.arc(0, 0, 590, 0, Math.PI * 2)
  ctx.stroke()
  ctx.rotate(-ang * 2.3)
  ctx.lineWidth = 30
  ctx.setLineDash([64, 96])
  ctx.beginPath()
  ctx.arc(0, 0, 900, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

function shape(kind, cx, cy, size, color, scale = 1, alpha = 1) {
  if (scale <= 0.001 || alpha <= 0.001) return
  ctx.save()
  ctx.globalAlpha *= alpha
  ctx.translate(cx, cy)
  ctx.scale(scale, scale)
  ctx.fillStyle = color
  const r = size / 2
  ctx.beginPath()
  if (kind === 'circle') ctx.arc(0, 0, r, 0, Math.PI * 2)
  else if (kind === 'square') ctx.rect(-r * 0.9, -r * 0.9, r * 1.8, r * 1.8)
  else {
    ctx.moveTo(0, -r * 1.02)
    ctx.lineTo(r * 1.04, r * 0.84)
    ctx.lineTo(-r * 1.04, r * 0.84)
    ctx.closePath()
  }
  ctx.fill()
  ctx.restore()
}

// words stack up one per hit; the newest one wears the accent colour
function headline(t, words, th, { x0 = 72, top = 170, size = 100, lh = 1.17, weight = 900 } = {}) {
  ctx.save()
  ctx.font = fnt(weight, size, JP)
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  let newest = null
  for (const w of words) if (t >= T(w.b) - 1e-9) newest = w
  let x = x0
  let line = 0
  for (const w of words) {
    if (w.br) {
      line++
      x = x0
    }
    const width = ctx.measureText(w.s).width
    const dt = since(t, w.b)
    if (dt >= 0) {
      const yTop = top + line * size * lh
      const p = spring(dt, 48, 0.8)
      ctx.save()
      ctx.beginPath()
      ctx.rect(x - 6, yTop - size * 0.12, width + 12, size * lh + size * 0.04)
      ctx.clip()
      ctx.fillStyle = w === newest ? th.accent : th.fg
      ctx.fillText(w.s, x, yTop + (1 - p) * size * 1.1)
      ctx.restore()
    }
    x += width
  }
  ctx.restore()
}

// rolling counter: old value leaves upward, new value arrives from below (masked)
function odometer(t, hits, values, { x, y, size, color, align = 'right' }) {
  const i = lastHit(t, hits)
  if (i < 0) return
  const p = spring(since(t, hits[i]), 52, 0.8)
  ctx.save()
  ctx.font = fnt(400, size, NUM)
  ctx.textAlign = align
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = color
  const asc = ctx.measureText('0123456789').actualBoundingBoxAscent
  const padY = size * 0.05
  ctx.beginPath()
  ctx.rect(0, y - asc - padY, W, asc + padY * 2)
  ctx.clip()
  const travel = asc + padY * 2
  ctx.fillText(values[i], x, y + (1 - p) * travel)
  if (i > 0 && p < 0.999) ctx.fillText(values[i - 1], x, y - p * travel)
  ctx.restore()
}

// text that lands from oversized to its place, with a fading echo
function slam(str, cx, cy, fam, weight, size, color, dt, { s0 = 1.8, echo = true } = {}) {
  if (dt < 0) return
  const p = spring(dt, 36, 0.7)
  const s = 1 + (s0 - 1) * (1 - p)
  ctx.save()
  ctx.font = fnt(weight, size, fam)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = color
  if (echo && dt < 0.32) {
    ctx.save()
    ctx.globalAlpha = 0.3 * (1 - dt / 0.32)
    ctx.translate(cx, cy)
    ctx.scale(s * 1.4, s * 1.4)
    ctx.fillText(str, 0, 0)
    ctx.restore()
  }
  ctx.translate(cx, cy)
  ctx.scale(s, s)
  ctx.fillText(str, 0, 0)
  ctx.restore()
}

// text that slides up out of a mask
function rise(str, x, y, fam, weight, size, color, dt, { align = 'left', alpha = 1 } = {}) {
  if (dt < 0) return
  const p = spring(dt, 44, 0.8)
  ctx.save()
  ctx.font = fnt(weight, size, fam)
  ctx.textAlign = align
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = color
  ctx.globalAlpha = alpha
  const m = ctx.measureText(str)
  const asc = Math.max(m.actualBoundingBoxAscent, size * 0.8)
  const left = align === 'left' ? x : align === 'right' ? x - m.width : x - m.width / 2
  ctx.beginPath()
  ctx.rect(left - 10, y - asc - 10, m.width + 20, asc + size * 0.25 + 10)
  ctx.clip()
  ctx.fillText(str, x, y + (1 - p) * (asc + size * 0.3))
  ctx.restore()
}

// small mono data tag, wiped in from the left, optional pointer line
function tag(str, x, y, th, { size = 26, dt = 1, align = 'left', to = null, invert = false } = {}) {
  if (dt < 0) return
  ctx.save()
  ctx.font = fnt(700, size, MONO)
  const padX = size * 0.5
  const h = Math.round(size * 1.6)
  const w = ctx.measureText(str).width + padX * 2
  const bx = align === 'left' ? x : align === 'right' ? x - w : x - w / 2
  const p = easeOutExpo(dt / 0.22)
  const boxBg = invert ? th.bg : th.fg
  const boxFg = invert ? th.fg : th.bg
  if (to) {
    const sx = Math.max(bx + 24, Math.min(bx + w - 24, to[0]))
    const sy = to[1] < y ? y : y + h
    ctx.strokeStyle = boxBg
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.lineTo(lerp(sx, to[0], p), lerp(sy, to[1], p))
    ctx.stroke()
    ctx.fillStyle = boxBg
    ctx.beginPath()
    ctx.arc(to[0], to[1], 7 * p, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.beginPath()
  ctx.rect(bx, y, w * p, h)
  ctx.clip()
  ctx.fillStyle = boxBg
  ctx.fillRect(bx, y, w, h)
  ctx.fillStyle = boxFg
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(str, bx + padX, y + h / 2 + size * 0.05)
  ctx.restore()
}

// progress blocks, one fills per hit
function blocks(t, hits, n, th, { x0 = 72, x1 = 1008, y, h = 90, gap = 14 }) {
  const bw = (x1 - x0 - gap * (n - 1)) / n
  const newest = lastHit(t, hits)
  for (let k = 0; k < n; k++) {
    const bx = x0 + k * (bw + gap)
    ctx.globalAlpha = 0.5
    ctx.fillStyle = th.fg
    ctx.fillRect(bx, y + h - 6, bw, 6)
    ctx.globalAlpha = 1
    const dt = k < hits.length ? since(t, hits[k]) : -1
    if (dt >= 0) {
      const hh = h * spring(dt, 50, 0.72)
      ctx.fillStyle = k === newest ? th.accent : th.fg
      ctx.fillRect(bx, y + h - hh, bw, hh)
    }
  }
}

// ---------------------------------------------------------------------------
// HUD (section label, beat dots, measured kick)
// ---------------------------------------------------------------------------
function hud(t, th, label) {
  tag(label, 56, 50, th, { size: 24 })
  const beat = Math.min(BM.beats - 1, Math.floor(t / B + 1e-6))
  const inBar = beat % 4
  const bar = Math.floor(beat / 4)
  for (let k = 0; k < 4; k++) {
    ctx.fillStyle = k === inBar ? th.accent : th.fg
    ctx.beginPath()
    ctx.arc(866 + k * 28, 70, k === inBar ? 10 : 6, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.font = fnt(700, 24, MONO)
  ctx.fillStyle = th.fg
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.fillText(`${bar + 1}.${inBar + 1}`, 1026, 72)

  const kicks = BM.kicks
  let k = -1
  for (let i = 0; i < kicks.length; i++) if (t >= kicks[i].grid - 1e-9) k = i
  const resting = beat === 8 || beat === 9
  const text = resting
    ? `rest · ${B.toFixed(3)} s`
    : k >= 0
      ? `kick ${pad2(k + 1)} → ${kicks[k].measured.toFixed(3)} s`
      : 'kick --'
  tag(text, 56, 1816, th, { size: 22 })
  tag(`${BM.bpm.toFixed(1)} BPM`, 1024, 1816, th, { size: 22, align: 'right' })
}

// ---------------------------------------------------------------------------
// scenes — each draws a full frame for time t (also outside its own range,
// which is what lets a wipe show old and new scene side by side)
// ---------------------------------------------------------------------------
const COUNT_A_HITS = [0, 1, 2, 3, 4, 5, 6, 6.5, 7, 7.5]
const COUNT_C_HITS = Array.from({ length: 12 }, (_, k) => 12 + 0.5 * k)
const SHAPE_HITS = Array.from({ length: 10 }, (_, k) => 20 + 0.25 * k)
const KINDS = ['circle', 'square', 'triangle']
const kindOf = (i) => KINDS[(i + Math.floor(i / 4)) % 3]

function sceneCount(key) {
  return (t) => {
    const th = THEME[key]
    const items = BM.data.items
    fill(th.bg)
    rings(t, th)

    // decor circle hops on every beat
    const keys = [
      [-1, [860, 1120, 0]],
      [0, [860, 1120, 130]],
      [1, [190, 880, 86]],
      [2, [900, 740, 64]],
      [3, [280, 1440, 150]],
      [4, [880, 560, 330]],
      [5, [830, 620, 290]],
      [6, [210, 1460, 230]],
      [7, [880, 1380, 270]],
    ]
    const cx = stepper(keys.map(([b, v]) => [b, v[0]]), t)
    const cy = stepper(keys.map(([b, v]) => [b, v[1]]), t)
    const cr = stepper(keys.map(([b, v]) => [b, v[2]]), t)
    shape('circle', cx, cy, cr * 2, th.sub)

    headline(
      t,
      [
        { s: '毎月', b: 0 },
        { s: 'なんとなく', b: 1 },
        { s: '払ってる', b: 2, br: true },
        { s: 'サブスク、', b: 3 },
        { s: '数えて', b: 4, br: true },
        { s: 'みた。', b: 5 },
      ],
      th,
    )

    const baseY = 1300
    odometer(t, COUNT_A_HITS, COUNT_A_HITS.map((_, i) => String(i + 1)), {
      x: 770,
      y: baseY,
      size: 640,
      color: th.fg,
    })
    rise('件', 792, baseY, JP, 900, 130, th.fg, since(t, 0))

    const i = lastHit(t, COUNT_A_HITS)
    if (i >= 0) {
      const cum = items.slice(0, i + 1).reduce((s, it) => s + it.price, 0)
      tag(`${pad2(i + 1)} ${items[i].category} ${yen(items[i].price)}  Σ ${yen(cum)}`, 72, 1370, th, {
        size: 30,
        dt: since(t, COUNT_A_HITS[i]),
        to: [700, 1316],
      })
    }
    blocks(t, COUNT_A_HITS, 10, th, { y: 1540 })
    return th
  }
}

function sceneRest(t) {
  const th = THEME.cream
  fill(th.bg)
  rings(t, th)
  if (t < T(9)) {
    rise('で、毎月いくら？', 540, 990, JP, 700, 56, th.fg, since(t, 8), { align: 'center' })
  } else {
    slam('月額', 540, 960, JP, 900, 220, th.fg, since(t, 9), { s0: 1.35, echo: false })
  }
  return th
}

function sceneMonthly(t) {
  const th = THEME.red
  flashBg(t, th, [10], 0.24)
  rings(t, th)
  const str = yen(BM.data.monthly)
  const size = fitSize(str, NUM, 400, 960, 340)
  slam(str, 540, 1000, NUM, 400, size, th.fg, since(t, 10), { s0: 1.9 })
  rise('/月', 1008, 1000 + size * 0.42 + 140, JP, 900, 120, th.accent, since(t, 10.5), { align: 'right' })
  headline(
    t,
    [
      { s: '毎月、', b: 11 },
      { s: 'これだけ。', b: 11.5 },
    ],
    th,
  )
  tag(`Σ monthlyPrice · ${BM.data.items.length}件 = ${yen(BM.data.monthly)}`, 72, 1560, th, {
    size: 28,
    dt: since(t, 11),
  })
  return th
}

const C_KEYS = ['blue', 'yellow', 'red', 'cream', 'blue', 'yellow']
function sceneYear(t) {
  const beat = Math.floor(t / B + 1e-6)
  if (beat < 18) {
    const th = THEME[C_KEYS[Math.max(0, beat - 12)]]
    fill(th.bg)
    rings(t, th)
    headline(
      t,
      [
        { s: '1年だと', b: 12 },
        { s: 'いくら？', b: 13 },
      ],
      th,
    )
    const baseY = 1330
    odometer(t, COUNT_C_HITS, COUNT_C_HITS.map((_, i) => String(i + 1)), {
      x: 770,
      y: baseY,
      size: 700,
      color: th.fg,
    })
    rise('ヶ月', 792, baseY, JP, 900, 104, th.fg, since(t, 12))
    const i = lastHit(t, COUNT_C_HITS)
    if (i >= 0) {
      tag(`${yen(BM.data.monthly)} × ${i + 1} = ${yen(BM.data.monthly * (i + 1))}`, 72, 1400, th, {
        size: 30,
        dt: since(t, COUNT_C_HITS[i]),
        to: [700, 1346],
      })
    }
    blocks(t, COUNT_C_HITS, 12, th, { y: 1560 })
    return th
  }
  const th = THEME.blue
  flashBg(t, th, [18])
  rings(t, th)
  const str = yen(BM.data.yearly)
  const size = fitSize(str, NUM, 400, 970, 340)
  slam(str, 540, 1000, NUM, 400, size, th.fg, since(t, 18), { s0: 2.0 })
  rise('/年', 1008, 1000 + size * 0.42 + 140, JP, 900, 120, th.accent, since(t, 18.5), { align: 'right' })
  headline(
    t,
    [
      { s: '1年で、', b: 19 },
      { s: 'これ。', b: 19.5 },
    ],
    th,
  )
  tag(`${yen(BM.data.monthly)} × 12 = ${yen(BM.data.yearly)}`, 72, 1560, th, { size: 28, dt: since(t, 19) })
  return th
}

function sceneJudge(t) {
  const th = THEME.yellow
  const items = BM.data.items
  fill(th.bg)
  rings(t, th)

  const R = stepper(
    [
      [-1, 0],
      [20, 470],
      [23, 440],
      [25, 300],
    ],
    t,
  )
  shape('circle', 540, 1130, R * 2, COL.red)

  headline(
    t,
    [
      { s: 'AIが', b: 20 },
      { s: 'やめどきを', b: 21, br: true },
      { s: '判定。', b: 22 },
    ],
    th,
  )

  // candidates in the order the AI flags them (score high → low)
  const ranked = items
    .map((it, i) => ({ ...it, i }))
    .filter((it) => it.score >= 40)
    .sort((a, b) => b.score - a.score)
  const judgeBeat = new Map(ranked.map((it, k) => [it.i, 23 + 0.5 * k]))
  const top = ranked[0]

  const pos = (i) => {
    const row = Math.floor(i / 4)
    const col = i % 4
    const cols = row < 2 ? 4 : items.length - 8
    return [540 + (col - (cols - 1) / 2) * 212, 840 + row * 232]
  }
  const collapse = spring(since(t, 25), 38, 0.8)
  items.forEach((it, i) => {
    const [x, y] = pos(i)
    const pop = spring(since(t, SHAPE_HITS[i]), 40, 0.66)
    const jb = judgeBeat.get(i)
    const flagged = jb !== undefined && t >= T(jb)
    const dim = t >= T(23) && !flagged ? 0.28 : 1
    if (i === top.i) {
      const mx = lerp(x, 540, collapse)
      const my = lerp(y, 1060, collapse)
      const sc = pop * (flagged ? 1 + 0.15 * spring(since(t, jb), 40, 0.6) : 1) * (1 + 1.1 * collapse)
      shape(kindOf(i), mx, my, 150, flagged ? COL.blue : COL.cream, sc)
    } else {
      shape(kindOf(i), x, y, 150, flagged ? COL.blue : COL.cream, pop * (1 - collapse), dim)
    }
  })

  if (t < T(25)) {
    ranked.forEach((it, k) => {
      const [x, y] = pos(it.i)
      const label = it.score >= 60 ? '見直し優先' : '少し見直し'
      tag(`${it.category} · score ${it.score} · ${label}`, 72, 1490 + k * 64, th, {
        size: 26,
        dt: since(t, judgeBeat.get(it.i)),
        to: [x, y + 70],
      })
    })
  } else {
    tag(`見直し優先 ${top.category} → 年 ${yen(top.price * 12)}`, 540, 1520, th, {
      size: 40,
      dt: since(t, 25),
      align: 'center',
    })
  }
  return th
}

function sceneOff(t) {
  const th = THEME.ink
  flashBg(t, th, [26, 27], 0.3)
  rings(t, th)
  const a = 'なんとなく払い、'
  const sa = fitSize(a, JP, 900, 940, 132)
  slam(a, 540, 860, JP, 900, sa, th.fg, since(t, 26), { s0: 1.5 })
  const sp = easeOutExpo(since(t, 26.5) / 0.16)
  if (sp > 0) {
    ctx.fillStyle = th.accent
    ctx.fillRect(56, 860 - 12, (1024 - 56) * sp, 24)
  }
  const b = '卒業。'
  slam(b, 540, 1230, JP, 900, fitSize(b, JP, 900, 900, 300), th.accent, since(t, 27), { s0: 2.0 })
  return th
}

function sceneTitle(t) {
  const th = THEME.cream
  flashBg(t, th, [28], 0.3)
  rings(t, th)
  ;[COL.red, COL.blue, COL.ink].forEach((c, k) => {
    shape(KINDS[k], 430 + k * 110, 560, 76, c, spring(since(t, 29 + 0.25 * k), 40, 0.66))
  })
  const a = 'やめどき'
  slam(a, 540, 800, JP, 900, fitSize(a, JP, 900, 940, 250), th.fg, since(t, 28), { s0: 1.6 })
  const b = 'AI Money'
  rise(b, 540, 1150, NUM, 400, fitSize(b, NUM, 400, 900, 300), th.accent, since(t, 28.5), { align: 'center' })
  rise('毎月の“なんとなく払い”を、', 540, 1340, JP, 700, 50, th.fg, since(t, 29.5), { align: 'center' })
  rise('いっしょに見直そう。', 540, 1414, JP, 700, 50, th.fg, since(t, 29.75), { align: 'center' })
  ctx.save()
  ctx.globalAlpha = 0.65 * spring(since(t, 30), 30, 0.9)
  ctx.font = fnt(700, 22, MONO)
  ctx.fillStyle = th.fg
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(`BEAT ${BM.bpm.toFixed(1)} BPM · 32 beats · kick drift ≤ ${BM.maxKickDevMs} ms`, 540, 1760)
  ctx.fillText('MOTION  html seek(t) → playwright → ffmpeg', 540, 1800)
  ctx.restore()
  return th
}

const SCENES = [
  { from: 0, to: 4, draw: sceneCount('red'), label: '01  count' },
  { from: 4, to: 8, draw: sceneCount('yellow'), label: '01  count', enter: 'wipe' },
  { from: 8, to: 10, draw: sceneRest, label: '02  total' },
  { from: 10, to: 12, draw: sceneMonthly, label: '02  total' },
  { from: 12, to: 20, draw: sceneYear, label: '03  year', enter: 'wipe' },
  { from: 20, to: 26, draw: sceneJudge, label: '04  judge', enter: 'wipe' },
  { from: 26, to: 28, draw: sceneOff, label: '05  off' },
  { from: 28, to: Infinity, draw: sceneTitle, label: null },
]
const WIPE = 0.16

function seek(t) {
  const bt = t / B + 1e-6
  let si = 0
  for (let i = 0; i < SCENES.length; i++) if (bt >= SCENES[i].from) si = i
  const sc = SCENES[si]
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1
  const dt = since(t, sc.from)
  let th
  if (sc.enter === 'wipe' && si > 0 && dt < WIPE) {
    SCENES[si - 1].draw(t)
    const p = easeOutExpo(dt / WIPE)
    const x = W * (1 - p)
    const skew = 180 * (1 - p)
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(x + skew, 0)
    ctx.lineTo(W + 20, 0)
    ctx.lineTo(W + 20, H)
    ctx.lineTo(x - skew, H)
    ctx.closePath()
    ctx.clip()
    th = sc.draw(t)
    ctx.restore()
  } else {
    th = sc.draw(t)
  }
  if (sc.label) hud(t, th, sc.label)
  ctx.restore()
}

// ---------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------
const params = new URLSearchParams(location.search)

window.ready = (async () => {
  BM = await (await fetch('beatmap.json')).json()
  B = BM.beatSec
  RECORD = true
  for (let f = 0; f < BM.totalFrames; f++) seek(f / BM.fps)
  RECORD = false
  await Promise.all(
    [...USED].map((k) => {
      const [font, s] = k.split('\u0000')
      return document.fonts.load(font, s)
    }),
  )
  await document.fonts.ready
  const missing = [...USED].filter((k) => {
    const [font, s] = k.split('\u0000')
    return !document.fonts.check(font, s)
  })
  if (missing.length) console.warn('fonts not ready:', missing.length)
  seek(Number(params.get('t') || 0))
  return { strings: USED.size, missing: missing.length }
})()
window.seek = seek

// preview: click to play with sound (audio clock drives seek)
if (!params.has('render')) {
  document.body.classList.add('preview')
  const hint = document.createElement('div')
  hint.className = 'hint'
  hint.textContent = 'click to play / pause'
  document.body.append(hint)
  const audio = new Audio('audio.wav')
  const loop = () => {
    seek(audio.currentTime)
    if (!audio.paused) requestAnimationFrame(loop)
  }
  canvas.addEventListener('click', async () => {
    await window.ready
    if (audio.paused) {
      if (audio.ended || audio.currentTime >= BM.durationSec - 0.01) audio.currentTime = 0
      await audio.play()
      loop()
    } else audio.pause()
  })
}
