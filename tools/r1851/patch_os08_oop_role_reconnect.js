#!/usr/bin/env node
'use strict';
/*
 * OS-08 · RELIGA A FUNCAO DEFENSIVA DO JOGADOR (`oopRole`)
 * -------------------------------------------------------
 * CANDIDATA COMPORTAMENTAL. NAO PROMOVIDA.
 *
 * A OS-07 provou, estaticamente, que `oopRole` de jogador de linha nao e lido
 * por nenhum codigo alcancavel. Os tres unicos leitores estao em :7535 e :7536,
 * dentro do `_defendTarget` BASE — e a camada R13 (:16845) sobrescreve
 * `_defendTarget` sem chamar `oldDefend13` nenhuma vez. A base e codigo morto.
 * O unico `oopRole` vivo e o do goleiro, em :6002 (sweeper).
 *
 * Este patch reconecta as mesmas duas regras, com os mesmos coeficientes do
 * texto original, na camada EFETIVA (R18.17.3, :21282), imediatamente antes do
 * return — que e exatamente onde elas ficavam na base (:7536-7538).
 *
 * NAO ha RNG novo, NAO ha bonus de xG, NAO ha bonus de velocidade, NAO ha
 * mudanca de posse. O efeito e um deslocamento do alvo de posicionamento
 * defensivo, e so para jogador cujo `oopRole` seja track_wide, screen ou
 * anchor. Na escalacao padrao isso e 2 de 20 jogadores de linha (`anchor`).
 *
 * ATENCAO: aplicado DEPOIS das correcoes de faixa do R18.17.3, o ramo
 * `track_wide` desfaz parte da disciplina de corredor de proposito — e o que a
 * funcao significa. Se isso piorar aglomeracao, o gate de enxame reprova.
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find(x => x.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const input = arg('in', 'dist/COPA DOS SONHOS - R18.50 - PRESERVAR ENERGIA.html');
const output = arg('out', 'dist/COPA DOS SONHOS - R18.50 - OS08 OOP ROLE.html');
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
  'os08-reconnect-oop-role',
  `  return[clamp(tx,1,FL-1),clamp(ty,2,FW-2)];
};`,
  `  /* OS-08 · as duas regras de \`oopRole\` do _defendTarget base (:7535-7536),
     religadas na camada efetiva. Mesmos coeficientes do texto original. A base
     nunca roda porque o R13 (:16845) nao encadeia. */
  if(p.oopRole==='track_wide'){s.oopRoleTrackWide=(s.oopRoleTrackWide||0)+1;ty=lerp(ty,finite(b.y),.12);}
  if(p.oopRole==='screen'||p.oopRole==='anchor'){s.oopRoleAnchor=(s.oopRoleAnchor||0)+1;tx=lerp(tx,finite(tm.goal&&tm.goal.x),.05);}
  return[clamp(tx,1,FL-1),clamp(ty,2,FW-2)];
};`
);

fs.writeFileSync(output, src, 'utf8');
const sha = crypto.createHash('sha256').update(src).digest('hex');
console.log('patches:', applied.join(', '));
console.log(path.basename(output), '| sha256', sha);
