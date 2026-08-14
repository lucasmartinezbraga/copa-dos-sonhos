#!/usr/bin/env node
'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   QUEM DE FATO RODA NA PILHA DE CAMADAS

   O bundle tem 81 camadas que sobrescrevem 135 metodos do MatchSim, 328 vezes.
   Ninguem sabe quais rodam. Tres vezes neste projeto eu editei o lugar obvio,
   medi, e os numeros vieram identicos — porque uma camada acima interceptava e
   nao chamava a de baixo.

   Como isto mede: o bundle e carregado bloco a bloco. DEPOIS de cada bloco,
   toda funcao que aquele bloco acabou de instalar no prototype e embrulhada num
   contador. O bloco seguinte embrulha o contador. No fim, cada uma das 328
   sobrescritas tem seu proprio contador, e uma partida real diz quais foram
   chamadas.

   Tres estados por sobrescrita:
     VIVA      — chamada, e chama a de baixo
     TERMINAL  — chamada, e NUNCA chama a de baixo (mata o que esta abaixo)
     MORTA     — nunca chamada

   Uso: node tools/fisica/pilha.js dist/index.html [partidas]
   ═══════════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const crypto = require('crypto');

const BUILD = path.resolve(process.argv[2] || 'dist/index.html');
const N = Number(process.argv[3] || 2);

function noop() {}
function define(n, v) {
  try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); }
  catch (_) { global[n] = v; }
}
function ambiente() {
  define('window', global); define('self', global);
  define('navigator', { userAgent: 'cds-pilha', language: 'pt-BR' });
  define('location', { href: 'runner://pilha', search: '', hash: '' });
  define('performance', { now: () => 0 }); define('crypto', crypto.webcrypto);
  define('requestAnimationFrame', () => 0); define('cancelAnimationFrame', noop);
  define('addEventListener', noop); define('removeEventListener', noop);
  define('matchMedia', () => ({ matches: false, addEventListener: noop, removeEventListener: noop }));
  define('alert', noop); define('confirm', () => true); define('prompt', () => null);
  define('localStorage', { getItem: () => null, setItem: noop, removeItem: noop, clear: noop });
  define('sessionStorage', global.localStorage);
  define('CanvasRenderingContext2D', undefined);
  define('HTMLElement', function HTMLElement() {});
  define('HTMLCanvasElement', function HTMLCanvasElement() {});
  define('Image', function Image() {});
  define('Audio', function Audio() { return { play: () => Promise.resolve(), pause: noop }; });
  define('__showBootError', noop); define('__cdsDebugWarn', noop); define('CDS_DEBUG', false);
}
const SKIP = new Set(['cds-2_5d-gate-a-contracts-v02', 'cds-pre25d-runtime-auditor-v04',
  'cds-r109-async-cup', 'cds-mobile-boot-bridge', 'cds-ux-boot']);

ambiente();
const realConsole = console;
global.console = { log: noop, warn: noop, error: realConsole.error };

const html = fs.readFileSync(BUILD, 'utf8');
const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;

/* registro: uma entrada por sobrescrita */
const REG = [];
let profundidade = 0;          // quantas chamadas embrulhadas estao na pilha
const pilhaAtual = [];

function embrulhar(entrada, fn) {
  return function () {
    entrada.chamadas++;
    pilhaAtual.push(entrada);
    const antes = REG.length && entrada.__abaixoChamado;
    entrada.__marca = 0;
    try {
      return fn.apply(this, arguments);
    } finally {
      pilhaAtual.pop();
      void antes;
    }
  };
}

/* Detecta "chamou a de baixo": quando uma entrada mais funda (mesmo metodo,
   indice menor) e invocada enquanto esta esta na pilha. */
function marcarDescida(entrada) {
  for (let i = pilhaAtual.length - 1; i >= 0; i--) {
    const acima = pilhaAtual[i];
    if (acima !== entrada && acima.metodo === entrada.metodo && acima.ordem > entrada.ordem) {
      acima.chamouAbaixo++;
      break;
    }
  }
}

let mt, idx = 0, ordem = 0;
let P = null, anterior = new Map();

