
/* R18.20 · INTELIGÊNCIA DE CHANCE
   -------------------------------------------------------------------------
   Corrige a decisão conduzir × finalizar sem alterar a física ou a conversão:
   - toda decisão de bola rolando passa pela mesma avaliação, inclusive os
     atalhos de chute contextual e de segunda fase;
   - procura cinco corredores reais de aproximação em vez de testar apenas a
     reta central;
   - compara a qualidade estimada do chute atual com a qualidade depois da
     condução;
   - preserva primeira batida, pressão imediata, goleiro saindo, urgência real,
     passe superior e a assinatura dos especialistas de longa distância;
   - usa _carry e o integrador físico existentes: nenhum teleporte, bônus de
     velocidade, bônus de xG ou novo consumo de RNG. */
(function installR1820ChanceIntelligence(root) {
'use strict';
const M = root && root.MatchSim;
if (!M || !M.prototype || M.prototype.__CDS_R1820_CHANCE_INTELLIGENCE__) return;
const P = M.prototype;
Object.defineProperty(P, '__CDS_R1820_CHANCE_INTELLIGENCE__', { value: true });

const VERSION = '5.14.0-R18.20';
const FL = Number(root.FL) || 105;
const FW = Number(root.FW) || 68;
const CY = FW / 2;
const finite = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dist = (a, b) => Math.hypot(finite(a && a.x) - finite(b && b.x), finite(a && a.y) - finite(b && b.y));
const clone = value => value === undefined ? null : JSON.parse(JSON.stringify(value));

function attr(p, key, fallback = 68) {
  try {
    if (typeof root.getAttr === 'function') {
      const v = root.getAttr(p, key);
      if (Number.isFinite(v)) return v;
    }
  } catch (_) {}
  const ref = p && p.ref || {};
  const map = ref.attributesV3 || ref.attributes || {};
  if (Number.isFinite(map[key])) return map[key];
  return Number.isFinite(ref.r) ? ref.r : fallback;
}

function fresh() {
  return {
    version: VERSION,
    evaluations: 0,
    eligible: 0,
    openLanes: 0,
    approaches: 0,
    decisionApproaches: 0,
    safetyNetApproaches: 0,
    committedContinuations: 0,
    shotsObserved: 0,
    shotsAllowed: 0,
    currentDistanceSum: 0,
    projectedDistanceSum: 0,
    xgGainSum: 0,
    plannedMetersSum: 0,
    actualTargetMetersSum: 0,
    byReason: {
      open_space_xg_gain: 0,
      work_ball: 0,
      carry_instruction: 0
    },
    bypass: {
      restart: 0,
      firstTime: 0,
      closeChance: 0,
      pressure: 0,
      goalkeeper: 0,
      superiorPass: 0,
      blockedLane: 0,
      lowGain: 0,
      specialist: 0,
      urgency: 0,
      carryLimit: 0
    },
    last: null
  };
}

function audit(sim) {
  return sim.__r1820 || (sim.__r1820 = fresh());
}

function isLiveOwner(sim, o) {
  return !!(o && !o.red && !o.isGK && sim.ball && sim.ball.owner === o &&
    finite(sim.dead) <= .04 && !sim.pendingRestart && !sim.waiting &&
    !(finite(o._setPieceDeliveryUntil) > finite(sim.t)));
}

function nearestDefender(sim, o, includeKeeper) {
  let best = null;
  let distance = 99;
  const opp = sim.teams && sim.teams[1 - o.team];
  for (const p of opp && opp.players || []) {
    if (!p || p.red || (!includeKeeper && p.isGK)) continue;
    const d = dist(o, p);
    if (d < distance) {
      best = p;
      distance = d;
    }
  }
  return { player: best, distance };
}

function shotQuality(o, goal, distance, pressureDistance) {
  const angle = clamp(1 - Math.abs(finite(o.y) - finite(goal.y, CY)) / 35, .24, 1);
  const distanceBase = 1 / (1 + Math.exp((distance - 13.7) / 3.65));
  const fin = attr(o, 'finalizacao', 68) / 100;
  const composure = attr(o, 'compostura', 68) / 100;
  const long = attr(o, 'chute_longe', 64) / 100;
  const technique = attr(o, 'tecnica', attr(o, 'conducao', 68)) / 100;
  const longFactor = distance > 20 ? clamp(.40 + long * .42 + technique * .16, .48, .97) : 1;
  const pressure = clamp((3.5 - pressureDistance) / 3.5, 0, 1);
  return clamp(distanceBase * angle * (.64 + fin * .24 + composure * .12) *
    longFactor * (1 - pressure * .50), .003, .72);
}

function segmentClearance(a, b, p) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const den = dx * dx + dy * dy || 1;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / den, 0, 1);
  const x = a.x + dx * t;
  const y = a.y + dy * t;
  return {
    t,
    distance: Math.hypot(p.x - x, p.y - y)
  };
}

