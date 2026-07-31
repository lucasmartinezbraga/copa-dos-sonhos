#!/usr/bin/env node
'use strict';
/*
 * OS-11 · SEPARACAO ENTRE COMPANHEIROS
 * ------------------------------------
 * CANDIDATA COMPORTAMENTAL. NAO PROMOVIDA.
 *
 * A unica forca que separa companheiros na R18.50 esta na camada Fase 4-7,
 * build :8087. Ela roda a cada 0,25 s, so atua abaixo de 2,05 m, e o empurrao
 * e `k = min((2.05-d)*.16, .16)` — no maximo 16 cm por correcao, a 4 Hz.
 * Isso impede sobreposicao; nao abre uma coluna.
 *
 * O sampler de enxame do R18.17.3 (:21289) conta `dist(p, bola)`, entao
 * `swarmRate` e `severeCollapseRate` sao CEGOS para aglomeracao longe da bola.
 * Uma coluna de oito jogadores num corredor passa nos dois gates. Por isso a
 * OS-06 mede espacamento por conta propria.
 *
 * Este patch amplia o raio de atuacao (2,05 -> 3,40 m) e a forca (teto de
 * 16 cm -> 38 cm por correcao). A cadencia de 0,25 s NAO e alterada: mexer no
 * relogio mudaria tambem a amostragem de corridorOccupancy e clumpCorrections
 * no mesmo bloco, e contaminaria a comparacao pareada.
 *
 * O portador da bola continua imune ao empurrao, como no original.
 *
 * NAO ha RNG novo, NAO ha mudanca de posse, NAO ha bonus. O efeito e
 * geometrico e simetrico entre os dois times.
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find(x => x.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const input = arg('in', 'dist/COPA DOS SONHOS - R18.50 - PRESERVAR ENERGIA.html');
const output = arg('out', 'dist/COPA DOS SONHOS - R18.50 - OS11 SEPARACAO.html');
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
  'os11-separation-radius-and-force',
  `if(d<2.05){const nx=d>.01?(a.x-b.x)/d:1,ny=d>.01?(a.y-b.y)/d:0,k=Math.min((2.05-d)*.16,.16);`,
  `if(d<3.40){const nx=d>.01?(a.x-b.x)/d:1,ny=d>.01?(a.y-b.y)/d:0,k=Math.min((3.40-d)*.34,.38);`
);

fs.writeFileSync(output, src, 'utf8');
const sha = crypto.createHash('sha256').update(src).digest('hex');
console.log('patches:', applied.join(', '));
console.log(path.basename(output), '| sha256', sha);