while ((mt = re.exec(html))) {
  const id = (mt[1].match(/id="([^"]+)"/) || [])[1] || `bloco-${idx}`; idx++;
  if (SKIP.has(id)) continue;
  try { vm.runInThisContext(mt[2], { filename: `${id}.js` }); } catch (_) {}

  if (!P && global.MatchSim && global.MatchSim.prototype) {
    P = global.MatchSim.prototype;
    for (const k of Object.getOwnPropertyNames(P)) {
      const d = Object.getOwnPropertyDescriptor(P, k);
      if (d && typeof d.value === 'function') anterior.set(k, d.value);
    }
    continue;
  }
  if (!P) continue;

  /* o que este bloco acabou de instalar */
  for (const k of Object.getOwnPropertyNames(P)) {
    if (k === 'constructor') continue;
    const d = Object.getOwnPropertyDescriptor(P, k);
    if (!d || typeof d.value !== 'function') continue;
    if (anterior.get(k) === d.value) continue;
    const entrada = { bloco: id, metodo: k, ordem: ordem++, chamadas: 0, chamouAbaixo: 0 };
    REG.push(entrada);
    const original = d.value;
    const embrulhado = embrulhar(entrada, function () {
      marcarDescida(entrada);
      return original.apply(this, arguments);
    });
    try { P[k] = embrulhado; } catch (_) {}
    anterior.set(k, P[k]);
  }
}

global.console = realConsole;
if (!global.MatchSim) { console.error('motor nao carregou'); process.exit(2); }

/* --------------------------------------------------------- roda partidas -- */
const db = buildDB(DATA);
const FORMS = Object.keys(FORMATIONS);
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const STYLES = (typeof STYLE_KEYS !== 'undefined' && Array.isArray(STYLE_KEYS))
  ? STYLE_KEYS.slice() : ['balanced','tiki','direct','press','counter','wings','park'];
const SQUADS = db.squads;
const mk = (f, st, sq, h) => {
  const p = autoLineup(sq, f, 0);
  return { squad: sq, name: h ? 'A' : 'B', flag: sq.f, color: '#fff',
    lineup: p.lineup, bench: p.bench, formKey: f, style: st };
};
global.console = { log: noop, warn: noop, error: realConsole.error };
for (let k = 0; k < N; k++) {
  srand(4200000 + k * 7919);
  /* Varia formacao, ESTILO e FORCA dos times, e nao usa labMode: caminhos so
     alcancaveis em penalti, prorrogacao, substituicao, lesao ou estilo
     especifico apareciam como MORTOS numa amostra de 2 partidas iguais. */
  const sim = new MatchSim(
    mk(FORMS[k % FORMS.length], STYLES[k % STYLES.length], SQUADS[(k * 7) % SQUADS.length], true),
    mk(FORMS[(k + 3) % FORMS.length], STYLES[(k * 3 + 1) % STYLES.length], SQUADS[(k * 13 + 5) % SQUADS.length], false),
    { neutral: true });
  let n = 0;
  while (!sim.isOver() && n++ < 500000) sim.step(1 / 30);
  /* prorrogacao e disputa de penaltis: ramos que uma partida normal nao toca */
  if (k % 3 === 0 && typeof sim.beginExtraTime === 'function' && sim.score[0] === sim.score[1]) {
    sim.beginExtraTime();
    let m = 0; while (!sim.isOver() && m++ < 500000) sim.step(1 / 30);
  }
  /* substituicao: idem */
  try { if (sim.teams[0].bench && sim.teams[0].bench.length) sim.substitute(0, 10, sim.teams[0].bench[0]); } catch (_) {}
}
global.console = realConsole;

/* ------------------------------------------------------------- relatorio -- */
const porMetodo = {};
for (const e of REG) (porMetodo[e.metodo] = porMetodo[e.metodo] || []).push(e);

let vivas = 0, terminais = 0, mortas = 0;
const porBloco = {};
for (const e of REG) {
  const b = (porBloco[e.bloco] = porBloco[e.bloco] || { n: 0, mortas: 0, terminais: 0, chamadas: 0 });
  b.n++; b.chamadas += e.chamadas;
  const temAbaixo = (porMetodo[e.metodo] || []).some(x => x.ordem < e.ordem);
  if (e.chamadas === 0) { mortas++; b.mortas++; e.estado = 'MORTA'; }
  else if (temAbaixo && e.chamouAbaixo === 0) { terminais++; b.terminais++; e.estado = 'TERMINAL'; }
  else { vivas++; e.estado = 'VIVA'; }
}

