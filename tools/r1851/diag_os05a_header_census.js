#!/usr/bin/env node
'use strict';
/*
 * Diagnostico OS-05A. Executa exatamente N partidas em uma base de semente,
 * com a mesma varredura deterministica de formacoes/estilos da bateria R18.40.
 * Nao altera o prototipo: apenas le getOS05AHeaderCensus() ao fim de cada jogo.
 */
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');

const argv = Object.fromEntries(process.argv.slice(2).map(item => {
  const [key, value] = item.replace(/^--/, '').split('=');
  return [key, value == null ? true : value];
}));
function noop() {}
function define(name, value) {
  try {
    Object.defineProperty(global, name, { value, writable: true, configurable: true });
  } catch (_) {
    global[name] = value;
  }
}

define('window', global);
define('self', global);
define('navigator', { userAgent: 'cds-os05a', language: 'pt-BR' });
define('location', { href: 'runner://os05a', search: '', hash: '' });
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
const SKIP = new Set([
  'cds-2_5d-gate-a-contracts-v02',
  'cds-pre25d-runtime-auditor-v04',
  'cds-r109-async-cup',
  'cds-mobile-boot-bridge',
  'cds-ux-boot'
]);
if (!argv.build) {
  realConsole.error('ABORTA: informe --build=<html instrumentado>');
  process.exit(1);
}

const html = fs.readFileSync(argv.build, 'utf8');
const sha = crypto.createHash('sha256').update(html).digest('hex');
const scriptRe = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let match, index = 0, scriptsOk = 0, scriptsErro = 0;
const excecoes = [];
while ((match = scriptRe.exec(html))) {
  const id = (match[1].match(/id="([^"]+)"/) || [])[1] || `script-${index}`;
  index++;
  if (SKIP.has(id)) continue;
  try {
    vm.runInThisContext(match[2], { filename: id + '.js' });
    scriptsOk++;
  } catch (error) {
    scriptsErro++;
    excecoes.push({ bloco: id, mensagem: String(error && error.message || error) });
  }
}

const REQUIRED = ['MatchSim','autoLineup','buildDB','DATA','FORMATIONS','srand','FL','FW'];
const missing = REQUIRED.filter(name => typeof global[name] === 'undefined');
if (missing.length) {
  realConsole.error('ABORTA: simbolos do motor ausentes -> ' + missing.join(', '));
  process.exit(2);
}
if (typeof MatchSim.prototype.getOS05AHeaderCensus !== 'function') {
  realConsole.error('ABORTA: build sem getOS05AHeaderCensus()');
  process.exit(3);
}

const db = buildDB(DATA);
const N = Number(argv.matches || 48);
const SEMENTE = Number(argv.semente || 4200000);
const DT = 1 / 30;
const FORMS = Object.keys(FORMATIONS);
const STYLES = (typeof STYLE_KEYS !== 'undefined' && Array.isArray(STYLE_KEYS))
  ? STYLE_KEYS.slice()
  : ['balanced','tiki','direct','press','counter','wings','park'];
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (form, style, home) => {
  const picked = autoLineup(squad, form, 0);
  return {
    squad,
    name: squad.c,
    flag: squad.f,
    color: home ? '#2e9bff' : '#ff3d7f',
    lineup: picked.lineup,
    bench: picked.bench,
    formKey: form,
    style
  };
};

const CENSUS_KEYS = [
  'open_seen','open_clean','open_endline','open_touchline','open_live','open_other',
  'open_return_true','open_return_false',
  'setpiece_seen','setpiece_clean','setpiece_endline','setpiece_touchline',
  'setpiece_live','setpiece_other','setpiece_return_true','setpiece_return_false'
];
const censusTotals = Object.fromEntries(CENSUS_KEYS.map(key => [key, 0]));
const gameplayTotals = { goals:0, xg:0, shots:0, onTarget:0, corners:0 };
const perMatch = [];

for (let i = 0; i < N; i++) {
  const seed = SEMENTE + i * 7919;
  const homeForm = FORMS[i % FORMS.length];
  const awayForm = FORMS[(i * 3 + 1) % FORMS.length];
  const homeStyle = STYLES[i % STYLES.length];
  const awayStyle = STYLES[(i * 5 + 2) % STYLES.length];
  srand(seed);
  const sim = new MatchSim(
    mk(homeForm, homeStyle, true),
    mk(awayForm, awayStyle, false),
    { neutral: true, labMode: true }
  );
  sim.teams[0].formKey = homeForm;
  sim.teams[1].formKey = awayForm;
  let steps = 0;
  while (!sim.isOver() && steps++ < 500000) sim.step(DT);

  const census = sim.getOS05AHeaderCensus();
  for (const key of CENSUS_KEYS) censusTotals[key] += Number(census[key]) || 0;
  const game = {};
  for (const key of Object.keys(gameplayTotals)) {
    game[key] = (Number(sim.stats[0][key]) || 0) + (Number(sim.stats[1][key]) || 0);
    gameplayTotals[key] += game[key];
  }
  if (argv.detalhe) {
    perMatch.push({
      seed,
      formacoes:[homeForm,awayForm],
      estilos:[homeStyle,awayStyle],
      placar:sim.score.slice(),
      census,
      gameplay:game
    });
  }
}

const perGame = Object.fromEntries(
  Object.entries(censusTotals).map(([key, value]) => [key, +(value / N).toFixed(3)])
);
const gameplayPerGame = Object.fromEntries(
  Object.entries(gameplayTotals).map(([key, value]) => [key, +(value / N).toFixed(3)])
);
const output = {
  rodada:'OS-05A',
  observational:true,
  promovivel:false,
  build:String(argv.build).split(/[\\/]/).pop(),
  sha256:sha,
  scriptsCarregados:scriptsOk,
  scriptsComErro:scriptsErro,
  excecoes,
  partidas:N,
  sementeBase:SEMENTE,
  incremento:7919,
  censoTotal:censusTotals,
  censoPorPartida:perGame,
  agregadosDeControlePorPartida:gameplayPerGame,
  porPartida:argv.detalhe ? perMatch : undefined
};
realConsole.log(JSON.stringify({
  rodada:output.rodada,
  build:output.build,
  sha:sha.slice(0,12),
  partidas:N,
  sementeBase:SEMENTE,
  censoPorPartida:perGame,
  agregadosDeControlePorPartida:gameplayPerGame
}, null, 2));
if (argv.out) fs.writeFileSync(argv.out, JSON.stringify(output, null, 2));

