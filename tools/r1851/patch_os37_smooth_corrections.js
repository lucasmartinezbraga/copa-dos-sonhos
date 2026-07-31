#!/usr/bin/env node
'use strict';
/*
 * OS-37 · A CORRECAO DE ESPACO DEIXA DE SER TELETRANSPORTE
 * --------------------------------------------------------
 * Erro MEU, medido contra a propria base.
 *
 * O bloco P47 de `_movePlayers` (:8087) roda a cada 0,25 s de simulacao e
 * corrige aglomeracao mexendo em `p.x`/`p.y` DIRETAMENTE, num unico quadro:
 *
 *     k = min((2.05-d)*.16, .16)      -> ate 0,16 m instantaneos por par
 *     OS-26 (faixa)                   -> ate 0,30 m instantaneos por par
 *
 * O passo normal de um jogador no navegador e `7 m/s * 1/60 = 0,117 m` por
 * quadro. Ou seja: uma unica correcao de faixa vale 2,5 passos, e o laco e
 * PAREADO — o mesmo jogador pode receber empurrao de varios companheiros no
 * mesmo quadro e somar bem mais que isso. Isso e exatamente a "mini travadinha"
 * relatada: o jogador anda liso e de repente pula.
 *
 * MEDIDO (diag_os37_frame_jump, 4 partidas, passo 1/60 = o do navegador):
 *                            R18.50     R18.63 (com OS-26)
 *   quadros 12-18 m/s         0,328%      1,106%
 *   quadros acima de 18 m/s   0,004%      0,352%
 *   ACIMA DE 12 m/s           0,332%      1,458%
 * A OS-26 quadruplicou a taxa de salto. A regressao e minha.
 *
 * CORRECAO: a fisica do empurrao nao muda — muda a ENTREGA. Em vez de somar em
 * `p.x`/`p.y` na hora, o empurrao vai para um saldo (`_nudgeX`/`_nudgeY`), e
 * um sangrador roda a CADA quadro entregando no maximo `VCORR * dt` desse
 * saldo. Com VCORR = 5 m/s (abaixo dos ~7 m/s de corrida), uma correcao de
 * 0,30 m se dissolve em 0,06 s, cada quadro com 0,083 m — abaixo do passo
 * normal, invisivel. E como o bloco P47 so volta a 0,25 s, o saldo sempre zera
 * antes do proximo. VCORR=3 foi MEDIDO e ficou PIOR (0,594% contra 0,460%): o
 * saldo sobrava e se somava ao tique seguinte.
 *
 * O DESLOCAMENTO TOTAL e o mesmo: nada de separacao e perdido, so deixa de ser
 * instantaneo. O saldo e limitado a 1,2 m para que uma pilha de pares nao vire
 * um arrasto longo.
 *
 * Sem RNG. Sem mudanca de decisao. A trajetoria integrada difere por
 * arredondamento e por chegar 0,1 s depois, entao a bateria diverge por caos.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR:
 *   - quadros acima de 12 m/s: DESCE, abaixo do valor da R18.50 (0,332%).
 *   - `colunaLongeDaBola` (o ganho da OS-26): NAO pode voltar a subir.
 *   - gate de marcacao: NAO pode piorar.
 *
 * RESULTADO: acima de 12 m/s 1,458% -> 0,460%, e a faixa acima de 18 m/s, que
 * e o teletransporte violento, some (0,352% -> 0,009%). A previsao de ficar
 * ABAIXO da base NAO se cumpriu: 95% do salto restante nasce FORA de
 * `_movePlayers` (reinicio, `_setCorner`, `_switchSides`, `deferPositions`) e
 * ja existia na base. Dentro da cadeia de movimento a build ficou igual a ela
 * (0,014% contra 0,016%). `colunaLongeDaBola` 0,0260 contra 0,0251 da OS-36
 * sozinha: a deriva e da barreira, nao do sangrador.
 *
 * ARMADILHA: se o sangrador rodar dentro do gate de 0,25 s ele entrega uma vez
 * so e nao suaviza nada. Ele tem de rodar ANTES do `if(clock<.25)return`, por
 * time e por quadro.
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find(x => x.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const input = arg('in', 'dist/COPA DOS SONHOS - R18.65 - JOGO DE FUTEBOL.html');
const output = arg('out', 'dist/COPA DOS SONHOS - R18.66 - JOGO DE FUTEBOL.html');
const vcorr = arg('vcorr', '5');
const teto = arg('saldo', '1.2');
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

/* 1) sangrador por quadro, antes do gate de 0,25 s ------------------------ */
edit(
  'os37-bleeder',
  `const om=Q._movePlayers;if(om)Q._movePlayers=function(dt){const out=om.apply(this,arguments);this.teams.forEach(tm=>{tm.phase47.clock+=dt;`,
  `const om=Q._movePlayers;if(om)Q._movePlayers=function(dt){const out=om.apply(this,arguments);` +
  `/* OS-37 · entrega do saldo de correcao, ${vcorr} m/s no maximo, TODO quadro. */` +
  `{const _bl=Math.max(.004,${vcorr}*(Number.isFinite(dt)?dt:1/60));` +
  `for(const _tm of this.teams)for(const _p of _tm.players){if(!_p||_p.red)continue;` +
  `const _nx=_p._nudgeX||0,_ny=_p._nudgeY||0;if(!_nx&&!_ny)continue;` +
  `const _L=Math.hypot(_nx,_ny);if(_L<1e-4){_p._nudgeX=0;_p._nudgeY=0;continue;}` +
  `const _s=Math.min(_bl,_L);_p.x=C(_p.x+_nx/_L*_s,1,FL-1);_p.y=C(_p.y+_ny/_L*_s,1,FW-1);` +
  `const _r=(_L-_s)/_L;_p._nudgeX=_nx*_r;_p._nudgeY=_ny*_r;}}` +
  `this.teams.forEach(tm=>{tm.phase47.clock+=dt;`
);

