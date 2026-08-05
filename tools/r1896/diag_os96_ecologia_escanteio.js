#!/usr/bin/env node
'use strict';
/*
 * DIAG OS-96 · OS CONTADORES DA PROPRIA CAMADA DE ECOLOGIA DE ESCANTEIO
 * =====================================================================
 * `_setCorner` e chamado 10,25x/partida e so 5,833 contam. A camada R18.18.3
 * (:22841) explica a diferenca de DUAS formas opostas:
 *
 *   (a) CONVERSAO FISICA -- resolveSaveParry / resolvePunch / resolveBlock /
 *       resolveClearBehind. A bola e defletida de verdade; se cruzar a linha, o
 *       escanteio nasce depois em `_ballOut`. Isso NAO e perda: e o principio do
 *       HANDOFF §4 (desfecho estatistico com consequencia fisica).
 *
 *   (b) SUPRESSAO -- `:22850`, quando o ultimo toque e do proprio atacante:
 *       vira TIRO DE META (`unprovenSuppressed`).
 *
 * Para saber onde estao os escanteios que faltam, leio os contadores que a
 * propria camada mantem. Nao patcha nada.
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
D('location', { href: 'runner://os96', search: '', hash: '' });
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

const db = buildDB(DATA);
const N = Number(argv.matches || 12);
const FORMS = Object.keys(FORMATIONS);
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (f, h) => {
  const p = autoLineup(squad, f, 0);
  return { squad, name: squad.c, flag: squad.f, color: h ? '#2e9bff' : '#ff3d7f',
           lineup: p.lineup, bench: p.bench, formKey: f, style: 'balanced' };
};
const soma = {};
let corners = 0;
for (let i = 0; i < N; i++) {
  srand(4200000 + i * 7919);
  const sim = new MatchSim(mk(FORMS[i % FORMS.length], true), mk(FORMS[i % FORMS.length], false), { neutral: true, labMode: true });
  let g = 0;
  while (!sim.isOver() && g++ < 400000) sim.step(1 / 30);
  corners += (sim.stats[0].corners || 0) + (sim.stats[1].corners || 0);
  const s = sim.__r18183;
  if (s) for (const k in s) {
    if (k === 'events' || k === 'version') continue;
    if (k === 'cornerCause') { for (const c in s.cornerCause) soma['causa_' + c] = (soma['causa_' + c] || 0) + s.cornerCause[c]; continue; }
    if (typeof s[k] === 'number') soma[k] = (soma[k] || 0) + s[k];
  }
}
const pp = v => +(v / N).toFixed(3);
const out = {};
for (const k of Object.keys(soma).sort()) out[k] = pp(soma[k]);
real.log(JSON.stringify({
  build: String(argv.build).replace(/^.*[\\/]/, ''), partidas: N,
  ESCANTEIOS_contados_por_partida: pp(corners),
  contadores_da_camada_R18_18_3_por_partida: out
}, null, 1));
