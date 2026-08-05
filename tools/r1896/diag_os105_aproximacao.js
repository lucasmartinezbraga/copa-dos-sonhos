#!/usr/bin/env node
'use strict';
/*
 * DIAG OS-105 · COMO O JOGADOR SE APROXIMA PARA CHUTAR
 * =====================================================
 * Observacao do dono: "a forma que o jogador se aproxima pra chutar ficou
 * estranha".
 *
 * "Aproximacao" nao e um numero obvio, entao meco o que da para observar do
 * corpo dele nos 0,6 s antes do chute:
 *   A) quanto ele andou;
 *   B) a velocidade no instante do chute;
 *   C) quanto tempo ficou PARADO com a bola antes de chutar;
 *   D) se ele estava indo em direcao ao gol ou de lado;
 *   E) a distancia dele a bola no instante do chute.
 *
 * Suspeito da OS-98 (decideT passou a vincular, entao ele segura a bola 0,28 s
 * antes de decidir) -- se ele ficar PARADO nesse intervalo, a leitura vira
 * "estatua que de repente chuta". Comparo com a build original.
 *
 * Nao patcha nada.
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
D('location', { href: 'runner://os105', search: '', hash: '' });
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
const JANELA = 18;   // quadros a 1/30 = 0,6 s
const hist = new Map();   // jogador -> ultimas posicoes
const lances = [];

const oStep = P.step;
P.step = function (dt) {
  const r = oStep.apply(this, arguments);
  try {
    for (const tm of this.teams) for (const p of tm.players) {
      if (!p || p.red) continue;
      let h = hist.get(p);
      if (!h) { h = []; hist.set(p, h); }
      h.push({ x: p.x, y: p.y, t: this.t, dono: this.ball.owner === p });
      if (h.length > JANELA + 2) h.shift();
    }
  } catch (_) {}
  return r;
};

const oEmit = P._emit;
P._emit = function (type, e) {
  if (type === 'shot_taken' && e && e.by) {
    try {
      const p = e.by, h = hist.get(p);
      if (h && h.length >= 4) {
        const a = h[0], z = h[h.length - 1];
        let andou = 0, parado = 0, comBola = 0;
        for (let i = 1; i < h.length; i++) {
          const d = Math.hypot(h[i].x - h[i - 1].x, h[i].y - h[i - 1].y);
          andou += d;
          if (d / (1 / 30) < 0.9) parado++;
          if (h[i].dono) comBola++;
        }
        const vFinal = Math.hypot(z.x - h[h.length - 2].x, z.y - h[h.length - 2].y) / (1 / 30);
        const tm = this.teams[p.team], g = tm.oppGoal;
        const dirGol = Math.hypot(g.x - a.x, g.y - a.y) - Math.hypot(g.x - z.x, g.y - z.y);
        lances.push({
          andou, vFinal, fracParado: parado / Math.max(1, h.length - 1),
          quadrosComBola: comBola, aproximouDoGol: dirGol,
          bola: Math.hypot(p.x - this.ball.x, p.y - this.ball.y)
        });
      }
    } catch (_) {}
  }
  return oEmit.apply(this, arguments);
};

const db = buildDB(DATA);
const N = Number(argv.matches || 10);
const FORMS = Object.keys(FORMATIONS);
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (f, h) => {
  const p = autoLineup(squad, f, 0);
  return { squad, name: squad.c, flag: squad.f, color: h ? '#2e9bff' : '#ff3d7f',
           lineup: p.lineup, bench: p.bench, formKey: f, style: 'balanced' };
};
for (let i = 0; i < N; i++) {
  srand(4200000 + i * 7919);
  hist.clear();
  const sim = new MatchSim(mk(FORMS[i % FORMS.length], true), mk(FORMS[i % FORMS.length], false), { neutral: true, labMode: true });
  let g = 0;
  while (!sim.isOver() && g++ < 400000) sim.step(1 / 30);
}
const col = k => lances.map(a => a[k]).filter(Number.isFinite).sort((x, y) => x - y);
const pc = (a, p) => a.length ? +a[Math.min(a.length - 1, Math.floor(p * a.length))].toFixed(3) : null;
const res = k => { const a = col(k); return { min: pc(a, 0), p25: pc(a, .25), mediana: pc(a, .5), p75: pc(a, .75), max: pc(a, .999) }; };

real.log(JSON.stringify({
  build: String(argv.build).replace(/^.*[\\/]/, ''), partidas: N, chutes: lances.length,
  andou_nos_0_6s_antes_do_chute_m: res('andou'),
  velocidade_no_instante_do_chute_ms: res('vFinal'),
  fracao_dos_quadros_PARADO: res('fracParado'),
  quadros_com_a_bola_no_pe_de_18: res('quadrosComBola'),
  aproximou_do_gol_m: res('aproximouDoGol'),
  distancia_a_bola_no_chute_m: res('bola')
}, null, 1));
