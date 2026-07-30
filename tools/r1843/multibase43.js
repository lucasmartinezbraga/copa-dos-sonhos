#!/usr/bin/env node
'use strict';
/* DECISAO POR MULTIPLAS BASES — R18.43 (OS-07)
   -------------------------------------------------------------------------
   Mesma logica de tools/r1840/multibase.js, com duas diferencas:
     - a baseline aqui e a R18.40A promovida (nao a R18.35);
     - avalia tambem os gates de ESPACO (ESP-01..04), que vem de
       tools/r1843/diag_espaco.js em vez da bateria.

   A pergunta continua sendo a mesma, e na mesma ordem:
     1. o gate e CUMPRIDO PELA BASELINE em cada base? Se nao, ele nao
        discrimina candidata naquela base e nao pode bloquear promocao —
        e a regra que a R18.40A aprendeu errando com ECO-03.
     2. o efeito da candidata e CONSISTENTE em direcao nas tres bases?
     3. a magnitude passa da banda de ruido?

   Uso: node tools/r1843/multibase43.js
*/
const fs = require('fs'), path = require('path');
const RAIZ = path.resolve(__dirname, '..', '..');
const R = p => JSON.parse(fs.readFileSync(path.join(RAIZ, p), 'utf8'));
const num = v => (typeof v === 'number' && isFinite(v)) ? v : null;

/* Gates de ecologia: metrica da bateria, faixa e banda de ruido da matriz. */
const GATES_ECO = [
  { id: 'ECO-01', m: 'goals',    rot: 'gols',    min: 2.4, max: 3.2, ruido: 30 },
  { id: 'ECO-02', m: 'xg',       rot: 'xG',      min: 1.8, max: 2.7, ruido: 7 },
  { id: 'ECO-03', m: 'shots',    rot: 'chutes',  min: 12,  max: 20,  ruido: 7 },
  { id: 'ECO-04', m: 'onTarget', rot: 'no alvo', min: 4,   max: 7,   ruido: 7 },
];
/* Gates de espaco. ESP-01 usa a serie vazio_r8, que e a reconstrucao mais
   proxima do baseline 67,5% da matriz (medido 68,60% na R18.40A). A definicao
   original ("auditoria_blob") nao existe no repositorio — ver o cabecalho de
   diag_espaco.js. */
const GATES_ESP = [
  { id: 'ESP-01', m: 'vazio_r8',      rot: 'campo vazio %',  min: null, max: 50, ruido: 10 },
  { id: 'ESP-02', m: 'bloco_m',       rot: 'bloco m',        min: 35,   max: null, ruido: 10 },
  { id: 'ESP-03', m: 'zaga_ataque_m', rot: 'zaga->ataque m', min: 30,   max: null, ruido: 10 },
  { id: 'ESP-04', m: 'perto20_pct',   rot: '<20 m da bola %',min: 35,   max: 45,  ruido: 10 },
];

const BASES = [
  { nome: 's1 4200000', eco: ['reports/r1843/bat_base_s1.json', 'reports/r1843/bat_rcc_s1.json'],
                        esp: ['reports/r1843/esp_base_s1.json', 'reports/r1843/esp_rcc_s1.json'] },
  { nome: 's2 8400000', eco: ['reports/r1843/bat_base_s2.json', 'reports/r1843/bat_rcc_s2.json'],
                        esp: ['reports/r1843/esp_base_s2.json', 'reports/r1843/esp_rcc_s2.json'] },
  { nome: 's3 1260000', eco: ['reports/r1843/bat_base_s3.json', 'reports/r1843/bat_rcc_s3.json'],
                        esp: ['reports/r1843/esp_base_s3.json', 'reports/r1843/esp_rcc_s3.json'] },
];

const dados = [];
for (const b of BASES) {
  const linha = { base: b.nome };
  try { linha.ecoBase = R(b.eco[0]).agregado; linha.ecoCand = R(b.eco[1]).agregado; } catch (_) { linha.ecoBase = null; }
  try { linha.espBase = R(b.esp[0]).agregado; linha.espCand = R(b.esp[1]).agregado; } catch (_) { linha.espBase = null; }
  dados.push(linha);
}

const cumpre = (g, v) => v === null ? false
  : (g.min === null || v >= g.min) && (g.max === null || v <= g.max);
const mediana = a => { const v = a.filter(x => x !== null).slice().sort((x, y) => x - y);
  return v.length ? (v.length % 2 ? v[(v.length-1)/2] : (v[v.length/2-1]+v[v.length/2])/2) : null; };
const f = v => v === null ? '   --  ' : v.toFixed(3).padStart(7);

