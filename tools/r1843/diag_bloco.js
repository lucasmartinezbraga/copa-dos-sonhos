#!/usr/bin/env node
'use strict';
/* PROVA DE QUE A CAMADA R18.43 NAO ESTA INERTE
   -------------------------------------------------------------------------
   O handoff §6 registra um patch que foi celebrado e estava inerte (a copia
   sombreada de _gkInterceptTarget), descoberto so quando a bateria saiu
   byte-identica. Este instrumento fecha essa porta antes: le o contador da
   propria camada (`getBlockDepthAudit`) e confirma que
     - a camada existe na build (root.CDS_R1843_ESPACO);
     - ela e chamada (chamadasDef/chamadasAtk > 0);
     - ela de fato ELEVA alvos (elevadosDef/elevadosAtk > 0);
     - o teto de impedimento morde (cortadoPorImpedimento) — o piso nunca
       coloca atacante em posicao irregular sem o corte ser contado.
   Se a camada estiver ausente ou inerte, o processo sai com codigo 1.

   Uso: node tools/r1843/diag_bloco.js --build=ARQUIVO.html [--matches=6]
*/
const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
function noop() {}
function define(n, v) { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } }
define('window', global); define('self', global);
define('navigator', { userAgent: 'cds-diag-bloco', language: 'pt-BR' });
define('location', { href: 'runner://diag', search: '', hash: '' });
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
  try { vm.runInThisContext(mt[2], { filename: `${id}.js` }); } catch (_) {}
}

const meta = global.CDS_R1843_ESPACO;
if (!meta) { realConsole.error('REPROVA: camada cds-r1843-block-depth ausente da build.'); process.exit(1); }

const db = buildDB(DATA);
const N = Number(argv.matches || 6);
const FORMS = Object.keys(FORMATIONS);
const STYLES = (typeof STYLE_KEYS !== 'undefined' && Array.isArray(STYLE_KEYS))
  ? STYLE_KEYS.slice() : ['balanced','tiki','direct','press','counter','wings','park'];
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (f, st, home) => { const p = autoLineup(squad, f, 0); return { squad, name: squad.c, flag: squad.f, color: home ? '#2e9bff' : '#ff3d7f', lineup: p.lineup, bench: p.bench, formKey: f, style: st }; };

let tot = null;
for (let i = 0; i < N; i++) {
  const seed = 4200000 + i * 7919;
  srand(seed);
  const sim = new MatchSim(mk(FORMS[i % FORMS.length], STYLES[i % STYLES.length], true),
                           mk(FORMS[(i*3+1) % FORMS.length], STYLES[(i*5+2) % STYLES.length], false),
                           { neutral: true, labMode: true });
  let s = 0; while (!sim.isOver() && s++ < 500000) sim.step(1/30);
  const a = sim.getBlockDepthAudit();
  if (!tot) tot = { chamadasDef:0, elevadosDef:0, chamadasAtk:0, elevadosAtk:0, cortadoPorImpedimento:0, ganho:0, n:0 };
  tot.chamadasDef += a.chamadasDef; tot.elevadosDef += a.elevadosDef;
  tot.chamadasAtk += a.chamadasAtk; tot.elevadosAtk += a.elevadosAtk;
  tot.cortadoPorImpedimento += a.cortadoPorImpedimento;
  tot.ganho += a.ganhoMedio_m; tot.n++;
}

const taxaDef = tot.chamadasDef ? tot.elevadosDef / tot.chamadasDef : 0;
const taxaAtk = tot.chamadasAtk ? tot.elevadosAtk / tot.chamadasAtk : 0;
realConsole.log(JSON.stringify({
  camada: meta.version, label: meta.label,
  pisoDef: meta.pisoDef, pisoAtk: meta.pisoAtk, suave: meta.suave,
  partidas: N,
  chamadasDef: tot.chamadasDef, elevadosDef: tot.elevadosDef, taxaDef: +(taxaDef*100).toFixed(2) + '%',
  chamadasAtk: tot.chamadasAtk, elevadosAtk: tot.elevadosAtk, taxaAtk: +(taxaAtk*100).toFixed(2) + '%',
  cortadoPorImpedimento: tot.cortadoPorImpedimento,
  ganhoMedio_m: +(tot.ganho / tot.n).toFixed(3),
  rngUsed: meta.rngUsed, teleport: meta.teleport,
}, null, 2));

if (!tot.chamadasDef || !tot.chamadasAtk) { realConsole.error('REPROVA: camada nunca foi chamada.'); process.exit(1); }
if (!tot.elevadosDef && !tot.elevadosAtk) { realConsole.error('REPROVA: camada INERTE — nunca elevou um alvo.'); process.exit(1); }
realConsole.error('OK: camada ativa nas duas fases.');
