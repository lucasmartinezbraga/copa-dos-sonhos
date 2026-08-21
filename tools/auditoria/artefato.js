#!/usr/bin/env node
'use strict';
/* ARTEFATO — nivel N0: o HTML em si
   =========================================================================
   Antes de perguntar se o jogo joga certo, pergunte se o arquivo esta inteiro.
   Este nivel nao roda partida: le o bundle e confere o que so se ve olhando
   para o documento.

     · o cabecalho que o navegador exige (doctype, charset nos primeiros 1024
       bytes, viewport) — o proprio build ja quebrou por isso no mobile;
     · sintaxe de cada bloco, sem executar nada;
     · blocos que declaram no escopo global sem IIFE (colisao entre camadas);
     · identidade do build: quantas camadas escrevem CDS_BUILD_ID e qual vence;
     · referencias externas — um bundle que promete ser autocontido e pede
       fonte de CDN quebra offline;
     · ids repetidos no DOM, que fazem querySelector pegar o elemento errado.

   Uso:
     node tools/auditoria/artefato.js --build=dist/index.html
     node tools/auditoria/artefato.js --build=... --out=reports/auditoria/N0.json
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const N = require('./nucleo.js');

const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
const build = String(argv.build || 'dist/index.html');
const { sha, bytes, blocos, html } = N.blocosDoBundle(build);

const achados = [];
const add = (gravidade, id, titulo, detalhe) => achados.push({ gravidade, id, titulo, detalhe });

/* ---------------------------------------------------- cabecalho do documento */
const cabeca = html.slice(0, 1024);
if (!/^\s*<!DOCTYPE html>/i.test(html)) {
  add('S1', 'N0-doctype', 'Sem <!DOCTYPE html> no inicio',
    'sem doctype o navegador entra em quirks mode; o mobile perde a cadeia de alturas');
}
if (!/<meta[^>]+charset/i.test(cabeca)) {
  add('S1', 'N0-charset', 'charset fora dos primeiros 1024 bytes',
    'a especificacao exige a declaracao nesse trecho; fora dele o navegador adivinha');
}
if (!/<meta[^>]+name=["']viewport["']/i.test(html)) {
  add('S2', 'N0-viewport', 'Sem <meta name="viewport">', 'o mobile renderiza como desktop encolhido');
}
if (!/<html[^>]+lang=/i.test(html)) add('S3', 'N0-lang', 'Sem atributo lang no <html>', 'leitor de tela e hifenizacao');
if (!/<title>[^<]+<\/title>/i.test(html)) add('S3', 'N0-title', 'Sem <title>', '');

/* ------------------------------------------------------------------ sintaxe */
const comErro = [];
for (const b of blocos) {
  try { new vm.Script(b.corpo, { filename: b.id }); }
  catch (e) { comErro.push({ ordem: b.ordem, id: b.id, mensagem: String(e && e.message || e) }); }
}
if (comErro.length) {
  add('S1', 'N0-sintaxe', `${comErro.length} bloco(s) com erro de sintaxe`, comErro);
}

/* ------------------------------------------- escopo global sem IIFE */
const semIIFE = [];
for (const b of blocos) {
  const corpo = b.corpo.trim();
  if (!corpo) continue;
  const envolvido = /^\s*[;(]*\s*\(\s*function|^\s*\(\s*\(\s*\)\s*=>|^\s*!function|^\s*\+function/.test(corpo)
    || /^\s*\/\*[\s\S]*?\*\/\s*\(function/.test(corpo);
  if (envolvido) continue;
  /* o core E o escopo global do jogo por construcao: apontar isso todo dia
     seria ruido, e ruido mata auditoria */
  if (/class\s+MatchSim\s*\{/.test(corpo)) continue;
  const decls = (corpo.match(/^\s*(?:const|let|class)\s+([A-Za-z_$][\w$]*)/gm) || [])
    .map(x => x.trim().split(/\s+/)[1]);
  if (decls.length) semIIFE.push({ ordem: b.ordem, id: b.id, declaracoes: decls.length, exemplos: decls.slice(0, 8) });
}
if (semIIFE.length) {
  add('S3', 'N0-escopo', `${semIIFE.length} bloco(s) declaram no escopo global sem IIFE`,
    semIIFE);
}

/* ------------------------------------------------------ identidade do build */
const ids = [];
const reId = /CDS_BUILD_ID\s*=\s*['"]([^'"]+)['"]/g;
let m; while ((m = reId.exec(html))) ids.push(m[1]);
const titulos = [];
const reT = /document\.title\s*=\s*['"]([^'"]+)['"]/g;
while ((m = reT.exec(html))) titulos.push(m[1]);
if (new Set(ids).size > 1) {
  add('S3', 'N0-identidade', `${ids.length} escritas de CDS_BUILD_ID com ${new Set(ids).size} valores diferentes`,
    { valores: Array.from(new Set(ids)), venceOUltimo: ids[ids.length - 1], titulos: Array.from(new Set(titulos)) });
}

/* -------------------------------------------------------- referencias externas */
const externos = [];
const reExt = /(?:src|href)\s*=\s*["'](https?:\/\/[^"']+)["']/gi;
while ((m = reExt.exec(html))) externos.push(m[1]);
const externosJs = [];
const reExtJs = /['"`](https?:\/\/[^'"`\s]+)['"`]/g;
while ((m = reExtJs.exec(html))) externosJs.push(m[1]);
const todosExternos = Array.from(new Set(externos.concat(externosJs)))
  .filter(u => !/^https?:\/\/(www\.)?(w3\.org|schema\.org)/.test(u));
if (todosExternos.length) {
  add('S2', 'N0-externo', `${todosExternos.length} host(s) externos referenciados`,
    todosExternos.slice(0, 10));
}

/* --------------------------------------------------------------- ids repetidos
   So o MARCACAO de verdade conta. Procurar `id="x"` no arquivo inteiro acha
   tambem os ids dentro de template string de JS — que sao markup futuro, nao
   markup duplicado. Foi o primeiro alarme falso desta ferramenta. */
const markup = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
const idsDom = {};
const reDom = /\sid\s*=\s*["']([^"']+)["']/g;
while ((m = reDom.exec(markup))) idsDom[m[1]] = (idsDom[m[1]] || 0) + 1;
const repetidos = Object.keys(idsDom).filter(k => idsDom[k] > 1);
if (repetidos.length) {
  add('S2', 'N0-id-repetido', `${repetidos.length} id(s) repetidos no documento`,
    repetidos.slice(0, 12).map(k => `${k} x${idsDom[k]}`));
}

/* ------------------------------------------------------------------- perigos */
if (/document\.write\s*\(/.test(html)) add('S3', 'N0-document-write', 'usa document.write', '');
const inline = (markup.match(/\son[a-z]+\s*=\s*["']/gi) || []).length;
if (inline > 0) add('S4', 'N0-handler-inline', `${inline} handler(es) inline no HTML`, '');

/* ------------------------------------------------------------------- saida */
const estilos = (html.match(/<style/gi) || []).length;
const ordem = { S1: 0, S2: 1, S3: 2, S4: 3 };
achados.sort((a, b) => ordem[a.gravidade] - ordem[b.gravidade]);

const saida = {
  ferramenta: 'tools/auditoria/artefato.js',
  geradoEm: new Date().toISOString(),
  build: path.basename(build), sha256: sha, bytes,
  blocos: blocos.length, estilos,
  maiores: blocos.slice().sort((a, b) => b.bytes - a.bytes).slice(0, 5)
    .map(b => ({ id: b.id, ordem: b.ordem, kb: +(b.bytes / 1024).toFixed(1) })),
  achados,
  resumo: achados.reduce((a, x) => { a[x.gravidade] = (a[x.gravidade] || 0) + 1; return a; }, {}),
};

if (argv.out) {
  fs.mkdirSync(path.dirname(argv.out), { recursive: true });
  fs.writeFileSync(argv.out, JSON.stringify(saida, null, 2));
}
console.log('');
console.log('=== ARTEFATO (N0) ===');
console.log(`${saida.build}  ${(bytes / 1048576).toFixed(2)} MB  ${blocos.length} scripts  ${estilos} styles  sha ${sha.slice(0, 12)}`);
console.log('');
if (!achados.length) console.log('  nenhum achado');
for (const a of achados) {
  console.log(`  ${a.gravidade}  ${a.id.padEnd(18)} ${a.titulo}`);
  if (a.detalhe && typeof a.detalhe === 'string' && a.detalhe) console.log(`        ${a.detalhe}`);
  if (Array.isArray(a.detalhe)) for (const d of a.detalhe.slice(0, 6)) {
    console.log(`        ${typeof d === 'string' ? d : JSON.stringify(d)}`);
  }
  if (a.detalhe && !Array.isArray(a.detalhe) && typeof a.detalhe === 'object') {
    console.log(`        ${JSON.stringify(a.detalhe)}`);
  }
}
console.log('');
console.log('maiores blocos: ' + saida.maiores.map(b => `${b.id} ${b.kb}KB`).join(', '));
if (argv.out) console.log(`\njson -> ${argv.out}`);
