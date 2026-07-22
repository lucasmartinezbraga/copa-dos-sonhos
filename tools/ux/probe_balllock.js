#!/usr/bin/env node
'use strict';

const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');

const argv = Object.fromEntries(process.argv.slice(2).map(arg => {
  const [key, value] = arg.replace(/^--/, '').split('=');
  return [key, value == null ? true : value];
}));

const BUILD = argv.build || 'COPA DOS SONHOS - V5.9.3-R12.3 - NUCLEO AUTORITATIVO TRANSACIONAL.html';
const CSV = argv.csv || 'COPA_DOS_SONHOS_P0-6_R12.3_PARTIDAS.csv';
const START = Number(argv.start || 0);
const END = Number(argv.end || START + 40);
const OUT = argv.out || 'observer_result.json';

function noop() {}
function define(name, value) {
  try { Object.defineProperty(global, name, { value, writable: true, configurable: true }); }
  catch (_) { global[name] = value; }
}

define('window', global);
define('self', global);
define('navigator', { userAgent: 'cds-football-observer', language: 'pt-BR' });
define('location', { href: 'runner://observer', search: '', hash: '' });
define('performance', { now: () => 0 });
define('crypto', crypto.webcrypto);
define('requestAnimationFrame', () => 0);
define('cancelAnimationFrame', noop);
define('addEventListener', noop);
define('removeEventListener', noop);
define('matchMedia', () => ({ matches: false, addEventListener: noop, removeEventListener: noop }));
define('alert', noop);
define('confirm', () => true);
define('prompt', () => null);
define('localStorage', { getItem: () => null, setItem: noop, removeItem: noop, clear: noop });
define('sessionStorage', global.localStorage);
define('CanvasRenderingContext2D', undefined);
define('HTMLElement', function HTMLElement() {});
define('HTMLCanvasElement', function HTMLCanvasElement() {});
define('Image', function Image() {});
define('Audio', function Audio() { return { play: () => Promise.resolve(), pause: noop }; });
define('__showBootError', noop);
define('__cdsDebugWarn', noop);
define('CDS_DEBUG', false);

const realConsole = console;
global.console = { log: noop, warn: noop, error: realConsole.error };

function parseCSV(text) {
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  const head = lines.shift().split(',');
  return lines.map(line => {
    const values = line.split(',');
    const row = {};
    head.forEach((key, index) => { row[key] = values[index]; });
    return row;
  });
}

function loadBuild(path) {
  const html = fs.readFileSync(path, 'utf8');
  const scripts = [];
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html))) {
    const id = (match[1].match(/id="([^"]+)"/) || [])[1] || `script-${scripts.length}`;
    scripts.push({ id, code: match[2] });
  }
  // Seleção por ID, nunca por posição: a camada de apresentação insere scripts
  // (cds-mobile-boot-bridge, cds-ux-boot) e deslocaria todos os índices fixos,
  // fazendo a sonda quebrar ou — pior — pular a camada de motor errada.
  const SKIP_IDS = new Set([
    'cds-2_5d-gate-a-contracts-v02',  // contratos de render 2.5D
    'cds-pre25d-runtime-auditor-v04', // auditor de runtime (exige DOM)
    'cds-r109-async-cup',             // orquestração assíncrona da copa
    'cds-mobile-boot-bridge',         // ponte de toque: só DOM
    'cds-ux-boot',                    // camada UX: só DOM
  ]);
  const loaded = [], skipped = [];
  scripts.forEach((script, index) => {
    if (SKIP_IDS.has(script.id)) { skipped.push(script.id); return; }
    try {
      vm.runInThisContext(script.code, { filename: `${String(index).padStart(2, '0')}-${script.id}.js` });
      loaded.push(script.id);
    } catch (error) {
      // O bundle base (sem id) registra listeners de DOM no fim do arquivo; o
      // motor já foi definido nesse ponto. Só ele pode falhar por falta de DOM.
      if (/^script-\d+$/.test(script.id) &&
          /document is not defined/.test(String(error && error.message || error))) {
        loaded.push(script.id + ' (parcial: sem DOM)');
        return;
      }
      throw error;
    }
  });
  module.exports.loadedScripts = loaded;
  module.exports.skippedScripts = skipped;
  return crypto.createHash('sha256').update(html).digest('hex');
}

