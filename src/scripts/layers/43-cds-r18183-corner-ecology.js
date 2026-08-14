/* R18.18.3 · BLOQUEIOS, DEFESAS DO GOLEIRO E ECOLOGIA DE ESCANTEIOS
   --------------------------------------------------------------------------
   Converte os últimos atalhos binários de escanteio em trajetórias físicas.
   O ramo escolhido pelo motor-base pode continuar consumindo o RNG histórico,
   mas _setCorner/_turnover/_looseBall/_deflectTo convergem para a MESMA
   resolução geométrica quando a causa é bloqueio, espalmada ou soco.
   O reinício continua autoritativo: linha cruzada + último toque. */
(function(root){
'use strict';
const M=root&&root.MatchSim;if(!M||!M.prototype)return;
const P=M.prototype;if(P.__r18183CornerEcology)return;P.__r18183CornerEcology=true;
const V='5.12.8-R18.18.3',FL=Number(root.FL)||105,FW=Number(root.FW)||68,CY=FW/2;
const finite=(v,d=0)=>Number.isFinite(v)?v:d;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>a&&b?Math.hypot(finite(a.x)-finite(b.x),finite(a.y)-finite(b.y)):999;
const teamOf=p=>p&&(p.team===0||p.team===1)?p.team:null;
const facetOf=(p,k,d=65)=>{try{const f=typeof root.facet==='function'?root.facet:(typeof facet==='function'?facet:null);return f?finite(f(p,k),d):d;}catch(_){return d;}};
function fresh(){return{
 version:V,blockResolutions:0,blockCorners:0,blockThrowIns:0,blockLive:0,
 saveParriesResolved:0,saveParryCorners:0,saveParryLive:0,
 punchesResolved:0,punchCorners:0,punchLive:0,
 emergencyClearCorners:0,boxDuelCorners:0,clearBehindPhysical:0,
 cornersResolved:0,cornerCause:{block:0,save:0,punch:0,clearance:0},
 contextLeaksCancelled:0,unprovenCornerCalls:0,unprovenSuppressed:0,defensiveTouchPhysicalized:0,events:[]
};}
function st(sim){return sim.__r18183||(sim.__r18183=fresh());}
function log(sim,type,data){const s=st(sim);s.events.push(Object.assign({type,time:+finite(sim.t).toFixed(3),minute:+finite(sim.minute).toFixed(2)},data||{}));if(s.events.length>320)s.events.splice(0,s.events.length-320);}
function normalize(x,y){const L=Math.max(.001,Math.hypot(x,y));return{x:x/L,y:y/L};}
function rayBoundary(x,y,vx,vy){
 const c=[];if(vx<-.03)c.push({edge:'endline_left',t:(0-x)/vx});if(vx>.03)c.push({edge:'endline_right',t:(FL-x)/vx});
 if(vy<-.03)c.push({edge:'touchline_top',t:(0-y)/vy});if(vy>.03)c.push({edge:'touchline_bottom',t:(FW-y)/vy});
 const q=c.filter(z=>z.t>0).map(z=>Object.assign(z,{x:x+vx*z.t,y:y+vy*z.t,d:Math.hypot(vx*z.t,vy*z.t)}))
  .filter(z=>z.x>=-.05&&z.x<=FL+.05&&z.y>=-.05&&z.y<=FW+.05).sort((a,b)=>a.t-b.t);
 return q[0]||null;
}
function outPoint(edge,x,y,pad=.94){
 if(edge==='touchline_top')return{x:clamp(x,1,FL-1),y:-pad};
 if(edge==='touchline_bottom')return{x:clamp(x,1,FL-1),y:FW+pad};
 if(edge==='endline_left')return{x:-pad,y:clamp(y,1,FW-1)};
 return{x:FL+pad,y:clamp(y,1,FW-1)};
}
function recent(q,sim,max=.34){return !!(q&&finite(sim.t)-finite(q.at)<max);}
function markCause(sim,cause,actor,attTeam,edge,source){
 const b=sim.ball||{};b.__r18183OutCause={cause,actorTeam:teamOf(actor),attTeam,edge,source,at:finite(sim.t)};
}
function travelDeflect(sim,p,spd){
 const old=sim.__r18183OldDeflect;if(typeof old!=='function')return false;
 sim.__r18183Resolving=true;try{return old.call(sim,p.x,p.y,spd);}finally{sim.__r18183Resolving=false;}
}
function clearBlockContext(sim){sim.__r18182RecentBlock=null;sim.__r122Deflection=null;sim.__r18183BlockCtx=null;}
function blockVector(sim,q){
 const b=sim.ball||{},def=q&&q.by,attTeam=q&&q.attTeam,atk=sim.teams&&sim.teams[attTeam],defTm=def&&sim.teams&&sim.teams[def.team];
 const goal=defTm&&defTm.goal||{x:attTeam===0?FL:0,y:CY},attackDir=atk?finite(atk.attackDir,goal.x>FL/2?1:-1):(goal.x>FL/2?1:-1);
 const inc=normalize(finite(q&&q.vx,attackDir),finite(q&&q.vy,0));
 const x=finite(b.x,finite(q&&q.x)),y=finite(b.y,finite(q&&q.y));
 let side=Math.sign(y-finite(goal.y,CY));if(!side)side=Math.sign(inc.y)||(((def&&def.idx)||0)%2?1:-1);
 const kind=String(q&&q.kind||'shot');
 let vx,vy;
 if(kind==='cross'){vx=attackDir*.48+inc.x*.22;vy=side*.90+inc.y*.10;}
 else if(kind==='header'){vx=attackDir*.68+inc.x*.34;vy=side*.62+inc.y*.18;}
 else{vx=attackDir*.78+inc.x*.30;vy=side*.54+inc.y*.16;}
 const n=normalize(vx,vy),hit=rayBoundary(x,y,n.x,n.y),danger=Math.abs(x-finite(goal.x));
 const endLimit=kind==='cross'?19.5:kind==='header'?20.5:22.5,touchLimit=kind==='cross'?10.5:8.8;
 return{x,y,goal,attackDir,kind,n,hit,danger,endLimit,touchLimit,def,attTeam};
}
function resolveBlock(sim,q,channel){
 if(!recent(q,sim,.38)||sim.__r18183Resolving)return false;
 const z=blockVector(sim,q),s=st(sim),b=sim.ball||{};s.blockResolutions++;
 clearBlockContext(sim);
 if(z.hit&&z.hit.edge.indexOf('endline')===0&&z.hit.d<=z.endLimit){
   const p=outPoint(z.hit.edge,z.hit.x,z.hit.y);b.owner=null;if(z.def)b.lastTouch=z.def;
   markCause(sim,'block',z.def,z.attTeam,z.hit.edge,'physical_'+z.kind+'_block');s.blockCorners++;
   log(sim,'block_corner',{channel,kind:z.kind,by:z.def&&z.def.idx,distance:+z.hit.d.toFixed(2),danger:+z.danger.toFixed(2),edge:z.hit.edge});
   travelDeflect(sim,p,9.4+clamp((22-z.danger)*.08,0,1.8));return true;
 }
 if(z.hit&&z.hit.edge.indexOf('touchline')===0&&z.hit.d<=z.touchLimit){
   const p=outPoint(z.hit.edge,z.hit.x,z.hit.y);b.owner=null;if(z.def)b.lastTouch=z.def;
   markCause(sim,'block',z.def,z.attTeam,z.hit.edge,'physical_'+z.kind+'_block');s.blockThrowIns++;
   log(sim,'block_throw_in',{channel,kind:z.kind,by:z.def&&z.def.idx,distance:+z.hit.d.toFixed(2),edge:z.hit.edge});
   travelDeflect(sim,p,8.7);return true;
 }
 const run=clamp(5.2+(22-z.danger)*.16,5.2,9.5),p={x:clamp(z.x+z.n.x*run,1.1,FL-1.1),y:clamp(z.y+z.n.y*run,1.1,FW-1.1)};
 b.owner=null;if(z.def)b.lastTouch=z.def;s.blockLive++;
 log(sim,'block_live',{channel,kind:z.kind,by:z.def&&z.def.idx,toX:+p.x.toFixed(2),toY:+p.y.toFixed(2),danger:+z.danger.toFixed(2)});
 travelDeflect(sim,p,8.6);return true;
}
function resolveSaveParry(sim,target,channel){
 const q=sim.__r18183SaveCtx;if(!q||sim.__r18183Resolving)return false;
 const b=sim.ball||{},ctx=q.ctx||{},g=ctx.g||{x:q.gk&&q.gk.team===0?0:FL,y:CY},tm=ctx.tm||sim.teams&&sim.teams[q.shooter&&q.shooter.team],attackDir=tm?finite(tm.attackDir,g.x>FL/2?1:-1):(g.x>FL/2?1:-1);
 const gk=q.gk,sec=clamp(facetOf(gk,'gk',65)/100,.25,1),hard=clamp(finite(ctx.atk,65)/100*(ctx.oneOnOne?1.08:1),.3,1.1),saveY=finite(ctx.saveTarget&&ctx.saveTarget.y,b.y),off=clamp(Math.abs(saveY-finite(g.y,CY))/3.35,0,1);
 let side=Math.sign(saveY-finite(g.y,CY));if(!side)side=Math.sign(finite(b.vy))||(((gk&&gk.idx)||0)%2?1:-1);
 const score=hard*.47+off*.34+(1-sec)*.25+(ctx.oneOnOne?.05:0),endDist=Math.abs(finite(b.x)-finite(g.x));
 const s=st(sim);s.saveParriesResolved++;sim.__r18183SaveCtx=null;
 if(score>=.56&&endDist<=9.6){
   const edge=finite(g.x)<FL/2?'endline_left':'endline_right',p=outPoint(edge,finite(g.x),clamp(finite(b.y)+side*(2.4+score*2.3),1,FW-1));
   b.owner=null;if(gk)b.lastTouch=gk;markCause(sim,'save',gk,q.shooter&&q.shooter.team,edge,'gk_parry');s.saveParryCorners++;
   log(sim,'save_parry_corner',{channel,gk:gk&&gk.idx,score:+score.toFixed(3),hard:+hard.toFixed(3),security:+sec.toFixed(3),offset:+off.toFixed(3)});
   travelDeflect(sim,p,9.4+hard*4.2);return true;
 }
 let p=null;if(target&&Number.isFinite(target.x)&&Number.isFinite(target.y)&&target.x>0&&target.x<FL&&target.y>0&&target.y<FW){p={x:target.x,y:target.y};}
 if(!p)p={x:clamp(finite(g.x)-attackDir*(4.2+(1-sec)*4.6),1.3,FL-1.3),y:clamp(finite(g.y)+side*(3.2+off*5.5),1.3,FW-1.3)};
 b.owner=null;if(gk)b.lastTouch=gk;s.saveParryLive++;
 log(sim,'save_parry_live',{channel,gk:gk&&gk.idx,score:+score.toFixed(3),toX:+p.x.toFixed(2),toY:+p.y.toFixed(2)});
 travelDeflect(sim,p,8.8+hard*4);return true;
}
function resolvePunch(sim,target,channel){
 const q=sim.__r18183PunchCtx;if(!q||sim.__r18183Resolving)return false;
 const b=sim.ball||{},gk=q.gk,tm=gk&&sim.teams&&sim.teams[gk.team],goal=tm&&tm.goal||{x:gk&&gk.team===0?0:FL,y:CY},attTeam=gk?1-gk.team:null,attackDir=attTeam!=null&&sim.teams&&sim.teams[attTeam]?finite(sim.teams[attTeam].attackDir,goal.x>FL/2?1:-1):(goal.x>FL/2?1:-1);
 const inc=normalize(finite(b.vx,attackDir),finite(b.vy,0)),crossY=finite(q.by&&q.by.y,CY);let side=Math.sign(finite(gk&&gk.y,b.y)-CY);if(!side)side=Math.sign(CY-crossY)||(((gk&&gk.idx)||0)%2?1:-1);
 const wide=Math.abs(crossY-CY)/CY,endDist=Math.abs(finite(b.x)-finite(goal.x)),towardGoal=Math.abs(inc.x)>.38;
 const score=wide*.42+clamp(Math.abs(finite(gk&&gk.y,CY)-CY)/10,0,1)*.26+(towardGoal?.22:0);
 const s=st(sim);s.punchesResolved++;sim.__r18183PunchCtx=null;
 if(score>=.60&&endDist<=5.5){
   const edge=finite(goal.x)<FL/2?'endline_left':'endline_right',p=outPoint(edge,finite(goal.x),clamp(finite(b.y)+side*(4.5+wide*3),1,FW-1));
   b.owner=null;if(gk)b.lastTouch=gk;markCause(sim,'punch',gk,attTeam,edge,'gk_punch');s.punchCorners++;
   log(sim,'punch_corner',{channel,gk:gk&&gk.idx,score:+score.toFixed(3),wide:+wide.toFixed(3)});travelDeflect(sim,p,11.2);return true;
 }
 let p=null;if(target&&Number.isFinite(target.x)&&Number.isFinite(target.y)&&target.x>0&&target.x<FL&&target.y>0&&target.y<FW)p={x:target.x,y:target.y};
 if(!p)p={x:clamp(finite(goal.x)-attackDir*(8+wide*4),1.2,FL-1.2),y:clamp(finite(b.y)+side*(8+wide*5),1.2,FW-1.2)};
 b.owner=null;if(gk)b.lastTouch=gk;s.punchLive++;
 log(sim,'punch_live',{channel,gk:gk&&gk.idx,toX:+p.x.toFixed(2),toY:+p.y.toFixed(2),score:+score.toFixed(3)});travelDeflect(sim,p,11.0);return true;
}
function resolveClearBehind(sim,channel){
 const q=sim.__r18183ClearBehindCtx;if(!q||sim.__r18183Resolving)return false;
 const b=sim.ball||{},def=q.by,tm=def&&sim.teams&&sim.teams[def.team],goal=tm&&tm.goal||{x:def&&def.team===0?0:FL,y:CY};let side=Math.sign(finite(b.y)-CY);if(!side)side=((def&&def.idx)||0)%2?1:-1;
 const edge=finite(goal.x)<FL/2?'endline_left':'endline_right',p=outPoint(edge,finite(goal.x),clamp(finite(b.y)+side*5.5,1,FW-1));
 sim.__r18183ClearBehindCtx=null;b.owner=null;if(def)b.lastTouch=def;markCause(sim,'clearance',def,def?1-def.team:null,edge,'clear_behind');st(sim).clearBehindPhysical++;
 log(sim,'clear_behind_physical',{channel,by:def&&def.idx,edge});travelDeflect(sim,p,10.2);return true;
}
function emergencyHeaderClear(sim,p){
 const q=sim.__r18182RecentClear;if(!recent(q,sim,.36)||!p||p!==q.by||p.isGK)return false;
 const tm=sim.teams&&sim.teams[p.team],goal=tm&&tm.goal;if(!goal)return false;
 const b=sim.ball||{},danger=dist(p,goal),pressure=(()=>{let z=99;for(const a of sim.teams[1-p.team].players||[])if(a&&!a.red)z=Math.min(z,dist(p,a));return z;})();
 const control=(facetOf(p,'def_position',65)+facetOf(p,'head_def',65)+facetOf(p,'compostura',65))/3,central=1-clamp(Math.abs(finite(b.y)-CY)/22,0,1),score=clamp((24.5-danger)/12,0,1)*.42+clamp((6.4-pressure)/6.4,0,1)*.28+central*.18+clamp((78-control)/28,0,1)*.12;
 if(danger>24.5||pressure>6.4||Math.abs(finite(b.y)-CY)>22||score<.31)return false;
 let side=Math.sign(finite(b.y)-CY);if(!side)side=((p.idx||0)%2?1:-1);const edge=finite(goal.x)<FL/2?'endline_left':'endline_right',pt=outPoint(edge,finite(goal.x),clamp(finite(b.y)+side*(5.2+clamp((6.4-pressure),0,2.8)),1,FW-1));
 sim.__r18182RecentClear=null;b.owner=null;b.lastTouch=p;markCause(sim,'clearance',p,1-p.team,edge,'emergency_header_clear');st(sim).emergencyClearCorners++;
 log(sim,'emergency_header_clear_corner',{by:p.idx,danger:+danger.toFixed(2),pressure:+pressure.toFixed(2),edge});travelDeflect(sim,pt,10.5);return true;
}


function boxDuelCorner(sim,p){
 const b=sim.ball||{},prev=b.owner;if(!prev||!p||prev===p||prev.isGK||p.isGK||teamOf(prev)===teamOf(p)||dist(prev,p)>2.95)return false;
 const tm=sim.teams&&sim.teams[p.team],goal=tm&&tm.goal;if(!goal)return false;
 const danger=dist({x:finite(b.x),y:finite(b.y)},goal),width=Math.abs(finite(b.y)-CY),now=finite(sim.t);
 if(danger>15.8||width>22.5||now-finite(sim.__r18183LastBoxDuel,-99)<6.2)return false;
 const inside=p.y<FW/2?finite(p.y)>=finite(prev.y)-.65:finite(p.y)<=finite(prev.y)+.65;
 if(!inside&&danger>10.5)return false;
 let side=Math.sign(finite(b.y)-CY);if(!side)side=((p.idx||0)%2?1:-1);const edge=finite(goal.x)<FL/2?'endline_left':'endline_right',pt=outPoint(edge,finite(goal.x),clamp(finite(b.y)+side*(4.8+clamp((15.8-danger)*.22,0,2.6)),1,FW-1));
 sim.__r18183LastBoxDuel=now;b.owner=null;b.lastTouch=p;markCause(sim,'clearance',p,1-p.team,edge,'box_duel_deflection');st(sim).boxDuelCorners++;
 log(sim,'box_duel_corner',{by:p.idx,on:prev.idx,danger:+danger.toFixed(2),width:+width.toFixed(2),inside});travelDeflect(sim,pt,8.9);return true;
}
const oldReset=P.reset;
const oldDeflect=P._deflectTo;
const oldGK=P._gkResolveSave;
const oldEmit=P._emit;
const oldSetCorner=P._setCorner;
const oldLoose=P._looseBall;
const oldTurn=P._turnover;
const oldBallOut=P._ballOut;
const oldGoalKick=P._goalKickOrRestart;
const oldStep=P.step;
P.__r18183OldDeflect=oldDeflect;

P.reset=function(){const r=oldReset.apply(this,arguments);this.__r18183=fresh();this.__r18183SaveCtx=null;this.__r18183PunchCtx=null;this.__r18183ClearBehindCtx=null;this.__r18183Resolving=false;return r;};
P._gkResolveSave=function(gk,o,ctx){this.__r18183SaveCtx={gk,shooter:o,ctx,at:finite(this.t)};try{return oldGK.apply(this,arguments);}finally{this.__r18183SaveCtx=null;}};
P._emit=function(type,data){const r=oldEmit.apply(this,arguments);try{if(type==='gk_punch'){this.__r18183PunchCtx={gk:data&&(data.gk||data.by),by:data&&data.by,at:finite(this.t),legacyCorner:!!(data&&data.corner)};}else if(type==='clear_behind'){this.__r18183ClearBehindCtx={by:data&&data.by,at:finite(this.t)};}else if(['goal','offside','foul','penalty','freekick','throw_in','goal_kick','kickoff'].includes(type)){this.__r18183PunchCtx=null;this.__r18183ClearBehindCtx=null;}}catch(_){}return r;};
P._setCorner=function(team){
 if(this.__r18183SaveCtx&&resolveSaveParry(this,null,'setCorner'))return;
 if(this.__r18183PunchCtx&&resolvePunch(this,null,'setCorner'))return;
 if(this.__r18183ClearBehindCtx&&resolveClearBehind(this,'setCorner'))return;
 const q=this.__r18182RecentBlock;if(recent(q,this,.38)&&q.attTeam===team&&resolveBlock(this,q,'setCorner'))return;
 /* Última barreira contra escanteio sem contato defensivo. Chamadas vindas de
    _ballOut têm a bola além da linha e último toque do defensor. Já failed
    cross/unreachable shot chegam aqui com último toque do próprio atacante. */
 const b=this.ball||{},last=teamOf(b.lastTouch),outEnd=finite(b.x)<=0||finite(b.x)>=FL;
 if(last===team||last==null){st(this).unprovenCornerCalls++;st(this).unprovenSuppressed++;this.__r18182RecentBlock=null;log(this,'unproven_corner_suppressed',{team,lastTeam:last,outEnd,x:+finite(b.x).toFixed(2),y:+finite(b.y).toFixed(2)});return oldGoalKick.call(this,1-team);}
 if(!outEnd&&last!==team){
   st(this).unprovenCornerCalls++;const vx=finite(b.vx),vy=finite(b.vy),L=Math.hypot(vx,vy),hit=L>.12?rayBoundary(finite(b.x),finite(b.y),vx/L,vy/L):null;
   if(hit&&hit.edge.indexOf('endline')===0&&hit.d<=26){const p=outPoint(hit.edge,hit.x,hit.y),def=b.lastTouch;b.owner=null;markCause(this,'block',def,team,hit.edge,'defensive_touch_continuation');st(this).defensiveTouchPhysicalized++;log(this,'defensive_touch_physicalized',{team,lastTeam:last,distance:+hit.d.toFixed(2),edge:hit.edge});travelDeflect(this,p,9.2);return;}
   st(this).unprovenSuppressed++;log(this,'unproven_defensive_corner_suppressed',{team,lastTeam:last,x:+finite(b.x).toFixed(2),y:+finite(b.y).toFixed(2)});return this._looseBall(clamp(finite(b.x),1,FL-1),clamp(finite(b.y),1,FW-1));
 }
 return oldSetCorner.apply(this,arguments);
};
P._looseBall=function(x,y){
 if(this.__r18183SaveCtx&&resolveSaveParry(this,{x,y},'looseBall'))return;
 if(this.__r18183PunchCtx&&resolvePunch(this,{x,y},'looseBall'))return;
 const q=this.__r18182RecentBlock;if(recent(q,this,.38)&&resolveBlock(this,q,'looseBall'))return;
 return oldLoose.apply(this,arguments);
};
P._turnover=function(p){
 if(boxDuelCorner(this,p))return true;
 const q=this.__r18182RecentBlock;if(recent(q,this,.38)&&p&&p===q.by&&resolveBlock(this,q,'turnover'))return true;
 if(emergencyHeaderClear(this,p))return true;
 return oldTurn.apply(this,arguments);
};
P._deflectTo=function(x,y,spd){
 if(this.__r18183Resolving)return oldDeflect.apply(this,arguments);
 if(this.__r18183SaveCtx&&resolveSaveParry(this,{x,y},'deflectTo'))return;
 if(this.__r18183PunchCtx&&resolvePunch(this,{x,y},'deflectTo'))return;
 const q=this.__r18182RecentBlock;if(recent(q,this,.38)&&resolveBlock(this,q,'deflectTo'))return;
 return oldDeflect.apply(this,arguments);
};
P._ballOut=function(){const b=this.ball||{},cause=b.__r18183OutCause||null,x=finite(b.x),isEnd=x<=0||x>=FL;const r=oldBallOut.apply(this,arguments);if(cause){const s=st(this);if(isEnd){s.cornersResolved++;if(s.cornerCause[cause.cause]!=null)s.cornerCause[cause.cause]++;}log(this,'physical_out_resolved',{cause:cause.cause,source:cause.source,edge:cause.edge,lastTeam:teamOf(b.lastTouch),x:+x.toFixed(2),y:+finite(b.y).toFixed(2)});b.__r18183OutCause=null;}return r;};
P.step=function(){const r=oldStep.apply(this,arguments),now=finite(this.t);for(const k of ['__r18183PunchCtx','__r18183ClearBehindCtx']){const q=this[k];if(q&&now-finite(q.at)>1.0){this[k]=null;st(this).contextLeaksCancelled++;}}return r;};
P.getR18183Audit=function(){const s=st(this),r13=this.getR13Audit?this.getR13Audit():null,corners=(this.stats||[]).reduce((n,x)=>n+finite(x&&x.corners),0),saves=(this.stats||[]).reduce((n,x)=>n+finite(x&&x.saves),0),punches=(this.stats||[]).reduce((n,x)=>n+finite(x&&x.gkPunches),0);return Object.assign({},s,{match:{corners,saves,punches},rates:{physicalCornerShare:corners?s.cornersResolved/corners:0,blockCornerRate:s.blockResolutions?s.blockCorners/s.blockResolutions:0,saveParryCornerRate:s.saveParriesResolved?s.saveParryCorners/s.saveParriesResolved:0},structural:this.getR12Audit?this.getR12Audit().status:null,observer:r13&&r13.status,gates:r13&&r13.gates});};
const oldFull=P.getFullFootballAudit;P.getFullFootballAudit=function(){const r=oldFull?oldFull.apply(this,arguments):{};r.cornerEcology=this.getR18183Audit();return r;};
root.CDS_R18183=Object.freeze({version:V,baseline:'R18.18.2',feature:'PHYSICAL_BLOCK_SAVE_PUNCH_CORNER_ECOLOGY',cornerLottery:false,lastTouchAuthoritative:true,blockConvergence:true,gkParryGeometry:true,gkPunchGeometry:true,rngConsumptionAdditional:false,xgBonus:false,speedBonus:false});
try{root.CDS_BUILD_ID='R18.18.3';root.CDS_VERSION=V;document.title='Copa dos Sonhos — R18.18.3';}catch(_){}
})(typeof window!=='undefined'?window:globalThis);