function bloco(titulo, gates, kBase, kCand) {
  console.log('');
  console.log('='.repeat(78));
  console.log(titulo);
  console.log('='.repeat(78));

  console.log('');
  console.log('1. O GATE E CUMPRIDO PELA BASELINE (R18.40A) EM CADA BASE?');
  console.log('   Um gate que a propria baseline reprova nao separa candidata boa de ruim,');
  console.log('   e por regra da rodada R18.40 nao bloqueia promocao.');
  console.log('');
  console.log('gate     metrica              ' + dados.map(d => d.base.padEnd(13)).join('') + ' valido');
  const validade = {};
  for (const g of gates) {
    const vals = dados.map(d => d[kBase] ? num(d[kBase][g.m] && d[kBase][g.m].media) : null);
    const oks = vals.map(v => cumpre(g, v));
    const nOk = oks.filter(Boolean).length;
    validade[g.id] = { nOk, medianaBase: mediana(vals) };
    console.log(g.id.padEnd(9) + g.rot.padEnd(21) +
      vals.map((v, i) => (f(v) + (oks[i] ? ' ok  ' : ' REP ')).padEnd(13)).join('') +
      ' ' + nOk + '/3' + (nOk === 3 ? '' : nOk === 0 ? '  <- INUTIL' : '  <- FRAGIL'));
  }

  console.log('');
  console.log('2. EFEITO DA CANDIDATA (RC-C), POR BASE');
  console.log('');
  console.log('gate     metrica              ' + dados.map(d => d.base.padEnd(17)).join('') + 'mediana  faixa');
  const veredito = [];
  for (const g of gates) {
    const bs = dados.map(d => d[kBase] ? num(d[kBase][g.m] && d[kBase][g.m].media) : null);
    const cs = dados.map(d => d[kCand] ? num(d[kCand][g.m] && d[kCand][g.m].media) : null);
    const cel = cs.map((c, i) => {
      if (c === null || bs[i] === null) return '     --          ';
      const d = bs[i] ? (c - bs[i]) / Math.abs(bs[i]) * 100 : 0;
      const sig = Math.abs(d) > g.ruido ? '*' : ' ';
      return (c.toFixed(3) + ' (' + (d >= 0 ? '+' : '') + d.toFixed(1) + '%' + sig + ')').padEnd(17);
    });
    const mc = mediana(cs), mb = mediana(bs);
    const okMed = cumpre(g, mc);
    const faixa = (g.min !== null ? '>=' + g.min : '') + (g.min !== null && g.max !== null ? ' e ' : '') + (g.max !== null ? '<=' + g.max : '');
    console.log(g.id.padEnd(9) + g.rot.padEnd(21) + cel.join('') + f(mc) + '  ' + faixa.padEnd(14) + (okMed ? 'CUMPRE' : 'REPROVA'));
    // direcao consistente?
    const dirs = cs.map((c, i) => (c === null || bs[i] === null) ? 0 : Math.sign(c - bs[i])).filter(x => x !== 0);
    const consistente = dirs.length >= 2 && dirs.every(x => x === dirs[0]);
    veredito.push({ id: g.id, rot: g.rot, medianaCand: mc, medianaBase: mb, okMed,
      validoBase: validade[g.id].nOk, consistente, dir: dirs[0] || 0 });
  }
  console.log('   (* = magnitude acima da banda de ruido do gate)');
  return veredito;
}

const vEco = bloco('ECOLOGIA — bateria n=48 por base', GATES_ECO, 'ecoBase', 'ecoCand');
const vEsp = bloco('ESPACO — diag_espaco n=12 por base', GATES_ESP, 'espBase', 'espCand');

console.log('');
console.log('='.repeat(78));
console.log('3. VEREDITO');
console.log('='.repeat(78));
console.log('');
const todos = vEco.concat(vEsp);
const perdidos = todos.filter(v => v.validoBase === 3 && !v.okMed);
const ganhos   = todos.filter(v => v.validoBase < 3 && v.okMed);
const inuteis  = todos.filter(v => v.validoBase === 0);

console.log('Gates VALIDOS (baseline cumpre 3/3) que a candidata PERDE:');
if (!perdidos.length) console.log('   nenhum');
else for (const v of perdidos) console.log('   ' + v.id + ' ' + v.rot + ' -> mediana ' + f(v.medianaCand) + ' (era ' + f(v.medianaBase) + ')');
console.log('');
console.log('Gates que a baseline NAO cumpria e a candidata passa a cumprir:');
if (!ganhos.length) console.log('   nenhum');
else for (const v of ganhos) console.log('   ' + v.id + ' ' + v.rot + ' -> mediana ' + f(v.medianaCand) + ' (era ' + f(v.medianaBase) + ')');
console.log('');
console.log('Gates INUTEIS nesta rodada (baseline reprova em 3/3, nao bloqueiam):');
if (!inuteis.length) console.log('   nenhum');
else for (const v of inuteis) console.log('   ' + v.id + ' ' + v.rot + ' -> baseline ' + f(v.medianaBase) + ', candidata ' + f(v.medianaCand) + (v.okMed ? ' CUMPRE' : ' reprova'));
console.log('');
console.log('Consistencia de direcao nas 3 bases:');
for (const v of todos) console.log('   ' + v.id.padEnd(8) + (v.consistente ? 'consistente ' + (v.dir > 0 ? 'subiu' : 'caiu') : 'INCONSISTENTE entre bases'));
console.log('');
console.log(perdidos.length
  ? 'RECOMENDACAO: NAO PROMOVER — perde ' + perdidos.length + ' gate(s) valido(s).'
  : 'RECOMENDACAO: PROMOVER — nenhum gate valido perdido.');
