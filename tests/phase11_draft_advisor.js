#!/usr/bin/env node
/* Fase 11 · conselheiro do draft: valida arquétipos derivados de atributos,
   encaixe posicional, detecção de carências, redundância e explicações
   construídas a partir de dados reais do banco V3. */
'use strict';
const fs = require('fs');
const path = require('path');
const { createRuntime } = require('../tools/lab_runtime.js');
const ROOT = path.resolve(__dirname, '..');
const rt = createRuntime(ROOT);
const sb = rt.sandbox;
new Function('window','globalThis','module',
  fs.readFileSync(path.join(ROOT,'src/scripts/51-phase11-draft-advisor.js'),'utf8'))(sb, sb, undefined);
const A = sb.CDS_DRAFT_ADVISOR;
if (!A || !A.installed) throw new Error('conselheiro não instalado');

const slots = sb.FORMATIONS['4-3-3'].variations[0].slots.map(sl => ({ pos: sl.pos, p: null }));
const draft = { slots, benchPicks: [] };
const pool = [];
for (const sq of rt.db.squads.slice(0, 40)) for (const p of sq.pl) pool.push(p);
const byPos = pos => pool.filter(p => (p.profileV3 && p.profileV3.primaryPosition) === pos);

// 1) elenco vazio: goleiro tem vaga exata
const gk = byPos('GK')[0];
const evGk = A.evaluateCandidate(gk, draft);
if (!evGk.bestSlot || evGk.bestSlot.fit !== 3 || A.archetype(gk) !== 'goleiro')
  throw new Error('goleiro deveria ter encaixe exato');

// 2) meio sem volante → carência detectada; volante resolve
const mids = slots.map((s, i) => [s, i]).filter(([s]) => /M$/.test(s.pos));
const armadores = pool.filter(p => A.archetype(p) === 'armador');
const volantes = pool.filter(p => A.archetype(p) === 'volante');
if (!armadores.length || !volantes.length) throw new Error('banco sem arquétipos suficientes');
mids.slice(0, 2).forEach(([s], k) => { s.p = armadores[k]; });
const roster = A.analyzeRoster(draft);
if (!roster.weaknesses.some(w => w.code === 'SEM_VOLANTE'))
  throw new Error('carência SEM_VOLANTE não detectada com 2 armadores');
const openMid = slots.find(s => !s.p && /M$/.test(s.pos));
let evVol = null;
if (openMid) {
  const cand = volantes.find(v => A.fits(v, openMid.pos) > 0);
  if (cand) {
    evVol = A.evaluateCandidate(cand, draft);
    if (evVol.resolves.indexOf('SEM_VOLANTE') === -1)
      throw new Error('volante deveria resolver SEM_VOLANTE');
    if (evVol.explanation.indexOf('volante') === -1)
      throw new Error('explicação não menciona a carência resolvida');
  }
}

// 3) redundância: terceiro armador é sinalizado e a explicação avisa
const evDup = A.evaluateCandidate(armadores[2], draft);
if (evDup.redundancy < 2) throw new Error('redundância de armadores não contada');
if (evDup.resolves.length === 0 && evDup.explanation.indexOf('já tem') === -1)
  throw new Error('explicação de redundância ausente');

// 4) elenco completo: candidato sem vaga vira reserva
slots.forEach(s => { if (!s.p) s.p = pool.find(q => A.fits(q, s.pos) === 3 && !slots.some(z => z.p === q)) || armadores[3]; });
const evFull = A.evaluateCandidate(byPos('GK')[1] || gk, draft);
if (evFull.bestSlot) throw new Error('elenco completo não deveria ter vaga');
if (evFull.explanation.indexOf('reserva') === -1) throw new Error('explicação de reserva ausente');

// 5) pontuações válidas e determinísticas (sem RNG)
for (const p of pool.slice(0, 200)) {
  const e1 = A.evaluateCandidate(p, draft), e2 = A.evaluateCandidate(p, draft);
  if (!(e1.fitScore >= 0 && e1.fitScore <= 100)) throw new Error('fitScore fora de 0-100');
  if (e1.fitScore !== e2.fitScore || e1.explanation !== e2.explanation)
    throw new Error('avaliação não determinística');
}

console.log(JSON.stringify({ ok: true, version: A.VERSION,
  weaknessesDetected: roster.weaknesses.map(w => w.code),
  volanteResolve: evVol ? evVol.resolves : null,
  redundancyExample: evDup.explanation }, null, 2));
