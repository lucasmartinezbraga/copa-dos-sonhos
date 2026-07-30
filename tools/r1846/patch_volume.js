#!/usr/bin/env node
'use strict';
/* ============================================================================
 * R18.46 · O JOGO PASSA A CHUTAR — volume de finalizacao de jogo aberto
 * ----------------------------------------------------------------------------
 * VAI JUNTO COM O PRECO POSICIONAL DO RASTEIRO, DE PROPOSITO. O relatorio da
 * R18.45 concluiu que preco honesto e volume tem de vir na MESMA entrega: o
 * preco honesto sozinho derruba os gols para 1,71 (ECO-01 reprova 0/3), e o
 * volume sozinho sobre o preco inflado empurraria gols e xG para cima do teto.
 * Separados, o intervalo entre eles reprova. Este patch e aplicado SOBRE uma
 * build que ja tem tools/r1845/patch_rasteiro.js.
 *
 * O DEFEITO. Finalizacoes de jogo aberto sao 5,79 por partida (2,9 por time),
 * contra ~12 por time do futebol real — cerca de 25% do volume real. O motor
 * SUBSTITUI chute por cruzamento: low_cross_shot + header_shot somam 8,1 por
 * partida, 55,6% de todas as finalizacoes. Futebol real tem ~15-20% de
 * finalizacoes vindas de cruzamento.
 *
 * O MECANISMO, em `_evaluateShotDecision` (sem sobrescrita na cadeia):
 *
 *     const minimum = oneOnOne?.05:dtg<10?.045:dtg<16?.052:dtg<21?.062:dtg<25?.082:.105;
 *     const choiceRatio = oneOnOne?.22:longshot?.82:.38;
 *     let take = longPermission && shotUtility>=minimum && shotUtility>=passUtility*choiceRatio;
 *
 * A `shotUtility` e construida sobre `base = distanceXg(dtg)`:
 *     shotUtility = base*angle*(.70+skill*.72)*execution*styleIntent + composure*.03 + ...
 * A 22 m, com base 0,064 e angulo 0,8, isso da ~0,074 — contra um `minimum` de
 * 0,082 na faixa dtg<25. O chute e suprimido por construcao justamente na faixa
 * onde o futebol real chuta mais. O limiar esta acima do que a propria curva de
 * xG do motor consegue produzir ali.
 *
 * `choiceRatio` de 0,82 para longshot e a segunda tranca: exige que o chute vale
 * 82% do passe, quando o passe tem piso de 0,055 e ganha +0,17 se for para a
 * area. Um chute de 20 m quase nunca ganha essa comparacao.
 *
 * O QUE ESTE PATCH NAO FAZ, e e o contrato com `INT-03`. Nao mexe em `maxRange`
 * (20,5 m comum, 22,5/24,5 por atributo, 27,5 para especialista), nao mexe em
 * `longPermission` (que exige longAttr>=70 e technique>=72 e proibe chute
 * pressionado) e nao mexe na curva `distanceXg`. Logo NAO abre a porta para o
 * chute irracional do meio-campo que `INT-03` persegue: continua impossivel
 * chutar de 30 m sem ser especialista, e continua proibido chutar pressionado
 * de longe. O que muda e o limiar de decisao DENTRO da faixa ja permitida.
 *
 * MEDIR `INT-03` DEPOIS DISTO E OBRIGATORIO. O risco desta rodada e exatamente
 * trocar "nao chuta" por "chuta besteira". A distribuicao por banda de
 * tools/r1843/diag_xg.js e o instrumento: se a fatia de 22-30 m crescer muito
 * mais que a de 11-22 m, o patch piorou a decisao em vez de melhorar o volume.
 *
 * USO
 *   node tools/r1846/patch_volume.js --in=ENTRADA.html --out=SAIDA.html \
 *        [--minEscala=0.72] [--longRatio=0.55] [--normalRatio=0.32]
 * ==========================================================================*/
