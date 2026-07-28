#!/usr/bin/env node
'use strict';
/* MATRIZ DOS 119 CENÁRIOS PÓS-ROUBADA
   -------------------------------------------------------------------------
   Reproduz o cenário registrado no handoff: "zagueiro recupera a bola no
   meio-campo, pressionado e sem passe considerado seguro", em 17 formações ×
   7 estilos = 119 casos.

   O cenário é MONTADO, não forçado: posiciono os jogadores e chamo _decide().
   A ação que sair é a medição. Não induzo a resposta desejada. */

const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');

const argv = Object.fromEntries(process.argv.slice(2).map(arg => {
  const [key, value] = arg.replace(/^--/, '').split('=');
  return [key, value == null ? true : value];
}));

function noop() {}
function define(name, value) {
  try { Object.defineProperty(global, name, { value, writable: true, configurable: true }); }
  catch (_) { global[name] = value; }
}
define('window', global);
define('self', global);
define('navigator', { userAgent: 'cds-scenario-119', language: 'pt-BR' });
define('location', { href: 'runner://scenario', search: '', hash: '' });
define('performance', { now: () => 0 });
define('crypto', crypto.webcrypto);
define('requestAnimationFrame', () => 0);
define('cancelAnimationFrame', noop);
define('addEventListener', noop);
define('removeEventListener', noop);
define('matchMedia', () => ({ matches: false, addEventListener: noop, removeEventListener: noop }));
define('alert', noop); define('confirm', () => true); define('prompt', () => null);
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

const SKIP_IDS = new Set([
  'cds-2_5d-gate-a-contracts-v02', 'cds-pre25d-runtime-auditor-v04',
  'cds-r109-async-cup', 'cds-mobile-boot-bridge', 'cds-ux-boot',
]);
String(argv.skipIds || '').split(',').map(s => s.trim()).filter(Boolean)
  .forEach(id => SKIP_IDS.add(id));

function loadBuild(path) {
  const html = fs.readFileSync(path, 'utf8');
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  let match, index = 0;
  while ((match = re.exec(html))) {
    const id = (match[1].match(/id="([^"]+)"/) || [])[1] || `script-${index}`;
    index++;
    if (SKIP_IDS.has(id)) continue;
    try { vm.runInThisContext(match[2], { filename: `${id}.js` }); }
    catch (error) {
      if (/^script-\d+$/.test(id) && /document is not defined/.test(String(error && error.message || error))) continue;
      throw error;
    }
  }
  return crypto.createHash('sha256').update(html).digest('hex');
}

const BUILD = argv.build;
if (!BUILD) { realConsole.error('uso: --build="<html>"'); process.exit(2); }
const sha = loadBuild(BUILD);

const db = buildDB(DATA);
const FORM_KEYS = Object.keys(FORMATIONS);
const STYLES = (typeof STYLE_KEYS !== 'undefined' && Array.isArray(STYLE_KEYS))
  ? STYLE_KEYS.slice()
  : ['balanced', 'tiki', 'direct', 'press', 'counter', 'wings', 'park'];

function makeSide(squad, formation, style, home) {
  const def = FORMATIONS[formation];
  const picked = autoLineup(squad, formation, 0);
  return {
    squad, name: squad.c, flag: squad.f,
    color: home ? '#2e9bff' : '#ff3d7f',
    lineup: picked.lineup, bench: picked.bench,
    formKey: formation, style,
  };
}

/* Monta: CB do time 0 com a bola no meio-campo, posse recém-iniciada,
   adversário colado, e todo companheiro marcado de perto (mata o passe
   seguro). Nenhuma decisão é induzida. */
function buildScenario(formation, style, seed) {
  srand(seed);
  const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
  const sim = new MatchSim(
    makeSide(squad, formation, style, true),
    makeSide(squad, '4-3-3', 'balanced', false),
    { neutral: true, labMode: true }
  );
  sim.teams[0].formKey = formation;
  sim.teams[1].formKey = '4-3-3';

  const tm = sim.teams[0], opp = sim.teams[1];
  const mine = tm.players.filter(p => p && !p.red && !p.isGK);
  const theirs = opp.players.filter(p => p && !p.red && !p.isGK);
  const cb = mine.find(p => p.slotPos === 'CB') || mine.find(p => /B$/.test(p.slotPos || '')) || mine[0];
  if (!cb) return null;

  const dir = tm.attackDir;
  // meio-campo: a metade do campo, longe do próprio gol
  cb.x = 52.5; cb.y = 34; cb.vx = 0; cb.vy = 0;

  const mates = mine.filter(p => p !== cb);
  // espalha os companheiros de forma plausível ao redor do meio-campo
  mates.forEach((m, i) => {
    const ang = (i / mates.length) * Math.PI * 2;
    m.x = Math.max(6, Math.min(99, 52.5 + Math.cos(ang) * 16 + dir * 4));
    m.y = Math.max(4, Math.min(64, 34 + Math.sin(ang) * 18));
    m.vx = 0; m.vy = 0;
  });

  // 1 adversário colado no zagueiro (aciona nd < 2.2)
  const marker = theirs[0];
  marker.x = cb.x + dir * 1.9; marker.y = cb.y + 0.3; marker.vx = 0; marker.vy = 0;
  // demais adversários marcam os companheiros: _safePass do motor exige >= 4,5 m.
  // --markDist controla o aperto: 3.4 reproduz o cenário documentado; valores
  // menores testam se a correção aguenta marcação sufocante sem voltar ao chutão.
  theirs.slice(1).forEach((d, i) => {
    const m = mates[i];
    if (!m) { d.x = 52.5; d.y = 4; return; }
    d.x = Math.max(2, Math.min(103, m.x + dir * MARK_DIST)); d.y = m.y + MARK_DIST * 0.18;
    d.vx = 0; d.vy = 0;
  });

  // bola no pé do zagueiro, posse recém-recuperada (building = true)
  const b = sim.ball;
  b.owner = cb; b.x = cb.x; b.y = cb.y; b.z = 0;
  b.vx = 0; b.vy = 0; b.vz = 0;
  b.traveling = false; b.kind = null; b.passKind = null;
  b.lastTouch = cb;
  sim.poss = 0;
  sim.possT = 0.2;
  sim.dead = 0;
  sim.waiting = false;
  sim.pendingRestart = null;
  sim.decideT = 0;
  cb.settle = 0;
  return { sim, cb, tm };
}