function teamFor(db, row, home, index) {
  const prefix = home ? 'home' : 'away';
  const country = row[`${prefix}Team`];
  const year = Number(row[`${prefix}Year`]);
  const formation = row[`${prefix}Formation`];
  const squad = db.squads.find(item => item.c === country && Number(item.y) === year);
  const formationDef = FORMATIONS[formation];
  if (!squad || !formationDef) throw new Error(`Missing team: ${country} ${year} ${formation}`);
  const requestedVariation = Number(row[`${prefix}Variation`]);
  const variation = Number.isFinite(requestedVariation) ?
    Math.max(0, Math.min(formationDef.variations.length - 1, requestedVariation)) :
    index % formationDef.variations.length;
  const picked = autoLineup(squad, formation, variation);
  if ((argv.matrix || argv.styleMatrix) && argv.neutralPlayers !== 'false') {
    const attributeKeys = global.CDSDataV3 && Array.isArray(global.CDSDataV3.attributes) ?
      global.CDSDataV3.attributes : [];
    picked.lineup = picked.lineup.map((slot, playerIndex) => {
      const position = slot.pos || 'CM';
      const attributesV3 = Object.fromEntries(attributeKeys.map(key => [key, 82]));
      const player = {
        id: `R13_LAB_${position}_${playerIndex}`,
        n: `Atleta laboratório ${playerIndex + 1}`,
        slot: position,
        pos: position,
        r: 82,
        starter: 1,
        traits: [],
        behaviorTraits: [],
        naturalRoles: [],
        a8: [82, 82, 82, 82, 82, 82, 82, 82],
        attributesV3,
        profileV3: {
          dominantFoot: 'R', weakFoot: 4,
          heightCmSim: position === 'GK' ? 190 : 182,
          bodyType: 'average', primaryPosition: position
        },
        _a: {}
      };
      return { ...slot, p: player };
    });
    picked.bench = [];
  }
  return {
    squad,
    name: squad.c,
    flag: squad.f,
    color: home ? '#2e9bff' : '#ff3d7f',
    lineup: picked.lineup,
    bench: picked.bench,
    formKey: formation,
    style: row[`${prefix}Style`]
  };
}

function lineOf(player) {
  const pos = player.oopPos || player.slotPos;
  if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(pos)) return 'DEF';
  if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(pos)) return 'MID';
  if (player.isGK || pos === 'GK') return 'GK';
  return 'FWD';
}

function median(values) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function progressFromOwnGoal(team, x) { return team.goal.x < 52.5 ? x : 105 - x; }

function blankObservation() {
  return {
    samples: 0,
    defensiveSamples: 0,
    dangerousAttackers: 0,
    uncoveredAttackers: 0,
    goalSideCovered: 0,
    markerAssignments: 0,
    markerActuallyClose: 0,
    markerGoalSide: 0,
    markerDistanceSum: 0,
    markerDistanceMax: 0,
    defensiveLineRangeSum: 0,
    defensiveLineRangeMax: 0,
    disconnectedLines: 0,
    overload424Samples: 0,
    overload424Uncovered: 0,
    spatialOverloadSamples: 0,
    spatialOverloadUncovered: 0,
    controlledBallSamples: 0,
    bodyOrientationMismatch: 0,
    throwIns: 0,
    goalKicks: 0,
    cornersFromBoundary: 0,
    lineWorst: [],
    events: Object.create(null)
  };
}

