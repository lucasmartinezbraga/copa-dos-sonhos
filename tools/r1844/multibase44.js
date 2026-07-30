#!/usr/bin/env node
'use strict';
/* DECISAO POR MULTIPLAS BASES — R18.44 (raio do goleiro, isolado)
   =========================================================================
   Baseline desta rodada: R18.43 (estrutura de bloco).
   Candidata: R18.43 + tools/r1840/patch_gkraio.js (raio 1.95 nos tres sitios
   de chute), que nunca foi medido SOZINHO — a R18.40B o mediu junto com a
   escalacao e o par reprovou por gols/xG inflados pela escalacao.

   Alem dos gates de ecologia da matriz, avalia DOIS gates novos que o
   diagnostico de tools/r1843/diag_xg.js justifica:

   COE-01  gols/xG em [0,90; 1,15]
           O modelo de xG do jogo deve prever os proprios gols do jogo. Hoje
           nao existe gate que force essa coerencia, e e por isso que um
           caminho de gol sem xG (a falha de contato do goleiro) pode existir
           por rodadas sem nenhum gate reprovar. Faixa derivada de futebol
           real, onde xG e calibrado contra gols e a razao fica ~1,0.

   CAU-03  % dos gols por falha de contato do goleiro < 8%
           E o alvo que a propria matriz ja registra para CAU-03. A R18.40A
           ficou PARCIAL em 17,75%. Meu instrumento mede 16,98% na R18.43 por
           um caminho independente (evento visual_contact_failed{kind:save}).

   A ordem das perguntas e a mesma da R18.40: primeiro se a BASELINE cumpre o
   gate em cada base, porque um gate que a propria base reprova nao separa
   candidata boa de ruim.

   Uso: node tools/r1844/multibase44.js
*/
const fs = require('fs'), path = require('path');
const RAIZ = path.resolve(__dirname, '..', '..');
const R = p => JSON.parse(fs.readFileSync(path.join(RAIZ, p), 'utf8'));
const num = v => (typeof v === 'number' && isFinite(v)) ? v : null;
const BASES = ['s1 4200000', 's2 8400000', 's3 1260000'];

/* Gates de ecologia: vem da bateria (agregado.<m>.media).
   Para a BASELINE R18.43 reaproveito as baterias ja medidas na rodada
   anterior (reports/r1843/bat_rcc_s*.json e o mesmo arquivo, mesma build). */
const GATES_ECO = [
  { id: 'ECO-01', m: 'goals',    rot: 'gols',    min: 2.4, max: 3.2, ruido: 30 },
  { id: 'ECO-02', m: 'xg',       rot: 'xG',      min: 1.8, max: 2.7, ruido: 7 },
  { id: 'ECO-03', m: 'shots',    rot: 'chutes',  min: 12,  max: 20,  ruido: 7 },
  { id: 'ECO-04', m: 'onTarget', rot: 'no alvo', min: 4,   max: 7,   ruido: 7 },
];
/* Gates de coerencia: vem do diag_xg (totais.<m>). */
const GATES_COE = [
  { id: 'COE-01', m: 'gols_por_xg', rot: 'gols/xG', min: 0.90, max: 1.15, ruido: 10 },
  { id: 'CAU-03', m: 'pct_dos_gols_por_falha_do_goleiro', rot: '% gols falha GK', min: null, max: 8, ruido: 20 },
];

function carrega(pref, s) {
  try { return R(`reports/r1844/${pref}_s${s}.json`); } catch (_) { return null; }
}
/* A bateria da baseline R18.43 foi medida na rodada anterior; reaproveito em
   vez de re-rodar, porque e a MESMA build (SHA 0062c2eaad18). */
function bateriaBase(s) {
  try { return R(`reports/r1843/bat_rcc_s${s}.json`); } catch (_) { return null; }
}

const dados = [1, 2, 3].map(s => ({
  base: BASES[s - 1],
  ecoBase: (bateriaBase(s) || {}).agregado || null,
  ecoCand: (carrega('bat_gk', s) || {}).agregado || null,
  coeBase: (carrega('xg_b43', s) || {}).totais || null,
  coeCand: (carrega('xg_gk', s) || {}).totais || null,
}));

const cumpre = (g, v) => v === null ? false
  : (g.min === null || v >= g.min) && (g.max === null || v <= g.max);
const mediana = a => { const v = a.filter(x => x !== null).slice().sort((x, y) => x - y);
  return v.length ? (v.length % 2 ? v[(v.length-1)/2] : (v[v.length/2-1]+v[v.length/2])/2) : null; };
const f = v => v === null ? '   --  ' : v.toFixed(3).padStart(7);