console.log(`PILHA DE CAMADAS — ${N} partida(s), ${REG.length} sobrescritas de ${Object.keys(porMetodo).length} metodos\n`);
console.log(`  VIVAS     ${String(vivas).padStart(4)}  chamadas e passam adiante`);
console.log(`  TERMINAIS ${String(terminais).padStart(4)}  chamadas e NUNCA chamam a camada de baixo`);
console.log(`  MORTAS    ${String(mortas).padStart(4)}  nunca chamadas (${(mortas / REG.length * 100).toFixed(0)}%)`);

console.log('\nMETODOS COM SOBRESCRITA MORTA OU TERMINAL (o que esta abaixo nao roda):');
for (const m of Object.keys(porMetodo).sort()) {
  const lista = porMetodo[m].sort((a, b) => a.ordem - b.ordem);
  if (lista.length < 2) continue;
  const ruim = lista.filter(e => e.estado !== 'VIVA');
  if (!ruim.length) continue;
  console.log(`  ${m}  (${lista.length} camadas)`);
  for (const e of lista) {
    const marca = e.estado === 'VIVA' ? '  ok   ' : e.estado === 'MORTA' ? ' MORTA ' : 'TERMINAL';
    console.log(`     ${marca} ${e.bloco.slice(0, 46).padEnd(46)} ${String(e.chamadas).padStart(9)} chamadas`);
  }
}

console.log('\nBLOCOS INTEIRAMENTE MORTOS (nenhuma sobrescrita chamada):');
for (const [b, v] of Object.entries(porBloco)) {
  if (v.chamadas === 0) console.log(`  ${b.padEnd(50)} ${v.n} sobrescrita(s), 0 chamadas`);
}

console.log('\nTODAS AS SOBRESCRITAS MORTAS, POR BLOCO:');
const mortasPorBloco = {};
for (const e of REG) if (e.estado === 'MORTA') (mortasPorBloco[e.bloco] = mortasPorBloco[e.bloco] || []).push(e.metodo);
for (const [b, ms] of Object.entries(mortasPorBloco).sort((a,c)=>c[1].length-a[1].length)) {
  /* Os NOMES nao podem ser truncados aqui. Este resumo e a unica fonte da lista
     completa — o relatorio detalhado acima so imprime secao para parte dos
     metodos. Com o `.slice(0,70)` antigo, a rodada de 300 partidas do D34
     (que custa ~1 h) chegava com 5 nomes faltando na camada 07, e quem fosse
     apagar teria de rodar tudo de novo. Quebra em varias linhas em vez de
     cortar. */
  const cab = `  ${b.slice(0,46).padEnd(46)} ${String(ms.length).padStart(2)}  `;
  const larg = 70, linhas = [];
  let atual = '';
  for (const nome of ms) {
    const add = atual ? `, ${nome}` : nome;
    if (atual && (atual + add).length > larg) { linhas.push(atual); atual = nome; }
    else atual += add;
  }
  if (atual) linhas.push(atual);
  console.log(cab + (linhas[0] || ''));
  for (const l of linhas.slice(1)) console.log(' '.repeat(cab.length) + l);
}
const soAudit = REG.filter(e=>e.estado==='MORTA'&&/^get/.test(e.metodo)).length;
console.log(`\n  destas, ${soAudit} sao metodos get* (diagnostico que ninguem chama)`);
console.log(`  sobram ${REG.filter(e=>e.estado==='MORTA'&&!/^get/.test(e.metodo)).length} sobrescritas de COMPORTAMENTO mortas`);

if (process.env.CDS_PILHA_JSON) require('fs').writeFileSync(process.env.CDS_PILHA_JSON, JSON.stringify(REG.map(e=>({bloco:e.bloco,metodo:e.metodo,estado:e.estado,chamadas:e.chamadas})),null,1));
