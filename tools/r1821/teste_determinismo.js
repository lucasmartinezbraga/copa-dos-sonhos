#!/usr/bin/env node
'use strict';
/* DETERMINISMO — o teste que valida (ou invalida) tudo o que foi medido
   -------------------------------------------------------------------------
   Toda comparação pareada desta sessão pressupõe que o mesmo seed produz o
   mesmo resultado. Se alguma camada introduziu não-determinismo, cada medição
   feita até aqui fica suspeita.

   Roda o MESMO seed duas vezes, no mesmo processo, e compara tudo o que o
   motor produz: placar, todas as chaves de `stats` dos dois times, o censo
   completo de eventos e a posição final de cada jogador. Qualquer divergência
   é falha.

   Também compara com um TERCEIRO run intercalado (A, B, A) para pegar
   contaminação de estado entre partidas, que é o modo de falha mais comum
   quando camadas guardam coisas no protótipo. */

const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
function noop() {}
function define(n, v) { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } }
define('window', global); define('self', global);
define('navigator', { userAgent: 'cds-determinismo', language: 'pt-BR' });
define('location', { href: 'runner://det', search: '', hash: '' });
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
const sha = crypto.createHash('sha256').update(html).digest('hex');
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
const mk = (f, home) => { const p = autoLineup(squad, f, 0); return { squad, name: squad.c, flag: squad.f, color: home ? '#2e9bff' : '#ff3d7f', lineup: p.lineup, bench: p.bench, formKey: f, style: 'balanced' }; };
const DT = 1 / 30;

/* Assinatura completa de uma partida: tudo que o motor produziu. */
function rodar(seed, formacao) {
  srand(seed);
  const sim = new MatchSim(mk(formacao, true), mk(formacao, false), { neutral: true, labMode: true });
  const eventos = Object.create(null);
  const oEmit = sim._emit;
  sim._emit = function (t) { eventos[t] = (eventos[t] || 0) + 1; return oEmit.apply(this, arguments); };
  let s = 0; while (!sim.isOver() && s++ < 500000) sim.step(DT);

  const stats = sim.stats.map(st => {
    const o = {};
    for (const k of Object.keys(st).sort()) if (typeof st[k] === 'number') o[k] = st[k];
    return o;
  });
  const posicoes = [];
  for (const tm of sim.teams) for (const p of tm.players) {
    posicoes.push(`${p.idx}:${(+p.x).toFixed(6)},${(+p.y).toFixed(6)}`);
  }
  const assinatura = JSON.stringify({ placar: sim.score.slice(), passos: s, stats,
                                      eventos: Object.fromEntries(Object.keys(eventos).sort().map(k => [k, eventos[k]])),
                                      posicoes });
  return { assinatura, hash: crypto.createHash('sha256').update(assinatura).digest('hex'),
           placar: sim.score.slice(), passos: s, eventos };
}

const SEEDS = String(argv.seeds || '1710000,1710977,1711954,1712931,1713908,1714885,1715862,1716839')
  .split(',').map(Number);
const FORMACAO = String(argv.formacao || '4-3-3');

const resultados = [];
let falhas = 0;
for (const seed of SEEDS) {
  /* A, B intercalado com outro seed, e A de novo: pega contaminação de estado */
  const a1 = rodar(seed, FORMACAO);
  rodar(seed + 500000, FORMACAO);          // partida intercalada, resultado descartado
  const a2 = rodar(seed, FORMACAO);

  const igual = a1.hash === a2.hash;
  if (!igual) {
    falhas++;
    /* localiza a primeira divergência para o relatório */
    let onde = 'desconhecido';
    const o1 = JSON.parse(a1.assinatura), o2 = JSON.parse(a2.assinatura);
    if (JSON.stringify(o1.placar) !== JSON.stringify(o2.placar)) onde = 'placar';
    else if (o1.passos !== o2.passos) onde = 'numero de passos';
    else if (JSON.stringify(o1.eventos) !== JSON.stringify(o2.eventos)) onde = 'censo de eventos';
    else if (JSON.stringify(o1.stats) !== JSON.stringify(o2.stats)) onde = 'stats';
    else onde = 'posicoes finais';
    resultados.push({ seed, igual, divergeEm: onde, placar1: a1.placar, placar2: a2.placar });
  } else {
    resultados.push({ seed, igual, placar: a1.placar, passos: a1.passos });
  }
}

realConsole.log(JSON.stringify({
  build: String(argv.build).split(/[\\/]/).pop(),
  sha256: sha,
  formacao: FORMACAO,
  seeds: SEEDS.length,
  metodo: 'run A, run intercalado com outro seed, run A de novo; compara assinatura completa',
  falhas,
  veredito: falhas === 0 ? 'PASS — determinismo exato' : `FAIL — ${falhas} de ${SEEDS.length} seeds divergiram`,
  detalhe: resultados,
}, null, 2));
process.exit(falhas === 0 ? 0 : 1);
