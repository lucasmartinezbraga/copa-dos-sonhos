#!/usr/bin/env node
'use strict';
/* NUCLEO DA AUDITORIA — carga do bundle fora do navegador
   -------------------------------------------------------------------------
   Mesma tecnica da bateria de fisica (vm.runInThisContext bloco a bloco), com
   tres acrescimos que a auditoria exige e a bateria nao precisava:

     1. CARGA PARCIAL (`ate`): carrega so os N primeiros blocos. E o que
        permite a bisseccao — achar QUAL camada introduziu uma violacao,
        em vez de so saber que ela existe.
     2. INVENTARIO DE BLOCOS: id, ordem, tamanho e excecao de carga de cada um.
        Bloco que estoura na carga e, por si so, um defeito de nivel N0.
     3. POPULACAO VARIADA: a bateria usa Brasil 1970 dos dois lados porque
        mede paridade. Auditoria quer SUPERFICIE: elencos diferentes, todas as
        formacoes, todos os estilos. Bug mora na borda, nao na media.

   Este arquivo nao decide nada sobre bugs; so entrega o jogo carregado.
*/

const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');

function noop() {}

function define(n, v) {
  try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); }
  catch (_) { global[n] = v; }
}

/* Ambiente minimo de navegador. Identico ao da bateria de fisica, de proposito:
   se a auditoria montasse um ambiente diferente, os numeros dela nao seriam
   comparaveis com os das medicoes historicas. */
function instalarAmbiente() {
  define('window', global); define('self', global);
  define('navigator', { userAgent: 'cds-auditoria', language: 'pt-BR' });
  define('location', { href: 'runner://auditoria', search: '', hash: '' });
  define('performance', { now: () => Date.now() }); define('crypto', crypto.webcrypto);
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

/* Blocos que dependem de DOM real ou abrem timers da Copa. Mesma lista da
   bateria: fora do navegador eles nao rodam, e o que eles cobrem e auditado
   pela sonda de tela (tools/auditoria/tela.js), que usa Chromium de verdade. */
const SKIP_PADRAO = ['cds-2_5d-gate-a-contracts-v02', 'cds-pre25d-runtime-auditor-v04',
  'cds-r109-async-cup', 'cds-mobile-boot-bridge', 'cds-ux-boot'];

const EXIGIDOS = ['MatchSim', 'autoLineup', 'buildDB', 'DATA', 'FORMATIONS', 'srand', 'R',
  'chance', 'facet', 'clamp', 'D', 'FL', 'FW'];

/* Lista os blocos <script> do bundle sem executar nada. Serve tambem para a
   analise estatica de camadas (mapa_de_camadas.js). */
function blocosDoBundle(caminho) {
  const html = fs.readFileSync(caminho, 'utf8');
  const sha = crypto.createHash('sha256').update(html).digest('hex');
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  const blocos = [];
  let mt, i = 0;
  while ((mt = re.exec(html))) {
    const id = (mt[1].match(/id="([^"]+)"/) || [])[1] || `script-${i}`;
    blocos.push({ ordem: i, id, corpo: mt[2], bytes: mt[2].length });
    i++;
  }
  return { sha, bytes: html.length, blocos, html };
}

/* Carrega o bundle no contexto atual.
     ate    — indice do ultimo bloco a carregar (inclusive). Infinity = tudo.
     pular  — ids a nao executar (padrao: os que exigem DOM). */
function carregar(caminho, opts) {
  opts = opts || {};
  const ate = Number.isFinite(opts.ate) ? opts.ate : Infinity;
  const pular = new Set(opts.pular || SKIP_PADRAO);
  const { sha, blocos } = blocosDoBundle(caminho);
  const carregados = [];
  const excecoes = [];
  for (const b of blocos) {
    if (b.ordem > ate) break;
    if (pular.has(b.id)) { carregados.push({ ordem: b.ordem, id: b.id, estado: 'pulado' }); continue; }
    try {
      vm.runInThisContext(b.corpo, { filename: `${b.id}.js` });
      carregados.push({ ordem: b.ordem, id: b.id, estado: 'ok', bytes: b.bytes });
    } catch (e) {
      excecoes.push({ ordem: b.ordem, id: b.id, mensagem: String((e && e.message) || e) });
      carregados.push({ ordem: b.ordem, id: b.id, estado: 'erro' });
    }
  }
  const faltando = EXIGIDOS.filter(n => typeof global[n] === 'undefined');
  return { sha, blocos: carregados, totalBlocos: blocos.length, excecoes, faltando };
}

/* --------------------------------------------------------------- populacao */
/* `paridade` reproduz a bateria (mesmo elenco dos dois lados, para medir vies).
   `variado` percorre o banco inteiro: e o modo da auditoria, porque elenco
   estranho — goleiro improvisado, time sem ponta, atributos no extremo — e
   onde o motor quebra. */
function montarPopulacao(modo) {
  const db = buildDB(DATA);
  const FORMS = Object.keys(FORMATIONS);
  const STYLES = (typeof STYLE_KEYS !== 'undefined' && Array.isArray(STYLE_KEYS))
    ? STYLE_KEYS.slice() : ['balanced', 'tiki', 'direct', 'press', 'counter', 'wings', 'park'];
  const paridade = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];

  const escolher = (i) => (modo === 'paridade' ? paridade : db.squads[i % db.squads.length]);
  const mk = (squad, f, st, casa) => {
    const p = autoLineup(squad, f, 0);
    return { squad, name: squad.c, flag: squad.f, color: casa ? '#2e9bff' : '#ff3d7f',
      lineup: p.lineup, bench: p.bench, formKey: f, style: st };
  };
  return { db, FORMS, STYLES, escolher, mk, elencos: db.squads.length };
}

/* Uma partida da amostra. O indice `i` determina TUDO — semente, formacoes,
   estilos e elencos — para que "partida 37" signifique a mesma partida em
   qualquer maquina e em qualquer execucao. */
const SEMENTE_BASE = 4200000;
const INCREMENTO = 7919;

function montarPartida(pop, i, opts) {
  opts = opts || {};
  const semente = (opts.semente || SEMENTE_BASE) + i * INCREMENTO;
  const fc = pop.FORMS[i % pop.FORMS.length];
  const fv = pop.FORMS[(i * 3 + 1) % pop.FORMS.length];
  const ec = pop.STYLES[i % pop.STYLES.length];
  const ev = pop.STYLES[(i * 5 + 2) % pop.STYLES.length];
  const sc = pop.escolher(i * 2);
  const sv = pop.escolher(i * 2 + 1);
  srand(semente);
  const sim = new MatchSim(pop.mk(sc, fc, ec, true), pop.mk(sv, fv, ev, false),
    { neutral: true, labMode: true, knockout: (i % 4 === 3) });
  sim.teams[0].formKey = fc; sim.teams[1].formKey = fv;
  return { sim, meta: { i, semente, formacoes: [fc, fv], estilos: [ec, ev],
    elencos: [sc.c + ' ' + sc.y, sv.c + ' ' + sv.y], mataMata: (i % 4 === 3) } };
}

module.exports = { instalarAmbiente, carregar, blocosDoBundle, montarPopulacao,
  montarPartida, SKIP_PADRAO, EXIGIDOS, SEMENTE_BASE, INCREMENTO, define, noop };
