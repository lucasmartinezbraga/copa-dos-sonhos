#!/usr/bin/env node
'use strict';
/* DECISAO POR MULTIPLAS BASES DE SEMENTE — o remedio para o erro da R18.40A
   -------------------------------------------------------------------------
   A R18.40A excluiu a OS-09 porque `chutes` ficou em 11,958 contra um piso de
   12. Depois se descobriu que a propria baseline R18.35 entrega 11,854 na base
   8400000: o piso nao e propriedade do jogo, e da base 4200000. A decisao foi
   tomada sobre ruido.

   Este avaliador nao pergunta "passou o gate nesta base". Pergunta:
     1. o gate e SATISFEITO PELA BASELINE em cada base? (se nao, o gate nao
        discrimina nada naquela base e e marcado como inutil ali);
     2. o efeito da candidata e CONSISTENTE em direcao nas bases?
     3. a magnitude passa da banda de ruido em alguma base?

   Uma candidata so e recomendada quando o efeito e consistente e nenhum gate
   VALIDO (isto é, cumprido pela baseline) e perdido. */

const fs = require('fs'), path = require('path');
const RAIZ = path.resolve(__dirname, '..', '..');
const R = p => JSON.parse(fs.readFileSync(path.join(RAIZ, p), 'utf8'));

const GATES = [
  { id: 'ECO-01', m: 'goals',    rot: 'gols',     min: 2.4, max: 3.2, ruido: 30 },
  { id: 'ECO-02', m: 'xg',       rot: 'xG',       min: 1.8, max: 2.7, ruido: 7 },
  { id: 'ECO-03', m: 'shots',    rot: 'chutes',   min: 12,  max: 20,  ruido: 7 },
  { id: 'ECO-04', m: 'onTarget', rot: 'no alvo',  min: 4,   max: 7,   ruido: 7 },
];

/* base -> {baseline, candidatas:{nome:arquivo}} */
const BASES = [
  { nome: 's1 4200000', baseline: 'reports/r1835/bateria48_r1835.json',
    cand: { 'R18.40A (vel+goleiro)': 'reports/r1840/multi_prom_s1.json', 'sub_a (+folego73)': 'reports/r1840/multi_subA_s1.json' } },
  { nome: 's2 8400000', baseline: 'reports/r1840/bateria48_r1835_semente2.json',
    cand: { 'R18.40A (vel+goleiro)': 'reports/r1840/bateria48_R18.40A_semente2.json', 'sub_a (+folego73)': 'reports/r1840/multi_subA_s2.json' } },
  { nome: 's3 1260000', baseline: 'reports/r1840/multi_base_s3.json',
    cand: { 'R18.40A (vel+goleiro)': 'reports/r1840/multi_prom_s3.json', 'sub_a (+folego73)': 'reports/r1840/multi_subA_s3.json' } },
];

const nomes = ['R18.40A (vel+goleiro)', 'sub_a (+folego73)'];
const dados = [];
for (const b of BASES) {
  let base; try { base = R(b.baseline); } catch (_) { console.log(b.nome + ': baseline ausente'); continue; }
  const linha = { base: b.nome, baseline: base, cand: {} };
  for (const n of nomes) { try { linha.cand[n] = R(b.cand[n]); } catch (_) { linha.cand[n] = null; } }
  dados.push(linha);
}

console.log('=== 1. O GATE E CUMPRIDO PELA BASELINE EM CADA BASE? ===');
console.log('   (se a baseline reprova, o gate nao discrimina candidata naquela base)');
const gateValido = {};
for (const g of GATES) {
  const marcas = dados.map(d => {
    const v = d.baseline.agregado[g.m].media;
    const ok = v >= g.min && v <= g.max;
    gateValido[g.id] = gateValido[g.id] || {}; gateValido[g.id][d.base] = ok;
    return d.base + '=' + v.toFixed(3) + (ok ? ' ok' : ' REPROVA');
  });
  const validoEm = Object.values(gateValido[g.id]).filter(Boolean).length;
  console.log('  ' + g.id + ' ' + g.rot.padEnd(8) + 'faixa ' + g.min + '-' + g.max + '  |  ' + marcas.join('  |  ') +
    '   => gate valido em ' + validoEm + '/' + dados.length + ' bases');
}

console.log('');
console.log('=== 2. EFEITO DE CADA CANDIDATA, BASE POR BASE ===');
for (const n of nomes) {
  console.log('  ' + n);
  for (const g of GATES) {
    const partes = dados.map(d => {
      const c = d.cand[n]; if (!c) return d.base + '=?';
      const x = d.baseline.agregado[g.m].media, y = c.agregado[g.m].media;
      const dl = x ? ((y - x) / x) * 100 : 0;
      const dentro = y >= g.min && y <= g.max;
      return d.base + ': ' + y.toFixed(3) + ' (' + (dl > 0 ? '+' : '') + dl.toFixed(1) + '%)' + (dentro ? '' : ' FORA');
    });
    const deltas = dados.map(d => { const c = d.cand[n]; if (!c) return null; const x = d.baseline.agregado[g.m].media, y = c.agregado[g.m].media; return x ? ((y - x) / x) * 100 : 0; }).filter(v => v !== null);
    const consistente = deltas.length > 1 && (deltas.every(v => v > 0) || deltas.every(v => v < 0));
    const acimaDoRuido = deltas.some(v => Math.abs(v) > g.ruido);
    console.log('     ' + g.id + ' ' + g.rot.padEnd(8) + partes.join('  |  '));
    console.log('        direcao ' + (consistente ? 'CONSISTENTE' : 'inconsistente') + ' · magnitude ' + (acimaDoRuido ? 'acima da banda' : 'dentro da banda de ' + g.ruido + '%'));
  }
  console.log('');
}

console.log('=== 3. VEREDITO ===');
for (const n of nomes) {
  const perdidos = [];
  for (const g of GATES) {
    for (const d of dados) {
      const c = d.cand[n]; if (!c) continue;
      if (!gateValido[g.id][d.base]) continue;             // gate invalido naquela base
      const y = c.agregado[g.m].media;
      if (!(y >= g.min && y <= g.max)) perdidos.push(g.id + '@' + d.base + '=' + y.toFixed(3));
    }
  }
  console.log('  ' + n.padEnd(24) + (perdidos.length ? 'PERDE gate valido: ' + perdidos.join(', ') : 'nao perde nenhum gate valido'));
}