const ACTIONS = ['_clearBall', '_pass', '_carry', '_shoot', '_cross', '_dribble'];
const MARK_DIST = Number(argv.markDist || 3.4);

function runCase(formation, style, seed) {
  const built = buildScenario(formation, style, seed);
  if (!built) return { formation, style, action: 'ERRO_SEM_ZAGUEIRO', events: [] };
  const { sim, cb } = built;

  const fired = [];
  const events = [];
  let decision = null;
  const originalEmit = sim._emit;
  sim._emit = function (type, data) {
    events.push(type);
    if (type === 'post_recovery_decision' && data && !decision) decision = data.choice;
    return originalEmit.apply(this, arguments);
  };
  for (const name of ACTIONS) {
    const original = sim[name] || Object.getPrototypeOf(sim)[name];
    if (typeof original !== 'function') continue;
    sim[name] = function (...args) {
      fired.push(name);
      try { return original.apply(this, args); } catch (_) { return undefined; }
    };
  }

  let error = null;
  try { sim._decide(cb); } catch (e) { error = String(e && e.message || e); }

  const dtgOwnGoal = Math.hypot(cb.x - sim.teams[0].goal.x, cb.y - sim.teams[0].goal.y);

  /* CLASSIFICAÇÃO PELO DESFECHO, não pela chamada. _clearBall pode ser chamado
     e desviado para passe/condução — o que importa é o que a bola virou. */
  const aliviouDeFato = events.includes('header_clear') || events.includes('foot_clearance');
  const finalizou = events.includes('shot_taken') || fired.includes('_shoot');
  let outcome;
  if (aliviouDeFato) outcome = 'chutao';
  else if (finalizou) outcome = 'chute';
  else if (decision) outcome = decision;                 // safe_pass | long_pass | carry
  else if (fired.includes('_pass')) outcome = 'passe';
  else if (fired.includes('_carry')) outcome = 'carry';
  else if (fired.includes('_cross')) outcome = 'cruzamento';
  else if (fired.includes('_dribble')) outcome = 'drible';
  else outcome = error ? 'ERRO' : 'NENHUMA';

  return {
    formation, style,
    outcome,
    entrou_clearBall: fired.includes('_clearBall'),
    chamadas: fired,
    events,
    error,
    cbX: +cb.x.toFixed(1),
    distOwnGoal: +dtgOwnGoal.toFixed(1),
  };
}

const rows = [];
let seed = 990000;
for (const formation of FORM_KEYS) {
  for (const style of STYLES) {
    rows.push(runCase(formation, style, seed++));
  }
}

const porDesfecho = {};
for (const r of rows) porDesfecho[r.outcome] = (porDesfecho[r.outcome] || 0) + 1;

// Chutão indevido = alívio ou finalização REALIZADA com o zagueiro fora do
// terço defensivo (35 m do próprio gol).
const TERCO_DEFENSIVO = 35;
const indevidos = rows.filter(r =>
  (r.outcome === 'chutao' || r.outcome === 'chute') && r.distOwnGoal > TERCO_DEFENSIVO);
const direcionados = rows.filter(r =>
  r.outcome === 'safe_pass' || r.outcome === 'long_pass' || r.outcome === 'carry' || r.outcome === 'passe');

const out = {
  build: BUILD, sha256: sha,
  formacoes: FORM_KEYS.length, estilos: STYLES.length, casos: rows.length,
  porDesfecho,
  chutoesIndevidos: indevidos.length,
  decisoesDirecionadas: direcionados.length,
  emitiramHeaderClear: rows.filter(r => r.events.includes('header_clear')).length,
  emitiramFootClearance: rows.filter(r => r.events.includes('foot_clearance')).length,
  emitiramLongPass: rows.filter(r => r.events.includes('long_pass')).length,
  exemplosIndevidos: indevidos.slice(0, 5),
  rows,
};

realConsole.log(JSON.stringify({
  build: BUILD.split(/[\\/]/).pop(), sha256: sha.slice(0, 12),
  formacoes: FORM_KEYS.length, estilos: STYLES.length, casos: rows.length,
  porDesfecho,
  chutoesIndevidos: indevidos.length,
  decisoesDirecionadas: direcionados.length,
  emitiramHeaderClear: out.emitiramHeaderClear,
  emitiramFootClearance: out.emitiramFootClearance,
  emitiramLongPass: out.emitiramLongPass,
}, null, 2));

if (argv.out) fs.writeFileSync(argv.out, JSON.stringify(out, null, 2));
