// テスト用：ブラウザと同じ js/*.js と data/events.js を Node で読み込み、ゲームを自動で最後まで進める
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

function load(dataFile = path.join(ROOT, 'data', 'events.js')) {
  const ctx = { console };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of ['js/rng.js', 'js/rules.js', 'js/engine.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  vm.runInContext(fs.readFileSync(dataFile, 'utf8'), ctx, { filename: dataFile });
  const DL = ctx.DL;
  const compiled = DL.compileData(ctx.GAME_DATA);
  return { DL, compiled, game: DL.createGame(compiled) };
}

// 選び方（policy）：同じ policySeed なら毎回同じ選び方をする
function makePolicy(DL, policySeed) {
  const rng = DL.makeRng('policy', String(policySeed));
  return (scene) => {
    if (scene.kind === 'event' && scene.choices.length) {
      const ok = scene.choices.map((c, i) => (c.enabled ? i : -1)).filter((i) => i >= 0);
      return ok[rng.int(ok.length)];
    }
    if (scene.kind === 'pick') {
      const ok = scene.options.filter((o) => o.enabled).map((o) => o.name);
      const a = ok.splice(rng.int(ok.length), 1)[0];
      return [a, ok[rng.int(ok.length)]];
    }
    return undefined;
  };
}

// 1回分の人生を最後まで進める。hooks.onScene(scene, state) で途中に手を入れられる
function playThrough(game, seed, policy, hooks = {}) {
  const s = game.newLife(seed);
  const gen = game.play(s);
  const scenes = [];
  let answer;
  for (;;) {
    const r = gen.next(answer);
    if (r.done) break;
    const scene = r.value;
    scenes.push(scene);
    if (hooks.onScene) hooks.onScene(scene, s);
    answer = policy(scene, s);
  }
  return { state: s, scenes, ending: scenes[scenes.length - 1].ending };
}

module.exports = { ROOT, load, makePolicy, playThrough };
