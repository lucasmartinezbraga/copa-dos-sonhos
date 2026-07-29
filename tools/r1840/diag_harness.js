#!/usr/bin/env node
'use strict';
/* ONDE, EXATAMENTE, O BUNDLE PRINCIPAL LANCA — E O QUE MORRE DEPOIS
   -------------------------------------------------------------------------
   Todos os harnesses desta linhagem terminam com esta clausula:

     catch (e) { if (/^script-\d+$/.test(id) && /document is not defined/
                     .test(String(e&&e.message||e))) continue; throw e; }

   e a bateria vai alem: conta o bloco que falhou como `scriptsOk++`. Por isso
   `scriptsComErro: 0` aparece em todos os relatorios promovidos — inclusive nos
   da R18.25, R18.31 e R18.35 — enquanto o bloco principal (script-2, 1,16 MB)
   de fato lanca e para no meio.

   Este instrumento nao conserta nada: LOCALIZA. Roda o bloco isolado, captura
   a excecao com pilha, imprime a linha exata do fonte que a produziu e o
   contexto ao redor, e depois lista quais simbolos o motor precisa e quais
   sobreviveram. Sem isso nao ha como afirmar que a medicao mede o jogo inteiro. */

const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
function noop() {}
function define(n, v) { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } }
define('window', global); define('self', global);
define('navigator', { userAgent: 'cds-harness', language: 'pt-BR' });
define('location', { href: 'runner://h', search: '', hash: '' });
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
global.console = { log: noop, warn: noop, error: noop };

const SIM_ESPERADOS = ['MatchSim','autoLineup','buildDB','DATA','FORMATIONS','FORMATION_KEYS','srand','R','chance','facet','getAttr','clamp','D','FL','FW','CAL','STYLE_KEYS'];
const CUP_ESPERADOS = ['bestFormationFor','teamFor','pickStyleFor','CUP'];

const html = fs.readFileSync(argv.build, 'utf8');
const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
const blocos = [];
let mt, idx = 0;
while ((mt = re.exec(html))) {
  const id = (mt[1].match(/id="([^"]+)"/) || [])[1] || `script-${idx}`; idx++;
  blocos.push({ id, code: mt[2] });
}

const SKIP = new Set(['cds-2_5d-gate-a-contracts-v02','cds-pre25d-runtime-auditor-v04','cds-r109-async-cup','cds-mobile-boot-bridge','cds-ux-boot']);
const falhas = [];
for (const b of blocos) {
  if (SKIP.has(b.id)) continue;
  try { vm.runInThisContext(b.code, { filename: `${b.id}.js` }); }
  catch (e) {
    const pilha = String(e && e.stack || e);
    const m = pilha.match(new RegExp(b.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.js:(\\d+):(\\d+)'));
    const linhaNum = m ? Number(m[1]) : null;
    const linhas = b.code.split('\n');
    const ctx = [];
    if (linhaNum) for (let i = Math.max(0, linhaNum - 4); i < Math.min(linhas.length, linhaNum + 3); i++) {
      ctx.push((i + 1 === linhaNum ? '>>> ' : '    ') + (i + 1) + ': ' + linhas[i].slice(0, 220));
    }
    falhas.push({
      bloco: b.id, tamanho: b.code.length, totalDeLinhas: linhas.length,
      mensagem: String(e && e.message || e),
      linha: linhaNum, pctDoBloco: linhaNum ? +(100 * linhaNum / linhas.length).toFixed(1) : null,
      contexto: ctx,
      primeiraLinhaDaPilha: pilha.split('\n').slice(0, 4),
    });
  }
}

const falta = n => typeof global[n] === 'undefined';
realConsole.log(JSON.stringify({
  build: String(argv.build).split(/[\\/]/).pop(),
  sha: crypto.createHash('sha256').update(fs.readFileSync(argv.build)).digest('hex').slice(0, 12),
  blocos: blocos.length, blocosPulados: blocos.filter(b => SKIP.has(b.id)).length,
  BLOCOS_QUE_LANCARAM: falhas,
  SIMBOLOS_DO_MOTOR: { faltando: SIM_ESPERADOS.filter(falta), ok: SIM_ESPERADOS.filter(n => !falta(n)).length + '/' + SIM_ESPERADOS.length },
  SIMBOLOS_DA_COPA: { faltando: CUP_ESPERADOS.filter(falta), ok: CUP_ESPERADOS.filter(n => !falta(n)).length + '/' + CUP_ESPERADOS.length },
}, null, 2));
