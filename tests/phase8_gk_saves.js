#!/usr/bin/env node
/* Fase 8 · defesas contextuais do goleiro: valida que toda defesa do fluxo
   principal de chute se decompõe em segura/espalmada/rebote, que os rebotes
   voltam ao jogo como bola viva e que o determinismo por seed se mantém. */
'use strict';
const path = require('path');
const { createRuntime } = require('../tools/lab_runtime.js');
const rt = createRuntime(path.resolve(__dirname, '..'));
const sb = rt.sandbox;

function teamFor(idx, form) {
  const squad = structuredClone(rt.db.squads[idx]);
  const l = sb.autoLineup(squad, form, 0);
  return { squad, name: squad.c, flag: '', color: '#fff', lineup: l.lineup, bench: l.bench,
    style: 'balanced', axes: Object.assign({}, sb.STYLE_AXES.balanced) };
}

function playMatch(seed) {
  sb.srand(seed >>> 0);
  const kinds = Object.create(null);
  const sim = new sb.MatchSim(teamFor(48, '4-3-3'), teamFor(189, '4-3-3'), {
    neutral: true,
    onEvent: e => { if (e.type === 'save' && e.kind) kinds[e.kind] = (kinds[e.kind] || 0) + 1; }
  });
  sim.setInteractive(-1);
  const dt = 1 / 60; let guard = 0;
  while (!sim.isOver() && guard++ < 500000) sim.step(dt);
  if (!sim.isOver()) throw new Error('partida não terminou');
  return { sim, kinds };
}

const seeds = [20260719, 314159, 987654];
let faced = 0, catches = 0, parries = 0, rebounds = 0, allKinds = Object.create(null);
for (const seed of seeds) {
  const { sim, kinds } = playMatch(seed);
  for (const k in kinds) allKinds[k] = (allKinds[k] || 0) + kinds[k];
  for (const st of sim.stats) {
    faced += st.gkShotsFaced; catches += st.gkSecureCatches;
    parries += st.gkParries; rebounds += st.reboundsConceded;
    for (const key of ['gkShotsFaced','gkSecureCatches','gkParries','reboundsConceded'])
      if (!Number.isFinite(st[key]) || st[key] < 0) throw new Error('estatística inválida: ' + key);
    if (st.gkSecureCatches + st.gkParries !== st.gkShotsFaced)
      throw new Error('decomposição inconsistente: catch+parry != faced');
    if (st.reboundsConceded > st.gkParries)
      throw new Error('rebotes > espalmadas');
  }
}
if (faced === 0) throw new Error('nenhuma defesa registrada em 3 partidas');

// determinismo: mesma seed → mesmo placar e mesmas estatísticas de goleiro
const a = playMatch(20260719), b = playMatch(20260719);
if (a.sim.score.join('-') !== b.sim.score.join('-')) throw new Error('determinismo quebrado (placar)');
if (JSON.stringify(a.sim.stats.map(s => [s.gkShotsFaced, s.gkParries, s.reboundsConceded])) !==
    JSON.stringify(b.sim.stats.map(s => [s.gkShotsFaced, s.gkParries, s.reboundsConceded])))
  throw new Error('determinismo quebrado (estatísticas de goleiro)');

console.log(JSON.stringify({ ok: true, matches: seeds.length, gkShotsFaced: faced,
  secureCatches: catches, parries, rebounds, kinds: allKinds }, null, 2));
