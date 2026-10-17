// 画面。engine.js の play() が返す場面を、1つずつ表示する。
(function () {
  'use strict';
  const DL = window.DL;

  // 進む速さ（5段階）。大きな出来事では、どの速さでも止まる
  const SPEEDS = {
    slowest: { label: 'とてもゆっくり', step: 3600, line: 3200, envelope: 2200, cutin: 2000 },
    slow: { label: 'ゆっくり', step: 2600, line: 2400, envelope: 1700, cutin: 1600 },
    normal: { label: 'ふつう', step: 1400, line: 1500, envelope: 1100, cutin: 1200 },
    fast: { label: 'はやい', step: 450, line: 600, envelope: 500, cutin: 800 },
    fastest: { label: 'とてもはやい', step: 120, line: 250, envelope: 250, cutin: 500 },
  };
  const STAT_LABEL = { お金: 'お金', 健康: '健康', 手応え: '手応え', つながり: 'つながり', 余白: '心の余白' };
  const SERIES_COLOR = { お金: 'var(--series-1)', 健康: 'var(--series-2)', 手応え: 'var(--series-3)', つながり: 'var(--series-4)', 余白: 'var(--series-5)' };
  const BIRTH_LABEL = { place: '育った場所', wealth: '家庭のゆとり', parent: '親の年齢' };
  const STARS = (n) => '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));
  const ZUKAN_KEY = 'dosokai-zukan';

  const params = new URLSearchParams(location.search);
  let speed = 'normal';
  let game = null;
  let compiled = null;
  let state = null;
  let shownStats = null;
  let currentCard = null;
  let oneLinerCount = 0;
  let skipWait = null;

  // ---- 小さな道具 ----
  function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat(Infinity)) if (c != null && c !== false) e.append(c instanceof Node ? c : document.createTextNode(String(c)));
    return e;
  }
  const $ = (sel) => document.querySelector(sel);
  const feed = () => $('#feed');
  const pace = (k) => SPEEDS[speed][k];

  // 待つ。画面をタップすると先に進む
  function wait(ms) {
    return new Promise((resolve) => {
      const t = setTimeout(done, ms);
      function done() { clearTimeout(t); skipWait = null; resolve(); }
      skipWait = done;
    });
  }
  document.addEventListener('click', (e) => {
    if (skipWait && !e.target.closest('button, input, textarea, select, a, #debug, #warnings, #hud')) skipWait();
  });

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) { /* 保存できなくても遊べる */ }
    return null;
  }

  function show(id) {
    for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
  }

  function setSeason(name) {
    document.body.className = 'season-' + name;
  }

  function fxChips(deltas) {
    const keys = DL.STATS.filter((k) => deltas[k]);
    if (!keys.length) return null;
    return el('div', { class: 'fx' }, keys.map((k) => el('span', { class: deltas[k] > 0 ? 'up' : 'down' }, `${STAT_LABEL[k]} ${deltas[k] > 0 ? '+' : ''}${deltas[k]}`)));
  }

  function scrollTo(node, block) {
    requestAnimationFrame(() => node.scrollIntoView({ behavior: 'smooth', block: block || 'nearest' }));
  }

  // ---- 表の読み取りの注意（画面の隅とコンソール） ----
  const warned = new Set();
  function refreshWarnings() {
    const list = compiled ? compiled.warnings : [];
    const box = $('#warnings');
    box.hidden = !list.length;
    $('#warnings-count').textContent = `(${list.length})`;
    const ul = $('#warnings-list');
    ul.textContent = '';
    for (const w of list) {
      ul.append(el('li', { text: w }));
      if (!warned.has(w)) { warned.add(w); console.warn('[同窓会ライフ] ' + w); }
    }
  }

  // ---- 人生図鑑（遊んだ人のブラウザにだけ残る） ----
  function loadZukan() {
    try { return JSON.parse(store(ZUKAN_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function recordZukan(id, age, seed) {
    const z = loadZukan();
    if (!z[id]) {
      z[id] = { age, seed, count: 0 };
    }
    z[id].count++;
    store(ZUKAN_KEY, JSON.stringify(z));
    return z[id].count === 1;
  }

  // ---- 上部（年齢・景気・暮らし・数値） ----
  function buildHud() {
    const bars = $('#hud-bars');
    bars.textContent = '';
    for (const k of DL.STATS) {
      bars.append(el('div', { class: 'bar', 'data-stat': k },
        el('span', { class: 'name', text: STAT_LABEL[k] }),
        el('span', { class: 'track' }, el('span', { class: 'fill' })),
        el('span', { class: 'val' })));
    }
    $('#speed-select').value = speed;
  }

  function lifeLine(s) {
    const parts = [];
    if (s.career === '学生') parts.push(s.path === '大学' ? `大学生${s.faculty ? `（${s.faculty}）` : ''}` : '学生');
    else parts.push(s.jobLabel && s.jobLabel !== s.career ? `${s.jobLabel}（${s.career}）` : s.career);
    if (s.partner) parts.push(s.partner.status === '既婚' ? '既婚' : '交際中');
    else parts.push(s.flags.has('結婚経験') ? '一人（結婚経験あり）' : '独身');
    if (s.children.length) parts.push(`子${s.children.length}人`);
    parts.push(s.home === '持ち家' ? '持ち家' : s.home === '実家' ? '実家暮らし' : '賃貸');
    if (s.region === '移住先') parts.push('移住先');
    if (s.region === '海外') parts.push('海外');
    if (['父', '母'].some((w) => s.parents[w].state === '要介護')) parts.push('親の介護');
    return parts.join('・');
  }

  function updateHud() {
    if (!state) return;
    $('#hud-age').textContent = state.age;
    const ec = state.economy[state.age - 18];
    $('#hud-economy').textContent = '';
    $('#hud-economy').append('今年の景気：', el('b', { text: ec || '' }));
    $('#hud-life').textContent = lifeLine(state);
    for (const k of DL.STATS) {
      const row = document.querySelector(`.bar[data-stat="${k}"]`);
      const v = state.stats[k];
      row.querySelector('.fill').style.width = v + '%';
      row.querySelector('.fill').classList.toggle('low', v < 20);
      const val = row.querySelector('.val');
      val.firstChild ? (val.firstChild.nodeValue = v) : val.append(document.createTextNode(v));
      const d = shownStats ? v - shownStats[k] : 0;
      if (d) {
        for (const old of val.querySelectorAll('.delta')) old.remove();
        const chip = el('span', { class: 'delta ' + (d > 0 ? 'up' : 'down'), text: (d > 0 ? '+' : '') + d });
        val.append(chip);
        setTimeout(() => chip.remove(), 1700);
      }
    }
    shownStats = { ...state.stats };
  }

  // ---- 演出（立ち絵・カットイン）。絵がまだなくても動く ----
  // 絵のファイル名。assets フォルダにない絵は使わない（変換スクリプトが一覧を作る）
  let assetSet = new Set();
  function portraitSrc(who, expr) {
    const p = compiled.people[who];
    if (!p) return null;
    const age = state ? state.age : 18;
    const group = p.ages.filter((a) => a <= age).pop() || p.ages[0];
    const src = p.file.replace('{年代}', group).replace('{表情}', p.exprs[expr] || expr);
    if (assetSet.has(src)) return src;
    const plain = p.file.replace('{年代}', group).replace('{表情}', p.exprs['ふつう'] || 'normal'); // その表情がなければ「ふつう」
    return assetSet.has(plain) ? plain : null;
  }
  function portraitImg(who, expr, side) {
    const src = portraitSrc(who, expr);
    if (!src) return null;
    const img = el('img', { class: `portrait ${side === '左' ? 'left' : 'right'}`, src, alt: `${who}（${expr}）` });
    img.addEventListener('error', () => img.remove()); // 絵がまだないときは何も出さない
    return img;
  }
  function stageFor(staging) {
    const ps = (staging || []).filter((x) => x.kind === 'portrait');
    if (!ps.length) return null;
    return el('div', { class: 'stage' }, ps.map((p) => portraitImg(p.who, p.expr, p.side)));
  }
  async function cutIns(staging) {
    for (const c of (staging || []).filter((x) => x.kind === 'cutin')) {
      const box = $('#cutin');
      box.textContent = '';
      const img = c.who ? portraitImg(c.who, '真剣', '右') : null;
      box.append(el('div', { class: 'cutin-band' }, img, el('div', { class: 'cutin-line', text: c.line })));
      box.hidden = false;
      box.classList.remove('go');
      void box.offsetWidth;
      box.classList.add('go');
      await wait(pace('cutin'));
      box.hidden = true;
    }
  }

  // ---- 場面ごとの表示 ----
  async function showScene(scene) {
    updateHud();
    switch (scene.kind) {
      case 'birth': return showBirth(scene);
      case 'year': return showYear(scene);
      case 'oneliner': return showOneLiner(scene);
      case 'event': return showEvent(scene);
      case 'after': return showAfter(scene);
      case 'envelope': return showEnvelope(scene);
      case 'pick': return showPick(scene);
      case 'reunion': return showReunion(scene);
      case 'passing': return showPassing(scene);
      case 'ending': return showEnding(scene.ending);
      default: return undefined;
    }
  }

  function waitClick(button) {
    return new Promise((resolve) => button.addEventListener('click', resolve, { once: true }));
  }

  async function showBirth(scene) {
    setSeason('winter');
    const fx = { place: { 都市: '手応え+5', 地方: 'つながり+5' }, wealth: { ゆとり: 'お金+15 心の余白+5', きびしい: 'お金-15' }, parent: {} };
    const next = el('button', { class: 'next', type: 'button', text: '18歳の春へ' });
    const card = el('div', { class: 'card' },
      el('div', { class: 'kind fate', text: '生まれ ― 選べなかったこと' }),
      el('h2', { text: 'あなたが生まれたところ' }),
      el('dl', { class: 'reveal' }, Object.keys(BIRTH_LABEL).map((k) => [
        el('dt', { text: BIRTH_LABEL[k] }),
        el('dd', { text: scene.birth[k] + (fx[k][scene.birth[k]] ? `（${fx[k][scene.birth[k]]}）` : '') }),
      ])),
      el('p', { class: 'hint', text: '体質や出会い運、これからの景気、住む土地の災害の起きやすさは、まだ誰にもわからない。' }),
      next);
    feed().append(card);
    await waitClick(next);
    next.remove();
  }

  async function showYear(scene) {
    setSeason('winter');
    oneLinerCount = 0;
    const head = el('div', { class: 'year-head' }, el('b', { text: `${scene.age}歳` }), `1月　今年の景気：${scene.economy}`);
    feed().append(head);
    scrollTo(head);
    await wait(pace('step') * 0.7);
  }

  function rareBadge(rare) {
    if (!rare) return null;
    return el('div', { class: `rare-badge r${rare.rarity}` },
      el('span', { class: 'stars', text: STARS(rare.rarity) }),
      el('span', { text: `人生のくじ　一生で ${rare.lifetime}` }));
  }

  function noteRare(scene, node) {
    if (!scene.rare) return;
    const first = recordZukan(scene.id, state.age, state.seed);
    if (first) node.append(el('div', { class: 'zukan-new', text: '人生図鑑に新しく載りました' }));
  }

  async function showOneLiner(scene) {
    setSeason(oneLinerCount++ % 2 ? 'autumn' : 'summer');
    const p = el('p', { class: 'oneliner' + (scene.rare ? ' rare' : ''), 'data-id': scene.id }, rareBadge(scene.rare), scene.text, fxChips(scene.entry.deltas));
    feed().append(p);
    noteRare(scene, p);
    scrollTo(p);
    await cutIns(scene.staging);
    await wait(pace('step') * (scene.rare ? 2 : 1));
  }

  function choiceButton(c, i) {
    const [main, ...rest] = c.label.split('\n');
    return el('button', { class: 'choice', type: 'button', disabled: !c.enabled, 'data-index': i, title: c.enabled ? null : '今は選べません' },
      main, rest.length ? el('span', { class: 'sub', text: rest.join('\n') }) : null);
  }

  async function showEvent(scene) {
    setSeason('spring');
    const kind = scene.category === '転機' ? '転機' : scene.fate ? '運命' : '選択';
    const card = el('div', { class: 'card event' + (scene.rare ? ' rare' : '') + (kind === '転機' ? ' turning' : ''), 'data-id': scene.id },
      rareBadge(scene.rare),
      stageFor(scene.staging),
      el('div', { class: 'kind' + (scene.fate ? ' fate' : '') + (kind === '転機' ? ' turn' : ''), text: kind }),
      el('h2', { text: scene.title }),
      el('p', { class: 'text', text: scene.text }));
    currentCard = card;
    feed().append(card);
    noteRare(scene, card);
    scrollTo(card, 'start');
    await cutIns(scene.staging);
    if (!scene.choices.length) {
      const next = el('button', { class: 'next', type: 'button', text: '次へ' });
      card.append(next);
      await waitClick(next);
      next.remove();
      return undefined;
    }
    if (scene.fate) card.append(el('p', { class: 'fate-note', text: 'これは選べない出来事です。選べるのは、向き合い方だけ' }));
    const buttons = scene.choices.map(choiceButton);
    card.append(el('div', { class: 'choices' }, buttons));
    const index = await new Promise((resolve) => {
      buttons.forEach((b, i) => b.addEventListener('click', () => resolve(i)));
    });
    buttons.forEach((b, i) => {
      b.disabled = true;
      if (i === index) b.classList.add('chosen');
    });
    return index;
  }

  async function showAfter(scene) {
    const chips = fxChips(scene.entry.deltas);
    if (currentCard && chips) currentCard.append(chips);
    await wait(pace('step') * 0.8);
  }

  async function showEnvelope(scene) {
    const result = el('div', { class: 'result' });
    const card = el('div', { class: 'card envelope' },
      el('div', { class: 'label', text: scene.title }),
      el('div', { class: 'paper' }),
      result);
    feed().append(card);
    scrollTo(card);
    await wait(pace('envelope')); // 一拍おく
    card.classList.add('open');
    await new Promise((r) => setTimeout(r, 450));
    result.textContent = scene.result;
    if (scene.good === true) result.classList.add('good');
    if (scene.good === false) result.classList.add('bad');
    await wait(pace('step'));
  }

  async function showPick(scene) {
    setSeason('spring');
    const step = el('p', { class: 'pick-step' });
    const box = el('div', { class: 'choices' });
    const card = el('div', { class: 'card pick' },
      el('div', { class: 'kind', text: '選択' }),
      el('h2', { text: scene.title }),
      el('p', { class: 'hint', text: `今年あなたに届いた求人です（実際の就職先の割合で届きます）。今年の景気：${scene.economy}。合否は、運が決める。` }),
      step, box);
    feed().append(card);
    scrollTo(card, 'start');
    const picked = [];
    for (const label of ['第一志望', '第二志望']) {
      step.textContent = `${label}を選んでください`;
      box.textContent = '';
      const buttons = scene.options.map((o) => el('button', {
        class: 'choice', type: 'button', 'data-name': o.name,
        disabled: !o.enabled || picked.includes(o.name),
      }, o.name, o.note ? el('span', { class: 'sub', text: o.note }) : null));
      box.append(...buttons);
      const name = await new Promise((resolve) => buttons.forEach((b) => b.addEventListener('click', () => resolve(b.dataset.name))));
      picked.push(name);
    }
    step.textContent = `第一志望：${picked[0]}　第二志望：${picked[1]}`;
    box.remove();
    return picked;
  }

  // 亡くなったあと：同級生たちの時間だけが進む
  async function showPassing(scene) {
    setSeason('winter');
    $('#hud').hidden = true;
    const next = el('button', { class: 'next', type: 'button', text: '同窓会へ' });
    const card = el('div', { class: 'card passing' },
      el('p', { class: 'text', text: scene.years > 0 ? `それから、${scene.years}年が過ぎた。\n同級生たちは、六十五歳になった。` : 'その冬、同級生たちは集まることにした。' }),
      next);
    feed().append(card);
    scrollTo(card, 'start');
    await waitClick(next);
    next.remove();
  }

  async function showReunion(scene) {
    setSeason('winter');
    const screen = $('#reunion-screen');
    screen.textContent = '';
    const lines = el('div', { class: 'reunion-lines' });
    const title = scene.age >= 65 ? `― ${scene.age}歳、最後の同窓会 ―` : `― ${scene.age}歳の同窓会 ―`;
    screen.append(el('div', { class: 'reunion-title', text: title }), lines, el('p', { class: 'tap-hint', text: '画面をタップすると先に進みます' }));
    show('reunion-screen');
    window.scrollTo(0, 0);
    // 一文ずつ（本文の改行ごとに）ゆっくり出す
    async function say(text, gap, staging) {
      let first = true;
      const st = stageFor(staging);
      if (st && text) lines.append(st);
      for (const line of String(text).split('\n')) {
        if (!line.trim()) continue;
        const p = el('p', { class: first && gap ? 'gap' : null, text: line });
        lines.append(p);
        scrollTo(p);
        first = false;
        await wait(pace('line'));
      }
    }
    await say(scene.intro);
    await say(scene.you, true);
    for (let i = 0; i < scene.classmates.length; i++) await say(scene.classmates[i], true, scene.stagings && scene.stagings[i]);
    const roster = el('div', { class: 'roster' },
      el('h3', { text: '名簿' }),
      el('dl', {}, scene.roster.map((r) => [
        el('dt', { class: (r.you ? 'you' : '') + (r.gone ? ' gone' : ''), text: r.name }),
        el('dd', { class: r.gone ? 'gone' : null }, el('span', { class: 'job', text: r.job || '―' }), el('span', { class: 'note', text: r.note || '' })),
      ])));
    lines.append(roster);
    scrollTo(roster);
    await wait(pace('line') * 2);
    await say(scene.close, true);
    const last = scene.age >= 65;
    const next = el('button', { class: 'next', type: 'button', text: last ? '振り返る' : '一年を続ける' });
    lines.append(next);
    scrollTo(next);
    await waitClick(next);
    if (!last) {
      feed().append(el('p', { class: 'oneliner', text: `${scene.age}歳の同窓会に行った。「とり善」の二階。` }));
      show('play-screen');
      scrollTo(feed().lastChild);
    }
  }

  // ---- 振り返り ----
  function section(no, title, ...children) {
    return el('section', { class: 'end-sec', 'data-section': no }, el('h2', {}, el('span', { class: 'no', text: no }), title), ...children);
  }
  const sign = (n) => (n > 0 ? '+' : '') + n;

  function deltaText(d) {
    return DL.STATS.filter((k) => d[k]).map((k) => `${STAT_LABEL[k]}${d[k] > 0 ? '+' : ''}${d[k]}`).join(' ');
  }

  function lineChart(series) {
    const W = 340, H = 220, L = 26, R = 86, T = 10, B = 22;
    const x0 = series[0].age, x1 = series[series.length - 1].age;
    const X = (a) => L + ((a - x0) / Math.max(1, x1 - x0)) * (W - L - R);
    const Y = (v) => T + (1 - v / 100) * (H - T - B);
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    const s = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `5つの数値の移り変わり（18歳の前から${x1}歳まで）`);
    for (const v of [0, 25, 50, 75, 100]) {
      svg.append(s('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: 'grid' }));
      if (v % 50 === 0) { const t = s('text', { x: L - 4, y: Y(v) + 3, 'text-anchor': 'end', class: 'axis-label' }); t.textContent = v; svg.append(t); }
    }
    const ticks = [x0, ...[20, 30, 40, 50, 60].filter((a) => a > x0 + 2 && a < x1 - 2), x1];
    for (const a of ticks) {
      const t = s('text', { x: X(a), y: H - 6, 'text-anchor': 'middle', class: 'axis-label' });
      t.textContent = a === x0 ? '始' : a + '歳';
      svg.append(t);
    }
    for (const k of DL.STATS) {
      const d = series.map((p, i) => `${i ? 'L' : 'M'}${X(p.age).toFixed(1)},${Y(p.stats[k]).toFixed(1)}`).join('');
      svg.append(s('path', { d, fill: 'none', stroke: SERIES_COLOR[k], 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    }
    // 線の終わりに名前と値（重ならないように少しずらす）
    const last = series[series.length - 1].stats;
    const ends = DL.STATS.map((k) => ({ k, y: Y(last[k]) })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 11) ends[i].y = ends[i - 1].y + 11;
    const over = ends[ends.length - 1].y - (H - B);
    if (over > 0) ends.forEach((e) => { e.y -= over; });
    for (const e of ends) {
      svg.append(s('line', { x1: W - R + 4, x2: W - R + 12, y1: e.y, y2: e.y, stroke: SERIES_COLOR[e.k], 'stroke-width': 2 }));
      const t = s('text', { x: W - R + 15, y: e.y + 3, class: 'end-label' });
      t.textContent = `${STAT_LABEL[e.k]} ${last[e.k]}`;
      svg.append(t);
    }
    // なぞると、その年の値を出す
    const cross = s('line', { y1: T, y2: H - B, class: 'cross', visibility: 'hidden' });
    svg.append(cross);
    const hit = s('rect', { x: L, y: 0, width: W - L - R, height: H, fill: 'transparent' });
    svg.append(hit);
    const wrap = el('div', { class: 'chart-wrap' }, svg);
    const tip = el('div', { class: 'chart-tip', hidden: true });
    wrap.append(tip);
    function move(ev) {
      const box = svg.getBoundingClientRect();
      const px = ((ev.clientX - box.left) / box.width) * W;
      let best = series[0];
      for (const p of series) if (Math.abs(X(p.age) - px) < Math.abs(X(best.age) - px)) best = p;
      cross.setAttribute('x1', X(best.age)); cross.setAttribute('x2', X(best.age));
      cross.setAttribute('visibility', 'visible');
      tip.hidden = false;
      tip.textContent = '';
      tip.append(el('div', {}, el('b', { text: best.age === x0 ? 'はじめ' : `${best.age}歳` })));
      for (const k of [...DL.STATS].sort((a, b) => best.stats[b] - best.stats[a])) {
        const dot = el('i');
        dot.style.background = SERIES_COLOR[k];
        tip.append(el('div', {}, dot, `${STAT_LABEL[k]} ${best.stats[k]}`));
      }
      const left = (X(best.age) / W) * box.width;
      tip.style.left = Math.min(Math.max(left + 10, 0), box.width - 120) + 'px';
      tip.style.top = '4px';
    }
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerdown', move);
    hit.addEventListener('pointerleave', () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); });

    const legend = el('div', { class: 'chart-legend' }, DL.STATS.map((k) => {
      const i = el('i'); i.style.background = SERIES_COLOR[k];
      return el('span', {}, i, STAT_LABEL[k]);
    }));
    const table = el('details', { class: 'table-view' }, el('summary', { text: '表で見る' }),
      el('div', { class: 'table-scroll' }, el('table', {},
        el('tr', {}, el('th', { text: '年齢' }), DL.STATS.map((k) => el('th', { text: STAT_LABEL[k] }))),
        series.map((p) => el('tr', {}, el('td', { text: p.age === x0 ? 'はじめ' : `${p.age}歳` }), DL.STATS.map((k) => el('td', { text: p.stats[k] })))))));
    return el('div', {}, legend, wrap, table);
  }

  // 年表：何も起きなかった年が続くところは、1行にまとめる
  function timelineRows(timeline) {
    const out = [];
    for (const y of timeline) {
      const prev = out[out.length - 1];
      if (!y.items.length && prev && prev.quiet) { prev.to = y.age; continue; }
      out.push({ ...y, quiet: !y.items.length, from: y.age, to: y.age });
    }
    return out;
  }
  const itemTitle = (it) => (it.category === '転機' ? `【転機】${it.title}` : it.category === 'くじ' ? `【くじ】${it.title}` : it.title);

  async function showEnding(e) {
    $('#hud').hidden = true;
    setSeason('winter');
    const screen = $('#ending-screen');
    screen.textContent = '';
    // ページを読み込み直さずに始め直す（公開ページではアドレスの ?seed= が使えないため）
    const restart = (seed) => {
      if (seed) { start(seed); return; }
      $('#seed-input').value = DL.randomSeed();
      show('title-screen');
      window.scrollTo(0, 0);
    };
    const share = el('textarea', { class: 'share-text', rows: 3, readonly: true, id: 'share-text' });
    share.value = e.share;
    const copyBtn = el('button', { class: 'next', type: 'button', text: 'コピーする' });
    copyBtn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(e.share); copyBtn.textContent = 'コピーしました'; } catch (err) { share.select(); copyBtn.textContent = '選択しました。コピーしてください'; }
    });
    const companies = e.hidden.companies.length
      ? e.hidden.companies.map((c) => `${c.age}歳 ${c.label && c.label !== c.career ? `${c.label}（${c.career}）` : c.career}：${c.fortune}`).join('\n')
      : '（会社に勤めなかった）';
    const hp = e.hidden.partner;

    screen.append(...[
      el('h1', { text: '振り返り' }),
      e.deathAge ? el('p', { class: 'death-line', text: `あなたの人生は、${e.deathAge}歳で終わりました。` }) : null,
      section('1', '年表',
        el('ol', { class: 'timeline' }, timelineRows(e.timeline).map((y) => el('li', {},
          el('span', { text: y.from === y.to ? `${y.from}歳` : `${y.from}〜${y.to}` }),
          el('span', { class: 'ec', text: y.from === y.to ? y.economy : '' }),
          el('span', { class: 'ev' }, y.quiet ? el('span', { class: 'hint', text: y.from === y.to ? '静かな一年' : '静かな年が続いた' }) : y.items.map((it, i) => [
            i ? '／' : '', itemTitle(it), it.choice ? `（${it.choice}）` : '',
            it.notes.length ? el('small', { text: it.notes.join('　') }) : null,
          ])))))),
      section('2', '数値の移り変わり', lineChart(e.series)),
      section('3', '人生を動かした出来事 TOP5',
        e.top5.length ? el('ol', { class: 'top5' }, e.top5.map((t) => el('li', {},
          el('span', { class: 'tag ' + ({ 運命: 'fate', 選択: 'choice', 転機: 'turn', くじ: 'rare' }[t.label] || 'choice'), text: `【${t.label}】` }),
          `${t.age}歳「${t.title}」`, t.choice ? ` ― ${t.choice}` : '',
          el('div', { class: 'hint', text: deltaText(t.deltas) })))) : el('p', { text: '大きく人生を動かした出来事はなかった。' })),
      section('4', '最初から決まっていたこと',
        el('dl', { class: 'reveal' },
          el('dt', { text: '生まれ' }), el('dd', { text: `${e.hidden.birth.place}・家庭は${e.hidden.birth.wealth}・親の年齢は${e.hidden.birth.parent}` }),
          el('dt', { text: '体質' }), el('dd', { text: e.hidden.body }),
          el('dt', { text: '出会い運' }), el('dd', { text: e.hidden.love }),
          el('dt', { text: '土地の災害の起きやすさ' }), el('dd', { text: e.hidden.disaster }),
          hp ? [el('dt', { text: 'パートナーとの相性' }), el('dd', { text: `${hp.fit}（家事・育児の分担：${hp.share}）。出会いは${hp.meet}` })] : null,
          el('dt', { text: '景気の並び' }), el('dd', {}, el('div', { class: 'econ-row' }, e.hidden.economy.map((x, i) => el('span', { class: x }, el('small', { text: `${18 + i}` }), x)))),
          el('dt', { text: '会社の運命' }), el('dd', { style: 'white-space:pre-wrap', text: companies }),
          el('dt', { text: '同級生' }), el('dd', {}, e.hidden.classmates.map((c) => el('div', { text: `${c.name}：${c.key}「${c.title}」${c.died != null ? `（${c.died}歳で亡くなる運命だった）` : ''}` }))))),
      section('5', 'あなたが選んだこと／選べなかったこと',
        el('p', { text: `あなたが選んだのは${e.chosen}回。選べなかったのは${e.unchosen}回。` }),
        el('p', {}, '運命の割合 ', el('span', { class: 'big-number', text: `${e.fatePercent}％` })),
        el('p', { class: 'hint', text: '大きな出来事による数値の変化のうち、「運命」の出来事によるものの割合' })),
      section('6', '人生の形', el('p', { class: 'shape', text: `『${e.shape}』` }),
        el('p', { class: 'hint', text: `ふつうの人生と比べて、いちばん伸びた数値：${STAT_LABEL[e.shapeStat]}（${sign(e.shapeGrowth)}。ふつうは${sign(Math.round(e.shapeTypical))}）。順位ではなく、形です。` })),
      section('7', '運命の番号', el('div', { class: 'seed-number', text: e.seed }),
        el('p', { class: 'hint', text: 'この番号を入れると、同じ運命で遊べます。' }),
        el('div', { class: 'row' },
          el('button', { class: 'next', type: 'button', onclick: () => restart(e.seed), text: '同じ運命で、もう一度' }),
          el('button', { class: 'next', type: 'button', onclick: () => restart(null), text: '新しい運命で' })),
        el('p', { class: 'hint', text: `リンクの最後に #${e.seed} を付けて送ると、相手の画面にこの番号が入った状態で始まります。` })),
      section('8', 'シェア用の文章', share, copyBtn),
      section('9', 'この人生で引いた、人生のくじ',
        e.rareHits.length
          ? el('ul', { class: 'rare-list' }, e.rareHits.map((r) => el('li', {}, el('span', { class: `stars r${r.rarity}`, text: STARS(r.rarity) }), ` ${r.age}歳「${r.title}」`, el('small', { text: `一生で ${r.lifetime}` }))))
          : el('p', { text: 'めったにない出来事は、この人生では起きなかった。それもまた、よくあることです。' }),
        el('button', { class: 'next', type: 'button', onclick: showZukan, text: '人生図鑑を見る' })),
    ].filter(Boolean));
    show('ending-screen');
    window.scrollTo(0, 0);
  }

  // ---- 人生図鑑 ----
  function showZukan() {
    const screen = $('#zukan-screen');
    screen.textContent = '';
    const z = loadZukan();
    const all = compiled.rare;
    const found = all.filter((r) => z[r.id]).length;
    const groups = [];
    for (const r of all) {
      let g = groups.find((x) => x.name === r.group);
      if (!g) groups.push((g = { name: r.group, items: [] }));
      g.items.push(r);
    }
    const prev = ([...document.querySelectorAll('.screen')].find((x) => !x.hidden) || {}).id || 'title-screen';
    const back = el('button', { class: 'next', type: 'button', text: '戻る', onclick: () => { show(prev === 'zukan-screen' ? 'title-screen' : prev); window.scrollTo(0, 0); } });
    screen.append(
      el('h1', { text: '人生図鑑' }),
      el('p', { class: 'zukan-count', text: `${all.length}種類中 ${found}種類` }),
      el('p', { class: 'hint', text: 'これまでの人生で引いた、めったにない出来事。記録はこのブラウザにだけ残ります。確率は現実の統計（多くは推計）です。' }),
      ...groups.map((g) => el('section', { class: 'zukan-group' },
        el('h2', { text: g.name || 'そのほか' }),
        el('div', { class: 'zukan-grid' }, g.items.map((r) => {
          const hit = z[r.id];
          return el('div', { class: 'zukan-card' + (hit ? ' hit' : '') },
            el('div', { class: `stars r${r.rarity}`, text: STARS(r.rarity) }),
            el('div', { class: 'z-title', text: hit ? r.title : '？？？' }),
            el('div', { class: 'z-odds', text: `一生で ${r.lifetime}` }),
            hit ? el('div', { class: 'z-when', text: `${hit.age}歳（運命の番号 ${hit.seed}）${hit.count > 1 ? `・${hit.count}回` : ''}` }) : null);
        })))),
      back);
    show('zukan-screen');
    window.scrollTo(0, 0);
  }

  // ---- 進行 ----
  let running = 0;
  async function start(seed) {
    const my = ++running;
    state = game.newLife(seed);
    shownStats = null;
    feed().textContent = '';
    buildHud();
    $('#hud').hidden = false;
    show('play-screen');
    const gen = game.play(state);
    let answer;
    for (;;) {
      if (my !== running) return; // 始め直したら、前の人生は止める
      const r = gen.next(answer);
      refreshWarnings();
      if (r.done) break;
      answer = await showScene(r.value);
    }
  }

  function buildDebug() {
    const box = $('#debug');
    box.hidden = false;
    const inputs = {};
    box.append(el('button', { type: 'button', text: '確認用パネル（開く／閉じる）', onclick: () => box.classList.toggle('closed') }));
    for (const k of DL.STATS) {
      inputs[k] = el('input', { type: 'number', min: 0, max: 100 });
      box.append(el('div', { class: 'r' }, el('span', { style: 'width:5em', text: STAT_LABEL[k] }), inputs[k]));
    }
    box.append(el('button', { type: 'button', text: '数値を反映', onclick: () => {
      for (const k of DL.STATS) if (inputs[k].value !== '') api.setStat(k, Number(inputs[k].value));
    } }));
    const ev = el('input', { placeholder: 'E006', style: 'width:5em' });
    box.append(el('div', { class: 'r' }, ev, el('button', { type: 'button', text: '次に起こす', onclick: () => api.force(ev.value.trim()) })));
  }

  // 確認用（ブラウザのコンソールやテストから使う）
  const api = {
    get state() { return state; },
    get warnings() { return compiled ? compiled.warnings.slice() : []; },
    setStat(k, v) { if (state) { state.stats[k] = Math.max(0, Math.min(100, v)); updateHud(); } },
    force(id) { if (state && id) state.forceQueue.push(id); },
    setSpeed(s) { if (SPEEDS[s]) { speed = s; buildHud(); } },
    showZukan: () => showZukan(),
  };
  window.__dosokai = api;

  function init() {
    if (!window.GAME_DATA) {
      $('#title-screen').append(el('p', { class: 'hint', style: 'color:var(--bad)', text: 'data/events.js が見つかりません。python3 tools/convert.py を実行してください。' }));
      return;
    }
    setSeason('winter');
    compiled = DL.compileData(window.GAME_DATA);
    game = DL.createGame(compiled);
    assetSet = new Set(window.GAME_DATA.assets || []);
    refreshWarnings();
    $('#warnings-toggle').addEventListener('click', () => $('#warnings').classList.toggle('closed'));

    const sel = $('#speed-select');
    for (const [k, v] of Object.entries(SPEEDS)) sel.append(el('option', { value: k, text: v.label }));
    const saved = store('dosokai-speed');
    speed = SPEEDS[saved] ? saved : 'normal';
    if (SPEEDS[params.get('speed')]) speed = params.get('speed');
    sel.value = speed;
    sel.addEventListener('change', () => { speed = sel.value; store('dosokai-speed', speed); });

    const input = $('#seed-input');
    // 運命の番号は #123456（公開ページ用）か ?seed=123456（手元で開くとき）で渡せる
    const given = [location.hash.slice(1), params.get('seed') || ''].find((x) => /^\d{6}$/.test(x));
    input.value = given || DL.randomSeed();
    $('#start-form').addEventListener('submit', (ev) => {
      ev.preventDefault();
      if (!/^\d{6}$/.test(input.value)) { input.focus(); return; }
      start(input.value);
    });
    $('#zukan-open').addEventListener('click', showZukan);
    if (params.get('debug')) buildDebug();
  }

  init();
})();