function approachLanes(sim, o, goal, dtg, carrySkill) {
  const opp = sim.teams && sim.teams[1 - o.team];
  const defenders = (opp && opp.players || []).filter(p => p && !p.red && !p.isGK);
  const keeper = (opp && opp.players || []).find(p => p && !p.red && p.isGK) || null;
  const baseAngle = Math.atan2(goal.y - o.y, goal.x - o.x);
  const reach = clamp(5.6 + carrySkill * 3.7, 5.8, Math.min(9.6, Math.max(5.8, dtg - 10.8)));
  const offsets = [-.30, -.15, 0, .15, .30];
  const lanes = [];

  for (const offset of offsets) {
    const angle = baseAngle + offset;
    const target = {
      x: clamp(o.x + Math.cos(angle) * reach, 1.2, FL - 1.2),
      y: clamp(o.y + Math.sin(angle) * reach, 1.2, FW - 1.2)
    };
    const projectedDistance = dist(target, goal);
    const progress = dtg - projectedDistance;
    if (progress < 3.8) continue;

    let blockers = 0;
    let minSegment = 99;
    let endpointSpace = 99;
    for (const d of defenders) {
      const q = segmentClearance(o, target, d);
      endpointSpace = Math.min(endpointSpace, dist(target, d));
      if (q.t > .06 && q.distance < minSegment) minSegment = q.distance;
      const radius = 2.25 + q.t * .72;
      if (q.t > .08 && q.distance < radius) blockers++;
    }
    const keeperDistance = keeper ? dist(target, keeper) : 99;
    const open = blockers === 0 && minSegment >= 2.55 && endpointSpace >= 3.75 && keeperDistance >= 5.4;
    const projectedQuality = shotQuality(
      { x: target.x, y: target.y, ref: o.ref },
      goal,
      projectedDistance,
      Math.min(endpointSpace, keeperDistance)
    );
    const centrality = 1 - Math.abs(target.y - CY) / CY;
    const laneQuality = clamp(
      .30 + Math.min(minSegment, 8) * .075 + Math.min(endpointSpace, 10) * .035 +
      Math.min(progress, 10) * .025 + centrality * .08 - blockers * .34 -
      (keeperDistance < 7 ? .18 : 0),
      0,
      1
    );
    const score = projectedQuality * 5.8 + laneQuality * .72 + progress * .035 -
      Math.abs(offset) * .16 - blockers * .90;
    lanes.push({
      offset,
      target,
      reach,
      projectedDistance,
      projectedQuality,
      progress,
      blockers,
      minSegment,
      endpointSpace,
      keeperDistance,
      laneQuality,
      open,
      score
    });
  }
  lanes.sort((a, b) => b.score - a.score);
  return { best: lanes[0] || null, lanes };
}

function passAssessment(sim, o) {
  let best = null;
  try {
    best = sim._bestPass && sim._bestPass(o);
  } catch (_) {}
  if (!best || !best.m || best.m.red) return { best: null, superior: false };
  const risk = finite(best.risk, 9);
  const score = finite(best.score, -9);
  const progress = finite(best.progressM);
  const superior = !!(
    (best.intoBox && risk < 2.12 && score > .58) ||
    (progress > 8.5 && risk < 1.68 && score > 1.58)
  );
  return { best, superior };
}

