// index.html の seek(t) を 1 フレームずつ呼んで PNG に撮り、ffmpeg で audio.wav と合わせて mp4 にする。
//
//   node render.mjs                 → out/yamedoki-15s.mp4
//   node render.mjs --frames 0,60   → work/still_0000.png などを書き出すだけ（確認用）
//
// Playwright と Chromium が必要（この環境ではグローバルに入っているものを使う）。
import { createServer } from 'node:http'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const ROOT = dirname(fileURLToPath(import.meta.url))
const WORK = join(ROOT, 'work')
const OUT = join(ROOT, 'out', 'yamedoki-15s.mp4')
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.wav': 'audio/wav',
}

const argFrames = (() => {
  const i = process.argv.indexOf('--frames')
  return i > 0 ? process.argv[i + 1].split(',').map(Number) : null
})()

// tiny static server (webfonts are not allowed from file:// in Chromium)
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://local').pathname)
  const file = resolve(ROOT, '.' + path)
  if (file !== ROOT && !file.startsWith(ROOT + sep)) {
    res.writeHead(403)
    return res.end()
  }
  try {
    const body = await readFile(file)
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404)
    res.end()
  }
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const { port } = server.address()

const bm = JSON.parse(await readFile(join(ROOT, 'beatmap.json'), 'utf8'))
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })
  page.on('console', (m) => console.log('[page]', m.text()))
  page.on('pageerror', (e) => {
    console.error('[pageerror]', e)
    process.exitCode = 1
  })
  await page.goto(`http://127.0.0.1:${port}/index.html?render=1`)
  const info = await page.evaluate(() => window.ready)
  console.log(`fonts: ${info.strings} strings, missing ${info.missing}`)
  if (info.missing) throw new Error('fonts not loaded')

  const clip = { x: 0, y: 0, width: 1080, height: 1920 }
  if (argFrames) {
    await mkdir(WORK, { recursive: true })
    for (const f of argFrames) {
      await page.evaluate((t) => window.seek(t), f / bm.fps)
      const name = join(WORK, `still_${String(f).padStart(4, '0')}.png`)
      await writeFile(name, await page.screenshot({ clip }))
      console.log(name)
    }
  } else {
    const dir = join(WORK, 'frames')
    await rm(dir, { recursive: true, force: true })
    await mkdir(dir, { recursive: true })
    const t0 = Date.now()
    for (let f = 0; f < bm.totalFrames; f++) {
      await page.evaluate((t) => window.seek(t), f / bm.fps)
      await writeFile(join(dir, `f_${String(f).padStart(4, '0')}.png`), await page.screenshot({ clip }))
      if (f % 50 === 0) console.log(`frame ${f}/${bm.totalFrames}`)
    }
    console.log(`captured ${bm.totalFrames} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
    await mkdir(dirname(OUT), { recursive: true })
    const r = spawnSync(
      'ffmpeg',
      [
        '-y', '-hide_banner', '-loglevel', 'error',
        '-framerate', String(bm.fps),
        '-i', join(dir, 'f_%04d.png'),
        '-i', join(ROOT, 'audio.wav'),
        '-map', '0:v', '-map', '1:a',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '192k',
        '-t', String(bm.durationSec),
        '-movflags', '+faststart',
        OUT,
      ],
      { stdio: 'inherit' },
    )
    if (r.status !== 0) throw new Error('ffmpeg failed')
    console.log(OUT)
  }
} finally {
  await browser.close()
  server.close()
}
