#!/usr/bin/env node
'use strict';
/*
 * OS-19 · POSICIONAMENTO DO GOLEIRO PELA BISSETRIZ
 * ------------------------------------------------
 * CANDIDATA COMPORTAMENTAL. NAO PROMOVIDA.
 *
 * `_goalkeeperTarget` (:6987) coloca o goleiro em
 * `x = goal.x ± depth` e `y` por um lerp de FATOR FIXO em direcao a bola:
 *
 *   ty = clamp(FW/2 + (b.y - FW/2) * (.22 + pos/290), 18, FW-18)
 *
 * Para um goleiro bom (`posicionamento` 80) o fator e ~0,50. Com a bola aberta
 * em y=10 num campo de 68 m, isso poe o goleiro em y≈22 — cerca de 8 m FORA do
 * poste mais proximo (postes em ~30,3 e ~37,7). Ele cobre o angulo errado.
 *
 * O certo e geometrico e nao tem constante arbitraria: o goleiro fica sobre o
 * segmento bola->centro do gol, a `depth` da linha. Isso e a bissetriz do
 * angulo entre a bola e os dois postes, que e como goleiro se posiciona.
 *
 *   dx = ref.x - goal.x ; dy = ref.y - goal.y ; L = hypot(dx, dy)
 *   ty = goal.y + dy/L * depth
 *
 * A referencia e o PORTADOR quando existe um adversario com a bola, senao a
 * propria bola — a mesma referencia que o resto da funcao ja usa.
 *
 * O alvo geometrico e MESCLADO com o antigo segundo `posicionamento`: goleiro
 * de `pos` alto vai quase inteiro para a bissetriz, goleiro ruim continua
 * errando a posicao. Isso preserva a diferenca entre goleiros, que era o
 * proposito do fator original — ele so estava aplicado na formula errada.
 *
 * Nao mexe em `depth`, nem na logica de saida, nem no congelamento de alvo do
 * `_gkAI`, nem no desvio de R18.40 que manda o goleiro ao ponto de
 * interceptacao quando o chute ja esta em voo.
 *
 * NAO ha RNG novo, NAO ha bonus de reflexo, velocidade ou xG. O goleiro nao
 * fica mais rapido nem mais forte: fica no lugar certo.
 *
 * GATE: `gols sofridos` e `xG` nao podem DESCER a ponto de esvaziar o jogo —
 * um goleiro bem posicionado defende mais, e ECO-02 ja estava folgado por
 * baixo (1,90). Se os gols cairem demais, a rota e recalibrar conversao.
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find(x => x.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const input = arg('in', 'dist/COPA DOS SONHOS - R18.50 - PRESERVAR ENERGIA.html');
const output = arg('out', 'dist/COPA DOS SONHOS - R18.50 - OS19 GOLEIRO.html');
const peso = Number(arg('peso', '0.85'));
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
  'os19-gk-angle-bisector',
  `    depth*=.92+pace/100*.10;
    const rawX=goal.x+tm.attackDir*depth;`,
  `    depth*=.92+pace/100*.10;
    /* OS-19 · bissetriz real: o goleiro fica sobre o segmento bola->gol, a
       \`depth\` da linha. O lerp de fator fixo acima o punha ate 8 m fora do
       poste com a bola aberta. Mesclado por \`posicionamento\`, para que a
       diferenca entre goleiros continue existindo. */
    {
      const _rx=(b&&b.owner&&b.owner.team!==tm.side)?b.owner.x:(b?b.x:goal.x);
      const _ry=(b&&b.owner&&b.owner.team!==tm.side)?b.owner.y:(b?b.y:goal.y);
      const _dx=_rx-goal.x,_dy=_ry-goal.y,_L=Math.max(.6,Math.hypot(_dx,_dy));
      const _bis=goal.y+_dy/_L*depth;
      if(Number.isFinite(_bis))ty=clamp(lerp(ty,_bis,clamp(pos/100,.35,1)*${peso}),6,FW-6);
    }
    const rawX=goal.x+tm.attackDir*depth;`
);

fs.writeFileSync(output, src, 'utf8');
const sha = crypto.createHash('sha256').update(src).digest('hex');
console.log('patches:', applied.join(', '), '| peso=' + peso);
console.log(path.basename(output), '| sha256', sha);
