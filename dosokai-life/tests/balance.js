// 遊びの偏りを測る（調整用）。 node tests/balance.js [人数]
// 選び方はランダム。数値はすべて仮値なので、調整の前後を比べるために使う。
'use strict';
const { load, makePolicy, playThrough } = require('./lib');

const N = Number(process.argv[2]) || 5000;
const { DL, game } = load();
const pct = (a, b) => (b ? `${Math.round((a / b) * 1000) / 10}%` : '-');
const count = {};
const inc = (k, n = 1) => { count[k] = (count[k] || 0) + n; };

const shapes = {};
const careers35 = {};
const growthSum = Object.fromEntries(DL.STATS.map((k) => [k, 0]));
const growthSq = Object.fromEntries(DL.STATS.map((k) => [k, 0]));
let fateSum = 0;
let jobs = 0;
const stage = { first: 0, second: 0, none: 0 };
const firstByChoice = {};
const fallback = {};
let e011 = 0;
let oneLiners = 0;
let repeatsInRow = 0;
let maxSame = 0;
const sameCounts = [];

for (let i = 0; i < N; i++) {
  const r = playThrough(game, String(100000 + ((i * 7919) % 900000)), makePolicy(DL, i));
  const e = r.ending;
  const s = r.state;
  shapes[e.shape] = (shapes[e.shape] || 0) + 1;
  careers35[s.career] = (careers35[s.career] || 0) + 1;
  fateSum += e.fatePercent;
  for (const [k, g] of e.growth) { growthSum[k] += g; growthSq[k] += g * g; }
  for (const j of s.jobHistory) {
    if (j.retry) continue;
    jobs++;
    stage[j.stage]++;
    const f = (firstByChoice[j.first] = firstByChoice[j.first] || { n: 0, ok: 0 });
    f.n++;
    if (j.stage === 'first') f.ok++;
    if (j.stage === 'none') fallback[j.result] = (fallback[j.result] || 0) + 1;
  }
  if (s.log.some((x) => x.id === 'E011')) e011++;
  // 一行の出来事の重なり
  const per = {};
  const lastAge = {};
  for (const x of s.log.filter((x) => x.type === '一行')) {
    oneLiners++;
    per[x.id] = (per[x.id] || 0) + 1;
    if (lastAge[x.id] === x.age - 1) repeatsInRow++;
    lastAge[x.id] = x.age;
  }
  const m = Math.max(0, ...Object.values(per));
  maxSame = Math.max(maxSame, m);
  sameCounts.push(m);
  for (const x of s.log) inc(x.id);
}

sameCounts.sort((a, b) => a - b);
console.log(`${N}人分の人生（選び方はランダム）\n`);
console.log('■ 人生の形');
for (const [k, v] of Object.entries(shapes).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(12, '　')} ${pct(v, N)}`);
console.log('■ 数値の伸び（はじめ→最後）の平均');
console.log('  ' + DL.STATS.map((k) => `${k} ${(growthSum[k] / N).toFixed(1)}`).join(' / '));
const base = Object.fromEntries(DL.STATS.map((k) => {
  const m = growthSum[k] / N;
  return [k, { mean: Math.round(m * 10) / 10, sd: Math.round(Math.sqrt(growthSq[k] / N - m * m) * 10) / 10 }];
}));
console.log('  ばらつき（標準偏差）：' + DL.STATS.map((k) => `${k} ${base[k].sd}`).join(' / '));
console.log('  → engine.js の CONFIG.shapeBaseline の目安：' + JSON.stringify(base));
console.log('■ 就職（初回のみ）');
console.log(`  第一志望で内定 ${pct(stage.first, jobs)} / 第二志望で内定 ${pct(stage.second, jobs)} / 両方だめ ${pct(stage.none, jobs)}（両方だめのうち ${Object.entries(fallback).map(([k, v]) => `${k} ${pct(v, stage.none)}`).join('・')}）`);
console.log('  第一志望ごとの合格率：' + Object.entries(firstByChoice).map(([k, v]) => `${k} ${pct(v.ok, v.n)}`).join(' / '));
console.log(`  E011（封筒）が出た人生 ${pct(e011, N)}`);
console.log('■ 35歳のキャリア');
console.log('  ' + Object.entries(careers35).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v, N)}`).join(' / '));
console.log('■ 一行の出来事');
console.log(`  1人あたり ${(oneLiners / N).toFixed(1)} 個 / 前の年と同じ一行が続いた回数 1人あたり ${(repeatsInRow / N).toFixed(2)} 回`);
console.log(`  同じ一行が1つの人生で出た回数：中央値 ${sameCounts[Math.floor(N / 2)]} 回、最大 ${maxSame} 回`);
console.log(`■ 運命の割合の平均 ${Math.round(fateSum / N)}%`);
console.log('■ 出来事が起きた人生1人あたりの回数（多い順）');
console.log('  ' + Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k} ${(v / N).toFixed(2)}`).join(' / '));
