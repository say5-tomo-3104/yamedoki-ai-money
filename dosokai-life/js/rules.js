// イベント表の書式（SPEC 14章、v0.2 で拡張）を読み取る部分。
// 条件・効果・確率（数値か「表:名前」）・確率の補正・本文の出し分け・演出・確率表・統計・配偶者・人物をここにまとめる。
// 読めない書式があっても例外は投げず、warnings に「E0xx の条件が読めません」をためて、その部分だけ無効にする。
(function (DL) {
  'use strict';

  const STATS = ['お金', '健康', '手応え', 'つながり', '余白'];
  const STAT_ALIAS = { 心の余白: '余白' };
  const ECONOMY = ['好況', 'ふつう', '不況', '大不況'];
  const BASE_CAREERS = ['学生', '商社', 'メーカー', '市役所', '地元企業', '非正規'];
  const PROCESSES = [
    '入試判定', '入試判定(再)', '就職判定', '就職判定(高卒)', '就職判定(再)',
    '転職判定', '転職判定(拓海)', '転職判定(登用)', '会社の運命を引き直す',
    '出会い', '結婚', '別れ', '離婚', '出産', 'パートナーの死',
    '父の要介護', '母の要介護', '父の死', '母の死', '本人の死', '被災判定', '再就職判定',
  ];
  const PARENT_STATES = ['健在', '要介護', '亡'];
  const FACULTIES = ['文系', '理系', '教育学部', '看護・医療', '薬学部', '医学部', '歯学部'];

  const childAges = (s) => s.children.map((c) => s.age - c.born);
  const partnerAge = (s) => (s.partner ? s.age + s.partner.ageDiff : undefined);
  const parentAge = (s, who) => (s.parents[who] ? s.age + s.parents[who].gap : undefined);

  // 条件の左辺（=, != で比べるもの） → [状態から値を取り出す関数, 取りうる値（null なら自由）]
  const KEYS = {
    性別: [(s) => s.sex, ['男', '女']],
    進路: [(s) => s.path, ['大学', '就職']],
    学部: [(s) => s.faculty || '', FACULTIES],
    景気: [(s) => s.economy[s.age - 18], ECONOMY],
    前年の景気: [(s) => s.economy[s.age - 19], ECONOMY],
    体質: [(s) => s.hidden.body, ['丈夫', 'ふつう', '弱い']],
    出会い運: [(s) => s.hidden.love, ['高', '中', '低']],
    親: [(s) => s.birth.parent, ['若い', 'ふつう', '高め']],
    家庭: [(s) => s.birth.wealth, ['ゆとり', 'ふつう', 'きびしい']],
    育った場所: [(s) => s.birth.place, ['都市', '地方']],
    会社の運命: [(s) => (s.company ? s.company.fortune : ''), null],
    パートナー: [(s) => (s.partner ? s.partner.status : 'なし'), ['なし', '交際中', '既婚']],
    出会い: [(s) => (s.partner ? s.partner.meet : ''), null],
    '配偶者:働き方': [(s) => (s.partner ? s.partner.work : ''), null],
    '配偶者:相性': [(s) => (s.partner ? s.partner.fit : ''), null],
    '配偶者:分担': [(s) => (s.partner ? s.partner.share : ''), null],
    '配偶者:年齢差': [(s) => (s.partner ? s.partner.ageLabel : ''), null],
    住まい: [(s) => s.home, ['実家', '賃貸', '持ち家']],
    地域: [(s) => s.region, ['地元', '都市', '移住先', '海外']],
    災害リスク: [(s) => s.hidden.disaster, ['高', '中', '低']],
    父: [(s) => s.parents.父.state, PARENT_STATES],
    母: [(s) => s.parents.母.state, PARENT_STATES],
    親の介護: [(s) => (['父', '母'].some((w) => s.parents[w].state === '要介護') ? 'あり' : 'なし'), ['あり', 'なし']],
  };
  // 数値で比べられる左辺（>=, <, = など）
  const NUMERIC = {
    年齢: (s) => s.age,
    子ども数: (s) => s.children.length,
    末子の年齢: (s) => (s.children.length ? Math.min(...childAges(s)) : undefined),
    長子の年齢: (s) => (s.children.length ? Math.max(...childAges(s)) : undefined),
    結婚年数: (s) => (s.partner && s.partner.status === '既婚' ? s.age - s.partner.marriedAt : undefined),
    交際年数: (s) => (s.partner && s.partner.status === '交際中' ? s.age - s.partner.metAt : undefined),
    ローン残り: (s) => s.loan,
    父の年齢: (s) => parentAge(s, '父'),
    母の年齢: (s) => parentAge(s, '母'),
    パートナーの年齢: partnerAge,
    // 子を産む人の年齢（主人公が女性なら主人公、男性ならパートナー）。出産の確率表の基準に使う
    産む人の年齢: (s) => (s.sex === '女' ? s.age : partnerAge(s)),
    がんの診断からの年数: (s) => (s.flags.has('持病がん') ? s.age - s.flagAge['持病がん'] : undefined),
  };
  // 確率表の「基準」に使えるもの
  const BASES = NUMERIC;
  // ゲームが用意するフラグ（表で立てなくても条件に書ける）
  const VIRTUAL_FLAGS = {
    就活の年: (s) => s.jobHuntAge === s.age,
  };
  // 本文に差し込めるもの
  const PLACEHOLDERS = {
    出会いの場面: (s) => (s.partner && s.partner.meetText) || '',
    年齢: (s) => String(s.age),
    子ども数: (s) => String(s.children.length),
  };
  const CMP = {
    '>=': (x, v) => x >= v, '<=': (x, v) => x <= v, '>': (x, v) => x > v,
    '<': (x, v) => x < v, '=': (x, v) => x === v, '!=': (x, v) => x !== v,
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
    const CAREERS = [...new Set([...BASE_CAREERS, ...data.careers.map((c) => c.name)])];

    function warn(id, part, src) {
      warnings.push(`${id} の${part}が読めません（${src}）`);
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
      } else if ((m = c.match(/^亡:(.+)$/)) && classmateKeys[m[1].trim()]) {
        const name = m[1].trim();
        fn = (s) => s.hidden.classmateDeath[name] != null && s.hidden.classmateDeath[name] <= s.age;
      } else if ((m = c.match(/^経過:(.+?)\s*(>=|<=|!=|>|<|=)\s*(\d+)$/))) {
        const [, name, op, v] = m;
        fn = (s) => s.flagAge[name] != null && CMP[op](s.age - s.flagAge[name], Number(v));
      } else if ((m = c.match(/^子:年齢\s*(>=|<=|!=|>|<|=)\s*(\d+)$/))) {
        const [, op, v] = m;
        fn = (s) => childAges(s).some((a) => CMP[op](a, Number(v)));
      } else if ((m = c.match(/^([^<>=!]+?)\s*(>=|<=|!=|>|<|=)\s*(-?\d+(?:\.\d+)?)$/))
        && (statName(m[1].trim()) || NUMERIC[m[1].trim()])) {
        const key = m[1].trim();
        const get = statName(key) ? ((st) => (s) => s.stats[st])(statName(key)) : NUMERIC[key];
        const op = m[2];
        const v = Number(m[3]);
        fn = (s) => { const x = get(s); return x !== undefined && CMP[op](x, v); };
      } else if ((m = c.match(/^(?:同級生:)?([^=!]+?)\s*(!=|=)\s*(.+)$/))) {
        const key = m[1].trim();
        const vals = m[3].split('|').map((v) => v.trim()); // 「キャリア=商社|メーカー」はどれか
        const neq = m[2] === '!=';
        let get = null;
        let allowed = null;
        if (key === 'キャリア' || key === '最初の仕事') {
          allowed = CAREERS;
          get = key === 'キャリア' ? (s) => s.career : (s) => (s.jobHistory.length ? s.jobHistory[0].result : '');
        } else if (key === '働き方') {
          // キャリアシートの「区分」（会社員・公務員・非正規・自営業・無職・再雇用・引退・学生）
          allowed = [...new Set(Object.values(careers).map((c) => c.kind).filter(Boolean))];
          get = (s) => (careers[s.career] || {}).kind;
        } else if (KEYS[key]) {
          allowed = KEYS[key][1];
          if (key === '会社の運命' && fortuneNames.size) allowed = [...fortuneNames];
          get = KEYS[key][0];
        } else if (classmateKeys[key]) {
          allowed = classmateKeys[key];
          get = (s) => s.hidden.classmates[key];
        } else {
          return null;
        }
        if (allowed && vals.some((v) => !allowed.includes(v))) return null;
        fn = neq ? (s) => !vals.includes(get(s)) : (s) => vals.includes(get(s));
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
        } else if ((m = tok.match(/^学部:(.+)$/)) && FACULTIES.includes(m[1])) {
          ops.push({ op: 'faculty', name: m[1] });
        } else if ((m = tok.match(/^住まい:(実家|賃貸|持ち家)$/))) {
          ops.push({ op: 'home', name: m[1] });
        } else if ((m = tok.match(/^地域:(地元|都市|移住先|海外)$/))) {
          ops.push({ op: 'region', name: m[1] });
        } else if ((m = tok.match(/^ローン:(\d+)$/))) {
          ops.push({ op: 'loan', years: Number(m[1]) });
        } else if ((m = tok.match(/^処理:(.+)$/)) && PROCESSES.includes(m[1])) {
          ops.push({ op: 'process', name: m[1] });
        } else {
          warn(id, part || '効果', tok);
        }
      }
      return ops;
    }

    // ---- 確率表 ----
    const tables = {};
    for (const t of data.tables || []) {
      const ok = typeof t.from === 'number' && typeof t.to === 'number' && typeof t.rate === 'number';
      if (!t.name || !ok || !BASES[t.basis]) {
        warnings.push(`確率表「${t.name}」の${t.row}行目が読めません（基準 ${t.basis}、${t.from}〜${t.to}、年率 ${t.rate}）`);
        continue;
      }
      (tables[t.name] = tables[t.name] || []).push(t);
    }
    // 名前と基準の値 → 年率
    function tableRate(name, value) {
      const rows = tables[name];
      if (!rows || value === undefined) return 0;
      const r = rows.find((x) => value >= x.from && value <= x.to);
      return r ? r.rate : 0;
    }

    // ---- 確率 ---- 数値か「表:名前」「表:名前@基準」
    function compileProb(src, id) {
      if (typeof src === 'number') return { fn: () => src, table: null };
      const str = normalize(src);
      const m = str.match(/^表:([^@]+?)(?:@(.+))?$/);
      if (!m) { warn(id, '確率', src); return { fn: () => 0, table: null }; }
      const name = m[1].trim();
      const basis = m[2] ? m[2].trim() : (tables[name] && tables[name][0].basis);
      if (!tables[name]) { warn(id, '確率', `確率表に「${name}」がありません`); return { fn: () => 0, table: name }; }
      if (!BASES[basis]) { warn(id, '確率', `基準「${basis}」`); return { fn: () => 0, table: name }; }
      return { fn: (s) => tableRate(name, BASES[basis](s)), table: name };
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
      for (const m2 of str.matchAll(/\{([^}]+)\}/g)) if (!PLACEHOLDERS[m2[1]]) warn(id, part || '本文', `{${m2[1]}}`);
      return (s) => parts.map((p) => (typeof p === 'string' ? p : p.cond(s) ? p.then : p.else)).join('')
        .replace(/\{([^}]+)\}/g, (all, k) => (PLACEHOLDERS[k] ? PLACEHOLDERS[k](s) : all));
    }

    // ---- 人物（絵）と演出 ----
    const people = {};
    for (const p of data.people || []) {
      const exprs = {};
      for (const pair of normalize(p.expressions).split(/[,、]/)) {
        const [ja, en] = pair.split('=').map((x) => (x || '').trim());
        if (ja) exprs[ja] = en || ja;
      }
      const ages = String(p.ages || '').split(/[,、]/).map(Number).filter((n) => !Number.isNaN(n) && n > 0).sort((a, b) => a - b);
      people[p.id] = { ...p, exprs, ages };
    }
    // 演出の文字列 → [{kind:'portrait', who, expr, side} | {kind:'cutin', who, line}]
    function compileStaging(src, id) {
      const out = [];
      const str = String(src || '').trim();
      if (!str) return out;
      for (const tok of str.split(/[\s　]+(?=立ち絵:|カットイン:)/)) {
        let m;
        if ((m = tok.match(/^立ち絵:([^/]+)\/([^/]+)\/(左|右)$/)) && people[m[1].trim()]) {
          out.push({ kind: 'portrait', who: m[1].trim(), expr: m[2].trim(), side: m[3] });
        } else if ((m = tok.match(/^カットイン:([^/]*)\/(.+)$/)) && (!m[1].trim() || people[m[1].trim()])) {
          out.push({ kind: 'cutin', who: m[1].trim(), line: m[2].trim() });
        } else {
          warn(id, '演出', tok);
        }
      }
      return out;
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
    function compileEvent(e) {
      if (!TYPES.includes(e.type)) warn(e.id, '種類', e.type);
      if (typeof e.ageFrom !== 'number' || typeof e.ageTo !== 'number') warn(e.id, '年齢', `${e.ageFrom}〜${e.ageTo}`);
      const prob = compileProb(e.prob, e.id);
      return {
        ...e,
        probFn: prob.fn,
        statistical: !!prob.table, // 確率表を参照する出来事は、当たればすべて起きる
        condFn: compileCond(e.cond, e.id, '条件'),
        effectOps: compileEffect(e.effect, e.id, '効果'),
        probMods: compileProbMod(e.probMod, e.id),
        textFn: compileText(e.text, e.id, '本文'),
        staging: compileStaging(e.staging, e.id),
        choices: e.choices.map((c, i) => ({
          ...c,
          labelFn: compileText(c.label, e.id, `選択肢${i + 1}`),
          ops: compileEffect(c.effect, e.id, `効果${i + 1}`),
          condFn: compileCond(c.cond, e.id, `選択肢${i + 1}の条件`),
        })),
      };
    }
    const events = data.events.map(compileEvent);
    const rare = (data.rare || []).map((e) => ({ ...compileEvent(e), rare: true }));
    const ids = new Set();
    for (const e of [...events, ...rare]) {
      if (ids.has(e.id)) warnings.push(`${e.id} が2回出てきます（IDは1つの行にだけ付けてください）`);
      ids.add(e.id);
    }
    const reunion = data.reunion.map((r) => ({
      ...r,
      condFn: compileCond(r.cond, r.id, '条件'),
      textFn: compileText(r.text, r.id, '本文'),
      staging: compileStaging(r.staging, r.id),
    }));

    // 配偶者の属性：属性ごとに [候補, 割合, 条件, 値]
    const partnerAttrs = {};
    for (const a of data.partner || []) {
      (partnerAttrs[a.attr] = partnerAttrs[a.attr] || []).push({
        ...a,
        condFn: compileCond(a.cond, `配偶者「${a.attr}:${a.value}」`, '条件'),
        textFn: compileText(a.text, `配偶者「${a.attr}:${a.value}」`, '文章'),
      });
    }

    // 統計（照合の目標）：測り方は「条件@年齢」か「条件@年齢|母集団の条件」か「平均:名前」
    const stats = (data.stats || []).map((t) => {
      const str = normalize(t.measure);
      let m;
      let metric = null;
      if ((m = str.match(/^平均:(.+)$/))) {
        metric = { kind: 'mean', name: m[1].trim() };
      } else if ((m = str.match(/^(.+?)@(\d+)(?:\|(.+))?$/))) {
        // 母集団に「全員」が入っていれば、亡くなった人も含める（例：全員;性別=男）
        const parts = (m[3] || '').split(/[;；]/).map((x) => x.trim()).filter(Boolean);
        const rest = parts.filter((x) => x !== '全員').join(';');
        metric = {
          kind: 'share',
          age: Number(m[2]),
          cond: compileCond(m[1], `統計「${t.name}」`, '測り方'),
          all: parts.includes('全員'),
          pop: rest ? compileCond(rest, `統計「${t.name}」`, '母集団') : null,
        };
      } else {
        warnings.push(`統計「${t.name}」の測り方が読めません（${t.measure}）`);
      }
      return { ...t, metric };
    });

    return {
      events, rare, reunion, careers, classmates: data.classmates, people, partnerAttrs, stats,
      warnings, compileEffect, compileCond, tableRate, CAREERS,
    };
  }

  // 確率の補正を当てはめた、その年の確率
  function effectiveProb(ev, s) {
    let p = ev.probFn(s);
    for (const m of ev.probMods) {
      if (!m.cond(s)) continue;
      p = m.mul ? p * m.value : m.value;
    }
    return p;
  }

  DL.STATS = STATS;
  DL.ECONOMY = ECONOMY;
  DL.FACULTIES = FACULTIES;
  DL.compileData = createCompiler;
  DL.effectiveProb = effectiveProb;
})(typeof window !== 'undefined' ? (window.DL = window.DL || {}) : (globalThis.DL = globalThis.DL || {}));
