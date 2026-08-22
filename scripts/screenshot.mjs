/**
 * スクリーンショット自己レビュー用スクリプト
 *
 * 3つのビューポート（PC / タブレット / スマホ）でページを撮影し、
 * screenshots/ に PNG として保存します。
 * 撮った画像を Claude Code に見せて、余白・文字サイズ・崩れを確認させるために使います。
 *
 * 使い方:
 *   npm run dev                                   # 別ターミナルでローカルサーバーを起動
 *   node scripts/screenshot.mjs                   # http://localhost:5173 を撮影
 *   node scripts/screenshot.mjs <URL>             # 指定した URL を撮影（公開中のブログでも可）
 *   node scripts/screenshot.mjs <URL> <ラベル>    # ファイル名に接頭辞を付けて撮影
 *
 * 注意:
 *   アニメーションのある要素は静止画では正しく評価できません。
 *   動きを含むページの判断にはこのスクリプトを使わないでください。
 */

import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import puppeteer from 'puppeteer'

// 撮影するビューポート（CLAUDE.md のルールと揃えること）
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900,  deviceScaleFactor: 1 },
  { name: 'tablet',  width: 768,  height: 1024, deviceScaleFactor: 2 },
  { name: 'mobile',  width: 390,  height: 844,  deviceScaleFactor: 3 },
]

const url = process.argv[2] || 'http://localhost:5173'
const label = process.argv[3] || ''
const outDir = path.resolve('screenshots')

// 遅延読み込みの画像を確実に表示させるため、一番下までゆっくりスクロールする
async function scrollToBottom(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let total = 0
      const step = 300
      const timer = setInterval(() => {
        window.scrollBy(0, step)
        total += step
        if (total >= document.body.scrollHeight) {
          clearInterval(timer)
          window.scrollTo(0, 0)
          resolve()
        }
      }, 60)
    })
  })
}

async function main() {
  await mkdir(outDir, { recursive: true })

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    // 環境によっては Chromium のパス指定が必要（不要なら PUPPETEER_EXECUTABLE_PATH を設定しない）
    ...(process.env.PUPPETEER_EXECUTABLE_PATH
      ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH }
      : {}),
  })

  console.log(`撮影対象: ${url}`)

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage()
    await page.setViewport(vp)

    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 })
    } catch (error) {
      console.error(`  ✗ ${vp.name}: ページを開けませんでした (${error.message})`)
      await page.close()
      continue
    }

    await scrollToBottom(page)

    const fileName = `${label ? `${label}-` : ''}${vp.name}.png`
    const filePath = path.join(outDir, fileName)

    // ページ全体を撮る（ファーストビューだけでは余白の問題を見落とすため）
    await page.screenshot({ path: filePath, fullPage: true })
    console.log(`  ✓ ${vp.name} (${vp.width}×${vp.height}) → screenshots/${fileName}`)

    await page.close()
  }

  await browser.close()
  console.log('\n撮影完了。screenshots/ の画像を確認して、余白・文字サイズ・崩れをレビューしてください。')
}

main().catch((error) => {
  console.error('撮影に失敗しました:', error)
  process.exitCode = 1
})
