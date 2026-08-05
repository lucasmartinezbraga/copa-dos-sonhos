#!/usr/bin/env node
'use strict';
/*
 * DIAG OS-115 · TELEPORTE E FLUIDEZ
 * =================================
 * O DONO, jogando a R18.99 candidata:
 *   "ta rolando uns teleporte, o jogo nao reiniciou os jogadores pras posicoes
 *    depois do gol, tem varias coisas que acho que nao passou no teste, teste a
 *    fluidez do jogo."
 *
 * A bateria mede ecologia (gols, xG, escanteios). Ela e CEGA para salto de
 * posicao: um jogador pode atravessar o campo num quadro e a media de gols nem
 * pisca. Foi assim que a R15 nasceu, com um perfilador de teleporte -- e desde
 * entao ninguem rodou um.
 *
 * O QUE ELE MEDE, quadro a quadro, so em tempo VIVO e tambem na bola morta:
 *   1. SALTO por quadro de cada jogador e da bola, com o maximo e a contagem
 *      acima de 1,5 m -- o mesmo limiar que a R15 usou;
 *   2. a que funcao atribuir o salto: envolve `_kickoff`, `_resetPositions`,
 *      `_setCorner`, `_freeKick`, `_ballOut` e `_switchSides` e marca quem
 *      estava rodando;
 *   3. DEPOIS DO GOL: no instante em que a bola volta a rolar, a distancia de
 *      cada jogador para a PROPRIA posicao de formacao (`hx`,`hy`). Se o time
 *      nao voltou, este numero fica grande;
 *   4. fluidez: quantos quadros a partida passa com a bola morta, e qual a
 *      maior sequencia continua de bola morta.
 *
 * Nao patcha nada.
 *
 * Uso: node diag_os115_teleporte_e_fluidez.js --build=<html> [--matches=6]
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
D('location', { href: 'runner://os115', search: '', hash: '' });
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
const DT = 1 / 30;
const LIMIAR = 1.5;                    // m num quadro -- mesmo limiar da R15
const dd = (a, b, c, d) => Math.hypot(a - c, b - d);

let dentro = null;                     // qual funcao esta rodando
const saltos = [];                     // {d, quem}
let saltoMax = 0, saltoMaxQuem = '';
let quadros = 0, quadrosMortos = 0, sequencia = 0, maiorSequencia = 0;
let saltosBola = 0, saltoBolaMax = 0;
const golVoltas = [];                  // distancia media a formacao no reinicio pos-gol
let pendenteGol = false;

function envolve(nome) {
  const antigo = P[nome];
  if (typeof antigo !== 'function') return;
  P[nome] = function () {
    const anterior = dentro; dentro = nome;
    try { return antigo.apply(this, arguments); } finally { dentro = anterior; }
  };
}
['_kickoff', '_resetPositions', '_setCorner', '_freeKick', '_ballOut',
 '_switchSides', '_goalKickOrRestart', '_goal', '_giveBall'].forEach(envolve);

const oEmit = P._emit;
P._emit = function (t) { if (t === 'goal') pendenteGol = true; return oEmit.apply(this, arguments); };

const oStep = P.step;
P.step = function (dt) {
  const antes = new Map();
  for (const tm of this.teams) for (const p of tm.players) if (p && !p.red) antes.set(p, [+p.x, +p.y]);
  const bAntes = [+this.ball.x, +this.ball.y];
  const morta = (Number(this.dead) || 0) > 0;

  const r = oStep.apply(this, arguments);

  quadros++;
  if ((Number(this.dead) || 0) > 0) { quadrosMortos++; sequencia++; if (sequencia > maiorSequencia) maiorSequencia = sequencia; }
  else sequencia = 0;

  for (const tm of this.teams) for (const p of tm.players) {
    if (!p || p.red) continue;
    const z = antes.get(p); if (!z) continue;
    const d = dd(z[0], z[1], p.x, p.y);
    if (d > LIMIAR) {
      saltos.push({ d: +d.toFixed(2), quem: dentro || 'step' });
      if (d > saltoMax) { saltoMax = d; saltoMaxQuem = dentro || 'step'; }
    }
  }
  const db = dd(bAntes[0], bAntes[1], this.ball.x, this.ball.y);
  if (db > 12 && !this.ball.traveling) { saltosBola++; if (db > saltoBolaMax) saltoBolaMax = db; }

  /* o reinicio depois do gol: a bola voltou a rolar? entao o time devia estar
     na formacao. `hx`/`hy` sao a casa de cada um (:4739). */
  if (pendenteGol && morta && !((Number(this.dead) || 0) > 0)) {
    const ds = [];
    for (const tm of this.teams) for (const p of tm.players) {
      if (!p || p.red || !Number.isFinite(p.hx)) continue;
      ds.push(dd(p.x, p.y, p.hx, p.hy));
    }
    if (ds.length) {
      ds.sort((a, b) => a - b);
      golVoltas.push({
        media: +(ds.reduce((s, v) => s + v, 0) / ds.length).toFixed(2),
        pior: +ds[ds.length - 1].toFixed(2),
        acima_de_8m: ds.filter(v => v > 8).length
      });
    }
    pendenteGol = false;
  }
  return r;
};

const db = buildDB(DATA);
const N = Number(argv.matches || 6);
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

const porQuem = {};
for (const s of saltos) porQuem[s.quem] = (porQuem[s.quem] || 0) + 1;
const med = a => a.length ? +(a.reduce((s, v) => s + v, 0) / a.length).toFixed(2) : null;

real.log(JSON.stringify({
  build: String(argv.build).replace(/^.*[\\/]/, ''),
  sha256: crypto.createHash('sha256').update(html).digest('hex').slice(0, 16),
  partidas: N, quadros: quadros,
  TELEPORTE: {
    saltos_acima_de_1_5m: saltos.length,
    por_partida: +(saltos.length / N).toFixed(2),
    maior_salto_m: +saltoMax.toFixed(2),
    maior_salto_dentro_de: saltoMaxQuem,
    por_funcao: Object.fromEntries(Object.entries(porQuem).sort((a, b) => b[1] - a[1]))
  },
  BOLA: { saltos_acima_de_12m_sem_voo: saltosBola, maior_m: +saltoBolaMax.toFixed(2) },
  REINICIO_DEPOIS_DO_GOL: {
    gols_observados: golVoltas.length,
    distancia_a_formacao_media_m: med(golVoltas.map(v => v.media)),
    distancia_a_formacao_pior_m: med(golVoltas.map(v => v.pior)),
    jogadores_a_mais_de_8m_da_casa: med(golVoltas.map(v => v.acima_de_8m)),
    amostras: golVoltas.slice(0, 6)
  },
  FLUIDEZ: {
    fracao_de_quadros_com_bola_morta: +(quadrosMortos / Math.max(1, quadros)).toFixed(4),
    maior_sequencia_de_bola_morta_s: +(maiorSequencia * DT).toFixed(2)
  }
}, null, 1));
