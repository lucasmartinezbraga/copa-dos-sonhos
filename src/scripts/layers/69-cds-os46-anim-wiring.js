
(function(root){
'use strict';
var M=root.MatchSim;if(!M||!M.prototype||M.prototype.__CDS_OS46__)return;
var A=root.CDS_ANIM;if(!A||typeof A.create!=='function')return;
var P=M.prototype;try{Object.defineProperty(P,'__CDS_OS46__',{value:true});}catch(_){P.__CDS_OS46__=true;}

/* mesma identidade da ponte R14 (:20077): time + referencia */
function idOf(p){return p?((p.team!=null?p.team:'?')+':'+((p.ref&&(p.ref.id||p.ref.n))||p.id||p.idx)):null;}

var MOVE={
  'arrancada':'burst_touch',
  'elástico':'body_feint',
  'elastico':'body_feint',
  'caneta':'body_feint',
  'drible da vaca':'turn_dribble',
  'meia-lua':'turn_dribble',      /* OS-47 · a meia-lua E a roleta de 360 */
  'corta pra dentro':'inside_cut'
};

var dbg={pedidos:0,porEstado:Object.create(null)};

function pede(sim,p,estado){
  try{
    if(!p||!estado)return;
    if(!sim.__anim)sim.__anim=A.create();
    var c=sim.__anim.of(idOf(p));
    if(!c||typeof c.request!=='function')return;
    c.request(estado,Number(sim.t)||0,{force:true});
    dbg.pedidos++;dbg.porEstado[estado]=(dbg.porEstado[estado]||0)+1;
  }catch(_){}
}

/* A DEFESA e escolhida pela geometria, nao por sorteio: quanto o goleiro teve
   de se deslocar em y e a que altura a bola estava. */
function defesa(sim,gk,data){
  try{
    var b=sim.ball;
    var z=Number(b&&b.z)||0;
    var dy=Math.abs((Number(gk.y)||0)-(Number(b&&b.y)||0));
    var k=(data&&data.kind)||'';
    if(k==='catch'||k==='double_catch'){ return dy>1.9?(z>1.25?'gk_high_dive':'gk_low_dive'):'gk_catch'; }
    if(dy>1.9) return z>1.25?'gk_high_dive':'gk_low_dive';
    if(z<0.45) return 'gk_foot_save';
    return 'gk_parry';
  }catch(_){return 'gk_parry';}
}

/* O VOO tem de ser pedido quando o chute COMECA a viajar. No instante em que
   o evento save e emitido, o goleiro ja foi levado ao ponto de interceptacao,
   entao o afastamento lateral e zero e nenhum mergulho e escolhido — medido:
   com o gatilho no evento save, gk_low_dive e gk_high_dive ficaram em 0%. O
   voo sai agora de _startTravel com meta.outcome==='save', que carrega o alvo
   de interceptacao e acontece com o goleiro ainda parado. */
var oldST=P._startTravel;
if(typeof oldST==='function'){
  P._startTravel=function(o,target,kind,cb,receiver,style,meta){
    try{
      if(meta&&target){
        var ator=meta.actor;
        if(meta.outcome==='save'&&ator&&ator.isGK){
          var dy=Math.abs((Number(ator.y)||0)-(Number(target.y)||0));
          var tz=Number(target.z);if(!isFinite(tz))tz=Number(this.ball&&this.ball.z)||0;
          /* MEDIDO: com o corte em 1,1 m o voo saiu em 0,01% — o goleiro da
             OS-19 fica bem posicionado e quase nunca precisa de mais de 1 m.
             Defesa com QUALQUER componente lateral e voo; palma seca fica so
             para bola em cima dele. */
          var est = dy>0.55 ? (tz>1.15?'gk_high_dive':'gk_low_dive')
                  : (tz<0.5?'gk_foot_save':'gk_parry');
          pede(this,ator,est);
        } else if(meta.outcome==='block'&&ator){ pede(this,ator,'block'); }
      }
      /* CHUTE: o contrato de acao da R14 cobre pouco (shot_ em 0,02% do
         tempo contra 18 chutes por partida). Todo voo de chute pede a pose. */
      if(kind==='shot'&&o&&!(meta&&meta.actor===o)
         && !(o.__os59Head && (Number(this.t)||0) < o.__os59Head)){ pede(this,o,'shot_prepare'); }
    }catch(_){}
    return oldST.apply(this,arguments);
  };
}

var oldEmit=P._emit;
P._emit=function(type,data){
  var r=oldEmit.apply(this,arguments);
  try{
    if(data){
      if(type==='save'&&data.gk){ pede(this,data.gk,defesa(this,data.gk,data)); }
      else if(type==='gk_sweep'&&data.gk){ pede(this,data.gk,'gk_smother'); }
      else if(type==='dribble'&&data.by){
        pede(this,data.by,(data.move&&MOVE[String(data.move).toLowerCase()])||'dribble_prepare');
      }
      else if((type==='header_shot'||type==='header_clear')&&data.by){
        pede(this,data.by,'header');
        /* OS-59 · marca quem cabeceou: o voo de chute que vem logo a seguir
           pediria shot_prepare e atropelaria esta pose. Medido: header_shot
           ficava em 0% de cobertura, com shot_prepare no lugar em 12 de 12. */
        try{ data.by.__os59Head=(Number(this.t)||0)+0.6; }catch(_){}
      }
      else if(type==='blocked'&&data.by){ pede(this,data.by,'block'); }
      else if(type==='intercept'&&data.by){ pede(this,data.by,'intercept'); }
      else if(type==='tackle_missed'&&data.by){ pede(this,data.by,'slide_tackle'); }
      else if(type==='bad_pass'&&data.by){ pede(this,data.by,'lose_control'); }
      else if(type==='miscontrol_out'&&data.by){ pede(this,data.by,'heavy_touch'); }
    }
  }catch(_){}
  return r;
};

P.getOS46Audit=function(){
  return {pedidos:dbg.pedidos,porEstado:JSON.parse(JSON.stringify(dbg.porEstado))};
};
root.CDS_OS46=Object.freeze({version:'OS-46',feature:'ANIM_EVENT_WIRING',
  presentationOnly:true,engineMutation:false,rngConsumption:false});
})(typeof window!=='undefined'?window:globalThis);
