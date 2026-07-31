#!/usr/bin/env node
'use strict';
/*
 * OS-05B · CENSO DE ORIGEM E SUPRESSAO DE ESCANTEIO
 * -------------------------------------------------
 * Roda sobre a BUILD PROMOVIDA R18.50, sem nenhum patch. O motor ja conta
 * tudo que a rodada precisa: as camadas R18.18.2 e R18.18.3 mantem os
 * contadores e expoem getR18182Audit() e getR18183Audit().
 *
 * Nao ha edit(), nao ha hook, nao ha tag. A identidade medida continua
 * 495a9d684104b55ec749e43462549667fddb66a93b5d0b0a4cb1ab9d95c0445a.
 *
 * Mesma varredura deterministica de formacoes/estilos e mesmo incremento de
 * semente (7919) do diag OS-05A, para que as bases 4200000 / 8400000 /
 * 1260000 sejam pareaveis partida a partida com o censo anterior.
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
define('navigator', { userAgent: 'cds-os05b', language: 'pt-BR' });
define('location', { href: 'runner://os05b', search: '', hash: '' });
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
  realConsole.error('ABORTA: informe --build=<html>');
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
for (const fn of ['getR18182Audit','getR18183Audit']) {
  if (typeof MatchSim.prototype[fn] !== 'function') {
    realConsole.error('ABORTA: build sem ' + fn + '()');
    process.exit(3);
  }
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

/* Entregues: onde o escanteio de fato nasceu, ja resolvido pela geometria. */
const ENTREGUES = [
  'cornersResolved','blockCorners','saveParryCorners','punchCorners',
  'emergencyClearCorners','boxDuelCorners','clearBehindPhysical',
  'defensiveTouchPhysicalized'
];
/* Populacao resolvida: denominador de cada rota. */
const RESOLVIDOS = ['blockResolutions','saveParriesResolved','punchesResolved'];
/* Suprimidos: chamadas de escanteio que a geometria recusou. */
const SUPRIMIDOS = [
  'unprovenCornerCalls','unprovenSuppressed',
  'blockThrowIns','blockLive','saveParryLive','punchLive','contextLeaksCancelled'
];
const CAUSAS = ['block','save','punch','clearance'];
/* Camada R18.18.2: a supressao anterior, por raio de bloqueio. */
const L18182 = ['physicalBlockDecisions','blockCorners','blockThrowIns','blockLoose','randomCornerPathsSuppressed'];

const keys = [
  ...ENTREGUES.map(k => ['e_' + k, k, 3]),
  ...RESOLVIDOS.map(k => ['r_' + k, k, 3]),
  ...SUPRIMIDOS.map(k => ['s_' + k, k, 3]),
  ...CAUSAS.map(k => ['causa_' + k, k, 'cornerCause']),
  ...L18182.map(k => ['l2_' + k, k, 2])
];
const totais = Object.fromEntries(keys.map(([alias]) => [alias, 0]));
const controle = { goals:0, xg:0, shots:0, onTarget:0, corners:0, saves:0, goalKicks:0 };
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

  const a3 = sim.getR18183Audit();
  const a2 = sim.getR18182Audit();
  const linha = {};
  for (const [alias, key, origem] of keys) {
    const v = origem === 2 ? a2[key]
            : origem === 'cornerCause' ? (a3.cornerCause || {})[key]
            : a3[key];
    linha[alias] = Number(v) || 0;
    totais[alias] += linha[alias];
  }
  const game = {};
  for (const key of Object.keys(controle)) {
    game[key] = (Number(sim.stats[0][key]) || 0) + (Number(sim.stats[1][key]) || 0);
    controle[key] += game[key];
  }
  if (argv.detalhe) {
    perMatch.push({ seed, formacoes:[homeForm,awayForm], estilos:[homeStyle,awayStyle], placar:sim.score.slice(), censo:linha, controle:game });
  }
}

const div = obj => Object.fromEntries(Object.entries(obj).map(([k,v]) => [k, +(v / N).toFixed(3)]));
const censoPorPartida = div(totais);
const controlePorPartida = div(controle);

/* A conta que decide a rodada: quantos escanteios/partida a geometria recusou,
   somando as duas camadas, contra a distancia ate o piso do ECO-05. */
const suprimidosPorPartida = +(
  censoPorPartida.s_unprovenSuppressed +
  censoPorPartida.l2_randomCornerPathsSuppressed
).toFixed(3);
const lacunaEco05 = +(4 - controlePorPartida.corners).toFixed(3);

const output = {
  rodada: 'OS-05B',
  observational: true,
  promovivel: false,
  build: String(argv.build).split(/[\\/]/).pop(),
  sha256: sha,
  patchesAplicados: 0,
  scriptsCarregados: scriptsOk,
  scriptsComErro: scriptsErro,
  excecoes,
  partidas: N,
  sementeBase: SEMENTE,
  incremento: 7919,
  censoTotal: totais,
  censoPorPartida,
  agregadosDeControlePorPartida: controlePorPartida,
  decisao: {
    suprimidosPorPartida,
    lacunaEco05,
    supressaoCobreLacuna: suprimidosPorPartida >= lacunaEco05
  },
  porPartida: argv.detalhe ? perMatch : undefined
};
realConsole.log(JSON.stringify({
  rodada: output.rodada,
  build: output.build,
  sha: sha.slice(0, 12),
  partidas: N,
  sementeBase: SEMENTE,
  censoPorPartida,
  agregadosDeControlePorPartida: controlePorPartida,
  decisao: output.decisao
}, null, 2));
if (argv.out) fs.writeFileSync(argv.out, JSON.stringify(output, null, 2));
