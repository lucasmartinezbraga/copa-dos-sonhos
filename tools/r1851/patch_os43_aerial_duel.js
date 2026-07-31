#!/usr/bin/env node
'use strict';
/*
 * OS-43 · DUELO AEREO NA CHEGADA DO CRUZAMENTO
 * ---------------------------------------------
 * A OS-42 poe o defensor perto do ponto de queda — disputa a 2,5 m sobe de
 * 18,6% para 30,0%. E o desfecho NAO muda: `cruzamento -> chute` fica em 70%
 * contra ~25% reais, e `header_clear` nem sobe.
 *
 * O motivo esta na chegada. O cruzamento aereo termina em (R18.31):
 *
 *     _b.owner=null; _b.traveling=false; ... quem alcancar (1,7 m) fica com ela
 *
 * Ou seja, a entrega na area vira uma CORRIDA por bola solta. Nao existe duelo
 * aereo: `head_def` contra `head_atk` nao e consultado em lugar nenhum do
 * caminho do cruzamento. Ter o defensor a 2 m nao adianta se o criterio e so
 * quem chega primeiro.
 *
 * EDIT · mesmo padrao que resolveu a OS-39: envolver `_startTravel`. Para uma
 * entrega que vem de FORA para dentro de ${'${RAIO}'} m do gol defendido, na
 * chegada roda-se um duelo antes do desfecho original:
 *
 *   - acha o defensor mais proximo do ponto de queda e o atacante mais proximo;
 *   - se o defensor estiver a ate ${'${ALCANCE}'} m e nao estiver mais longe que o
 *     atacante + 1,2 m, ha duelo;
 *   - p(defensor) = 0,50 + (head_def - head_atk)/220 + vantagem de posicao,
 *     limitado entre 0,20 e 0,86;
 *   - vencendo, ele CORTA: evento `header_clear`, a bola sai em direcao
 *     contraria ao gol, e pela geometria pode virar escanteio como qualquer
 *     corte — a ecologia R18.18.2/18.3 decide, nao este patch;
 *   - perdendo, o desfecho original acontece igual.
 *
 * Nao ha bonus de atributo: `head_def` e `head_atk` ja existem e ja sao usados
 * em escanteio. O que faltava era serem consultados no cruzamento de jogo
 * corrido.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR (base R18.67 + OS-42):
 *   - `header_clear` 1,60: SOBE para a casa de 4 a 7.
 *   - `cruzamento -> chute` 70%: DESCE para a casa de 35 a 50%.
 *   - chutes 20,9: DESCEM.
 *   - gols 2,50 e xG 2,74: DESCEM.
 *   - escanteios 5,13: SOBEM ou ficam; nao podem cair abaixo de 4,0.
 *   - RECUSA se os chutes cairem abaixo de 14 (o jogo esvazia) ou se
 *     `cruzamento -> chute` cair abaixo de 20% (corte virou muralha).
 *
 * ARMADILHA: se o duelo rodar tambem no cruzamento de escanteio, ele duplica
 * a disputa que a rotina de escanteio ja faz. Por isso exige `from` fora dos
 * ${'${RAIO}'} m E voo de pelo menos 8 m E que a bola nao esteja em bola parada
 * (`this.dead > 0` ou `pendingRestart` armado a menos de meio segundo).
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find(x => x.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const input = arg('in', 'dist/COPA DOS SONHOS - R18.68 - JOGO DE FUTEBOL.html');
const output = arg('out', 'dist/COPA DOS SONHOS - R18.69 - JOGO DE FUTEBOL.html');
const RAIO = arg('raio', '20');
const ALCANCE = arg('alcance', '3.2');
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

const LAYER = `<script id="cds-os43-aerial-duel">
(function(root){
'use strict';
var M=root.MatchSim;if(!M||!M.prototype||M.prototype.__CDS_OS43__)return;
var P=M.prototype;try{Object.defineProperty(P,'__CDS_OS43__',{value:true});}catch(_){P.__CDS_OS43__=true;}
var RAIO=${RAIO}, ALC=${ALCANCE};
var oldST=P._startTravel;
if(typeof oldST!=='function')return;

function fwd(p){var s=p&&(p.oopPos||p.slotPos);return s==='ST'||s==='CF'||s==='LW'||s==='RW'||s==='SS';}
function cl(v,a,b){return v<a?a:(v>b?b:v);}
function fac(p,k){try{return root.facet?root.facet(p,k):55;}catch(_){return 55;}}

P._startTravel=function(o,target,kind,cb,receiver,style,meta){
  try{
    if(kind!=='shot'&&o&&target&&typeof cb==='function'&&!this.__os43In&&!(this.dead>0)){
      var def=this.teams[1-o.team], g=def&&def.goal;
      var b=this.ball;
      if(g&&b){
        var tx=Number(target.x), ty=Number(target.y);
        var fx=Number(b.x), fy=Number(b.y);
        if(isFinite(tx)&&isFinite(ty)&&isFinite(fx)&&isFinite(fy)){
          var dq=Math.hypot(tx-g.x,ty-g.y), dOr=Math.hypot(fx-g.x,fy-g.y);
          if(dq<=RAIO&&dOr>dq+6&&Math.hypot(tx-fx,ty-fy)>=8){
            var sim=this;
            var envolto=function(){
              try{
                var bb=sim.ball, px=Number(bb.x), py=Number(bb.y);
                if(!isFinite(px))return cb.apply(this,arguments);
                var melhorD=null,dd=1e9,i,q;
                for(i=0;i<def.players.length;i++){
                  q=def.players[i];
                  if(!q||q.red||q.isGK||fwd(q))continue;
                  var e=Math.hypot(q.x-px,q.y-py); if(e<dd){dd=e;melhorD=q;}
                }
                var atkT=sim.teams[o.team], melhorA=null,da=1e9;
                for(i=0;i<atkT.players.length;i++){
                  q=atkT.players[i];
                  if(!q||q.red||q.isGK)continue;
                  var e2=Math.hypot(q.x-px,q.y-py); if(e2<da){da=e2;melhorA=q;}
                }
                if(melhorD&&dd<=ALC&&dd<=da+1.2){
                  var pd=cl(.50+(fac(melhorD,'head_def')-(melhorA?fac(melhorA,'head_atk'):55))/220
                            +cl((da-dd)*.06,-.12,.12), .20, .86);
                  if(root.chance(pd)){
                    sim._emit('header_clear',{by:melhorD,kind:'cross_duel'});
                    var vx=px-g.x, vy=py-g.y, L=Math.max(.6,Math.hypot(vx,vy));
                    var ax=px+vx/L*16+(root.R?root.R(-6,6):0), ay=py+vy/L*7+(root.R?root.R(-9,9):0);
                    sim.__os43In=true;
                    try{ sim._deflectTo(cl(ax,-3,(root.FL||105)+3), cl(ay,-3,(root.FW||68)+3), 15); }
                    finally{ sim.__os43In=false; }
                    return;
                  }
                }
              }catch(_){}
              return cb.apply(this,arguments);
            };
            return oldST.call(this,o,target,kind,envolto,receiver,style,meta);
          }
        }
      }
    }
  }catch(_){}
  return oldST.apply(this,arguments);
};
root.CDS_OS43=Object.freeze({version:'OS-43',feature:'AERIAL_DUEL_ON_CROSS',raio:RAIO,alcance:ALC});
})(typeof window!=='undefined'?window:globalThis);
</script>
</body></html>`;

edit('os43-aerial-duel', `</body></html>`, LAYER);

fs.writeFileSync(output, src, 'utf8');
const sha = crypto.createHash('sha256').update(src).digest('hex');
console.log('patches:', applied.join(', '), '| raio=' + RAIO, 'alcance=' + ALCANCE);
console.log(path.basename(output), '| sha256', sha);
