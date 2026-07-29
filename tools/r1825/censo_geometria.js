#!/usr/bin/env node
'use strict';
/* OCUPAÇÃO DA ÁREA NO MOMENTO DO CRUZAMENTO
   -------------------------------------------------------------------------
   Funil medido: 19,12 cruzamentos por partida, mas só 1,20 cabeceios ao gol e
   0,88 cortes de cabeça. Uns cinco cruzamentos aéreos somem sem virar disputa.

   Hipótese: a área está VAZIA quando a bola chega. O motor exige alvo aéreo
   dentro de 24 m do gol (`inBox`, linha 5304); sem ninguém lá, o cruzamento
   cai no ramo de falha de entrega e vira bola perdida.

   Mede, no instante exato de cada `_cross`: quantos companheiros estão dentro
   dos 24 m, quantos dentro dos 16 m (área de verdade), e como isso se
   distribui. Só observação. */

const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
function noop() {}
function define(n, v) { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } }
define('window', global); define('self', global);
define('navigator', { userAgent: 'cds-area', language: 'pt-BR' });
define('location', { href: 'runner://area', search: '', hash: '' });
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


/* ============================================================================
 * ETAPA 0 · CENSO DE DIVERGÊNCIA — o reinício concedido bate com a geometria?
 * ----------------------------------------------------------------------------
 * Num motor contínuo o reinício NÃO é chamado: ele é derivado de a bola cruzar
 * uma linha, e de quem a tocou por último. Aqui ele é chamado — `_setCorner(t)`,
 * `_goalKickOrRestart(t)` — de dentro de callbacks que já decidiram o desfecho.
 *
 * Este censo não altera nada. Em cada concessão de reinício ele pergunta:
 *   1. a bola estava REALMENTE fora do campo?
 *   2. se estava, por qual linha saiu?
 *   3. quem tocou por último?
 *   4. a regra do futebol daria o MESMO reinício que foi concedido?
 *
 * Saída: quanto por cento do futebol de bola parada é decidido contra a
 * geometria. É o número que decide se vale inverter a dependência.
 * ==========================================================================*/
const db = buildDB(DATA);
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (f, home) => { const p = autoLineup(squad, f, 0); return { squad, name: squad.c, flag: squad.f, color: home ? '#2e9bff' : '#ff3d7f', lineup: p.lineup, bench: p.bench, formKey: f, style: 'balanced' }; };
const N = Number(argv.matches || 5), DT = 1 / 30;
const FORMS = String(argv.formacoes || '4-3-3,4-4-2,3-5-2').split(',');
const FLc = global.FL || 105, FWc = global.FW || 68;

const T = { total: 0, dentro: 0, fora: 0, concorda: 0, diverge: 0, semUltimoToque: 0,
            porTipo: {}, divergencias: {}, dentroPorTipo: {}, profundidadeDentro: [] };

function classifica(sim, tipoConcedido, timeQueReinicia) {
  const b = sim.ball;
  const x = b.x, y = b.y;
  const foraLateral = y < 0 || y > FWc;
  const foraFundo = x < 0 || x > FLc;
  const lt = b.lastTouch;
  const key = t => (T.porTipo[t] = (T.porTipo[t] || 0) + 1);
  key(tipoConcedido);
  T.total++;

  if (!foraLateral && !foraFundo) {
    T.dentro++;
    T.dentroPorTipo[tipoConcedido] = (T.dentroPorTipo[tipoConcedido] || 0) + 1;
    // quão longe da linha mais próxima a bola estava
    T.profundidadeDentro.push(Math.min(x, FLc - x, y, FWc - y));
    return;
  }
  T.fora++;
  if (!lt || !Number.isFinite(lt.team)) { T.semUltimoToque++; return; }

  let esperado;
  if (foraLateral && !foraFundo) {
    esperado = 'lateral_para_' + (1 - lt.team);
  } else {
    // qual gol? o time que defende aquela linha
    const t0 = sim.teams[0];
    const golDoTime0 = t0.goal && Number.isFinite(t0.goal.x) ? t0.goal.x : 0;
    const linhaEsquerda = x < 0;
    const defensor = (Math.abs(golDoTime0 - (linhaEsquerda ? 0 : FLc)) < 1) ? 0 : 1;
    esperado = (lt.team === defensor)
      ? 'escanteio_para_' + (1 - defensor)     // defensor tocou por último
      : 'tiroDeMeta_para_' + defensor;         // atacante tocou por último
  }
  const concedido = tipoConcedido + '_para_' + timeQueReinicia;
  if (esperado === concedido) T.concorda++;
  else {
    T.diverge++;
    const k = concedido + ' <> esperado ' + esperado;
    T.divergencias[k] = (T.divergencias[k] || 0) + 1;
  }
}

for (const form of FORMS) {
  for (let i = 0; i < N; i++) {
    srand(1710000 + i * 977);
    const sim = new MatchSim(mk(form, true), mk(form, false), { neutral: true, labMode: true });
    const proto = Object.getPrototypeOf(sim);
    const oCorner = proto._setCorner, oGoalKick = proto._goalKickOrRestart;
    sim._setCorner = function (t) { try { classifica(this, 'escanteio', t); } catch (_) {} return oCorner.apply(this, arguments); };
    sim._goalKickOrRestart = function (t) { try { classifica(this, 'tiroDeMeta', t); } catch (_) {} return oGoalKick.apply(this, arguments); };
    let s = 0; while (!sim.isOver() && s++ < 500000) sim.step(DT);
  }
}

const nPart = N * FORMS.length, c = Math.max(1, T.total);
const pct = (a, b) => +(100 * a / Math.max(1, b)).toFixed(1);
const avg = a => a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : null;
realConsole.log(JSON.stringify({
  build: String(argv.build).split(/[\/]/).pop(), partidas: nPart,
  concessoesDeReinicio: T.total, porPartida: +(T.total / nPart).toFixed(2),
  veredito: {
    bolaDENTROdoCampo: { n: T.dentro, pct: pct(T.dentro, c),
      nota: 'reinicio concedido com a bola ainda em campo — geometricamente impossivel',
      distanciaMediaAteALinha_m: avg(T.profundidadeDentro), porTipo: T.dentroPorTipo },
    bolaFora_regraCONCORDA: { n: T.concorda, pct: pct(T.concorda, c) },
    bolaFora_regraDIVERGE: { n: T.diverge, pct: pct(T.diverge, c), casos: T.divergencias },
    semUltimoToqueConhecido: { n: T.semUltimoToque, pct: pct(T.semUltimoToque, c) },
  },
  concessoesPorTipo: T.porTipo,
}, null, 2));