function evaluate(sim, o, options) {
  const s = audit(sim);
  s.evaluations++;
  if (!isLiveOwner(sim, o)) {
    s.bypass.restart++;
    return { approach: false, reason: 'restart' };
  }

  const tm = sim.teams[o.team];
  const goal = tm.oppGoal;
  const now = finite(sim.t);
  const dtg = dist(o, goal);
  const firstTime = finite(o.settle) > 0 && finite(o.settle) < .45;
  if (firstTime) {
    s.bypass.firstTime++;
    return { approach: false, reason: 'first_time', dtg };
  }
  if (dtg <= 15.2) {
    s.bypass.closeChance++;
    return { approach: false, reason: 'close_chance', dtg };
  }
  if (dtg > 36.5) {
    s.bypass.lowGain++;
    return { approach: false, reason: 'outside_window', dtg };
  }

  const nearestOutfield = nearestDefender(sim, o, false);
  const nearestAny = nearestDefender(sim, o, true);
  if (nearestOutfield.distance < 3.15) {
    s.bypass.pressure++;
    return { approach: false, reason: 'pressure', dtg, nearest: nearestOutfield.distance };
  }
  if (nearestAny.player && nearestAny.player.isGK && nearestAny.distance < 6.3) {
    s.bypass.goalkeeper++;
    return { approach: false, reason: 'goalkeeper_rush', dtg, nearest: nearestAny.distance };
  }

  const instructions = tm.instructions || {};
  const inPossession = instructions.inPossession || {};
  const progression = inPossession.progression || {};
  const finalThird = inPossession.finalThird || {};
  const workBall = finalThird.workBall === true;
  const earlyShots = finalThird.earlyShots === true;
  const longShotsMore = finalThird.longShots === 'more';
  const carryInstruction = progression.carryMore === true;
  const carrySkill = clamp((
    attr(o, 'conducao', attr(o, 'drible', 66)) * .29 +
    attr(o, 'drible', 66) * .20 +
    attr(o, 'aceleracao', 68) * .18 +
    attr(o, 'decisao', 68) * .20 +
    attr(o, 'compostura', 68) * .13
  ) / 100, .48, .98);

  const currentQuality = shotQuality(o, goal, dtg, nearestAny.distance);
  const laneSet = approachLanes(sim, o, goal, dtg, carrySkill);
  const lane = laneSet.best;
  s.eligible++;
  if (!lane || !lane.open) {
    s.bypass.blockedLane++;
    return {
      approach: false,
      reason: 'blocked_lane',
      dtg,
      currentQuality,
      lanes: laneSet.lanes
    };
  }
  s.openLanes++;

  const pass = passAssessment(sim, o);
  if (pass.superior) {
    s.bypass.superiorPass++;
    return {
      approach: false,
      reason: 'superior_pass',
      dtg,
      currentQuality,
      lane,
      bestPass: pass.best
    };
  }

  const scoreDiff = finite(sim.score && sim.score[o.team]) -
    finite(sim.score && sim.score[1 - o.team]);
  const minute = finite(sim.minute);
  const urgency = minute >= 86 && scoreDiff < 0;
  const longAttr = attr(o, 'chute_longe', 64);
  const technique = attr(o, 'tecnica', attr(o, 'conducao', 66));
  const specialist = longAttr >= 88 && technique >= 83;
  const gain = lane.projectedQuality - currentQuality;
  const ratio = lane.projectedQuality / Math.max(.008, currentQuality);

  const recent = finite(o._r1820ApproachUntil) > now ?
    finite(o._r1820ApproachCount) : 0;
  if (recent >= 3) {
    s.bypass.carryLimit++;
    return { approach: false, reason: 'carry_limit', dtg, currentQuality, lane, gain, ratio };
  }

  let minimumGain = workBall ? .027 : carryInstruction ? .031 : .038;
  let minimumRatio = workBall ? 1.28 : carryInstruction ? 1.36 : 1.47;
  if (earlyShots || longShotsMore) {
    minimumGain += .018;
    minimumRatio += .22;
  }
  if (specialist) {
    minimumGain += .018;
    minimumRatio += .18;
  }
  if (urgency) {
    minimumGain += .025;
    minimumRatio += .26;
  }

  const currentTooGood = currentQuality >= (workBall ? .205 : .175);
  const enoughGain = gain >= minimumGain && ratio >= minimumRatio;
  const laneConvincing = lane.laneQuality >= .57 && lane.progress >= 4.2;
  const approach = !currentTooGood && enoughGain && laneConvincing;

  if (!approach) {
    if (urgency) s.bypass.urgency++;
    else if (specialist) s.bypass.specialist++;
    else s.bypass.lowGain++;
  }

  return {
    approach,
    reason: approach
      ? (workBall ? 'work_ball' : carryInstruction ? 'carry_instruction' : 'open_space_xg_gain')
      : 'low_gain',
    source: options && options.source || 'decision',
    dtg,
    currentQuality,
    projectedQuality: lane.projectedQuality,
    gain,
    ratio,
    lane,
    specialist,
    urgency,
    workBall,
    carryInstruction,
    earlyShots,
    longShotsMore
  };
}

