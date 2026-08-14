
/* R18.21 · DECISÃO PÓS-ROUBADA
   -------------------------------------------------------------------------
   O alívio deixa de ser automático fora do terço defensivo. A rota corrigida
   é a chamada de _clearBall, não o sítio de decisão: assim vale para TODAS as
   origens do alívio, não só para o ramo do zagueiro em construção.

   Ordem no meio-campo: passe seguro -> lançamento direcionado -> conduzir e
   proteger. O alívio segue legítimo no terço defensivo, sob perigo real, e
   como último recurso quando nenhuma saída existe.

   Taxonomia: o evento canônico header_clear é PRESERVADO (a ecologia de
   escanteio da r18183, a segunda fase da r18182 e o observador R13 dependem
   dele). Os discriminadores foot_clearance / long_pass entram como eventos
   novos, que nenhum consumidor legado escuta.

   Sem teleporte, sem bônus de velocidade, sem incremento direto de estatística.
   O caminho não desviado não consome RNG adicional. */
(function installR1821PostRecovery(root) {
'use strict';
const M = root && root.MatchSim;
if (!M || !M.prototype || M.prototype.__CDS_R1821_POST_RECOVERY__) return;
const P = M.prototype;
Object.defineProperty(P, '__CDS_R1821_POST_RECOVERY__', { value: true });

const VERSION = '5.15.0-R18.21';
const FW = Number(root.FW) || 68;

const finite = (v, d) => Number.isFinite(v) ? v : (d || 0);
const dist = (ax, ay, bx, by) => Math.hypot(finite(ax) - finite(bx), finite(ay) - finite(by));

/* Terço defensivo: até 35 m do próprio gol — aliviar ali é futebol.
   Perigo real: adversário colado ainda dentro dos 42 m. Fora disso o alívio
   é decisão pobre, não decisão de risco. */
const DEF_THIRD = 35;
const REAL_DANGER_ZONE = 42;
const REAL_DANGER_PRESSURE = 1.35;

function ownGoalDist(sim, p) {
  const tm = sim.teams && sim.teams[p.team];
  const g = tm && tm.goal;
  return g ? dist(p.x, p.y, g.x, g.y) : 1e9;
}

function nearestOppDist(sim, p) {
  const opp = sim.teams && sim.teams[1 - p.team];
  if (!opp) return 1e9;
  let n = 1e9;
  for (const d of opp.players || []) {
    if (!d || d.red) continue;
    const dd = dist(p.x, p.y, d.x, d.y);
    if (dd < n) n = dd;
  }
  return n;
}

function audit(sim) {
  if (!sim.__r1821) {
    Object.defineProperty(sim, '__r1821', {
      value: {
        version: VERSION,
        clearCalls: 0,
        allowedOutOfScope: 0, allowedDefensiveThird: 0, allowedRealDanger: 0,
        diverted: 0, divertedTo: { safe_pass: 0, long_pass: 0, carry: 0 },
        fallbackCleared: 0,
        footClearances: 0, headerClearances: 0
      },
      enumerable: false, writable: true, configurable: true
    });
  }
  return sim.__r1821;
}

/* Passe seguro com critério relaxado: o _safePass do motor exige o alvo com
   4,5 m de liberdade, o que no meio-campo pressionado quase nunca acontece e
   é o que empurrava a decisão para o alívio. 3,0 m ainda é um passe jogável. */
function relaxedSafePass(sim, o) {
  const tm = sim.teams[o.team];
  const dir = tm.attackDir;
  const opps = sim.teams[1 - o.team].players.filter(p => p && !p.red);
  let best = null, bestScore = -1e9;
  for (const m of tm.players) {
    if (!m || m === o || m.red) continue;
    const d = dist(o.x, o.y, m.x, m.y);
    if (d < 4 || d > 40) continue;
    let mk = 1e9;
    for (const q of opps) { const dd = dist(m.x, m.y, q.x, q.y); if (dd < mk) mk = dd; }
    if (mk < 3.0) continue;
    if (typeof sim._laneBlocked === 'function' && sim._laneBlocked(o, m, opps)) continue;
    const prog = dir > 0 ? (m.x - o.x) : (o.x - m.x);
    const score = mk * 1.0 + Math.max(-6, Math.min(12, prog)) * 0.18 - d * 0.03 + (m.isGK ? -2.5 : 0);
    if (score > bestScore) { bestScore = score; best = { m, dist: d, intoBox: false, risk: 0.45, progressM: prog }; }
  }
  return best;
}

/* Lançamento direcionado: bola longa COM destinatário e progressão, que é
   futebol — diferente do chutão para ninguém. Exige espaço real no alvo. */
function directedLongPass(sim, o) {
  const tm = sim.teams[o.team];
  const dir = tm.attackDir;
  const opps = sim.teams[1 - o.team].players.filter(p => p && !p.red);
  let best = null, bestScore = -1e9;
  for (const m of tm.players) {
    if (!m || m === o || m.red || m.isGK) continue;
    const d = dist(o.x, o.y, m.x, m.y);
    if (d < 14 || d > 48) continue;
    const prog = dir > 0 ? (m.x - o.x) : (o.x - m.x);
    if (prog < 2) continue;
    let space = 30;
    for (const q of opps) { const dd = dist(m.x, m.y, q.x, q.y); if (dd < space) space = dd; }
    if (space < 5) continue;
    const score = Math.min(space, 12) * 0.75 + prog * 0.22 - Math.abs(m.y - o.y) * 0.03;
    if (score > bestScore) { bestScore = score; best = { m, dist: d, intoBox: false, risk: 0.8, progressM: prog }; }
  }
  return best;
}

/* Executa o alívio original preservando header_clear e anexando o
   discriminador correto. A troca de _emit é local e revertida sempre. */
function clearWithTaxonomy(sim, o, original, args) {
  const a = audit(sim);
  const airborne = finite(sim.ball && sim.ball.z) > 1.0;
  const hadOwn = Object.prototype.hasOwnProperty.call(sim, '_emit');
  const originalEmit = sim._emit;
  let tagged = false;
  sim._emit = function (type) {
    const result = originalEmit.apply(this, arguments);
    if (type === 'header_clear' && !tagged) {
      tagged = true;
      if (airborne) {
        a.headerClearances++;
      } else {
        a.footClearances++;
        originalEmit.call(this, 'foot_clearance', { by: o, danger: +ownGoalDist(this, o).toFixed(1) });
      }
    }
    return result;
  };
  try { return original.apply(sim, args); }
  finally { if (hadOwn) sim._emit = originalEmit; else { try { delete sim._emit; } catch (_) { sim._emit = originalEmit; } } }
}

const oldClearBall = P._clearBall;
if (typeof oldClearBall === 'function') {
  P._clearBall = function (o) {
    const a = audit(this);
    a.clearCalls++;

    // Fora de escopo: goleiro, bola morta, reinício pendente. Comportamento intacto.
    if (!o || o.red || o.isGK || finite(this.dead) > 0.05 || this.pendingRestart || this.waiting) {
      a.allowedOutOfScope++;
      return clearWithTaxonomy(this, o, oldClearBall, arguments);
    }

    const danger = ownGoalDist(this, o);
    const pressure = nearestOppDist(this, o);

    if (danger <= DEF_THIRD) {
      a.allowedDefensiveThird++;
      return clearWithTaxonomy(this, o, oldClearBall, arguments);
    }
    if (danger < REAL_DANGER_ZONE && pressure < REAL_DANGER_PRESSURE) {
      a.allowedRealDanger++;
      return clearWithTaxonomy(this, o, oldClearBall, arguments);
    }

    // MEIO-CAMPO OU À FRENTE: o alívio não é a primeira opção.
    const info = { by: o, danger: +danger.toFixed(1), pressure: +pressure.toFixed(2) };

    const safe = relaxedSafePass(this, o);
    if (safe) {
      a.diverted++; a.divertedTo.safe_pass++;
      this._emit('post_recovery_decision', Object.assign({ choice: 'safe_pass' }, info));
      return this._pass(o, safe);
    }

    const long = directedLongPass(this, o);
    if (long) {
      a.diverted++; a.divertedTo.long_pass++;
      this._emit('long_pass', Object.assign({ to: long.m, progressM: +long.progressM.toFixed(1) }, info));
      this._emit('post_recovery_decision', Object.assign({ choice: 'long_pass' }, info));
      return this._pass(o, long);
    }

    const g = this.teams[o.team] && this.teams[o.team].oppGoal;
    if (g && typeof this._carry === 'function') {
      a.diverted++; a.divertedTo.carry++;
      this._emit('post_recovery_decision', Object.assign({ choice: 'carry' }, info));
      return this._carry(o, g);
    }

    // Nenhuma saída existe: aliviar volta a ser legítimo.
    a.fallbackCleared++;
    return clearWithTaxonomy(this, o, oldClearBall, arguments);
  };
}

try {
  root.CDS_R1821_POST_RECOVERY = Object.freeze({
    version: VERSION,
    defensiveThirdM: DEF_THIRD,
    realDangerZoneM: REAL_DANGER_ZONE,
    realDangerPressureM: REAL_DANGER_PRESSURE,
    teleport: false, speedBonus: false, statIncrement: false
  });
} catch (_) {}
})(typeof window !== 'undefined' ? window : globalThis);
