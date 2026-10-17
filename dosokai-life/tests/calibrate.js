// ゲームの結果を、イベント表の「統計」シートの現実の値と比べる。 node tests/calibrate.js [人数]
// 選び方は「ふつうの選び方」：押せる選択肢のうち、いちばん上を6割、ほかを4割で選ぶ（表ではよくある選択を上に書く）。
'use strict';
const { load, playThrough } = require('./lib');

const N = Number(process.argv[2]) || 3000;
const { DL, compiled, game } = load();

function typicalPolicy(seed) {
  const rng = DL.makeRng('typical', String(seed));
  return (scene) => {
    if (scene.kind === 'event' && scene.choices.length) {
      const ok = scene.choices.map((c, i) => (c.enabled ? i : -1)).filter((i) => i >= 0);
      if (rng.chance(0.6) || ok.length === 1) return ok[0];
      return ok[1 + rng.int(ok.length - 1)];
    }
    if (scene.kind === 'pick') {
      const ok = scene.options.filter((o) => o.enabled).map((o) => o.name);
      const a = ok.splice(rng.int(ok.length), 1)[0];
      return [a, ok[rng.int(ok.length)]];
    }
    return undefined;
  };
}

// 「平均:名前」で測れるもの
const MEANS = {
  初婚年齢: (s) => s.firstMarriageAge,
  第1子の年齢: (s) => (s.children.length ? s.children[0].born : undefined),
};

// くじの「一生で」の文字（約5％、約2,500人に1人）を割合にする。条件つき（「（子がいる人）」など）は比べない
function lifetimeShare(str) {
  const t = String(str || '').replace(/,/g, '');
  if (/（/.test(t)) return null;
  let m;
  if ((m = t.match(/約([\d.]+)％/))) return Number(m[1]) / 100;
  if ((m = t.match(/約([\d.]+)割/))) return Number(m[1]) / 10;
  if ((m = t.match(/約([\d.]+)(万)?人に1人/))) return 1 / (Number(m[1]) * (m[2] ? 10000 : 1));
  return null;
}
const rareSeen = {};

function run(n) {
  const acc = compiled.stats.map(() => ({ hit: 0, total: 0, sum: 0 }));
  for (let i = 0; i < n; i++) {
    const seen = new Set();
    const measure = (s, k, t) => {
      const m = t.metric;
      if (m.pop && !m.pop(s)) return;
      acc[k].total++;
      if (m.cond(s)) acc[k].hit++;
      seen.add(k);
    };
    const r = playThrough(game, String(100000 + ((i * 7919) % 900000)), typicalPolicy(i), {}, {
      onYearEnd(s) {
        compiled.stats.forEach((t, k) => {
          if (t.metric && t.metric.kind === 'share' && t.metric.age === s.age && !s.dead) measure(s, k, t);
        });
      },
    });
    const s = r.state;
    for (const id of new Set(s.rareHits.map((h) => h.id))) rareSeen[id] = (rareSeen[id] || 0) + 1;
    compiled.stats.forEach((t, k) => {
      const m = t.metric;
      if (!m) return;
      if (m.kind === 'mean') {
        const v = MEANS[m.name] ? MEANS[m.name](s) : undefined;
        if (v !== undefined) { acc[k].total++; acc[k].sum += v; }
      } else if (s.dead && m.all && !seen.has(k) && m.age >= s.deathAge) {
        measure(s, k, t); // 亡くなった人は、亡くなったときの状態で数える
      }
    });
  }
  return acc;
}

const acc = run(N);
const rows = compiled.stats.map((t, k) => {
  const a = acc[k];
  const isMean = t.metric && t.metric.kind === 'mean';
  const v = a.total ? (isMean ? a.sum / a.total : a.hit / a.total) : NaN;
  const ok = v >= t.low && v <= t.high;
  const fmt = (x) => (isMean ? x.toFixed(1) : `${(x * 100).toFixed(1)}%`);
  return { ok, line: `${ok ? '✔' : '✘'} ${t.name}\n    ゲーム ${Number.isNaN(v) ? '—' : fmt(v)}（${a.total}人）／ 現実 ${fmt(t.real)}（幅 ${fmt(t.low)}〜${fmt(t.high)}）` };
});
console.log(`${N}人分の人生（ふつうの選び方）を、統計シートの値と比べました\n`);
for (const r of rows) console.log(r.line);
const bad = rows.filter((r) => !r.ok).length;
console.log(`\n${rows.length - bad} / ${rows.length} 件が幅に入りました`);

// 人生のくじ：一覧の「一生で」と比べる（この人数で数件以上出るはずのものだけ。くじは一生のうち何度か起きうるものもあるので目安）
console.log('\n人生のくじ（一生で0.3％以上のもの。0.5〜2倍なら ✔）');
let rOk = 0;
let rAll = 0;
for (const ev of compiled.rare) {
  const want = lifetimeShare(ev.lifetime);
  if (want == null || want < 0.003) continue;
  const got = (rareSeen[ev.id] || 0) / N;
  const ok = got >= want * 0.5 && got <= want * 2;
  rAll++;
  if (ok) rOk++;
  console.log(`${ok ? '✔' : '△'} ${ev.id} ${ev.title}：ゲーム ${(got * 100).toFixed(2)}％ ／ 一覧 ${(want * 100).toFixed(2)}％`);
}
console.log(`${rOk} / ${rAll} 種類が目安の範囲`);
if (compiled.warnings.length) console.log('\n表の読み取りの注意：\n' + compiled.warnings.join('\n'));
process.exitCode = bad ? 1 : 0;
