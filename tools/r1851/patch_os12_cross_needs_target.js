#!/usr/bin/env node
'use strict';
/*
 * OS-12 · CRUZAMENTO PRECISA DE ALVO
 * ----------------------------------
 * CANDIDATA COMPORTAMENTAL. NAO PROMOVIDA.
 *
 * Dois pontos produzem a levantada na area sem ninguem la:
 *
 * 1) `:5155` — a decisao de cruzar e um sorteio puro colocado ANTES de toda a
 *    camada de decisao. `_canCross` (:5712) e so geometria (`adv > 78 &&
 *    wideY`) e `crossP` (:5154) le largura da defesa e qualidade do melhor
 *    passe, mas NUNCA le se ha companheiro na area. O `return` imediato
 *    curto-circuita o softmax de candidatos instalado em :8084 — o cruzamento
 *    e a unica acao que escapa inteira da camada de decisao.
 *
 * 2) `:5317` — dentro de `_cross`, `delivery` cai em `'air'` sempre que nao ha
 *    alvo rasteiro, SEM verificar se `bestAir` existe. Com `inBox` vazio, sobe
 *    a bola do mesmo jeito. A essa altura `stats.crosses++` (:5303) ja
 *    disparou e nao ha volta.
 *
 * O primeiro edit usa exatamente o mesmo criterio de `inBox` de :5304
 * (companheiro de linha a menos de 24 m do gol adversario), com `g` e `tm` que
 * ja estao no escopo de `_decide` (:5062-5063). Sem isso, o segundo edit so
 * troca o tipo de cruzamento ruim.
 *
 * O segundo edit prefere o rasteiro quando nao ha alvo aereo, em vez de
 * levantar por omissao.
 *
 * NAO ha RNG novo: `chance(crossP)` continua sendo rolado uma vez por decisao.
 * ATENCAO ao ordenamento: a condicao nova entra ANTES de `chance(crossP)`, o
 * que reduz o numero de rolagens e portanto DESLOCA a sequencia de RNG. A
 * comparacao pareada com a baseline diverge por caos — so direcao sobre muitas
 * sementes vale como evidencia.
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find(x => x.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const input = arg('in', 'dist/COPA DOS SONHOS - R18.50 - PRESERVAR ENERGIA.html');
const output = arg('out', 'dist/COPA DOS SONHOS - R18.50 - OS12 CRUZAMENTO COM ALVO.html');
let src = fs.readFileSync(input, 'utf8');
const applied = [];

function edit(id, from, to) {
  const count = src.split(from).length - 1;
  if (count !== 1) {
    console.error('ABORTA [' + id + ']: ancora ' + count + 'x');
    process.exit(1);
  }
  src = src.replace(from, to);
  applied.push(id);
}

edit(
  'os12-cross-requires-box-presence',
  `    if (this._canCross(o) && chance(crossP)) { this._cross(o); return; }`,
  `    /* OS-12 · mesmo criterio de inBox de :5304. Sem companheiro na area nao
       existe cruzamento: antes disso o sorteio subia a bola para ninguem. */
    const _os12Alvo = tm.players.some(m => m !== o && !m.red && !m.isGK && D(m.x, m.y, g.x, g.y) < 24);
    if (this._canCross(o) && _os12Alvo && chance(crossP)) { this._cross(o); return; }`
);

edit(
  'os12-air-only-with-aerial-target',
  `    const delivery = !setPiece && bestLow && chance(lowP) ? 'low' : 'air';`,
  `    /* OS-12 · sem alvo aereo, o rasteiro deixa de ser sorteado e passa a ser
       a escolha. Antes, a ausencia de bestLow levantava a bola por omissao. */
    const delivery = !setPiece && bestLow && (!bestAir || chance(lowP)) ? 'low' : 'air';`
);

fs.writeFileSync(output, src, 'utf8');
const sha = crypto.createHash('sha256').update(src).digest('hex');
console.log('patches:', applied.join(', '));
console.log(path.basename(output), '| sha256', sha);