const fs = require('fs'), crypto = require('crypto'), path = require('path');
const a = (n, d) => { const h = process.argv.slice(2).find(x => x.startsWith('--' + n + '=')); return h ? h.slice(n.length + 3) : d; };
const ESC = parseFloat(a('minEscala', '0.72'));
const LONG_R = a('longRatio', '0.55');
const NORM_R = a('normalRatio', '0.32');
if (!(ESC > 0 && ESC <= 1.5)) { console.error('ABORTA: minEscala fora de faixa'); process.exit(1); }

let src = fs.readFileSync(a('in', 'entrada.html'), 'utf8');
const applied = [];
function troca(id, de, para) {
  const n = src.split(de).length - 1;
  if (n !== 1) { console.error('ABORTA [' + id + ']: ancora ' + n + 'x, esperado 1'); process.exit(1); }
  src = src.split(de).join(para); applied.push(id);
}

/* Os limiares escalam JUNTOS, preservando a forma da curva (mais exigente
   quanto mais longe). Nao invento numeros novos por faixa: multiplico os que ja
   existem, para que a intencao original — chutar de longe exige mais — continue
   valendo, so com o patamar no lugar onde a curva de xG do motor alcanca. */
const r = v => +(v * ESC).toFixed(4);
troca('r1846-minimo',
  `const minimum = oneOnOne?.05:dtg<10?.045:dtg<16?.052:dtg<21?.062:dtg<25?.082:.105;`,
  `const minimum = oneOnOne?${r(.05)}:dtg<10?${r(.045)}:dtg<16?${r(.052)}:dtg<21?${r(.062)}:dtg<25?${r(.082)}:${r(.105)};`);

/* O chute deixa de precisar valer 82% do passe para acontecer de longe. O passe
   continua tendo o bonus de .17 quando vai para a area, entao a comparacao
   segue favorecendo a jogada melhor — apenas para de proibir a finalizacao. */
troca('r1846-razao',
  `const choiceRatio = oneOnOne?.22:longshot?.82:.38;`,
  `const choiceRatio = oneOnOne?.22:longshot?${LONG_R}:${NORM_R};`);

const META = `<script id="cds-r1846-shot-volume">
/* R18.46 · O jogo passa a chutar. Registro de metadados. */
(function(root){try{
  root.CDS_R1846_VOLUME=Object.freeze({version:'5.33.0-R18.46',
    label:'VOLUME DE FINALIZACAO DE JOGO ABERTO',
    minEscala:${ESC}, longRatio:${LONG_R}, normalRatio:${NORM_R},
    note:'Finalizacoes de jogo aberto eram 5,79/partida (2,9 por time) contra ~12 por time do futebol real; o motor substituia chute por cruzamento (low_cross+header = 55,6% das finalizacoes). Em _evaluateShotDecision o limiar minimum da faixa dtg<25 era .082 contra uma shotUtility de ~.074 que a propria curva distanceXg produz a 22 m — o chute era suprimido por construcao onde o futebol real chuta mais. maxRange, longPermission e distanceXg NAO foram tocados, entao a trava contra chute irracional do meio-campo (INT-03) segue intacta.',
    maxRangeTocado:false, longPermissionTocado:false, curvaXgTocada:false,
    rngUsed:false, teleport:false});
  root.CDS_BUILD_ID='R18.46'; root.CDS_VERSION='5.33.0-R18.46';
  if(root.document) root.document.title='Copa dos Sonhos — R18.46';
}catch(_){}})(typeof window!=='undefined'?window:globalThis);
</script>
</body></html>`;
if (src.split('</body></html>').length - 1 !== 1) { console.error('ABORTA: ancora </body></html> nao unica'); process.exit(1); }
src = src.replace('</body></html>', META);

const dest = a('out', 'r1846.html');
fs.writeFileSync(dest, src, 'utf8');
console.log(path.basename(dest), '|', applied.join(', '), '| minEscala', ESC, '| longRatio', LONG_R,
  '|', crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex').slice(0, 12));
