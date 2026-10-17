// シード付き乱数。運命の番号（6桁）と「流れの名前」から、互いに独立した乱数列を作る。
// 生まれ・隠れた運命・景気は "fate"、毎年のサイコロは "year:21" のように年ごとに別の流れにする。
// こうすると、ある年の選択で乱数の消費が変わっても、ほかの年や隠れた運命には影響しない。
(function (DL) {
  'use strict';

  function hashString(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeRng(seed, stream) {
    const next = mulberry32(hashString(String(seed) + '/' + stream));
    for (let i = 0; i < 4; i++) next(); // 立ち上がりの偏りを捨てる
    return {
      next,
      chance(p) { return next() < p; },
      int(n) { return Math.floor(next() * n); },
      pick(list) { return list[Math.floor(next() * list.length)]; },
      // [[値, 重み], ...] から重みつきで1つ選ぶ
      weighted(pairs) {
        const total = pairs.reduce((s, p) => s + p[1], 0);
        let r = next() * total;
        for (const [v, w] of pairs) {
          if ((r -= w) < 0) return v;
        }
        return pairs[pairs.length - 1][0];
      },
    };
  }

  function randomSeed() {
    return String(100000 + Math.floor(Math.random() * 900000));
  }

  DL.makeRng = makeRng;
  DL.randomSeed = randomSeed;
})(typeof window !== 'undefined' ? (window.DL = window.DL || {}) : (globalThis.DL = globalThis.DL || {}));
