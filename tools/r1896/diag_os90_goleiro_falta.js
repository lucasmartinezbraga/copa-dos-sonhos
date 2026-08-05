#!/usr/bin/env node
'use strict';
/*
 * DIAG OS-90 · ONDE O GOLEIRO FICA NUMA FALTA DIRETA
 * ==================================================
 * Ultimo item nao medido da falta. No futebol, a barreira cobre o lado CURTO
 * (o poste mais proximo da bola) e o goleiro se posiciona do lado LONGO, com o
 * corpo aberto para o angulo que sobrou. A OS-36 ja arma a barreira sobre a
 * linha bola -> poste mais proximo (:24842).
 *
 * Mede, no instante do chute:
 *   - distancia do goleiro a linha do gol (profundidade);
 *   - deslocamento lateral dele em relacao ao centro do gol;
 *   - se ele esta do lado LONGO (correto) ou do lado da barreira (errado);
 *   - a que distancia ele esta do ponto onde a bola vai cruzar.
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
D('location', { href: 'runner://os90', search: '', hash: '' });
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
const amostras = [];
let ctx = null;
const oFK = P._freeKick;
P._freeKick = function (team, x, y) { ctx = { team, x, y }; return oFK.apply(this, arguments); };

const oEmit = P._emit;
P._emit = function (type, e) {
  if (type === 'freekick' && e && e.direct && ctx) {
    try {
      const tm = this.teams[ctx.team], g = tm.oppGoal;
      const gk = this.teams[1 - ctx.team].players.find(p => p.isGK && !p.red);
      if (gk) {
        /* lado CURTO = o poste mais proximo da bola; a barreira cobre esse lado */
        const ladoCurto = ctx.y < g.y ? -1 : 1;
        const lateralGk = (gk.y - g.y) * ladoCurto;   // >0 = mesmo lado da barreira
        amostras.push({
          profundidade: Math.abs(gk.x - g.x),
          lateral: gk.y - g.y,
          doLadoDaBarreira: lateralGk > 0.3 ? 1 : 0,
          doLadoLongo: lateralGk < -0.3 ? 1 : 0,
          noMeio: Math.abs(lateralGk) <= 0.3 ? 1 : 0,
          dtg: Math.hypot(ctx.x - g.x, ctx.y - g.y)
        });
      }
    } catch (_) {}
    ctx = null;
  }
  return oEmit.apply(this, arguments);
};

const db = buildDB(DATA);
const N = Number(argv.matches || 12);
const FORMS = Object.keys(FORMATIONS);
const mk = (sq, f, h) => {
  const p = autoLineup(sq, f, 0);
  return { squad: sq, name: sq.c, flag: sq.f, color: h ? '#2e9bff' : '#ff3d7f',
           lineup: p.lineup, bench: p.bench, formKey: f, style: 'balanced' };
};
for (let i = 0; i < N; i++) {
  srand(4200000 + i * 7919);
  const A = db.squads[(i * 17 + 3) % db.squads.length];
  const B = db.squads[(i * 29 + 41) % db.squads.length];
  const sim = new MatchSim(mk(A, FORMS[i % FORMS.length], true), mk(B, FORMS[(i + 1) % FORMS.length], false), { neutral: true, labMode: true });
  let g = 0;
  while (!sim.isOver() && g++ < 400000) sim.step(1 / 30);
}
const col = k => amostras.map(a => a[k]).sort((x, y) => x - y);
const pc = (a, p) => a.length ? +a[Math.min(a.length - 1, Math.floor(p * a.length))].toFixed(2) : null;
const res = k => { const a = col(k); return { min: pc(a, 0), p10: pc(a, .1), mediana: pc(a, .5), p90: pc(a, .9), max: pc(a, .999) }; };
const soma = k => amostras.reduce((s, a) => s + a[k], 0);

real.log(JSON.stringify({
  build: String(argv.build).replace(/^.*[\\/]/, ''), partidas: N,
  cobrancasDiretas: amostras.length,
  profundidade_do_goleiro_m: res('profundidade'),
  deslocamento_lateral_m: res('lateral'),
  posicao_relativa_a_barreira: {
    do_lado_da_barreira_ERRADO: soma('doLadoDaBarreira'),
    do_lado_longo_CORRETO: soma('doLadoLongo'),
    no_meio: soma('noMeio'),
    fracao_correta: amostras.length ? +(soma('doLadoLongo') / amostras.length).toFixed(4) : null
  },
  distancia_ao_gol_m: res('dtg')
}, null, 1));
