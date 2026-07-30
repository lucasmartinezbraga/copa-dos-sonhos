#!/usr/bin/env node
'use strict';
/* BATERIA DE VALIDACAO R18.40 — mesma medicao, carga VERIFICADA
   -------------------------------------------------------------------------
   Copia fiel de tools/r1821/bateria.js em tudo que afeta numero: mesma
   semente base (4200000), mesmo incremento (7919), mesma varredura de
   formacoes e estilos, mesmo dt, mesmas chaves. O que muda e SO a honestidade
   da carga.

   O QUE ESTAVA ERRADO. Todos os harnesses desta linhagem terminavam assim:

     catch (e) { if (/^script-\d+$/.test(id) && /document is not defined/
                     .test(...)) { scriptsOk++; continue; } scriptsErro++; }

   O bloco que falhava era CONTADO COMO OK. Por isso `scriptsComErro: 0`
   aparece em todos os relatorios promovidos (R18.25, R18.31, R18.35) enquanto
   o bundle principal de fato lancava e parava no meio.

   ONDE ELE PARA, medido por tools/r1840/diag_harness.js: script-2, linha 7599
   de 12198 (62,3% do bloco), em `document.addEventListener('click', ...)` —
   fiacao de interface, logo depois de `window.UI = {...}`.

   POR QUE A MEDICAO DO SIMULADOR CONTINUA VALIDA. Nada depois da linha 7599
   toca o motor: zero atribuicoes a MatchSim.prototype, zero mutacoes de CAL,
   zero reatribuicoes de autoLineup. As 11 exportacoes seguintes sao interface,
   boot, save e ponte de timeline. O que o laboratorio perde e a camada de UI e
   a da Copa — exatamente o que a Ordem de Servico ja declarava como nao medido.

   POR QUE NAO CARREGAR A UI AQUI. Um `document` completo faria o bundle inteiro
   rodar, mas mudaria o que esta carregado em relacao a TODAS as baterias
   promovidas anteriores, e a comparacao pareada perderia sentido. A Copa e a UI
   se medem no navegador, que e onde elas existem.

   O QUE ESTE ARQUIVO PASSA A FAZER:
     - registra bloco, linha e mensagem de cada excecao, sem engolir;
     - exige um manifesto de simbolos do motor e ABORTA se faltar algum;
     - reporta scriptsComErro de verdade, e um campo motorVerificado.
   Assim uma carga quebrada no futuro reprova em vez de virar numero bonito. */

const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
function noop() {}
function define(n, v) { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } }
define('window', global); define('self', global);
define('navigator', { userAgent: 'cds-bateria', language: 'pt-BR' });
define('location', { href: 'runner://bateria', search: '', hash: '' });
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
let mt, idx = 0, scriptsOk = 0, scriptsErro = 0;
const excecoes = [];
while ((mt = re.exec(html))) {
  const id = (mt[1].match(/id="([^"]+)"/) || [])[1] || `script-${idx}`; idx++;
  if (SKIP.has(id)) continue;
  try { vm.runInThisContext(mt[2], { filename: `${id}.js` }); scriptsOk++; }
  catch (e) {
    /* Nada e engolido. O bloco conta como ERRO e a excecao fica registrada com
       linha, para o relatorio poder ser auditado depois. */
    scriptsErro++;
    const pilha = String(e && e.stack || e);
    /* Sem regex dinamica: a marca e literal e o que vem depois dela e a linha. */
    const marca = id + '.js:';
    const pos = pilha.indexOf(marca);
    const linha = pos >= 0 ? parseInt(pilha.slice(pos + marca.length), 10) : NaN;
    excecoes.push({ bloco: id, linha: Number.isFinite(linha) ? linha : null,
      totalDeLinhas: mt[2].split(String.fromCharCode(10)).length,
      mensagem: String(e && e.message || e) });
  }
}

/* Manifesto: sem estes simbolos nao existe medicao de simulador. Se faltar um,
   a bateria aborta em vez de produzir agregados de um motor incompleto. */
