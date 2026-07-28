#!/usr/bin/env node
'use strict';
/* COMO OS ATRIBUTOS ESTÃO DISTRIBUÍDOS
   -------------------------------------------------------------------------
   O banco guarda 8 fundamentos por jogador (a8: FIN PAS DRI VEL DEF INT FIS TEC)
   e `buildExpandedAttributes` abre isso em 45 atributos = combinação GRAN_MAP
   dos 8 + ruído determinístico de ±2 pontos.

   Mede:
     1. dispersão real de cada um dos 8 fundamentos em toda a base;
     2. dispersão dos atributos derivados, para ver quanto é herdado e quanto
        é ruído;
     3. correlação dentro de um grupo (dois atributos que saem do mesmo
        fundamento são clones?);
     4. os melhores finalizadores da base e o `facet('shot')` efetivo deles,
        para ver quanto o composto dilui o talento específico. */

const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
function noop() {}
function define(n, v) { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } }
define('window', global); define('self', global);
define('navigator', { userAgent: 'cds-dist', language: 'pt-BR' });
define('location', { href: 'runner://dist', search: '', hash: '' });
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
const A8_NOMES = ['FIN', 'PAS', 'DRI', 'VEL', 'DEF', 'INT', 'FIS', 'TEC'];

const todos = [];
for (const s of db.squads) for (const p of (s.pl || [])) todos.push({ p, pais: s.c, ano: Number(s.y) });
const linha = todos.filter(t => t.p.slot !== 'GK');

function stats(vals) {
  if (!vals.length) return null;
  const v = vals.slice().sort((a, b) => a - b);
  const n = v.length, med = v[Math.floor(n / 2)];
  const mean = v.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  return { n, min: v[0], p10: v[Math.floor(n * 0.10)], mediana: med,
           p90: v[Math.floor(n * 0.90)], max: v[n - 1],
           media: +mean.toFixed(1), desvio: +sd.toFixed(2),
           amplitude_p10_p90: v[Math.floor(n * 0.90)] - v[Math.floor(n * 0.10)] };
}

/* 1. os oito fundamentos crus */
const fundamentos = {};
A8_NOMES.forEach((nome, i) => {
  fundamentos[nome] = stats(linha.map(t => Number(t.p.a8 && t.p.a8[i])).filter(Number.isFinite));
});

/* 2. atributos derivados */
const CHAVES = ['finalizacao', 'cabeceio', 'chute_longe', 'compostura', 'posicionamento',
                'conducao', 'passe', 'visao', 'drible', 'ritmo', 'aceleracao',
                'desarme', 'marcacao', 'decisao', 'forca'];
const derivados = {};
for (const k of CHAVES) derivados[k] = stats(linha.map(t => Number(getAttr(t.p, k))).filter(Number.isFinite));

/* 3. clones: dois atributos do MESMO fundamento devem diferir só pelo ruido */
function difMedia(k1, k2) {
  const ds = linha.map(t => Math.abs(getAttr(t.p, k1) - getAttr(t.p, k2))).filter(Number.isFinite);
  return +(ds.reduce((a, b) => a + b, 0) / Math.max(1, ds.length)).toFixed(2);
}
const clones = {
  'finalizacao vs cabeceio': difMedia('finalizacao', 'cabeceio'),
  'passe vs visao': difMedia('passe', 'visao'),
  'drible vs conducao': difMedia('drible', 'conducao'),
  'ritmo vs aceleracao': difMedia('ritmo', 'aceleracao'),
  'desarme vs marcacao': difMedia('desarme', 'marcacao'),
  'forca vs resistencia': difMedia('forca', 'resistencia'),
  'decisao vs posicionamento': difMedia('decisao', 'posicionamento'),
};

/* 4. melhores finalizadores e o composto efetivo */
const atacantes = linha
  .map(t => ({ nome: t.p.n, pais: t.pais, ano: t.ano, slot: t.p.slot, r: t.p.r,
               fin: getAttr(t.p, 'finalizacao'), comp: getAttr(t.p, 'compostura'),
               pos: getAttr(t.p, 'posicionamento'), cond: getAttr(t.p, 'conducao'),
               shot: Math.round(facet(t.p, 'shot')), oneOnOne: Math.round(facet(t.p, 'one_on_one')) }))
  .sort((a, b) => b.fin - a.fin);

const gks = todos.filter(t => t.p.slot === 'GK')
  .map(t => ({ nome: t.p.n, r: t.p.r, gk: Math.round(facet(t.p, 'gk')) }))
  .sort((a, b) => b.gk - a.gk);

realConsole.log(JSON.stringify({
  build: String(argv.build).split(/[\\/]/).pop(),
  jogadores: { total: todos.length, deLinha: linha.length, goleiros: todos.length - linha.length },
  osOitoFundamentos: fundamentos,
  atributosDerivados: derivados,
  diferencaMediaEntreAtributosDoMesmoGrupo: clones,
  nota: 'ruido declarado no codigo = +-2 pontos; diferenca media proxima de ~2 significa clone',
  top15Finalizadores: atacantes.slice(0, 15),
  piores5Finalizadores: atacantes.slice(-5),
  dispersaoDoCompostoShot: stats(atacantes.map(a => a.shot)),
  dispersaoDoFinalizacao: stats(atacantes.map(a => a.fin)),
  top5Goleiros: gks.slice(0, 5),
  dispersaoDoCompostoGk: stats(gks.map(g => g.gk)),
}, null, 2));
