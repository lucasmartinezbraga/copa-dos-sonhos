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
 *
 * RESULTADO MEDIDO (3 partidas, base 4200000, contra a baseline pareada):
 *   coladoLt2   0.0035 -> 0.0008     (sobreposicao local cai ~4x)
 *   coladoLt3   0.0151 -> 0.0087
 *   coluna3     0.0507 -> 0.0527     INALTERADO
 *   coluna4     0.0063 -> 0.0077     INALTERADO
 *   colunaLongeDaBola 0.0266 -> 0.0284  INALTERADO
 *   corredorMax 9 -> 9               INALTERADO
 *
 * ESTA CANDIDATA NAO CUMPRE O QUE PROPOS. Ela conserta sobreposicao local e
 * NAO abre a coluna. A razao e geometrica: uma coluna definida por |dy|<=3 e
 * |dx|<=12 tem vizinhos a mais de 3,40 m um do outro, entao a forca nunca
 * engata. O amontoamento da tela NAO e "jogadores perto demais" — e varios
 * jogadores escolhendo o MESMO corredor de y.
 *
 * O sitio da coluna e portanto de FAIXA, nao de proximidade: as ancoras de
 * zona (`hy`) e o alvo de marca do R13 (:16768, marcador em 96,5% da faixa do
 * alvo; marcaDyMedio medido em 1,8 m). Nao vou patchar isso as cegas — antes
 * e preciso atribuir as colunas por dever, que a OS-06 mede com uma extensao
 * pequena. Foi assim que a hipotese do penalti da OS-09 morreu.
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
