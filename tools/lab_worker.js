#!/usr/bin/env node
'use strict';
const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const ROOT = workerData.root;
const context = globalThis;
context.window = context;
context.performance = performance;
context.CanvasRenderingContext2D = undefined;
context.__cdsDebugWarn = () => {};
context.__cdsDebugLog = () => {};
const scripts = [
  'src/scripts/00-polyfills.js',
  'src/scripts/10-data.js',
  'src/scripts/20-core.js',
  'src/scripts/25-data-integrity-v3.js',
  'src/scripts/30-tactics.js',
  'src/scripts/40-match-engine-and-manager-ai.js'
];
for (const rel of scripts) {
  const code = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  new Function('window','globalThis','module','require', code + '\n//# sourceURL=' + rel)(context, context, undefined, undefined);
}
const db = context.buildDB(context.DATA);

function teamFromSpec(spec) {
  const sourceSquad = db.squads[spec.squadIndex];
  if (!sourceSquad) throw new Error('squadIndex inválido: ' + spec.squadIndex);
  // Cada partida recebe uma cópia isolada. O motor e os caches de atributos
  // podem acrescentar campos temporários sem contaminar a próxima simulação.
  const squad = structuredClone(sourceSquad);
  const form = spec.form || '4-3-3';
  const variation = Number.isInteger(spec.variation) ? spec.variation : 0;
  const line = context.autoLineup(squad, form, variation);
  return {
    squad,
    name: squad.c,
    flag: squad.f || '',
    color: '#ffffff',
    lineup: line.lineup,
    bench: line.bench,
    style: spec.style || 'balanced',
    axes: Object.assign({}, context.STYLE_AXES[spec.style || 'balanced']),
    atkForm: spec.atkForm || form,
    defForm: spec.defForm || form,
    varIdx: variation
  };
}

function avgStamina(team) {
  const active = team.players.filter(p => !p.red);
  return active.length ? active.reduce((s, p) => s + p.stamina, 0) / active.length : 0;
}

function runJob(job) {
  context.srand(job.seed >>> 0);
  const eventCounts = Object.create(null);
  const goalMinutes = [];
  const sim = new context.MatchSim(teamFromSpec(job.a), teamFromSpec(job.b), {
    neutral: job.neutral !== false,
    knockout: !!job.knockout,
    labMode: true,
    onEvent: ev => {
      eventCounts[ev.type] = (eventCounts[ev.type] || 0) + 1;
      if (ev.type === 'goal') goalMinutes.push(ev.minute == null ? Math.floor(sim.minute) : ev.minute);
    }
  });
  sim.setInteractive(-1);
  let steps = 0;
  const dt = job.dt || workerData.dt || 0.08;
  const maxSteps = Math.ceil(170 / (context.ENGINE_CALIBRATION.timing.clockRate * dt)) + 20000;
  while (!sim.isOver() && steps++ < maxSteps) sim.step(dt);
  if (!sim.isOver()) throw new Error(`Partida não terminou: ${job.id}, minuto=${sim.minute}, steps=${steps}`);
  const s0 = sim.stats[0], s1 = sim.stats[1];
  const possTotal = (s0.possTime || 0) + (s1.possTime || 0) || 1;
  const scoreA = sim.score[0], scoreB = sim.score[1];
  const totalGoals = scoreA + scoreB;
  const totalShots = s0.shots + s1.shots;
  const totalPasses = s0.passes + s1.passes;
  const totalPassOk = s0.passOk + s1.passOk;
  const totalSetPieceGoals = s0.setPieceGoals + s1.setPieceGoals;
  return {
    id: job.id,
    suite: job.suite,
    group: job.group || job.suite,
    seed: job.seed,
    meta: job.meta || {},
    teams: [
      { squadIndex: job.a.squadIndex, name: sim.teams[0].name, rating: sim.teams[0].squad.r, style: job.a.style, form: job.a.form, variation: job.a.variation || 0 },
      { squadIndex: job.b.squadIndex, name: sim.teams[1].name, rating: sim.teams[1].squad.r, style: job.b.style, form: job.b.form, variation: job.b.variation || 0 }
    ],
    score: [scoreA, scoreB],
    goals: totalGoals,
    shots: totalShots,
    onTarget: s0.onTarget + s1.onTarget,
    xg: s0.xg + s1.xg,
    passes: totalPasses,
    passOk: totalPassOk,
    possession: [(s0.possTime || 0) / possTotal, (s1.possTime || 0) / possTotal],
    fouls: s0.fouls + s1.fouls,
    yellow: s0.yellow + s1.yellow,
    red: s0.red + s1.red,
    corners: s0.corners + s1.corners,
    tackles: s0.tackles + s1.tackles,
    interceptions: s0.interceptions + s1.interceptions,
    crosses: [s0.crosses, s1.crosses],
    lowCrosses: [s0.lowCrosses, s1.lowCrosses],
    throughBalls: [s0.throughBalls, s1.throughBalls],
    pressWins: [s0.pressWins, s1.pressWins],
    defErrors: [s0.defErrors, s1.defErrors],
    oneOnOnes: [s0.oneOnOnes, s1.oneOnOnes],
    setPieceShots: s0.setPieceShots + s1.setPieceShots,
    setPieceGoals: totalSetPieceGoals,
    goalMinutes,
    stamina: [avgStamina(sim.teams[0]), avgStamina(sim.teams[1])],
    teamStats: [s0,s1].map((s,side)=>({
      goals:s.goals,shots:s.shots,onTarget:s.onTarget,xg:s.xg,passes:s.passes,passOk:s.passOk,
      fouls:s.fouls,yellow:s.yellow,red:s.red,corners:s.corners,tackles:s.tackles,interceptions:s.interceptions,
      crosses:s.crosses,lowCrosses:s.lowCrosses,lowCrossesOk:s.lowCrossesOk,throughBalls:s.throughBalls,throughOk:s.throughOk,
      pressWins:s.pressWins,defErrors:s.defErrors,oneOnOnes:s.oneOnOnes,setPieceShots:s.setPieceShots,setPieceGoals:s.setPieceGoals,
      poss:(s.possTime||0)/possTotal,stamina:side===0?avgStamina(sim.teams[0]):avgStamina(sim.teams[1])
    })),
    eventCounts,
    steps,
    dt
  };
}

parentPort.on('message', message => {
  if (message.type !== 'run') return;
  const started = performance.now();
  const results = [];
  const errors = [];
  for (let ji=0; ji<message.jobs.length; ji++) {
    const job=message.jobs[ji];
    try { results.push(runJob(job)); }
    catch (error) { errors.push({ id: job.id, error: String(error && error.stack || error) }); }
    if (workerData.progress) parentPort.postMessage({type:'progress',batchId:message.batchId,index:ji+1,total:message.jobs.length,id:job.id});
  }
  parentPort.postMessage({ type: 'done', batchId: message.batchId, results, errors, ms: performance.now() - started });
  parentPort.close();
});