/* 2) empurrao de aglomeracao vira saldo ----------------------------------- */
edit(
  'os37-clump-into-nudge',
  `if(this.ball.owner!==a){a.x=C(a.x+nx*k,1,FL-1);a.y=C(a.y+ny*k,1,FW-1);}if(this.ball.owner!==b){b.x=C(b.x-nx*k,1,FL-1);b.y=C(b.y-ny*k,1,FW-1);}s.clumpCorrections++;}`,
  `if(this.ball.owner!==a){a._nudgeX=C((a._nudgeX||0)+nx*k,-${teto},${teto});a._nudgeY=C((a._nudgeY||0)+ny*k,-${teto},${teto});}` +
  `if(this.ball.owner!==b){b._nudgeX=C((b._nudgeX||0)-nx*k,-${teto},${teto});b._nudgeY=C((b._nudgeY||0)-ny*k,-${teto},${teto});}s.clumpCorrections++;}`
);

/* 3) empurrao de faixa (OS-26) vira saldo --------------------------------- */
edit(
  'os37-lane-into-nudge',
  `if(this.ball.owner!==a)a.y=C(a.y+_sy*_kk,1,FW-1);if(this.ball.owner!==b)b.y=C(b.y-_sy*_kk,1,FW-1);s.clumpCorrections++;}`,
  `if(this.ball.owner!==a)a._nudgeY=C((a._nudgeY||0)+_sy*_kk,-${teto},${teto});` +
  `if(this.ball.owner!==b)b._nudgeY=C((b._nudgeY||0)-_sy*_kk,-${teto},${teto});s.clumpCorrections++;}`
);

fs.writeFileSync(output, src, 'utf8');
const sha = crypto.createHash('sha256').update(src).digest('hex');
console.log('patches:', applied.join(', '), '| vcorr=' + vcorr, 'saldo=' + teto);
console.log(path.basename(output), '| sha256', sha);