function commitApproach(sim, o, q, source) {
  const s = audit(sim);
  const now = finite(sim.t);
  o._r1820ApproachCount = finite(o._r1820ApproachUntil) > now ?
    finite(o._r1820ApproachCount) + 1 : 1;
  o._r1820ApproachUntil = now + 3.6;
  o._r1820ReviewAt = now + .72;

  /* Mantém a memória da R18.17.2 sincronizada para impedir que a camada antiga
     execute uma quarta aproximação logo depois da autoridade nova. */
  o._r18172ApproachCount = Math.max(finite(o._r18172ApproachCount), o._r1820ApproachCount);
  o._r18172ApproachUntil = Math.max(finite(o._r18172ApproachUntil), now + 3.6);

  s.approaches++;
  if (source === 'shoot_safety_net') s.safetyNetApproaches++;
  else s.decisionApproaches++;
  s.currentDistanceSum += q.dtg;
  s.projectedDistanceSum += q.lane.projectedDistance;
  s.xgGainSum += q.gain;
  s.plannedMetersSum += q.lane.progress;
  s.byReason[q.reason] = finite(s.byReason[q.reason]) + 1;
  s.last = {
    at: +now.toFixed(3),
    player: finite(o.idx, -1),
    team: o.team,
    source,
    reason: q.reason,
    distance: +q.dtg.toFixed(2),
    projectedDistance: +q.lane.projectedDistance.toFixed(2),
    currentQuality: +q.currentQuality.toFixed(4),
    projectedQuality: +q.projectedQuality.toFixed(4),
    gain: +q.gain.toFixed(4),
    laneQuality: +q.lane.laneQuality.toFixed(3),
    blockers: q.lane.blockers
  };

  try {
    sim._emit('shot_deferred', {
      by: o,
      reason: q.reason,
      source,
      dtg: +q.dtg.toFixed(2),
      projectedDtg: +q.lane.projectedDistance.toFixed(2),
      currentXg: +q.currentQuality.toFixed(4),
      projectedXg: +q.projectedQuality.toFixed(4),
      laneQuality: +q.lane.laneQuality.toFixed(3),
      blockers: q.lane.blockers,
      longshot: q.dtg > 21
    });
  } catch (_) {}

  sim._carry(o, q.lane.target);
  const planned = { x: finite(o._tx, o.x), y: finite(o._ty, o.y) };
  const plannedDistance = dist(planned, sim.teams[o.team].oppGoal);
  if (plannedDistance > q.lane.projectedDistance + .65) {
    o._tx = q.lane.target.x;
    o._ty = q.lane.target.y;
  }
  s.actualTargetMetersSum += Math.max(0, q.dtg -
    dist({ x: finite(o._tx, o.x), y: finite(o._ty, o.y) }, sim.teams[o.team].oppGoal));
}

