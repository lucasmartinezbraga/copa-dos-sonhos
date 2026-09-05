#!/usr/bin/env node
'use strict';

const fs = require('fs');
const crypto = require('crypto');

const args = process.argv.slice(2);
const outArg = args.find(value => value.startsWith('--out='));
const kindArg = args.find(value => value.startsWith('--kind='));
const mergeKind = kindArg ? kindArg.slice(7) : 'formations';
const outputPath = outArg ? outArg.slice(6) : 'R13.0_MATRIZ_FORMACOES.json';
const inputPaths = args.filter(value => !value.startsWith('--'));
if (!inputPaths.length) throw new Error('Informe ao menos um arquivo de matriz.');

const chunks = inputPaths.map(path => JSON.parse(fs.readFileSync(path, 'utf8')));
const results = chunks.flatMap(chunk => chunk.results || []).sort((a, b) => a.index - b.index);

function blankObservation() {
  return {
    samples: 0, defensiveSamples: 0, dangerousAttackers: 0, uncoveredAttackers: 0,
    goalSideCovered: 0, markerAssignments: 0, markerActuallyClose: 0,
    markerGoalSide: 0, markerDistanceSum: 0, markerDistanceMax: 0,
    defensiveLineRangeSum: 0, defensiveLineRangeMax: 0, disconnectedLines: 0,
    overload424Samples: 0, overload424Uncovered: 0,
    spatialOverloadSamples: 0, spatialOverloadUncovered: 0,
    controlledBallSamples: 0, bodyOrientationMismatch: 0,
    throwIns: 0, goalKicks: 0, cornersFromBoundary: 0, events: Object.create(null)
  };
}

function summarizeMatches(items) {
  const total = blankObservation();
  for (const result of items) {
    const obs = result.observer || {};
    for (const key of Object.keys(total)) {
      if (key === 'events') continue;
      if (key === 'markerDistanceMax' || key === 'defensiveLineRangeMax')
        total[key] = Math.max(total[key], Number(obs[key]) || 0);
      else total[key] += Number(obs[key]) || 0;
    }
    for (const [type, count] of Object.entries(obs.events || {}))
      total.events[type] = (total.events[type] || 0) + count;
  }
  const matchCount = items.length || 1;
  const allStats = items.flatMap(result => result.stats || []);
  const sum = key => allStats.reduce((acc, stat) => acc + (Number(stat[key]) || 0), 0);
  const goals = sum('goals'), corners = sum('corners'), cornerGoals = sum('cornerGoals');
  return {
    matches: items.length,
    completed: items.filter(result => result.completed).length,
    canonicalStatuses: items.reduce((acc, result) => {
      const key = result.canonicalStatus || 'NONE';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
    perMatch: {
      goals: goals / matchCount, shots: sum('shots') / matchCount,
      passes: sum('passes') / matchCount, corners: corners / matchCount,
      offsides: sum('offsides') / matchCount, throwIns: total.throwIns / matchCount
    },
    setPieces: {
      cornerGoals,
      cornerGoalShare: goals ? cornerGoals / goals : 0,
      cornerConversion: corners ? cornerGoals / corners : 0,
      goalKicks: sum('goalKicks') / matchCount,
      touchlineErrors: sum('touchlineErrors') / matchCount,
      touchlineDuels: sum('touchlineDuels') / matchCount,
      offsideTraps: sum('offsideTraps') / matchCount
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

function summarizeFormations(items) {
  const keys = [...new Set(items.flatMap(item => item.formations))].sort();
  const table = Object.fromEntries(keys.map(key => [key, {
    formation: key, matches: 0, wins: 0, draws: 0, losses: 0, points: 0,
    goalsFor: 0, goalsAgainst: 0, shotsFor: 0, shotsAgainst: 0,
    passes: 0, corners: 0, offsides: 0
  }]));
  for (const result of items) {
    for (let side = 0; side < 2; side++) {
      const item = table[result.formations[side]];
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
    ppg: item.points / item.matches,
    winRate: item.wins / item.matches,
    goalDiffPerMatch: (item.goalsFor - item.goalsAgainst) / item.matches,
    shotDiffPerMatch: (item.shotsFor - item.shotsAgainst) / item.matches,
    goalsForPerMatch: item.goalsFor / item.matches,
    passesPerMatch: item.passes / item.matches
  })).sort((a, b) => b.ppg - a.ppg || b.goalDiffPerMatch - a.goalDiffPerMatch);
  const ppg = formations.map(item => item.ppg), gd = formations.map(item => Math.abs(item.goalDiffPerMatch));
  const ppgRange = Math.max(...ppg) - Math.min(...ppg);
  const maxAbsGoalDiffPerMatch = Math.max(...gd);
  return {
    formations,
    gates: {
      all17FormationsCovered: formations.length === 17 && formations.every(item => item.matches > 0),
      ppgRange,
      maxAbsGoalDiffPerMatch,
      ppgRangeGate: ppgRange <= 0.65,
      goalDiffGate: maxAbsGoalDiffPerMatch <= 0.55,
      noDominantFormation: ppgRange <= 0.65 && maxAbsGoalDiffPerMatch <= 0.55
    }
  };
}

const summary = summarizeMatches(results);
const balance = summarizeFormations(results);
const first = chunks[0] || {};
const payload = {
  build: first.build || 'unknown',
  sha256: first.sha256 || null,
  sourceChunks: inputPaths,
  resultDigest: crypto.createHash('sha256').update(JSON.stringify(results.map(result => [result.seed, result.formations, result.score]))).digest('hex'),
  matrix: mergeKind === 'batch' ? null : {
    squad: first.matrix && first.matrix.squad,
    repeats: Math.max(...chunks.map(chunk => Number(chunk.matrix && chunk.matrix.repeats) || 1)),
    orderedMatches: results.length,
    ...balance
  },
  summary,
  results
};

fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
console.log(JSON.stringify({
  outputPath,
  build: payload.build,
  matrix: payload.matrix ? payload.matrix.gates : null,
  summary
}, null, 2));
