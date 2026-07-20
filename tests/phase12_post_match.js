#!/usr/bin/env node
/* Fase 12 · análise pós-jogo: roda uma partida completa SEM labMode (eventos
   retidos), valida que o mapa de finalizações bate com as estatísticas do
   motor, que as manchetes carregam números reais e que tudo é determinístico. */
'use strict';
const fs = require('fs');
const path = require('path');
const { createRuntime } = require('../tools/lab_runtime.js');
const ROOT = path.resolve(__dirname, '..');
const rt = createRuntime(ROOT);
const sb = rt.sandbox;
new Function('window','globalThis','module',
  fs.readFileSync(path.join(ROOT,'src/scripts/52-phase12-post-match-analysis.js'),'utf8'))(sb, sb, undefined);
const P = sb.CDS_POST_MATCH;
if (!P || !P.installed) throw new Error('análise não instalada');

function teamFor(idx, form) {
  const squad = structuredClone(rt.db.squads[idx]);
  const l = sb.autoLineup(squad, form, 0);
  return { squad, name: squad.c, flag: '', color: '#fff', lineup: l.lineup, bench: l.bench,
    style: 'balanced', axes: Object.assign({}, sb.STYLE_AXES.balanced) };
}
function play(seed) {
  sb.srand(seed >>> 0);
  const sim = new sb.MatchSim(teamFor(48, '4-3-3'), teamFor(189, '4-3-3'), { neutral: true });
  sim.setInteractive(-1);
  const dt = 1 / 60; let g = 0;
  while (!sim.isOver() && g++ < 500000) sim.step(dt);
  if (!sim.isOver()) throw new Error('partida não terminou');
  return sim;
}

const sim = play(20260720);
for (const team of [0, 1]) {
  const a = P.analyze(sim, team);
  // mapa de finalizações espelha o motor
  if (a.shotMap.length !== sim.stats[team].shots)
    throw new Error('shotMap (' + a.shotMap.length + ') != shots do motor (' + sim.stats[team].shots + ')');
  const goals = a.shotMap.filter(s => s.result === 'gol').length;
  if (goals !== sim.score[team]) throw new Error('gols do mapa != placar');
  for (const s of a.shotMap) if (!(s.xg >= 0 && s.xg <= 1) || !Number.isFinite(s.minute))
    throw new Error('finalização inválida no mapa');
  // Fase 13: posição capturada no momento do lance, normalizada atacando à direita
  const positioned = a.shotMap.filter(s => s.x != null);
  if (positioned.length !== a.shotMap.length) throw new Error('chute sem posição capturada');
  for (const s of positioned) {
    if (!(s.x >= 0 && s.x <= 105 && s.y >= 0 && s.y <= 68)) throw new Error('posição fora do campo');
    if (s.kind !== 'falta' && s.kind !== 'pênalti' && s.x < 30)
      throw new Error('chute de jogada no campo de defesa após normalização: x=' + s.x);
  }
  // SVGs renderizam sem erro e contêm os pontos
  const svg = sb.CDS_POST_MATCH.fieldSVG(a.shotMap);
  if ((svg.match(/<circle/g) || []).length < positioned.length) throw new Error('mapa SVG sem todos os pontos');
  if (!sb.CDS_POST_MATCH.xgTimelineSVG(a.shotMap, P.analyze(sim, 1 - team).shotMap, ['A', 'B']).includes('<path'))
    throw new Error('timeline SVG sem linhas');
  // manchetes: só padrões reais, sempre com números
  for (const h of a.headlines) {
    if (!/\d/.test(h.msg)) throw new Error('manchete sem número real: ' + h.msg);
    if (!h.tag) throw new Error('manchete sem tag');
  }
  // números-chave coerentes
  if (a.keyNumbers.gk.secure + a.keyNumbers.gk.parries !== a.keyNumbers.gk.faced)
    throw new Error('decomposição do goleiro inconsistente na análise');
}
// determinismo: mesma seed → mesma análise
const a1 = P.analyze(play(20260720), 0), a2 = P.analyze(play(20260720), 0);
if (JSON.stringify(a1) !== JSON.stringify(a2)) throw new Error('análise não determinística');

console.log(JSON.stringify({ ok: true, version: P.VERSION, score: sim.score,
  shots: [sim.stats[0].shots, sim.stats[1].shots],
  headlines0: P.analyze(sim, 0).headlines.map(h => h.tag),
  sampleHeadline: (P.analyze(sim, 0).headlines[0] || {}).msg || null }, null, 2));
