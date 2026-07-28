#!/usr/bin/env node
'use strict';
/* AUDITORIA DOS ELENCOS DE 2026
   -------------------------------------------------------------------------
   Sinal de elenco recente montado a partir de lista antiga: o MESMO jogador
   aparecendo num elenco de 2026 e também num elenco antigo. Quem jogou uma
   Copa de 2010 ou antes não pode estar em campo em 2026.

   Também confere coerência de posição do goleiro: quantos jogadores estão
   marcados como GK em cada elenco (o normal é 2-3), e lista os nomes, porque
   jogador de linha marcado como goleiro afeta o jogo. */

const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
function noop() {}
function define(n, v) { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } }
define('window', global); define('self', global);
define('navigator', { userAgent: 'cds-elencos-2026', language: 'pt-BR' });
define('location', { href: 'runner://elencos', search: '', hash: '' });
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
const CORTE_ANTIGO = Number(argv.corte || 2010);

const porNome = new Map();          // nome -> [{pais, ano}]
for (const s of db.squads) {
  for (const p of (s.pl || [])) {
    const n = String(p && p.n || '').trim();
    if (!n) continue;
    if (!porNome.has(n)) porNome.set(n, []);
    porNome.get(n).push({ pais: s.c, ano: Number(s.y) });
  }
}

const suspeitos = [];
const gkEstranho = [];
let elencos2026 = 0;

for (const s of db.squads) {
  if (Number(s.y) !== 2026) continue;
  elencos2026++;
  const pl = s.pl || [];
  const antigos = [];
  for (const p of pl) {
    const n = String(p && p.n || '').trim();
    const outros = (porNome.get(n) || []).filter(e => e.ano <= CORTE_ANTIGO);
    if (outros.length) antigos.push({ nome: n, rating: p.r, tambemEm: outros.map(e => `${e.pais} ${e.ano}`).join(', ') });
  }
  const gks = pl.filter(p => p && (p.posCode === 'GK' || p.line === 'GK'));
  if (antigos.length) suspeitos.push({ pais: s.c, jogadoresAntigos: antigos.length, lista: antigos });
  if (gks.length < 2 || gks.length > 3) {
    gkEstranho.push({ pais: s.c, goleiros: gks.length, nomes: gks.map(g => `${g.n} (${g.r})`) });
  }
}

suspeitos.sort((a, b) => b.jogadoresAntigos - a.jogadoresAntigos);
const total = suspeitos.reduce((n, s) => n + s.jogadoresAntigos, 0);

realConsole.log(JSON.stringify({
  build: String(argv.build).split(/[\\/]/).pop(),
  elencosDe2026: elencos2026,
  corteDeAnoAntigo: CORTE_ANTIGO,
  resumo: {
    elencosComJogadorDeAntesDoCorte: suspeitos.length,
    totalDeJogadoresSuspeitos: total,
    pctDosElencos2026Afetados: elencos2026 ? +(100 * suspeitos.length / elencos2026).toFixed(1) : 0,
  },
  pioresElencos: suspeitos.slice(0, 12),
  elencos2026ComContagemDeGoleiroEstranha: gkEstranho,
}, null, 2));
