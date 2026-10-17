// ゲームの中身（画面とは切り離してある）。
// play() はジェネレーターで、場面（scene）を1つずつ返す。選択が必要な場面では、
// 画面側が gen.next(答え) で答えを渡す。テストでは同じ仕組みで自動で最後まで進める。
(function (DL) {
  'use strict';

  // SPEC の数値（すべて仮値）。調整するときはここを変える
  const CONFIG = {
    startStat: 50,
    birth: {
      place: [['都市', 0.4], ['地方', 0.6]],
      wealth: [['ゆとり', 0.25], ['ふつう', 0.5], ['きびしい', 0.25]],
      parent: [['若い', 0.3], ['ふつう', 0.5], ['高め', 0.2]],
    },
    birthEffects: { 都市: '手応え+5', 地方: 'つながり+5', ゆとり: 'お金+15 余白+5', きびしい: 'お金-15' },
    hidden: {
      body: [['丈夫', 0.3], ['ふつう', 0.55], ['弱い', 0.15]],
      love: [['高', 0.25], ['中', 0.5], ['低', 0.25]],
    },
    economyFirst: [['好況', 0.25], ['ふつう', 0.5], ['不況', 0.25]],
    economyNext: {
      好況: [['好況', 0.6], ['ふつう', 0.35], ['不況', 0.05]],
      ふつう: [['好況', 0.2], ['ふつう', 0.6], ['不況', 0.2]],
      不況: [['好況', 0.05], ['ふつう', 0.4], ['不況', 0.55]],
      大不況: [['ふつう', 0.4], ['不況', 0.6]],
    },
    crashChance: 0.04, // 大不況が割り込む確率（1〜2年続く）
    exam: { 県外: 0.65, 地元: 0.85, retryBonus: 0.1 },
    skillFactor: 0.004, // （手応え − 50）× 0.004
    job: {
      base: { 商社: 0.25, メーカー: 0.6, 市役所: 0.5 }, // v0.1 の 0.15 / 0.45 / 0.35 から上げた
      mult: {
        商社: { 好況: 1.3, ふつう: 1.0, 不況: 0.6, 大不況: 0.4 },
        メーカー: { 好況: 1.3, ふつう: 1.0, 不況: 0.6, 大不況: 0.4 },
        市役所: { 好況: 1.2, ふつう: 1.0, 不況: 0.8, 大不況: 0.7 },
      },
      min: 0.03,
      max: 0.9,
      secondFactor: 0.8,
      irregular: 0.4, // 両方落ちたとき非正規になる割合
      irregularBad: 0.6, // 不況・大不況の年
    },
    change: {
      '転職判定': { p: 0.4, econ: true, success: 'お金+5 手応え+3', fail: '余白-4', redraw: true },
      '転職判定(拓海)': { p: 0.7, success: 'お金+8 手応え+5', fail: '', redraw: true },
      '転職判定(登用)': { p: 0.3, success: 'キャリア:地元企業 お金+5 余白+3', fail: '', redraw: false },
    },
    reunionAges: [25, 35],
    firstAge: 18,
    lastAge: 35,
    agingFrom: 30,
    maxOneLiners: 2,
    oneLinerCooldown: 3, // 同じ一行の出来事は、出てから3年は出さない
    // 人生の形の判定に使う「ふつうの人生」の伸び（はじめ→35歳）の平均と散らばり。
    // 表や確率を変えたら node tests/balance.js で測り直して、ここを書き換える
    shapeBaseline: {
      お金: { mean: 8.9, sd: 20.4 },
      健康: { mean: -7, sd: 6.7 },
      手応え: { mean: 24.3, sd: 11.5 },
      つながり: { mean: 25.6, sd: 17.9 },
      余白: { mean: -5.3, sd: 10.8 },
    },
  };

  const BIG = ['選択', '運命'];
  const SHAPES = {
    お金: '積み上げた人生',
    手応え: '遠くまで行った人生',
    つながり: '根を張った人生',
    余白: '自分の時間を守った人生',
    健康: 'しなやかに生きた人生',
  };

  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

  function createGame(C) {
    // 設定の中の効果（転職の成功など）も、イベント表と同じ読み方をする
    const effectCache = {};
    const fx = (src) => (effectCache[src] = effectCache[src] || C.compileEffect(src, '設定', '効果'));

    // ---- 人生の始まり：生まれ・隠れた運命・景気・同級生を最初に全部決める ----
    function newLife(seed) {
      seed = String(seed);
      const fate = DL.makeRng(seed, 'fate');
      const birth = {
        place: fate.weighted(CONFIG.birth.place),
        wealth: fate.weighted(CONFIG.birth.wealth),
        parent: fate.weighted(CONFIG.birth.parent),
      };
      const hidden = {
        body: fate.weighted(CONFIG.hidden.body),
        love: fate.weighted(CONFIG.hidden.love),
        classmates: {},
      };
      const economy = makeEconomy(fate);
      for (const c of C.classmates) hidden.classmates[c.name] = fate.weighted(c.patterns.map((p) => [p.key, p.prob]));

      const stats = {};
      for (const k of DL.STATS) stats[k] = CONFIG.startStat;
      const s = {
        seed, age: CONFIG.firstAge, stats, flags: new Set(), career: '学生', path: '',
        birth, hidden, economy, company: null, companyHistory: [],
        jobHuntAge: null, pending: [], used: {}, firedThisYear: new Set(), jobHistory: [], lastSeen: {},
        log: [], years: [], forceQueue: [],
        companyRng: DL.makeRng(seed, 'company'),
      };
      for (const v of [birth.place, birth.wealth]) {
        for (const op of fx(CONFIG.birthEffects[v] || '')) if (op.op === 'stat') s.stats[op.stat] = clamp(s.stats[op.stat] + op.delta, 0, 100);
      }
      s.startStats = { ...s.stats };
      return s;
    }

    function makeEconomy(rng) {
      const out = [];
      let crashLeft = 0;
      for (let age = CONFIG.firstAge; age <= CONFIG.lastAge; age++) {
        let e;
        if (crashLeft > 0) {
          e = '大不況';
          crashLeft--;
        } else if (rng.chance(CONFIG.crashChance)) {
          e = '大不況';
          crashLeft = rng.chance(0.5) ? 1 : 0; // 1〜2年続く
        } else {
          e = out.length ? rng.weighted(CONFIG.economyNext[out[out.length - 1]]) : rng.weighted(CONFIG.economyFirst);
        }
        out.push(e);
      }
      return out;
    }

    const econ = (s) => s.economy[s.age - CONFIG.firstAge];
    const skill = (s) => (s.stats['手応え'] - 50) * CONFIG.skillFactor;

    // ---- 数値・フラグ・キャリアの変更 ----
    function applyStat(s, stat, delta, entry) {
      if (stat === '健康' && delta < 0 && s.hidden.body === '丈夫') delta = -Math.floor(-delta / 2) || 0; // 減り方が半分
      const before = s.stats[stat];
      s.stats[stat] = clamp(before + delta, 0, 100);
      const applied = s.stats[stat] - before;
      if (entry && applied) entry.deltas[stat] = (entry.deltas[stat] || 0) + applied;
    }

    function drawCompany(s) {
      const career = C.careers[s.career];
      const fortunes = career ? career.fortunes : [];
      if (s.career === '学生') { s.company = null; return; }
      const fortune = fortunes.length ? s.companyRng.weighted(fortunes) : 'なし';
      s.company = { career: s.career, fortune, age: s.age };
      const last = s.companyHistory[s.companyHistory.length - 1];
      if (last && last.age === s.age && last.career === s.career) s.companyHistory.pop(); // 同じ年の引き直しは1つにまとめる
      s.companyHistory.push(s.company);
    }

    function setCareer(s, name) {
      if (name === s.career) return;
      s.career = name;
      drawCompany(s);
    }

    function setPath(s, name) {
      s.path = name;
      if (name === '大学' && s.jobHuntAge == null) {
        s.jobHuntAge = Math.min(s.age + 3 + (s.flags.has('休学') ? 1 : 0), 22);
      }
    }

    function* applyOps(s, ops, entry) {
      for (const op of ops) {
        if (op.op === 'stat') applyStat(s, op.stat, op.delta, entry);
        else if (op.op === 'flag') {
          s.flags.add(op.name);
          // 休学したら、就職活動は1年遅れる（SPEC 7章。22歳まで）
          if (op.name === '休学' && s.jobHuntAge != null && s.jobHuntAge >= s.age && !s.flags.has('就職済')) {
            s.jobHuntAge = Math.min(s.jobHuntAge + 1, 22);
          }
        } else if (op.op === 'unflag') s.flags.delete(op.name);
        else if (op.op === 'career') setCareer(s, op.name);
        else if (op.op === 'path') setPath(s, op.name);
        else if (op.op === 'process') yield* PROCESS[op.name](s, entry);
      }
    }

    // ---- 特別な処理（SPEC 14章） ----
    function* envelope(s, entry, title, result, good) {
      entry.notes.push(`${title}：${result}`);
      yield { kind: 'envelope', title, result, good };
    }

    function* exam(s, entry, retry) {
      const base = s.flags.has('県外志望') ? CONFIG.exam.県外 : CONFIG.exam.地元;
      const p = clamp(base + (retry ? CONFIG.exam.retryBonus : 0) + skill(s), 0, 1);
      const ok = s.rng.chance(p);
      const where = s.flags.has('県外志望') ? '県外の大学' : '地元の大学';
      yield* envelope(s, entry, `${where}　合否`, ok ? '合格' : '不合格', ok);
      if (ok) {
        s.flags.delete('入試不合格');
        setPath(s, '大学');
      }
      return ok;
    }

    function jobRate(s, name) {
      const j = CONFIG.job;
      return clamp(j.base[name] * j.mult[name][econ(s)] + skill(s), j.min, j.max);
    }

    function* jobHunt(s, entry, highSchool, retry) {
      const options = ['商社', 'メーカー', '市役所'].map((name) => ({
        name,
        enabled: !(highSchool && name === '商社'),
        note: highSchool && name === '商社' ? '高卒では選べません' : '',
      }));
      const enabled = options.filter((o) => o.enabled).map((o) => o.name);
      let pick = yield { kind: 'pick', title: retry ? 'もう一度、志望を選ぶ' : '志望を選ぶ', options, count: 2, economy: econ(s) };
      if (!Array.isArray(pick)) pick = [];
      pick = pick.filter((n, i) => enabled.includes(n) && pick.indexOf(n) === i);
      for (const n of enabled) if (pick.length < 2 && !pick.includes(n)) pick.push(n);
      const [first, second] = pick;
      entry.notes.push(`第一志望：${first}　第二志望：${second}`);

      let result = null;
      let stage = 'first';
      if (s.rng.chance(jobRate(s, first))) {
        yield* envelope(s, entry, `第一志望　${first}`, '内定', true);
        result = first;
      } else {
        yield* envelope(s, entry, `第一志望　${first}`, '不採用', false);
        if (!retry) s.flags.add('第一志望不合格');
        if (s.rng.chance(jobRate(s, second) * CONFIG.job.secondFactor)) {
          yield* envelope(s, entry, `第二志望　${second}`, '内定', true);
          result = second;
          stage = 'second';
        } else {
          stage = 'none';
          yield* envelope(s, entry, `第二志望　${second}`, '不採用', false);
          const bad = ['不況', '大不況'].includes(econ(s));
          result = s.rng.chance(bad ? CONFIG.job.irregularBad : CONFIG.job.irregular) ? '非正規' : '地元企業';
          yield* envelope(s, entry, 'それから', result === '非正規' ? '非正規の仕事に就いた' : '地元の会社に拾われた', null);
        }
      }
      setCareer(s, result);
      s.flags.add('就職済');
      s.jobHistory.push({ age: s.age, first, second, result, stage, economy: econ(s), highSchool, retry });
    }

    function* change(s, entry, name) {
      const cfg = CONFIG.change[name];
      let p = cfg.p;
      if (cfg.econ) p *= CONFIG.job.mult['メーカー'][econ(s)];
      const ok = s.rng.chance(p);
      const title = name === '転職判定(登用)' ? '登用試験' : '転職活動';
      yield* envelope(s, entry, title, ok ? (name === '転職判定(登用)' ? '合格' : '内定') : '見送り', ok);
      yield* applyOps(s, fx(ok ? cfg.success : cfg.fail), entry);
      if (ok && cfg.redraw) drawCompany(s);
    }

    const PROCESS = {
      '入試判定': function* (s, entry) {
        const ok = yield* exam(s, entry, false);
        if (!ok) s.flags.add('入試不合格');
      },
      '入試判定(再)': function* (s, entry) {
        s.pending.push({ type: 'reexam', from: entry });
        entry.notes.push('来年、もう一度受ける');
      },
      '就職判定': function* (s, entry) { yield* jobHunt(s, entry, false, false); },
      '就職判定(高卒)': function* (s, entry) { yield* jobHunt(s, entry, true, false); },
      '就職判定(再)': function* (s, entry) {
        s.flags.delete('就職済');
        s.career = '学生';
        s.company = null;
        s.pending.push({ type: 'jobRetry', from: entry });
        entry.notes.push('来年、もう一度就職活動をする');
      },
      '転職判定': function* (s, entry) { yield* change(s, entry, '転職判定'); },
      '転職判定(拓海)': function* (s, entry) { yield* change(s, entry, '転職判定(拓海)'); },
      '転職判定(登用)': function* (s, entry) { yield* change(s, entry, '転職判定(登用)'); },
      '会社の運命を引き直す': function* (s) { drawCompany(s); },
    };

    // 前の年から持ち越した処理（浪人の再受験、就職浪人）
    function* runPending(s) {
      const list = s.pending;
      s.pending = [];
      for (const p of list) {
        const entry = newEntry(s, { id: p.from.id, type: p.from.type, title: `${p.from.title}（その翌年）` });
        if (p.type === 'reexam') {
          const ok = yield* exam(s, entry, true);
          if (!ok) {
            setPath(s, '就職');
            entry.notes.push('もう一年は待てなかった。働くことにした');
            yield* jobHunt(s, entry, true, true);
          }
        } else if (p.type === 'jobRetry') {
          yield* jobHunt(s, entry, s.path !== '大学', true);
        }
      }
    }

    // ---- 出来事 ----
    function newEntry(s, ev) {
      const entry = { age: s.age, id: ev.id, type: ev.type, title: ev.title, choice: null, deltas: {}, notes: [] };
      s.log.push(entry);
      s.currentYear.items.push(entry);
      return entry;
    }

    function eligible(s, ev) {
      return s.age >= ev.ageFrom && s.age <= ev.ageTo
        && !(ev.once && s.used[ev.id])
        && !s.firedThisYear.has(ev.id)
        && ev.condFn(s);
    }

    function* runEvent(s, ev) {
      s.used[ev.id] = (s.used[ev.id] || 0) + 1;
      s.lastSeen[ev.id] = s.age;
      s.firedThisYear.add(ev.id);
      const entry = newEntry(s, ev);
      const text = ev.textFn(s);
      if (ev.type === '一行') {
        yield* applyOps(s, ev.effectOps, entry);
        yield { kind: 'oneliner', id: ev.id, title: ev.title, text, entry };
        return;
      }
      const choices = ev.choices.map((c) => ({ label: c.labelFn(s), enabled: c.condFn(s) }));
      const answer = yield { kind: 'event', id: ev.id, type: ev.type, title: ev.title, text, choices, fate: ev.type === '運命', entry };
      if (choices.length) {
        let idx = Number(answer);
        if (!(idx >= 0 && idx < choices.length && choices[idx].enabled)) idx = choices.findIndex((c) => c.enabled);
        if (idx < 0) idx = 0;
        entry.choice = choices[idx].label.split('\n')[0];
        yield* applyOps(s, ev.choices[idx].ops, entry);
      } else {
        yield* applyOps(s, ev.effectOps, entry);
      }
      yield { kind: 'after', entry };
    }

    // 確率1の出来事を、条件を満たすかぎり上の行から順に起こす（同じ年の連鎖もここで起きる）
    function* certainEvents(s, types, max) {
      let n = 0;
      while (n < max) {
        const ev = C.events.find((e) => types.includes(e.type) && eligible(s, e) && DL.effectiveProb(e, s) >= 1);
        if (!ev) break;
        yield* runEvent(s, ev);
        n++;
      }
      return n;
    }

    function* bigEvent(s) {
      // 確認用：指定された出来事を確率に関係なく起こす（条件と年齢は守る）
      const fi = s.forceQueue.findIndex((id) => { const e = C.events.find((x) => x.id === id); return e && eligible(s, e); });
      if (fi >= 0) {
        const id = s.forceQueue.splice(fi, 1)[0];
        yield* runEvent(s, C.events.find((x) => x.id === id));
        return;
      }
      if (yield* certainEvents(s, BIG, 8)) return;
      const hits = C.events.filter((e) => BIG.includes(e.type) && eligible(s, e) && s.rng.chance(DL.effectiveProb(e, s)));
      if (hits.length) yield* runEvent(s, s.rng.pick(hits));
    }

    function* oneLiners(s) {
      const n = yield* certainEvents(s, ['一行'], CONFIG.maxOneLiners);
      const rested = (e) => !(s.lastSeen[e.id] > s.age - CONFIG.oneLinerCooldown);
      const hits = C.events.filter((e) => e.type === '一行' && eligible(s, e) && rested(e) && s.rng.chance(DL.effectiveProb(e, s)));
      for (let i = n; i < CONFIG.maxOneLiners && hits.length; i++) {
        yield* runEvent(s, hits.splice(s.rng.int(hits.length), 1)[0]);
      }
    }

    // ---- 同窓会 ----
    function careerLabel(s) {
      if (s.flags.has('経営者')) return `${s.career}（社長）`;
      if (s.career === '学生') return s.path === '大学' ? '大学生' : '学生';
      return s.career;
    }

    function* reunion(s) {
      const rows = C.reunion.filter((r) => r.age === s.age);
      const first = (scene) => rows.find((r) => r.scene === scene && r.condFn(s));
      const textOf = (r) => (r ? r.textFn(s) : '');
      const intro = first('導入');
      const you = first('あなたへ');
      const mates = rows.filter((r) => r.scene === '同級生' && r.condFn(s)).map(textOf);
      const roster = C.classmates.map((c) => {
        const p = c.patterns.find((x) => x.key === s.hidden.classmates[c.name]) || {};
        return { name: c.name, job: s.age < 30 ? p.job25 : p.job35, note: s.age < 30 ? p.at25 : p.at35 };
      });
      roster.push({ name: 'あなた', job: careerLabel(s), note: textOf(first('名簿')), you: true });
      s.currentYear.items.push({ age: s.age, id: 'reunion', type: '同窓会', title: `${s.age}歳の同窓会`, deltas: {}, notes: [] });
      yield { kind: 'reunion', age: s.age, intro: textOf(intro), you: textOf(you), classmates: mates, roster, close: textOf(first('締め')) };
    }

    // ---- 1年の流れ（SPEC 6章） ----
    function* play(s) {
      yield { kind: 'birth', birth: s.birth, stats: { ...s.stats } };
      for (let age = CONFIG.firstAge; age <= CONFIG.lastAge; age++) {
        s.age = age;
        s.rng = DL.makeRng(s.seed, 'year:' + age);
        s.firedThisYear = new Set();
        s.currentYear = { age, economy: econ(s), items: [], career: s.career };
        s.years.push(s.currentYear);

        yield { kind: 'year', age, economy: econ(s) }; // 1. 景気
        yield* runPending(s);
        if (CONFIG.reunionAges.includes(age)) yield* reunion(s); // 2. 同窓会
        const career = C.careers[s.career]; // 3. キャリアの毎年の変化
        if (career) for (const op of career.yearlyOps) if (op.op === 'stat') applyStat(s, op.stat, op.delta, null);
        if (age >= CONFIG.agingFrom) applyStat(s, '健康', -1, null); // 4. 30歳から
        yield* bigEvent(s); // 5. 大きな出来事
        yield* oneLiners(s); // 6. 一行の出来事
        yield* certainEvents(s, BIG, 4); // 7. しきい値の出来事（と、この年に条件がそろった確率1の出来事）
        s.currentYear.stats = { ...s.stats }; // 8. 記録
        s.currentYear.career = s.career;
      }
      yield { kind: 'ending', ending: buildEnding(s) };
    }

    // ---- 振り返り（SPEC 12章） ----
    function buildEnding(s) {
      const absSum = (d) => Object.values(d).reduce((a, v) => a + Math.abs(v), 0);
      const big = s.log.filter((e) => BIG.includes(e.type));
      const top5 = big
        .map((e) => ({ ...e, impact: absSum(e.deltas) }))
        .filter((e) => e.impact > 0)
        .sort((a, b) => b.impact - a.impact || a.age - b.age)
        .slice(0, 5);
      const fateImpact = big.filter((e) => e.type === '運命').reduce((a, e) => a + absSum(e.deltas), 0);
      const allImpact = big.reduce((a, e) => a + absSum(e.deltas), 0);
      const fatePercent = allImpact ? Math.round((fateImpact / allImpact) * 100) : 0;

      // 人生の形：ふつうの人生と比べて、いちばんよく伸びた数値（伸び方の平均と散らばりは数値ごとに違うため）
      const growth = DL.STATS.map((k) => [k, s.stats[k] - s.startStats[k]]);
      const score = ([k, g]) => (g - CONFIG.shapeBaseline[k].mean) / CONFIG.shapeBaseline[k].sd;
      const [shapeStat, shapeGrowth] = growth.reduce((best, x) => (score(x) > score(best) ? x : best));
      const shape = SHAPES[shapeStat];

      const classmates = C.classmates.map((c) => {
        const key = s.hidden.classmates[c.name];
        const p = c.patterns.find((x) => x.key === key) || {};
        return { name: c.name, key, title: p.title };
      });

      return {
        seed: s.seed,
        timeline: s.years.map((y) => ({
          age: y.age,
          economy: y.economy,
          items: y.items.map((e) => ({ type: e.type, title: e.title, choice: e.choice, notes: e.notes })),
        })),
        series: [{ age: CONFIG.firstAge - 1, stats: s.startStats }, ...s.years.map((y) => ({ age: y.age, stats: y.stats }))],
        top5: top5.map((e) => ({ age: e.age, title: e.title, type: e.type, choice: e.choice, deltas: e.deltas, impact: e.impact })),
        hidden: {
          birth: s.birth,
          body: s.hidden.body,
          love: s.hidden.love,
          economy: s.economy,
          companies: s.companyHistory.map((c) => ({ ...c })),
          classmates,
        },
        chosen: big.filter((e) => e.type === '選択').length,
        unchosen: big.filter((e) => e.type === '運命').length,
        fatePercent,
        shape,
        growth,
        shapeStat,
        shapeGrowth,
        shapeTypical: CONFIG.shapeBaseline[shapeStat].mean,
        finalStats: { ...s.stats },
        share: `私の人生の形は『${shape}』。運命の割合は${fatePercent}％でした。#同窓会ライフ`,
      };
    }

    return { newLife, play, CONFIG };
  }

  DL.createGame = createGame;
})(typeof window !== 'undefined' ? (window.DL = window.DL || {}) : (globalThis.DL = globalThis.DL || {}));