function observe(sim, obs, row) {
  obs.samples++;
  const ball = sim.ball;
  if (ball.owner) {
    const owner = ball.owner;
    const speed = Math.hypot(owner.vx || 0, owner.vy || 0);
    const offset = { x: ball.x - owner.x, y: ball.y - owner.y };
    const offsetLength = Math.hypot(offset.x, offset.y);
    if (speed > 1.2 && offsetLength > 0.15) {
      obs.controlledBallSamples++;
      const alignment = (offset.x * owner.vx + offset.y * owner.vy) / (offsetLength * speed);
      if (alignment < 0.35) obs.bodyOrientationMismatch++;
    }
  }

  for (const defendingTeam of sim.teams) {
    const attackingTeam = sim.teams[1 - defendingTeam.side];
    const possessionTeam = ball.owner ? ball.owner.team : sim.poss;
    const defending = possessionTeam !== defendingTeam.side;
    if (!defending) continue;
    obs.defensiveSamples++;
    const defenders = defendingTeam.players.filter(p => !p.red && lineOf(p) === 'DEF');
    const midfielders = defendingTeam.players.filter(p => !p.red && lineOf(p) === 'MID');
    const defProgress = defenders.map(p => progressFromOwnGoal(defendingTeam, p.x));
    const phase = sim.__r13State && sim.__r13State.phaseByTeam && sim.__r13State.phaseByTeam[defendingTeam.side];
    if (defProgress.length > 1 && (!phase || phase === 'defensive_block')) {
      const range = Math.max(...defProgress) - Math.min(...defProgress);
      obs.defensiveLineRangeSum += range;
      if (range > obs.defensiveLineRangeMax) {
        obs.defensiveLineRangeMax = range;
        obs.lineWorst = [{
          minute: sim.minute,
          team: defendingTeam.side,
          possession: ball.owner ? ball.owner.team : sim.poss,
          ball: { x: ball.x, y: ball.y, traveling: !!ball.traveling, kind: ball.kind },
          phase: sim.getR13Audit ? sim.__r13State.phaseByTeam.slice() : null,
          presser: defendingTeam._presser && { idx: defendingTeam._presser.idx, pos: defendingTeam._presser.slotPos },
          defenders: defenders.map(p => ({ idx: p.idx, pos: p.slotPos, progress: progressFromOwnGoal(defendingTeam, p.x), y: p.y, mark: p._markRef && p._markRef.idx, role: p._setPieceRole || null }))
        }];
      }
      const midProgress = midfielders.map(p => progressFromOwnGoal(defendingTeam, p.x));
      if (midProgress.length && median(midProgress) - median(defProgress) > 18) obs.disconnectedLines++;
    }

    const threats = attackingTeam.players.filter(p => {
      if (p.red || p.isGK || lineOf(p) !== 'FWD') return false;
      const goalDistance = distance(p, defendingTeam.goal);
      return goalDistance < 46 || p._breaking || p._runDeep;
    });
    let uncoveredThisFrame = 0;
    for (const attacker of threats) {
      obs.dangerousAttackers++;
      const eligible = defendingTeam.players.filter(p => !p.red && !p.isGK && lineOf(p) !== 'FWD');
      let nearest = Infinity;
      let goalSide = false;
      for (const defender of eligible) {
        const d = distance(defender, attacker);
        nearest = Math.min(nearest, d);
        const attackerGoal = distance(attacker, defendingTeam.goal);
        const defenderGoal = distance(defender, defendingTeam.goal);
        if (d <= 8.5 && defenderGoal + 0.5 < attackerGoal && Math.abs(defender.y - attacker.y) <= 7.5) goalSide = true;
      }
      if (nearest > 9 || !goalSide) { obs.uncoveredAttackers++; uncoveredThisFrame++; }
      if (goalSide) obs.goalSideCovered++;
    }

    const attackingForm = attackingTeam.side === 0 ? row.homeFormation : row.awayFormation;
    if (attackingForm === '4-2-4' && threats.length >= 3) {
      obs.overload424Samples++;
      obs.overload424Uncovered += uncoveredThisFrame / Math.max(1, threats.length);
    }
    const shapePressure = defendingTeam._r13ShapePressure;
    if (shapePressure && threats.length &&
        (shapePressure.localOverload || shapePressure.lastLine >= Math.max(2, defenders.length))) {
      obs.spatialOverloadSamples++;
      obs.spatialOverloadUncovered += uncoveredThisFrame / threats.length;
    }

    for (const defender of defendingTeam.players) {
      if (!defender._markRef || defender.red || defender._markRef.red) continue;
      const d = distance(defender, defender._markRef);
      obs.markerAssignments++;
      obs.markerDistanceSum += d;
      obs.markerDistanceMax = Math.max(obs.markerDistanceMax, d);
      if (d <= 8) obs.markerActuallyClose++;
      if (distance(defender, defendingTeam.goal) < distance(defender._markRef, defendingTeam.goal)) obs.markerGoalSide++;
    }
  }
}

