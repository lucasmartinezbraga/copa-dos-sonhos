#!/usr/bin/env node
'use strict';
/* PROVA DIRIGIDA: ACRÉSCIMOS, FIM DE JOGO E PAUSA DE FALTA
   -------------------------------------------------------------------------
   Mede, por partida:
     · acréscimo do 1º e do 2º tempo (o motor sempre dava zero);
     · em que minuto a partida termina;
     · se a bola estava EM JOGO no instante do apito final;
     · quantas vezes o árbitro esperou a jogada terminar;
     · a pausa média da cobrança de falta. */

const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
function noop() {}
function define(n, v) { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } }
define('window', global); define('self', global);
define('navigator', { userAgent: 'cds-tempo', language: 'pt-BR' });
define('location', { href: 'runner://tempo', search: '', hash: '' });
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
const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let mt, idx = 0;
while ((mt = re.exec(html))) {
  const id = (mt[1].match(/id="([^"]+)"/) || [])[1] || `script-${idx}`; idx++;
  if (SKIP.has(id)) continue;
  try { vm.runInThisContext(mt[2], { filename: `${id}.js` }); }
  catch (e) { if (/^script-\d+$/.test(id) && /document is not defined/.test(String(e && e.message || e))) continue; throw e; }
}

const db = buildDB(DATA);
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (f, home) => { const p = autoLineup(squad, f, 0); return { squad, name: squad.c, flag: squad.f, color: home ? '#2e9bff' : '#ff3d7f', lineup: p.lineup, bench: p.bench, formKey: f, style: 'balanced' }; };
const N = Number(argv.matches || 20), DT = 1 / 30;
const finite = (v, d) => Number.isFinite(v) ? v : (d || 0);

const T = { acresc1: [], acresc2: [], minutoFinal: [], bolaEmJogoNoApito: 0,
            esperou: 0, pausasFalta: [], partidas: 0, freekicks: 0 };

for (let i = 0; i < N; i++) {
  srand(1710000 + i * 977);
  const sim = new MatchSim(mk('4-3-3', true), mk('4-3-3', false), { neutral: true, labMode: true });
  let setImmediatePausa = false;
  const oEmit = sim._emit;
  sim._emit = function (t) {
    if (t === 'freekick') { T.freekicks++; setImmediatePausa = true; }
    return oEmit.apply(this, arguments);
  };
  /* O motor ZERA `stoppage` ANTES de emitir `halftime` (linha 4894), então ler
     no evento devolve 0. Amostro a cada passo e guardo o último valor visto no
     tempo anterior. */
  let a1 = 0, ultimoMeio = 1;
  let s = 0;
  while (!sim.isOver() && s++ < 500000) {
    const meioAntes = finite(sim.half, 1);
    const stopAntes = finite(sim.stoppage);
    sim.step(DT);
    if (finite(sim.half, 1) !== meioAntes && meioAntes === 1) a1 = stopAntes;
    ultimoMeio = finite(sim.half, 1);
    if (setImmediatePausa) { T.pausasFalta.push(finite(sim.dead)); setImmediatePausa = false; }
  }
  /* estado no apito final */
  const b = sim.ball;
  const emJogo = finite(sim.dead) <= 0.05 && !sim.waiting && !sim.pendingRestart && !!(b && (b.owner || b.traveling));
  if (emJogo) T.bolaEmJogoNoApito++;
  T.acresc1.push(a1);
  T.acresc2.push(finite(sim.stoppage));
  T.minutoFinal.push(finite(sim.minute));
  const au = sim.getTempoAudit ? sim.getTempoAudit() : null;
  if (au) T.esperou += finite(au.esperouBolaSair);
  T.partidas++;
}

const med = arr => arr.length ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : 0;
const mx = arr => arr.length ? +Math.max.apply(null, arr).toFixed(2) : 0;
realConsole.log(JSON.stringify({
  build: String(argv.build).split(/[\\/]/).pop(), partidas: T.partidas,
  acrescimos: {
    primeiroTempo_medio: med(T.acresc1), primeiroTempo_max: mx(T.acresc1),
    segundoTempo_medio: med(T.acresc2), segundoTempo_max: mx(T.acresc2),
  },
  fimDeJogo: {
    minutoFinalMedio: med(T.minutoFinal),
    partidasQueAcabaramComABolaEMJOGO: T.bolaEmJogoNoApito,
    pctComBolaEmJogo: +(100 * T.bolaEmJogoNoApito / Math.max(1, T.partidas)).toFixed(1),
    vezesQueOArbitroEsperou: T.esperou,
  },
  cobrancaDeFalta: {
    cobrancas: T.freekicks,
    pausaMedia_s: med(T.pausasFalta), pausaMax_s: mx(T.pausasFalta),
  },
}, null, 2));
