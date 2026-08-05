#!/usr/bin/env node
'use strict';
/*
 * BATERIA OFICIAL · protocolo espelho_30 (HANDOFF §6)
 *   Brasil 1970 x Brasil 1970, mesma formacao dos dois lados, balanced x
 *   balanced, dt = 1/30, sementes base + i*7919.
 * Uso: node bateria_espelho30.js --build=<html> [--matches=24] [--semente=4200000]
 */
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');

const argv = Object.fromEntries(process.argv.slice(2).map(item => {
  const [k, v] = item.replace(/^--/, '').split('=');
  return [k, v == null ? true : v];
}));
const noop = () => {};
function define(name, value) {
  try { Object.defineProperty(global, name, { value, writable: true, configurable: true }); }
  catch (_) { global[name] = value; }
}
define('window', global);
define('self', global);
define('navigator', { userAgent: 'cds-os84', language: 'pt-BR' });
define('location', { href: 'runner://os84', search: '', hash: '' });
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
global.console = { log: noop, warn: noop, error: noop };
const SKIP = new Set(['cds-2_5d-gate-a-contracts-v02', 'cds-pre25d-runtime-auditor-v04',
                      'cds-r109-async-cup', 'cds-mobile-boot-bridge', 'cds-ux-boot']);

if (!argv.build) { realConsole.error('ABORTA: informe --build=<html>'); process.exit(1); }
const html = fs.readFileSync(argv.build, 'utf8');
const sha = crypto.createHash('sha256').update(html).digest('hex');
const scriptRe = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let match, index = 0, erros = [];
while ((match = scriptRe.exec(html))) {
  const id = (match[1].match(/id="([^"]+)"/) || [])[1] || ('script-' + index);
  index++;
  if (SKIP.has(id)) continue;
  try { vm.runInThisContext(match[2], { filename: id + '.js' }); }
  catch (e) { erros.push(id + ': ' + String(e && e.message || e)); }
}
const FALTA = ['MatchSim', 'autoLineup', 'buildDB', 'DATA', 'FORMATIONS', 'srand', 'FL', 'FW']
  .filter(n => typeof global[n] === 'undefined');
if (FALTA.length) { realConsole.error('ABORTA: simbolos ausentes -> ' + FALTA.join(', ')); process.exit(2); }

const db = buildDB(DATA);
const N = Number(argv.matches || 24);
const BASE = Number(argv.semente || 4200000);
const DT = 1 / 30;
const FORMS = Object.keys(FORMATIONS);
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (form, home) => {
  const picked = autoLineup(squad, form, 0);
  return { squad, name: squad.c, flag: squad.f, color: home ? '#2e9bff' : '#ff3d7f',
           lineup: picked.lineup, bench: picked.bench, formKey: form, style: 'balanced' };
};
const novoSim = (seed, form) => {
  srand(seed);
  const s = new MatchSim(mk(form, true), mk(form, false), { neutral: true, labMode: true });
  s.teams[0].formKey = form; s.teams[1].formKey = form;
  return s;
};

const acc = { gols: 0, xg: 0, chutes: 0, noAlvo: 0, escanteios: 0, passes: 0, faltas: 0, defesas: 0, impedimentos: 0 };
const porJogo = [];
for (let i = 0; i < N; i++) {
  const sim = novoSim(BASE + i * 7919, FORMS[i % FORMS.length]);
  let guarda = 0;
  while (!sim.isOver() && guarda++ < 400000) sim.step(DT);
  const a = sim.stats[0], b = sim.stats[1];
  const j = { gols: sim.score[0] + sim.score[1],
              xg: (a.xg || 0) + (b.xg || 0),
              chutes: (a.shots || 0) + (b.shots || 0),
              noAlvo: (a.onTarget || 0) + (b.onTarget || 0),
              escanteios: (a.corners || 0) + (b.corners || 0),
              passes: (a.passes || 0) + (b.passes || 0),
              faltas: (a.fouls || 0) + (b.fouls || 0),
              defesas: (a.saves || 0) + (b.saves || 0),
              impedimentos: (a.offsides || 0) + (b.offsides || 0) };
  porJogo.push(j);
  for (const k in acc) acc[k] += j[k];
}
const media = {};
for (const k in acc) media[k] = +(acc[k] / N).toFixed(4);
const impressao = crypto.createHash('sha256')
  .update(JSON.stringify(porJogo)).digest('hex').slice(0, 16);

realConsole.log(JSON.stringify({
  build: argv.build.replace(/^.*[\\/]/, ''), sha256: sha.slice(0, 16),
  protocolo: 'espelho_30', partidas: N, semente: BASE,
  media, impressaoPorJogo: impressao,
  errosDeBloco: erros
}, null, 1));
