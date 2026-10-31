// ページの seek(t) を 1 フレームずつ呼んで撮影し、そのまま ffmpeg に流して音と合わせた mp4 にする。
//
//   node render.mjs                                   → 15 秒版 out/yamedoki-15s.mp4
//   node render.mjs --project lyric                   → 歌詞版 out/something-great.mp4
//   node render.mjs --project lyric --frames 0,900    → work/ に確認用の静止画だけ書き出す
//   node render.mjs --project lyric --from 1800 --to 2400   → 一部分だけ mp4 にする（確認用）
//
// Playwright と Chromium が必要（この環境ではグローバルに入っているものを使う）。
import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const ROOT = dirname(fileURLToPath(import.meta.url))
const WORK = join(ROOT, 'work')
const PROJECTS = {
  yamedoki: { page: 'index.html', map: 'beatmap.json', audio: 'audio.wav', out: 'out/yamedoki-15s.mp4' },
  lyric: { page: 'lyric/index.html', map: 'lyric/data.json', audio: 'lyric/song.wav', out: 'out/something-great.mp4' },
}
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.wav': 'audio/wav',
}

const arg = (name) => {
  const i = process.argv.indexOf(name)
  return i > 0 ? process.argv[i + 1] : null
}
const projectName = arg('--project') || 'yamedoki'
const P = PROJECTS[projectName]
if (!P) throw new Error(`unknown project ${projectName}`)
const stills = arg('--frames')?.split(',').map(Number)

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

const map = JSON.parse(await readFile(join(ROOT, P.map), 'utf8'))
const fps = map.fps
const total = map.totalFrames
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })
  page.on('console', (m) => console.log('[page]', m.text()))
  page.on('pageerror', (e) => {
    console.error('[pageerror]', e)
    process.exitCode = 1
  })
  await page.goto(`http://127.0.0.1:${port}/${P.page}?render=1`)
  const info = await page.evaluate(() => window.ready)
  console.log('ready:', JSON.stringify(info))
  if (info.missing) throw new Error('fonts not loaded')
  const clip = { x: 0, y: 0, width: 1080, height: 1920 }
  const shot = async (f) => {
    await page.evaluate((t) => window.seek(t), f / fps)
    return page.screenshot({ clip })
  }

  if (stills) {
    await mkdir(WORK, { recursive: true })
    for (const f of stills) {
      const name = join(WORK, `${projectName}_${String(f).padStart(5, '0')}.png`)
      await writeFile(name, await shot(f))
      console.log(name)
    }
  } else {
    const from = Number(arg('--from') || 0)
    const to = Math.min(total, Number(arg('--to') || total))
    const out = join(ROOT, arg('--out') || (from > 0 || to < total ? `work/${projectName}_${from}-${to}.mp4` : P.out))
    await mkdir(dirname(out), { recursive: true })
    const ff = spawn(
      'ffmpeg',
      [
        '-y', '-hide_banner', '-loglevel', 'error',
        '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', 'pipe:0',
        '-ss', String(from / fps), '-t', String((to - from) / fps), '-i', join(ROOT, P.audio),
        '-map', '0:v', '-map', '1:a',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '192k',
        '-shortest', '-movflags', '+faststart',
        out,
      ],
      { stdio: ['pipe', 'inherit', 'inherit'] },
    )
    const done = new Promise((r, j) => ff.on('close', (c) => (c === 0 ? r() : j(new Error(`ffmpeg exit ${c}`)))))
    const t0 = Date.now()
    for (let f = from; f < to; f++) {
      const buf = await shot(f)
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r))
      if ((f - from) % 300 === 0) {
        const el = (Date.now() - t0) / 1000
        console.log(`frame ${f}/${to}  ${el.toFixed(0)}s elapsed`)
      }
    }
    ff.stdin.end()
    await done
    console.log(`${to - from} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s → ${out}`)
  }
} finally {
  await browser.close()
  server.close()
}
