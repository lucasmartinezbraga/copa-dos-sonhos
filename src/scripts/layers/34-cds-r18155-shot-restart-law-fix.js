
/* R18.15.5 · LEI DO REINÍCIO APÓS FINALIZAÇÃO
   Corrige o vínculo residual entre cruzamento e reinício. A camada transacional
   R12 mantém `__r122CrossWindow` por alguns segundos para reconhecer cruzamentos
   desviados. Quando o cruzamento virava chute, essa janela continuava aberta;
   um chute claramente para fora chamava `_goalKickOrRestart`, mas podia ser
   convertido aleatoriamente em escanteio como se o cruzamento ainda estivesse
   ativo.

   Regra autoritativa:
   - ao nascer uma finalização, encerra-se o contexto de cruzamento;
   - chute para fora, por cima ou na trave sem toque defensivo = tiro de meta;
   - bloqueio de defensor ou defesa do goleiro que sai = escanteio;
   - a correção não altera chance de gol, precisão, trajetória ou duelos. */
(function(root){
  'use strict';
  var M=root&&root.MatchSim;if(!M||!M.prototype)return;
  var P=M.prototype;if(P.__r18155ShotRestartLaw)return;
  P.__r18155ShotRestartLaw=true;
  var oldEmit=P._emit;
  P._emit=function(type,data){
    if(type==='shot_taken'||type==='header_shot'||type==='low_cross_shot'||
       type==='penalty'||(type==='freekick'&&data&&data.direct)){
      this.__r122CrossWindow=null;
    }
    if(type==='miss'||type==='post'||type==='goal'||type==='save'){
      /* Defesa e bloqueio possuem caminhos próprios de escanteio. Os eventos
         terminais abaixo jamais devem herdar um cruzamento antigo. */
      this.__r122CrossWindow=null;
    }
    return oldEmit.apply(this,arguments);
  };
  root.CDS_R18155_RESTART_LAW=Object.freeze({
    version:'R18.15.5',
    directShotMiss:'GOAL_KICK',
    untouchedPostOut:'GOAL_KICK',
    defenderBlockOut:'CORNER',
    keeperDeflectionOut:'CORNER',
    clearsStaleCrossWindow:true
  });
})(typeof window!=='undefined'?window:globalThis);
