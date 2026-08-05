#!/usr/bin/env node
'use strict';
/*
 * DIAG OS-88 · A BARREIRA TREME?
 * ==============================
 * O contador `quadrosDeInvasaoContida` foi de 5753 para 8967 (111 -> 149 por
 * falta). Ele conta quadros em que o clamp da OS-36 agiu -- NAO prova tremor.
 * Um jogador encostado no circulo e segurado la tem o clamp agindo todo quadro
 * e fica visualmente parado.
 *
 * O que decide se e defeito e o DESLOCAMENTO POR QUADRO durante a janela de
 * bola parada, e a alternancia de direcao (ida e volta = tremor).
 *
 * Mede, durante `__os36Guard` ativo, para cada adversario:
 *   - passo por quadro (m);
 *   - quantas vezes o sinal do deslocamento inverte (tremor);
 *   - quantos passos passam do teto fisico VMAX*dt (= teleporte).
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
D('location', { href: 'runner://os88', search: '', hash: '' });
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
const DT = 1 / 30, VMAX = 7, TETO = VMAX * DT;   // teto fisico por quadro
const passos = [];
let inversoes = 0, amostras = 0, acimaDoTeto = 0, quadrosComGuarda = 0;

const oStep = P.step;
P.step = function (dt) {
  const g0 = this.__os36Guard;
  let antes = null;
  if (g0) {
    antes = new Map();
    const adv = this.teams[1 - g0.team].players;
    for (const p of adv) if (p && !p.red && !p.isGK) antes.set(p, [p.x, p.y]);
  }
  const r = oStep.apply(this, arguments);
  if (antes && this.__os36Guard) {
    quadrosComGuarda++;
    for (const [p, xy] of antes) {
      const dx = p.x - xy[0], dy = p.y - xy[1], d = Math.hypot(dx, dy);
      if (d < 1e-6) continue;
      amostras++;
      passos.push(d);
      if (d > TETO + 1e-6) acimaDoTeto++;
      const ang = Math.atan2(dy, dx);
      if (p.__os88ang != null) {
        let dif = Math.abs(ang - p.__os88ang);
        if (dif > Math.PI) dif = Math.PI * 2 - dif;
        if (dif > Math.PI * 0.75) inversoes++;      // virou mais de 135 graus
      }
      p.__os88ang = ang;
    }
  }
  return r;
};

const db = buildDB(DATA);
const N = Number(argv.matches || 8);
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
  while (!sim.isOver() && g++ < 400000) sim.step(DT);
}
const ord = passos.sort((a, b) => a - b);
const pc = p => ord.length ? +ord[Math.min(ord.length - 1, Math.floor(p * ord.length))].toFixed(4) : null;

real.log(JSON.stringify({
  build: String(argv.build).replace(/^.*[\\/]/, ''), partidas: N,
  quadrosComBarreiraArmada: quadrosComGuarda,
  amostrasDeMovimento: amostras,
  passoPorQuadro_m: { mediana: pc(.5), p90: pc(.9), p99: pc(.99), max: pc(.999) },
  tetoFisicoPorQuadro_m: +TETO.toFixed(4),
  passosAcimaDoTeto: acimaDoTeto,
  fracaoAcimaDoTeto: amostras ? +(acimaDoTeto / amostras).toFixed(4) : null,
  inversoesDeDirecao: inversoes,
  fracaoDeInversao: amostras ? +(inversoes / amostras).toFixed(4) : null
}, null, 1));
