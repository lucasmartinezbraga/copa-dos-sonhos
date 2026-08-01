#!/usr/bin/env node
'use strict';
/*
 * OS-65 · NINGUEM ANDA EM CAMPO
 * ------------------------------
 * Pedido: "FOCA NO MOVIMENTO DOS JOGADORES".
 *
 * CENSO (4 partidas, 4.097.164 quadros-jogador, so jogadores de linha):
 *
 *     velocidade (% do tempo)   jogo     GPS de elite
 *       < 2 m/s (andando)       20,0%      ~57%
 *       2 a 4 (trote)           34,4%      ~25%
 *       4 a 5,5 (corrida)       23,6%       ~9%
 *       5,5 a 7 (forte)         12,4%       ~4%
 *       > 7 (sprint)             9,6%       ~1%
 *       ------------------------------------------
 *       distancia            21,17 km      ~10,5 km
 *
 * O jogo passa 22% do tempo acima de 5,5 m/s; o futebol passa ~5%. Nao e um
 * jogador rapido demais: e que NINGUEM ANDA. Vinte e dois atletas em
 * deslocamento permanente e exatamente a leitura de "peca deslizando".
 *
 * ONDE. O `_integrate` vivo NAO e o do nucleo (:7713, morto): e a versao
 * transacional R12 (:16395), que planeja em `ctx.planned` e deixa o
 * `commitMovement` escrever uma vez. Nela (:16399):
 *
 *     if (duty || d > 16) effort = 1;
 *     else { ... effort = clamp(.55 + f*.35 + b*.14, .5, 1); }
 *
 * E `duty` recebe `_breaking`, que TRES camadas posteriores ligam sozinhas
 * (:17163, :20500, :20701) sempre que um marcador esta a mais de 2,35 a 3,4 m
 * do seu homem — distancia que um marcador ocupa quase o tempo inteiro.
 *
 * MEDIDO (3 partidas, 3.372.336 chamadas):
 *
 *     esforco 1 por dever de bola          26,7%
 *     esforco 1 por alvo a mais de 16 m    13,3%
 *     esforco 1 por marcacao (> 2,55 m)    23,2%   (16,3% so por isto)
 *     ---- TOTAL                           52,5%
 *
 *     e desse total, a distancia ate a BOLA:
 *       < 10 m  21,1% | 10-20 m 27,2% | 20-30 m 23,8% | 30-45 m 21,3% | >45 m 6,7%
 *
 * Metade do esforco maximo do jogo acontece a MAIS DE 20 M DA BOLA. E ai que
 * os 21 km sao gastos.
 *
 * EDIT · o esforco passa a ser amortecido pela distancia ate a BOLA, e so para
 * quem NAO tem dever de bola de verdade.
 *
 *   - portador, recebedor, quem persegue a bola e quem esta em arranque:
 *     esforco 1, sempre, sem tocar em nada. Perto da bola o jogo continua
 *     identico.
 *   - marcador em recuperacao (`_breaking`): continua acima dos outros —
 *     piso ${'${PISO_M}'} — porque acompanhar o homem nao vira caminhada.
 *   - o resto: piso ${'${PISO_O}'}.
 *   - a amortecao e continua: a ${'${PERTO}'} m da bola nada muda; a
 *     ${'${LONGE}'} m vale o piso; entre as duas, interpola.
 *
 * NAO mexe em maxSpd, acc, turn, nem no alvo de ninguem, nem em RNG. So no
 * quanto do proprio teto o atleta usa quando o lance esta longe dele.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR (base R18.81):
 *   - tempo abaixo de 2 m/s (20,0%): SOBE.
 *   - tempo acima de 7 m/s (9,6%): DESCE.
 *   - distancia por jogador (21,17 km): DESCE.
 *   - marcacao: `getR13Audit().gates.marking` NAO pode quebrar
 *     (threatCoverage >= .65 e markerMeanDistance <= 8.5).
 *   - gols, chutes e escanteios: nao podem degradar; escanteios 4 a 10.
 *   - RECUSA se a marcacao cair, se os gols dispararem (defesa que nao chega)
 *     ou se os escanteios sairem da faixa.
 *
 * ARMADILHA: o amortecimento usa distancia ate a BOLA, nao ate o alvo. Um
 * zagueiro recuando enquanto o contra-ataque corre para longe dele ficaria
 * lento na hora errada — por isso a clausula `d > 16` do motor, que poe em
 * esforco 1 quem esta muito fora de posicao, e preservada INTACTA e passa por
 * cima do piso.
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find(x => x.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const input  = arg('in',  'dist/COPA DOS SONHOS - R18.81 - JOGO DE FUTEBOL.html');
const output = arg('out', 'dist/COPA DOS SONHOS - R18.82 - JOGO DE FUTEBOL.html');
const PERTO  = arg('perto', '9');
const LONGE  = arg('longe', '32');
const PISO_M = arg('pisoMarcador', '0.62');
const PISO_O = arg('pisoOutros',   '0.42');
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
  'os65-effort-by-ball',
  `  if(duty||d>16)effort=1;else{const f=clamp((d-3)/13,0,1),b=.5+.5*Math.sin(finite(this.t)*.85+p._gaitPh);effort=clamp(.55+f*.35+b*.14,.5,1);}`,
  `  if(duty||d>16)effort=1;else{const f=clamp((d-3)/13,0,1),b=.5+.5*Math.sin(finite(this.t)*.85+p._gaitPh);effort=clamp(.55+f*.35+b*.14,.5,1);}
  /* OS-65 · 52,5% dos quadros saiam daqui com esforco 1, e metade deles a mais
     de 20 m da bola: 21,17 km por jogador contra ~10,5 reais. O teto passa a
     cair com a distancia ate a BOLA, e so para quem nao tem dever de bola de
     verdade. Quem esta com ela, esperando por ela ou correndo atras dela nao e
     tocado; e a clausula d>16 acima, que salva quem esta muito fora de
     posicao, passa por cima deste piso. */
  {
    const _hard = !!(p._burst || p===this.ball.owner || p.__chase ||
                     (this.ball && this.ball.traveling && this.ball.receiver===p) || d>16);
    if(!_hard){
      const _bb=this.ball;
      const _db=_bb?Math.hypot(sx-finite(_bb.x,sx),sy-finite(_bb.y,sy)):1e9;
      const _u=clamp((${LONGE}-_db)/(${LONGE}-${PERTO}),0,1);
      const _piso=p._breaking?${PISO_M}:${PISO_O};
      const _teto=_piso+(1-_piso)*_u;
      if(effort>_teto)effort=_teto;
    }
  }`
);

fs.writeFileSync(output, src, 'utf8');
const sha = crypto.createHash('sha256').update(src).digest('hex');
console.log('patches:', applied.join(', '),
            '| perto=' + PERTO, 'longe=' + LONGE,
            'pisoMarcador=' + PISO_M, 'pisoOutros=' + PISO_O);
console.log(path.basename(output), '| sha256', sha);
