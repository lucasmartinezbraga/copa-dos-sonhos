#!/usr/bin/env node
'use strict';
/* SATURAÇÃO DO TOPO DA ESCALA
   -------------------------------------------------------------------------
   Se dezenas de craques compartilham o mesmo 99, draftar o melhor deles é
   indiferente. Mede, por atributo:
     · quantos jogadores estão exatamente no teto (99) e quantos no piso;
     · quantos valores DISTINTOS existem no decil de cima (poder de escolha);
     · o empilhamento nos 5 valores mais frequentes.
   Também mede o mesmo para os 8 fundamentos crus do banco, para separar o
   que é saturação de DADO do que é saturação de FÓRMULA. */

const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
function noop() {}
function define(n, v) { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } }
define('window', global); define('self', global);
define('navigator', { userAgent: 'cds-sat', language: 'pt-BR' });
define('location', { href: 'runner://sat', search: '', hash: '' });
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
const linha = [];
for (const s of db.squads) for (const p of (s.pl || [])) if (p.slot !== 'GK') linha.push(p);

function perfil(vals) {
  const n = vals.length;
  const v = vals.slice().sort((a, b) => a - b);
  const cont = new Map();
  for (const x of vals) cont.set(x, (cont.get(x) || 0) + 1);
  const topo = v[Math.floor(n * 0.90)];
  const noDecilDeCima = vals.filter(x => x >= topo);
  const distintosNoTopo = new Set(noDecilDeCima).size;
  const maisFrequentes = [...cont.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([val, q]) => `${val}:${q} (${(100 * q / n).toFixed(1)}%)`);
  const noTeto = cont.get(99) || 0;
  return {
    n, min: v[0], max: v[n - 1], p90: topo,
    noTeto99: noTeto, pctNoTeto: +(100 * noTeto / n).toFixed(2),
    jogadoresNoDecilDeCima: noDecilDeCima.length,
    valoresDISTINTOSnoDecilDeCima: distintosNoTopo,
    granularidadeDoTopo: +(distintosNoTopo / Math.max(1, noDecilDeCima.length)).toFixed(4),
    maisFrequentes,
  };
}

const A8_NOMES = ['FIN', 'PAS', 'DRI', 'VEL', 'DEF', 'INT', 'FIS', 'TEC'];
const fundamentos = {};
A8_NOMES.forEach((nome, i) => {
  fundamentos[nome] = perfil(linha.map(p => Number(p.a8 && p.a8[i])).filter(Number.isFinite));
});

const CHAVES = ['finalizacao', 'passe', 'drible', 'ritmo', 'desarme', 'cabeceio', 'decisao', 'forca'];
const derivados = {};
for (const k of CHAVES) derivados[k] = perfil(linha.map(p => Number(getAttr(p, k))).filter(Number.isFinite));

/* Quantos jogadores empatam com o MELHOR do jogo em cada atributo? */
const empatesNoTopo = {};
for (const k of CHAVES) {
  const vals = linha.map(p => ({ n: p.n, v: Number(getAttr(p, k)) })).filter(x => Number.isFinite(x.v));
  const max = Math.max(...vals.map(x => x.v));
  const empatados = vals.filter(x => x.v === max);
  empatesNoTopo[k] = { melhorValor: max, quantosEmpatam: empatados.length,
                       exemplos: empatados.slice(0, 8).map(x => x.n) };
}

realConsole.log(JSON.stringify({
  build: String(argv.build).split(/[\\/]/).pop(),
  jogadoresDeLinha: linha.length,
  fundamentosCrus_doBanco: fundamentos,
  atributosDerivados: derivados,
  empatesComOMelhorDoJogo: empatesNoTopo,
  leitura: 'granularidadeDoTopo = valores distintos / jogadores no decil de cima; perto de 0 significa que o topo e um deposito',
}, null, 2));
