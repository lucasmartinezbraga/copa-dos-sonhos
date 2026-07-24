#!/usr/bin/env node
'use strict';
/**
 * §24/§25 — DIFERENCIAÇÃO INDIVIDUAL 97 / 90 / 80 / 70.
 *
 * O handoff registra que esta métrica NUNCA existiu: "habilidade importa" era
 * hipótese. Aqui ela vira medição.
 *
 * Método: dois times de laboratório com TODOS os atributos em 82. Um único
 * jogador — mesma posição, mesma função, mesmos companheiros, mesmos
 * adversários, mesma seed, mesmo estilo — tem seus atributos trocados por
 * 97, 90, 80 ou 70. Nada mais muda entre os braços.
 *
 * O §24 exige duas propriedades, e as duas são medidas separadamente:
 *
 *   (a) MONOTONICIDADE — 97 > 90 > 80 > 70 nas ações que dependem do atributo.
 *   (b) A vantagem CRESCE COM A DIFICULDADE — num passe curto sem pressão a
 *       diferença deve ser pequena; sob marcação em cima, grande.
 *
 * Por isso toda ação é classificada pela pressão real no instante em que
 * acontece (distância ao adversário mais próximo), e não agregada num número só.
 *
 * Uso:
 *   node tools/r15/skill_tiers.js --build="dist/....html" [--seeds=40] [--pos=CAM]
 *        [--out=reports/r15/skill-tiers.json]
 */
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');

const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v == null ? true : v];
}));

const BUILD = argv.build;
const SEEDS = Number(argv.seeds || 40);
// 4-3-3 escala GK,LB,CB,CB,RB,CM,CDM,CM,LW,ST,RW — não existe CAM aqui.
// O sujeito precisa ser um slot que a formação realmente possua, senão nenhuma
// ação lhe é atribuída e a medição sai vazia (parecendo aprovação).
const POS = String(argv.pos || 'CM');
const OUT = argv.out || 'reports/r15/skill-tiers.json';
const TIERS = [97, 90, 80, 70];

function noop() {}
function define(name, value) {
  try { Object.defineProperty(global, name, { value, writable: true, configurable: true }); }
  catch (_) { global[name] = value; }
}
define('window', global);
define('self', global);
define('navigator', { userAgent: 'cds-skill-tiers', language: 'pt-BR' });
define('location', { href: 'runner://skill', search: '', hash: '' });
define('performance', { now: () => 0 });
define('crypto', crypto.webcrypto);
define('requestAnimationFrame', noop);
define('cancelAnimationFrame', noop);
define('localStorage', {
  _d: {}, getItem(k) { return this._d[k] == null ? null : this._d[k]; },
  setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; }, clear() { this._d = {}; }
});
const realConsole = console;
define('console', Object.assign({}, console, { log: noop, info: noop, warn: noop, debug: noop }));

const SKIP_IDS = new Set([
  'cds-2_5d-gate-a-contracts-v02', 'cds-pre25d-runtime-auditor-v04',
  'cds-r109-async-cup', 'cds-mobile-boot-bridge', 'cds-ux-boot',
]);

function loadBuild(path) {
  const html = fs.readFileSync(path, 'utf8');
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  let m, i = 0;
  while ((m = re.exec(html))) {
    const id = (m[1].match(/id="([^"]+)"/) || [])[1] || `script-${i}`;
    i++;
    if (SKIP_IDS.has(id)) continue;
    try { vm.runInThisContext(m[2], { filename: `${id}.js` }); }
    catch (e) {
      if (/^script-\d+$/.test(id) && /document is not defined/.test(String(e && e.message))) continue;
      throw e;
    }
  }
  return crypto.createHash('sha256').update(html).digest('hex');
}

