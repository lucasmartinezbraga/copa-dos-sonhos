#!/usr/bin/env node
'use strict';
/*
 * DIAG OS-95 · QUEM CANCELA ESCANTEIO
 * ===================================
 * O censo OS-94 mostrou 5,833 escanteios contados por partida, TODOS vindos de
 * `pendingRestart` <- `_ballOut`. Mas a contagem bruta de chamadas a
 * `_setCorner` era ~9 por partida. Ou seja, ~3,9 chamadas por partida NAO
 * incrementam `stats.corners`.
 *
 * Duas explicacoes possiveis, e elas mudam completamente o que fazer:
 *   (a) alguma camada intercepta `_setCorner` e o converte em tiro de meta
 *       (a "lei do reinicio" da R18.15.5 diz exatamente isso);
 *   (b) minha classificacao de pilha estava errada e nao ha cancelamento.
 *
 * Este instrumento envolve `_setCorner` no TOPO e mede, chamada a chamada, se
 * `stats.corners` subiu. Quando nao sobe, guarda a pilha.
 */
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');
const argv = Object.fromEntries(process.argv.slice(2).map(i => {
  const [k, v] = i.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
const noop = () => {};
const D = (n, v) => { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } };
D('window', global); D('self', global);
D('navigator', { userAgent: 'cds', language: 'pt-BR' });
D('location', { href: 'runner://os95', search: '', hash: '' });
D('performance', { now: () => 0 }); D('crypto', crypto.webcrypto);
D('requestAnimationFrame', () => 0); D('cancelAnimationFrame', noop);
D('addEventListener', noop); D('removeEventListener', noop);
D('matchMedia', () => ({ matches: false, addEventListener: noop, removeEventListener: noop }));
D('alert', noop); D('confirm', () => true); D('prompt', () => null);
D('localStorage', { getItem: () => null, setItem: noop, removeItem: noop, clear: noop });
D('sessionStorage', global.localStorage); D('CanvasRenderingContext2D', undefined);
D('HTMLElement', function () {}); D('HTMLCanvasElement', function () {});
D('Image', function () {}); D('Audio', function () { return { play: () => Promise.resolve(), pause: noop }; });
D('__showBootError', noop); D('__cdsDebugWarn', noop); D('CDS_DEBUG', false);
const real = console;
global.console = { log: noop, warn: noop, error: noop };
const SKIP = new Set(['cds-2_5d-gate-a-contracts-v02', 'cds-pre25d-runtime-auditor-v04',
                      'cds-r109-async-cup', 'cds-mobile-boot-bridge', 'cds-ux-boot']);
const html = fs.readFileSync(argv.build, 'utf8');
const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let m, idx = 0;
while ((m = re.exec(html))) {
  const id = (m[1].match(/id="([^"]+)"/) || [])[1] || ('script-' + idx); idx++;
  if (SKIP.has(id)) continue;
  try { vm.runInThisContext(m[2], { filename: id + '.js' }); } catch (_) {}
}

const P = MatchSim.prototype;
let chamadas = 0, contou = 0, cancelou = 0;
const pilhasCanceladas = {};
const pilhasContadas = {};

const oSet = P._setCorner;
P._setCorner = function (team) {
  chamadas++;
  const st = this.stats && this.stats[team];
  const antes = st ? (st.corners || 0) : null;
  let pilha = '?';
  try {
    pilha = new Error().stack.split('\n').slice(2, 8)
      .map(s => s.trim().replace(/^at\s+/, '').replace(/\s*\(.*?([^\\/]+):(\d+):\d+\)$/, ' @$1:$2'))
      .filter(s => s.indexOf('_setCorner') < 0)
      .slice(0, 3).join('  <-  ');
  } catch (_) {}
  const r = oSet.apply(this, arguments);
  const dep = st ? (st.corners || 0) : null;
  if (antes != null && dep != null && dep > antes) { contou++; pilhasContadas[pilha] = (pilhasContadas[pilha] || 0) + 1; }
  else { cancelou++; pilhasCanceladas[pilha] = (pilhasCanceladas[pilha] || 0) + 1; }
  return r;
};

const db = buildDB(DATA);
const N = Number(argv.matches || 12);
const FORMS = Object.keys(FORMATIONS);
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (f, h) => {
  const p = autoLineup(squad, f, 0);
  return { squad, name: squad.c, flag: squad.f, color: h ? '#2e9bff' : '#ff3d7f',
           lineup: p.lineup, bench: p.bench, formKey: f, style: 'balanced' };
};
for (let i = 0; i < N; i++) {
  srand(4200000 + i * 7919);
  const sim = new MatchSim(mk(FORMS[i % FORMS.length], true), mk(FORMS[i % FORMS.length], false), { neutral: true, labMode: true });
  let g = 0;
  while (!sim.isOver() && g++ < 400000) sim.step(1 / 30);
}
const top = o => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 6)
  .map(([k, v]) => [k, +(v / N).toFixed(3)]));
real.log(JSON.stringify({
  build: String(argv.build).replace(/^.*[\\/]/, ''), partidas: N,
  chamadas_setCorner_por_partida: +(chamadas / N).toFixed(3),
  contaram_como_escanteio: +(contou / N).toFixed(3),
  NAO_contaram: +(cancelou / N).toFixed(3),
  pilhas_que_CONTARAM: top(pilhasContadas),
  pilhas_que_NAO_contaram: top(pilhasCanceladas)
}, null, 1));
