#!/usr/bin/env node
'use strict';
/*
 * OS-39 · O BLOQUEIO ONDE A BOLA VOA
 * -----------------------------------
 * Substitui a OS-38, que errou o LUGAR.
 *
 * A OS-38 pos o bloqueio geometrico antes da particao de `_shoot` (:6194). O
 * censo de execucao mostrou que aquele ponto quase nao e visitado:
 *
 *     chutes contados em stats           20,40 /partida
 *     chegam ao ponto da OS-38            4,20   = 21%
 *     com defensor a <= 2,8 m da linha    1,70
 *     evento blocked                      0,90
 *
 * Os outros 79% resolvem em caminhos proprios: `header_shot` (6,3/partida),
 * `low_cross_shot` (4,3), bola parada, e o ramo em que o goleiro nao alcanca.
 * Mexer na particao alcanca um quinto do jogo.
 *
 * O LUGAR CERTO e onde a bola voa. Todo chute, de qualquer origem, vira um
 * `_startTravel(..., 'shot', ...)`. "Tem alguem na frente?" e uma pergunta
 * fisica, e o voo e onde a fisica existe. Esta camada envolve `_startTravel` e,
 * para voos de chute, procura o defensor mais proximo do SEGMENTO bola->alvo:
 *
 *     pBlock = clamp(BASE - ld*QUEDA, .08, BASE)
 *       ld = 0,0 m -> 0,90     ld = 1,0 m -> 0,62
 *       ld = 2,0 m -> 0,34     ld = 2,8 m -> 0,12
 *
 * Quando bloqueia, o voo e REDIRECIONADO ao ponto de contato com o mesmo
 * desfecho fisico que o motor ja usa: `_physicalContactValid`,
 * `_recordVisualContact`, evento `blocked`, e escanteio por
 * `CAL.restarts.shotBlockCorner`. O escanteio nasce de contato defensivo
 * provado, entao passa pelas camadas R18.18.2/18.3 em vez de virar
 * `unprovenCornerCall`.
 *
 * NAO intercepta:
 *   - voos que ja sao bloqueio ou defesa (`meta.outcome` block/save) — o motor
 *     ja decidiu quem toca na bola, e trocar o agente quebraria a contabilidade;
 *   - voos com `meta.actor` (ha um agente marcado para o contato);
 *   - reentrada (guarda `__os39In`), para o redirecionamento nao se interceptar.
 *
 * Intercepta de proposito os voos de GOL e de ERRO: um defensor na linha
 * bloqueia o chute que ia entrar — e exatamente por isso os gols devem cair.
 * Tambem alcanca a cobranca direta de falta, onde a barreira da OS-36 esta
 * plantada na linha: e a barreira funcionando como barreira.
 *
 * Sem alteracao de xG, de velocidade ou de decisao. Consome uma rolagem nova
 * por chute, entao a bateria diverge por caos.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR (base R18.65, 40 partidas):
 *   - evento `blocked`: 0,83 -> faixa de 3 a 5 por partida.
 *   - escanteios 3,13: SOBEM. E a previsao que decide a rodada.
 *   - gols 3,00: DESCEM.
 *   - xG 2,56: DESCE ou fica igual; ECO-02 (<= 2,7) nao pode estourar.
 *   - RECUSA se `blocked` passar de ~35% dos chutes (alcance largo demais) ou
 *     se os gols cairem abaixo de 2,0 (o jogo esvazia).
 *
 * ARMADILHA: se a camada interceptar o voo que o proprio bloqueio cria, ela
 * entra em recursao e o lance trava. Por isso a guarda de reentrada, e por
 * isso o voo novo carrega `meta.outcome='block'`, que a propria camada recusa.
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
const alcance = arg('alcance', '2.8');
const base = arg('base', '0.90');
const queda = arg('queda', '0.28');
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

const LAYER = `<script id="cds-os39-block-on-flight">
(function(root){
'use strict';
var M=root.MatchSim;if(!M||!M.prototype||M.prototype.__CDS_OS39__)return;
var P=M.prototype;try{Object.defineProperty(P,'__CDS_OS39__',{value:true});}catch(_){P.__CDS_OS39__=true;}
var ALC=${alcance}, BASE=${base}, QUEDA=${queda};
/* CAL nao e global: fica no escopo do modulo do motor. 0.66 e o valor de
   CAL.restarts.shotBlockCorner em :2780. */
var CORNER_SHARE=(root.CAL&&root.CAL.restarts&&root.CAL.restarts.shotBlockCorner)||0.66;
var oldST=P._startTravel;
if(typeof oldST!=='function')return;

function cl(v,a,b){return v<a?a:(v>b?b:v);}

P._startTravel=function(o,target,kind,cb,receiver,style,meta){
  try{
    if(kind==='shot'&&o&&target&&!this.__os39In){
      var out=meta&&meta.outcome;
      if(out!=='block'&&out!=='save'&&!(meta&&meta.actor)){
        var b=this.ball, sx=b?b.x:o.x, sy=b?b.y:o.y;
        var tx=target.x, ty=target.y;
        var dx=tx-sx, dy=ty-sy, L2=dx*dx+dy*dy;
        if(L2>4){
          var def=this.teams[1-o.team].players, best=null, bl=99, bp=null;
          for(var i=0;i<def.length;i++){
            var d=def[i]; if(!d||d.red||d.isGK)continue;
            var t=((d.x-sx)*dx+(d.y-sy)*dy)/L2;
            if(t<.12||t>.88)continue;
            var px=sx+dx*t, py=sy+dy*t, ld=Math.hypot(d.x-px,d.y-py);
            if(ld<bl){bl=ld;best=d;bp={x:px,y:py};}
          }
          if(best&&bl<=ALC&&root.chance(cl(BASE-bl*QUEDA,.08,BASE))){
            var sim=this, blocker=best;
            this.__os39In=true;
            try{
              return oldST.call(this,o,bp,'shot',function(){
                var cv=sim._physicalContactValid(blocker,2.05,sim.ball.z);
                if(!cv.ok){
                  if(sim.visualIntegrity)sim.visualIntegrity.failedContacts++;
                  sim._emit('visual_contact_failed',{kind:'block',by:blocker,distance:cv.horizontal});
                  sim._looseBall(sim.ball.x,sim.ball.y);
                  return;
                }
                sim._recordVisualContact('block',blocker,sim.ball.x,sim.ball.y,
                  {distance:cv.horizontal,z:sim.ball.z,maxZ:cv.maxZ,surface:cv.surface});
                sim._emit('blocked',{by:blocker,contact:{x:sim.ball.x,y:sim.ball.y,distance:cv.horizontal}});
                if(root.chance(CORNER_SHARE))sim._setCorner(o.team);
                else sim._looseBall(sim.ball.x,sim.ball.y);
              },null,'shot',{outcome:'block',actor:blocker,contactRadius:2.05});
            }finally{this.__os39In=false;}
          }
        }
      }
    }
  }catch(_){}
  return oldST.apply(this,arguments);
};
root.CDS_OS39=Object.freeze({version:'OS-39',feature:'BLOCK_ON_FLIGHT',alcance:ALC});
})(typeof window!=='undefined'?window:globalThis);
</script>
</body></html>`;

edit('os39-block-on-flight', `</body></html>`, LAYER);

fs.writeFileSync(output, src, 'utf8');
const sha = crypto.createHash('sha256').update(src).digest('hex');
console.log('patches:', applied.join(', '), '| alcance=' + alcance, 'base=' + base, 'queda=' + queda);
console.log(path.basename(output), '| sha256', sha);
