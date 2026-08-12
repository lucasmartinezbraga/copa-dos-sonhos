
/* Copa dos Sonhos · R18.5 · BLOCO DEFENSIVO CONECTADO
   Corrige o salto isolado de volantes/meias (especialmente em linhas de dois)
   e aproxima a marcação goal-side sem alterar decisões ofensivas ou física. */
(function installR185(root){
  'use strict';
  const M=root&&root.MatchSim;
  if(!M||!M.prototype||M.prototype.__CDS_R185__)return;
  const P=M.prototype;
  P.__CDS_R185__=true;
  const VERSION='5.9.4-R18.5';
  const FL=105,FW=68;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const finite=(v,d=0)=>Number.isFinite(v)?v:d;
  const dist=(a,b)=>a&&b?Math.hypot(finite(a.x)-finite(b.x),finite(a.y)-finite(b.y)):999;
  function lineOf(p){const pos=p&&(p.oopPos||p.slotPos);if(!p||p.isGK||pos==='GK')return'GK';if(['CB','LB','RB','LWB','RWB'].includes(pos))return'DEF';if(['CDM','DM','CM','CAM','LM','RM'].includes(pos))return'MID';return'FWD';}
  function ownProg(tm,x){return tm&&tm.goal&&tm.goal.x<FL/2?x:FL-x;}
  function fromProg(tm,x){return tm&&tm.goal&&tm.goal.x<FL/2?x:FL-x;}
  const oldDef=P._defendTarget;
  P._defendTarget=function(tm,p,b,presser){
    let out=oldDef.apply(this,arguments);
    if(!out||!tm||!p||p.red||p.isGK)return out;
    const L=lineOf(p),line=finite(tm._r13LineDepth,ownProg(tm,p.x));
    let px=ownProg(tm,finite(out[0],p.x)),py=finite(out[1],p.y);
    if(L==='DEF'){
      /* A última linha trabalha como uma unidade. Marcação individual pode
         escalonar, mas não arrastar um zagueiro para fora do trilho coletivo. */
      px=clamp(px,line-2.45,line+2.45);
      if(p._markRef&&!p._markRef.red){
        const ap=ownProg(tm,p._markRef.x);
        px=Math.min(px,ap-1.15); // sempre goal-side
        py=clamp(p._markRef.y,2,FW-2);
      }
    }else if(L==='MID'){
      const isPresser=p===presser;
      /* O presser pode saltar, mas não abandonar completamente o bloco. Em
         meio-campo de dois, sem este teto a mediana vira um buraco de 20–35 m. */
      const maxAhead=line+(isPresser?15.2:10.8);
      const minDepth=line-1.8;
      px=clamp(px,minDepth,maxAhead);
      if(p._markRef&&!p._markRef.red){
        const ap=ownProg(tm,p._markRef.x);
        px=Math.min(px,ap-1.05);
        /* Fecha lateralmente a referência sem atravessar o corredor inteiro. */
        py=clamp(p._markRef.y,2,FW-2);
      }
    }
    /* D20 · NAO ponha teto de profundidade para o FWD aqui. Eu pus, e ele e
       morto: a camada 60 (R18.43) roda DEPOIS e aplica um PISO de 32 m ao
       atacante defendendo, entao qualquer teto daqui e reescrito para cima.
       Medido pela sonda tools/fisica/ramo-d20.js: com o teto em linha+18,
       22,9% dos alvos de FWD ainda voltavam acima de linha+30.
       O dono do comprimento do bloco e a camada 60. */
    return[fromProg(tm,clamp(px,1,FL-1)),clamp(py,1,FW-1)];
  };
  const oldIntegrate=P._integrate;
  P._integrate=function(p,tx,ty,dt,freeze){
    const marked=p&&p._markRef&&!p._markRef.red;
    const saved=p&&p._breaking;
    /* Recuperação de cobertura entra em sprint um pouco antes. O teto físico
       continua sendo maxSpd/acc do próprio atleta. */
    if(marked&&dist(p,p._markRef)>2.55)p._breaking=saved||{r185Coverage:true};
    try{return oldIntegrate.apply(this,arguments);}finally{if(marked)p._breaking=saved;}
  };
  const oldFull=P.getFullFootballAudit;
  P.getFullFootballAudit=function(){const r=oldFull?oldFull.apply(this,arguments):{};r.version=VERSION;return r;};
  try{root.CDS_BUILD_ID='R18.5';root.CDS_VERSION=VERSION;document.title='Copa dos Sonhos — R18.5';}catch(_){ }
  root.CDS_R185=Object.freeze({version:VERSION,connectedBlock:true,goalSideRecovery:true});
})(typeof window!=='undefined'?window:globalThis);

