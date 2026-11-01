// Something Great (Sky) — lyric motion graphic, 1080×1920（縦）/ 1920×1080（横: ?aspect=wide）
//
// 15 秒版（../scene.js）と同じルール:
// - すべての見た目は seek(t) の中で t から計算する（状態・タイマーなし）
// - 時間は「拍番号」で扱う。拍の実時刻は曲から追跡した data.json の beats（テンポの揺れも込み）
// - 歌詞は元のリリック動画のタイミングを 16 分音符に寄せた拍に出す。演出は拍ごとに必ず何かが動く
// - 切り替えはハードカット / 0.16 秒ワイプ / フラッシュだけ。動きは小さなオーバーシュートのスプリング

const params = new URLSearchParams(location.search)
const WIDE = params.get('aspect') === 'wide'
const W = WIDE ? 1920 : 1080
const H = WIDE ? 1080 : 1920
const canvas = document.getElementById('c')
canvas.width = W
canvas.height = H
const ctx = canvas.getContext('2d')

const COL = { red: '#EE4323', yellow: '#F5C400', blue: '#2337E0', cream: '#F2ECE1', ink: '#151515' }
const THEME = {
  red: { bg: COL.red, fg: COL.cream, accent: COL.ink, sub: COL.yellow, flash: '#FFA18A' },
  yellow: { bg: COL.yellow, fg: COL.ink, accent: COL.blue, sub: COL.red, flash: '#FFE88A' },
  blue: { bg: COL.blue, fg: COL.cream, accent: COL.yellow, sub: COL.red, flash: '#8E9AF7' },
  cream: { bg: COL.cream, fg: COL.ink, accent: COL.red, sub: COL.blue, flash: '#FFFFFF' },
  ink: { bg: COL.ink, fg: COL.cream, accent: COL.yellow, sub: COL.red, flash: '#4A4A4A' },
}
const NUM = '"Anton"'
const MONO = '"JetBrains Mono"'
const X0 = WIDE ? 120 : 72
const X1 = W - X0
const CX = W / 2
// layout per orientation (portrait values are the ones the 1080×1920 version was designed with)
const L = WIDE
  ? {
      top: 180, cy: 540, ring: [360, 760], hopX: [X0 + 50, X1 - 50], hopY: [260, 880], hopR: [40, 110],
      low: 880, lowClamp: 790, pulseY: 930, sparks: [X0 + 30, X1 - 30, 330, 860],
      eq: [880, 50, 170], eqX: [CX + 40, X1], growR: [140, 430], stairs: [880, 28], stairsX: X1 - 936,
      starSize: 700, rayR: 2300, heroArrow: [W - 330, 330],
      stackH: 660, stackMax: 300, twoH: 660, twoMax: 300, boxCols: 3, boxBottom: 880,
      leadMax: 110, heroW: 1500, heroMax: 470, tailMax: 90,
      giantW: 1600, giantMax: 460, giantCy: 540, giantTagY: 800, giantHop: [870, 900],
      pairW: 820, pairMax: 330, pairTop: 180, pairGap: 50, pairHop: [860, 900], pairTailMax: 90, pairTailGap: 40,
    }
  : {
      top: 300, cy: 1000, ring: [230, 1240], hopX: [120, 960], hopY: [420, 1600], hopR: [50, 190],
      low: 1580, lowClamp: 1450, pulseY: 1690, sparks: [100, 980, 470, 1570],
      eq: [1640, 80, 260], eqX: [X0, X1], growR: [170, 560], stairs: [1660, 46], stairsX: X0,
      starSize: 820, rayR: 1500, heroArrow: [760, 520],
      stackH: 1150, stackMax: 330, twoH: 1180, twoMax: 300, boxCols: 2, boxBottom: 1580,
      leadMax: 130, heroW: 980, heroMax: 620, tailMax: 130,
      giantW: 980, giantMax: 640, giantCy: 1000, giantTagY: 1500, giantHop: [1350, 1600],
      pairW: 640, pairMax: 400, pairTop: 520, pairGap: 90, pairHop: [1450, 1620], pairTailMax: 110, pairTailGap: 80,
    }
const KINDS = ['circle', 'square', 'triangle']

// ---------------------------------------------------------------------------
// beat clock (non-uniform: tracked from the song)
// ---------------------------------------------------------------------------
let D = null
let BEATS = []
let PHRASES = []
let BARPOS = [] // 1..4 for every beat
let BARNO = [] // bar number (1-based) for every beat
function initBars() {
  BARPOS = BEATS.map((_, i) => (D.barPos ? D.barPos[i] : ((((i - D.downbeatPhase) % 4) + 4) % 4) + 1))
  let n = 0
  BARNO = BARPOS.map((bp) => {
    if (bp === 1) n++
    return Math.max(1, n)
  })
}

function T(b) {
  const n = BEATS.length
  if (b <= 0) return BEATS[0] + b * (BEATS[1] - BEATS[0])
  if (b >= n - 1) return BEATS[n - 1] + (b - (n - 1)) * (BEATS[n - 1] - BEATS[n - 2])
  const i = Math.floor(b)
  return BEATS[i] + (b - i) * (BEATS[i + 1] - BEATS[i])
}
function beatAt(t) {
  const n = BEATS.length
  if (t <= BEATS[0]) return (t - BEATS[0]) / (BEATS[1] - BEATS[0])
  if (t >= BEATS[n - 1]) return n - 1 + (t - BEATS[n - 1]) / (BEATS[n - 1] - BEATS[n - 2])
  let lo = 0
  let hi = n - 1
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1
    if (BEATS[m] <= t) lo = m
    else hi = m
  }
  return lo + (t - BEATS[lo]) / (BEATS[lo + 1] - BEATS[lo])
}
const since = (t, b) => t - T(b)