function runOne(db, row, index) {
  srand(Number(row.seed));
  const sim = new MatchSim(teamFor(db, row, true, index), teamFor(db, row, false, index), { neutral: true, labMode: true });
  sim.teams[0].formKey = row.homeFormation;
  sim.teams[1].formKey = row.awayFormation;
  const obs = blankObservation();

  // ── TRACE CAUSAL (--trace): buffer rolante de tudo que troca a posse.
  // Puramente observacional: nenhuma decisão do motor depende dele. Quando uma
  // trava fecha, o recorte da janela é anexado como evidência da CAUSA.
  const TRACE = !!argv.trace;
  const traceBuf = [];   // {step, t, kind, detail}
  const TRACE_CAP = 4000;
  const pname = p => p ? `${p.team}:${(p.ref && p.ref.n) || p.id || p.idx}` : 'null';
  const rec = (step, kind, detail) => {
    if (!TRACE) return;
    traceBuf.push({ step, kind, detail });
    if (traceBuf.length > TRACE_CAP) traceBuf.shift();
  };

  const originalEmit = sim._emit;
  sim._emit = function(type, data) {
    obs.events[type] = (obs.events[type] || 0) + 1;
    if (type === 'throw_in') obs.throwIns++;
    if (TRACE) rec(currentStep, 'emit:' + type,
      data && (data.by || data.on) ? `by=${pname(data.by)} on=${pname(data.on)}${data.source ? ' src=' + data.source : ''}` : '');
    return originalEmit.apply(this, arguments);
  };
  if (TRACE) {
    const oContest = sim._contestLoose;
    sim._contestLoose = function() {
      const b = this.ball;
      const near = [];
      for (const tm of this.teams) for (const p of tm.players) {
        if (p.red) continue;
        const dd = Math.hypot(p.x - b.x, p.y - b.y);
        if (dd < 6) near.push(`${pname(p)}@${dd.toFixed(2)}`);
      }
      near.sort();
      rec(currentStep, 'contestLoose', `ball=(${b.x.toFixed(1)},${b.y.toFixed(1)}) cands=[${near.join(' ')}]`);
      return oContest.apply(this, arguments);
    };
    const oGive = sim._giveBall;
    sim._giveBall = function(p) {
      rec(currentStep, 'giveBall', `${pname(p)} settle=${p ? (+p.settle || 0).toFixed(2) : '-'}`);
      return oGive.apply(this, arguments);
    };
    const oTurn = sim._turnover;
    sim._turnover = function(d) {
      rec(currentStep, 'turnover', `to=${pname(d)}`);
      return oTurn.apply(this, arguments);
    };
    // Portão de decisão: prova se _decide é sequer alcançado e, quando é, se
    // termina em ação. Sem isso não dá para distinguir "não decidiu" de
    // "decidiu e a ação não começou".
    const oDecide = sim._decide;
    sim._decide = function(o) {
      const acted = [];
      const spy = ['_pass', '_shoot', '_dribble', '_carry', '_cross', '_clearBall'].map(fn => {
        const orig = this[fn];
        if (typeof orig !== 'function') return null;
        this[fn] = function() { acted.push(fn); this[fn] = orig; return orig.apply(this, arguments); };
        return [fn, orig];
      }).filter(Boolean);
      try {
        return oDecide.apply(this, arguments);
      } finally {
        for (const [fn, orig] of spy) this[fn] = orig;
        rec(currentStep, 'decide', `${pname(o)} -> ${acted.length ? acted.join(',') : 'NENHUMA AÇÃO'}`);
      }
    };
  }
  let currentStep = 0;
  const originalBallOut = sim._ballOut;
  sim._ballOut = function() {
    const ball = this.ball;
    if (ball.x <= 0 || ball.x >= 105) {
      const lastTeam = ball.lastTouch ? ball.lastTouch.team : this.poss;
      const lineX = ball.x >= 105 ? 105 : 0;
      const attacking = this.teams[0].oppGoal.x === lineX ? 0 : 1;
      if (lastTeam !== attacking) obs.cornersFromBoundary++;
      else obs.goalKicks++;
    } else if (!(global.CDS_R13 && typeof this.getR13Audit === 'function')) {
      obs.throwIns++;
    }
    return originalBallOut.apply(this, arguments);
  };

  // ── SONDA DE TRAVA DE BOLA (motor puro, sem render) ──────────────────────
  // A cada tick registra pos+dono da bola e detecta janelas em que a bola fica
  // num raio pequeno com o dono restrito a <=2 atletas por muito tempo de jogo.
  const aidBall = b => { const o = b && b.owner; if (!o) return null; const r = o.ref && o.ref.n; return (o.team != null ? o.team : '?') + ':' + (r || o.id || o.idx || '?'); };
  const isAdmin = s => !!s.__p04AdminPermit || (+s.dead > 0) || !!s.pendingRestart || !!s.waiting || !!s.deadBall;
  const DT = 1 / 30;
  const locks = [];
  let win = null; // {startStep, x0, y0, owners:Set, minute0}
  let steps = 0;
  while (!sim.isOver() && steps++ < 500000) {
    currentStep = steps;
    sim.step(DT);
    if (TRACE && steps % 15 === 0 && sim.ball.owner) {
      const ow = sim.ball.owner;
      rec(steps, 'estado',
        `dono=${pname(ow)} settle=${(+ow.settle || 0).toFixed(2)} decideT=${(+sim.decideT || 0).toFixed(2)}` +
        ` traveling=${!!sim.ball.traveling} possT=${(+sim.possT || 0).toFixed(1)}` +
        ` setPieceUntil=${(+ow._setPieceDeliveryUntil || 0).toFixed(2)} t=${(+sim.t || 0).toFixed(2)}`);
    }
    if (steps % 15 === 0) observe(sim, obs, row);
    if (isAdmin(sim)) { win = null; continue; }   // ignora bola parada / reposições
    const b = sim.ball; const bx = +b.x, by = +b.y, own = aidBall(b);
    if (!win) { win = { s0: steps, x0: bx, y0: by, owners: new Set([own]), min0: sim.minute, changes: 0, lastOwn: own, dwell: 0, maxDwell: 0 }; }
    else {
      const moved = Math.hypot(bx - win.x0, by - win.y0);
      if (own !== win.lastOwn) { win.changes++; win.maxDwell = Math.max(win.maxDwell, win.dwell); win.dwell = 0; win.lastOwn = own; }
      else win.dwell++;
      if (moved > 4.0) {
        const durSec = (steps - win.s0) * DT;          // segundos de JOGO parados no ponto
        const distinct = [...win.owners].filter(Boolean);
        win.maxDwell = Math.max(win.maxDwell, win.dwell);
        if (durSec >= 3.0 && distinct.length <= 2 && distinct.length >= 1) {
          const lock = { startMin: +win.min0.toFixed(2), gameSec: +durSec.toFixed(1), ticks: steps - win.s0,
            owners: distinct, twoPlayers: distinct.length === 2, x: +win.x0.toFixed(1), y: +win.y0.toFixed(1),
            ownerChanges: win.changes, maxDwellSec: +(win.maxDwell * DT).toFixed(1),
            kind: win.changes >= 6 ? 'pingpong' : (win.maxDwell * DT >= durSec * 0.55 ? 'dwell' : 'misto') };
          if (TRACE) {
            // recorte da janela + 1s antes e depois (eventos anteriores/posteriores)
            const from = win.s0 - 30, to = steps + 30;
            lock.trace = traceBuf.filter(e => e.step >= from && e.step <= to)
              .map(e => `${((e.step - win.s0) * DT).toFixed(2)}s ${e.kind} ${e.detail}`);
          }
          locks.push(lock);
        }
        win = { s0: steps, x0: bx, y0: by, owners: new Set([own]), min0: sim.minute, changes: 0, lastOwn: own, dwell: 0, maxDwell: 0 };
      } else { win.owners.add(own); }
    }
  }
  const worst = locks.slice().sort((a, b) => b.gameSec - a.gameSec).slice(0, 6);
  const canonical = typeof sim.getR12Audit === 'function' ? sim.getR12Audit() : null;
  const observedFootball = typeof sim.getR13Audit === 'function' ? sim.getR13Audit() : null;
  return {
    index,
    stallFires: sim.__stallFire || 0,
    lockCount: locks.length,
    lockMaxSec: locks.reduce((m, l) => Math.max(m, l.gameSec), 0),
    lockTwoPlayer: locks.filter(l => l.twoPlayers).length,
    worstLocks: worst,
    seed: Number(row.seed),
    formations: [row.homeFormation, row.awayFormation],
    styles: [row.homeStyle, row.awayStyle],
    completed: sim.isOver(),
    score: sim.score.slice(),
    stats: sim.stats.map((stat, side) => ({
      goals: stat.goals || 0,
      shots: stat.shots || 0,
      passes: stat.passes || 0,
      passOk: stat.passOk || 0,
      corners: stat.corners || 0,
      offsides: stat.offsides || 0,
      cornerGoals: canonical && canonical.team && canonical.team[side] ? canonical.team[side].cornerGoals || 0 : stat.cornerGoals || 0,
      setPieceGoals: stat.setPieceGoals || 0,
      throwIns: stat.throwIns || 0,
      goalKicks: stat.goalKicks || 0,
      touchlineErrors: stat.touchlineErrors || 0,
      touchlineDuels: stat.touchlineDuels || 0,
      offsideTraps: stat.offsideTraps || 0
    })),
    canonicalStatus: canonical && canonical.status,
    observedFootball,
    observer: obs
  };
}

