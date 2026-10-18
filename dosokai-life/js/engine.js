// ゲームの中身（画面とは切り離してある）。
// play() はジェネレーターで、場面（scene）を1つずつ返す。選択が必要な場面では、
// 画面側が gen.next(答え) で答えを渡す。テストでは同じ仕組みで自動で最後まで進める。
(function (DL) {
  'use strict';

  // 仕様の数値（すべて仮値）。年齢ごとの起きやすさは、ここではなくイベント表の「確率表」シートに書く
  const CONFIG = {
    startStat: 50,
    birth: {
      place: [['都市', 0.4], ['地方', 0.6]],
      wealth: [['ゆとり', 0.25], ['ふつう', 0.5], ['きびしい', 0.25]],
      parent: [['若い', 0.3], ['ふつう', 0.5], ['高め', 0.2]],
      sex: [['男', 0.512], ['女', 0.488]], // 出生性比 105：100（人口動態統計）
    },
    // キャリアシートの「女性の割合」を、新卒全体の女性の割合で割って、求人の届きやすさにする（推計：学校基本調査）
    femaleShare: 0.45,
    birthEffects: { 都市: '手応え+5', 地方: 'つながり+5', ゆとり: 'お金+15 余白+5', きびしい: 'お金-15' },
    hidden: {
      body: [['丈夫', 0.3], ['ふつう', 0.55], ['弱い', 0.15]],
      love: [['高', 0.25], ['中', 0.5], ['低', 0.25]],
      // 住んでいる地域の災害の起きやすさ（推計：地震動予測地図で26％以上の地域に住む人の割合などから）
      disaster: [['高', 0.35], ['中', 0.4], ['低', 0.25]],
    },
    // 親と主人公の年齢差（母）。父は母より0〜4歳上
    parentGap: { 若い: [22, 26], ふつう: [27, 33], 高め: [34, 40] },
    economyFirst: [['好況', 0.25], ['ふつう', 0.5], ['不況', 0.25]],
    economyNext: {
      好況: [['好況', 0.6], ['ふつう', 0.35], ['不況', 0.05]],
      ふつう: [['好況', 0.2], ['ふつう', 0.6], ['不況', 0.2]],
      不況: [['好況', 0.05], ['ふつう', 0.4], ['不況', 0.55]],
      大不況: [['ふつう', 0.4], ['不況', 0.6]],
    },
    crashChance: 0.04, // 大不況が割り込む確率（1〜2年続く）
    exam: {
      県外: 0.65, 地元: 0.85, retryBonus: 0.1,
      // 学部ごとの入りにくさ（合格率にかける）。医学部・歯学部は特に難しい（推計）
      faculty: { 医学部: 0.45, 歯学部: 0.6, 薬学部: 0.85 },
    },
    facultyYears: { 医学部: 6, 歯学部: 6, 薬学部: 6 }, // ほかは4年
    generalFaculties: ['文系', '理系', '教育学部'], // キャリアシートの「学部」が空の仕事に、求人が届く学部
    // 会社名の頭（架空）。求人は「あさひシステムズ」のような名前で届く
    companyPrefixes: ['あさひ', 'みなと', '北浜', '中央', 'ひかり', 'さくら', '東和', '青葉', '若葉', '光陽', '丸山', 'やまびこ', '千鳥', '松葉', '白樺', '港南', '朝凪', '緑丘', '大和田', 'つばさ'],
    skillFactor: 0.004, // （手応え − 50）× 0.004
    // 就職：仕事ごとの合格率・景気の影響・大卒／高卒の割合は、イベント表の「キャリア」シートに書く
    job: {
      // 景気の影響（キャリアシートの「景気の影響」列） → 好況・ふつう・不況・大不況の倍率
      econ: {
        大きい: { 好況: 1.3, ふつう: 1.0, 不況: 0.6, 大不況: 0.4 },
        ふつう: { 好況: 1.2, ふつう: 1.0, 不況: 0.8, 大不況: 0.7 },
        小さい: { 好況: 1.05, ふつう: 1.0, 不況: 0.95, 大不況: 0.9 },
      },
      offers: { 大学: 6, 高卒: 5 }, // その年に届く求人の数
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
    // 仕事を離れていた人が、また働くとき（無職・引退から）。働いている人には転職判定と同じ
    reemploy: { p: 0.55, econ: true, jobs: [['地元企業', 0.5], ['非正規', 0.5]], success: '手応え+2 お金+3', fail: '余白-4' },
    twinRate: 0.01, // 出産のうち双子（人口動態統計：多胎は約1％）
    houseDamage: 0.25, // 地域が大災害に見舞われたとき、自宅も被害を受ける割合（推計）
    loanCost: '', // ローンがある間、毎年かかるもの（家賃の代わりなので、v0.2 ではかけない）
    reunionAges: [25, 35, 50], // 1月に開く同窓会。65歳の同窓会は最後の年の終わりに開く
    finalReunionAge: 65,
    firstAge: 18,
    lastAge: 65,
    aging: [[30, -1, 2], [55, -1, 2]], // [この年齢から, 健康にこれを足す, 何年おきに]（重ねがけ）
    recovery: { 健康: [40, 1], 余白: [40, 1] }, // [これより低いと, 毎年これだけ戻る]（体が慣れる・気持ちが立ち直る）
    careerHalfFrom: 40, // この年齢からは、キャリアの毎年の変化を1年おきにする
    maxOneLiners: 2,
    maxRarePerYear: 3,
    oneLinerCooldown: 3, // 同じ一行の出来事は、出てから3年は出さない
    // 人生の形の判定に使う「ふつうの人生」の伸び（はじめ→最後）の平均と散らばり。
    // 表や確率を変えたら node tests/balance.js で測り直して、ここを書き換える
    shapeBaseline: {
      お金: { mean: 3.2, sd: 29.5 },
      健康: { mean: -10, sd: 7 },
      手応え: { mean: 36, sd: 12.2 },
      つながり: { mean: 37.6, sd: 14.4 },
      余白: { mean: -13.2, sd: 11.1 },
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
    const mortality = (age) => C.tableRate('死亡', age);

    // ---- 人生の始まり：生まれ・隠れた運命・景気・同級生・家族の寿命を最初に全部決める ----
    // opts.sex：'男' か '女'。なければ運命で決める（ほかの運命の並びを変えないよう、別の乱数の流れで引く）
    function newLife(seed, opts = {}) {
      seed = String(seed);
      const fate = DL.makeRng(seed, 'fate');
      const sex = ['男', '女'].includes(opts.sex) ? opts.sex : DL.makeRng(seed, 'sex').weighted(CONFIG.birth.sex);
      const birth = {
        sex,
        place: fate.weighted(CONFIG.birth.place),
        wealth: fate.weighted(CONFIG.birth.wealth),
        parent: fate.weighted(CONFIG.birth.parent),
      };
      const hidden = {
        body: fate.weighted(CONFIG.hidden.body),
        love: fate.weighted(CONFIG.hidden.love),
        classmates: {},
        classmateDeath: {},
        grandparentDeaths: [],
      };
      const economy = makeEconomy(fate);
      for (const c of C.classmates) hidden.classmates[c.name] = fate.weighted(c.patterns.map((p) => [p.key, p.prob]));
      // ここから v0.2 で足した運命（v0.1 の運命の並びは変えない）
      hidden.disaster = fate.weighted(CONFIG.hidden.disaster);
      for (const c of C.classmates) {
        const p = c.patterns.find((x) => x.key === hidden.classmates[c.name]) || {};
        hidden.classmateDeath[c.name] = lifespan(fate, CONFIG.firstAge, CONFIG.lastAge, typeof p.mortality === 'number' ? p.mortality : 1);
      }
      const [lo, hi] = CONFIG.parentGap[birth.parent];
      const motherGap = lo + fate.int(hi - lo + 1);
      const parents = {
        母: { gap: motherGap, state: '健在' },
        父: { gap: motherGap + fate.int(5), state: '健在' },
      };
      // 祖父母4人：主人公が生まれたときの年齢から寿命をくじ引きし、18歳より後に亡くなる人だけを残す
      for (let i = 0; i < 4; i++) {
        const atBirth = (i < 2 ? parents.母.gap : parents.父.gap) + 24 + fate.int(9);
        const dies = lifespan(fate, atBirth, 110, 1);
        const playerAge = dies == null ? null : dies - atBirth;
        if (playerAge != null && playerAge >= CONFIG.firstAge && playerAge <= CONFIG.lastAge) hidden.grandparentDeaths.push(playerAge);
      }

      const stats = {};
      for (const k of DL.STATS) stats[k] = CONFIG.startStat;
      const s = {
        seed, sex, age: CONFIG.firstAge, stats, flags: new Set(), flagAge: {}, career: '学生', path: '',
        birth, hidden, economy, company: null, companyHistory: [], parents,
        partner: null, partners: [], children: [], home: '実家', region: '地元', loan: 0,
        jobHuntAge: null, pending: [], used: {}, firedThisYear: new Set(), jobHistory: [], lastSeen: {},
        log: [], years: [], forceQueue: [], rareHits: [], dead: false,
        companyRng: DL.makeRng(seed, 'company'),
      };
      for (const v of [birth.place, birth.wealth]) {
        for (const op of fx(CONFIG.birthEffects[v] || '')) if (op.op === 'stat') s.stats[op.stat] = clamp(s.stats[op.stat] + op.delta, 0, 100);
      }
      s.startStats = { ...s.stats };
      return s;
    }

    // from 歳から to 歳まで、確率表「死亡」で毎年くじを引き、亡くなる年齢を返す（生きていれば null）
    function lifespan(rng, from, to, mult) {
      for (let a = from; a <= to; a++) if (rng.chance(mortality(a) * mult)) return a;
      return null;
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

    function setFlag(s, name) {
      s.flags.add(name);
      s.flagAge[name] = s.age;
    }

    // 会社の例「表示=名前の語尾」から、架空の会社名を作る（語尾がなければ、表示をそのまま名前にする：県庁など）
    function parseExamples(c) {
      return (c && c.examples ? c.examples : []).map((x) => {
        const [shown, suffix] = x.split('=').map((y) => (y || '').trim());
        return { shown, suffix };
      });
    }
    function companyName(s, careerName, taken) {
      const ex = parseExamples(C.careers[careerName]);
      if (!ex.length) return { name: careerName, shown: '' };
      for (let i = 0; i < 20; i++) {
        const e = s.rng.pick(ex);
        const name = e.suffix ? s.rng.pick(CONFIG.companyPrefixes) + e.suffix : e.shown;
        if (!taken || !taken.has(name)) return { name, shown: e.shown };
      }
      return { name: careerName + '（もう一社）', shown: '' };
    }

    function drawCompany(s) {
      const career = C.careers[s.career];
      const fortunes = career ? career.fortunes : [];
      if (s.career === '学生') { s.company = null; return; }
      const fortune = fortunes.length ? s.companyRng.weighted(fortunes) : 'なし';
      s.company = { career: s.career, fortune, age: s.age, label: s.jobLabel };
      const last = s.companyHistory[s.companyHistory.length - 1];
      if (last && last.age === s.age && last.career === s.career) s.companyHistory.pop(); // 同じ年の引き直しは1つにまとめる
      s.companyHistory.push(s.company);
    }

    function setCareer(s, name, label) {
      if (name === s.career && !label) return;
      s.career = name;
      s.jobLabel = label || (['自営業'].includes(name) ? '自分の店' : companyName(s, name).name);
      drawCompany(s);
    }

    function setPath(s, name) {
      s.path = name;
      if (name === '大学' && s.jobHuntAge == null) {
        // 4年制なら3年後（21歳）、6年制なら5年後に就職活動（国家試験と就職先選び）
        const years = CONFIG.facultyYears[s.faculty] || 4;
        s.jobHuntAge = s.age + years - 1 + (s.flags.has('休学') ? 1 : 0);
      }
    }

    function* applyOps(s, ops, entry) {
      for (const op of ops) {
        if (op.op === 'stat') applyStat(s, op.stat, op.delta, entry);
        else if (op.op === 'flag') {
          setFlag(s, op.name);
          // 休学したら、就職活動は1年遅れる（SPEC 7章。22歳まで）
          if (op.name === '休学' && s.jobHuntAge != null && s.jobHuntAge >= s.age && !s.flags.has('就職済')) {
            s.jobHuntAge += 1;
          }
        } else if (op.op === 'unflag') s.flags.delete(op.name);
        else if (op.op === 'career') setCareer(s, op.name);
        else if (op.op === 'path') setPath(s, op.name);
        else if (op.op === 'faculty') s.faculty = op.name;
        else if (op.op === 'home') s.home = op.name;
        else if (op.op === 'region') s.region = op.name;
        else if (op.op === 'loan') s.loan = op.years;
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
      const fm = CONFIG.exam.faculty[s.faculty] || 1;
      const p = clamp((base + (retry ? CONFIG.exam.retryBonus : 0) + skill(s)) * fm, 0, 1);
      const ok = s.rng.chance(p);
      const where = (s.flags.has('県外志望') ? '県外の大学' : '地元の大学') + (s.faculty ? `（${s.faculty}）` : '');
      yield* envelope(s, entry, `${where}　合否`, ok ? '合格' : '不合格', ok);
      if (ok) {
        s.flags.delete('入試不合格');
        setPath(s, '大学');
        if (s.flags.has('県外志望')) { s.home = '賃貸'; s.region = '都市'; }
      }
      return ok;
    }

    const econMult = (profile, e) => (CONFIG.job.econ[profile] || CONFIG.job.econ.ふつう)[e];
    function jobRate(s, name) {
      const c = C.careers[name] || {};
      const base = typeof c.pass === 'number' ? c.pass : 0.5;
      return clamp(base * econMult(c.econ, econ(s)) + skill(s), CONFIG.job.min, CONFIG.job.max);
    }
    const difficulty = (p) => (p < 0.35 ? '狭き門' : p < 0.6 ? 'ふつう' : '入りやすい');

    // その年に届く求人を、実際の就職先の割合でくじ引きする。求人は会社単位なので、同じ業種が何件も届くことがある
    // （高卒なら製造業が多い）。重みは「割合 ÷ 合格率」（合格のしやすさで偏らないように）
    function drawOffers(s, highSchool) {
      const key = highSchool ? 'shareHigh' : 'shareUni';
      const fac = s.faculty || '文系';
      // キャリアシートの「学部」：空なら一般の学部（文系・理系・教育学部）に届く。「教育学部×6」は、その学部なら6倍届きやすい
      const boost = (c) => {
        if (highSchool) return 1;
        const list = (c.faculties || '').split(/[,、]/).map((x) => x.trim()).filter(Boolean);
        if (!list.length) return CONFIG.generalFaculties.includes(fac) ? 1 : 0;
        const hit = list.find((x) => x.replace(/×.*$/, '') === fac);
        if (!hit) return 0;
        const m = hit.match(/×([\d.]+)/);
        return m ? Number(m[1]) : 1;
      };
      // キャリアシートの「女性の割合」：その仕事に就く新人のうち女性の割合。男女で求人の届きやすさを変える
      const sexW = (c) => {
        if (typeof c.female !== 'number') return 1;
        const base = CONFIG.femaleShare;
        return s.sex === '女' ? c.female / base : (1 - c.female) / (1 - base);
      };
      const pool = Object.values(C.careers).filter((c) => typeof c[key] === 'number' && c[key] > 0 && !(highSchool && c.uniOnly) && boost(c) > 0);
      const out = [];
      const taken = new Set();
      const n = CONFIG.job.offers[highSchool ? '高卒' : '大学'];
      for (let i = 0; i < n && pool.length; i++) {
        const c = s.rng.weighted(pool.map((x) => [x, (x[key] * boost(x) * sexW(x)) / (typeof x.pass === 'number' ? x.pass : 0.5)]));
        const co = companyName(s, c.name, taken);
        taken.add(co.name);
        out.push({ career: c, label: co.name, shown: co.shown });
      }
      return out;
    }

    function* jobHunt(s, entry, highSchool, retry) {
      const offers = drawOffers(s, highSchool);
      const careerOf = {};
      const options = offers.map((o) => {
        careerOf[o.label] = o.career.name;
        const what = [o.career.heading || o.career.name, o.label !== o.shown ? o.shown : ''].filter(Boolean).join('・');
        return { name: o.label, enabled: true, note: `${what}・${difficulty(jobRate(s, o.career.name))}` };
      });
      if (highSchool) {
        // 大卒向けの求人も1つ、選べない形で見せる（選べなかったことも体験の一部）
        const uni = Object.values(C.careers).filter((c) => c.uniOnly && c.shareUni > 0);
        if (uni.length) {
          const c = s.rng.weighted(uni.map((x) => [x, x.shareUni]));
          const co = companyName(s, c.name, new Set(options.map((o) => o.name)));
          options.push({ name: co.name, enabled: false, note: `${c.heading || c.name}・${co.shown}・大卒以上の求人です` });
        }
      }
      const enabled = options.filter((o) => o.enabled).map((o) => o.name);
      let pick = yield { kind: 'pick', title: retry ? 'もう一度、志望を選ぶ' : '届いた求人から、志望を選ぶ', options, count: 2, economy: econ(s) };
      if (!Array.isArray(pick)) pick = [];
      pick = pick.filter((n, i) => enabled.includes(n) && pick.indexOf(n) === i);
      for (const n of enabled) if (pick.length < 2 && !pick.includes(n)) pick.push(n);
      const [firstLabel, secondLabel] = pick;
      const first = careerOf[firstLabel];
      const second = careerOf[secondLabel];
      entry.notes.push(`第一志望：${firstLabel}　第二志望：${secondLabel}`);

      let result = null;
      let stage = 'first';
      let otherLabel = null;
      if (s.rng.chance(jobRate(s, first))) {
        yield* envelope(s, entry, `第一志望　${firstLabel}`, '内定', true);
        result = first;
      } else {
        yield* envelope(s, entry, `第一志望　${firstLabel}`, '不採用', false);
        if (!retry) setFlag(s, '第一志望不合格');
        if (s.rng.chance(jobRate(s, second) * CONFIG.job.secondFactor)) {
          yield* envelope(s, entry, `第二志望　${secondLabel}`, '内定', true);
          result = second;
          stage = 'second';
        } else {
          yield* envelope(s, entry, `第二志望　${secondLabel}`, '不採用', false);
          // ほかに届いていた求人を順に当たる（現実には、第一・第二志望以外から内定をもらう人も多い）
          let other = null;
          for (const o of options.filter((x) => x.enabled && x.name !== firstLabel && x.name !== secondLabel)) {
            if (s.rng.chance(jobRate(s, careerOf[o.name]) * CONFIG.job.secondFactor)) { other = o.name; break; }
          }
          if (other) {
            stage = 'other';
            result = careerOf[other];
            otherLabel = other;
            yield* envelope(s, entry, 'それから', `ほかに受けていた「${other}」から内定`, true);
          } else {
            stage = 'none';
            const bad = ['不況', '大不況'].includes(econ(s));
            result = s.rng.chance(bad ? CONFIG.job.irregularBad : CONFIG.job.irregular) ? '非正規' : '地元企業';
            yield* envelope(s, entry, 'それから', result === '非正規' ? '非正規の仕事に就いた' : '地元の会社に拾われた', null);
          }
        }
      }
      const label = stage === 'first' ? firstLabel : stage === 'second' ? secondLabel : stage === 'other' ? otherLabel : null;
      setCareer(s, result, label || undefined);
      setFlag(s, '就職済');
      s.jobHistory.push({ age: s.age, first, second, result, stage, economy: econ(s), highSchool, retry });
    }

    function* change(s, entry, name) {
      const cfg = CONFIG.change[name];
      let p = cfg.p;
      if (cfg.econ) p *= econMult('大きい', econ(s));
      const ok = s.rng.chance(p);
      const title = name === '転職判定(登用)' ? '登用試験' : '転職活動';
      yield* envelope(s, entry, title, ok ? (name === '転職判定(登用)' ? '合格' : '内定') : '見送り', ok);
      yield* applyOps(s, fx(ok ? cfg.success : cfg.fail), entry);
      if (ok) setFlag(s, '転職経験');
      if (ok && cfg.redraw) {
        s.jobLabel = companyName(s, s.career, new Set([s.jobLabel])).name; // 同じ仕事の、別の会社へ
        drawCompany(s);
      }
    }

    // 配偶者シートの属性を、条件に合う候補から割合でくじ引き
    function drawAttr(s, attr) {
      const list = (C.partnerAttrs[attr] || []).filter((a) => a.condFn(s) && a.weight > 0);
      if (!list.length) return null;
      return s.rng.weighted(list.map((a) => [a, a.weight]));
    }

    const PROCESS = {
      '入試判定': function* (s, entry) {
        const ok = yield* exam(s, entry, false);
        if (!ok) setFlag(s, '入試不合格');
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
      '再就職判定': function* (s, entry) {
        if (!['無職', '引退', '学生'].includes(s.career)) { yield* change(s, entry, '転職判定'); return; }
        const cfg = CONFIG.reemploy;
        const ok = s.rng.chance(cfg.p * (cfg.econ ? econMult('大きい', econ(s)) : 1));
        const job = s.rng.weighted(cfg.jobs);
        yield* envelope(s, entry, '仕事探し', ok ? `${job}で働くことになった` : 'まだ決まらない', ok);
        if (ok) { setCareer(s, job); setFlag(s, '転職経験'); }
        yield* applyOps(s, fx(ok ? cfg.success : cfg.fail), entry);
      },

      // ---- 結婚と家族 ----
      '出会い': function* (s, entry) {
        const meet = drawAttr(s, '出会い');
        const gap = drawAttr(s, '年齢差');
        const work = drawAttr(s, '働き方');
        const fit = drawAttr(s, '相性');
        const share = drawAttr(s, '分担');
        s.partner = {
          status: '交際中', metAt: s.age,
          meet: meet ? meet.value : 'その他',
          meetText: meet ? meet.textFn(s) : '',
          ageDiff: gap && typeof gap.num === 'number' ? gap.num : 0,
          ageLabel: gap ? gap.value : '同い年',
          work: work ? work.value : '共働き',
          fit: fit ? fit.value : 'ふつう',
          share: share ? share.value : '分け合う',
        };
        s.partners.push(s.partner);
        s.flags.delete('結婚を保留'); // 新しい相手とは、また最初から
        setFlag(s, '出会い直後');
        if (entry) entry.notes.push(`出会い：${s.partner.meet}`);
      },
      '結婚': function* (s, entry) {
        if (!s.partner) return;
        s.partner.status = '既婚';
        s.partner.marriedAt = s.age;
        if (s.firstMarriageAge == null) s.firstMarriageAge = s.age;
        for (const f of ['結婚', '結婚経験', '結婚直後']) setFlag(s, f);
        if (s.home === '実家') s.home = '賃貸';
        if (entry) entry.notes.push('結婚');
      },
      '別れ': function* (s) {
        s.partner = null;
        setFlag(s, '別れ直後');
      },
      '離婚': function* (s, entry) {
        s.partner = null;
        s.flags.delete('結婚');
        for (const f of ['離婚経験', '離婚直後']) setFlag(s, f);
        if (entry) entry.notes.push('離婚');
      },
      '出産': function* (s, entry) {
        const twins = s.rng.chance(CONFIG.twinRate);
        s.children.push({ born: s.age });
        if (twins) { s.children.push({ born: s.age }); setFlag(s, '双子直後'); setFlag(s, '双子'); }
        for (const f of ['子ども', '出産直後']) setFlag(s, f);
        if (entry) entry.notes.push(twins ? '双子が生まれた' : `子ども（${s.children.length}人目）`);
      },
      'パートナーの死': function* (s, entry) {
        s.partner = null;
        s.flags.delete('結婚');
        for (const f of ['死別', 'パートナーの死直後']) setFlag(s, f);
        if (entry) entry.notes.push('パートナーを見送った');
      },
      '父の要介護': function* (s) { s.parents.父.state = '要介護'; setFlag(s, '介護経験'); },
      '母の要介護': function* (s) { s.parents.母.state = '要介護'; setFlag(s, '介護経験'); },
      '父の死': function* (s, entry) {
        s.parents.父.state = '亡';
        for (const f of ['父の死直後', '親を見送った']) setFlag(s, f);
        if (entry) entry.notes.push('父を見送った');
      },
      '母の死': function* (s, entry) {
        s.parents.母.state = '亡';
        for (const f of ['母の死直後', '親を見送った']) setFlag(s, f);
        if (entry) entry.notes.push('母を見送った');
      },
      '本人の死': function* (s) {
        s.dead = true;
        s.deathAge = s.age;
        setFlag(s, '死亡');
      },
      '被災判定': function* (s, entry) {
        setFlag(s, '被災');
        setFlag(s, '被災直後');
        if (s.rng.chance(CONFIG.houseDamage)) {
          for (const f of ['自宅被害', '自宅被害直後']) setFlag(s, f);
          if (entry) entry.notes.push('自宅も被害を受けた');
        }
      },
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
      const entry = {
        age: s.age, id: ev.id, type: ev.type, title: ev.title, category: ev.category || (ev.rare ? 'くじ' : ''),
        choice: null, deltas: {}, notes: [],
      };
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

    function rareInfo(ev) {
      return ev.rare ? { rarity: ev.rarity, lifetime: ev.lifetime, group: ev.group, confidence: ev.confidence } : null;
    }

    function* runEvent(s, ev) {
      s.used[ev.id] = (s.used[ev.id] || 0) + 1;
      s.lastSeen[ev.id] = s.age;
      s.firedThisYear.add(ev.id);
      const entry = newEntry(s, ev);
      const rare = rareInfo(ev);
      if (rare) s.rareHits.push({ id: ev.id, title: ev.title, age: s.age, ...rare });
      const base = { id: ev.id, type: ev.type, title: ev.title, category: entry.category, staging: ev.staging, rare, entry };
      if (ev.type === '一行') {
        yield* applyOps(s, ev.effectOps, entry);
        yield { ...base, kind: 'oneliner', text: ev.textFn(s) };
        return;
      }
      if (!ev.choices.length) {
        // 選択肢のない出来事は、効果を当ててから本文を作る（出会いのきっかけ、生まれた子の人数などを本文に使うため）
        yield* applyOps(s, ev.effectOps, entry);
        yield { ...base, kind: 'event', text: ev.textFn(s), choices: [], fate: ev.type === '運命' };
        yield { kind: 'after', entry };
        return;
      }
      const choices = ev.choices.map((c, i) => ({ label: c.labelFn(s), enabled: c.condFn(s), weight: ev.weights && ev.weights[i] }));
      const answer = yield { ...base, kind: 'event', text: ev.textFn(s), choices, fate: ev.type === '運命' };
      let idx = Number(answer);
      if (!(idx >= 0 && idx < choices.length && choices[idx].enabled)) idx = choices.findIndex((c) => c.enabled);
      if (idx < 0) idx = 0;
      entry.choice = choices[idx].label.split('\n')[0];
      yield* applyOps(s, ev.choices[idx].ops, entry);
      yield { kind: 'after', entry };
    }

    // 確率1の出来事を、条件を満たすかぎり上の行から順に起こす（同じ年の連鎖もここで起きる）
    function* certainEvents(s, types, max) {
      let n = 0;
      while (n < max && !s.dead) {
        const ev = C.events.find((e) => !e.statistical && types.includes(e.type) && eligible(s, e) && DL.effectiveProb(e, s) >= 1);
        if (!ev) break;
        yield* runEvent(s, ev);
        n++;
      }
      return n;
    }

    // 確率表を参照する出来事（統計の出来事）：それぞれ独立にくじを引き、当たったものはすべて起きる。
    // 1年に1つの制限をかけると、現実の確率より起きにくくなってしまうため
    function* statisticalEvents(s) {
      const hits = C.events.filter((e) => e.statistical && eligible(s, e) && s.rng.chance(DL.effectiveProb(e, s)));
      for (const ev of hits) {
        if (s.dead) return;
        if (eligible(s, ev)) yield* runEvent(s, ev); // 前の出来事で状況が変わったら、起きない
      }
    }

    function* bigEvent(s) {
      // 確認用：指定された出来事を確率に関係なく起こす（条件と年齢は守る）
      const all = [...C.events, ...C.rare];
      const fi = s.forceQueue.findIndex((id) => { const e = all.find((x) => x.id === id); return e && eligible(s, e); });
      if (fi >= 0) {
        const id = s.forceQueue.splice(fi, 1)[0];
        yield* runEvent(s, all.find((x) => x.id === id));
        return;
      }
      if (yield* certainEvents(s, BIG, 8)) return;
      const hits = C.events.filter((e) => !e.statistical && BIG.includes(e.type) && eligible(s, e) && s.rng.chance(DL.effectiveProb(e, s)));
      if (hits.length) yield* runEvent(s, s.rng.pick(hits));
    }

    // 人生のくじ（低確率の出来事）：それぞれ独立に引く
    function* rareEvents(s) {
      const hits = C.rare.filter((e) => eligible(s, e) && s.rng.chance(DL.effectiveProb(e, s)));
      let n = 0;
      for (const ev of hits) {
        if (s.dead || n >= CONFIG.maxRarePerYear) return;
        if (!eligible(s, ev)) continue;
        yield* runEvent(s, ev);
        n++;
      }
    }

    function* oneLiners(s) {
      const n = yield* certainEvents(s, ['一行'], CONFIG.maxOneLiners);
      const rested = (e) => !(s.lastSeen[e.id] > s.age - CONFIG.oneLinerCooldown);
      const hits = C.events.filter((e) => !e.statistical && e.type === '一行' && eligible(s, e) && rested(e) && s.rng.chance(DL.effectiveProb(e, s)));
      for (let i = n; i < CONFIG.maxOneLiners && hits.length; i++) {
        yield* runEvent(s, hits.splice(s.rng.int(hits.length), 1)[0]);
      }
    }

    // 年の初めに、決まっていた運命（同級生・祖父母の訃報）とローンを進める
    function startOfYear(s) {
      for (const c of C.classmates) if (s.hidden.classmateDeath[c.name] === s.age) setFlag(s, `${c.name}の訃報直後`);
      if (s.hidden.grandparentDeaths.includes(s.age)) setFlag(s, '祖父母の訃報直後');
      const career = C.careers[s.career]; // キャリアの毎年の変化（40歳からは1年おき）
      if (career && (s.age < CONFIG.careerHalfFrom || s.age % 2 === 0)) {
        for (const op of career.yearlyOps) if (op.op === 'stat') applyStat(s, op.stat, op.delta, null);
      }
      for (const [from, d, every] of CONFIG.aging) if (s.age >= from && (s.age - from) % every === 0) applyStat(s, '健康', d, null);
      for (const [k, [below, d]] of Object.entries(CONFIG.recovery)) if (s.stats[k] < below) applyStat(s, k, d, null);
      if (s.loan > 0) {
        for (const op of fx(CONFIG.loanCost)) applyStat(s, op.stat, op.delta, null);
        s.loan--;
        if (s.loan === 0) setFlag(s, 'ローン完済直後');
      }
    }

    // 「〜直後」のフラグは、その年の終わりに消える
    function endOfYear(s) {
      for (const f of [...s.flags]) if (f.endsWith('直後')) s.flags.delete(f);
    }

    // ---- 同窓会 ----
    function careerLabel(s) {
      if (s.dead) return '';
      if (s.flags.has('経営者')) return `${s.career}（社長）`;
      if (s.career === '学生') return s.path === '大学' ? '大学生' : '学生';
      return s.jobLabel && s.jobLabel !== s.career ? `${s.career}（${s.jobLabel}）` : s.career;
    }

    function pick(p, field, age) {
      for (const a of [65, 50, 35, 25]) if (age >= a && p[field + a]) return p[field + a];
      return p[field + 25] || '';
    }

    function* reunion(s, age) {
      const rows = C.reunion.filter((r) => r.age === age);
      const first = (scene) => rows.find((r) => r.scene === scene && r.condFn(s));
      const textOf = (r) => (r ? r.textFn(s) : '');
      const intro = first('導入');
      const you = first('あなたへ');
      const mateRows = rows.filter((r) => r.scene === '同級生' && r.condFn(s));
      const roster = C.classmates.map((c) => {
        const p = c.patterns.find((x) => x.key === s.hidden.classmates[c.name]) || {};
        const died = s.hidden.classmateDeath[c.name];
        if (died != null && died <= age) return { name: c.name, job: '', note: `${died}歳で亡くなった`, gone: true };
        return { name: c.name, job: pick(p, 'job', age), note: pick(p, 'at', age) };
      });
      roster.push({ name: 'あなた', job: careerLabel(s), note: textOf(first('名簿')), you: true, gone: s.dead });
      if (s.currentYear) s.currentYear.items.push({ age, id: 'reunion', type: '同窓会', title: `${age}歳の同窓会`, deltas: {}, notes: [] });
      yield {
        kind: 'reunion', age, intro: textOf(intro), you: textOf(you),
        classmates: mateRows.map(textOf), stagings: mateRows.map((r) => r.staging),
        roster, close: textOf(first('締め')), memorial: s.dead,
      };
    }

    // ---- 1年の流れ ----
    function* play(s, hooks = {}) {
      yield { kind: 'birth', birth: s.birth, stats: { ...s.stats } };
      for (let age = CONFIG.firstAge; age <= CONFIG.lastAge && !s.dead; age++) {
        s.age = age;
        s.rng = DL.makeRng(s.seed, 'year:' + age);
        s.firedThisYear = new Set();
        s.currentYear = { age, economy: econ(s), items: [], career: s.career };
        s.years.push(s.currentYear);

        yield { kind: 'year', age, economy: econ(s) };
        yield* runPending(s);
        if (CONFIG.reunionAges.includes(age)) yield* reunion(s, age);
        startOfYear(s);
        yield* bigEvent(s); // 大きな出来事（しきい値・確率1の連鎖を先に。そのほかは1年に1つ）
        if (!s.dead) yield* statisticalEvents(s); // 統計の出来事（出会い・出産・病気・事故・死など）
        if (!s.dead) yield* rareEvents(s); // 人生のくじ
        if (!s.dead) yield* oneLiners(s); // 一行の出来事
        if (!s.dead) yield* certainEvents(s, BIG, 4); // しきい値の出来事と、この年に条件がそろった確率1の出来事
        s.currentYear.stats = { ...s.stats };
        s.currentYear.career = s.career;
        if (hooks.onYearEnd) hooks.onYearEnd(s);
        endOfYear(s);
      }
      if (s.dead) {
        // 亡くなったあとも、同級生たちの時間は進む。65歳の同窓会で、同級生たちがあなたを思い出す
        yield { kind: 'passing', age: s.deathAge, years: CONFIG.finalReunionAge - s.deathAge };
        const realAge = s.age;
        s.age = CONFIG.finalReunionAge;
        s.currentYear = null;
        yield* reunion(s, CONFIG.finalReunionAge);
        s.age = realAge;
      } else {
        yield* reunion(s, CONFIG.finalReunionAge);
      }
      yield { kind: 'ending', ending: buildEnding(s) };
    }

    // ---- 振り返り ----
    function buildEnding(s) {
      const absSum = (d) => Object.values(d).reduce((a, v) => a + Math.abs(v), 0);
      const big = s.log.filter((e) => BIG.includes(e.type));
      const label = (e) => (e.category === '転機' ? '転機' : e.category === 'くじ' ? 'くじ' : e.type);
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
        return { name: c.name, key, title: p.title, died: s.hidden.classmateDeath[c.name] };
      });
      const lastPartner = s.partners[s.partners.length - 1];

      return {
        seed: s.seed,
        deathAge: s.dead ? s.deathAge : null,
        timeline: s.years.map((y) => ({
          age: y.age,
          economy: y.economy,
          items: y.items.map((e) => ({ type: e.type, category: e.category, title: e.title, choice: e.choice, notes: e.notes })),
        })),
        series: [{ age: CONFIG.firstAge - 1, stats: s.startStats }, ...s.years.map((y) => ({ age: y.age, stats: y.stats || { ...s.stats } }))],
        top5: top5.map((e) => ({ age: e.age, title: e.title, type: e.type, label: label(e), choice: e.choice, deltas: e.deltas, impact: e.impact })),
        hidden: {
          birth: s.birth,
          body: s.hidden.body,
          love: s.hidden.love,
          disaster: s.hidden.disaster,
          economy: s.economy.slice(0, s.years.length),
          companies: s.companyHistory.map((c) => ({ ...c })),
          classmates,
          partner: lastPartner ? { meet: lastPartner.meet, fit: lastPartner.fit, share: lastPartner.share, work: lastPartner.work } : null,
        },
        family: {
          married: s.flags.has('結婚経験'),
          children: s.children.length,
          home: s.home,
        },
        rareHits: s.rareHits.slice(),
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
