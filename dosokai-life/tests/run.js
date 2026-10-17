// SPEC 17章の確認（ブラウザを使わない分）。 node tests/run.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { ROOT, load, makePolicy, playThrough } = require('./lib');

const results = [];
function check(name, fn) {
  try {
    const detail = fn();
    results.push({ name, ok: true });
    console.log(`✔ ${name}${detail ? '\n' + detail : ''}`);
  } catch (err) {
    results.push({ name, ok: false });
    console.log(`✘ ${name}\n  ${err.stack}`);
  }
}

const { DL, compiled, game } = load();

check('0. イベント表の書式がすべて読める', () => {
  assert.strictEqual(compiled.warnings.length, 0, compiled.warnings.join('\n'));
  return `  イベント ${compiled.events.length} 件 / 同窓会 ${compiled.reunion.length} 件`;
});

check('1. 同じ運命の番号・同じ選択なら、同じ人生になる', () => {
  const pick = (r) => JSON.stringify({ t: r.ending.timeline, s: r.ending.series, h: r.ending.hidden, f: r.ending.finalStats });
  for (let i = 0; i < 30; i++) {
    const seed = String(200000 + i * 7919);
    const a = playThrough(game, seed, makePolicy(DL, i));
    const b = playThrough(game, seed, makePolicy(DL, i));
    assert.strictEqual(pick(a), pick(b), `番号 ${seed} で人生が食い違った`);
  }
  // 選択を変えても、最初から決まっていたこと（生まれ・体質・出会い運・景気・同級生）は変わらない
  const seed = '314159';
  const ra = playThrough(game, seed, makePolicy(DL, 1));
  const rb = playThrough(game, seed, makePolicy(DL, 2));
  const a = ra.ending.hidden;
  const b = rb.ending.hidden;
  for (const k of ['birth', 'body', 'love', 'disaster', 'classmates']) assert.deepStrictEqual(a[k], b[k], k);
  // 景気の並び・同級生の寿命・祖父母の寿命は、最初に全部決まっている（振り返りの景気は生きた年までに切るので、元の並びで比べる）
  assert.deepStrictEqual(ra.state.economy, rb.state.economy, '景気');
  assert.deepStrictEqual(ra.state.hidden.classmateDeath, rb.state.hidden.classmateDeath, '同級生の寿命');
  assert.deepStrictEqual(ra.state.hidden.grandparentDeaths, rb.state.hidden.grandparentDeaths, '祖父母の寿命');
  return '  30通りの番号 × 2回ずつ、年表・数値・隠れた運命がすべて一致。選択を変えても隠れた運命（景気・同級生と祖父母の寿命など）は同じ';
});

check('2. 運命の番号を変えて10回遊ぶと、景気・会社の運命・同級生のパターンがばらける', () => {
  const seeds = ['104729', '271828', '332211', '458901', '500021', '613377', '700003', '812345', '901234', '999331'];
  const rows = seeds.map((seed, i) => {
    const e = playThrough(game, seed, makePolicy(DL, i)).ending;
    return {
      seed,
      economy: e.hidden.economy.map((x) => ({ 好況: '好', ふつう: '普', 不況: '不', 大不況: '大' }[x])).join(''),
      company: e.hidden.companies.map((c) => `${c.career}:${c.fortune}`).join(' → ') || '（なし）',
      classmates: e.hidden.classmates.map((c) => c.name + c.key).join(' '),
    };
  });
  const distinct = (k) => new Set(rows.map((r) => r[k])).size;
  assert.ok(distinct('economy') >= 8, '景気の並びがばらけていない');
  assert.ok(distinct('company') >= 4, '会社の運命がばらけていない');
  assert.ok(distinct('classmates') >= 4, '同級生のパターンがばらけていない');
  for (const name of ['健太', '美咲', '拓海']) {
    const keys = new Set(rows.map((r) => r.classmates.split(' ').find((x) => x.startsWith(name))));
    assert.ok(keys.size >= 2, `${name}のパターンが1通りしか出ない`);
  }
  return rows.map((r) => `  ${r.seed}  景気 ${r.economy}  同級生 ${r.classmates}  会社 ${r.company}`).join('\n')
    + `\n  景気 ${distinct('economy')}通り / 会社の運命 ${distinct('company')}通り / 同級生 ${distinct('classmates')}通り（10回中）`;
});

