// イベント表の書式（SPEC 14章）を読み取る部分。条件・効果・確率の補正・本文の出し分けをここにまとめる。
// 読めない書式があっても例外は投げず、warnings に「E0xx の条件が読めません」をためて、その部分だけ無効にする。
(function (DL) {
  'use strict';

  const STATS = ['お金', '健康', '手応え', 'つながり', '余白'];
  const STAT_ALIAS = { 心の余白: '余白' };
  const ECONOMY = ['好況', 'ふつう', '不況', '大不況'];
  const CAREERS = ['学生', '商社', 'メーカー', '市役所', '地元企業', '非正規'];
  const PROCESSES = [
    '入試判定', '入試判定(再)', '就職判定', '就職判定(高卒)', '就職判定(再)',
    '転職判定', '転職判定(拓海)', '転職判定(登用)', '会社の運命を引き直す',
  ];
  // 条件の左辺 → [状態から値を取り出す関数, 取りうる値]
  const KEYS = {
    キャリア: [(s) => s.career, CAREERS],
    進路: [(s) => s.path, ['大学', '就職']],
    景気: [(s) => s.economy[s.age - 18], ECONOMY],
    前年の景気: [(s) => s.economy[s.age - 19], ECONOMY],
    体質: [(s) => s.hidden.body, ['丈夫', 'ふつう', '弱い']],
    出会い運: [(s) => s.hidden.love, ['高', '中', '低']],
    親: [(s) => s.birth.parent, ['若い', 'ふつう', '高め']],
    家庭: [(s) => s.birth.wealth, ['ゆとり', 'ふつう', 'きびしい']],
    育った場所: [(s) => s.birth.place, ['都市', '地方']],
    会社の運命: [(s) => (s.company ? s.company.fortune : ''), null], // 取りうる値はキャリアシートから
  };
  // ゲームが用意するフラグ（表で立てなくても条件に書ける）
  const VIRTUAL_FLAGS = {
    就活の年: (s) => s.jobHuntAge === s.age,
  };

  // 全角の記号や数字を半角にそろえる（表に全角で書かれても読めるように）
  function normalize(str) {
    return String(str || '')
      .replace(/[！＝＜＞；：＋－（）０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
      .replace(/[−ー](?=\d)/g, '-')
      .replace(/≧/g, '>=').replace(/≦/g, '<=')
      .trim();
  }

  function statName(name) {
    const n = STAT_ALIAS[name] || name;
    return STATS.includes(n) ? n : null;
  }

  function createCompiler(data) {
    const warnings = [];
    const classmateKeys = {};
    for (const c of data.classmates) classmateKeys[c.name] = c.patterns.map((p) => p.key);
    const fortuneNames = new Set();
    const careers = {};

    function warn(id, part, src) {
      const msg = `${id} の${part}が読めません（${src}）`;
      warnings.push(msg);
    }

    // ---- 条件 ----
    function compileClause(raw) {
      let c = raw.trim();
      let negate = false;
      if (c.startsWith('!')) { negate = true; c = c.slice(1).trim(); }
      let fn = null;
      let m;
      if ((m = c.match(/^フラグ:(.+)$/))) {
        const name = m[1].trim();
        fn = VIRTUAL_FLAGS[name] || ((s) => s.flags.has(name));
      } else if ((m = c.match(/^([^<>=!]+?)\s*(>=|<=|!=|>|<|=)\s*(-?\d+(?:\.\d+)?)$/)) && statName(m[1].trim())) {
        const stat = statName(m[1].trim());
        const op = m[2];
        const v = Number(m[3]);
        fn = (s) => {
          const x = s.stats[stat];
          switch (op) {
            case '>=': return x >= v;
            case '<=': return x <= v;
            case '>': return x > v;
            case '<': return x < v;
            case '=': return x === v;
            default: return x !== v;
          }
        };
      } else if ((m = c.match(/^(?:同級生:)?([^=!]+?)\s*(!=|=)\s*(.+)$/))) {
        const key = m[1].trim();
        const val = m[3].trim();
        const neq = m[2] === '!=';
        let get = null;
        if (KEYS[key]) {
          const allowed = KEYS[key][1];
          if (allowed && !allowed.includes(val)) return null;
          if (key === '会社の運命' && fortuneNames.size && !fortuneNames.has(val)) return null;
          get = KEYS[key][0];
        } else if (classmateKeys[key]) {
          if (!classmateKeys[key].includes(val)) return null;
          get = (s) => s.hidden.classmates[key];
        } else {
          return null;
        }
        fn = neq ? (s) => get(s) !== val : (s) => get(s) === val;
      }
      if (!fn) return null;
      return negate ? (s) => !fn(s) : fn;
    }

    // 条件の文字列 → (状態) => true/false。読めなければ常に false（その出来事は起きない）
    function compileCond(src, id, part) {
      const str = normalize(src);
      if (!str) return () => true;
      const fns = [];
      for (const piece of str.split(';')) {
        if (!piece.trim()) continue;
        const fn = compileClause(piece);
        if (!fn) {
          warn(id, part || '条件', src);
          return () => false;
        }
        fns.push(fn);
      }
      return (s) => fns.every((f) => f(s));
    }

    // ---- 効果 ----
    // 効果の文字列 → 操作の配列。読めないトークンだけ捨てる
    function compileEffect(src, id, part) {
      const ops = [];
      const str = normalize(src);
      if (!str) return ops;
      for (const tok of str.split(/[\s　]+/)) {
        if (!tok) continue;
        let m;
        if ((m = tok.match(/^([^+\-:]+)([+-])(\d+)$/)) && statName(m[1])) {
          ops.push({ op: 'stat', stat: statName(m[1]), delta: Number(m[3]) * (m[2] === '-' ? -1 : 1) });
        } else if ((m = tok.match(/^フラグ消:(.+)$/))) {
          ops.push({ op: 'unflag', name: m[1] });
        } else if ((m = tok.match(/^フラグ:(.+)$/))) {
          ops.push({ op: 'flag', name: m[1] });
        } else if ((m = tok.match(/^キャリア:(.+)$/)) && CAREERS.includes(m[1])) {
          ops.push({ op: 'career', name: m[1] });
        } else if ((m = tok.match(/^進路:(大学|就職)$/))) {
          ops.push({ op: 'path', name: m[1] });
        } else if ((m = tok.match(/^処理:(.+)$/)) && PROCESSES.includes(m[1])) {
          ops.push({ op: 'process', name: m[1] });
        } else {
          warn(id, part || '効果', tok);
        }
      }
      return ops;
    }

    // ---- 確率の補正 ---- 「条件→0.8」で置き換え、「条件→×1.5」で掛け算。「／」で複数
    function compileProbMod(src, id) {
      const str = normalize(src);
      if (!str) return [];
      const mods = [];
      for (const piece of str.split(/[／/]/)) {
        if (!piece.trim()) continue;
        const m = piece.match(/^(.+?)(?:→|->)\s*([×x*])?\s*(\d+(?:\.\d+)?)$/);
        if (!m) { warn(id, '確率の補正', piece); continue; }
        mods.push({ cond: compileCond(m[1], id, '確率の補正'), mul: !!m[2], value: Number(m[3]) });
      }
      return mods;
    }

    // ---- 本文の出し分け ---- 〔条件〕A〔それ以外〕B〔/〕
    function compileText(src, id, part) {
      const str = String(src || '');
      const re = /〔([^〕]+?)〕([\s\S]*?)(?:〔それ以外〕([\s\S]*?))?〔\/〕/g;
      const parts = [];
      let last = 0;
      let m;
      while ((m = re.exec(str))) {
        if (m[1] === 'それ以外' || m[1] === '/') break;
        if (m.index > last) parts.push(str.slice(last, m.index));
        parts.push({ cond: compileCond(m[1], id, part || '本文'), then: m[2], else: m[3] || '' });
        last = re.lastIndex;
      }
      parts.push(str.slice(last));
      if (/〔|〕/.test(parts[parts.length - 1])) warn(id, part || '本文', '〔 〕の対応');
      return (s) => parts.map((p) => (typeof p === 'string' ? p : p.cond(s) ? p.then : p.else)).join('');
    }

    function compileFortunes(src) {
      const out = [];
      for (const m of normalize(src).matchAll(/([^\s／/%]+?)\s*(\d+)%/g)) out.push([m[1], Number(m[2]) / 100]);
      return out;
    }

    // ---- 全体 ----
    for (const c of data.careers) {
      const fortunes = compileFortunes(c.fortunes);
      fortunes.forEach(([n]) => fortuneNames.add(n));
      careers[c.name] = { ...c, yearlyOps: compileEffect(c.yearly, `キャリア「${c.name}」`, '毎年の変化'), fortunes };
    }
    for (const name of CAREERS) {
      if (!careers[name]) warnings.push(`キャリア「${name}」がキャリアシートにありません`);
    }

    const TYPES = ['選択', '運命', '一行'];
    const events = data.events.map((e) => {
      if (!TYPES.includes(e.type)) warn(e.id, '種類', e.type);
      if (typeof e.prob !== 'number') warn(e.id, '確率', e.prob);
      if (typeof e.ageFrom !== 'number' || typeof e.ageTo !== 'number') warn(e.id, '年齢', `${e.ageFrom}〜${e.ageTo}`);
      return {
        ...e,
        prob: typeof e.prob === 'number' ? e.prob : 0,
        condFn: compileCond(e.cond, e.id, '条件'),
        effectOps: compileEffect(e.effect, e.id, '効果'),
        probMods: compileProbMod(e.probMod, e.id),
        textFn: compileText(e.text, e.id, '本文'),
        choices: e.choices.map((c, i) => ({
          ...c,
          labelFn: compileText(c.label, e.id, `選択肢${i + 1}`),
          ops: compileEffect(c.effect, e.id, `効果${i + 1}`),
          condFn: compileCond(c.cond, e.id, `選択肢${i + 1}の条件`),
        })),
      };
    });
    const reunion = data.reunion.map((r) => ({
      ...r,
      condFn: compileCond(r.cond, r.id, '条件'),
      textFn: compileText(r.text, r.id, '本文'),
    }));

    return { events, reunion, careers, classmates: data.classmates, warnings, compileEffect };
  }

  // 確率の補正を当てはめた、その年の確率
  function effectiveProb(ev, s) {
    let p = ev.prob;
    for (const m of ev.probMods) {
      if (!m.cond(s)) continue;
      p = m.mul ? p * m.value : m.value;
    }
    return p;
  }

  DL.STATS = STATS;
  DL.ECONOMY = ECONOMY;
  DL.CAREERS = CAREERS;
  DL.compileData = createCompiler;
  DL.effectiveProb = effectiveProb;
})(typeof window !== 'undefined' ? (window.DL = window.DL || {}) : (globalThis.DL = globalThis.DL || {}));