// ── construção dos times de laboratório ─────────────────────────────────────
function labPlayer(position, index, level) {
  const keys = (global.CDSDataV3 && Array.isArray(global.CDSDataV3.attributes))
    ? global.CDSDataV3.attributes : [];
  return {
    id: `LAB_${position}_${index}`,
    n: `Atleta ${index + 1}${level !== 82 ? ` [${level}]` : ''}`,
    slot: position, pos: position, r: level, starter: 1,
    traits: [], behaviorTraits: [], naturalRoles: [],
    a8: [level, level, level, level, level, level, level, level],
    attributesV3: Object.fromEntries(keys.map(k => [k, level])),
    profileV3: {
      dominantFoot: 'R', weakFoot: 4,
      heightCmSim: position === 'GK' ? 190 : 182,
      bodyType: 'average', primaryPosition: position
    },
    _a: {}
  };
}

/** Devolve {team, subjectId} — subject é o slot POS com atributos `level`. */
function makeTeam(db, formation, style, home, level, subjectPos) {
  const squad = db.squads[0];
  const picked = autoLineup(squad, formation, 0);
  let subjectId = null;
  picked.lineup = picked.lineup.map((slot, idx) => {
    const position = slot.pos || 'CM';
    const isSubject = home && subjectPos && position === subjectPos && subjectId === null;
    const p = labPlayer(position, idx, isSubject ? level : 82);
    if (isSubject) subjectId = p.id;
    return Object.assign({}, slot, { p });
  });
  picked.bench = [];
  return {
    team: {
      squad, name: squad.c, flag: squad.f,
      color: home ? '#2e9bff' : '#ff3d7f',
      lineup: picked.lineup, bench: [], formKey: formation, style
    },
    subjectId
  };
}

// ── coleta ──────────────────────────────────────────────────────────────────
function blank() {
  return {
    matches: 0, possessions: 0, retentionSec: 0,
    passes: 0, through: 0, shots: 0, goals: 0, assists: 0,
    dribbleOk: 0, dribbleFail: 0,
    losses: 0, pressuresFaced: 0,
    // estratificação por pressão no instante da ação
    byPressure: {
      livre:      { dribbleOk: 0, dribbleFail: 0, passes: 0, losses: 0, actions: 0 },
      disputado:  { dribbleOk: 0, dribbleFail: 0, passes: 0, losses: 0, actions: 0 },
      sufocado:   { dribbleOk: 0, dribbleFail: 0, passes: 0, losses: 0, actions: 0 },
    }
  };
}

function band(dist) {
  if (dist > 6) return 'livre';
  if (dist > 3) return 'disputado';
  return 'sufocado';
}

function runMatch(db, seed, level, subjectPos, acc) {
  srand(seed);
  const H = makeTeam(db, '4-3-3', 'balanced', true, level, subjectPos);
  const A = makeTeam(db, '4-3-3', 'balanced', false, 82, null);
  const sim = new MatchSim(H.team, A.team, { neutral: true, labMode: true });
  sim.teams[0].formKey = '4-3-3';
  sim.teams[1].formKey = '4-3-3';

  const isSubject = p => !!(p && p.ref && p.ref.id === H.subjectId);
  const nearestDist = p => {
    let best = 99;
    const opp = sim.teams[1 - p.team];
    for (const q of opp.players) {
      if (q.red) continue;
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      if (d < best) best = d;
    }
    return best;
  };

  let holdingSince = null;

  const oldEmit = sim._emit;
  sim._emit = function (type, data) {
    data = data || {};
    const by = data.by, on = data.on;
    if (isSubject(by)) {
      const b = band(nearestDist(by));
      const bp = acc.byPressure[b];
      bp.actions++;
      if (type === 'pass') { acc.passes++; bp.passes++; }
      if (type === 'through') acc.through++;
      if (type === 'shot_taken' || type === 'header_shot') acc.shots++;
      if (type === 'goal') acc.goals++;
      if (type === 'assist') acc.assists++;
      // `_emit('dribble')` só dispara no SUCESSO (P._dribble em
      // 29-r12-transactional-core.js:126). As falhas saem como
      // 'containment' / 'tackle' / 'loose_duel' com `on` = driblador. Contar
      // só este evento dava dribbleSuccess = 1,000 nos quatro tiers — um
      // resultado impossível que passaria como "sem diferenciação".
      if (type === 'dribble') { acc.dribbleOk++; bp.dribbleOk++; }
    }
    if (isSubject(on)) {
      if (type === 'pressure') acc.pressuresFaced++;
      if (type === 'tackle' || type === 'containment' || type === 'loose_duel') {
        acc.losses++;
        const b = band(nearestDist(on));
        acc.byPressure[b].losses++;
        // Desfecho NEGATIVO de um duelo iniciado pelo sujeito: entra como
        // tentativa de drible sem sucesso, fechando o denominador.
        if (data.source === 'failed_dribble' || data.source === 'dribble' ||
            type === 'loose_duel') {
          acc.dribbleFail++; acc.byPressure[b].dribbleFail++;
        }
      }
    }
    return oldEmit.apply(this, arguments);
  };

  const oldGive = sim._giveBall;
  sim._giveBall = function (p) {
    if (holdingSince !== null) { acc.retentionSec += Math.max(0, sim.t - holdingSince); holdingSince = null; }
    if (isSubject(p)) { acc.possessions++; holdingSince = sim.t; }
    return oldGive.apply(this, arguments);
  };

  const DT = 1 / 30;
  let steps = 0;
  while (!sim.isOver() && steps++ < 500000) sim.step(DT);
  if (holdingSince !== null) acc.retentionSec += Math.max(0, sim.t - holdingSince);
  acc.matches++;
  return sim;
}

