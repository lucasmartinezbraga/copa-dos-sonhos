#!/usr/bin/env node
'use strict';
/*
 * DIAG OS-112 · O LATERAL: A BOLA SAI? E ALGUEM SE OFERECE?
 * =========================================================
 * DUAS OBSERVACOES DO DONO, jogando a R18.97:
 *   "Mostre a bola realmente saindo pra fora no lateral."
 *   "Os jogadores nao se aproximam pra receber o lateral, falta isso tambem."
 *
 * O QUE O CODIGO DIZ, antes de medir
 *   `:17145` e `:16691` chamam `_ballOut` no instante EXATO em que a bola cruza
 *   a linha (`b.y < 0 || b.y > FW`), e `_ballOut` (:7197) faz
 *   `b.traveling = false; b.owner = null` -- ou seja, congela a bola em cima da
 *   linha. Depois, no reinicio, o ponto e `clamp(b.x,1,FL-1)` e
 *   `clamp(b.y,1,FW-1)`: um metro DENTRO do campo. A bola nunca sai.
 *   E ninguem, em lugar nenhum, recebe posto de apoio ao lateral: o unico
 *   jogador tratado e o cobrador (OS-100, :21556).
 *
 * O QUE ELE MEDE, por lateral:
 *   1. quanto a bola passa da linha (maximo de |y| fora do campo, e por quantos
 *      quadros ela fica fora);
 *   2. distancia entre o ponto onde ela cruzou e onde ela e recolocada;
 *   3. quantos companheiros do cobrador estao a menos de 8 m, 12 m e 18 m do
 *      ponto no instante do reinicio -- e quanto eles ANDARAM na bola morta;
 *   4. o mesmo para os adversarios, que e quem deveria marcar.
 *
 * Nao patcha nada.
 *
 * Uso: node diag_os112_lateral_saida_e_apoio.js --build=<html> [--matches=8]
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
D('location', { href: 'runner://os112', search: '', hash: '' });
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
if (!argv.build) { real.error('ABORTA: informe --build=<html>'); process.exit(1); }
const html = fs.readFileSync(argv.build, 'utf8');
const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let m, idx = 0;
while ((m = re.exec(html))) {
  const id = (m[1].match(/id="([^"]+)"/) || [])[1] || ('script-' + idx); idx++;
  if (SKIP.has(id)) continue;
  try { vm.runInThisContext(m[2], { filename: id + '.js' }); } catch (_) {}
}

const P = MatchSim.prototype;
const FLv = 105, FWv = 68, DT = 1 / 30;
const dd = (a, b, c, d) => Math.hypot(a - c, b - d);
const foraDoCampo = (x, y) => (y < 0 ? -y : (y > FWv ? y - FWv : 0));

const lances = [];
let atual = null;

const oOut = P._ballOut;
P._ballOut = function () {
  const b = this.ball;
  const ehLateral = !(b.x <= 0 || b.x >= FLv);
  const x0 = +b.x, y0 = +b.y;
  const r = oOut.apply(this, arguments);
  if (ehLateral) {
    const pos = new Map();
    for (const tm of this.teams) for (const p of tm.players) {
      if (p && !p.red && !p.isGK) pos.set(p, [+p.x, +p.y]);
    }
    atual = {
      x0, y0, foraNoApito: foraDoCampo(x0, y0),
      maxFora: foraDoCampo(x0, y0), quadrosFora: 0, quadros: 0,
      pos, time: null
    };
  }
  return r;
};

const oStep = P.step;
P.step = function (dt) {
  const r = oStep.apply(this, arguments);
  if (!atual) return r;
  atual.quadros++;
  const b = this.ball;
  const f = foraDoCampo(+b.x, +b.y);
  if (f > atual.maxFora) atual.maxFora = f;
  if (f > 0.01) atual.quadrosFora++;
  if (!((Number(this.dead) || 0) > 0) || atual.quadros > 400) {
    const dono = b.owner;
    atual.time = dono ? dono.team : null;
    atual.xR = +b.x; atual.yR = +b.y;
    atual.recolocada = dd(atual.x0, atual.y0, atual.xR, atual.yR);
    atual.janela_s = +(atual.quadros * DT).toFixed(3);
    /* quem esta perto do PONTO no instante do reinicio, e quanto andou */
    const perto = { c8: 0, c12: 0, c18: 0, a8: 0, a12: 0, a18: 0 };
    const andouC = [], andouA = [];
    for (const tm of this.teams) for (const p of tm.players) {
      if (!p || p.red || p.isGK || p === dono) continue;
      const z = atual.pos.get(p); if (!z) continue;
      const d = dd(p.x, p.y, atual.x0, atual.y0);
      const andou = dd(z[0], z[1], p.x, p.y);
      const meu = atual.time != null && p.team === atual.time;
      if (meu) { andouC.push(andou); if (d <= 8) perto.c8++; if (d <= 12) perto.c12++; if (d <= 18) perto.c18++; }
      else { andouA.push(andou); if (d <= 8) perto.a8++; if (d <= 12) perto.a12++; if (d <= 18) perto.a18++; }
    }
    atual.perto = perto; atual.andouC = andouC; atual.andouA = andouA;
    delete atual.pos;
    lances.push(atual); atual = null;
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
  atual = null;
  let g = 0;
  while (!sim.isOver() && g++ < 400000) sim.step(DT);
}

const ord = a => a.slice().sort((x, y) => x - y);
const pc = (a, q) => a.length ? +ord(a)[Math.min(a.length - 1, Math.floor(q * a.length))].toFixed(3) : null;
const res = a => a.length ? { min: pc(a, 0), p50: pc(a, .5), p90: pc(a, .9), max: pc(a, .999) } : 'sem amostra';
const media = a => a.length ? +(a.reduce((s, v) => s + v, 0) / a.length).toFixed(3) : null;
const L = lances.filter(l => l.time != null);

real.log(JSON.stringify({
  build: String(argv.build).replace(/^.*[\\/]/, ''),
  sha256: crypto.createHash('sha256').update(html).digest('hex').slice(0, 16),
  partidas: N, laterais: lances.length, com_dono_identificado: L.length,
  janela_de_bola_morta_s: res(L.map(l => l.janela_s)),
  A_BOLA_SAI: {
    quanto_ela_passa_da_linha_m: res(L.map(l => l.maxFora)),
    quadros_com_a_bola_FORA: res(L.map(l => l.quadrosFora)),
    laterais_em_que_ela_passou_de_0_5m: L.filter(l => l.maxFora > 0.5).length + ' de ' + L.length,
    distancia_do_cruzamento_ao_ponto_de_reinicio_m: res(L.map(l => l.recolocada))
  },
  ALGUEM_SE_OFERECE: {
    companheiros_a_menos_de_8m: media(L.map(l => l.perto.c8)),
    companheiros_a_menos_de_12m: media(L.map(l => l.perto.c12)),
    companheiros_a_menos_de_18m: media(L.map(l => l.perto.c18)),
    adversarios_a_menos_de_8m: media(L.map(l => l.perto.a8)),
    adversarios_a_menos_de_12m: media(L.map(l => l.perto.a12)),
    quanto_os_companheiros_ANDARAM_na_bola_morta_m:
      res(L.reduce((a, l) => a.concat(l.andouC), [])),
    quanto_os_adversarios_ANDARAM_na_bola_morta_m:
      res(L.reduce((a, l) => a.concat(l.andouA), []))
  }
}, null, 1));