const oldReset = P.reset;
P.reset = function () {
  const result = oldReset.apply(this, arguments);
  this.__r1820 = fresh();
  return result;
};

const oldDecide = P._decide;
P._decide = function (o) {
  try {
    if (isLiveOwner(this, o)) {
      const now = finite(this.t);
      const near = nearestDefender(this, o, true);
      if (finite(o._r1820ReviewAt) > now && o._act === 'carry' &&
          Math.hypot(finite(o._tx, o.x) - finite(o.x), finite(o._ty, o.y) - finite(o.y)) > 1.25 &&
          near.distance > 2.65) {
        audit(this).committedContinuations++;
        return;
      }
      const q = evaluate(this, o, { source: 'decision' });
      o._r1820LastEvaluation = q;
      if (q.approach) {
        commitApproach(this, o, q, 'decision');
        return;
      }
    }
  } catch (_) {}
  return oldDecide.apply(this, arguments);
};

/* Rede de segurança para qualquer caminho legado que chame _shoot diretamente.
   Reinícios e primeira batida são excluídos por evaluate(). A execução física
   original permanece totalmente intacta quando o chute é autorizado. */
const oldShoot = P._shoot;
P._shoot = function (o) {
  const s = audit(this);
  s.shotsObserved++;
  try {
    const q = evaluate(this, o, { source: 'shoot_safety_net' });
    o._r1820LastEvaluation = q;
    if (q.approach) {
      commitApproach(this, o, q, 'shoot_safety_net');
      return;
    }
  } catch (_) {}
  s.shotsAllowed++;
  return oldShoot.apply(this, arguments);
};

P.getR1820Audit = function () {
  const s = audit(this);
  const gates = {
    installed: !!root.CDS_R1820 && root.CDS_R1820.feature === 'CHANCE_INTELLIGENCE',
    sharedEvaluation: typeof evaluate === 'function' && typeof approachLanes === 'function',
    physicalCarry: typeof this._carry === 'function',
    originalShotResolution: typeof oldShoot === 'function',
    deterministicSelection: root.CDS_R1820 && root.CDS_R1820.additionalRng === false
  };
  return Object.assign({}, clone(s), {
    means: {
      deferredDistance: s.approaches ? +(s.currentDistanceSum / s.approaches).toFixed(2) : 0,
      projectedDistance: s.approaches ? +(s.projectedDistanceSum / s.approaches).toFixed(2) : 0,
      projectedXgGain: s.approaches ? +(s.xgGainSum / s.approaches).toFixed(4) : 0,
      plannedAdvance: s.approaches ? +(s.plannedMetersSum / s.approaches).toFixed(2) : 0,
      targetAdvance: s.approaches ? +(s.actualTargetMetersSum / s.approaches).toFixed(2) : 0
    },
    gates,
    status: Object.values(gates).every(Boolean) ?
      'CHANCE_INTELLIGENCE_PASS' : 'CHANCE_INTELLIGENCE_REVIEW',
    structural: this.getR12Audit ? this.getR12Audit().status : null,
    observer: this.getR13Audit ? this.getR13Audit().status : null
  });
};

const oldFullAudit = P.getFullFootballAudit;
P.getFullFootballAudit = function () {
  const result = oldFullAudit ? oldFullAudit.apply(this, arguments) : {};
  result.chanceIntelligence = this.getR1820Audit();
  return result;
};

root.CDS_R1820 = Object.freeze({
  version: VERSION,
  baseline: 'R18.19',
  feature: 'CHANCE_INTELLIGENCE',
  approachLanes: 5,
  maxConsecutiveApproaches: 3,
  sharedDecisionAndShotGate: true,
  additionalRng: false,
  shotPhysicsChanged: false,
  shotConversionChanged: false,
  carrySpeedBonus: false,
  xgBonus: false
});
try {
  root.CDS_BUILD_ID = 'R18.20';
  root.CDS_VERSION = VERSION;
  if (root.document) root.document.title = 'Copa dos Sonhos — R18.20';
} catch (_) {}
})(typeof window !== 'undefined' ? window : globalThis);

