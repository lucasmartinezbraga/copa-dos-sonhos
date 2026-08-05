#!/usr/bin/env node
'use strict';
/*
 * DIAG OS-91 · DE ONDE VEM (E DE ONDE SUMIU) O ESCANTEIO
 * ======================================================
 * A R18.91 reprova ECO-05 em duas de seis bases (3,792 e 3,958). Antes de
 * chamar de caos ou de mecanismo, medir a ORIGEM de cada escanteio.
 *
 * `_setCorner` tem varios sitios chamadores. Este instrumento conta por origem,
 * lendo a pilha de chamada, e compara duas builds na MESMA semente.
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
D('location', { href: 'runner://os91', search: '', hash: '' });
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
const origens = {};
let total = 0;
const oCorner = P._setCorner;
P._setCorner = function () {
  total++;
  let chave = 'desconhecida';
  try {
    const pilha = new Error().stack.split('\n').slice(2, 7).join(' | ');
    /* classifica pela funcao mais informativa que aparecer na pilha */
    const alvos = ['_ballOut', '_gkResolveSave', '_shoot', '_cross', '_header',
                   '_freeKick', '_penalty', '_deflect', '_looseBall', '_ballTravel'];
    const achou = alvos.filter(a => pilha.indexOf(a) >= 0);
    chave = achou.length ? achou.join('+') : pilha.slice(0, 90);
  } catch (_) {}
  origens[chave] = (origens[chave] || 0) + 1;
  return oCorner.apply(this, arguments);
};

const db = buildDB(DATA);
const N = Number(argv.matches || 24);
const BASE = Number(argv.semente || 8400000);
const FORMS = Object.keys(FORMATIONS);
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (f, h) => {
  const p = autoLineup(squad, f, 0);
  return { squad, name: squad.c, flag: squad.f, color: h ? '#2e9bff' : '#ff3d7f',
           lineup: p.lineup, bench: p.bench, formKey: f, style: 'balanced' };
};
for (let i = 0; i < N; i++) {
  srand(BASE + i * 7919);
  const sim = new MatchSim(mk(FORMS[i % FORMS.length], true), mk(FORMS[i % FORMS.length], false), { neutral: true, labMode: true });
  let g = 0;
  while (!sim.isOver() && g++ < 400000) sim.step(1 / 30);
}
const ord = Object.entries(origens).sort((a, b) => b[1] - a[1]);
real.log(JSON.stringify({
  build: String(argv.build).replace(/^.*[\\/]/, ''), partidas: N, semente: BASE,
  escanteiosTotais: total, porPartida: +(total / N).toFixed(4),
  porOrigem: Object.fromEntries(ord.map(([k, v]) => [k, { n: v, porPartida: +(v / N).toFixed(3) }]))
}, null, 1));
