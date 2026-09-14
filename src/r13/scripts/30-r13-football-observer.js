
/* Copa dos Sonhos · V5.9.3-R13.0
   Camada de Futebol Observável: a jogada precisa ser correta no campo,
   e não somente coerente no estado interno. */
(function installR13(root){
'use strict';
const M=root&&root.MatchSim;
if(!M||!M.prototype||M.prototype.__CDS_R13__)return;
const P=M.prototype,VERSION='5.9.3-R13.0',FL13=105,FW13=68;
Object.defineProperty(P,'__CDS_R13__',{value:true});
const clamp13=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite13=(v,d=0)=>Number.isFinite(v)?v:d;
const d13=(a,b)=>a&&b?Math.hypot(finite13(a.x)-finite13(b.x),finite13(a.y)-finite13(b.y)):999;
const lerp13=(a,b,t)=>a+(b-a)*t;
const line13=p=>{
  const pos=p&&(p.oopPos||p.slotPos);
  if(!p||p.isGK||pos==='GK')return'GK';
  if(['CB','LB','RB','LWB','RWB'].includes(pos))return'DEF';
  if(['CDM','CM','CAM','LM','RM'].includes(pos))return'MID';
  return'FWD';
};
const ownProg13=(tm,x)=>tm.goal.x<FL13/2?x:FL13-x;
const fromOwnProg13=(tm,p)=>tm.goal.x<FL13/2?p:FL13-p;
function mix13(x){x|=0;x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);return(x^(x>>>16))>>>0;}
function rnd13(sim){
  sim.__r13Rand=((sim.__r13Rand||0)+1)>>>0;
  let h=0x6d2b79f5^Math.imul((Math.floor(finite13(sim.t)*30)|0)+1,0x45d9f3b);
  h^=Math.imul((Math.floor(finite13(sim.minute)*100)|0)+1,0x27d4eb2d);
  h^=Math.imul(sim.__r13Rand,0x9e3779b1);
  return mix13(h)/4294967296;
}
const hit13=(sim,p)=>rnd13(sim)<clamp13(p,0,1);
function blankR13Team(){return{throwIns:0,goalKicks:0,touchlineErrors:0,touchlineDuels:0,offsideTraps:0};}
function makeR13(){
  return{
    version:VERSION,
    team:[blankR13Team(),blankR13Team()],
    events:Object.create(null),
    phaseByTeam:['reorganization','reorganization'],
    phaseSince:[0,0],
    phaseTime:[Object.create(null),Object.create(null)],
    phaseChanges:0,
    possessionChangedAt:0,
    previousPoss:null,
    cornerChain:null,
    nextSample:0,
    metrics:{
      samples:0,dangerousThreats:0,coveredThreats:0,goalSideThreats:0,
      markerSamples:0,closeMarkers:0,goalSideMarkers:0,markerDistance:0,
      lineSamples:0,lineRange:0,lineRangeMax:0,disconnectedLines:0,
      spatialOverloadSamples:0,spatialOverloadCovered:0,
      controlledBallSamples:0,bodyAligned:0,markingSwitches:0
    }
  };
}
function state13(sim){return sim.__r13State||(sim.__r13State=makeR13());}
function ensureR13Stats(s){
  if(!s)return s;
  for(const k of ['throwIns','goalKicks','touchlineErrors','touchlineDuels','offsideTraps'])if(s[k]==null)s[k]=0;
  return s;
}

const oldBlank13=P._blankStats;
P._blankStats=function(){return ensureR13Stats(oldBlank13.apply(this,arguments));};
const oldReset13=P.reset;
P.reset=function(){
  this.__r13State=makeR13();this.__r13Rand=0;
  const r=oldReset13.apply(this,arguments);
  if(this.stats){ensureR13Stats(this.stats[0]);ensureR13Stats(this.stats[1]);}
  for(const tm of this.teams||[]){
    tm._r13LineDepth=null;tm._r13TrapUntil=0;tm._r13NextTrap=0;tm._r13Dropper=null;
  }
  return r;
};

function clearCorner13(sim,reason){
  const S=state13(sim),q=S.cornerChain;
  if(q){q.endedAt=finite13(sim.t);q.reason=reason||'resolved';S.cornerChain=null;}
  for(const tm of sim.teams||[])for(const p of tm.players||[]){
    p._setPieceRole=null;
    if((p._setPieceDeliveryUntil||0)<=finite13(sim.t)){p._deliverySwing=null;p._deliverySwingUntil=0;}
  }
  const c=sim.__r122State&&sim.__r122State.pendingOrigin;
  if(c&&c.kind==='corner')sim.__r122State.pendingOrigin=null;
}
const oldEmit13=P._emit;
P._emit=function(type,data){
  data=data||{};
  const S=state13(this);
  S.events[type]=(S.events[type]||0)+1;
  if(type==='header_clear')this.__r13HeaderClearUntil=finite13(this.t)+.08;
  if(type==='corner'&&(data.team===0||data.team===1))organizeCornerRest13(this,data.team);
  if(type==='corner'&&(data.team===0||data.team===1)){
    S.cornerChain={team:data.team,startedAt:finite13(this.t),until:finite13(this.t)+7};
    const c=this.__r122State&&this.__r122State.pendingOrigin;
    if(c&&c.kind==='corner')c.until=Math.min(finite13(c.until),finite13(this.t)+7);
  }else if(S.cornerChain){
    const by=data.by||data.p||data.gk;
    const defending=by&&(by.team===0||by.team===1)&&by.team!==S.cornerChain.team;
    if(type==='header_clear'||type==='gk_claim'||type==='gk_punch'||type==='goal_kick'||type==='throw_in'||
       (defending&&(type==='intercept'||type==='tackle'||type==='pass'||type==='save'))||
       type==='goal'||type==='miss'||type==='post')clearCorner13(this,'event_'+type);
  }
  return oldEmit13.apply(this,arguments);
};
/* A bola dominada acompanha corpo e deslocamento. O gol deixa de ser a
   orientação universal do pé, que era a origem visual do deslizamento. */
P._ballGlue=function(){
  const b=this.ball,o=b&&b.owner;if(!o)return;
  let dx=finite13(o.vx),dy=finite13(o.vy),speed=Math.hypot(dx,dy);
  if(speed<.28&&Number.isFinite(o._tx)&&Number.isFinite(o._ty)){
    dx=o._tx-o.x;dy=o._ty-o.y;speed=Math.hypot(dx,dy);
  }
  if(speed<.18){
    const g=this.teams[o.team].oppGoal;dx=g.x-o.x;dy=g.y-o.y;speed=Math.hypot(dx,dy);
  }
  const nx=dx/Math.max(speed,.001),ny=dy/Math.max(speed,.001);
  const stride=.47+Math.sin(finite13(this.t)*8.2+(o.idx||0)*1.37)*.07;
  const foot=Math.sin(finite13(this.t)*6.1+(o.idx||0)*.91)*.055;
  b.x=clamp13(o.x+nx*stride-ny*foot,0,FL13);
  b.y=clamp13(o.y+ny*stride+nx*foot,0,FW13);
  b.z=0;b.vx=finite13(o.vx);b.vy=finite13(o.vy);b.vz=0;
};

/* Erros, cortes e divididas junto à faixa podem cruzar a linha. A decisão
   continua determinística, mas o destino deixa de ser artificialmente preso
   a 0,5 m da lateral. */
const oldStart13=P._startTravel;
P._startTravel=function(actor,target,kind,onArrive,receiver,travelKind,meta){
  let t={x:finite13(target&&target.x),y:finite13(target&&target.y)};
  const m=Object.assign({},meta||{});
  if(actor&&kind==='pass'&&travelKind!=='throw'){
    const near=Math.min(finite13(actor.y,FW13/2),FW13-finite13(actor.y,FW13/2),t.y,FW13-t.y);
    const error=!!m.executionError,clear=!!m.clearance,badGK=!!m.gkBadDistribution;
    const p=error?.88:clear?.62:badGK?.44:0;
    if((clear||near<19)&&p>0&&hit13(this,p)){
      const side=(t.y<FW13/2||actor.y<FW13/2)?-1:1;
      t.y=side<0?-1.35:FW13+1.35;
      t.x=clamp13(t.x,1.2,FL13-1.2);
      m.touchlineError=true;
      if(this.stats&&this.stats[actor.team])this.stats[actor.team].touchlineErrors++;
      state13(this).team[actor.team].touchlineErrors++;
    }
  }
  let arrive=onArrive,physicalReceiver=receiver;
  if(m.touchlineError){
    physicalReceiver=null;
    arrive=()=>{
      if(this.ball&&(this.ball.y<0||this.ball.y>FW13||this.ball.x<0||this.ball.x>FL13))this._ballOut();
      else if(typeof onArrive==='function')onArrive();
    };
  }
  const r=oldStart13.call(this,actor,t,kind,arrive,physicalReceiver,travelKind,m);
  const b=this.ball;
  if(!b||!b.traveling)return r;
  const dx=t.x-b.x,dy=t.y-b.y,dist=Math.max(.01,Math.hypot(dx,dy));
  let speed;
  if(travelKind==='throw'){
    speed=clamp13(9.6+dist*.13,9.8,12.4);
    b.kind='throw';b.passKind='throw';b.z=1.72;b.vz=clamp13(4.5+dist*.055,4.8,5.9);
  }else if(kind==='shot'){
    speed=clamp13(finite13(b.speed,40),32,54);b.z=Math.max(.06,finite13(b.z));b.vz=finite13(b.vz,1);
  }else if(travelKind==='launch'){
    speed=clamp13(19.6+dist*.06,20,23.4);b.z=.22;b.vz=clamp13(4.4+dist*.105,5.1,8.8);
  }else if(travelKind==='through'){
    speed=clamp13(18.2+dist*.045,18.4,20.7);b.z=.10;b.vz=.72;
  }else{
    speed=clamp13(13.7+dist*.12,14.1,17.5);b.z=.075;b.vz=.28;
  }
  b.speed=speed;b.vx=dx/dist*speed;b.vy=dy/dist*speed;
  b.target={x:t.x,y:t.y};b._timeout=dist/speed+.65;
  return r;
};

const oldTravel13=P._ballTravel;
P._ballTravel=function(dt){
  const r=oldTravel13.apply(this,arguments),b=this.ball;
  if(b&&b.traveling){
    const drag=b.passKind==='short'?.18:b.passKind==='through'?.11:b.passKind==='throw'?.08:b.kind==='deflect'?.28:.05;
    const f=Math.exp(-drag*clamp13(finite13(dt,1/30),0,.15));
    b.vx*=f;b.vy*=f;
  }
  return r;
};

const oldDeflect13=P._deflectTo;
P._deflectTo=function(x,y,spd){
  const b=this.ball||{},edge=Math.min(finite13(b.y,FW13/2),FW13-finite13(b.y,FW13/2),finite13(y,FW13/2),FW13-finite13(y,FW13/2));
  let tx=x,ty=y;
  if(edge<10.5&&hit13(this,.58)){
    const side=(finite13(b.y,FW13/2)+finite13(y,FW13/2))/2<FW13/2?-1:1;
    ty=side<0?-1.1:FW13+1.1;tx=clamp13(finite13(x,b.x),1,FL13-1);
  }
  const r=oldDeflect13.call(this,tx,ty,spd);
  if(this.ball&&this.ball.traveling){
    this.ball.z=Math.max(.12,finite13(this.ball.z));
    this.ball.vz=Math.max(.8,Math.min(2.8,Math.abs(finite13(this.ball.vz))+1.05));
  }
  return r;
};

const oldLoose13=P._looseBall;
P._looseBall=function(x,y){
  let tx=x,ty=y;
  const edge=Math.min(finite13(y,FW13/2),FW13-finite13(y,FW13/2));
  if(edge<5.5&&hit13(this,.64))ty=y<FW13/2?-.7:FW13+.7;
  return oldLoose13.call(this,tx,ty);
};

const oldReceive13=P._receive;
P._receive=function(m){
  const r=oldReceive13.apply(this,arguments);
  if(m&&this.ball&&this.ball.owner===m){
    const phase=state13(this).phaseByTeam[m.team];
    const poor=(m._poorTouchUntil||0)>finite13(this.t);
    const edge=Math.min(m.y,FW13-m.y);
    if(poor&&edge<10&&hit13(this,.62)){
      this.ball.owner=null;this.ball.lastTouch=m;
      this._emit('miscontrol_out',{by:m});
      oldDeflect13.call(this,clamp13(m.x+(this.teams[m.team].attackDir||1)*1.4,1,FL13-1),m.y<FW13/2?-1:FW13+1,6.8);
    }else if(!poor&&(phase==='build_up'||phase==='transition_attack'||phase==='progression')){
      m.settle=Math.min(finite13(m.settle,.3),phase==='transition_attack'?.27:.23);
    }
  }
  return r;
};

const oldTurn13=P._turnover;
P._turnover=function(winner){
  const o=this.ball&&this.ball.owner;
  const edge=o?Math.min(o.y,FW13-o.y):99;
  const headedClear=(this.__r13HeaderClearUntil||0)>=finite13(this.t);
  if(!o&&winner&&headedClear&&this.dead<=0&&hit13(this,.52)){
    const side=finite13(this.ball.y,FW13/2)<FW13/2?-1:1;
    this.ball.lastTouch=winner;
    ensureR13Stats(this.stats[winner.team]);this.stats[winner.team].touchlineDuels++;
    state13(this).team[winner.team].touchlineDuels++;
    this._emit('clearance_out',{by:winner});
    oldDeflect13.call(this,clamp13(this.ball.x+(this.teams[winner.team].attackDir||1)*5,1,FL13-1),side<0?-1.1:FW13+1.1,10.5);
    return true;
  }
  if(o&&winner&&o!==winner&&o.team!==winner.team&&!o.isGK&&this.dead<=0&&
     ((edge<11.5&&hit13(this,.34))||(headedClear&&hit13(this,.46)))){
    const last=hit13(this,.56)?winner:o;
    this.ball.owner=null;this.ball.lastTouch=last;
    const outY=o.y<FW13/2?-1.15:FW13+1.15;
    const outX=clamp13(o.x+(this.teams[o.team].attackDir||1)*1.2,1,FL13-1);
    ensureR13Stats(this.stats[o.team]);ensureR13Stats(this.stats[winner.team]);
    this.stats[winner.team].touchlineDuels++;
    state13(this).team[winner.team].touchlineDuels++;
    this._emit('touchline_duel',{by:winner,on:o,lastTouch:last});
    oldDeflect13.call(this,outX,outY,7.8);
    return true;
  }
  return oldTurn13.apply(this,arguments);
};

const oldPress13=P._pressAndTackle;
P._pressAndTackle=function(dt){
  this.__r13PressFrame=(this.__r13PressFrame||0)+1;
  /* O bloco baixo não pode ser apenas uma linha desenhada: quando o rival
     entra no terço defensivo, ele encurta o intervalo entre tentativas de
     contenção. É um comportamento espacial e localizado, não um modificador
     de gol, chute ou resultado. */
  const owner=this.ball&&this.ball.owner;
  const defending=owner&&this.teams[1-owner.team];
  const deep=!!(owner&&defending&&ownProg13(defending,owner.x)<42);
  const interval=defending&&defending.styleKey==='park'&&deep?4:8;
  if(this.__r13PressFrame%interval!==0)return;
  return oldPress13.apply(this,arguments);
};

/* Arremesso lateral físico: escolha de cobrador, distância regulamentar,
   trajetória aérea e recepção real. */
const oldBallOut13=P._ballOut;
P._ballOut=function(){
  const b=this.ball;
  if(!b)return oldBallOut13.apply(this,arguments);
  if(b.x<=0||b.x>=FL13)return oldBallOut13.apply(this,arguments);
  const lastTeam=b.lastTouch&&(b.lastTouch.team===0||b.lastTouch.team===1)?b.lastTouch.team:this.poss;
  const team=1-lastTeam,boundary=b.y<FW13/2?0:FW13,x=clamp13(b.x,1,FL13-1);
  const tm=this.teams[team],players=tm.players.filter(p=>!p.red&&!p.isGK);
  const point={x,y:boundary};
  const taker=players.slice().sort((a,c)=>{
    const ra=['LB','RB','LWB','RWB','LM','RM'].includes(a.slotPos)?-2:0;
    const rc=['LB','RB','LWB','RWB','LM','RM'].includes(c.slotPos)?-2:0;
    return d13(a,point)+ra-(d13(c,point)+rc);
  })[0];
  const receiver=players.filter(p=>p!==taker).slice().sort((a,c)=>{
    const da=d13(a,point),dc=d13(c,point);
    const pa=da<4?5:da>19?(da-19)*1.5:0,pc=dc<4?5:dc>19?(dc-19)*1.5:0;
    return da+pa-(dc+pc);
  })[0]||null;
  b.traveling=false;b.owner=null;b.onArrive=null;b.target=null;b.vx=b.vy=b.vz=0;b.z=0;b.x=x;b.y=boundary;
  this.poss=team;this.dead=.72;
  ensureR13Stats(this.stats[team]);this.stats[team].throwIns++;
  state13(this).team[team].throwIns++;
  if(taker){
    taker._tx=x;taker._ty=boundary===0?.45:FW13-.45;taker.settle=Math.max(finite13(taker.settle),.35);
    for(const opp of this.teams[1-team].players){
      if(opp.red||opp.isGK)continue;
      const dd=d13(opp,point);
      if(dd<2.2){
        const vx=opp.x-x,vy=opp.y-boundary,L=Math.max(.1,Math.hypot(vx,vy));
        opp._tx=clamp13(x+vx/L*2.35,1,FL13-1);opp._ty=clamp13(boundary+vy/L*2.35,1,FW13-1);
      }
    }
  }
  this._emit('throw_in',{team,by:taker,x,y:boundary,to:receiver});
  this.pendingRestart=()=>{
    if(!taker||taker.red){this._contestLoose();return;}
    const ry=receiver?clamp13(receiver.y,2,FW13-2):(boundary===0?7:FW13-7);
    const rx=receiver?clamp13(receiver.x,2,FL13-2):clamp13(x+(tm.attackDir||1)*6,2,FL13-2);
    this.ball.x=x;this.ball.y=boundary;this.ball.z=1.72;this.ball.lastTouch=taker;
    this._startTravel(taker,{x:rx,y:ry},'throw',()=>{
      if(receiver&&!receiver.red){this._receive(receiver);receiver.settle=Math.max(receiver.settle,.22);}
      else this._contestLoose();
    },receiver,'throw',{throwIn:true});
  };
};

const oldGoalKick13=P._goalKickOrRestart;
P._goalKickOrRestart=function(team){
  const before=(this.stats||[]).reduce((n,s)=>n+finite13(s&&s.corners),0);
  const r=oldGoalKick13.apply(this,arguments);
  const after=(this.stats||[]).reduce((n,s)=>n+finite13(s&&s.corners),0);
  if(after===before&&(team===0||team===1)){
    ensureR13Stats(this.stats&&this.stats[team]);
    if(this.stats&&this.stats[team])this.stats[team].goalKicks++;
    state13(this).team[team].goalKicks++;
    this._emit('goal_kick',{team});
    clearCorner13(this,'goal_kick');
  }
  return r;
};

function organizeCornerRest13(sim,team){
  const tm=sim.teams&&sim.teams[team];
  if(!tm)return;
  const defs=tm.players.filter(p=>!p.red&&line13(p)==='DEF');
  const advanced=defs.filter(p=>!['cover','rest_defence'].includes(p._setPieceRole));
  const keep=advanced.slice().sort((a,c)=>{
    const ah=(a.ref&&a.ref.attributesV3&&a.ref.attributesV3.cabecio)||70;
    const ch=(c.ref&&c.ref.attributesV3&&c.ref.attributesV3.cabecio)||70;
    return ch-ah;
  }).slice(0,2);
  const rest=defs.filter(p=>!keep.includes(p));
  rest.forEach((p,i)=>{
    const prog=52+Math.min(i,2)*2.4;
    p.x=fromOwnProg13(tm,prog);
    p.y=clamp13(FW13/2+(i-(rest.length-1)/2)*12,8,FW13-8);
    p.vx=p.vy=0;p._smx=p.x;p._smy=p.y;p._setPieceRole='rest_defence';
  });
}
const oldCorner13=P._setCorner;
P._setCorner=function(team){
  const r=oldCorner13.apply(this,arguments);
  organizeCornerRest13(this,team);
  return r;
};
/* Defesa coletiva: linha longitudinal comum, pressão+cobertura+sombra,
   marcação orientada ao gol e resposta específica à sobrecarga de quatro
   atacantes. Identificador sem proximidade não conta como marcação. */
function threats13(sim,tm){
  const att=sim.teams[1-tm.side],owner=sim.ball&&sim.ball.owner;
  return att.players.filter(a=>{
    if(a.red||a.isGK)return false;
    const L=line13(a),gd=d13(a,tm.goal);
    /* A ameaça é definida por posição e movimento, nunca pelo nome da
       formação. Assim um ala, meia ou terceiro homem que pisa na última
       linha recebe a mesma resposta de um atacante nominal. */
    if(L==='FWD')return gd<56||a._runDeep||a._breaking||a===owner;
    return ['CAM','LM','RM','LWB','RWB'].includes(a.slotPos)&&
      (gd<43||a._breaking||a._runDeep||(a===owner&&gd<64));
  }).sort((a,c)=>{
    const ap=ownProg13(tm,a.x),cp=ownProg13(tm,c.x);
    const ar=(a._breaking?8:0)+(a._runDeep?3:0)+(a===owner?5:0);
    const cr=(c._breaking?8:0)+(c._runDeep?3:0)+(c===owner?5:0);
    return (ap-ar)-(cp-cr);
  });
}
function desiredLine13(sim,tm,b,presser,threats){
  const bp=ownProg13(tm,finite13(b.x,FL13/2)),style=tm.styleKey||'balanced';
  let base;
  if(style==='park')base=clamp13(20+bp*.19,20,34);
  else if(style==='counter')base=clamp13(20+bp*.21,19,37);
  else if(style==='press')base=clamp13(27+bp*.28,26,48);
  else base=clamp13(23+bp*.235,21,43);
  base+=clamp13(finite13(tm.fx&&tm.fx.line)*.25,-2.5,2.5);
  const deepest=threats.length?Math.min.apply(null,threats.map(a=>ownProg13(tm,a.x))):base+8;
  const owner=b.owner&&b.owner.team!==tm.side?b.owner:null;
  const pressure=!!(owner&&presser&&d13(owner,presser)<5.8);
  const high=style==='press'||base>36;
  if(finite13(sim.t)>=finite13(tm._r13NextTrap)&&high&&pressure&&deepest>base-2&&deepest<base+7&&hit13(sim,.34)){
    tm._r13TrapUntil=finite13(sim.t)+1.25;
    tm._r13NextTrap=finite13(sim.t)+6.2+rnd13(sim)*3.2;
    ensureR13Stats(sim.stats[tm.side]);sim.stats[tm.side].offsideTraps++;
    state13(sim).team[tm.side].offsideTraps++;
    sim._emit('offside_trap',{team:tm.side,line:base});
  }
  const trapping=finite13(tm._r13TrapUntil)>finite13(sim.t);
  let desired=trapping?clamp13(Math.max(base,deepest+1.1),22,49):Math.min(base,deepest-2.2);
  desired=clamp13(desired,8,50);
  if(tm._r13LineDepth==null)tm._r13LineDepth=desired;
  else{
    const urgent=desired<tm._r13LineDepth?0.72:trapping?0.78:0.47;
    tm._r13LineDepth=lerp13(tm._r13LineDepth,desired,urgent);
  }
  tm._r13LineDesired=desired;tm._r13Trapping=trapping;
  return tm._r13LineDepth;
}

const oldSelect13=P._selectPresser;
P._selectPresser=function(tm,b){
  let picked=oldSelect13.apply(this,arguments);
  if(!picked||line13(picked)!=='DEF')return picked;
  const bp=ownProg13(tm,finite13(b&&b.x,FL13/2));
  const defs=tm.players.filter(p=>!p.red&&!p.isGK&&line13(p)==='DEF');
  const active=threats13(this,tm).filter(a=>d13(a,tm.goal)<48||a._breaking||a._runDeep);
  const lastLineOccupied=active.length>=Math.max(2,defs.length);
  if(bp<23&&!lastLineOccupied)return picked;
  const pool=tm.players.filter(p=>!p.red&&!p.isGK&&line13(p)!=='DEF')
    .sort((a,c)=>d13(a,b)-d13(c,b));
  const alternative=pool[0];
  if(alternative&&(bp>36||d13(alternative,b)<=d13(picked,b)+4.5)){
    tm._presser=alternative;picked=alternative;
  }
  return picked;
};

P._assignDefRoles=function(tm,b,presser){
  const previous=new Map();
  for(const p of tm.players){
    previous.set(p,p._markRef||null);
    p._markRef=null;p._r13MarkTarget=null;p._r13MarkClass=null;
  }
  const threats=threats13(this,tm);
  const line=desiredLine13(this,tm,b,presser,threats);
  const eligible=tm.players.filter(p=>!p.red&&!p.isGK&&line13(p)!=='FWD'&&p!==presser);
  const availableDefs=eligible.filter(p=>line13(p)==='DEF').length;
  const allDefs=tm.players.filter(p=>!p.red&&!p.isGK&&line13(p)==='DEF');
  const laneOf=y=>y<FW13/3?0:y>FW13*2/3?2:1;
  const threatLanes=[0,0,0],defenderLanes=[0,0,0];
  for(const a of threats)threatLanes[laneOf(a.y)]++;
  for(const p of allDefs)defenderLanes[laneOf(p.y)]++;
  const localOverload=threatLanes.some((n,i)=>n>=2&&n>=defenderLanes[i]);
  const lastLineThreats=threats.filter(a=>d13(a,tm.goal)<48||a._breaking||a._runDeep);
  /* Superioridade é espacial: igualdade numérica na última linha já pede
     sobra; dois contra um em qualquer corredor também. Vale para todas as
     formações e para trocas dinâmicas de desenho durante a partida. */
  const overload=lastLineThreats.length>=Math.max(2,allDefs.length)||localOverload||threats.length>=5;
  const used=new Set(),assigned=new Set(),S=state13(this);
  const bind=(best,a)=>{
    const ap=ownProg13(tm,a.x),deep=ap<=line+12;
    used.add(best);assigned.add(a);best._markRef=a;best._r13MarkClass=deep?'track':'screen';
    const L=line13(best);
    let tp=ap-(overload?4.25:3.2);
    if(L==='DEF')tp=clamp13(tp,line-(overload?4.0:3.1),line+(overload?4.0:3.1));
    else if(!overload)tp=Math.min(tp,line+13);
    tp=Math.min(tp,ap-1.45);
    best._r13MarkTarget={
      x:fromOwnProg13(tm,clamp13(tp,3,FL13-3)),
      y:clamp13(lerp13(a.y,FW13/2,.035),2,FW13-2)
    };
    best._react=Math.min(finite13(best._react,best.react||.16),overload?.05:.08);
    if(overload){
      best._smx=lerp13(finite13(best._smx,best.x),best._r13MarkTarget.x,.44);
      best._smy=lerp13(finite13(best._smy,best.y),best._r13MarkTarget.y,.44);
    }
    if(previous.get(best)&&previous.get(best)!==a)S.metrics.markingSwitches++;
  };
  /* Mantém a referência enquanto ela continua na zona alcançável. A troca só
     ocorre quando outro setor realmente precisa assumir o atacante. */
  for(const p of eligible){
    /* Contra quatro atacantes, a prioridade é sempre a ameaça ativa mais
       profunda. Preservar cegamente uma referência estrutural recuada podia
       ocupar um zagueiro enquanto outro atacante já atacava o espaço. */
    if(overload)continue;
    const a=previous.get(p);
    if(!a||!threats.includes(a)||assigned.has(a))continue;
    if(overload&&availableDefs>=Math.min(allDefs.length,threats.length)&&line13(p)!=='DEF')continue;
    const ap=ownProg13(tm,a.x),gap=Math.abs(ap-line);
    if(d13(p,a)<=(overload?25:18.5)&&(line13(p)!=='DEF'||gap<=(overload?23:17)))bind(p,a);
  }
  for(const a of threats){
    if(assigned.has(a))continue;
    const ap=ownProg13(tm,a.x),deep=ap<=line+12;
    let best=null,bestScore=1e9;
    for(const p of eligible){
      if(used.has(p))continue;
      const L=line13(p),pos=p.oopPos||p.slotPos;
      const role=overload?(L==='DEF'?0:pos==='CDM'?4:6):(deep?(L==='DEF'?0:pos==='CDM'?1.5:5.5):(pos==='CDM'?0:L==='MID'?1.2:4.8));
      const wide=Math.abs(a.y-FW13/2)>15;
      const flank=wide&&['LB','RB','LWB','RWB','LM','RM'].includes(pos)?-2.1:0;
      const score=Math.abs(p.y-a.y)*.72+Math.abs(ownProg13(tm,p.x)-ap)*.22+role+flank;
      if(score<bestScore){bestScore=score;best=p;}
    }
    if(!best)continue;
    bind(best,a);
  }
  let cover=null,coverScore=1e9;
  for(const p of eligible){
    if(used.has(p))continue;
    const L=line13(p),pos=p.oopPos||p.slotPos;
    const score=d13(p,b)+(L==='DEF'?0:pos==='CDM'?1.2:4);
    if(score<coverScore){coverScore=score;cover=p;}
  }
  tm._cover=cover;
  let shadow=null,shadowScore=1e9;
  const laneThreat=threats.find(a=>a!==b.owner)||threats[0]||null;
  for(const p of eligible){
    if(used.has(p)||p===cover)continue;
    const pos=p.oopPos||p.slotPos,L=line13(p);
    const px=laneThreat?lerp13(b.x,laneThreat.x,.43):b.x;
    const py=laneThreat?lerp13(b.y,laneThreat.y,.43):b.y;
    const score=d13(p,{x:px,y:py})+(pos==='CDM'?0:L==='MID'?1.2:4.5);
    if(score<shadowScore){shadowScore=score;shadow=p;}
  }
  tm._shadow=shadow;tm._shadowTgt=laneThreat;
  const forwardThreats=threats.filter(a=>line13(a)==='FWD');
  tm._r13Overload=overload;
  tm._r13ShapePressure={
    threats:threats.length,lastLine:lastLineThreats.length,
    lanes:threatLanes.slice(),localOverload
  };
  tm._r13Dropper=null;
  if(tm._r13Overload){
    const dropPool=eligible.filter(p=>!used.has(p)&&p!==cover&&p!==shadow)
      .sort((a,c)=>{
        const ap=(a.slotPos==='CDM'?0:line13(a)==='MID'?2:5)+Math.abs(a.y-FW13/2)*.08;
        const cp=(c.slotPos==='CDM'?0:line13(c)==='MID'?2:5)+Math.abs(c.y-FW13/2)*.08;
        return ap-cp;
      });
    tm._r13Dropper=dropPool[0]||shadow||cover||null;
  }
  tm._r13Threats=threats;tm._r13MarkCount=used.size;
};

const oldDefend13=P._defendTarget;
P._defendTarget=function(tm,p,b,presser){
  if(p===presser){
    /* Pressiona pelo lado do próprio gol para não trocar proximidade por uma
       falsa marcação às costas do portador. */
    if(b.owner&&b.owner.team!==tm.side){
      const vx=tm.goal.x-b.x,vy=tm.goal.y-b.y,L=Math.max(.1,Math.hypot(vx,vy));
      return[clamp13(b.x+vx/L*1.25,1,FL13-1),clamp13(b.y+vy/L*1.25,1,FW13-1)];
    }
    return[b.x,b.y];
  }
  const L=line13(p),line=finite13(tm._r13LineDepth,ownProg13(tm,p.x));
  if(b.traveling&&b.kind==='pass'&&b.from&&b.target&&p!==tm._cover&&(!p._markRef||b.receiver===p._markRef)){
    const dx=b.target.x-b.from.x,dy=b.target.y-b.from.y,l2=dx*dx+dy*dy;
    if(l2>1){
      const u=((p.x-b.from.x)*dx+(p.y-b.from.y)*dy)/l2;
      if(u>.18&&u<.72){
        const px=b.from.x+dx*u,py=b.from.y+dy*u;
        if(d13(p,{x:px,y:py})<3.7)return[clamp13(px,1,FL13-1),clamp13(py,1,FW13-1)];
      }
    }
  }
  if(p._markRef&&!p._markRef.red){
    const a=p._markRef,ap=ownProg13(tm,a.x);
    let tp=ap-(tm._r13Overload?4.15:3.1);
    if(L==='DEF')tp=clamp13(tp,line-(tm._r13Overload?3.9:3.0),line+(tm._r13Overload?3.9:3.0));
    else if(!tm._r13Overload)tp=Math.min(tp,line+13);
    tp=Math.min(tp,ap-1.35);
    const tx=fromOwnProg13(tm,clamp13(tp,2.5,FL13-2.5));
    const ty=clamp13(lerp13(a.y,FW13/2,.035),2,FW13-2);
    p._r13MarkTarget={x:tx,y:ty};
    return[tx,ty];
  }
  if(p===tm._r13Dropper){
    return[fromOwnProg13(tm,clamp13(line+2.4,4,FL13-4)),clamp13(lerp13(FW13/2,b.y,.28),8,FW13-8)];
  }
  if(p===tm._cover){
    const vx=tm.goal.x-b.x,vy=tm.goal.y-b.y,len=Math.max(.1,Math.hypot(vx,vy));
    const tx=clamp13(b.x+vx/len*7.2,2,FL13-2),ty=clamp13(b.y+vy/len*7.2,3,FW13-3);
    return[tx,ty];
  }
  if(p===tm._shadow&&tm._shadowTgt){
    const a=tm._shadowTgt;
    return[clamp13(lerp13(b.x,a.x,.40),2,FL13-2),clamp13(lerp13(b.y,a.y,.40),3,FW13-3)];
  }
  if(L==='DEF'){
    const stagger=((p.idx||0)%3-1)*.42;
    const tx=fromOwnProg13(tm,clamp13(line+stagger,3,FL13-3));
    const baseY=finite13(p.dhy,p.hy);
    const ty=clamp13(baseY+(b.y-FW13/2)*.23,3,FW13-3);
    return[tx,ty];
  }
  if(L==='MID'){
    const park=tm.styleKey==='park',gap=park?8.8:11.6;
    const tx=fromOwnProg13(tm,clamp13(line+gap,7,FL13-7));
    const compact=park?.24:.13;
    const ty=clamp13(lerp13(finite13(p.dhy,p.hy),FW13/2,compact)+(b.y-FW13/2)*.28,4,FW13-4);
    return[tx,ty];
  }
  return oldDefend13.apply(this,arguments);
};

const oldAttack13=P._attackTarget;
P._attackTarget=function(tm,p,b){
  const target=oldAttack13.apply(this,arguments);
  if(!target)return target;
  let tx=target[0],ty=target[1],prog=ownProg13(tm,tx),L=line13(p),pos=p.slotPos;
  const phase=state13(this).phaseByTeam[tm.side]||'build_up';
  if(L==='FWD'&&phase==='build_up'&&p!==tm._r13Runner)p._runDeep=false;
  /* Defesa de descanso: mesmo no ataque há dois jogadores protegendo a
     transição. A retranca não vira posse territorial ofensiva contínua. */
  if(L==='DEF'){
    let cap=pos==='CB'?47:58;
    if(tm.styleKey==='park')cap=pos==='CB'?36:45;
    const opposite=(p.hy<FW13/2)!==(b.y<FW13/2);
    if(ownProg13(tm,b.x)>68&&opposite)cap=Math.min(cap,50);
    prog=Math.min(prog,cap);
  }else if(tm.styleKey==='park'&&L==='MID'){
    prog=Math.min(prog,pos==='CDM'?49:62);
    if(pos!=='CAM')p._runDeep=false;
  }
  if(phase==='transition_attack'&&(L==='FWD'||pos==='CAM')&&p===tm._r13Runner){
    prog=clamp13(prog+(tm.styleKey==='park'?6.4:4.2),0,FL13-2);
    ty=clamp13(lerp13(ty,FW13/2,.12),3,FW13-3);
  }
  if(phase==='build_up'&&L==='MID'&&p!==tm._thirdMan){
    const bp=ownProg13(tm,b.x);
    prog=clamp13(prog,bp-10,bp+17);
  }
  if(['LW','RW','LM','RM','LWB','RWB'].includes(pos)&&phase!=='final_third'&&p!==tm._r13Runner){
    const edge=p.hy<FW13/2?6.5:FW13-6.5;
    ty=lerp13(ty,edge,.76);
  }
  tx=fromOwnProg13(tm,clamp13(prog,1,FL13-1));
  return[tx,ty];
};

/* Um marcador que está fechando distância trabalha em esforço de cobertura,
   não no trote de reposicionamento zonal. A velocidade continua limitada pelos
   atributos físicos do próprio defensor. */
const oldIntegrate13=P._integrate;
P._integrate=function(p,tx,ty,dt,freeze){
  const sprint=!!(p&&p._markRef&&!p._markRef.red&&d13(p,p._markRef)>3.4);
  const saved=p&&p._breaking;
  if(sprint)p._breaking=saved||{r13MarkingDuty:true};
  try{return oldIntegrate13.apply(this,arguments);}
  finally{if(sprint)p._breaking=saved;}
};

function shortOutlet13(sim,o){
  const tm=sim.teams[o.team],opps=sim.teams[1-o.team].players.filter(p=>!p.red);
  let pick=null,best=-1e9;
  for(const m of tm.players){
    if(m===o||m.red||m.isGK)continue;
    const dist=d13(o,m);if(dist<4.2||dist>22)continue;
    let space=30;for(const d of opps)space=Math.min(space,d13(m,d));
    const risk=sim._laneRisk?sim._laneRisk(o,m,opps):0;
    if(space<2.7||risk>2.45)continue;
    const progress=(tm.attackDir||1)*(m.x-o.x);
    const lateral=Math.abs(m.y-o.y);
    const back=progress<-8?Math.abs(progress+8)*.12:0;
    const score=space*.24-Math.abs(dist-12)*.13-risk*.72-back+lateral*.018+(m===tm._supportSide?.35:0)+(m===tm._supportBack?.28:0);
    if(score>best){
      best=score;pick={
        m,dist,intoBox:false,risk,progressM:progress,score,
        paceEdge:0,lineVuln:0,throughThreat:0,roleSynergy:0
      };
    }
  }
  return pick;
}

const oldDecide13=P._decide;
P._decide=function(o){
  if(o&&!o.isGK&&this.ball&&this.ball.owner===o){
    const tm=this.teams[o.team],phase=state13(this).phaseByTeam[o.team];
    if(phase==='transition_attack'){
      const prog=ownProg13(tm,o.x),open=this._openLaneAhead&&this._openLaneAhead(o,tm.oppGoal,tm.attackDir);
      const opps=this.teams[1-o.team].players.filter(p=>!p.red);
      const short=shortOutlet13(this,o),safe=this._safePass&&this._safePass(o,opps),vertical=this._bestPass&&this._bestPass(o);
      const best=tm.styleKey==='park'&&vertical&&finite13(vertical.progressM)>6?vertical:short||safe||vertical;
      const limit=(tm.styleKey==='counter'||tm.styleKey==='direct'||tm.styleKey==='park')?1:2;
      if(best&&best.m&&!best.m.red&&prog<61&&!open&&(tm._r13TransitionPasses||0)<limit){
        tm._r13TransitionPasses=(tm._r13TransitionPasses||0)+1;
        this._pass(o,best);return;
      }
    }else if(phase==='build_up'){
      /* O bloco baixo não deve acumular a corrente de cinco passes curtos da
         posse apoiada. Recupera, procura a saída e aceita o jogo direto. */
      if(tm.styleKey==='park'||tm.styleKey==='direct')return oldDecide13.apply(this,arguments);
      if(finite13(this.t)-finite13(tm._r13LastBuildPass,-99)>2.2)tm._r13BuildChain=0;
      const opps=this.teams[1-o.team].players.filter(p=>!p.red);
      const short=shortOutlet13(this,o),safe=this._safePass&&this._safePass(o,opps),fallback=this._bestPass&&this._bestPass(o);
      const option=short||safe||(fallback&&finite13(fallback.risk,9)<3.2&&finite13(fallback.score,-9)>-.75?fallback:null);
      if(option&&option.m&&!option.m.red&&(tm._r13BuildChain||0)<5){
        tm._r13BuildChain=(tm._r13BuildChain||0)+1;tm._r13LastBuildPass=finite13(this.t);
        this._pass(o,option);return;
      }
    }else if(phase==='progression'){
      if(tm.styleKey==='park'||tm.styleKey==='direct')return oldDecide13.apply(this,arguments);
      const short=shortOutlet13(this,o),candidate=this._bestPass&&this._bestPass(o);
      const clean=candidate&&finite13(candidate.risk,9)<2.35&&finite13(candidate.score,-9)>.15&&finite13(candidate.progressM)<22?candidate:null;
      if(clean&&clean.m&&!clean.m.red){
        this._pass(o,clean);return;
      }
      if(short&&short.m&&!short.m.red&&(tm._r13ProgressPasses||0)<2){
        tm._r13ProgressPasses=(tm._r13ProgressPasses||0)+1;
        this._pass(o,short);return;
      }
    }
  }
  return oldDecide13.apply(this,arguments);
};
/* Cadência não é câmera lenta. É alternância legível entre reorganização,
   construção, progressão, aceleração, disputa e recomposição. */
function setPhase13(sim,team,phase){
  const S=state13(sim),old=S.phaseByTeam[team];
  if(old===phase)return;
  const urgent=phase==='transition_attack'||phase==='transition_defense'||phase==='restart'||phase==='reorganization';
  if(!urgent&&finite13(sim.t)-finite13(S.phaseSince[team])<1.15)return;
  S.phaseByTeam[team]=phase;S.phaseSince[team]=finite13(sim.t);S.phaseChanges++;
  if(phase==='build_up'){sim.teams[team]._r13BuildChain=0;sim.teams[team]._r13LastBuildPass=finite13(sim.t);}
  if(phase==='progression')sim.teams[team]._r13ProgressPasses=0;
  sim._emit('match_phase',{team,from:old,to:phase});
}
function chooseRunner13(sim,team){
  const tm=sim.teams[team],pool=tm.players.filter(p=>!p.red&&!p.isGK&&(line13(p)==='FWD'||p.slotPos==='CAM'));
  pool.sort((a,c)=>{
    const aa=(a.ref&&a.ref.a8&&a.ref.a8[3])||70,ca=(c.ref&&c.ref.a8&&c.ref.a8[3])||70;
    return ca-aa;
  });
  tm._r13Runner=pool[0]||null;
}
function updateCadence13(sim,dt,beforePoss){
  const S=state13(sim),now=finite13(sim.t);
  for(let team=0;team<2;team++){
    const ph=S.phaseByTeam[team]||'reorganization';
    S.phaseTime[team][ph]=(S.phaseTime[team][ph]||0)+dt;
  }
  const poss=(sim.ball&&sim.ball.owner)?sim.ball.owner.team:sim.poss;
  if((poss===0||poss===1)&&poss!==S.previousPoss){
    const old=S.previousPoss;
    S.previousPoss=poss;S.possessionChangedAt=now;
    chooseRunner13(sim,poss);
    sim.teams[poss]._r13TransitionPasses=0;
    setPhase13(sim,poss,'transition_attack');
    if(old===0||old===1)setPhase13(sim,old,'transition_defense');
  }
  if(sim.dead>0||sim.waiting){
    for(let team=0;team<2;team++)setPhase13(sim,team,team===poss?'restart':'reorganization');
    return;
  }
  const age=now-S.possessionChangedAt;
  for(let team=0;team<2;team++){
    if(team===poss){
      const prog=ownProg13(sim.teams[team],sim.ball.x);
      let phase;
      if(age<3.6)phase='transition_attack';
      else if(prog<35)phase='build_up';
      else if(prog<68)phase='progression';
      else phase='final_third';
      setPhase13(sim,team,phase);
    }else{
      const defs=sim.teams[team].players.filter(p=>!p.red&&line13(p)==='DEF').map(p=>ownProg13(sim.teams[team],p.x));
      const mids=sim.teams[team].players.filter(p=>!p.red&&line13(p)==='MID').map(p=>ownProg13(sim.teams[team],p.x));
      const spread=defs.length>1?Math.max.apply(null,defs)-Math.min.apply(null,defs):0;
      const connected=!defs.length||!mids.length||median13(mids)-median13(defs)<=18;
      const recovering=spread>13||!connected;
      setPhase13(sim,team,age<3.1||recovering?'transition_defense':'defensive_block');
    }
  }
  const attacking=S.phaseByTeam[poss];
  if(poss===0||poss===1){
    if(attacking==='transition_attack')sim.decideT=Math.min(finite13(sim.decideT,.2),.20);
    else if(attacking==='final_third')sim.decideT=Math.min(finite13(sim.decideT,.3),.31);
    else if(attacking==='build_up')sim.decideT=clamp13(finite13(sim.decideT,.25),.10,.44);
  }
}

function median13(v){
  if(!v.length)return 0;
  const a=v.slice().sort((x,y)=>x-y),m=Math.floor(a.length/2);
  return a.length%2?a[m]:(a[m-1]+a[m])/2;
}
function sampleFootball13(sim){
  const S=state13(sim),M=S.metrics,b=sim.ball;
  M.samples++;
  if(b&&b.owner){
    const o=b.owner,v=Math.hypot(finite13(o.vx),finite13(o.vy));
    const ox=b.x-o.x,oy=b.y-o.y,L=Math.hypot(ox,oy);
    if(v>1.2&&L>.15){
      M.controlledBallSamples++;
      const align=(ox*o.vx+oy*o.vy)/(L*v);
      if(align>=.35)M.bodyAligned++;
    }
  }
  const possessionTeam=b&&b.owner?b.owner.team:sim.poss;
  for(const tm of sim.teams){
    if(possessionTeam===tm.side)continue;
    const defenders=tm.players.filter(p=>!p.red&&line13(p)==='DEF');
    const mids=tm.players.filter(p=>!p.red&&line13(p)==='MID');
    const dp=defenders.map(p=>ownProg13(tm,p.x));
    const phase=S.phaseByTeam[tm.side];
    if(dp.length>1&&phase==='defensive_block'){
      const range=Math.max.apply(null,dp)-Math.min.apply(null,dp);
      M.lineSamples++;M.lineRange+=range;M.lineRangeMax=Math.max(M.lineRangeMax,range);
      const mp=mids.map(p=>ownProg13(tm,p.x));
      if(mp.length&&median13(mp)-median13(dp)>18)M.disconnectedLines++;
    }
    const threats=threats13(sim,tm);
    let coveredCount=0;
    for(const a of threats){
      M.dangerousThreats++;
      const eligible=tm.players.filter(p=>!p.red&&!p.isGK&&line13(p)!=='FWD');
      let close=false,goalSide=false;
      for(const p of eligible){
        const dd=d13(p,a);
        if(dd<=9)close=true;
        if(dd<=8.5&&d13(p,tm.goal)+.5<d13(a,tm.goal)&&Math.abs(p.y-a.y)<=7.5)goalSide=true;
      }
      if(close&&goalSide){M.coveredThreats++;coveredCount++;}
      if(goalSide)M.goalSideThreats++;
    }
    const shape=tm._r13ShapePressure;
    if(shape&&(shape.localOverload||shape.lastLine>=Math.max(2,defenders.length))){
      M.spatialOverloadSamples++;
      M.spatialOverloadCovered+=coveredCount/Math.max(1,threats.length);
    }
    for(const p of tm.players){
      if(!p._markRef||p.red||p._markRef.red)continue;
      const dd=d13(p,p._markRef);
      M.markerSamples++;M.markerDistance+=dd;
      if(dd<=8)M.closeMarkers++;
      if(d13(p,tm.goal)<d13(p._markRef,tm.goal))M.goalSideMarkers++;
    }
  }
}

const oldStep13=P.step;
P.step=function(dt){
  const before=this.poss,r=oldStep13.apply(this,arguments);
  if(this.ball&&this.ball.owner&&!this.ball.traveling)this._ballGlue();
  const step=clamp13(finite13(dt,1/30),0,.2);
  updateCadence13(this,step,before);
  const S=state13(this);
  if(S.cornerChain&&finite13(this.t)>S.cornerChain.until)clearCorner13(this,'chain_expired');
  if(finite13(this.t)>=S.nextSample){
    S.nextSample=finite13(this.t)+.5;
    sampleFootball13(this);
  }
  return r;
};

P.getR13Audit=function(){
  const S=state13(this),m=S.metrics,clone=JSON.parse(JSON.stringify(S));
  const phases=[new Set(Object.keys(S.phaseTime[0]).filter(k=>S.phaseTime[0][k]>.4)).size,
                new Set(Object.keys(S.phaseTime[1]).filter(k=>S.phaseTime[1][k]>.4)).size];
  const totalThrow=(this.stats||[]).reduce((n,s)=>n+finite13(s&&s.throwIns),0);
  const totalGoals=(this.stats||[]).reduce((n,s)=>n+finite13(s&&s.goals),0);
  let cornerGoals=0;
  if(this.getR12Audit){
    const c=this.getR12Audit();
    cornerGoals=(c.team||[]).reduce((n,t)=>n+finite13(t&&t.cornerGoals),0);
  }
  const rates={
    threatCoverage:m.dangerousThreats?m.coveredThreats/m.dangerousThreats:1,
    goalSideCoverage:m.dangerousThreats?m.goalSideThreats/m.dangerousThreats:1,
    markerClose:m.markerSamples?m.closeMarkers/m.markerSamples:1,
    markerGoalSide:m.markerSamples?m.goalSideMarkers/m.markerSamples:1,
    markerMeanDistance:m.markerSamples?m.markerDistance/m.markerSamples:0,
    defensiveLineMeanRange:m.lineSamples?m.lineRange/m.lineSamples:0,
    disconnectedLineRate:m.lineSamples?m.disconnectedLines/m.lineSamples:0,
    spatialOverloadCoverage:m.spatialOverloadSamples?m.spatialOverloadCovered/m.spatialOverloadSamples:1,
    bodyOrientationMismatch:m.controlledBallSamples?1-m.bodyAligned/m.controlledBallSamples:0,
    cornerGoalShare:totalGoals?cornerGoals/totalGoals:0
  };
  const structural=!this.getR12Audit||this.getR12Audit().status==='CONSISTENT';
  const gates={
    structural,
    cadence:Math.min.apply(null,phases)>=5&&S.phaseChanges>=8,
    ball:rates.bodyOrientationMismatch<=.10,
    marking:rates.threatCoverage>=.65&&rates.markerMeanDistance<=8.5,
    lines:rates.defensiveLineMeanRange<=10&&rates.disconnectedLineRate<=.22,
    spatialOverload:m.spatialOverloadSamples===0||rates.spatialOverloadCoverage>=.62,
    restarts:totalThrow>=4,
    corners:totalGoals<2||rates.cornerGoalShare<=.34
  };
  clone.rates=rates;clone.gates=gates;clone.phaseVariety=phases;
  clone.teamStats=(this.stats||[]).map(s=>({
    throwIns:finite13(s.throwIns),goalKicks:finite13(s.goalKicks),
    touchlineErrors:finite13(s.touchlineErrors),touchlineDuels:finite13(s.touchlineDuels),
    offsideTraps:finite13(s.offsideTraps)
  }));
  clone.status=Object.values(gates).every(Boolean)?'FOOTBALL_OBSERVER_PASS':'FOOTBALL_OBSERVER_REVIEW';
  return clone;
};

const oldFullAudit13=P.getFullFootballAudit;
P.getFullFootballAudit=function(){
  const r=oldFullAudit13?oldFullAudit13.apply(this,arguments):{};
  r.version=VERSION;r.observedFootball=this.getR13Audit();return r;
};

root.CDS_R13=Object.freeze({
  version:VERSION,status:'FOOTBALL_OBSERVER_CANDIDATE',
  architecture:Object.freeze({
    cadence:'PHASE_STATE_MACHINE',touchline:'PHYSICAL_RESTART',
    marking:'GOAL_SIDE_SPATIAL_ASSIGNMENT',defensiveLine:'SYNCHRONIZED_DEPTH_CONTROLLER',
    ball:'BODY_ORIENTED_CONTINUOUS_PHYSICS',audit:'HUMAN_OBSERVER_GATES'
  }),
  targets:Object.freeze({
    goals:[1.8,3],shots:[12,20],condensedPasses:[125,175],
    throwIns:[5,16],offsides:[.5,4],cornerGoalShare:[.02,.18],
    uncoveredThreatRate:[0,.30],markerDistance:[0,8],
    defensiveLineRange:[0,9],disconnectedLineRate:[0,.20],
    bodyOrientationMismatch:[0,.08]
  })
});
try{
  const old=root.CDS_PRE25D_BUILD||{};
  root.CDS_PRE25D_BUILD=Object.freeze(Object.assign({},old,{version:VERSION,footballObserver:true,cadenceStateMachine:true}));
  document.title='Copa dos Sonhos — R13.0 Futebol Observável e Cadenciado';
}catch(_){}
})(typeof window!=='undefined'?window:globalThis);
