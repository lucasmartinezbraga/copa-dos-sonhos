
/* Copa dos Sonhos · Build 5.8.17-R10.9 · Fechamento dos bloqueadores P0-6
   - recovery solver de bola solta e borda
   - posse centralizada em contato/token administrativo
   - alvos de passe limitados por geometria
   - contatos planejados revalidados
   - timeline compactada e leitura O(1)
*/
(function installR10(root){
'use strict';
const M=root&&root.MatchSim;if(!M||!M.prototype)return;const P=M.prototype;
if(P.__CDS_R10_ENGINE_CLOSURE__)return;Object.defineProperty(P,'__CDS_R10_ENGINE_CLOSURE__',{value:true});
const VERSION='5.8.17-R10.9',FL=Number(root.FL)||105,FW=Number(root.FW)||68,EPS=1e-7;
const finite=(v,f=0)=>Number.isFinite(v)?v:f;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b,c,d)=>Math.hypot(finite(a)-finite(c),finite(b)-finite(d));
const speed=b=>Math.hypot(finite(b&&b.vx),finite(b&&b.vy),finite(b&&b.vz));
const key=p=>p?String(p.team)+':'+String(p.idx??p.id??(p.ref&&p.ref.id)??'?'):null;
const name=p=>p&&p.ref&&p.ref.n||p&&p.name||key(p)||'—';
function diag(sim){return sim.__r10||(sim.__r10={version:VERSION,boundaryRecoveries:0,stationaryNudges:0,physicalRecoveries:0,administrativeTransfers:0,contactTransfers:0,turnoversCancelled:0,substitutionOwnerSwaps:0,passTargetsClamped:0,passAnglesClamped:0,unresolvedPassRecoveries:0,plannedContactsRebased:0,timelineFramesDiscarded:0,timelineEventsCompacted:0,maxStationaryObserved:0,staleActorTransfersBlocked:0,staleContactsRebased:0,staleOwnersReleased:0,invalidOwnerFrames:0,maxOwnedStationaryObserved:0,quickCupMatches:0,events:[]});}
function log(sim,type,data){const d=diag(sim),e=Object.assign({type,time:finite(sim.t),minute:finite(sim.minute),version:VERSION},data||{});d.events.push(e);if(d.events.length>500)d.events.splice(0,d.events.length-500);return e;}
function active(sim){return !!(sim&&sim.ball&&finite(sim.dead)<=0&&!sim.pendingRestart&&!sim.waiting);}
function admin(sim){return !!(sim&&(!sim.ball||sim.__p04AdminPermit||finite(sim.dead)>0||sim.pendingRestart||sim.waiting));}
function allPlayers(sim){const a=[];for(const tm of sim.teams||[])for(const p of tm.players||[])if(p&&!p.red)a.push(p);return a;}
function playerHeight(p){const cm=p&&p.ref&&p.ref.profileV3&&p.ref.profileV3.heightCmSim;return clamp(Number.isFinite(cm)?cm/100:(p&&p.isGK?1.88:1.80),1.55,2.08);}
function reach(p,z,boundary){if(!p)return 0;let r=p.isGK?(z>.7?1.16:1.22):(z>.62?0.82:1.03);if(boundary)r+=.18;return r;}
function contact(sim,p,type,radius){const b=sim.ball,z=Math.max(0,finite(b.z)),d=dist(b.x,b.y,p.x,p.y),r=radius||reach(p,z,false);return{type:type||'recovery',source:'r10_contact_contract',actorId:key(p),actorName:name(p),player:p,x:finite(b.x),y:finite(b.y),z,surface:p.isGK?(z>.7?'hand_or_body':'foot_or_low_hand'):(z>.62?'body_or_head':'foot'),distance:d,radius:r,t:1,incomingVelocity:{x:finite(b.vx),y:finite(b.vy),z:finite(b.vz)}};}
function record(sim,c,kind){try{if(typeof sim._recordVisualContact==='function')sim._recordVisualContact(kind||c.type,c.player,c.x,c.y,{source:c.source,z:c.z,surface:c.surface,distance:c.distance,contactRadius:c.radius,incomingVelocity:c.incomingVelocity,outgoingVelocity:{x:0,y:0,z:0},receiverId:c.actorId});}catch(_){} log(sim,'physical_contact',Object.assign({},c,{player:undefined}));}
function rosterPlayer(sim,p){if(!sim||!p||!sim.teams||!sim.teams[p.team])return null;const tm=sim.teams[p.team],idx=Number.isInteger(p.idx)?p.idx:(tm.players||[]).indexOf(p);return idx>=0&&tm.players&&tm.players[idx]&&!tm.players[idx].red?tm.players[idx]:null;}
function activePlayer(sim,p){return !!p&&rosterPlayer(sim,p)===p;}
function revalidateStaleContact(sim,p,c){const live=rosterPlayer(sim,p);if(!live||live===p)return live===p?{player:p,contact:c}:null;const b=sim.ball,z=Math.max(0,finite(b&&b.z)),boundary=b&&(b.x<1.1||b.x>FL-1.1||b.y<1.1||b.y>FW-1.1),r=reach(live,z,boundary),d=b?dist(b.x,b.y,live.x,live.y):Infinity;if(c&&d<=r&&z<=playerHeight(live)+.42){const nc=contact(sim,live,c.type||'stale_actor_recovery',r);nc.source='r10_stale_actor_revalidated';diag(sim).staleContactsRebased++;log(sim,'stale_contact_rebased',{from:key(p),to:key(live),distance:d,radius:r});return{player:live,contact:nc};}diag(sim).staleActorTransfersBlocked++;log(sim,'stale_actor_transfer_blocked',{actor:key(p),replacement:key(live),distance:d,radius:r,contactType:c&&c.type||null});return null;}
function transfer(sim,p,c,token){if(!p||p.red)return false;const b=sim.ball,prev=b&&b.owner,live=rosterPlayer(sim,p);
 if(live!==p){if(token&&live){p=live;}else{const rebased=revalidateStaleContact(sim,p,c);if(!rebased)return false;p=rebased.player;c=rebased.contact;}}
 if(token){const old=sim.__p04AdminPermit;sim.__p04AdminPermit=true;try{const r=sim._giveBall(p);if(b&&b.owner===p){diag(sim).administrativeTransfers++;b.__p04LastOwnerTransferContactActor=p;b.__p04LastOwnerTransferContactTime=finite(sim.t);}return r!==false;}finally{sim.__p04AdminPermit=old;}}
 if(!c)return false;const old=sim.__p04ContactPermit;sim.__p04ContactPermit={player:p,actorId:c.actorId,time:finite(sim.t),contact:c,type:c.type};try{const r=sim._giveBall(p);if(b&&b.owner===p){b.__p04LastOwnerTransferContactActor=p;b.__p04LastOwnerTransferContactTime=finite(sim.t);b.__p04LastPhysicalContact=c;diag(sim).contactTransfers++;record(sim,c,c.type);}return r!==false;}finally{sim.__p04ContactPermit=old;}}
P.transferPossession=function(player,contract){if(contract&&contract.administrative)return transfer(this,player,null,contract);if(contract&&contract.contact)return transfer(this,player,contract.contact,null);return false;};

/* Substituição troca a identidade do jogador na mesma coordenada. Não é uma
   tomada de posse e recebe um token administrativo explícito. */
const oldSub=P.substitute;
if(typeof oldSub==='function')P.substitute=function(team,outIdx,inPlayer){const tm=this.teams&&this.teams[team],out=tm&&tm.players&&tm.players[outIdx],owned=!!(this.ball&&this.ball.owner===out),r=oldSub.apply(this,arguments);if(r&&owned){const np=tm.players[outIdx];this.ball.__p04LastOwnerTransferContactActor=np;this.ball.__p04LastOwnerTransferContactTime=finite(this.t);this.ball.__r10AdministrativeOwnerSwap=true;diag(this).substitutionOwnerSwaps++;log(this,'administrative_substitution_owner_swap',{from:key(out),to:key(np)});}return r;};

/* Turnover abstrato vira contato físico. Se o vencedor não alcançou a bola, o
   resultado é cancelado em vez de produzir posse/teleporte. */
const oldTurn=P._turnover;
P._turnover=function(p){if(!p||p.red)return false;if(admin(this))return transfer(this,p,null,{administrative:true,reason:'restart'});const b=this.ball,z=Math.max(0,finite(b.z)),boundary=b.x<1.1||b.x>FL-1.1||b.y<1.1||b.y>FW-1.1,r=reach(p,z,boundary)+(b.owner&&b.owner!==p?.10:0),d=dist(b.x,b.y,p.x,p.y);if(d<=r&&z<=playerHeight(p)+.42){return transfer(this,p,contact(this,p,b.owner?'possession_challenge':'loose_recovery',r),null);}diag(this).turnoversCancelled++;log(this,'turnover_cancelled_no_contact',{candidate:key(p),distance:d,radius:r,previousOwner:key(b.owner)});if(!b.owner){b.__p04PendingReceiver=p;b.__p04PendingUntil=finite(this.t)+1.2;b.__p04Live=true;}return false;};

/* Planejamento de contatos: só rebasa para um ponto que o agente consegue
   alcançar. Isso evita decidir "bloqueio" e descobrir no callback que não houve
   corpo no ponto. */
const oldStart=P._startTravel;
P._startTravel=function(o,target,kind,onArrive,receiver,passKind,meta){const b=this.ball||{},m=meta||{},origin={x:finite(b.x,o&&o.x),y:finite(b.y,o&&o.y)},pk=passKind||kind;
 if(target&&kind==='pass'&&receiver&&!m.actor){const ox=origin.x,oy=origin.y,rx=finite(receiver.x),ry=finite(receiver.y),baseAng=Math.atan2(ry-oy,rx-ox),tx=finite(target.x,rx),ty=finite(target.y,ry),off=dist(tx,ty,rx,ry),maxOff=pk==='through'?9.5:pk==='launch'?6.5:3.0;if(off>maxOff){const q=maxOff/Math.max(EPS,off);target.x=rx+(tx-rx)*q;target.y=ry+(ty-ry)*q;diag(this).passTargetsClamped++;}
   const vx=finite(target.x)-ox,vy=finite(target.y)-oy,len=Math.max(EPS,Math.hypot(vx,vy)),ang=Math.atan2(vy,vx),norm=a=>{while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a;},lim=(pk==='through'?25:pk==='launch'?35:18)*Math.PI/180,delta=norm(ang-baseAng);if(Math.abs(delta)>lim){const ca=baseAng+Math.sign(delta)*lim;target.x=clamp(ox+Math.cos(ca)*len,.5,FL-.5);target.y=clamp(oy+Math.sin(ca)*len,.5,FW-.5);diag(this).passAnglesClamped++;}
 }
 if(target&&m.actor&&typeof this._actorInterceptTarget==='function'){const fq=(a,k,f)=>{try{return typeof root.facet==='function'?finite(root.facet(a,k),f):f;}catch(_){return f;}},passQ=fq(o,'pass',70),shotQ=fq(o,'shot',70),_c14=root.ENGINE_CALIBRATION||{},_sh=_c14.shooting||{},_pa=_c14.passing||{},passPow=(typeof _pa.powerBase==='number'?_pa.powerBase:.92)+passQ/100*(typeof _pa.powerRange==='number'?_pa.powerRange:.16),estimate=kind==='shot'?clamp((typeof _sh.speedBase==='number'?_sh.speedBase:34)+shotQ/100*(typeof _sh.speedRange==='number'?_sh.speedRange:16),(typeof _sh.speedMin==='number'?_sh.speedMin:32),(typeof _sh.speedMax==='number'?_sh.speedMax:54)):(pk==='launch'?(typeof _pa.speedLaunch==='number'?_pa.speedLaunch:22.5):pk==='through'?(typeof _pa.speedThrough==='number'?_pa.speedThrough:19.5)*passPow:(typeof _pa.speedShort==='number'?_pa.speedShort:16.2)*passPow),rad=Number.isFinite(m.contactRadius)?m.contactRadius:(m.actor.isGK?1.9:1.35);let hit=null;try{hit=m.actor.isGK&&kind==='shot'&&typeof this._gkInterceptTarget==='function'?this._gkInterceptTarget(m.actor,origin.x,origin.y,target,estimate,rad):this._actorInterceptTarget(m.actor,origin.x,origin.y,target,estimate,rad,kind,pk);}catch(_){}if(hit){target.x=hit.x;target.y=hit.y;target.z=hit.z;m.interceptT=hit.t;m.targetZ=hit.z;diag(this).plannedContactsRebased++;}}
 const r=oldStart.call(this,o,target,kind,onArrive,receiver,passKind,m);if(kind==='pass'&&this.ball){const now=finite(this.t),eta=Math.max(.1,finite(this.ball._timeout,1));this.ball.__r10Pass={start:now,expectedArrival:now+eta,hardDeadline:now+eta+8.0,receiver:receiver||null,kind:pk,bestDistance:Infinity,lastProgress:now};}return r;};

/* Pequena tolerância numérica para um agente que concluiu 100% do plano de
   contato. Não aprova agentes distantes nem alturas impossíveis. */
const oldPCV=P._physicalContactValid;
if(typeof oldPCV==='function')P._physicalContactValid=function(actor,radius,z){const r=oldPCV.apply(this,arguments);if(r.ok||!actor)return r;const b=this.ball,plan=actor._physicalContactPlan,pt=plan&&plan.contactPoint,meta=b&&b.meta,target=b&&b.target,formalTarget=meta&&meta.actor===actor&&target&&dist(target.x,target.y,b.x,b.y)<=.22,plannedPoint=plan&&pt&&dist(pt.x,pt.y,b.x,b.y)<=.22;if((formalTarget||plannedPoint)&&r.horizontal<=finite(radius,1.2)+.18&&r.z<=r.maxZ+.10){r.ok=true;r.r10PlanTolerance=true;r.r10FormalTarget=!!formalTarget;}return r;};

function nearest(sim){let best=null,bd=Infinity;for(const p of allPlayers(sim)){const d=dist(sim.ball.x,sim.ball.y,p.x,p.y);if(d<bd){bd=d;best=p;}}return{player:best,distance:bd};}
function recover(sim,dt){const b=sim.ball,d=diag(sim);if(!active(sim)||b.owner||b.traveling){b.__r10Stationary=0;return;}
 if(b.x<0||b.x>FL||b.y<0||b.y>FW){if(typeof sim._ballOut==='function'){d.boundaryRecoveries++;log(sim,'out_of_play_resolved',{x:b.x,y:b.y});sim._ballOut();}return;}
 const v=Math.hypot(finite(b.vx),finite(b.vy));b.__r10Stationary=v<.25?finite(b.__r10Stationary)+dt:0;d.maxStationaryObserved=Math.max(d.maxStationaryObserved,b.__r10Stationary);
 const preferred=b.__p04PendingReceiver&&finite(sim.t)<=finite(b.__p04PendingUntil)?b.__p04PendingReceiver:null,n=preferred&&activePlayer(sim,preferred)?{player:preferred,distance:dist(b.x,b.y,preferred.x,preferred.y)}:nearest(sim),p=n.player,boundary=b.x<1.25||b.x>FL-1.25||b.y<1.25||b.y>FW-1.25,rr=p?reach(p,b.z,boundary):0;
 if(p&&n.distance<=rr&&b.z<=playerHeight(p)+.42){if(transfer(sim,p,contact(sim,p,'second_ball_recovery',rr),null)){d.physicalRecoveries++;b.__r10Stationary=0;return;}}
 if(!p)return;
 // O jogador recebe um alvo alcançável dentro do campo; a bola não é entregue.
 p._tx=clamp(b.x,1.0,FL-1.0);p._ty=clamp(b.y,1.0,FW-1.0);
 if(b.__r10Stationary>.28){let tx=finite(p.x),ty=finite(p.y);if(boundary){tx=clamp(tx,1.4,FL-1.4);ty=clamp(ty,1.4,FW-1.4);}const dx=tx-b.x,dy=ty-b.y,L=Math.max(EPS,Math.hypot(dx,dy)),imp=boundary?2.35:1.65;b.vx=dx/L*imp;b.vy=dy/L*imp;b.vz=Math.min(0,finite(b.vz));b._looseT=0;b.__p04Live=true;b.__r10Stationary=0;d.stationaryNudges++;if(boundary)d.boundaryRecoveries++;log(sim,boundary?'boundary_recovery_impulse':'stationary_recovery_impulse',{player:key(p),distance:n.distance,v:imp});}
}
const oldLoose=P._looseRoll;
if(typeof oldLoose==='function')P._looseRoll=function(dt){const r=oldLoose.apply(this,arguments);recover(this,clamp(finite(dt,1/30),1/240,.12));return r;};

/* Timeline: objetos finalizados já são imutáveis, portanto retornar um slice é
   seguro e evita clonar 180 timelines em todo frame do auditor. */
P.getPhysicalTimeline=function(){return (this.physicsTimeline||[]).slice();};
const oldFinalize=P._finalizePhysicsEvent;
if(typeof oldFinalize==='function')P._finalizePhysicsEvent=function(reason){const ev=this._physicsActive;if(ev&&Array.isArray(ev.visualFrames)){const material=new Set(['goal','save','catch','parry','block','intercept','post','rebound','punch','wall','foot_save']),out=String(ev.meta&&ev.meta.outcome||ev.result&&ev.result.type||reason||''),max=material.has(out)?25:3,src=ev.visualFrames;if(src.length>max){const kept=[];for(let i=0;i<max;i++)kept.push(src[Math.round(i*(src.length-1)/(max-1))]);diag(this).timelineFramesDiscarded+=src.length-kept.length;diag(this).timelineEventsCompacted++;ev.visualFrames=kept;}}
 const r=oldFinalize.apply(this,arguments);if(this.physicsTimeline&&this.physicsTimeline.length>72)this.physicsTimeline.splice(0,this.physicsTimeline.length-72);return r;};

function releaseInvalidOwner(sim,reason){const b=sim&&sim.ball,o=b&&b.owner;if(!o||activePlayer(sim,o))return false;const live=rosterPlayer(sim,o),d=diag(sim);d.staleOwnersReleased++;log(sim,'stale_owner_released',{reason:reason||'step_guard',owner:key(o),replacement:key(live),x:finite(b.x),y:finite(b.y)});b.owner=null;b.traveling=false;b.__p04Live=true;b.__p04PendingReceiver=live||null;b.__p04PendingUntil=finite(sim.t)+1.5;b.vx=finite(o.vx);b.vy=finite(o.vy);b.vz=finite(b.vz);if(Math.hypot(b.vx,b.vy)<.35&&live){const dx=live.x-b.x,dy=live.y-b.y,L=Math.max(EPS,Math.hypot(dx,dy));b.vx=dx/L*1.65;b.vy=dy/L*1.65;}return true;}
function auditOwnedState(sim,dt){const b=sim&&sim.ball,d=diag(sim);if(!b||!b.owner){if(b)b.__r10OwnedStationary=0;return;}if(!activePlayer(sim,b.owner)){d.invalidOwnerFrames++;releaseInvalidOwner(sim,'owned_state_audit');return;}const ov=Math.hypot(finite(b.owner.vx),finite(b.owner.vy)),bv=Math.hypot(finite(b.vx),finite(b.vy));b.__r10OwnedStationary=(ov<.12&&bv<.12&&active(sim))?finite(b.__r10OwnedStationary)+dt:0;d.maxOwnedStationaryObserved=Math.max(d.maxOwnedStationaryObserved,b.__r10OwnedStationary);}
const oldStep=P.step;
if(typeof oldStep==='function')P.step=function(dt){const dd=clamp(finite(dt,1/30),1/240,.12);releaseInvalidOwner(this,'pre_step');const r=oldStep.apply(this,arguments),b=this.ball;releaseInvalidOwner(this,'post_step');recover(this,dd);auditOwnedState(this,dd);if(b&&b.__r10Pass){const w=b.__r10Pass,now=finite(this.t);if(b.owner||admin(this)){b.__r10Pass=null;}else{const n=nearest(this),dNow=finite(n.distance,Infinity);if(dNow+0.15<finite(w.bestDistance,Infinity)){w.bestDistance=dNow;w.lastProgress=now;}const elapsedAfterArrival=now-finite(w.expectedArrival,now),currentSpeed=Math.hypot(finite(b.vx),finite(b.vy)),physicallyStalled=elapsedAfterArrival>.35&&!b.traveling&&currentSpeed<.25&&finite(b.__r10Stationary)>.35,genuinelyUnresolved=now>finite(w.hardDeadline,now+1);if(physicallyStalled||genuinelyUnresolved){diag(this).unresolvedPassRecoveries++;if(n.player){b.__p04PendingReceiver=n.player;b.__p04PendingUntil=now+3.6;if(currentSpeed<1.25||genuinelyUnresolved){const dx=n.player.x-b.x,dy=n.player.y-b.y,L=Math.max(EPS,Math.hypot(dx,dy)),imp=clamp(n.distance/1.55,2.0,3.8);b.vx=dx/L*imp;b.vy=dy/L*imp;b.vz=Math.min(0,finite(b.vz));b.__p04Live=true;b._looseT=0;}}log(this,'pass_progress_watchdog_recovery',{kind:w.kind,receiver:key(w.receiver),nearest:key(n.player),distance:n.distance,elapsedAfterArrival,secondsWithoutProgress:now-finite(w.lastProgress,w.start),speed:currentSpeed,reason:physicallyStalled?'stationary':'hard_timeout'});b.__r10Pass=null;}}}
 return r;};


/* R10.4 · partidas automáticas da Copa usam a mesma física e dt, mas não
   alocam timeline/replay/apresentação que nunca será exibida. */
if(root.CUP&&!root.CUP.__r104SafeQuick){
  const addQuickScorers=(cup,res)=>{for(const s of (res&&res.scorers)||[]){if(!s.p)continue;const k=s.sid+':'+s.p.n;(cup.scorers[k]=cup.scorers[k]||{n:s.p.n,sid:s.sid,gols:0}).gols++;}};
  root.CUP.simQuick=function(db,hSid,aSid,ko,cup){
    const A=root.CUP.teamFor(db,hSid,aSid,cup),B=root.CUP.teamFor(db,aSid,hSid,cup),scorers=[];let sim=null;
    try{
      sim=new root.MatchSim(A,B,{labMode:true,onEvent:e=>{if(e&&e.type==='goal'&&e.by){const ref=e.by.ref||{};scorers.push({sid:e.by.team===0?hSid:aSid,p:{id:ref.id,n:ref.n||e.by.name||'—'},min:e.minute||0});}}});
      sim.setInteractive&&sim.setInteractive(0);
      sim._beginPhysicsEvent=function(){this._physicsActive=null;return null;};
      sim._capturePhysicsFrame=function(){};
      sim._finalizePhysicsEvent=function(){this._physicsActive=null;return null;};
      sim._recordVisualContact=function(){};
      const dt=1/30;let guard=0;while(!sim.isOver()&&guard++<60000)sim.step(dt);
      if(!sim.isOver())throw new Error('CUP_MATCH_GUARD_EXCEEDED:'+hSid+':'+aSid+':'+JSON.stringify({guard,minute:sim.minute,score:sim.score,r10:sim.getR10Report&&sim.getR10Report()}));
      let pens=null;if(ko&&sim.score[0]===sim.score[1]){sim.beginExtraTime();guard=0;while(!sim.isOver()&&guard++<30000)sim.step(dt);if(!sim.isOver())throw new Error('CUP_EXTRA_TIME_GUARD_EXCEEDED:'+hSid+':'+aSid);if(sim.score[0]===sim.score[1])pens=root.CUP.shootout(sim).score;}
      if(cup&&root.CDS_PHASE10)root.CDS_PHASE10.recordSimulation(cup,sim,[A,B],{stage:cup.phase});
      const stats=JSON.parse(JSON.stringify(sim.stats||[]));diag(sim).quickCupMatches++;
      return{g:[sim.score[0],sim.score[1]],pens,scorers,stats,guardSafe:true,steps:guard};
    }finally{if(sim){if(root.__CDS_ACTIVE_SIM===sim)root.__CDS_ACTIVE_SIM=null;sim._physicsActive=null;if(Array.isArray(sim.physicsTimeline))sim.physicsTimeline.length=0;if(Array.isArray(sim.physicsGallery))sim.physicsGallery.length=0;if(Array.isArray(sim.visualContacts))sim.visualContacts.length=0;if(Array.isArray(sim.events))sim.events.length=0;}}
  };
  root.CUP.playGroupRound=function(cup,db,skipPlayerMatch){const played=[],round=cup.round;for(const g of cup.groups)for(const m of cup.results[g.name]){if(m.round!==round||m.g)continue;const isPlayers=m.h===cup.playerSid||m.a===cup.playerSid;if(isPlayers&&skipPlayerMatch)continue;const res=root.CUP.simQuick(db,m.h,m.a,false,cup);m.g=res.g;addQuickScorers(cup,res);played.push(Object.assign({},m,{group:g.name}));}return played;};
  root.CUP.playKnockoutStage=function(cup,db,skipPlayerMatch){const stage=cup.ko[cup.phase],played=[];for(const m of stage){if(m.g)continue;const isPlayers=m.h===cup.playerSid||m.a===cup.playerSid;if(isPlayers&&skipPlayerMatch)continue;const res=root.CUP.simQuick(db,m.h,m.a,true,cup);m.g=res.g;m.pens=res.pens;addQuickScorers(cup,res);played.push(m);}return played;};
  Object.defineProperty(root.CUP,'__r104SafeQuick',{value:true});
}

P.getR10Report=function(){const d=JSON.parse(JSON.stringify(diag(this)));return{version:VERSION,status:(d.maxStationaryObserved<=.5&&d.unresolvedPassRecoveries===0&&d.invalidOwnerFrames===0&&d.staleActorTransfersBlocked===0&&d.maxOwnedStationaryObserved<=1.5)?'CANDIDATE':'NEEDS_REGRESSION',diagnostics:d,p04:typeof this.getP04ValidationReport==='function'?this.getP04ValidationReport():null};};
root.CDS_R10=Object.freeze({version:VERSION,installed:true,getReport:sim=>sim&&typeof sim.getR10Report==='function'?sim.getR10Report():{version:VERSION,error:'MatchSim required'}});
})(typeof window!=='undefined'?window:globalThis);