check('3. お金が少ないと、留学（海外研修）の選択肢が灰色になる', () => {
  let tried = 0;
  for (let i = 0; tried < 20 && i < 500; i++) {
    let scene = null;
    let set = false;
    const policy = (sc, s) => {
      if (sc.kind === 'event' && sc.id === 'E001') return 1; // 地元の大学を受ける
      if (sc.kind === 'year' && sc.age === 19 && s.path === '大学' && !set) {
        s.stats['お金'] = 30;
        s.forceQueue.push('E006');
        set = true;
      }
      if (sc.kind === 'event' && sc.id === 'E006' && set && sc.entry.age === 19) scene = sc; // お金を30にした年だけ見る
      return makePolicy(DL, 0)(sc);
    };
    playThrough(game, String(300000 + i), policy);
    if (!scene) continue;
    tried++;
    assert.strictEqual(scene.choices[0].enabled, false, 'お金30なのに留学が選べる');
    assert.ok(scene.choices[1].enabled && scene.choices[2].enabled);
  }
  assert.ok(tried >= 20);
  // お金が40以上なら選べる
  const s = game.newLife('123123');
  s.age = 19; s.path = '大学'; s.stats['お金'] = 40;
  const e006 = compiled.events.find((e) => e.id === 'E006');
  assert.strictEqual(e006.choices[0].condFn(s), true);
  s.stats['お金'] = 39;
  assert.strictEqual(e006.choices[0].condFn(s), false);
  return `  お金30で E006 を起こした ${tried} 回すべてで、選択肢1が灰色（お金40なら選べる、39なら灰色）`;
});

check('4. 健康が15未満になると、その年に E090「倒れる」が必ず起きる', () => {
  let n = 0;
  for (let i = 0; i < 300; i++) {
    const age = 18 + (i % 18);
    const r = playThrough(game, String(400000 + i), makePolicy(DL, i), {
      onScene(sc, s) { if (sc.kind === 'year' && sc.age === age) s.stats['健康'] = 10; },
    });
    if (r.state.dead && r.state.deathAge <= age) continue; // その年までに亡くなった人生は数えない
    assert.ok(r.state.log.some((e) => e.id === 'E090' && e.age === age), `番号 ${400000 + i}、${age}歳で E090 が起きなかった`);
    n++;
  }
  // 余白の側（E091）も同じ
  for (let i = 0; i < 100; i++) {
    const age = 18 + (i % 18);
    const r = playThrough(game, String(450000 + i), makePolicy(DL, i), {
      onScene(sc, s) { if (sc.kind === 'year' && sc.age === age) s.stats['余白'] = 10; },
    });
    if (r.state.dead && r.state.deathAge <= age) continue;
    assert.ok(r.state.log.some((e) => e.id === 'E091' && e.age === age), `${age}歳で E091 が起きなかった`);
  }
  return `  18〜35歳のいろいろな年に健康を10にした ${n} 回すべてで E090 が起きた（余白10 → E091 も100回すべて）`;
});

