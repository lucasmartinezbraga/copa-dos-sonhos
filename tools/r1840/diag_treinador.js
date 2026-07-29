#!/usr/bin/env node
'use strict';
/* PLANOS TATICOS MORTOS (OS-09) E VELOCIDADE ARTEFATO (OS-10)
   -------------------------------------------------------------------------
   OS-09: _adaptivePlan escolhe 'save_energy' so quando a media de estamina do
   time cai abaixo de 62. A Ordem de Servico mediu piso de 65,1 — tres pontos
   acima do gatilho, entao o plano nunca dispara. Aritmetica pura, sem nada de
   estatistico. Mede a distribuicao real dos planos e o piso de estamina.

   OS-10: a camada transacional nao integra velocidade; deriva da diferenca de
   posicao DEPOIS de clampar o passo. O teto do proprio motor e ~8 m/s e a
   Ordem de Servico observou 18,38 m/s. Mede o perfil de velocidade e quanto
   dela acontece com a bola viajando (o caso que a OS identificou).
   So observacao: nenhum comportamento e alterado. */

const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
function noop() {}
function define(n, v) { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } }
define('window', global); define('self', global);
define('navigator', { userAgent: 'cds-tr', language: 'pt-BR' });
define('location', { href: 'runner://tr', search: '', hash: '' });
define('performance', { now: () => 0 }); define('crypto', crypto.webcrypto);
define('requestAnimationFrame', () => 0); define('cancelAnimationFrame', noop);
define('addEventListener', noop); define('removeEventListener', noop);
define('matchMedia', () => ({ matches: false, addEventListener: noop, removeEventListener: noop }));
define('alert', noop); define('confirm', () => true); define('prompt', () => null);
define('localStorage', { getItem: () => null, setItem: noop, removeItem: noop, clear: noop });
define('sessionStorage', global.localStorage);
define('CanvasRenderingContext2D', undefined);
define('HTMLElement', function HTMLElement() {}); define('HTMLCanvasElement', function HTMLCanvasElement() {});
define('Image', function Image() {}); define('Audio', function Audio() { return { play: () => Promise.resolve(), pause: noop }; });
define('__showBootError', noop); define('__cdsDebugWarn', noop); define('CDS_DEBUG', false);
const realConsole = console;
global.console = { log: noop, warn: noop, error: realConsole.error };

const SKIP = new Set(['cds-2_5d-gate-a-contracts-v02','cds-pre25d-runtime-auditor-v04','cds-r109-async-cup','cds-mobile-boot-bridge','cds-ux-boot']);
const html = fs.readFileSync(argv.build, 'utf8');
const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let mt, idx = 0;
while ((mt = re.exec(html))) {
  const id = (mt[1].match(/id="([^"]+)"/) || [])[1] || `script-${idx}`; idx++;
  if (SKIP.has(id)) continue;
  try { vm.runInThisContext(mt[2], { filename: `${id}.js` }); }
  catch (e) { if (/^script-\d+$/.test(id) && /document is not defined/.test(String(e && e.message || e))) continue; throw e; }
}

const db = buildDB(DATA);
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (f, h) => { const p = autoLineup(squad, f, 0); return { squad, name: squad.c, flag: squad.f, color: h ? '#2e9bff' : '#ff3d7f', lineup: p.lineup, bench: p.bench, formKey: f, style: 'balanced' }; };

const P = MatchSim.prototype;
const T = { planos: Object.create(null), decisoes: 0, staminaTime: [], staminaFim: [], vmax: 0, vAcima8: [], amostras: 0, vComBolaViajando: 0, vTotalAcima8: 0 };

const oPlan = P._adaptivePlan;
if (typeof oPlan === 'function') P._adaptivePlan = function (t) {
  const r = oPlan.apply(this, arguments);
  T.decisoes++;
  const k = (r && r.key) || 'neutro';
  T.planos[k] = (T.planos[k] || 0) + 1;
  const tm = this.teams[t];
  const act = tm.players.filter(p => !p.red && !p.isGK);
  if (act.length) {
    const s = act.reduce((a, p) => a + p.stamina, 0) / act.length;
    T.staminaTime.push(s);
    if (this.minute >= 85) T.staminaFim.push(s);
  }
  return r;
};

const N = Number(argv.matches || 10), DT = 1 / 30;
const SEED = Number(argv.seed || 1710000);
for (const form of ['4-3-3', '4-4-2', '3-5-2']) for (let i = 0; i < N; i++) {
  srand(SEED + i * 977);
  const sim = new MatchSim(mk(form, true), mk(form, false), { neutral: true, labMode: true });
  let s = 0;
  while (!sim.isOver() && s++ < 400000) {
    sim.step(DT);
    if ((s & 15) === 0) {
      const viajando = !!(sim.ball && sim.ball.traveling);
      for (const tm of sim.teams) for (const p of tm.players) {
        if (!p || p.red) continue;
        const v = Math.hypot(p.vx || 0, p.vy || 0);
        T.amostras++;
        if (v > T.vmax) T.vmax = v;
        if (v > 8) { T.vTotalAcima8++; if (viajando) T.vComBolaViajando++; T.vAcima8.push(v); }
      }
    }
  }
}

const nPart = N * 3;
const q = (a, p) => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); return +b[Math.floor(b.length * p)].toFixed(1); };
const pct = (a, b) => +(100 * a / Math.max(1, b)).toFixed(2);
const total = T.decisoes;

realConsole.log(JSON.stringify({
  build: (global.CDS_BUILD_ID || '?'), partidas: nPart,
  'OS-09_PLANOS': {
    decisoes: total,
    distribuicao: Object.fromEntries(Object.entries(T.planos).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v + ' (' + pct(v, total) + '%)'])),
    save_energy_pct: pct(T.planos['save_energy'] || 0, total), alvo: '3% a 12%',
    ten_men: T.planos['ten_men'] || 0,
  },
  ESTAMINA_DO_TIME: {
    minimo: q(T.staminaTime, 0), p10: q(T.staminaTime, .1), mediana: q(T.staminaTime, .5),
    apos85min: { minimo: q(T.staminaFim, 0), p10: q(T.staminaFim, .1), mediana: q(T.staminaFim, .5) },
    nota: 'o gatilho atual e 62; se o piso ficar acima disso, save_energy e codigo morto',
  },
  'OS-10_VELOCIDADE': {
    vmax: +T.vmax.toFixed(2), tetoDoMotor: '~8 m/s',
    amostras: T.amostras, acima8ms: T.vTotalAcima8, pct: pct(T.vTotalAcima8, T.amostras),
    dessas_com_bola_viajando: T.vComBolaViajando, pctDasRapidas: pct(T.vComBolaViajando, T.vTotalAcima8),
    perfil_acima8: { p50: q(T.vAcima8, .5), p90: q(T.vAcima8, .9), p99: q(T.vAcima8, .99) },
  },
}, null, 2));
