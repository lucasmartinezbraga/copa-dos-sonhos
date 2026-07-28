#!/usr/bin/env node
'use strict';
/* PROVA DIRIGIDA DA LEI DO LATERAL
   -------------------------------------------------------------------------
   Monta a cobrança de lateral e tenta marcar gol direto. Sem a lei, o gol
   vale. Com a lei, tem que virar tiro de meta ou escanteio, nunca gol.
   Roda o mesmo cenário na base, na RC1 sem a camada e na RC1 com a camada. */

const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
function noop() {}
function define(n, v) { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } }
define('window', global); define('self', global);
define('navigator', { userAgent: 'cds-lateral', language: 'pt-BR' });
define('location', { href: 'runner://lateral', search: '', hash: '' });
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

const FL = global.FL || 105, FW = global.FW || 68;
const db = buildDB(DATA);
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (home) => { const p = autoLineup(squad, '4-3-3', 0); return { squad, name: squad.c, flag: squad.f, color: home ? '#2e9bff' : '#ff3d7f', lineup: p.lineup, bench: p.bench, formKey: '4-3-3', style: 'balanced' }; };

const N = Number(argv.casos || 40);
const res = { casos: 0, gols: 0, tiroDeMeta: 0, escanteio: 0, chuteBloqueado: 0, outro: 0, leiPresente: !!global.CDS_R1821_THROWIN_LAW };

for (let i = 0; i < N; i++) {
  srand(500000 + i * 131);
  const sim = new MatchSim(mk(true), mk(false), { neutral: true, labMode: true });
  const tm = sim.teams[0];
  const cobrador = tm.players.find(p => !p.isGK && !p.red);
  if (!cobrador) continue;

  const eventos = [];
  const oEmit = sim._emit;
  sim._emit = function (t) { eventos.push(t); return oEmit.apply(this, arguments); };

  // cobrador na lateral, perto da area adversaria
  const dir = tm.attackDir;
  const gx = tm.oppGoal.x;
  cobrador.x = gx - dir * 12; cobrador.y = 0.2; cobrador.vx = 0; cobrador.vy = 0;
  // demais jogadores longe, para ninguem tocar na bola
  for (const t of sim.teams) for (const p of t.players) {
    if (p === cobrador) continue;
    if (p.isGK) continue;
    p.x = gx - dir * 60; p.y = FW / 2; p.vx = 0; p.vy = 0;
  }
  sim.dead = 0; sim.waiting = false; sim.pendingRestart = null;
  const b = sim.ball;
  b.owner = cobrador; b.x = cobrador.x; b.y = cobrador.y; b.z = 0;
  b.vx = b.vy = b.vz = 0; b.traveling = false; b.lastTouch = cobrador;

  // COBRANCA: arremesso direto para dentro do gol adversario
  let erro = null;
  try {
    sim._startTravel(cobrador, { x: gx + dir * 0.5, y: tm.oppGoal.y }, 'pass',
      () => { try { sim._goal(cobrador, false); } catch (_) {} },
      null, 'throw', { throwIn: true });
    // deixa a bola viajar
    let s = 0; while (s++ < 400 && b.traveling) sim.step(1 / 30);
  } catch (e) { erro = String(e && e.message || e); }

  res.casos++;
  if (eventos.includes('goal')) res.gols++;
  else if (eventos.includes('goal_kick')) res.tiroDeMeta++;
  else if (eventos.includes('corner')) res.escanteio++;
  else if (eventos.includes('throwin_law')) res.chuteBloqueado++;
  else res.outro++;
}

realConsole.log(JSON.stringify({
  build: String(argv.build).split(/[\\/]/).pop(),
  leiInstalada: res.leiPresente,
  casos: res.casos,
  GOLS_DIRETOS_DE_LATERAL: res.gols,
  viraramTiroDeMeta: res.tiroDeMeta,
  viraramEscanteio: res.escanteio,
  bloqueadosPelaLei: res.chuteBloqueado,
  semDesfechoClaro: res.outro,
  veredito: res.gols === 0 ? 'PASS — nenhum gol direto de lateral' : `FAIL — ${res.gols} gols diretos`,
}, null, 2));