function sumMatch(results) {
  const total = blankObservation();
  for (const result of results) {
    const obs = result.observer;
    for (const key of Object.keys(total)) {
      if (key === 'lineWorst' || key === 'events') continue;
      if (key === 'markerDistanceMax' || key === 'defensiveLineRangeMax') total[key] = Math.max(total[key], Number(obs[key]) || 0);
      else total[key] += Number(obs[key]) || 0;
    }
    for (const [type, count] of Object.entries(obs.events)) total.events[type] = (total.events[type] || 0) + count;
  }
  const matches = results.length || 1;
  const allStats = results.flatMap(result => result.stats);
  const sum = key => allStats.reduce((acc, stat) => acc + (Number(stat[key]) || 0), 0);
  const goals = sum('goals');
  const corners = sum('corners');
  const cornerGoals = sum('cornerGoals');
  return {
    matches: results.length,
    completed: results.filter(result => result.completed).length,
    canonicalStatuses: results.reduce((acc, result) => {
      const key = result.canonicalStatus || 'NONE';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
    perMatch: {
      goals: goals / matches,
      shots: sum('shots') / matches,
      passes: sum('passes') / matches,
      corners: corners / matches,
      offsides: sum('offsides') / matches,
      throwIns: total.throwIns / matches
    },
    setPieces: {
      cornerGoals,
      cornerGoalShare: goals ? cornerGoals / goals : 0,
      cornerConversion: corners ? cornerGoals / corners : 0,
      goalKicks: sum('goalKicks') / matches,
      touchlineErrors: sum('touchlineErrors') / matches,
      touchlineDuels: sum('touchlineDuels') / matches,
      offsideTraps: sum('offsideTraps') / matches
    },
    humanObserver: {
      uncoveredThreatRate: total.dangerousAttackers ? total.uncoveredAttackers / total.dangerousAttackers : 0,
      goalSideCoverageRate: total.dangerousAttackers ? total.goalSideCovered / total.dangerousAttackers : 0,
      markerCloseRate: total.markerAssignments ? total.markerActuallyClose / total.markerAssignments : 0,
      markerGoalSideRate: total.markerAssignments ? total.markerGoalSide / total.markerAssignments : 0,
      markerMeanDistance: total.markerAssignments ? total.markerDistanceSum / total.markerAssignments : 0,
      markerMaxDistance: total.markerDistanceMax,
      defensiveLineMeanRange: total.defensiveSamples ? total.defensiveLineRangeSum / total.defensiveSamples : 0,
      defensiveLineMaxRange: total.defensiveLineRangeMax,
      disconnectedLineRate: total.defensiveSamples ? total.disconnectedLines / total.defensiveSamples : 0,
      overload424UncoveredRate: total.overload424Samples ? total.overload424Uncovered / total.overload424Samples : 0,
      spatialOverloadUncoveredRate: total.spatialOverloadSamples ? total.spatialOverloadUncovered / total.spatialOverloadSamples : 0,
      bodyOrientationMismatchRate: total.controlledBallSamples ? total.bodyOrientationMismatch / total.controlledBallSamples : 0
    },
    events: total.events
  };
}

function makeMatrixRows(db, repeats) {
  const requestedCountry = String(argv.team || 'Brasil');
  const requestedYear = Number(argv.year || 1970);
  const squad = db.squads.find(item => item.c === requestedCountry && Number(item.y) === requestedYear) || db.squads[0];
  if (!squad) throw new Error('Nenhum elenco disponível para a matriz de formações.');
  const rows = [];
  for (let repeat = 0; repeat < repeats; repeat++) {
    for (let h = 0; h < FORMATION_KEYS.length; h++) {
      for (let a = 0; a < FORMATION_KEYS.length; a++) {
        const lo = Math.min(h, a), hi = Math.max(h, a);
        rows.push({
          index: rows.length,
          seed: 1310000 + repeat * 100000 + lo * 1000 + hi * 17,
          homeTeam: squad.c,
          homeYear: String(squad.y),
          homeFormation: FORMATION_KEYS[h],
          homeStyle: 'balanced',
          homeVariation: repeat % FORMATIONS[FORMATION_KEYS[h]].variations.length,
          awayTeam: squad.c,
          awayYear: String(squad.y),
          awayFormation: FORMATION_KEYS[a],
          awayStyle: 'balanced',
          awayVariation: repeat % FORMATIONS[FORMATION_KEYS[a]].variations.length
        });
      }
    }
  }
  return { kind: 'formations', rows, squad: { country: squad.c, year: Number(squad.y) } };
}

function makeStyleRows(db, repeats) {
  const requestedCountry = String(argv.team || 'Brasil');
  const requestedYear = Number(argv.year || 1970);
  const formation = String(argv.formation || '4-3-3');
  const squad = db.squads.find(item => item.c === requestedCountry && Number(item.y) === requestedYear) || db.squads[0];
  if (!squad || !FORMATIONS[formation]) throw new Error('Elenco ou formação inválida para a matriz de estilos.');
  const rows = [];
  for (let repeat = 0; repeat < repeats; repeat++) {
    for (let h = 0; h < STYLE_KEYS.length; h++) {
      for (let a = 0; a < STYLE_KEYS.length; a++) {
        const lo = Math.min(h, a), hi = Math.max(h, a);
        rows.push({
          index: rows.length,
          seed: 1710000 + repeat * 100000 + lo * 1000 + hi * 29,
          homeTeam: squad.c, homeYear: String(squad.y),
          homeFormation: formation, homeStyle: STYLE_KEYS[h], homeVariation: repeat % FORMATIONS[formation].variations.length,
          awayTeam: squad.c, awayYear: String(squad.y),
          awayFormation: formation, awayStyle: STYLE_KEYS[a], awayVariation: repeat % FORMATIONS[formation].variations.length
        });
      }
    }
  }
  return { kind: 'styles', rows, squad: { country: squad.c, year: Number(squad.y) }, formation };
}

function formationBalance(results) {
  const table = Object.fromEntries(FORMATION_KEYS.map(key => [key, {
    formation: key, matches: 0, wins: 0, draws: 0, losses: 0,
    points: 0, goalsFor: 0, goalsAgainst: 0, shotsFor: 0, shotsAgainst: 0,
    passes: 0, corners: 0, offsides: 0
  }]));
  for (const result of results) {
    for (let side = 0; side < 2; side++) {
      const key = result.formations[side], item = table[key];
      const gf = Number(result.score[side]) || 0, ga = Number(result.score[1 - side]) || 0;
      item.matches++; item.goalsFor += gf; item.goalsAgainst += ga;
      item.shotsFor += Number(result.stats[side].shots) || 0;
      item.shotsAgainst += Number(result.stats[1 - side].shots) || 0;
      item.passes += Number(result.stats[side].passes) || 0;
      item.corners += Number(result.stats[side].corners) || 0;
      item.offsides += Number(result.stats[side].offsides) || 0;
      if (gf > ga) { item.wins++; item.points += 3; }
      else if (gf < ga) item.losses++;
      else { item.draws++; item.points++; }
    }
  }
  const formations = Object.values(table).map(item => ({
    ...item,
    ppg: item.matches ? item.points / item.matches : 0,
    winRate: item.matches ? item.wins / item.matches : 0,
    goalDiffPerMatch: item.matches ? (item.goalsFor - item.goalsAgainst) / item.matches : 0,
    shotDiffPerMatch: item.matches ? (item.shotsFor - item.shotsAgainst) / item.matches : 0,
    goalsForPerMatch: item.matches ? item.goalsFor / item.matches : 0,
    passesPerMatch: item.matches ? item.passes / item.matches : 0
  })).sort((a, b) => b.ppg - a.ppg || b.goalDiffPerMatch - a.goalDiffPerMatch);
  const ppg = formations.map(item => item.ppg);
  const gd = formations.map(item => Math.abs(item.goalDiffPerMatch));
  return {
    formations,
    gates: {
      allFormationsCovered: formations.length === FORMATION_KEYS.length && formations.every(item => item.matches > 0),
      ppgRange: Math.max(...ppg) - Math.min(...ppg),
      maxAbsGoalDiffPerMatch: Math.max(...gd),
      noDominantFormation: Math.max(...ppg) - Math.min(...ppg) <= 0.65 && Math.max(...gd) <= 0.55
    }
  };
}

function styleBalance(results) {
  const table = Object.fromEntries(STYLE_KEYS.map(key => [key, {
    style: key, matches: 0, wins: 0, draws: 0, losses: 0, points: 0,
    goalsFor: 0, goalsAgainst: 0, shotsFor: 0, shotsAgainst: 0,
    passes: 0, corners: 0, offsides: 0
  }]));
  for (const result of results) {
    for (let side = 0; side < 2; side++) {
      const item = table[result.styles[side]];
      const gf = Number(result.score[side]) || 0, ga = Number(result.score[1 - side]) || 0;
      item.matches++; item.goalsFor += gf; item.goalsAgainst += ga;
      item.shotsFor += Number(result.stats[side].shots) || 0;
      item.shotsAgainst += Number(result.stats[1 - side].shots) || 0;
      item.passes += Number(result.stats[side].passes) || 0;
      item.corners += Number(result.stats[side].corners) || 0;
      item.offsides += Number(result.stats[side].offsides) || 0;
      if (gf > ga) { item.wins++; item.points += 3; }
      else if (gf < ga) item.losses++;
      else { item.draws++; item.points++; }
    }
  }
  const styles = Object.values(table).map(item => ({
    ...item,
    ppg: item.points / item.matches,
    winRate: item.wins / item.matches,
    goalDiffPerMatch: (item.goalsFor - item.goalsAgainst) / item.matches,
    shotsPerMatch: item.shotsFor / item.matches,
    passesPerMatch: item.passes / item.matches,
    cornersPerMatch: item.corners / item.matches,
    goalsForPerMatch: item.goalsFor / item.matches
  })).sort((a, b) => b.ppg - a.ppg || b.goalDiffPerMatch - a.goalDiffPerMatch);
  const ppg = styles.map(item => item.ppg), gd = styles.map(item => Math.abs(item.goalDiffPerMatch));
  const park = styles.find(item => item.style === 'park');
  const balanced = styles.find(item => item.style === 'balanced');
  const tiki = styles.find(item => item.style === 'tiki');
  const medianPasses = styles.map(item => item.passesPerMatch).sort((a, b) => a - b)[Math.floor(styles.length / 2)];
  const ppgRange = Math.max(...ppg) - Math.min(...ppg), maxAbsGoalDiffPerMatch = Math.max(...gd);
  return {
    styles,
    gates: {
      allStylesCovered: styles.length === STYLE_KEYS.length && styles.every(item => item.matches > 0),
      ppgRange,
      maxAbsGoalDiffPerMatch,
      noDominantStyle: ppgRange <= 0.75 && maxAbsGoalDiffPerMatch <= 0.65,
      parkIdentity: !!park && !!balanced && park.shotsPerMatch <= balanced.shotsPerMatch + 0.35 && park.passesPerMatch <= medianPasses,
      tikiIdentity: !!tiki && tiki.passesPerMatch >= medianPasses
    }
  };
}

const hash = loadBuild(BUILD);
const db = buildDB(DATA);
const repeats = Math.max(1, Number(argv.repeats || 1));
const matrix = argv.styleMatrix ? makeStyleRows(db, repeats) : argv.matrix ? makeMatrixRows(db, repeats) : null;
const rows = matrix ? matrix.rows : parseCSV(fs.readFileSync(CSV, 'utf8'));
const results = [];
const effectiveEnd = argv.end == null && matrix ? rows.length : Math.min(rows.length, END);
for (let index = START; index < effectiveEnd; index++) {
  const r = runOne(db, rows[index], index);
  results.push(r);
  realConsole.error(`[lock] partida ${index} seed=${r.seed} ${r.formations.join(' x ')} | travas=${r.lockCount} (2-jogadores=${r.lockTwoPlayer}) maxTrava=${r.lockMaxSec}s de jogo`);
  if (r.worstLocks && r.worstLocks[0])
    realConsole.error(`        pior: ${r.worstLocks[0].gameSec}s @${r.worstLocks[0].startMin}' donos=${JSON.stringify(r.worstLocks[0].owners)} 2p=${r.worstLocks[0].twoPlayers}`);
}
const allLocks = results.flatMap(r => r.worstLocks || []);
realConsole.error(`\n=== RESUMO: ${results.length} partidas | travas totais=${results.reduce((n,r)=>n+r.lockCount,0)} | 2-jogadores=${results.reduce((n,r)=>n+r.lockTwoPlayer,0)} | pior de todas=${Math.max(0,...results.map(r=>r.lockMaxSec))}s de jogo ===`);
const output = {
  build: global.CDS_R13 && global.CDS_R13.version || global.CDS_R12 && global.CDS_R12.version || 'unknown',
  sha256: hash,
  range: [START, effectiveEnd],
  summary: sumMatch(results),
  matrix: matrix ? {
    kind: matrix.kind, squad: matrix.squad, formation: matrix.formation || null, repeats,
    ...(matrix.kind === 'styles' ? styleBalance(results) : formationBalance(results))
  } : null,
  results
};
fs.writeFileSync(OUT, JSON.stringify(output, null, 2));
realConsole.log(JSON.stringify({ out: OUT, build: output.build, summary: output.summary }, null, 2));