// ── execução ────────────────────────────────────────────────────────────────
if (!BUILD) { realConsole.error('ERRO: --build é obrigatório'); process.exit(2); }
const sha = loadBuild(BUILD);
const db = buildDB(DATA);

const arms = {};
for (const tier of TIERS) {
  const acc = blank();
  for (let s = 0; s < SEEDS; s++) runMatch(db, 4200000 + s * 977, tier, POS, acc);
  const perMatch = k => acc[k] / acc.matches;
  arms[tier] = {
    raw: acc,
    dribbleSuccess: (acc.dribbleOk + acc.dribbleFail) ? acc.dribbleOk / (acc.dribbleOk + acc.dribbleFail) : null,
    passesPerMatch: perMatch('passes'),
    throughPerMatch: perMatch('through'),
    shotsPerMatch: perMatch('shots'),
    goalsPerMatch: perMatch('goals'),
    lossPerPossession: acc.possessions ? acc.losses / acc.possessions : null,
    retentionPerPossession: acc.possessions ? acc.retentionSec / acc.possessions : null,
    dribbleSuccessByPressure: Object.fromEntries(
      Object.entries(acc.byPressure).map(([k, v]) =>
        [k, (v.dribbleOk + v.dribbleFail) ? v.dribbleOk / (v.dribbleOk + v.dribbleFail) : null])),
    lossRateByPressure: Object.fromEntries(
      Object.entries(acc.byPressure).map(([k, v]) =>
        [k, v.actions ? v.losses / v.actions : null])),
  };
  realConsole.error(`[tier ${tier}] ${acc.matches} partidas · drible ${acc.dribbleOk}/${acc.dribbleOk + acc.dribbleFail}` +
    ` · passes/j ${perMatch('passes').toFixed(1)} · perdas/posse ` +
    `${acc.possessions ? (acc.losses / acc.possessions).toFixed(3) : 'n/d'}`);
}

// ── avaliação dos gates ─────────────────────────────────────────────────────
// Monotônico = decrescente de 97 para 70 (ou crescente, para métricas em que
// menos é melhor). Métricas com amostra insuficiente NÃO contam como aprovadas.
const HIGHER_IS_BETTER = [
  'dribbleSuccess', 'passesPerMatch', 'throughPerMatch',
  'shotsPerMatch', 'retentionPerPossession'
];
const LOWER_IS_BETTER = ['lossPerPossession'];

