#!/usr/bin/env node
/* Motor Visual 2.0 · Incremento 1 — invariantes de coerência física:
   1. toda defesa tem o goleiro NO ponto de contato (≤3m no instante do save)
   2. rebote nasce no ponto de impacto e VIAJA (deflexão contínua, sem salto)
   3. defesa encaixada não gera salto bola→goleiro no frame seguinte
   4. a bola nunca se desloca mais que o fisicamente possível durante o voo
   5. determinismo por seed preservado */
'use strict';
const path = require('path');
const { createRuntime } = require('../tools/lab_runtime.js');
const rt = createRuntime(path.resolve(__dirname, '..'));
const sb = rt.sandbox;
const D = (a, b, c, d) => Math.hypot(a - c, b - d);

function teamFor(idx, form) {
  const squad = structuredClone(rt.db.squads[idx]);
  const l = sb.autoLineup(squad, form, 0);
  return { squad, name: squad.c, flag: '', color: '#fff', lineup: l.lineup, bench: l.bench,
    style: 'balanced', axes: Object.assign({}, sb.STYLE_AXES.balanced) };
}

function run(seed) {
  sb.srand(seed >>> 0);
  const findings = { saves: 0, savesFar: [], rebounds: 0, reboundJump: [], catchSnap: [],
    maxFlightStep: 0, flightViolations: 0 };
  let pendingCheck = null;
  const sim = new sb.MatchSim(teamFor(48, '4-3-3'), teamFor(189, '4-3-3'), {
    neutral: true,
    onEvent: ev => {
      if (ev.type === 'save') {
        findings.saves++;
        const gk = ev.gk;
        if (gk) {
          const d = D(gk.x, gk.y, sim.ball.x, sim.ball.y);
          if (d > 3.0) findings.savesFar.push(+d.toFixed(2));
        }
        if (ev.rebound) { findings.rebounds++; pendingCheck = { type: 'rebound', x: sim.ball.x, y: sim.ball.y }; }
        else if (ev.kind === 'catch') pendingCheck = { type: 'catch', gk: ev.gk };
      }
    }
  });
  sim.setInteractive(-1);
  const dt = 1 / 60; let g = 0, px = null, py = null, wasTraveling = false, pspeed = 0;
  while (!sim.isOver() && g++ < 500000) {
    sim.step(dt);
    const b = sim.ball;
    if (pendingCheck) {
      if (pendingCheck.type === 'rebound') {
        const jump = D(b.x, b.y, pendingCheck.x, pendingCheck.y);
        if (jump > 1.0) findings.reboundJump.push(+jump.toFixed(2));
        if (!b.traveling && !b.owner && jump > 1.0) findings.reboundJump.push('parada-' + jump.toFixed(1));
      } else if (pendingCheck.type === 'catch' && pendingCheck.gk && b.owner === pendingCheck.gk) {
        const d = D(b.x, b.y, pendingCheck.gk.x, pendingCheck.gk.y);
        if (d > 2.5) findings.catchSnap.push(+d.toFixed(2));
      }
      pendingCheck = null;
    }
    // invariante de voo: deslocamento por frame limitado pela velocidade real
    // (primeiro frame de cada voo é isento — deflexões emendam voos novos
    // a partir do ponto de contato ancorado)
    if (wasTraveling && b.traveling && px != null && b.travelT > dt * 1.5) {
      const step = D(b.x, b.y, px, py);
      findings.maxFlightStep = Math.max(findings.maxFlightStep, step);
      if (step > (pspeed + 20) * dt) findings.flightViolations++;
    }
    px = b.x; py = b.y; wasTraveling = b.traveling; pspeed = b.speed || 40;
  }
  if (!sim.isOver()) throw new Error('partida não terminou');
  findings.score = sim.score.slice();
  return findings;
}

const seeds = [20260720, 424242, 777001];
let saves = 0, rebounds = 0;
for (const s of seeds) {
  const f = run(s);
  saves += f.saves; rebounds += f.rebounds;
  if (f.savesFar.length) throw new Error('defesa longe do contato (m): ' + f.savesFar.join(', '));
  if (f.reboundJump.length) throw new Error('rebote saltou do ponto de impacto: ' + f.reboundJump.join(', '));
  if (f.catchSnap.length) throw new Error('bola saltou para a mão do goleiro: ' + f.catchSnap.join(', '));
  if (f.flightViolations > 0) throw new Error(f.flightViolations + ' violações de velocidade no voo');
}
if (saves === 0) throw new Error('nenhuma defesa nas 3 partidas');

const a = run(20260720), b = run(20260720);
if (a.score.join() !== b.score.join()) throw new Error('determinismo quebrado');

console.log(JSON.stringify({ ok: true, matches: seeds.length, saves, rebounds,
  invariantes: ['contato<=3m', 'rebote-continuo', 'sem-salto-no-encaixe', 'voo-fisico', 'determinismo'] }, null, 2));