function bloco(titulo, gates, kBase, kCand, leitor) {
  console.log('');
  console.log('='.repeat(80));
  console.log(titulo);
  console.log('='.repeat(80));
  console.log('');
  console.log('1. A BASELINE R18.43 CUMPRE O GATE EM CADA BASE?');
  console.log('');
  console.log('gate     metrica              ' + dados.map(d => d.base.padEnd(13)).join('') + ' valido');
  const validade = {};
  for (const g of gates) {
    const vals = dados.map(d => d[kBase] ? num(leitor(d[kBase], g.m)) : null);
    const oks = vals.map(v => cumpre(g, v));
    const nOk = oks.filter(Boolean).length;
    validade[g.id] = { nOk, med: mediana(vals) };
    console.log(g.id.padEnd(9) + g.rot.padEnd(21) +
      vals.map((v, i) => (f(v) + (oks[i] ? ' ok  ' : ' REP ')).padEnd(13)).join('') +
      ' ' + nOk + '/3' + (nOk === 3 ? '' : nOk === 0 ? '  <- INUTIL' : '  <- FRAGIL'));
  }
  console.log('');
  console.log('2. EFEITO DA CANDIDATA (R18.43 + raio 1,95)');
  console.log('');
  console.log('gate     metrica              ' + dados.map(d => d.base.padEnd(17)).join('') + 'mediana  faixa');
  const out = [];
  for (const g of gates) {
    const bs = dados.map(d => d[kBase] ? num(leitor(d[kBase], g.m)) : null);
    const cs = dados.map(d => d[kCand] ? num(leitor(d[kCand], g.m)) : null);
    const cel = cs.map((c, i) => {
      if (c === null || bs[i] === null) return '     --          ';
      const dd = bs[i] ? (c - bs[i]) / Math.abs(bs[i]) * 100 : 0;
      return (c.toFixed(3) + ' (' + (dd >= 0 ? '+' : '') + dd.toFixed(1) + '%' + (Math.abs(dd) > g.ruido ? '*' : ' ') + ')').padEnd(17);
    });
    const mc = mediana(cs), mb = mediana(bs), ok = cumpre(g, mc);
    const faixa = (g.min !== null ? '>=' + g.min : '') + (g.min !== null && g.max !== null ? ' e ' : '') + (g.max !== null ? '<=' + g.max : '');
    console.log(g.id.padEnd(9) + g.rot.padEnd(21) + cel.join('') + f(mc) + '  ' + faixa.padEnd(15) + (ok ? 'CUMPRE' : 'REPROVA'));
    const dirs = cs.map((c, i) => (c === null || bs[i] === null) ? 0 : Math.sign(c - bs[i])).filter(x => x !== 0);
    out.push({ id: g.id, rot: g.rot, mc, mb, ok, validoBase: validade[g.id].nOk,
      consistente: dirs.length >= 2 && dirs.every(x => x === dirs[0]), dir: dirs[0] || 0 });
  }
  console.log('   (* = magnitude acima da banda de ruido do gate)');
  return out;
}

const vEco = bloco('ECOLOGIA — bateria n=48 por base', GATES_ECO, 'ecoBase', 'ecoCand', (o, m) => o[m] && o[m].media);
const vCoe = bloco('COERENCIA DO MODELO — diag_xg n=48 por base', GATES_COE, 'coeBase', 'coeCand', (o, m) => o[m]);

console.log('');
console.log('='.repeat(80));
console.log('3. VEREDITO');
console.log('='.repeat(80));
console.log('');
const todos = vEco.concat(vCoe);
const perdidos = todos.filter(v => v.validoBase === 3 && !v.ok);
const ganhos = todos.filter(v => v.validoBase < 3 && v.ok);
const inuteis = todos.filter(v => v.validoBase === 0);

console.log('Gates VALIDOS (baseline cumpre 3/3) que a candidata PERDE:');
perdidos.length ? perdidos.forEach(v => console.log('   ' + v.id + ' ' + v.rot + ' -> ' + f(v.mc) + ' (era ' + f(v.mb) + ')')) : console.log('   nenhum');
console.log('');
console.log('Gates que a baseline NAO cumpria e a candidata passa a cumprir:');
ganhos.length ? ganhos.forEach(v => console.log('   ' + v.id + ' ' + v.rot + ' -> ' + f(v.mc) + ' (era ' + f(v.mb) + ')')) : console.log('   nenhum');
console.log('');
console.log('Gates que seguem reprovando na baseline E na candidata (defeito rastreado):');
const abertos = inuteis.filter(v => !v.ok);
abertos.length ? abertos.forEach(v => console.log('   ' + v.id + ' ' + v.rot + ' -> baseline ' + f(v.mb) + ', candidata ' + f(v.mc))) : console.log('   nenhum');
console.log('');
console.log('Consistencia de direcao nas 3 bases:');
todos.forEach(v => console.log('   ' + v.id.padEnd(8) + (v.consistente ? 'consistente ' + (v.dir > 0 ? 'subiu' : 'caiu') : 'INCONSISTENTE entre bases')));
console.log('');
console.log(perdidos.length
  ? 'RECOMENDACAO: NAO PROMOVER — perde ' + perdidos.length + ' gate(s) valido(s): ' + perdidos.map(v => v.id).join(', ')
  : 'RECOMENDACAO: PROMOVER — nenhum gate valido perdido, ' + ganhos.length + ' ganho(s).');