const EXIGIDOS = ['MatchSim','autoLineup','buildDB','DATA','FORMATIONS','srand','R','chance','facet','clamp','D','FL','FW'];
const faltando = EXIGIDOS.filter(n => typeof global[n] === 'undefined');
if (faltando.length) {
  realConsole.error('ABORTA: simbolos do motor ausentes -> ' + faltando.join(', '));
  realConsole.error('excecoes: ' + JSON.stringify(excecoes));
  process.exit(2);
}

const db = buildDB(DATA);
const N = Number(argv.matches || 100);
const SEMENTE = Number(argv.semente || 4200000);
const DT = 1 / 30;

/* População variada: percorre estilos e formações de forma determinística,
   para a bateria não medir um único cenário. */
const FORMS = Object.keys(FORMATIONS);
const STYLES = (typeof STYLE_KEYS !== 'undefined' && Array.isArray(STYLE_KEYS))
  ? STYLE_KEYS.slice() : ['balanced','tiki','direct','press','counter','wings','park'];
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (f, st, home) => { const p = autoLineup(squad, f, 0); return { squad, name: squad.c, flag: squad.f, color: home ? '#2e9bff' : '#ff3d7f', lineup: p.lineup, bench: p.bench, formKey: f, style: st }; };

const CHAVES = ['shots','onTarget','goals','xg','corners','fouls','yellow','red','passes','passOk','tackles','offsides','throwIns','goalKicks'];
const partidas = [];

for (let i = 0; i < N; i++) {
  const seed = SEMENTE + i * 7919;
  const fh = FORMS[i % FORMS.length], fa = FORMS[(i * 3 + 1) % FORMS.length];
  const sh = STYLES[i % STYLES.length], sa = STYLES[(i * 5 + 2) % STYLES.length];
  srand(seed);
  const sim = new MatchSim(mk(fh, sh, true), mk(fa, sa, false), { neutral: true, labMode: true });
  sim.teams[0].formKey = fh; sim.teams[1].formKey = fa;
  const ev = Object.create(null);
  const oEmit = sim._emit;
  sim._emit = function (t) { ev[t] = (ev[t] || 0) + 1; return oEmit.apply(this, arguments); };
  let s = 0; while (!sim.isOver() && s++ < 500000) sim.step(DT);

  const linha = { seed, formacoes: [fh, fa], estilos: [sh, sa], placar: sim.score.slice() };
  for (const k of CHAVES) linha[k] = (+sim.stats[0][k] || 0) + (+sim.stats[1][k] || 0);
  linha.eventos = ev;
  partidas.push(linha);
}

function resumo(vals) {
  const v = vals.slice().sort((a, b) => a - b);
  const n = v.length, media = v.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - media) ** 2, 0) / n);
  const q = p => v[Math.min(n - 1, Math.floor(n * p))];
  return { media: +media.toFixed(3), mediana: q(.5), desvio: +sd.toFixed(3),
           p10: q(.10), p90: q(.90), min: v[0], max: v[n - 1] };
}

const agregado = {};
for (const k of CHAVES) agregado[k] = resumo(partidas.map(p => p[k]));
const eventosTotais = {};
for (const p of partidas) for (const k of Object.keys(p.eventos)) eventosTotais[k] = (eventosTotais[k] || 0) + p.eventos[k];
const eventosPorPartida = {};
for (const k of Object.keys(eventosTotais).sort()) eventosPorPartida[k] = +(eventosTotais[k] / N).toFixed(3);

const out = {
  build: String(argv.build).split(/[\\/]/).pop(), sha256: sha,
  scriptsCarregados: scriptsOk, scriptsComErro: scriptsErro,
  motorVerificado: true, simbolosExigidos: EXIGIDOS.length, excecoes,
  partidas: N, sementeBase: SEMENTE, incremento: 7919,
  formacoes: FORMS.length, estilos: STYLES.length,
  agregado, eventosPorPartida,
  porPartida: argv.detalhe ? partidas : undefined,
};
realConsole.log(JSON.stringify({ build: out.build, sha: sha.slice(0, 12), partidas: N,
  scripts: `${scriptsOk} ok / ${scriptsErro} erro`, motorVerificado: true,
  resumo: Object.fromEntries(CHAVES.map(k => [k, agregado[k].media])) }, null, 2));
if (argv.out) fs.writeFileSync(argv.out, JSON.stringify(out, null, 2));
