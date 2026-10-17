// 画面。engine.js の play() が返す場面を、1つずつ表示する。
(function () {
  'use strict';
  const DL = window.DL;

  const SPEEDS = {
    slow: { step: 2600, line: 2400, envelope: 1700 },
    normal: { step: 1400, line: 1500, envelope: 1100 },
    fast: { step: 450, line: 600, envelope: 500 },
  };
  const STAT_LABEL = { お金: 'お金', 健康: '健康', 手応え: '手応え', つながり: 'つながり', 余白: '心の余白' };
  const SERIES_COLOR = { お金: 'var(--series-1)', 健康: 'var(--series-2)', 手応え: 'var(--series-3)', つながり: 'var(--series-4)', 余白: 'var(--series-5)' };
  const BIRTH_LABEL = { place: '育った場所', wealth: '家庭のゆとり', parent: '親の年齢' };

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
    for (const c of children.flat(Infinity)) if (c != null) e.append(c instanceof Node ? c : document.createTextNode(String(c)));
    return e;
  }
  const $ = (sel) => document.querySelector(sel);
  const feed = () => $('#feed');

  // 待つ。画面をタップすると先に進む
  function wait(ms) {
    return new Promise((resolve) => {
      const t = setTimeout(done, ms);
      function done() { clearTimeout(t); skipWait = null; resolve(); }
      skipWait = done;
    });
  }
  document.addEventListener('click', (e) => {
    if (skipWait && !e.target.closest('button, input, textarea, a, #debug, #warnings, #hud')) skipWait();
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

  // ---- 上部の数値 ----
  function buildHud() {
    const bars = $('#hud-bars');
    bars.textContent = '';
    for (const k of DL.STATS) {
      bars.append(el('div', { class: 'bar', 'data-stat': k },
        el('span', { class: 'name', text: STAT_LABEL[k] }),
        el('span', { class: 'track' }, el('span', { class: 'fill' })),
        el('span', { class: 'val' })));
    }
    for (const b of document.querySelectorAll('.speed button')) {
      b.classList.toggle('on', b.dataset.speed === speed);
    }
  }

  function updateHud() {
    if (!state) return;
    $('#hud-age').textContent = state.age;
    const ec = state.economy[state.age - 18];
    $('#hud-economy').innerHTML = '';
    $('#hud-economy').append('今年の景気：', el('b', { text: ec }));
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
      el('p', { class: 'hint', text: '体質や出会い運、これからの景気は、まだ誰にもわからない。' }),
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
    await wait(SPEEDS[speed].step * 0.7);
  }

  async function showOneLiner(scene) {
    setSeason(oneLinerCount++ % 2 ? 'autumn' : 'summer');
    const p = el('p', { class: 'oneliner', 'data-id': scene.id }, scene.text, fxChips(scene.entry.deltas));
    feed().append(p);
    scrollTo(p);
    await wait(SPEEDS[speed].step);
  }

  function choiceButton(c, i) {
    const [main, ...rest] = c.label.split('\n');
    return el('button', { class: 'choice', type: 'button', disabled: !c.enabled, 'data-index': i, title: c.enabled ? null : '今は選べません' },
      main, rest.length ? el('span', { class: 'sub', text: rest.join('\n') }) : null);
  }

  async function showEvent(scene) {
    setSeason('spring');
    const card = el('div', { class: 'card event', 'data-id': scene.id },
      el('div', { class: 'kind' + (scene.fate ? ' fate' : ''), text: scene.fate ? '運命' : '選択' }),
      el('h2', { text: scene.title }),
      el('p', { class: 'text', text: scene.text }));
    currentCard = card;
    feed().append(card);
    scrollTo(card, 'start');
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
    await wait(SPEEDS[speed].step * 0.8);
  }

  async function showEnvelope(scene) {
    const result = el('div', { class: 'result' });
    const card = el('div', { class: 'card envelope' },
      el('div', { class: 'label', text: scene.title }),
      el('div', { class: 'paper' }),
      result);
    feed().append(card);
    scrollTo(card);
    await wait(SPEEDS[speed].envelope); // 一拍おく
    card.classList.add('open');
    await new Promise((r) => setTimeout(r, 450));
    result.textContent = scene.result;
    if (scene.good === true) result.classList.add('good');
    if (scene.good === false) result.classList.add('bad');
    await wait(SPEEDS[speed].step);
  }

  async function showPick(scene) {
    setSeason('spring');
    const step = el('p', { class: 'pick-step' });
    const box = el('div', { class: 'choices' });
    const card = el('div', { class: 'card pick' },
      el('div', { class: 'kind', text: '選択' }),
      el('h2', { text: scene.title }),
      el('p', { class: 'hint', text: `今年の景気：${scene.economy}。合否は、運が決める。` }),
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

  async function showReunion(scene) {
    setSeason('winter');
    const screen = $('#reunion-screen');
    screen.textContent = '';
    const lines = el('div', { class: 'reunion-lines' });
    screen.append(el('div', { class: 'reunion-title', text: `― ${scene.age}歳の同窓会 ―` }), lines, el('p', { class: 'tap-hint', text: '画面をタップすると先に進みます' }));
    show('reunion-screen');
    window.scrollTo(0, 0);
    const pace = () => SPEEDS[speed].line;
    // 一文ずつ（本文の改行ごとに）ゆっくり出す
    async function say(text, gap) {
      let first = true;
      for (const line of String(text).split('\n')) {
        if (!line.trim()) continue;
        const p = el('p', { class: first && gap ? 'gap' : null, text: line });
        lines.append(p);
        scrollTo(p);
        first = false;
        await wait(pace());
      }
    }
    await say(scene.intro);
    await say(scene.you, true);
    for (const t of scene.classmates) await say(t, true);
    const roster = el('div', { class: 'roster' },
      el('h3', { text: '名簿' }),
      el('dl', {}, scene.roster.map((r) => [
        el('dt', { class: r.you ? 'you' : null, text: r.name }),
        el('dd', {}, el('span', { class: 'job', text: r.job || '―' }), el('span', { class: 'note', text: r.note || '' })),
      ])));
    lines.append(roster);
    scrollTo(roster);
    await wait(pace() * 2);
    await say(scene.close, true);
    const next = el('button', { class: 'next', type: 'button', text: scene.age >= 35 ? '店を出る' : '一年を続ける' });
    lines.append(next);
    scrollTo(next);
    await waitClick(next);
    feed().append(el('p', { class: 'oneliner', text: `${scene.age}歳の同窓会に行った。「とり善」の二階。` }));
    show('play-screen');
    scrollTo(feed().lastChild);
  }

  // ---- 振り返り ----
  function section(no, title, ...children) {
    return el('section', { class: 'end-sec', 'data-section': no }, el('h2', {}, el('span', { class: 'no', text: no }), title), ...children);
  }

  function deltaText(d) {
    return DL.STATS.filter((k) => d[k]).map((k) => `${STAT_LABEL[k]}${d[k] > 0 ? '+' : ''}${d[k]}`).join(' ');
  }

  function lineChart(series) {
    const W = 340, H = 220, L = 26, R = 86, T = 10, B = 22;
    const x0 = series[0].age, x1 = series[series.length - 1].age;
    const X = (a) => L + ((a - x0) / (x1 - x0)) * (W - L - R);
    const Y = (v) => T + (1 - v / 100) * (H - T - B);
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    const s = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', '5つの数値の移り変わり（18歳の前から35歳まで）');
    for (const v of [0, 25, 50, 75, 100]) {
      svg.append(s('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: 'grid' }));
      if (v % 50 === 0) { const t = s('text', { x: L - 4, y: Y(v) + 3, 'text-anchor': 'end', class: 'axis-label' }); t.textContent = v; svg.append(t); }
    }
    for (const a of [x0, 20, 25, 30, 35]) {
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
      el('table', {},
        el('tr', {}, el('th', { text: '年齢' }), DL.STATS.map((k) => el('th', { text: STAT_LABEL[k] }))),
        series.map((p) => el('tr', {}, el('td', { text: p.age === x0 ? 'はじめ' : `${p.age}歳` }), DL.STATS.map((k) => el('td', { text: p.stats[k] }))))));
    return el('div', {}, legend, wrap, table);
  }

  async function showEnding(e) {
    $('#hud').hidden = true;
    setSeason('winter');
    const screen = $('#ending-screen');
    screen.textContent = '';
    const restart = (seed) => {
      const p = new URLSearchParams(location.search);
      if (seed) p.set('seed', seed); else p.delete('seed');
      p.set('go', '1');
      location.search = p.toString();
    };
    const share = el('textarea', { class: 'share-text', rows: 3, readonly: true });
    share.value = e.share;
    const copyBtn = el('button', { class: 'next', type: 'button', text: 'コピーする' });
    copyBtn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(e.share); copyBtn.textContent = 'コピーしました'; } catch (err) { share.select(); copyBtn.textContent = '選択しました。コピーしてください'; }
    });
    const companies = e.hidden.companies.length
      ? e.hidden.companies.map((c) => `${c.age}歳 ${c.career}：${c.fortune}`).join('\n')
      : '（会社に勤めなかった）';

    screen.append(
      el('h1', { text: '振り返り' }),
      section('1', '年表',
        el('ol', { class: 'timeline' }, e.timeline.map((y) => el('li', {},
          el('span', { text: `${y.age}歳` }),
          el('span', { class: 'ec', text: y.economy }),
          el('span', { class: 'ev' }, y.items.length ? y.items.map((it, i) => [
            i ? '／' : '', it.title, it.choice ? `（${it.choice}）` : '',
            it.notes.length ? el('small', { text: it.notes.join('　') }) : null,
          ]) : el('span', { class: 'hint', text: '静かな一年' })))))),
      section('2', '数値の移り変わり', lineChart(e.series)),
      section('3', '人生を動かした出来事 TOP5',
        e.top5.length ? el('ol', { class: 'top5' }, e.top5.map((t) => el('li', {},
          el('span', { class: 'tag ' + (t.type === '運命' ? 'fate' : 'choice'), text: `【${t.type}】` }),
          `${t.age}歳「${t.title}」`, t.choice ? ` ― ${t.choice}` : '',
          el('div', { class: 'hint', text: deltaText(t.deltas) })))) : el('p', { text: '大きく人生を動かした出来事はなかった。' })),
      section('4', '最初から決まっていたこと',
        el('dl', { class: 'reveal' },
          el('dt', { text: '生まれ' }), el('dd', { text: `${e.hidden.birth.place}・家庭は${e.hidden.birth.wealth}・親の年齢は${e.hidden.birth.parent}` }),
          el('dt', { text: '体質' }), el('dd', { text: e.hidden.body }),
          el('dt', { text: '出会い運' }), el('dd', { text: e.hidden.love }),
          el('dt', { text: '景気の並び' }), el('dd', {}, el('div', { class: 'econ-row' }, e.hidden.economy.map((x, i) => el('span', { class: x }, el('small', { text: `${18 + i}` }), x)))),
          el('dt', { text: '会社の運命' }), el('dd', { style: 'white-space:pre-wrap', text: companies }),
          el('dt', { text: '同級生' }), el('dd', {}, e.hidden.classmates.map((c) => el('div', { text: `${c.name}：${c.key}「${c.title}」` }))))),
      section('5', 'あなたが選んだこと／選べなかったこと',
        el('p', { text: `あなたが選んだのは${e.chosen}回。選べなかったのは${e.unchosen}回。` }),
        el('p', {}, '運命の割合 ', el('span', { class: 'big-number', text: `${e.fatePercent}％` })),
        el('p', { class: 'hint', text: '大きな出来事による数値の変化のうち、「運命」の出来事によるものの割合' })),
      section('6', '人生の形', el('p', { class: 'shape', text: `『${e.shape}』` }),
        el('p', { class: 'hint', text: `いちばん伸びた数値：${STAT_LABEL[e.growth[0][0]]}（${e.growth[0][1] >= 0 ? '+' : ''}${e.growth[0][1]}）。順位ではなく、形です。` })),
      section('7', '運命の番号', el('div', { class: 'seed-number', text: e.seed }),
        el('p', { class: 'hint', text: 'この番号を入れると、同じ運命で遊べます。' }),
        el('div', { class: 'row' },
          el('button', { class: 'next', type: 'button', onclick: () => restart(e.seed), text: '同じ運命で、もう一度' }),
          el('button', { class: 'next', type: 'button', onclick: () => restart(null), text: '新しい運命で' }))),
      section('8', 'シェア用の文章', share, copyBtn),
    );
    show('ending-screen');
    window.scrollTo(0, 0);
  }

  // ---- 進行 ----
  async function start(seed) {
    state = game.newLife(seed);
    shownStats = null;
    feed().textContent = '';
    buildHud();
    $('#hud').hidden = false;
    show('play-screen');
    const gen = game.play(state);
    let answer;
    for (;;) {
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
  };
  window.__dosokai = api;

  function init() {
    if (!window.GAME_DATA) {
      $('#title-screen').append(el('p', { class: 'hint', style: 'color:var(--bad)', text: 'data/events.js が見つかりません。python3 tools/convert.py を実行してください。' }));
      return;
    }
    compiled = DL.compileData(window.GAME_DATA);
    game = DL.createGame(compiled);
    refreshWarnings();
    $('#warnings-toggle').addEventListener('click', () => $('#warnings').classList.toggle('closed'));

    speed = SPEEDS[store('dosokai-speed')] ? store('dosokai-speed') : 'normal';
    if (SPEEDS[params.get('speed')]) speed = params.get('speed');
    for (const b of document.querySelectorAll('.speed button')) {
      b.addEventListener('click', () => { speed = b.dataset.speed; store('dosokai-speed', speed); buildHud(); updateHud(); });
    }
    const input = $('#seed-input');
    input.value = /^\d{6}$/.test(params.get('seed') || '') ? params.get('seed') : DL.randomSeed();
    $('#start-form').addEventListener('submit', (ev) => {
      ev.preventDefault();
      if (!/^\d{6}$/.test(input.value)) { input.focus(); return; }
      start(input.value);
    });
    if (params.get('debug')) buildDebug();
    if (params.get('go') && /^\d{6}$/.test(params.get('seed') || '')) start(params.get('seed'));
  }

  init();
})();
