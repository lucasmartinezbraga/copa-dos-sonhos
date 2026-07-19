#!/usr/bin/env node
/* Auditoria · Fase 4 (bloqueador): comprova que a seleção de ações é
   probabilística ponderada (nem sempre a maior pontuação vence) E que
   permanece determinística por seed. */
'use strict';
process.env.CDS_LAB_PHASE47 = '1';
const path = require('path');
const { createRuntime } = require('../tools/lab_runtime.js');
const rt = createRuntime(path.resolve(__dirname, '..'));
const sb = rt.sandbox;

function playMatch(seed) {
  sb.srand(seed >>> 0);
  const A = teamFor(48, '4-3-3'), B = teamFor(189, '4-3-3');
  const sim = new sb.MatchSim(A, B, { neutral: true, labMode: true, onEvent: () => {} });
  sim.setInteractive(-1);
  const dt = 1 / 60; let guard = 0;
  while (!sim.isOver() && guard++ < 500000) sim.step(dt);
  if (!sim.isOver()) throw new Error('partida não terminou');
  return sim;
}
function teamFor(idx, form) {
  const squad = structuredClone(rt.db.squads[idx]);
  const l = sb.autoLineup(squad, form, 0);
  return { squad, name: squad.c, flag: '', color: '#fff', lineup: l.lineup, bench: l.bench,
    style: 'balanced', axes: Object.assign({}, sb.STYLE_AXES.balanced) };
}

let totalDecisions = 0, totalNonBest = 0;
for (const seed of [20260719, 424242, 777001]) {
  const sim = playMatch(seed);
  for (const st of sim.stats) {
    totalDecisions += st.decisionQuality.count;
    totalNonBest += st.decisionNonBest || 0;
  }
}
if (totalDecisions < 50) throw new Error('poucas decisões registradas: ' + totalDecisions);
const share = totalNonBest / totalDecisions;
// distribuição real: parte das escolhas deve fugir do topo, mas o topo domina
if (totalNonBest === 0) throw new Error('argmax puro: nenhuma escolha fora do topo');
if (share > 0.6) throw new Error('distribuição degenerada: topo escolhido em menos de 40% (' + share.toFixed(3) + ')');

// determinismo por seed
const a = playMatch(555000), b = playMatch(555000);
if (a.score.join('-') !== b.score.join('-')) throw new Error('determinismo quebrado (placar)');
const da = a.stats.map(s => [s.decisionQuality.count, s.decisionNonBest]).flat().join(',');
const db2 = b.stats.map(s => [s.decisionQuality.count, s.decisionNonBest]).flat().join(',');
if (da !== db2) throw new Error('determinismo quebrado (decisões): ' + da + ' vs ' + db2);

console.log(JSON.stringify({ ok: true, totalDecisions, totalNonBest,
  nonBestShare: +share.toFixed(4) }, null, 2));
