#!/usr/bin/env node
'use strict';
/*
 * DIAG OS-103 · A PRECISAO DO CHUTE DE BOLA ROLANDO
 * ==================================================
 * Observacao do dono: "senti que a precisao dos chutes ficou estranha".
 *
 * Pode ser regressao minha. A OS-92 reprojeta o alvo de chutes ja resolvidos
 * como `miss` para que cruzem a linha por FORA do poste -- antes, 43% deles
 * cruzavam ENTRE as traves. O efeito colateral esperado e que os erros passem a
 * PARECER mais abertos, porque antes muitos "erros" passavam dentro do gol.
 *
 * Este instrumento mede, para chutes de BOLA ROLANDO (nao faltas nem penaltis):
 *   A) divisao de desfecho: gol / defesa / bloqueio / trave / fora;
 *   B) onde a bola cruza a linha de fundo, em metros do centro do gol;
 *   C) quantos sao "selvagens" -- cruzam a mais de 8 m do centro (o gol tem 3,66
 *      de meia largura, entao 8 m e mais que o dobro).
 *
 * Compara duas builds na mesma semente. Nao patcha nada.
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
D('location', { href: 'runner://os103', search: '', hash: '' });
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
const desf = {};
const desvios = [];       // |y do cruzamento - centro do gol|, em metros
let bolaParada = 0, rolando = 0;

/* marca faltas e penaltis para excluir */
let contexto = null;
for (const fn of ['_freeKick', '_penalty']) {
  const f = P[fn];
  if (typeof f !== 'function') continue;
  P[fn] = function () { contexto = fn; try { return f.apply(this, arguments); } finally { contexto = null; } };
}
/* o desfecho da falta sai dentro do pendingRestart, entao marcamos a bola */
const oST = P._startTravel;
P._startTravel = function (o, target, kind) {
  const r = oST.apply(this, arguments);
  try { if (kind === 'shot') this.ball.__os103SetPiece = !!contexto || !!(o && o._setPieceShotUntil > this.t); } catch (_) {}
  return r;
};

const oEmit = P._emit;
P._emit = function (type, e) {
  if ((type === 'goal' || type === 'miss' || type === 'save' || type === 'blocked' || type === 'post') && e) {
    try {
      const by = e.by || e.gk && { team: 1 - e.gk.team } || null;
      const b = this.ball;
      const sp = !!(b && b.__os103SetPiece);
      if (sp) bolaParada++;
      else if (by && this.teams[by.team]) {
        rolando++;
        desf[type] = (desf[type] || 0) + 1;
        const g = this.teams[by.team].oppGoal;
        if (b && Number.isFinite(b.vx) && Math.hypot(b.vx, b.vy) > 1) {
          const bruto = (b.x - g.x) / b.vx;
          const bk = (bruto > 0 && bruto < 0.6) ? bruto : 0;
          const cy = b.y - b.vy * bk;
          desvios.push(Math.abs(cy - g.y));
        }
      }
    } catch (_) {}
  }
  return oEmit.apply(this, arguments);
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
const ord = desvios.sort((a, b) => a - b);
const pc = p => ord.length ? +ord[Math.min(ord.length - 1, Math.floor(p * ord.length))].toFixed(2) : null;
const tot = Object.values(desf).reduce((a, b) => a + b, 0) || 1;
const pctd = {};
for (const k of Object.keys(desf).sort()) pctd[k] = +(desf[k] / tot * 100).toFixed(1) + '%';

real.log(JSON.stringify({
  build: String(argv.build).replace(/^.*[\\/]/, ''), partidas: N,
  desfechos_de_bola_rolando: pctd,
  eventos_bola_rolando: rolando, eventos_bola_parada_excluidos: bolaParada,
  desvio_do_centro_do_gol_no_cruzamento_m: {
    min: pc(0), p25: pc(.25), mediana: pc(.5), p75: pc(.75), p90: pc(.9), max: pc(.999)
  },
  dentro_das_traves_ate_3_66m: ord.filter(v => v <= 3.66).length + ' de ' + ord.length,
  selvagens_acima_de_8m: ord.filter(v => v > 8).length + ' de ' + ord.length
}, null, 1));
