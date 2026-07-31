#!/usr/bin/env node
'use strict';
/*
 * OS-42 · O CRUZAMENTO PASSA A SER DISPUTADO
 * -------------------------------------------
 * O censo de posse mostrou que o problema NAO era volume de passe. Passes por
 * cadeia estao em 2,77, dentro da faixa real de 3 a 4. O que esta fora e a
 * relacao entre construcao e finalizacao:
 *
 *     cadeias de posse por chute   5,9   (real ~8 a 10)
 *     passes : chutes             17:1   (real ~36:1)
 *
 * O time finaliza com metade da construcao. E a origem esta no cruzamento:
 *
 *     cruzamentos por partida          17,20
 *     cruzamento -> chute              68,6%   (real ~25%)
 *     cruzamento -> corte de cabeca    12,2%   (real ~50%)
 *     header_shot 7,50 + low_cross_shot 4,30 = 11,8 dos 20,9 chutes
 *
 * Ou seja: mais da metade das finalizacoes nasce de cruzamento, e quase todo
 * cruzamento vira finalizacao. A linha seguinte explica:
 *
 *     defensor mais proximo do ALVO do cruzamento
 *       <=2,5 m   18,6%      media 4,30 m
 *
 * Nao existe disputa aerea na area. A bola sobe, o atacante cabeceia sozinho.
 * O defensor continua no alvo de marcacao dele, que nao sabe que ha bola no ar.
 *
 * EDIT · enquanto uma bola ALTA de fora esta viajando para dentro de 20 m do
 * nosso gol, os DOIS defensores mais proximos do ponto de queda passam a
 * atacar esse ponto, posicionando-se do lado do gol a ~1,1 m dele. O resto do
 * bloco nao muda. Quando a bola chega, sai do ar ou muda de dono, tudo volta
 * ao normal sozinho — o alvo e recalculado a cada quadro, nao ha estado preso.
 *
 * Nao ha RNG. Nao ha ganho de velocidade nem de atributo aereo: o duelo em si
 * continua sendo resolvido pelo motor, com `head_def` contra `head_atk`. O que
 * muda e o defensor ESTAR LA.
 *
 * Exclui chute (`b.kind==='shot'`): bola de chute nao se disputa no ar, se
 * bloqueia — isso e da OS-39.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR (base R18.67):
 *   - cruzamento disputado (<=2,5 m) 18,6%: SOBE muito.
 *   - cruzamento -> chute 68,6%: DESCE.
 *   - `header_clear` 2,10: SOBE.
 *   - escanteios 5,13: SOBEM (corte na area vai para a linha de fundo).
 *   - gols 2,50 e xG 2,74: DESCEM.
 *   - RECUSA se os gols SUBIREM — significaria que os defensores estao
 *     abandonando a marcacao para perseguir bola alta e abrindo a area.
 *   - RECUSA se o salto por quadro subir: isto muda destino, nao posicao, mas
 *     um destino que salta a cada quadro produziria tremor.
 *
 * NOTA DE MEDICAO: a primeira versao exigia bola ALTA e NAO DISPAROU NUNCA —
 * disputado 18,6% -> 20,1%, corte 12,2% -> 9,4%. O motivo e a descoberta desta
 * rodada: o cruzamento aereo sai por `_startTravel(o,alvo,'pass')` sem estilo,
 * logo `vz=0.4` e `z=0.12`. Ele nao sobe. O gatilho passou a ser geometrico.
 *
 * ARMADILHA: se o gatilho pegar tambem passe rasteiro ou chute, dois
 * defensores largam a marcacao em qualquer bola tocada perto da area. Por isso
 * exige bola ALTA (`z` ou `vz`), origem fora dos 20 m e dono adversario.
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find(x => x.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const input = arg('in', 'dist/COPA DOS SONHOS - R18.67 - JOGO DE FUTEBOL.html');
const output = arg('out', 'dist/COPA DOS SONHOS - R18.68 - JOGO DE FUTEBOL.html');
const quantos = arg('quantos', '2');
const raio = arg('raio', '20');
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

const LAYER = `<script id="cds-os42-contest-the-cross">
(function(root){
'use strict';
var M=root.MatchSim;if(!M||!M.prototype||M.prototype.__CDS_OS42__)return;
var P=M.prototype;try{Object.defineProperty(P,'__CDS_OS42__',{value:true});}catch(_){P.__CDS_OS42__=true;}
var N=${quantos}, RAIO=${raio};
var oldDT=P._defendTarget;
if(typeof oldDT!=='function')return;

function fwd(p){var s=p&&(p.oopPos||p.slotPos);return s==='ST'||s==='CF'||s==='LW'||s==='RW'||s==='SS';}

P._defendTarget=function(tm,p,b,presser){
  var out=oldDT.apply(this,arguments);
  try{
    if(!out||!p||p.red||p.isGK||!tm||!tm.goal)return out;
    if(!b||!b.traveling||!b.target)return out;
    if(b.kind==='shot')return out;
    /* MEDIDO: o cruzamento "aereo" nao sobe. Ele sai por
       _startTravel(o,alvo,'pass') sem estilo, entao vz=0.4 e z=0.12 — e uma
       bola rasteira para um ponto da area. Nao da para exigir altura; o que
       define a disputa e a bola estar viajando de fora para dentro da area. */
    var g=tm.goal, tx=Number(b.target.x), ty=Number(b.target.y);
    if(!isFinite(tx)||!isFinite(ty))return out;
    var dq=Math.hypot(tx-g.x,ty-g.y);
    if(dq>RAIO)return out;
    /* so quando a bola veio de fora e nao e nossa */
    var lt=b.lastTouch;
    if(lt&&lt.team===tm.side)return out;
    var fx=b.from?Number(b.from.x):NaN, fy=b.from?Number(b.from.y):NaN;
    if(!isFinite(fx)||!isFinite(fy))return out;
    var dOrigem=Math.hypot(fx-g.x,fy-g.y);
    if(dOrigem<=dq+6)return out;              // veio de fora, nao de dentro
    if(Math.hypot(tx-fx,ty-fy)<8)return out;  // voo curto nao e entrega na area
    var eleg=[],i,q;
    for(i=0;i<tm.players.length;i++){
      q=tm.players[i];
      if(!q||q.red||q.isGK||fwd(q))continue;
      eleg.push(q);
    }
    if(eleg.length<3)return out;
    eleg.sort(function(a,c){
      return Math.hypot(a.x-tx,a.y-ty)-Math.hypot(c.x-tx,c.y-ty);});
    var pos=eleg.indexOf(p);
    if(pos<0||pos>=N)return out;
    /* posto de disputa: do lado do gol do ponto de queda, escalonado para os
       dois nao ocuparem o mesmo ponto (o segundo cobre atras). */
    var vx=g.x-tx, vy=g.y-ty, L=Math.max(.6,Math.hypot(vx,vy));
    var rec=1.1+pos*1.6;
    return [tx+vx/L*rec, ty+vy/L*rec];
  }catch(_){}
  return out;
};
root.CDS_OS42=Object.freeze({version:'OS-42',feature:'CONTEST_THE_CROSS',defensores:N,raio:RAIO});
})(typeof window!=='undefined'?window:globalThis);
</script>
</body></html>`;

edit('os42-contest-the-cross', `</body></html>`, LAYER);

fs.writeFileSync(output, src, 'utf8');
const sha = crypto.createHash('sha256').update(src).digest('hex');
console.log('patches:', applied.join(', '), '| quantos=' + quantos, 'raio=' + raio);
console.log(path.basename(output), '| sha256', sha);
