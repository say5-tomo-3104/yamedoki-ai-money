// SPEC 17章の確認（ブラウザで実際に操作する分）。 node tests/browser.js
// index.html を file:// で開き（サーバー不要の確認も兼ねる）、スマホ縦向きの大きさで35歳まで遊ぶ。
// 画面写真は tests/screenshots/ に保存する。
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { ROOT, load } = require('./lib');

function requirePlaywright() {
  try { return require('playwright'); } catch (e) { /* 下へ */ }
  for (const p of ['/opt/node22/lib/node_modules/playwright', '/usr/local/lib/node_modules/playwright']) {
    try { return require(p); } catch (e) { /* 次へ */ }
  }
  throw new Error('playwright が見つかりません（npm i -D playwright）');
}

// 18歳で「地元の大学を受ける」を選ぶと合格する運命の番号を探す（留学の確認は大学生でないとできない）
function findUniversitySeed() {
  const { game } = load();
  for (let i = 0; i < 1000; i++) {
    const seed = String(700000 + i);
    const s = game.newLife(seed);
    const gen = game.play(s);
    let r = gen.next();
    let answer;
    while (!r.done && s.age === 18) {
      const sc = r.value;
      answer = sc.kind === 'event' && sc.id === 'E001' ? 1 : sc.kind === 'event' && sc.choices.length ? 0 : undefined;
      r = gen.next(answer);
    }
    if (s.path === '大学' && !s.flags.has('浪人')) return seed;
  }
  throw new Error('見つからない');
}

(async () => {
  const { chromium } = requirePlaywright();
  const shots = path.join(__dirname, 'screenshots');
  fs.mkdirSync(shots, { recursive: true });
  const seed = findUniversitySeed();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });

  const url = 'file://' + path.join(ROOT, 'index.html') + `?seed=${seed}&speed=fast&debug=1`;
  await page.goto(url);
  await page.screenshot({ path: path.join(shots, '01-title.png') });
  await page.click('#start-form button[type=submit]');
  await page.click('#debug > button'); // 確認用パネルはたたんでおく

  let checkedGrey = false;
  let moneySet = false;
  let barsOk = false;
  let reunionShot = 0;
  let clicks = 0;
  const start = Date.now();
  while (!(await page.isVisible('#ending-screen'))) {
    assert.ok(Date.now() - start < 240000, '35歳までたどり着かない');
    const age = Number(await page.textContent('#hud-age').catch(() => '0'));
    if (age === 19 && !moneySet) {
      // 19歳の1月に、お金を30にして海外研修（E006）を起こす
      await page.evaluate(() => { window.__dosokai.setStat('お金', 30); window.__dosokai.force('E006'); });
      moneySet = true;
      const w = await page.evaluate(() => [...document.querySelectorAll('.bar .fill')].map((f) => f.getBoundingClientRect().width));
      barsOk = w.length === 5 && w.every((x) => x > 0);
    }
    const e006 = page.locator('.card[data-id="E006"]');
    if (!checkedGrey && (await e006.count())) {
      const first = e006.locator('button.choice').first();
      await first.waitFor();
      assert.ok(await first.isDisabled(), '3. お金30なのに留学が押せる');
      const bg = await first.evaluate((b) => getComputedStyle(b).backgroundColor);
      assert.strictEqual(bg, 'rgb(236, 235, 231)', '3. 灰色になっていない');
      await e006.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(shots, '03-e006-grey.png') });
      checkedGrey = true;
      console.log(`✔ 3. お金${await page.evaluate(() => window.__dosokai.state.stats['お金'])}で、留学の選択肢が灰色（背景 ${bg}）で押せない`);
    }
    if ((await page.isVisible('#reunion-screen')) && (await page.locator('#reunion-screen .roster').count()) && reunionShot < age) {
      await page.waitForTimeout(400);
      assert.ok(!(await page.innerText('#reunion-screen')).includes('[object'), '名簿の表示が壊れている');
      await page.screenshot({ path: path.join(shots, `04-reunion-${age}.png`), fullPage: true });
      reunionShot = age;
    }
    // 押せるボタンがあれば押す（選択肢は押せるものの最初）
    const btn = page.locator('#feed button.choice:enabled, #feed button.next, #reunion-screen button.next').first();
    if (await btn.count() && await btn.isVisible()) {
      if (clicks === 2) await page.screenshot({ path: path.join(shots, '02-event.png') });
      await btn.click();
      clicks++;
    } else {
      await page.waitForTimeout(120);
    }
  }
  assert.ok(checkedGrey, '3. 留学の場面が出てこなかった');

  // 6. エンディングの8項目
  const titles = [];
  for (let i = 1; i <= 8; i++) {
    const sec = page.locator(`.end-sec[data-section="${i}"]`);
    assert.strictEqual(await sec.count(), 1, `6. 項目${i}がない`);
    assert.ok(await sec.isVisible());
    const text = (await sec.innerText()).trim();
    assert.ok(text.length > 10, `6. 項目${i}が空`);
    titles.push(text.split('\n')[0].replace(/^\d\s*/, ''));
  }
  assert.strictEqual(await page.locator('.end-sec[data-section="1"] .timeline li').count(), 18);
  assert.ok(!(await page.innerText('#ending-screen')).includes('[object'), 'エンディングの表示が壊れている');
  assert.ok(!(await page.innerText('#feed')).includes('[object'), '出来事の表示が壊れている');
  assert.ok(barsOk, '数値のバーが表示されていない');
  assert.strictEqual(await page.locator('.end-sec[data-section="2"] svg path').count(), 5);
  const seedShown = (await page.textContent('.seed-number')).trim();
  assert.strictEqual(seedShown, seed, '7. 運命の番号が違う');
  const share = await page.inputValue('.share-text');
  assert.match(share, /^私の人生の形は『.+人生』。運命の割合は\d+％でした。#同窓会ライフ$/);
  await page.screenshot({ path: path.join(shots, '05-ending.png'), fullPage: true });
  // グラフをなぞると値が出る
  const svg = page.locator('.chart-wrap svg');
  await svg.scrollIntoViewIfNeeded();
  const box = await svg.boundingBox();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  assert.ok(await page.isVisible('.chart-tip'), 'グラフの値が出ない');
  await page.screenshot({ path: path.join(shots, '06-chart-hover.png') });
  console.log(`✔ 6. 35歳まで進めて、エンディングの8項目がすべて表示された：${titles.join('／')}`);
  console.log(`  運命の番号 ${seedShown}　シェア文「${share}」`);

  // 表の読み取りの注意も、エラーも出ていない
  assert.ok(await page.isHidden('#warnings'), '表の読み取りの注意が出ている');
  assert.deepStrictEqual(errors, [], 'ブラウザでエラー：' + errors.join('\n'));
  console.log(`✔ ブラウザのエラー・表の読み取りの注意は0件（ボタンを${clicks}回押して35歳まで）`);
  console.log(`  画面写真：${shots}`);
  await browser.close();
})().catch((err) => {
  console.error('✘ ' + err.stack);
  process.exit(1);
});