function spring(dt, w = 42, z = 0.74) {
  if (dt <= 0) return 0
  const wd = w * Math.sqrt(1 - z * z)
  return 1 - Math.exp(-z * w * dt) * (Math.cos(wd * dt) + ((z * w) / wd) * Math.sin(wd * dt))
}
const clamp01 = (x) => Math.max(0, Math.min(1, x))
const easeOutExpo = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(2, -10 * x))
const easeOutCubic = (x) => 1 - Math.pow(1 - clamp01(x), 3)
const lerp = (a, b, p) => a + (b - a) * p
const rand = (seed) => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}
function stepper(keys, t, w = 34, z = 0.78) {
  let v = keys[0][1]
  for (let i = 1; i < keys.length; i++) v += (keys[i][1] - keys[i - 1][1]) * spring(since(t, keys[i][0]), w, z)
  return v
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
const secs = (b) => `${T(b).toFixed(3)} s`

// ---------------------------------------------------------------------------
// font bookkeeping (record every glyph per font so the renderer can preload)
// ---------------------------------------------------------------------------
let RECORD = false
const USED = new Map()
const rawFill = ctx.fillText.bind(ctx)
ctx.fillText = (s, x, y) => {
  if (RECORD) {
    if (!USED.has(ctx.font)) USED.set(ctx.font, new Set())
    const set = USED.get(ctx.font)
    for (const ch of s) set.add(ch)
  }
  rawFill(s, x, y)
}
const fnt = (size, fam = NUM, weight = 400) => `${weight} ${Math.round(size)}px ${fam}`
function textW(str, size, fam = NUM, weight = 400) {
  ctx.font = fnt(size, fam, weight)
  return ctx.measureText(str).width
}
function fitSize(str, maxW, maxSize, fam = NUM) {
  return Math.min(maxSize, (100 * maxW) / textW(str, 100, fam))
}
// cap height of Anton at `size` (does not disturb the current ctx.font)
function capH(size) {
  const prev = ctx.font
  ctx.font = fnt(100)
  const r = ctx.measureText('H').actualBoundingBoxAscent / 100
  ctx.font = prev
  return r * size
}

// ---------------------------------------------------------------------------
// primitives
// ---------------------------------------------------------------------------
function fill(color) {
  ctx.fillStyle = color
  ctx.fillRect(0, 0, W, H)
}
function flashBg(t, th, beats, dur = 0.26) {
  let dt = -1
  for (const b of beats) if (t >= T(b) - 1e-9) dt = since(t, b)
  fill(dt < 0 ? th.bg : mix(th.flash, th.bg, clamp01(dt / dur)))
}

function rings(t, th) {
  const bt = beatAt(t)
  const n = Math.floor(bt)
  const ang = (n + spring(since(t, n), 30, 0.8)) * 0.075
  ctx.save()
  ctx.globalAlpha = 0.13
  ctx.strokeStyle = th.fg
  ctx.translate(L.ring[0], L.ring[1])
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

function shape(kind, cx, cy, size, color, scale = 1, alpha = 1, rot = 0) {
  if (scale <= 0.001 || alpha <= 0.001) return
  ctx.save()
  ctx.globalAlpha *= alpha
  ctx.translate(cx, cy)
  ctx.rotate(rot)
  ctx.scale(scale, scale)
  ctx.fillStyle = color
  const r = size / 2
  ctx.beginPath()
  if (kind === 'circle') ctx.arc(0, 0, r, 0, Math.PI * 2)
  else if (kind === 'square') ctx.rect(-r * 0.9, -r * 0.9, r * 1.8, r * 1.8)
  else if (kind === 'star') {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      const rr = i % 2 ? r * 0.45 : r
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
    }
    ctx.closePath()
  } else {
    ctx.moveTo(0, -r * 1.02)
    ctx.lineTo(r * 1.04, r * 0.84)
    ctx.lineTo(-r * 1.04, r * 0.84)
    ctx.closePath()
  }
  ctx.fill()
  ctx.restore()
}

// word rising out of a mask; baseline (x, y), left aligned unless align given
function riseWord(s, x, y, size, color, dt, { align = 'left' } = {}) {
  if (dt < 0) return 0
  const p = spring(dt, 46, 0.8)
  ctx.save()
  ctx.font = fnt(size)
  ctx.textAlign = align
  ctx.textBaseline = 'alphabetic'
  const w = ctx.measureText(s).width
  const ch = capH(size)
  const left = align === 'left' ? x : align === 'right' ? x - w : x - w / 2
  ctx.beginPath()
  ctx.rect(left - 10, y - ch - size * 0.12, w + 20, ch + size * 0.3)
  ctx.clip()
  ctx.fillStyle = color
  ctx.fillText(s, x, y + (1 - p) * (ch + size * 0.25))
  ctx.restore()
  return w
}

// glyph-box centre offset for textBaseline 'middle' (Anton sits high in its em box)
function midOffset(str) {
  const m = ctx.measureText(str)
  return (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2
}

function slam(str, cx, cy, size, color, dt, { s0 = 1.7, echo = true, fam = NUM, center = false } = {}) {
  if (dt < 0) return
  const p = spring(dt, 36, 0.7)
  const s = 1 + (s0 - 1) * (1 - p)
  ctx.save()
  ctx.font = fnt(size, fam)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = color
  if (center) cy += midOffset(str)
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

function tag(str, x, y, th, { size = 24, dt = 1, align = 'left', to = null } = {}) {
  if (dt < 0) return
  ctx.save()
  ctx.font = fnt(size, MONO, 700)
  const padX = size * 0.5
  const h = Math.round(size * 1.6)
  const w = ctx.measureText(str).width + padX * 2
  const bx = align === 'left' ? x : align === 'right' ? x - w : x - w / 2
  const p = easeOutExpo(dt / 0.22)
  if (to) {
    const sx = Math.max(bx + 24, Math.min(bx + w - 24, to[0]))
    const sy = to[1] < y ? y : y + h
    ctx.strokeStyle = th.fg
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.lineTo(lerp(sx, to[0], p), lerp(sy, to[1], p))
    ctx.stroke()
    ctx.fillStyle = th.fg
    ctx.beginPath()
    ctx.arc(to[0], to[1], 7 * p, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.beginPath()
  ctx.rect(bx, y, w * p, h)
  ctx.clip()
  ctx.fillStyle = th.fg
  ctx.fillRect(bx, y, w, h)
  ctx.fillStyle = th.bg
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(str, bx + padX, y + h / 2 + size * 0.05)
  ctx.restore()
}

function blocks(t, hits, n, th, { x0 = X0, x1 = X1, y, h = 90, gap = 14 }) {
  const bw = (x1 - x0 - gap * (n - 1)) / n
  let newest = -1
  hits.forEach((b, k) => {
    if (t >= T(b) - 1e-9) newest = k
  })
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

// integer beats inside a phrase: [ceil(start) .. end)
function beatsIn(p) {
  const out = []
  for (let b = Math.ceil(p.start - 1e-6); b < p.end - 1e-6; b++) out.push(b)
  return out
}

// a circle that hops to a new place on every beat of the phrase
function hop(t, p, th, { y0 = L.hopY[0], y1 = L.hopY[1], rMin = L.hopR[0], rMax = L.hopR[1], x0 = L.hopX[0], x1 = L.hopX[1] } = {}) {
  const bs = beatsIn(p)
  if (!bs.length) return
  const keys = (f) => [[-1e9, f(-1)], ...bs.map((b, k) => [b, f(k)])]
  const s = p.idx * 97
  const x = stepper(keys((k) => x0 + rand(s + k * 3) * (x1 - x0)), t)
  const y = stepper(keys((k) => y0 + rand(s + k * 3 + 1) * (y1 - y0)), t)
  const r = stepper(keys((k) => (k < 0 ? 0 : rMin + rand(s + k * 3 + 2) * (rMax - rMin))), t)
  shape('circle', x, y, r * 2, th.sub)
}

// row of shapes at the bottom, one more on every beat (8-beat cycle)
function pulseRow(t, p, th) {
  const bs = beatsIn(p)
  const bt = beatAt(t)
  const n = 8
  const xs = (k) => X0 + 40 + (k * (X1 - X0 - 80)) / (n - 1)
  const cols = [th.fg, th.accent, th.sub]
  bs.forEach((b, i) => {
    if (bt < b - 1e-6) return
    const cycle = Math.floor(i / n)
    const cur = Math.floor((bt - bs[0]) / n)
    if (cycle !== cur) return
    const k = i % n
    shape(KINDS[(i + p.idx) % 3], xs(k), L.pulseY, 64, cols[(i + p.idx) % 3], spring(since(t, b), 40, 0.66))
  })
}

// ---------------------------------------------------------------------------
// decorations
// ---------------------------------------------------------------------------
function deco(t, p, th, hero, { arrow = L.heroArrow } = {}) {
  const bs = beatsIn(p)
  const kind = p.deco
  if (kind === 'arrow') {
    // an arrow that climbs up-right one step per beat, resetting every 4 beats
    const keys = [[-1e9, 0], ...bs.map((b) => [b, ((b - bs[0]) % 4) + 1])]
    const k = stepper(keys, t, 40, 0.8)
    const x = arrow[0] + k * 34
    const y = arrow[1] - k * 34
    ctx.save()
    ctx.strokeStyle = th.accent
    ctx.fillStyle = th.accent
    ctx.lineWidth = 22
    ctx.lineCap = 'square'
    ctx.beginPath()
    ctx.moveTo(x - 90, y + 90)
    ctx.lineTo(x + 40, y - 40)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x + 70, y - 70)
    ctx.lineTo(x - 30, y - 70)
    ctx.lineTo(x + 70, y + 30)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  } else if (kind === 'sparks' && hero) {
    for (let i = 0; i < 12; i++) {
      const b = hero.beat + i * 0.5
      const x = L.sparks[0] + rand(p.idx * 31 + i) * (L.sparks[1] - L.sparks[0])
      const y = L.sparks[2] + rand(p.idx * 31 + i + 99) * (L.sparks[3] - L.sparks[2])
      shape(KINDS[i % 3], x, y, 26 + rand(i + 5) * 40, i % 2 ? th.accent : th.sub, spring(since(t, b), 44, 0.62))
    }
  } else if (kind === 'eq') {
    const n = 14
    const bw = (L.eqX[1] - L.eqX[0] - 10 * (n - 1)) / n
    const bt = beatAt(t)
    const b = Math.floor(bt)
    const dt = since(t, b)
    for (let i = 0; i < n; i++) {
      const hb = L.eq[1] + rand(b * 17 + i) * L.eq[2]
      const h = hb * (0.3 + 0.7 * Math.exp(-dt * 7)) * spring(since(t, p.start), 30, 0.8)
      ctx.fillStyle = i % 4 === 1 ? th.accent : th.fg
      ctx.fillRect(L.eqX[0] + i * (bw + 10), L.eq[0] - h, bw, h)
    }
  } else if (kind === 'grow' && hero) {
    const tail = p.words.find((w) => w.role === 'tail')
    const keys = [
      [-1e9, 0],
      [hero.beat, L.growR[0]],
    ]
    if (tail) keys.push([tail.beat, L.growR[1]])
    const r = stepper(keys, t, 26, 0.8)
    shape('circle', CX, L.cy + 10, r * 2, th.sub)
  } else if (kind === 'stairs') {
    bs.slice(0, 8).forEach((b, k) => {
      const hh = L.stairs[1] * (k + 1) * spring(since(t, b), 46, 0.72)
      ctx.fillStyle = k === bs.filter((x) => t >= T(x)).length - 1 ? th.accent : th.fg
      ctx.fillRect(L.stairsX + k * 117, L.stairs[0] - hh, 105, hh)
    })
  } else if (kind === 'star' && hero) {
    const keys = [[-1e9, 0], ...bs.map((b, k) => [b, k + 1])]
    const rot = stepper(keys, t, 30, 0.8) * (Math.PI / 10)
    shape('star', CX, L.cy, L.starSize, th.sub, spring(since(t, hero.beat), 30, 0.62), 1, rot)
  } else if (kind === 'light' && hero) {
    const dt = since(t, hero.beat)
    if (dt >= 0) {
      const keys = [[-1e9, 0], ...bs.map((b, k) => [b, k + 1])]
      const rot = stepper(keys, t, 30, 0.8) * (Math.PI / 12)
      ctx.save()
      ctx.translate(CX, L.cy)
      ctx.rotate(rot)
      ctx.fillStyle = th.sub
      ctx.globalAlpha = 0.9 * spring(dt, 26, 0.8)
      for (let i = 0; i < 12; i++) {
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.arc(0, 0, L.rayR, (i * Math.PI) / 6, (i * Math.PI) / 6 + Math.PI / 14)
        ctx.closePath()
        ctx.fill()
      }
      ctx.restore()
    }
  }
}

// ---------------------------------------------------------------------------
// templates — each draws a full frame and returns the theme it used
// ---------------------------------------------------------------------------
function newestIdx(t, words) {
  let n = -1
  words.forEach((w, i) => {
    if (t >= T(w.beat) - 1e-9) n = i
  })
  return n
}

function layoutLines(lines, maxW, maxH, maxSize) {
  const widths = lines.map((ws) => textW(ws.map((w) => w.s).join(' '), 100))
  const adv = capH(100) * 1.22 / 100
  return Math.min(maxSize, (100 * maxW) / Math.max(...widths), maxH / (lines.length * adv))
}

function drawLines(t, lines, th, { x0 = X0, top = L.top, size, newest, align = 'left', colorOf = null }) {
  const ch = capH(size)
  const space = size * 0.24
  lines.forEach((ws, li) => {
    const y = top + ch + li * ch * 1.22
    const total = ws.reduce((s, w) => s + textW(w.s, size), 0) + space * (ws.length - 1)
    let x = align === 'left' ? x0 : X1 - total
    ws.forEach((w) => {
      const color = colorOf ? colorOf(w, li) : w === newest ? th.accent : th.fg
      riseWord(w.s, x, y, size, color, since(t, w.beat))
      x += textW(w.s, size) + space
    })
  })
  return top + lines.length * ch * 1.22
}

function stackArrow(textBottom, blockW) {
  if (!WIDE) return [800, Math.min(1420, textBottom + 260)]
  if (X0 + blockW + 380 < X1) return [X0 + blockW + 220, Math.min(L.lowClamp, (L.top + textBottom) / 2 + 60)]
  return [X1 - 200, Math.min(L.lowClamp, textBottom + 200)]
}

function tplStack(t, p, th) {
  const flashes = p.enter === 'flash' ? [p.start] : []
  flashBg(t, th, flashes)
  rings(t, th)
  let lines = []
  p.words.forEach((w) => {
    if (!lines.length || w.k === 0) lines.push([])
    lines[lines.length - 1].push(w)
  })
  let size = layoutLines(lines, X1 - X0, L.stackH, L.stackMax)
  const perWord = p.words.map((w) => [w])
  const wordSize = layoutLines(perWord, X1 - X0, L.stackH, L.stackMax)
  // p.lines: the line breaks were chosen on purpose (suno_import.py), keep them
  if (!p.lines && (WIDE ? wordSize > size : size < 170)) {
    lines = perWord
    size = wordSize
  }
  const textBottom = L.top + lines.length * capH(size) * 1.22
  const blockW = Math.max(...lines.map((ws) => textW(ws.map((w) => w.s).join(' '), size)))
  hop(t, p, th, { y0: Math.min(L.lowClamp, textBottom + 280), y1: L.low })
  if (p.deco) deco(t, p, th, null, { arrow: stackArrow(textBottom, blockW) })
  const ni = newestIdx(t, p.words)
  const bottom = drawLines(t, lines, th, { size, newest: p.words[ni] })
  tag(`"${p.words[0].s}" = ${secs(p.words[0].beat)}`, X0, bottom + 40, th, { dt: since(t, p.start) })
  if (p.end - p.start >= 8) pulseRow(t, p, th)
  return th
}

function tplHero(t, p, th) {
  const hero = p.words.find((w) => w.role === 'hero')
  const flashes = [...(p.enter === 'flash' ? [p.start] : []), ...(hero ? [hero.beat] : [])]
  flashBg(t, th, flashes, p.deco === 'light' ? 0.6 : 0.26)
  rings(t, th)
  if (p.deco) deco(t, p, th, hero)
  const lead = p.words.filter((w) => w.role === 'lead')
  const tail = p.words.filter((w) => w.role === 'tail')
  const ni = newestIdx(t, p.words)
  const leadSize = lead.length ? Math.min(L.leadMax, layoutLines([lead], X1 - X0, 400, L.leadMax)) : 0
  if (lead.length) {
    drawLines(t, [lead], th, { size: leadSize, top: L.top, newest: p.words[ni] === hero ? null : p.words[ni] })
  }
  let heroBottom = L.cy
  if (hero) {
    let size = fitSize(hero.s, L.heroW, L.heroMax)
    let cy = L.cy
    if (WIDE) {
      const top = (lead.length ? L.top + capH(leadSize) : L.top - 60) + 40
      const bottom = tail.length ? 790 : 870
      size = Math.min(size, ((bottom - top) * 100) / capH(100))
      cy = (top + bottom) / 2
    }
    slam(hero.s, CX, cy, size, th.fg, since(t, hero.beat), { center: WIDE })
    heroBottom = cy + capH(size) / 2
    const [tx, ty, align] = WIDE
      ? tail.length
        ? [X1, heroBottom + 64, 'right']
        : [X0, heroBottom + 50, 'left']
      : [X0, heroBottom + (tail.length ? 230 : 70), 'left']
    tag(`"${hero.s}" = ${secs(hero.beat)}`, tx, ty, th, {
      dt: since(t, hero.beat),
      align,
      to: tail.length ? null : [CX, heroBottom + 10],
    })
  }
  if (tail.length) {
    const size = Math.min(L.tailMax, layoutLines([tail], X1 - X0, 300, L.tailMax))
    drawLines(t, [tail], th, { size, top: heroBottom + 60, newest: p.words[ni] })
  }
  if (p.end - p.start >= 8 && !['eq', 'stairs'].includes(p.deco)) pulseRow(t, p, th)
  return th
}

function tplGiant(t, p, th) {
  flashBg(t, th, p.enter === 'flash' ? [p.start] : [])
  rings(t, th)
  hop(t, p, th, { y0: L.giantHop[0], y1: L.giantHop[1], rMin: 40, rMax: WIDE ? 60 : 110 })
  const ws = p.words
  const i = newestIdx(t, ws)
  // transcript line at the top: sung words solid, the current one accented, upcoming faint
  const line = ws.map((w) => w.s).join(' ')
  const size = Math.min(76, fitSize(line, X1 - X0, 76))
  ctx.save()
  ctx.font = fnt(size)
  ctx.textBaseline = 'alphabetic'
  let x = X0
  ws.forEach((w, k) => {
    ctx.globalAlpha = k <= i ? 1 : 0.22
    ctx.fillStyle = k === i ? th.accent : th.fg
    ctx.fillText(w.s, x, L.top + capH(size))
    x += ctx.measureText(w.s + ' ').width
  })
  ctx.restore()
  if (i < 0) return th
  const dt = since(t, ws[i].beat)
  if (i > 0 && dt < 0.3) {
    const q = clamp01(dt / 0.3)
    ctx.save()
    ctx.globalAlpha = 0.35 * (1 - q)
    ctx.font = fnt(fitSize(ws[i - 1].s, L.giantW, L.giantMax))
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = th.fg
    ctx.translate(CX, L.giantCy + (WIDE ? midOffset(ws[i - 1].s) : 0))
    ctx.scale(1 + 0.7 * q, 1 + 0.7 * q)
    ctx.fillText(ws[i - 1].s, 0, 0)
    ctx.restore()
  }
  slam(ws[i].s, CX, L.giantCy, fitSize(ws[i].s, L.giantW, L.giantMax), i === ws.length - 1 ? th.accent : th.fg, dt, {
    s0: 1.55,
    center: WIDE,
  })
  tag(`word ${i + 1}/${ws.length} = ${secs(ws[i].beat)}`, X0, L.giantTagY, th, { dt })
  return th
}

function tplBoxes(t, p, th) {
  flashBg(t, th, p.enter === 'flash' ? [p.start] : [])
  rings(t, th)
  const ws = p.words
  const ni = newestIdx(t, ws)
  const cols = L.boxCols
  const rows = Math.ceil(ws.length / cols)
  const bw = (X1 - X0 - 36 * (cols - 1)) / cols
  const bh = Math.min(206, (L.boxBottom - L.top - 26 * (rows - 1)) / rows)
  ws.forEach((w, k) => {
    const dt = since(t, w.beat)
    if (dt < 0) return
    const col = k % cols
    const row = Math.floor(k / cols)
    const x = X0 + col * (bw + 36)
    const y = L.top + row * (bh + 26)
    const p1 = easeOutExpo(dt / 0.2)
    const filled = k === ni
    ctx.save()
    ctx.beginPath()
    ctx.rect(x - 6, y - 6, (bw + 12) * p1, bh + 12)
    ctx.clip()
    if (filled) {
      ctx.fillStyle = th.accent
      ctx.fillRect(x, y, bw, bh)
    }
    ctx.strokeStyle = th.fg
    ctx.lineWidth = 8
    ctx.strokeRect(x, y, bw, bh)
    const size = fitSize(w.s, bw - 60, 150)
    ctx.font = fnt(size)
    ctx.fillStyle = filled ? th.bg : th.fg
    ctx.textBaseline = 'alphabetic'
    const lift = (1 - spring(dt, 46, 0.8)) * 40
    ctx.fillText(w.s, x + 28, y + bh - 58 + lift)
    ctx.font = fnt(20, MONO, 700)
    ctx.globalAlpha = 0.75
    ctx.textAlign = 'right'
    ctx.fillText(secs(w.beat), x + bw - 18, y + bh - 20)
    ctx.restore()
  })
  if (p.end - p.start >= 8) pulseRow(t, p, th)
  return th
}

function tplTwo(t, p, th) {
  flashBg(t, th, p.enter === 'flash' ? [p.start] : [])
  rings(t, th)
  const cut = p.words.findIndex((w) => w.br)
  const l1 = cut > 0 ? p.words.slice(0, cut) : p.words
  const l2 = cut > 0 ? p.words.slice(cut) : []
  const split = (l) => (l.length > 1 ? [l.slice(0, -1), l.slice(-1)] : [l])
  // 4 lines ("READY TO" / "SHINE" / …) or 2 lines, whichever lets the words be bigger
  const four = [...split(l1), ...(l2.length ? split(l2) : [])]
  const two = [l1, l2].filter((l) => l.length)
  const s4 = layoutLines(four, X1 - X0, L.twoH, L.twoMax)
  const s2 = layoutLines(two, X1 - X0, L.twoH, L.twoMax)
  const A = s2 > s4 ? [l1] : split(l1)
  const B = l2.length ? (s2 > s4 ? [l2] : split(l2)) : []
  const size = Math.max(s2, s4)
  const top = L.top
  const textBottom = top + (A.length + B.length) * capH(size) * 1.22
  hop(t, p, th, { y0: Math.min(L.lowClamp, textBottom + 280), y1: L.low })
  const mid = drawLines(t, A, th, { size, top, colorOf: () => th.fg })
  if (B.length) drawLines(t, B, th, { size, top: mid, align: 'right', colorOf: () => th.accent })
  tag(`"${p.words[0].s}" = ${secs(p.words[0].beat)}`, X0, textBottom + 40, th, { dt: since(t, p.start) })
  if (p.end - p.start >= 8) pulseRow(t, p, th)
  return th
}

function tplPair(t, p, th) {
  flashBg(t, th, p.enter === 'flash' ? [p.start] : [])
  rings(t, th)
  hop(t, p, th, { y0: L.pairHop[0], y1: L.pairHop[1], rMin: 40, rMax: WIDE ? 50 : 100 })
  const main = p.words.filter((w) => w.role !== 'tail')
  const tail = p.words.filter((w) => w.role === 'tail')
  const [a, by, b] = main
  const big = fitSize(a.s, L.pairW, L.pairMax)
  const ch = capH(big)
  const y1 = L.pairTop + ch
  const wA = riseWord(a.s, X0, y1, big, th.fg, since(t, a.beat))
  if (by) riseWord(by.s, X0 + Math.max(wA, textW(a.s, big)) + 36, y1, 120, th.accent, since(t, by.beat))
  const y2 = y1 + ch + L.pairGap
  if (b) riseWord(b.s, X1, y2, big, th.fg, since(t, b.beat), { align: 'right' })
  if (tail.length) {
    const size = Math.min(L.pairTailMax, layoutLines([tail], X1 - X0, 300, L.pairTailMax))
    drawLines(t, [tail], th, { size, top: y2 + L.pairTailGap, newest: p.words[newestIdx(t, p.words)] })
  }
  return th
}

function tplCount(t, p, th) {
  flashBg(t, th, p.enter === 'flash' ? [p.start] : [])
  rings(t, th)
  const dt = since(t, p.start)
  if (WIDE) riseWord(p.label || '', X1, 290, 64, th.fg, dt, { align: 'right' })
  else riseWord(p.label || '', X0, 360, 72, th.fg, dt)
  const num = p.words[0].s
  ctx.save()
  const size = WIDE ? 900 : 1180
  ctx.font = fnt(size)
  const p1 = spring(dt, 34, 0.72)
  ctx.translate(X0 - 20, WIDE ? 960 : 1460)
  ctx.scale(1 + 0.4 * (1 - p1), 1 + 0.4 * (1 - p1))
  ctx.fillStyle = th.accent
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(num, 0, 0)
  ctx.restore()
  const rem = Math.max(0, (D.countdownTo ?? 180) - t)
  const mm = Math.floor(rem / 60)
  const ss = String(Math.floor(rem % 60)).padStart(2, '0')
  riseWord(`T-${mm}:${ss}`, X1, WIDE ? 520 : 700, WIDE ? 170 : 150, th.fg, dt, { align: 'right' })
  tag(`"${num}" = ${secs(p.start)}`, X1, WIDE ? 560 : 760, th, { dt, align: 'right' })
  const bs = beatsIn(p).slice(0, 16)
  blocks(t, bs, bs.length, th, WIDE ? { x0: CX - 40, y: 720 } : { y: 1560 })
  return th
}

const COUNT_BG = ['blue', 'yellow', 'red', 'ink']
function tplCountdown(t, p, th0) {
  const gi = Math.max(0, newestIdx(t, p.words))
  const th = THEME[COUNT_BG[gi % 4]] || th0
  flashBg(t, th, p.words.map((w) => w.beat))
  rings(t, th)
  hop(t, p, th, WIDE
    ? { x0: X1 - 260, x1: X1 - 60, y0: L.top + 20, y1: L.top + 100, rMin: 30, rMax: 70 }
    : { y0: 1300, y1: 1450, rMin: 40, rMax: 120 })
  riseWord('COUNTDOWN', X0, WIDE ? L.top + 50 : 360, WIDE ? 64 : 72, th.fg, since(t, p.start))
  const w = p.words[gi]
  slam(w.s, CX, WIDE ? 500 : 980, fitSize(w.s, WIDE ? 1600 : 980, WIDE ? 500 : 560), th.fg, since(t, w.beat))
  tag(`"${w.s}" = ${secs(w.beat)}`, X0, WIDE ? 770 : 1360, th, { dt: since(t, w.beat) })
  blocks(t, p.words.map((x) => x.beat), 4, th, WIDE ? { y: 830, h: 80 } : { y: 1540, h: 110 })
  return th
}

function tplZero(t, p, th) {
  const [z, a, b] = p.groups.map((g) => ({ s: g.words.join(' '), beat: g.beat }))
  flashBg(t, th, [p.start, ...(b ? [b.beat] : [])], 0.4)
  rings(t, th)
  slam(z.s, WIDE ? W * 0.27 : 540, WIDE ? L.cy : 680, WIDE ? 760 : 820, th.sub, since(t, z.beat), { s0: 1.5 })
  const fitW = WIDE ? 820 : 900
  const sa = Math.min(fitSize('ALL SET', fitW, 240), fitSize("LET'S GO", fitW, 240))
  const ax = WIDE ? W * 0.66 : 540
  const ay = WIDE ? L.cy - 90 : 1150
  if (a) slam(a.s, ax, ay, sa, th.fg, since(t, a.beat))
  if (b) slam(b.s, ax, ay + capH(sa) + (WIDE ? 80 : 110), sa, th.accent, since(t, b.beat))
  if (p.end - p.start >= 8) pulseRow(t, p, th)
  return th
}

function tplTitle(t, p, th) {
  flashBg(t, th, [p.start], 0.3)
  rings(t, th)
  const b0 = p.start
  ;[COL.red, COL.blue, COL.ink].forEach((c, k) => {
    shape(KINDS[k], CX - 110 + k * 110, WIDE ? 200 : 520, 76, c, spring(since(t, b0 + 1 + 0.5 * k), 40, 0.66))
  })
  const small = p.small ?? 'SOMETHING'
  const big = p.big ?? 'GREAT'
  const tail = p.tail ?? 'IS ON ITS WAY.'
  riseWord(small, CX, WIDE ? 370 : 800, Math.min(WIDE ? 130 : 170, fitSize(small, X1 - X0, 170)), th.fg, since(t, b0), { align: 'center' })
  slam(big, CX, WIDE ? 600 : 1080, fitSize(big, WIDE ? 1500 : 960, WIDE ? 380 : 560), th.accent, since(t, b0 + 0.5))
  riseWord(tail, CX, WIDE ? 860 : 1420, Math.min(WIDE ? 80 : 96, fitSize(tail, X1 - X0, 96)), th.fg, since(t, b0 + 2), { align: 'center' })
  ctx.save()
  ctx.globalAlpha = 0.7 * spring(since(t, b0 + 3), 30, 0.9)
  ctx.font = fnt(22, MONO, 700)
  ctx.fillStyle = th.fg
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const cy0 = WIDE ? 950 : 1700
  ctx.fillText(`MUSIC   ${D.title}`, CX, cy0)
  ctx.fillText(`BEATS   ${BEATS.length} ${D.beatSource ?? 'tracked from the audio'} · ~${D.bpm} BPM`, CX, cy0 + (WIDE ? 35 : 40))
  ctx.fillText('MOTION  html seek(t) → playwright → ffmpeg', CX, cy0 + (WIDE ? 70 : 80))
  ctx.restore()
  return th
}

// ---------------------------------------------------------------------------
// motions after the "Opus 5.5 Motion Graphics" sheet (numbers as on the sheet)
// ---------------------------------------------------------------------------

function linesOf(p) {
  const lines = []
  p.words.forEach((w) => {
    if (!lines.length || w.k === 0) lines.push([])
    lines[lines.length - 1].push(w)
  })
  return lines
}

// lead words on top, as in the hero layout; returns the size used
function leadLine(t, p, th, lead) {
  if (!lead.length) return 0
  const size = Math.min(L.leadMax, layoutLines([lead], X1 - X0, 400, L.leadMax))
  drawLines(t, [lead], th, { size, top: L.top, colorOf: () => th.fg })
  return size
}

// 09 masked type: the outline rises through a mask line, then fills from the bottom up
function tplMask(t, p, th) {
  flashBg(t, th, p.enter === 'flash' ? [p.start] : [])
  rings(t, th)
  const lines = linesOf(p)
  const size = layoutLines(lines, X1 - X0, L.stackH, L.stackMax)
  const ch = capH(size)
  const space = size * 0.24
  const pad = size * 0.08
  const newest = p.words[newestIdx(t, p.words)]
  const ruleP = easeOutExpo(since(t, p.start) / 0.6)
  lines.forEach((ws, li) => {
    const base = L.top + ch + li * ch * 1.22
    ctx.save()
    ctx.globalAlpha = 0.5
    ctx.fillStyle = th.fg
    ctx.fillRect(X0, base + pad, (X1 - X0) * ruleP, 3)
    ctx.restore()
    let x = X0
    ws.forEach((w) => {
      const ww = textW(w.s, size)
      const dt = since(t, w.beat)
      if (dt >= 0) {
        const y = base + (1 - spring(dt, 40, 0.8)) * (ch + pad * 2)
        const fillP = easeOutExpo((dt - 0.14) / 0.4)
        ctx.save()
        ctx.beginPath()
        ctx.rect(x - 10, base - ch - pad * 2, ww + 20, ch + pad * 3)
        ctx.clip()
        ctx.font = fnt(size)
        ctx.textBaseline = 'alphabetic'
        ctx.lineWidth = Math.max(2, size * 0.022)
        ctx.strokeStyle = th.fg
        ctx.strokeText(w.s, x, y)
        if (fillP > 0) {
          const hh = (ch + pad * 3) * fillP
          ctx.beginPath()
          ctx.rect(x - 10, base + pad - hh, ww + 20, hh)
          ctx.clip()
          ctx.fillStyle = w === newest ? th.accent : th.fg
          ctx.fillText(w.s, x, y)
        }
        ctx.restore()
      }
      x += ww + space
    })
  })
  const bottom = L.top + lines.length * ch * 1.22
  tag('rising through the mask', X0, Math.min(bottom + 40, WIDE ? 830 : 1500), th, { dt: since(t, p.start) })
  if (p.end - p.start >= 8) pulseRow(t, p, th)
  return th
}

// 10 elastic type: the held word stretches while it is sung and springs back when it ends
function tplElastic(t, p, th) {
  const hero = p.words.find((w) => w.role === 'hero')
  flashBg(t, th, p.enter === 'flash' ? [p.start] : [])
  rings(t, th)
  const lead = p.words.filter((w) => w.role === 'lead')
  const tail = p.words.filter((w) => w.role === 'tail')
  const leadSize = leadLine(t, p, th, lead)
  if (!hero) return th
  const t0 = T(hero.beat)
  const t1 = Math.max(T(hero.end), t0 + 0.3)
  const MAX = 0.6
  const sx =
    t < t0 ? 1 : t < t1 ? 1 + MAX * easeOutCubic((t - t0) / (t1 - t0)) : Math.max(0.75, 1 + MAX * (1 - spring(t - t1, 26, 0.32)))
  const letters = [...hero.s]
  const top = (lead.length ? L.top + capH(leadSize) : L.top - 60) + 60
  const bottom = tail.length ? (WIDE ? 790 : 1400) : WIDE ? 870 : 1500
  const size = Math.min(fitSize(hero.s, (X1 - X0) / (1 + MAX * 1.35), WIDE ? 480 : 600), ((bottom - top) * 100) / capH(100))
  const ch = capH(size)
  const base = (top + bottom) / 2 + ch / 2
  const spacing = (sx - 1) * size * 0.32
  const ws = letters.map((c) => textW(c, size))
  const total = ws.reduce((a, b) => a + b * sx, 0) + spacing * (letters.length - 1)
  const dt = since(t, hero.beat)
  if (dt >= 0) {
    // baseline guide
    ctx.save()
    ctx.globalAlpha = 0.45
    ctx.fillStyle = th.fg
    ctx.fillRect(X0, base + 6, X1 - X0, 3)
    ctx.restore()
    const rise = spring(dt, 44, 0.8)
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, base - ch * 1.3, W, ch * 1.3 + 8)
    ctx.clip()
    ctx.font = fnt(size)
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = t >= t0 && t < t1 ? th.accent : th.fg
    let x = CX - total / 2
    letters.forEach((c, k) => {
      ctx.save()
      ctx.translate(x, base + (1 - rise) * ch * 1.2)
      ctx.scale(sx, 1 - (sx - 1) * 0.06)
      ctx.fillText(c, 0, 0)
      ctx.restore()
      x += ws[k] * sx + spacing
    })
    ctx.restore()
    ctx.save()
    ctx.font = fnt(24, MONO, 700)
    ctx.fillStyle = th.fg
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'right'
    ctx.fillText(`wdth ${Math.round(sx * 100)}  wght 400`, X1, base - ch - 24)
    ctx.textAlign = 'left'
    ctx.fillText(t < t1 ? 'baseline · held' : 'baseline · at rest', X0, base + 44)
    ctx.restore()
  }
  if (tail.length) {
    const size2 = Math.min(L.tailMax, layoutLines([tail], X1 - X0, 300, L.tailMax))
    drawLines(t, [tail], th, { size: size2, top: base + 90, newest: p.words[newestIdx(t, p.words)] })
  }
  tag(`"${hero.s}" held ${(t1 - t0).toFixed(2)} s`, X1, WIDE ? 890 : 1600, th, { dt, align: 'right' })
  return th
}

// 11 text → layout: the line arrives as one sentence, then re-sets itself around its key word
function tplRelayout(t, p, th) {
  flashBg(t, th, p.enter === 'flash' ? [p.start] : [])
  rings(t, th)
  const ws = p.words
  const key = ws.find((w) => w.role === 'hero') || ws.reduce((a, b) => (b.s.length >= a.s.length ? b : a))
  const ki = ws.indexOf(key)
  const last = Math.max(...ws.map((w) => w.beat))
  const tB = Math.max(last + 0.25, Math.min(last + 1, p.end - 1.5))
  // layout A: one centred sentence
  const sA = Math.min(WIDE ? 100 : 86, fitSize(ws.map((w) => w.s).join(' '), X1 - X0, 100))
  const spA = sA * 0.26
  const wA = ws.map((w) => textW(w.s, sA))
  let xa = CX - (wA.reduce((a, b) => a + b, 0) + spA * (ws.length - 1)) / 2
  const A = ws.map((w, k) => {
    const r = { x: xa, y: L.cy + capH(sA) / 2, s: sA }
    xa += wA[k] + spA
    return r
  })
  // layout B: key word big in the middle, the words before it above (left), after it below (right)
  const before = ws.slice(0, ki)
  const after = ws.slice(ki + 1)
  const sKey = fitSize(key.s, X1 - X0, WIDE ? 380 : 440)
  const keyBase = L.cy + capH(sKey) / 2
  const small = (list) => (list.length ? Math.min(WIDE ? 96 : 90, fitSize(list.map((w) => w.s).join(' '), X1 - X0, 96)) : 0)
  const sBf = small(before)
  const sAf = small(after)
  const B = []
  let xb = X0
  before.forEach((w) => {
    B.push({ x: xb, y: keyBase - capH(sKey) - 50, s: sBf })
    xb += textW(w.s, sBf) + sBf * 0.26
  })
  B.push({ x: CX - textW(key.s, sKey) / 2, y: keyBase, s: sKey })
  const afterW = after.reduce((a, w) => a + textW(w.s, sAf), 0) + sAf * 0.26 * Math.max(0, after.length - 1)
  xb = X1 - afterW
  after.forEach((w) => {
    B.push({ x: xb, y: keyBase + capH(sAf) + 60, s: sAf })
    xb += textW(w.s, sAf) + sAf * 0.26
  })
  const newest = ws[newestIdx(t, ws)]
  ws.forEach((w, k) => {
    const dt = since(t, w.beat)
    if (dt < 0) return
    const q = spring(since(t, tB) - k * 0.035, 26, 0.72)
    const size = lerp(A[k].s, B[k].s, q)
    const x = lerp(A[k].x, B[k].x, q)
    const y = lerp(A[k].y, B[k].y, q) + (1 - spring(dt, 46, 0.8)) * capH(size) * 0.9
    ctx.save()
    ctx.globalAlpha = clamp01(dt / 0.08)
    ctx.font = fnt(size)
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = q > 0.5 ? (w === key ? th.accent : th.fg) : w === newest ? th.accent : th.fg
    ctx.fillText(w.s, x, y)
    ctx.restore()
  })
  tag(`text → layout @ ${secs(tB)}`, X0, WIDE ? 890 : 1600, th, { dt: since(t, tB) })
  return th
}

// 14 glass focus: the whole section stays on screen, only the line being sung is sharp
const FPAD = 24
const BCACHE = new Map()
function lineBitmap(words, size, colours) {
  const key = `${words.join(' ')}|${Math.round(size)}|${colours.map((c) => c.join(':')).join(',')}`
  if (BCACHE.has(key)) return BCACHE.get(key)
  const ch = capH(size)
  ctx.font = fnt(size)
  const width = words.reduce((a, w) => a + ctx.measureText(w).width, 0) + size * 0.26 * (words.length - 1)
  const c = document.createElement('canvas')
  c.width = Math.ceil(width + FPAD * 2)
  c.height = Math.ceil(ch + size * 0.3 + FPAD * 2)
  const o = c.getContext('2d')
  o.font = fnt(size)
  o.textBaseline = 'alphabetic'
  let x = FPAD
  words.forEach((w, k) => {
    o.globalAlpha = colours[k][1]
    o.fillStyle = colours[k][0]
    o.fillText(w, x, FPAD + ch)
    x += o.measureText(w).width + size * 0.26
  })
  if (BCACHE.size > 400) BCACHE.clear()
  BCACHE.set(key, c)
  return c
}
function tplFocus(t, p, th) {
  flashBg(t, th, p.enter === 'flash' ? [p.start] : [])
  rings(t, th)
  const lines = p.context || [{ words: p.words.map((w) => w.s), beats: p.words.map((w) => w.beat) }]
  const ci = p.ctxIndex || 0
  const inner = X1 - X0 - 96
  const maxSize = WIDE ? 110 : 104
  // each line is one row, or two rows when one row would make the type too small (portrait)
  const rowsOf = (ln) => {
    const idx = ln.words.map((_, k) => k)
    if (fitSize(ln.words.join(' '), inner, maxSize) >= maxSize * 0.8 || ln.words.length < 2) return [idx]
    const total = textW(ln.words.join(' '), 100)
    let best = 1
    let bestD = Infinity
    for (let k = 1; k < ln.words.length; k++) {
      const d = Math.abs(textW(ln.words.slice(0, k).join(' '), 100) - total / 2)
      if (d < bestD) {
        bestD = d
        best = k
      }
    }
    return [idx.slice(0, best), idx.slice(best)]
  }
  const rows = lines.map(rowsOf)
  const size = Math.min(maxSize, ...lines.flatMap((ln, li) => rows[li].map((r) => fitSize(r.map((k) => ln.words[k]).join(' '), inner, maxSize))))
  const ch = capH(size)
  const rowH = ch * 1.32
  const gap = ch * 1.0
  const heights = rows.map((r) => r.length * rowH)
  const centres = []
  let acc = 0
  heights.forEach((h) => {
    centres.push(acc + h / 2)
    acc += h + gap
  })
  const q = spring(since(t, p.start), 22, 0.85)
  const prev = ci > 0 ? ci - 1 : ci
  const offset = L.cy - lerp(centres[prev], centres[ci], q)
  // glass bar fixed in the middle; the list scrolls through it
  const barH = lerp(heights[prev], heights[ci], q) + ch * 0.9
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(X0, L.cy - barH / 2, X1 - X0, barH, 26)
  ctx.globalAlpha = 0.1
  ctx.fillStyle = th.fg
  ctx.fill()
  ctx.globalAlpha = 0.65
  ctx.lineWidth = 3
  ctx.strokeStyle = th.fg
  ctx.stroke()
  ctx.globalAlpha = 1
  ctx.fillStyle = th.accent
  ctx.beginPath()
  ctx.arc(X1 - 34, L.cy, 9, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  const bt = beatAt(t)
  lines.forEach((ln, li) => {
    const top = offset + centres[li] - heights[li] / 2
    if (top > H + ch || top + heights[li] < -ch) return
    let blur = 9
    let alpha = 0.3
    if (li === ci) {
      blur = 9 * (1 - q)
      alpha = lerp(0.3, 1, q)
    } else if (li === ci - 1) {
      blur = 9 * q
      alpha = lerp(1, 0.3, q)
    }
    // per-word colours: only the sung line is coloured word by word (karaoke)
    const colours = ln.words.map((_, k) => {
      if (li !== ci) return [th.fg, 1]
      const b0 = ln.beats[k]
      const b1 = ln.ends ? ln.ends[k] : b0 + 1
      if (bt < b0) return [th.fg, 0.4]
      if (bt < Math.max(b1, b0 + 0.5)) return [th.accent, 1]
      return [th.fg, 1]
    })
    rows[li].forEach((r, ri) => {
      const yb = top + ri * rowH + (rowH + ch) / 2
      const words = r.map((k) => ln.words[k])
      const cols = r.map((k) => colours[k])
      if (blur <= 0.3) {
        ctx.save()
        ctx.font = fnt(size)
        ctx.textBaseline = 'alphabetic'
        let x = X0 + 40
        words.forEach((w, k) => {
          ctx.globalAlpha = alpha * cols[k][1]
          ctx.fillStyle = cols[k][0]
          ctx.fillText(w, x, yb)
          x += ctx.measureText(w).width + size * 0.26
        })
        ctx.restore()
      } else {
        // blur a row-sized bitmap instead of the whole canvas (much cheaper)
        const bmp = lineBitmap(words, size, cols)
        ctx.save()
        ctx.globalAlpha = alpha
        ctx.filter = `blur(${blur.toFixed(1)}px)`
        ctx.drawImage(bmp, X0 + 40 - FPAD, yb - ch - FPAD)
        ctx.restore()
      }
    })
  })
  tag(`line ${ci + 1}/${lines.length} = ${secs(p.start)}`, X0, WIDE ? 890 : 1600, th, { dt: since(t, p.start) })
  return th
}

// 16 particle logo: scattered dots fly in and assemble the key word
const PCACHE = new Map()
function particleTargets(str, size, cx, base) {
  const key = `${str}|${Math.round(size)}|${Math.round(cx)}|${Math.round(base)}`
  if (PCACHE.has(key)) return PCACHE.get(key)
  const oc = document.createElement('canvas')
  oc.width = W
  oc.height = H
  const o = oc.getContext('2d', { willReadFrequently: true })
  o.font = fnt(size)
  o.textAlign = 'center'
  o.textBaseline = 'alphabetic'
  o.fillStyle = '#000'
  o.fillText(str, cx, base)
  const data = o.getImageData(0, 0, W, H).data
  let step = Math.max(6, Math.round(size / 45))
  let pts
  do {
    pts = []
    for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) if (data[(y * W + x) * 4 + 3] > 128) pts.push([x, y])
    step++
  } while (pts.length > 1600)
  PCACHE.set(key, pts)
  return pts
}
function tplParticle(t, p, th) {
  const hero = p.words.find((w) => w.role === 'hero')
  flashBg(t, th, p.enter === 'flash' ? [p.start] : [])
  rings(t, th)
  const lead = p.words.filter((w) => w.role === 'lead')
  const tail = p.words.filter((w) => w.role === 'tail')
  const leadSize = leadLine(t, p, th, lead)
  if (!hero) return th
  const top = (lead.length ? L.top + capH(leadSize) : L.top - 60) + 60
  const bottom = tail.length ? (WIDE ? 790 : 1400) : WIDE ? 880 : 1520
  const size = Math.min(fitSize(hero.s, X1 - X0, WIDE ? 520 : 640), ((bottom - top) * 100) / capH(100))
  const ch = capH(size)
  const base = (top + bottom) / 2 + ch / 2
  const pts = particleTargets(hero.s, size, CX, base)
  const th0 = T(hero.beat)
  const solid = clamp01((t - th0 - 0.75) / 0.3)
  const cols = [th.fg, th.accent, th.sub]
  ctx.save()
  pts.forEach(([tx, ty], i) => {
    const s0 = p.idx * 7919 + i
    const sx = rand(s0) * W
    const sy = rand(s0 + 0.37) * H
    const ix = sx + Math.sin(t * 1.3 + i) * 18
    const iy = sy + Math.cos(t * 1.1 + i * 0.7) * 18
    const q = spring(t - th0 - rand(s0 + 0.71) * 0.4, 14, 0.86)
    const bend = Math.sin(Math.PI * clamp01(q)) * 60
    const x = lerp(ix, tx, q) + bend * (rand(s0 + 0.13) - 0.5)
    const y = lerp(iy, ty, q) + bend * (rand(s0 + 0.29) - 0.5)
    ctx.globalAlpha = (q > 0 ? 0.95 : 0.55) * (1 - solid * 0.9)
    ctx.fillStyle = cols[i % 3]
    const r = 3 + rand(s0 + 0.53) * 3
    ctx.fillRect(x - r / 2, y - r / 2, r, r)
  })
  ctx.restore()
  if (solid > 0) {
    ctx.save()
    ctx.globalAlpha = solid
    ctx.font = fnt(size)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = th.fg
    ctx.fillText(hero.s, CX, base)
    ctx.restore()
  }
  if (tail.length) {
    const size2 = Math.min(L.tailMax, layoutLines([tail], X1 - X0, 300, L.tailMax))
    drawLines(t, [tail], th, { size: size2, top: base + 80, newest: p.words[newestIdx(t, p.words)] })
  }
  tag(t < th0 + 0.75 ? 'assembling' : `particles = ${pts.length}`, X1, WIDE ? 890 : 1600, th, {
    dt: since(t, p.start),
    align: 'right',
  })
  return th
}

const INST_BG = ['blue', 'yellow', 'red', 'ink', 'cream']
function tplInst(t, p, th0) {
  const beat = Math.max(0, Math.min(BEATS.length - 1, Math.floor(beatAt(t) + 1e-6)))
  const pos = BARPOS[beat]
  const th = THEME[INST_BG[(BARNO[beat] + p.idx) % INST_BG.length]] || th0
  const first = beat - (pos - 1)
  flashBg(t, th, [p.start, first])
  rings(t, th)
  hop(t, p, th, WIDE
    ? { x0: X1 - 260, x1: X1 - 60, y0: L.top + 20, y1: L.top + 100, rMin: 30, rMax: 70 }
    : { y0: 1300, y1: 1450, rMin: 40, rMax: 120 })
  riseWord(p.label || 'INSTRUMENTAL', X0, WIDE ? L.top + 50 : 360, WIDE ? 64 : 72, th.fg, since(t, p.start))
  const dt = since(t, beat)
  slam(String(pos), CX, WIDE ? 520 : 980, WIDE ? 620 : 900, pos === 1 ? th.accent : th.fg, dt, { s0: 1.35, center: WIDE })
  tag(`bar ${BARNO[beat]} · beat ${pos} = ${BEATS[beat].toFixed(3)} s`, X0, WIDE ? 770 : 1360, th, { dt })
  blocks(t, [first, first + 1, first + 2, first + 3], 4, th, WIDE ? { y: 830, h: 80 } : { y: 1540, h: 110 })
  return th
}

const TPL = {
  inst: tplInst,
  mask: tplMask, // 09
  elastic: tplElastic, // 10
  relayout: tplRelayout, // 11
  focus: tplFocus, // 14
  particle: tplParticle, // 16
  stack: tplStack,
  hero: tplHero,
  giant: tplGiant,
  boxes: tplBoxes,
  two: tplTwo,
  pair: tplPair,
  count: tplCount,
  countdown: tplCountdown,
  zero: tplZero,
  title: tplTitle,
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------
function hud(t, th, p) {
  if (p.tpl === 'title') return
  if (p.s) tag(p.s, 56, 50, th, { size: 24 })
  const bt = beatAt(t)
  const beat = Math.max(0, Math.min(BEATS.length - 1, Math.floor(bt + 1e-6)))
  const inBar = BARPOS[beat] - 1
  const bar = BARNO[beat]
  for (let k = 0; k < 4; k++) {
    ctx.fillStyle = k === inBar ? th.accent : th.fg
    ctx.beginPath()
    ctx.arc(W - 214 + k * 28, 70, k === inBar ? 10 : 6, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.font = fnt(24, MONO, 700)
  ctx.fillStyle = th.fg
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.fillText(`${Math.max(1, bar)}.${inBar + 1}`, W - 54, 72)
  tag(`beat ${String(beat + 1).padStart(3, '0')} → ${BEATS[beat].toFixed(3)} s`, 56, H - 104, th, { size: 22 })
  const rem = Math.max(0, (D.countdownTo ?? 180) - t)
  tag(`T-${Math.floor(rem / 60)}:${String(Math.floor(rem % 60)).padStart(2, '0')}`, W - 56, H - 104, th, {
    size: 22,
    align: 'right',
  })
  ctx.save()
  ctx.globalAlpha = 0.5
  ctx.fillStyle = th.fg
  ctx.fillRect(0, H - 8, W * clamp01(t / D.durationSec), 8)
  ctx.restore()
}

// ---------------------------------------------------------------------------
// seek
// ---------------------------------------------------------------------------
const WIPE = 0.16
function drawPhrase(t, p) {
  return TPL[p.tpl](t, p, THEME[p.bg])
}
function seek(t) {
  const bt = beatAt(t) + 1e-6
  let si = 0
  for (let i = 0; i < PHRASES.length; i++) if (bt >= PHRASES[i].start) si = i
  const p = PHRASES[si]
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1
  const dt = since(t, p.start)
  let th
  if (p.enter === 'wipe' && si > 0 && dt >= 0 && dt < WIPE) {
    drawPhrase(t, PHRASES[si - 1])
    const q = easeOutExpo(dt / WIPE)
    const x = W * (1 - q)
    const skew = 180 * (1 - q)
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(x + skew, 0)
    ctx.lineTo(W + 20, 0)
    ctx.lineTo(W + 20, H)
    ctx.lineTo(x - skew, H)
    ctx.closePath()
    ctx.clip()
    th = drawPhrase(t, p)
    ctx.restore()
  } else {
    th = drawPhrase(t, p)
  }
  hud(t, th, p)
  ctx.restore()
}

// ---------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------
function prepare(p, idx) {
  const words = []
  p.groups.forEach((g, gi) => {
    const next = gi + 1 < p.groups.length ? p.groups[gi + 1].beat : p.end
    const n = g.words.length
    let step = 0.25
    if (p.tpl === 'giant' && n > 1) {
      step = Math.min(1, (next - g.beat) / n)
      step = Math.max(0.25, Math.floor(step * 4) / 4)
    }
    g.words.forEach((s, k) =>
      words.push({
        s,
        k,
        gi,
        beat: g.wordBeats ? g.wordBeats[k] : g.beat + k * step,
        end: g.wordEnds ? g.wordEnds[k] : (g.wordBeats ? g.wordBeats[k] : g.beat + k * step) + 1,
        role: g.role || 'line',
        br: k === 0 && !!g.br,
      }),
    )
  })
  p.words = words
  p.idx = idx
}

window.ready = (async () => {
  D = await (await fetch(params.get('data') || 'data.json')).json()
  BEATS = D.beats
  PHRASES = D.phrases
  initBars()
  PHRASES.forEach(prepare)
  RECORD = true
  for (let f = 0; f < D.totalFrames; f += 2) seek(f / D.fps)
  RECORD = false
  await Promise.all([...USED].map(([font, set]) => document.fonts.load(font, [...set].join(''))))
  await document.fonts.ready
  PCACHE.clear() // particle targets / line bitmaps made before the webfont loaded have the wrong shape
  BCACHE.clear()
  const missing = [...USED].filter(([font, set]) => !document.fonts.check(font, [...set].join('')))
  if (missing.length) console.warn('fonts not ready:', missing.map(([f]) => f))
  seek(Number(params.get('t') || 0))
  return { fonts: USED.size, missing: missing.length, totalFrames: D.totalFrames, fps: D.fps }
})()
window.seek = seek

if (!params.has('render')) {
  document.body.classList.add('preview')
  const hint = document.createElement('div')
  hint.className = 'hint'
  hint.textContent = 'click to play / pause (?data=…/data.json&audio=…/song.mp3 for other songs)'
  document.body.append(hint)
  const audio = new Audio(params.get('audio') || 'song.wav')
  const loop = () => {
    seek(audio.currentTime)
    if (!audio.paused) requestAnimationFrame(loop)
  }
  canvas.addEventListener('click', async () => {
    await window.ready
    if (audio.paused) {
      await audio.play()
      loop()
    } else audio.pause()
  })
}
