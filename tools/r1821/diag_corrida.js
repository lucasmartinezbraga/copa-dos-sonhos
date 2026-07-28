#!/usr/bin/env node
'use strict';
/* O CORREDOR SE MOVE OU NÃO?
   -------------------------------------------------------------------------
   Quatro iterações na ocupação da área e o melhor resultado foi 68,8% de área
   vazia contra 75,9%. Duas delas eu perdi mexendo em parâmetro sem saber o
   básico: o jogador designado ANDA em direção ao alvo?

   Esta sonda acompanha cada corrida designada do primeiro ao último tick do
   compromisso e mede:
     · distância ao alvo no início e no fim;
     · se ela encolheu, cresceu ou ficou parada;
     · velocidade média do corredor durante a corrida;
     · quanto do caminho ele efetivamente cobriu.

   Separa "alvo sobrescrito por outra coisa" de "alvo inalcançável no tempo". */

const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
function noop() {}
function define(n, v) { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } }
define('window', global); define('self', global);
define('navigator', { userAgent: 'cds-corrida', language: 'pt-BR' });
define('location', { href: 'runner://corrida', search: '', hash: '' });
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
const N = Number(argv.matches || 6), DT = 1 / 30;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

const T = { corridas: 0, ticks: 0,
            d0soma: 0, dfsoma: 0, cobertoSoma: 0, velSoma: 0,
            encolheu: 0, cresceu: 0, parado: 0,
            chegouA6m: 0, chegouA10m: 0,
            amostras: [] };

for (let i = 0; i < N; i++) {
  srand(1710000 + i * 977);
  const sim = new MatchSim(mk('4-3-3', true), mk('4-3-3', false), { neutral: true, labMode: true });
  /* corridas vivas: jogador -> {alvo, d0, x0,y0, ticks, percorrido, ultimaPos} */
  const vivas = new Map();

  let s = 0;
  while (!sim.isOver() && s++ < 500000) {
    sim.step(DT);
    for (const tm of sim.teams) {
      for (const p of tm.players) {
        if (!p || p.red || p.isGK) continue;
        const run = p.__r1821BoxRun;
        if (run && run.ate > sim.t) {
          let est = vivas.get(p);
          if (!est || est.alvo !== run.alvo) {
            est = { alvo: run.alvo, d0: dist(p.x, p.y, run.alvo.x, run.alvo.y),
                    ticks: 0, percorrido: 0, ux: p.x, uy: p.y };
            vivas.set(p, est);
          }
          est.percorrido += dist(p.x, p.y, est.ux, est.uy);
          est.ux = p.x; est.uy = p.y; est.ticks++;
          T.ticks++;
        } else if (vivas.has(p)) {
          const est = vivas.get(p);
          vivas.delete(p);
          if (est.ticks < 3) continue;
          const df = dist(p.x, p.y, est.alvo.x, est.alvo.y);
          T.corridas++;
          T.d0soma += est.d0; T.dfsoma += df;
          T.cobertoSoma += (est.d0 - df);
          T.velSoma += est.percorrido / (est.ticks * DT);
          if (df < est.d0 - 0.5) T.encolheu++;
          else if (df > est.d0 + 0.5) T.cresceu++;
          else T.parado++;
          if (df < 6) T.chegouA6m++;
          if (df < 10) T.chegouA10m++;
          if (T.amostras.length < 10) T.amostras.push({
            inicio: +est.d0.toFixed(1), fim: +df.toFixed(1),
            percorrido: +est.percorrido.toFixed(1),
            segundos: +(est.ticks * DT).toFixed(2),
            velMedia: +(est.percorrido / (est.ticks * DT)).toFixed(2)
          });
        }
      }
    }
  }
}

const c = Math.max(1, T.corridas);
realConsole.log(JSON.stringify({
  build: String(argv.build).split(/[\\/]/).pop(), partidas: N,
  corridasCompletadas: T.corridas,
  distanciaAoAlvo: {
    noInicio_m: +(T.d0soma / c).toFixed(2),
    noFim_m: +(T.dfsoma / c).toFixed(2),
    caminhoCoberto_m: +(T.cobertoSoma / c).toFixed(2),
  },
  desfecho: {
    aproximou: `${T.encolheu} (${(100 * T.encolheu / c).toFixed(1)}%)`,
    afastou: `${T.cresceu} (${(100 * T.cresceu / c).toFixed(1)}%)`,
    parado: `${T.parado} (${(100 * T.parado / c).toFixed(1)}%)`,
    chegouA10m: `${(100 * T.chegouA10m / c).toFixed(1)}%`,
    chegouA6m: `${(100 * T.chegouA6m / c).toFixed(1)}%`,
  },
  velocidadeMediaDoCorredor_m_s: +(T.velSoma / c).toFixed(2),
  amostras: T.amostras,
  leitura: 'se aproximou muito mas nao chegou = falta tempo; se ficou parado ou afastou = alvo sobrescrito',
}, null, 2));