check('5. イベント表に1行足して変換し直すだけで、ゲームに出てくる', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dosokai-'));
  const xlsx = path.join(tmp, 'events.xlsx');
  const js = path.join(tmp, 'events.js');
  fs.copyFileSync(path.join(ROOT, 'data', 'events.xlsx'), xlsx);
  const add = `
import sys, openpyxl
p = sys.argv[1]
wb = openpyxl.load_workbook(p)
ws = wb['イベント']
head = [c.value for c in ws[1]]
def add(values):
    r = ws.max_row + 1
    for k, v in values.items():
        ws.cell(r, head.index(k) + 1, v)
add({'ID': 'E990', '種類': '一行', '年齢(から)': 23, '年齢(まで)': 35, '条件': '!キャリア=学生', '確率': 1, '一度だけ': '○',
     'タイトル': 'テスト用の一行', '本文': '市民課の窓口に、小学生が一人で住民票を取りに来た。', '効果(選択肢なし)': 'つながり+2 余白+1'})
add({'ID': 'E991', '種類': '一行', '年齢(から)': 18, '年齢(まで)': 35, '条件': 'お金>==40', '確率': 1,
     'タイトル': '書き間違いの行', '本文': 'この行は条件が読めないので起きない', '効果(選択肢なし)': 'お金+1'})
wb.save(p)
`;
  execFileSync('python3', ['-I', '-c', add, xlsx]);
  execFileSync('python3', [path.join(ROOT, 'tools', 'convert.py'), xlsx, js]);
  const t = load(js);
  const r = playThrough(t.game, '555555', makePolicy(t.DL, 5));
  const hit = r.state.log.find((e) => e.id === 'E990');
  assert.ok(hit, '足した E990 がゲームに出てこない');
  assert.ok(t.compiled.warnings.some((w) => w.startsWith('E991 の条件が読めません')), '読めない行の注意が出ない');
  assert.ok(!r.state.log.some((e) => e.id === 'E991'));
  assert.ok(!load().compiled.events.some((e) => e.id === 'E990'), '元の表は変わっていないはず');
  fs.rmSync(tmp, { recursive: true, force: true });
  return `  足した E990 が ${hit.age}歳に起きた。書き間違いの E991 は止まらずに「${t.compiled.warnings[0]}」と出た`;
});

check('6. 最後まで進めると、エンディングの項目がすべてそろう（v0.2：65歳まで、または亡くなった年まで）', () => {
  let died = 0;
  for (let i = 0; i < 300; i++) {
    const r = playThrough(game, String(600000 + i), makePolicy(DL, i));
    const e = r.ending;
    const years = e.deathAge ? e.deathAge - 17 : 48;
    if (e.deathAge) died++;
    assert.strictEqual(e.timeline.length, years); // 1. 年表
    assert.strictEqual(e.series.length, years + 1); // 2. 数値の移り変わり（はじめ＋年数）
    assert.ok(e.top5.length <= 5); // 3. TOP5
    assert.strictEqual(e.hidden.economy.length, years); // 4. 最初から決まっていたこと
    assert.ok(e.hidden.body && e.hidden.love && e.hidden.disaster && e.hidden.classmates.length === 3);
    assert.ok(e.chosen >= 1 && e.fatePercent >= 0 && e.fatePercent <= 100); // 5.
    assert.ok(e.shape.endsWith('人生')); // 6.
    assert.match(e.seed, /^\d{6}$/); // 7.
    assert.ok(e.share.includes(e.shape) && e.share.includes('#同窓会ライフ')); // 8.
    assert.ok(Array.isArray(e.rareHits)); // 9. 人生のくじ
    for (const v of Object.values(e.finalStats)) assert.ok(v >= 0 && v <= 100);
    // 最後は必ず65歳の同窓会（亡くなった人生でも、同級生たちの同窓会がある）
    const reunions = r.scenes.filter((x) => x.kind === 'reunion').map((x) => x.age);
    assert.strictEqual(reunions[reunions.length - 1], 65);
    if (e.deathAge) assert.ok(r.scenes.some((x) => x.kind === 'passing') && r.scenes.find((x) => x.kind === 'reunion' && x.age === 65).memorial);
  }
  return `  300通りの人生（うち${died}人は65歳より前に亡くなった）で、9項目すべてがそろい、最後は65歳の同窓会になった`;
});

check('おまけ. 2000通りの人生を最後まで通しても止まらない', () => {
  const shapes = {};
  let fate = 0;
  for (let i = 0; i < 2000; i++) {
    const e = playThrough(game, String(100000 + i * 37), makePolicy(DL, i)).ending;
    shapes[e.shape] = (shapes[e.shape] || 0) + 1;
    fate += e.fatePercent;
  }
  return `  人生の形の出方：${Object.entries(shapes).map(([k, v]) => `${k} ${v}`).join(' / ')}\n  運命の割合の平均：${Math.round(fate / 2000)}％`;
});

const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length} / ${results.length} 件 OK`);
process.exit(bad.length ? 1 : 0);
