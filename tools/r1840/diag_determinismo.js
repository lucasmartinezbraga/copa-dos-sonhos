#!/usr/bin/env node
'use strict';
/* TEC-04 · DETERMINISMO — mesma semente, resultado identico
   -------------------------------------------------------------------------
   Gate valido para toda release. Roda N partidas duas vezes, no mesmo processo,
   com as mesmas sementes, e compara o resultado inteiro: placar, todas as
   estatisticas dos dois times e o censo de eventos. Qualquer divergencia
   reprova — nao ha tolerancia, o motor e semeado.

   Roda tambem uma terceira passada em ordem inversa de sementes, para pegar
   estado global vazando entre partidas (o tipo de bug que passa quando as
   sementes sao sempre visitadas na mesma ordem). */

const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
function noop() {}
function define(n, v) { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } }
define('window', global); define('self', global);
define('navigator', { userAgent: 'cds-det', language: 'pt-BR' });
define('location', { href: 'runner://det', search: '', hash: '' });
define('performance', { now: () => 0 }); define('crypto', crypto.webcrypto);
define('requestAnimationFrame', () => 0); define('cancelAnimationFrame', noop);
define('addEventListener', noop); define('removeEventListener', noop);
define('matchMedia', () => ({ matches: false, addEventListener: noop, removeEventListener: noop }));
define('alert', noop); define('confirm', () => true); define('prompt', () => null);
define('localStorage', { getItem: () => null, setItem: noop, removeItem: noop, clear: noop });
define('sessionStorage', global.localStorage);
define('CanvasRenderingContext2D', undefined);
define('HTMLElement', function HTMLElement() {}); define('HTMLCanvasElement', function HTMLCanvasElement() {});
define('Image', function Image() {}); define('Audio', function Audio() { return { play: () => Promise.resolve(), pause: noop }; });
define('__showBootError', noop); define('__cdsDebugWarn', noop); define('CDS_DEBUG', false);
const realConsole = console;
global.console = { log: noop, warn: noop, error: realConsole.error };

const SKIP = new Set(['cds-2_5d-gate-a-contracts-v02','cds-pre25d-runtime-auditor-v04','cds-r109-async-cup','cds-mobile-boot-bridge','cds-ux-boot']);
const html = fs.readFileSync(argv.build, 'utf8');
const sha = crypto.createHash('sha256').update(html).digest('hex');
const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let mt, idx = 0, erros = 0;
while ((mt = re.exec(html))) {
  const id = (mt[1].match(/id="([^"]+)"/) || [])[1] || `script-${idx}`; idx++;
  if (SKIP.has(id)) continue;
  try { vm.runInThisContext(mt[2], { filename: `${id}.js` }); } catch (e) { erros++; }
}
for (const n of ['MatchSim','autoLineup','buildDB','DATA','srand']) {
  if (typeof global[n] === 'undefined') { realConsole.error('ABORTA: falta ' + n); process.exit(2); }
}

const db = buildDB(DATA);
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (f, h) => { const p = autoLineup(squad, f, 0); return { squad, name: squad.c, flag: squad.f, color: h ? '#2e9bff' : '#ff3d7f', lineup: p.lineup, bench: p.bench, formKey: f, style: 'balanced' }; };
const FORMS = Object.keys(FORMATIONS);
const STYLES = (typeof STYLE_KEYS !== 'undefined' && Array.isArray(STYLE_KEYS)) ? STYLE_KEYS.slice() : ['balanced','tiki','direct','press','counter','wings','park'];

const N = Number(argv.matches || 8), DT = 1 / 30;
const SEM = Number(argv.semente || 4200000);

function roda(i) {
  const seed = SEM + i * 7919;
  const fh = FORMS[i % FORMS.length], fa = FORMS[(i * 3 + 1) % FORMS.length];
  const sh = STYLES[i % STYLES.length], sa = STYLES[(i * 5 + 2) % STYLES.length];
  srand(seed);
  const sim = new MatchSim(mk(fh, sh, true), mk(fa, sa, false), { neutral: true, labMode: true });
  sim.teams[0].formKey = fh; sim.teams[1].formKey = fa;
  const ev = Object.create(null);
  const oEmit = sim._emit;
  sim._emit = function (t) { ev[t] = (ev[t] || 0) + 1; return oEmit.apply(this, arguments); };
  let s = 0; while (!sim.isOver() && s++ < 500000) sim.step(DT);
  /* impressao digital completa da partida */
  const st = [0, 1].map(k => {
    const o = sim.stats[k], saida = {};
    for (const key of Object.keys(o).sort()) { const v = o[key]; if (typeof v === 'number') saida[key] = v; }
    return saida;
  });
  return crypto.createHash('sha256').update(JSON.stringify({ seed, placar: sim.score, passos: s, st, ev })).digest('hex');
}

const idsCrescente = [];
for (let i = 0; i < N; i++) idsCrescente.push(roda(i));
const idsRepetido = [];
for (let i = 0; i < N; i++) idsRepetido.push(roda(i));
const idsInverso = new Array(N);
for (let i = N - 1; i >= 0; i--) idsInverso[i] = roda(i);

let iguaisRepetido = 0, iguaisInverso = 0;
const divergencias = [];
for (let i = 0; i < N; i++) {
  if (idsCrescente[i] === idsRepetido[i]) iguaisRepetido++; else divergencias.push({ partida: i, tipo: 'repeticao' });
  if (idsCrescente[i] === idsInverso[i]) iguaisInverso++; else divergencias.push({ partida: i, tipo: 'ordem inversa' });
}

realConsole.log(JSON.stringify({
  build: String(argv.build).split(/[\\/]/).pop(), sha: sha.slice(0, 12), blocosComErro: erros,
  partidas: N, sementeBase: SEM,
  'TEC-04_DETERMINISMO': {
    repeticao_mesma_ordem: iguaisRepetido + '/' + N,
    repeticao_ordem_inversa: iguaisInverso + '/' + N,
    divergencias,
    veredito: (iguaisRepetido === N && iguaisInverso === N) ? 'RESOLVIDO — 100% deterministico' : 'REPROVA',
  },
}, null, 2));