const evaluated = [];
for (const key of HIGHER_IS_BETTER.concat(LOWER_IS_BETTER)) {
  const series = TIERS.map(t => arms[t][key]);
  if (series.some(v => v == null)) {
    evaluated.push({ metric: key, monotonic: null, series, note: 'amostra insuficiente' });
    continue;
  }
  const lowerBetter = LOWER_IS_BETTER.includes(key);

  // Série degenerada (todos os tiers com o mesmo valor) satisfaz `>=` em todo
  // par e passaria como "monotônica" — mas significa exatamente o contrário: a
  // habilidade NÃO faz diferença. É a mesma armadilha de "ausência vira
  // aprovação" que o §6 proíbe, e o auditor precisa recusá-la.
  const spread = Math.max.apply(null, series) - Math.min.apply(null, series);
  const rel = Math.max.apply(null, series.map(Math.abs)) || 1;
  if (spread / rel < 0.02) {
    evaluated.push({
      metric: key, monotonic: false, series, lowerBetter,
      note: 'sem diferenciação: os quatro tiers produzem o mesmo valor'
    });
    continue;
  }

  let ok = true;
  for (let i = 0; i < series.length - 1; i++) {
    // series está em ordem 97, 90, 80, 70
    if (lowerBetter ? !(series[i] <= series[i + 1]) : !(series[i] >= series[i + 1])) ok = false;
  }
  evaluated.push({ metric: key, monotonic: ok, series, lowerBetter, spread });
}

const usable = evaluated.filter(e => e.monotonic !== null);
const monotonicShare = usable.length ? usable.filter(e => e.monotonic).length / usable.length : null;

// Dificuldade (§24): a vantagem do craque deve ser pequena na ação fácil e
// grande na difícil. O drible NÃO serve de régua aqui — ninguém dribla estando
// livre, então a faixa `livre` fica sem amostra e o teste sai nulo. A régua é a
// TAXA DE PERDA, que existe nas três faixas: mede-se o quanto o 70 perde a mais
// que o 97 quando está solto e quando está sufocado.
const lossGap = band => {
  const a = arms[97].lossRateByPressure[band], b = arms[70].lossRateByPressure[band];
  return (a == null || b == null) ? null : b - a;   // positivo = 97 perde menos
};
const gapLivre = lossGap('livre');
const gapSufocado = lossGap('sufocado');
const slopePositive = (gapLivre != null && gapSufocado != null) ? (gapSufocado > gapLivre) : null;
// Mantido para inspeção: a mesma diferença medida no drible.
const dribbleGapSufocado = (arms[97].dribbleSuccessByPressure.sufocado != null &&
  arms[70].dribbleSuccessByPressure.sufocado != null)
  ? arms[97].dribbleSuccessByPressure.sufocado - arms[70].dribbleSuccessByPressure.sufocado : null;

const eliteLoss = arms[97].lossPerPossession;

const report = {
  build: BUILD, sha256: sha, position: POS, seeds_per_tier: SEEDS,
  tiers: TIERS, arms,
  metrics_evaluated: usable.length,
  monotonic_share: monotonicShare,
  monotonic_detail: evaluated,
  difficulty_gap: { livre: gapLivre, sufocado: gapSufocado, dribble_sufocado: dribbleGapSufocado },
  difficulty_slope_positive: slopePositive === null ? null : (slopePositive ? 1 : 0),
  elite_loss_rate: eliteLoss,
};
fs.writeFileSync(OUT, JSON.stringify(report, null, 1));

realConsole.error('\n=== MONOTONICIDADE ===');
for (const e of evaluated) {
  const s = e.series.map(v => v == null ? 'n/d' : (typeof v === 'number' ? v.toFixed(3) : v)).join('  ');
  realConsole.error(`  ${e.metric.padEnd(24)} ${e.monotonic === null ? 'SEM AMOSTRA' : (e.monotonic ? 'OK ' : 'NAO')}  [97,90,80,70] = ${s}`);
}
realConsole.error(`\nmonotonic_share = ${monotonicShare}`);
realConsole.error(`vantagem 97-70 no drible: livre=${gapLivre == null ? 'n/d' : gapLivre.toFixed(4)} · sufocado=${gapSufocado == null ? 'n/d' : gapSufocado.toFixed(4)}`);
realConsole.error(`cresce com a dificuldade: ${slopePositive}`);
realConsole.error(`taxa de perda do elite: ${eliteLoss == null ? 'n/d' : eliteLoss.toFixed(4)}`);
realConsole.error(`\nartefato: ${OUT}`);
