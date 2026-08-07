
/* R18.17.3 · RESPONSABILIDADE DEFENSIVA — UM BOTE, UMA COBERTURA
   -------------------------------------------------------------------------
   Corrige o afunilamento coletivo em torno da bola sem reduzir a intensidade:
   - somente um jogador pressiona diretamente o portador;
   - o antigo segundo marcador do portador volta a proteger zona/opção de passe;
   - um jogador cobre as costas do pressionador, sem atacar a bola;
   - um jogador pode sombrear a linha de passe mais perigosa;
   - os demais preservam corredor, linha e referência individual;
   - remove o segundo deslocamento lateral global que duplicava a basculação;
   - sem RNG, teletransporte ou bônus de velocidade/desarme. */
(function(root){
'use strict';
const M=root&&root.MatchSim;if(!M||!M.prototype||M.prototype.__CDS_R18173__)return;
const P=M.prototype,V='5.12.4-R18.17.3-RESPONSABILIDADE-DEFENSIVA';
Object.defineProperty(P,'__CDS_R18173__',{value:true});
const FL=Number(root.FL)||105,FW=Number(root.FW)||68;
const finite=(v,d=0)=>Number.isFinite(v)?v:d;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const dist=(a,b)=>Math.hypot(finite(a&&a.x)-finite(b&&b.x),finite(a&&a.y)-finite(b&&b.y));
const ownProg=(tm,x)=>tm.attackDir>0?finite(x):FL-finite(x);
const fromOwnProg=(tm,x)=>tm.attackDir>0?x:FL-x;
const line=p=>{const s=p&&(p.oopPos||p.slotPos);if(!p||p.isGK||s==='GK')return'GK';if(['CB','LB','RB','LWB','RWB'].includes(s))return'DEF';if(['CDM','CM','CAM','LM','RM'].includes(s))return'MID';return'FWD';};
const fresh=()=>({version:'R18.17.3',samples:0,within4Sum:0,within6Sum:0,within9Sum:0,swarm3Within6:0,severe4Within9:0,maxWithin4:0,maxWithin6:0,maxWithin9:0,ownerMarkersSuppressed:0,ownerMarkersConverted:0,redundantCoversReleased:0,unreachableMarksConverted:0,screensAssigned:0,zoneCorrections:0,laneCorrections:0,coverCorrections:0,shadowCorrections:0,markCorrections:0});
function stats(sim){return sim.__r18173||(sim.__r18173=fresh());}
function homeX(p){return finite(p&&p.dhx,finite(p&&p.hx,FL/2));}
function homeY(p){return finite(p&&p.dhy,finite(p&&p.hy,FW/2));}
function outsideBall(tm,p,b,tx,ty,minRadius,anchorX,anchorY){
  let dx=tx-finite(b.x),dy=ty-finite(b.y),d=Math.hypot(dx,dy);
  if(d>=minRadius)return[tx,ty,false];
  dx=finite(anchorX)-finite(b.x);dy=finite(anchorY)-finite(b.y);d=Math.hypot(dx,dy);
  if(d<.1){dx=finite(tm.goal&&tm.goal.x)-finite(b.x);dy=finite(tm.goal&&tm.goal.y)-finite(b.y);d=Math.hypot(dx,dy);}
  if(d<.1){dx=tm.attackDir>0?-1:1;dy=0;d=1;}
  return[clamp(finite(b.x)+dx/d*minRadius,1,FL-1),clamp(finite(b.y)+dy/d*minRadius,2,FW-2),true];
}
/* Para quem segura zona/marcação, afasta do funil prioritariamente no eixo
   lateral. Assim não corrige o enxame criando um buraco entre meio e zaga. */
function outsideBallLateral(b,tx,ty,minRadius,anchorY){
  const dx=tx-finite(b.x),dy=ty-finite(b.y),d=Math.hypot(dx,dy);
  if(d>=minRadius)return[tx,ty,false];
  const room=Math.sqrt(Math.max(0,minRadius*minRadius-dx*dx));
  let sign=Math.sign(finite(anchorY,FW/2)-finite(b.y));
  if(!sign)sign=Math.sign(dy)||1;
  return[tx,clamp(finite(b.y)+sign*Math.max(room,Math.abs(dy)),2,FW-2),true];
}
const oldReset=P.reset;
P.reset=function(){const r=oldReset.apply(this,arguments);this.__r18173=fresh();this.__r18173NextSample=0;return r;};

/* O R13 inclui o portador na lista de ameaças. Isso era correto para cobertura,
   mas incorreto para atribuição individual: presser + marcador do portador +
   cobertura podiam criar três jogadores com o mesmo destino. */
const oldSelect=P._selectPresser;
P._selectPresser=function(tm,b){
  let picked=oldSelect.apply(this,arguments);if(!picked||line(picked)!=='DEF')return picked;
  const danger=dist(b&&b.owner?b.owner:b,tm.goal);
  if(danger<=24)return picked; // emergência real: zagueiro pode saltar
  const pool=(tm.players||[]).filter(p=>p&&!p.red&&!p.isGK&&line(p)!=='DEF')
    .sort((a,c)=>dist(a,b)-dist(c,b));
  const alt=pool[0];
  if(alt&&dist(alt,b)<=dist(picked,b)+5.5){tm._presser=alt;picked=alt;}
  return picked;
};

const oldAssign=P._assignDefRoles;
P._assignDefRoles=function(tm,b,presser){
  const r=oldAssign.apply(this,arguments),s=stats(this);
  const owner=b&&b.owner&&b.owner.team!==tm.side?b.owner:null;
  const pressActive=!!(owner&&presser&&!presser.red&&dist(presser,owner)<=10.5);
  let ownerMarker=null;const screenPool=[];
  for(const p of tm.players||[]){
    if(!p||p.red||p.isGK)continue;
    p._r18173OwnerCover=false;p._r18173DemotedCover=false;p._r18173ScreenTgt=null;
    if(p._markRef&&!p._markRef.red){
      const target=p._markRef,L=line(p),reach=L==='DEF'?24:L==='MID'?22:16;
      if(dist(p,target)>reach){
        const danger=dist(target,tm.goal),lane=Math.abs(finite(target.y,FW/2)-finite(b.y,FW/2));
        screenPool.push({p,target,score:danger*.55+lane*.18+dist(p,target)*.08});
        p._markRef=null;p._r13MarkTarget=null;s.unreachableMarksConverted++;
      }
    }
    if(pressActive&&p!==presser&&p._markRef===owner&&!ownerMarker)ownerMarker=p;
  }
  /* Só um jogador bloqueia a linha de passe prioritária. Criar um screen para
     cada referência distante apenas trocaria perseguição impossível por outro
     tipo de enxame. */
  if(screenPool.length){
    screenPool.sort((a,c)=>a.score-c.score);
    for(var _i=0;_i<Math.min(3,screenPool.length);_i++){var chosen=screenPool[_i];chosen.p._r18173ScreenTgt=chosen.target;s.screensAssigned++;}
    if(tm._shadow&&tm._shadow!==chosen.p){tm._shadow=null;tm._shadowTgt=null;}
  }
  /* O marcador individual do portador não é apagado: ele assume a COBERTURA.
     O cobridor redundante volta à zona. Assim o portador continua protegido
     goal-side para o observer, mas só existe um bote e uma única sobra. */
  if(ownerMarker){
    const redundant=tm._cover;
    tm._cover=ownerMarker;ownerMarker._r18173OwnerCover=true;
    s.ownerMarkersConverted++;s.ownerMarkersSuppressed++;
    if(redundant&&redundant!==ownerMarker){redundant._r18173DemotedCover=true;s.redundantCoversReleased++;}
  }
  /* O núcleo já bascula cada linha em _defendTarget. O _movePlayers aplicava
     novamente 12–26% do deslocamento lateral da bola a todos. Mantemos apenas
     microajuste por função, para o bloco respirar sem se transformar em funil. */
  for(const p of tm.players||[]){
    if(!p||p.red||p.isGK)continue;
    let duty='zone',slide=.008;
    if(p===presser){duty='press';slide=0;}
    else if(p===tm._cover){duty='cover';slide=.010;p._react=Math.min(finite(p._react,p.react||.16),.060);}
    else if(p===tm._shadow){duty='shadow';slide=.008;p._react=Math.min(finite(p._react,p.react||.16),.070);}
    else if(p._markRef){duty='mark';slide=.012;p._react=Math.min(finite(p._react,p.react||.16),.065);}
    else if(p._r18173ScreenTgt){duty='screen';slide=.008;p._react=Math.min(finite(p._react,p.react||.16),.075);}
    p._r18173Duty=duty;p._slideF=slide;
  }
  return r;
};

const oldDefend=P._defendTarget;
P._defendTarget=function(tm,p,b,presser){
  const base=oldDefend.apply(this,arguments);if(!base||!p||p.red||p.isGK||p===presser)return base;
  let tx=finite(base[0],p.x),ty=finite(base[1],p.y);
  const s=stats(this),L=line(p),hx=homeX(p),hy=homeY(p);
  const duty=p._r18173Duty||(p===tm._cover?'cover':p===tm._shadow?'shadow':p._markRef?'mark':'zone');
  if(duty==='cover'){
    /* Cobertura protege profundidade, não vira segundo bote. */
    const r=outsideBall(tm,p,b,tx,ty,6.6,tm.goal&&tm.goal.x,tm.goal&&tm.goal.y);
    tx=r[0];ty=r[1];if(r[2]){s.coverCorrections++;s.zoneCorrections++;}
    const d=Math.hypot(tx-finite(b.x),ty-finite(b.y));
    if(d>9.4){const vx=tx-finite(b.x),vy=ty-finite(b.y),q=Math.max(.1,d);tx=finite(b.x)+vx/q*9.4;ty=finite(b.y)+vy/q*9.4;s.coverCorrections++;}
  }else if(duty==='shadow'){
    /* Sombra fecha a linha de passe a uma distância funcional. */
    const r=outsideBallLateral(b,tx,ty,5.9,hy);tx=r[0];ty=r[1];if(r[2]){s.shadowCorrections++;s.zoneCorrections++;}
  }else if(duty==='mark'){
    /* Marca o homem, mas não entra no mesmo ponto do pressionador. */
    const r=outsideBallLateral(b,tx,ty,4.4,hy);tx=r[0];ty=r[1];if(r[2]){s.markCorrections++;s.zoneCorrections++;}
  }else if(duty==='screen'&&p._r18173ScreenTgt&&!p._r18173ScreenTgt.red){
    /* Referência distante: não atravessa o campo atrás do homem. Fecha a linha
       bola→ameaça e permanece alcançável pela sua própria zona. */
    const a=p._r18173ScreenTgt;
    tx=clamp(lerp(finite(b.x),finite(a.x),.62),1,FL-1);
    ty=clamp(lerp(finite(b.y),finite(a.y),.62),2,FW-2);
    const maxY=L==='DEF'?8.0:L==='MID'?10.0:11.0;
    ty=clamp(ty,hy-maxY,hy+maxY);
    const r=outsideBallLateral(b,tx,ty,6.4,hy);tx=r[0];ty=r[1];if(r[2]){s.shadowCorrections++;s.zoneCorrections++;}
  }else{
    /* Sem responsabilidade direta: preservar o corredor e ocupar o passe de
       saída. Essa é a diferença entre bascular e correr todo mundo na bola. */
    const keep=L==='DEF'?.30:L==='MID'?.23:.17;
    ty=lerp(ty,hy,keep);
    const maxDrift=L==='DEF'?7.2:L==='MID'?9.2:10.5;
    const before=ty;ty=clamp(ty,hy-maxDrift,hy+maxDrift);if(Math.abs(before-ty)>.01)s.laneCorrections++;
    const min=L==='DEF'?7.6:L==='MID'?6.9:8.0;
    const r=outsideBallLateral(b,tx,ty,min,hy);tx=r[0];ty=r[1];if(r[2]){s.zoneCorrections++;s.laneCorrections++;}
  }
  if(L==='DEF'&&p!==presser&&Number.isFinite(tm._r13LineDepth)){
    const band=tm._r13Overload?3.25:2.85;
    const tp=clamp(ownProg(tm,tx),tm._r13LineDepth-band,tm._r13LineDepth+band);
    tx=fromOwnProg(tm,tp);
  }else if(L==='MID'&&p!==presser&&Number.isFinite(tm._r13LineDepth)){
    /* O médio pode saltar para cobrir, mas não atravessa o intervalo que conecta
       o bloco. Isto impede corrigir o funil abrindo um buraco entre as linhas. */
    const lo=tm._r13LineDepth+(tm.styleKey==='park'?5.0:5.8);
    const hi=tm._r13LineDepth+(tm.styleKey==='park'?13.0:14.8);
    tx=fromOwnProg(tm,clamp(ownProg(tm,tx),lo,hi));
  }
  /* OS-08 · as duas regras de `oopRole` do _defendTarget base (:7535-7536),
     religadas na camada efetiva. Mesmos coeficientes do texto original. A base
     nunca roda porque o R13 (:16845) nao encadeia. */
  if(p.oopRole==='track_wide'){s.oopRoleTrackWide=(s.oopRoleTrackWide||0)+1;ty=lerp(ty,finite(b.y),.12);}
  if(p.oopRole==='screen'||p.oopRole==='anchor'){s.oopRoleAnchor=(s.oopRoleAnchor||0)+1;tx=lerp(tx,finite(tm.goal&&tm.goal.x),.05);}
  return[clamp(tx,1,FL-1),clamp(ty,2,FW-2)];
};

function sample(sim){
  const b=sim.ball;if(!b||!b.owner||b.traveling||finite(sim.dead)>.05)return;
  const tm=sim.teams&&sim.teams[1-b.owner.team];if(!tm)return;
  let n4=0,n6=0,n9=0;
  for(const p of tm.players||[]){if(!p||p.red||p.isGK)continue;const d=dist(p,b);if(d<=4)n4++;if(d<=6)n6++;if(d<=9)n9++;}
  const s=stats(sim);s.samples++;s.within4Sum+=n4;s.within6Sum+=n6;s.within9Sum+=n9;
  s.maxWithin4=Math.max(s.maxWithin4,n4);s.maxWithin6=Math.max(s.maxWithin6,n6);s.maxWithin9=Math.max(s.maxWithin9,n9);
  if(n6>=3)s.swarm3Within6++;if(n9>=4)s.severe4Within9++;
}
const oldStep=P.step;
P.step=function(){const r=oldStep.apply(this,arguments);if(finite(this.t)>=finite(this.__r18173NextSample)){this.__r18173NextSample=finite(this.t)+.5;sample(this);}return r;};
P.getR18173Audit=function(){
  const s=stats(this),n=Math.max(1,s.samples),observer=this.getR13Audit?this.getR13Audit():null;
  return Object.assign({},s,{means:{defendersWithin4:+(s.within4Sum/n).toFixed(3),defendersWithin6:+(s.within6Sum/n).toFixed(3),defendersWithin9:+(s.within9Sum/n).toFixed(3)},rates:{swarm3Within6:+(s.swarm3Within6/n).toFixed(4),severe4Within9:+(s.severe4Within9/n).toFixed(4)},gates:{swarmRate:s.swarm3Within6/n<=.08,severeCollapseRate:s.severe4Within9/n<=.10},structural:this.getR12Audit?this.getR12Audit().status:null,observer:observer&&observer.status,marking:observer&&observer.rates?{threatCoverage:observer.rates.threatCoverage,markerMeanDistance:observer.rates.markerMeanDistance}:null,lines:observer&&observer.rates?{meanRange:observer.rates.defensiveLineMeanRange,disconnected:observer.rates.disconnectedLineRate}:null});
};
const oldFull=P.getFullFootballAudit;
P.getFullFootballAudit=function(){const r=oldFull?oldFull.apply(this,arguments):{};r.defensiveResponsibility=this.getR18173Audit();return r;};
root.CDS_R18173=Object.freeze({version:V,baseline:'R18.17.2',feature:'ONE_PRESSER_ONE_COVER_ROLE_DISCIPLINE',directBallPressers:1,ownerDoubleMark:false,globalSecondSlide:false,rngConsumption:false,teleport:false,speedBonus:false});
try{root.CDS_BUILD_ID='R18.17.3';root.CDS_VERSION=V;document.title='Copa dos Sonhos — R18.17.3';}catch(_){ }
})(typeof window!=='undefined'?window:globalThis);
