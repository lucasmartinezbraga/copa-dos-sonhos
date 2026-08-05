#!/usr/bin/env node
'use strict';
/*
 * DIAG OS-93 · O LATERAL E COBRADO?
 * =================================
 * Observacao do dono: "aconteceu tambem do Neymar ir bater o lateral e sair
 * driblando".
 *
 * Leitura do codigo (:7180 _ballOut, ramo lateral): a bola sai, `dead = 0.65`, e
 * o `pendingRestart` TELEPORTA o jogador mais proximo para o ponto da bola
 * (`cand.x = clamp(b.x,...); cand.y = y`), da a posse e poe `settle = 0.5`.
 * Nao ha arremesso.
 *
 * MAS a camada R18.35 declara `takerWalksTo: ['throwin','freekick','corner']`.
 * Ou existe um tratamento que eu nao achei, ou a declaracao mente. Medir.
 *
 * Mede, por lateral:
 *   - deslocamento entre onde a bola SAIU e onde ela reaparece;
 *   - distancia do cobrador a bola no reinicio;
 *   - o SALTO do cobrador no quadro do reinicio (teleporte?);
 *   - tempo entre a saida e o reinicio.
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
D('location', { href: 'runner://os93', search: '', hash: '' });
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
const FLv = 105, FWv = 68;
const dist = (a, b, c, d) => Math.hypot(a - c, b - d);
const laterais = [];
let saidas = 0, fundo = 0;

/* posicoes de todos os jogadores no quadro anterior, para medir salto */
const oStep = P.step;
P.step = function (dt) {
  const antes = new Map();
  for (const tm of this.teams) for (const p of tm.players) if (!p.red) antes.set(p, [p.x, p.y]);
  const r = oStep.apply(this, arguments);
  this.__os93Antes = antes;
  /* o reinicio pendente ja disparou? */
  if (this.__os93Pend && !(this.dead > 0)) {
    const q = this.__os93Pend; this.__os93Pend = null;
    const dono = this.ball.owner;
    let salto = 0;
    if (dono && antes.has(dono)) salto = dist(antes.get(dono)[0], antes.get(dono)[1], dono.x, dono.y);
    laterais.push({
      bolaAndou: dist(q.bx, q.by, this.ball.x, this.ball.y),
      cobradorAteBola: dono ? dist(dono.x, dono.y, this.ball.x, this.ball.y) : null,
      saltoNoQuadro: salto,
      esperaS: this.t - q.t0
    });
  }
  return r;
};

const oOut = P._ballOut;
P._ballOut = function () {
  const b = this.ball;
  saidas++;
  const lateral = !(b.x <= 0 || b.x >= FLv);
  if (lateral) this.__os93Pend = { bx: b.x, by: b.y, t0: this.t };
  else fundo++;
  return oOut.apply(this, arguments);
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
  while (!sim.isOver() && g++ < 400000) sim.step(1 / 30);
}
const col = k => laterais.map(a => a[k]).filter(v => Number.isFinite(v)).sort((x, y) => x - y);
const pc = (a, p) => a.length ? +a[Math.min(a.length - 1, Math.floor(p * a.length))].toFixed(3) : null;
const res = k => { const a = col(k); return { min: pc(a, 0), p10: pc(a, .1), mediana: pc(a, .5), p90: pc(a, .9), max: pc(a, .999) }; };
const TETO = 7 * (1 / 30);   // passo fisico de referencia por quadro

real.log(JSON.stringify({
  build: String(argv.build).replace(/^.*[\\/]/, ''), partidas: N,
  saidasDeBola: saidas, pelaLinhaDeFundo: fundo,
  laterais_medidos: laterais.length,
  laterais_por_partida: +(laterais.length / N).toFixed(2),
  bola_andou_do_ponto_de_saida_m: res('bolaAndou'),
  cobrador_ate_a_bola_m: res('cobradorAteBola'),
  salto_do_cobrador_no_quadro_m: res('saltoNoQuadro'),
  saltos_acima_de_1m: col('saltoNoQuadro').filter(v => v > 1).length,
  espera_ate_o_reinicio_s: res('esperaS')
}, null, 1));
