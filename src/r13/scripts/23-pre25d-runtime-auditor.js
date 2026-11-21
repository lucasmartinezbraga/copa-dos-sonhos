
/* Copa dos Sonhos · Pré-2.5D · Auditor runtime v0.4 */
(function installPre25DAuditor(root){
'use strict';
const MatchSim=root&&root.MatchSim;if(!MatchSim||!MatchSim.prototype)return;
const P=MatchSim.prototype;if(P.__CDS_PRE25D_AUDITOR_V04__)return;
Object.defineProperty(P,'__CDS_PRE25D_AUDITOR_V04__',{value:true});
const VERSION='0.4.0',DT=1/60,MAX_EVENTS=1200;
const finite=(v,f=0)=>Number.isFinite(v)?v:f;
const dist=(a,b,c,d)=>Math.hypot(finite(a)-finite(c),finite(b)-finite(d));
const aid=p=>{if(!p)return null;const local=p.ref&&p.ref.id!=null?p.ref.id:(p.id!=null?p.id:(p.idx!=null?p.idx:'?'));return String(p.team!=null?p.team:'?')+':'+String(local);};
const important=new Set(['goal','save','blocked','intercept','post','gk_claim','gk_sweep','gk_punch','header','tackle']);
function players(sim){const out=[];for(const t of sim.teams||[])for(const p of t.players||[])if(p&&!p.red)out.push(p);return out;}
function ballSample(b){return b?{x:finite(b.x),y:finite(b.y),z:finite(b.z),vx:finite(b.vx),vy:finite(b.vy),vz:finite(b.vz),owner:aid(b.owner)}:null;}
function state(sim){const b=ballSample(sim.ball);return{t:finite(sim.t),ball:b,players:players(sim).map(p=>({id:aid(p),x:finite(p.x),y:finite(p.y),vx:finite(p.vx),vy:finite(p.vy)}))};}
function ensure(sim){if(!sim.__pre25dAudit)sim.__pre25dAudit={version:VERSION,frames:0,matchesObserved:0,ballTeleports:0,playerTeleports:0,nonFinite:0,outOfBounds:0,ownerChanges:0,ownerChangesWithoutContact:0,legacyCriticalEvents:0,invalidTimelines:0,openTimelineFrames:0,maxBallStep:0,maxPlayerStep:0,maxNonAdminPlayerStep:0,collisionCorrections:0,maxBallAllowed:0,lastOwner:null,eventCounts:{},events:[]};return sim.__pre25dAudit;}
function log(sim,type,data){const a=ensure(sim);a.events.push(Object.assign({type,time:finite(sim.t),minute:finite(sim.minute)},data||{}));if(a.events.length>MAX_EVENTS)a.events.splice(0,a.events.length-MAX_EVENTS);}
function admin(sim){return !!sim.__p04AdminPermit||finite(sim.dead)>0||!!sim.pendingRestart||!!sim.waiting;}
function recentContact(sim,owner,dt){const b=sim.ball;return !!(b&&b.__p04LastOwnerTransferContactActor===owner&&Math.abs(finite(b.__p04LastOwnerTransferContactTime,-999)-finite(sim.t))<=dt+.0001);}
function inspect(sim,before,after,dt,wasAdmin){const a=ensure(sim);a.frames++;const isAdmin=!!wasAdmin||admin(sim);
 if(after.ball){const vals=[after.ball.x,after.ball.y,after.ball.z,after.ball.vx,after.ball.vy,after.ball.vz];if(!vals.every(Number.isFinite)){a.nonFinite++;log(sim,'non_finite_ball');}
  const FL=finite(root.FL,105),FW=finite(root.FW,68);if(!isAdmin&&(after.ball.x<-1||after.ball.x>FL+1||after.ball.y<-1||after.ball.y>FW+1||after.ball.z<-0.01)){a.outOfBounds++;log(sim,'ball_out_of_bounds',after.ball);}
  if(before.ball){const step=dist(before.ball.x,before.ball.y,after.ball.x,after.ball.y);const speed=Math.max(Math.hypot(before.ball.vx,before.ball.vy,before.ball.vz),Math.hypot(after.ball.vx,after.ball.vy,after.ball.vz));const allowed=Math.max(.22,speed*dt*1.8+.18);a.maxBallStep=Math.max(a.maxBallStep,step);a.maxBallAllowed=Math.max(a.maxBallAllowed,allowed);if(step>allowed+.08&&!isAdmin){a.ballTeleports++;log(sim,'ball_step_impossible',{step,allowed});}}
 }
 const bm=new Map(before.players.map(p=>[String(p.id),p]));for(const p of after.players){const q=bm.get(String(p.id));if(!q)continue;const step=dist(q.x,q.y,p.x,p.y),speed=Math.max(Math.hypot(q.vx,q.vy),Math.hypot(p.vx,p.vy));const allowed=Math.max(.28,speed*dt*1.8+.16),overlapLimit=.92;a.maxPlayerStep=Math.max(a.maxPlayerStep,step);if(!isAdmin)a.maxNonAdminPlayerStep=Math.max(a.maxNonAdminPlayerStep,step);if(step>allowed+.12&&!isAdmin){if(step<=overlapLimit){a.collisionCorrections++;log(sim,'player_overlap_correction',{actorId:p.id,step,kinematicAllowed:allowed,overlapLimit});}else{a.playerTeleports++;log(sim,'player_step_impossible',{actorId:p.id,step,allowed});}}}
 if(before.ball&&after.ball&&before.ball.owner!==after.ball.owner&&after.ball.owner!=null){a.ownerChanges++;const owner=sim.ball&&sim.ball.owner;if(!isAdmin&&!recentContact(sim,owner,dt)){a.ownerChangesWithoutContact++;log(sim,'owner_without_contact',{previousOwnerId:before.ball.owner,ownerId:after.ball.owner});}}
 if(sim._physicsActive)a.openTimelineFrames++;
 const C=root.CDS_25D_CONTRACTS;if(C&&typeof sim.getPhysicalTimeline==='function'){const list=sim.getPhysicalTimeline()||[],last=list[list.length-1];if(last&&last!==sim.__pre25dLastTimeline){sim.__pre25dLastTimeline=last;const r=C.validateTimeline(last);if(!r.ok){a.invalidTimelines++;log(sim,'invalid_timeline',{id:last.id||null,errors:r.errors});}}}
}
const stepName=['step','tick','update','_step'].find(n=>typeof P[n]==='function');
if(stepName){const old=P[stepName];P[stepName]=function(){const dt=Math.max(1/240,Math.min(.12,finite(arguments[0],DT))),wasAdmin=admin(this),wasOver=typeof this.isOver==='function'&&this.isOver();const before=state(this);const out=old.apply(this,arguments);inspect(this,before,state(this),dt,wasAdmin);if(!wasOver&&typeof this.isOver==='function'&&this.isOver())ensure(this).matchesObserved++;return out;};}
if(typeof P._emit==='function'){const old=P._emit;P._emit=function(type,payload){const a=ensure(this);a.eventCounts[type]=(a.eventCounts[type]||0)+1;if(important.has(type)&&!(payload&&payload.__physics)){a.legacyCriticalEvents++;log(this,'legacy_critical_event',{eventType:type});}return old.apply(this,arguments);};}
P.getPre25DAuditReport=function(){const a=ensure(this),p04=typeof this.getP04ValidationReport==='function'?this.getP04ValidationReport():null;const hard=(a.ballTeleports+a.playerTeleports+a.nonFinite+a.ownerChangesWithoutContact+a.invalidTimelines)+(p04&&p04.diagnostics?p04.diagnostics.ownerChangesWithoutContact:0);return JSON.parse(JSON.stringify({version:VERSION,status:hard===0?'READY_FOR_EXTENDED_REGRESSION':'BLOCKED',audit:a,p04,activeTimeline:!!this._physicsActive}));};
root.CDS_PRE25D_AUDITOR=Object.freeze({version:VERSION,getReport:sim=>sim&&typeof sim.getPre25DAuditReport==='function'?sim.getPre25DAuditReport():{version:VERSION,error:'MatchSim instance required'},downloadReport:function(sim){const report=this.getReport(sim),blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='COPA_DOS_SONHOS_PRE_2_5D_RUNTIME_AUDIT.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);}});
function boot(){if(!root.document||document.getElementById('cds-pre25d-audit-btn'))return;const b=document.createElement('button');b.id='cds-pre25d-audit-btn';b.textContent='AUDITOR PRÉ-2.5D';b.style.cssText='position:fixed;left:10px;bottom:10px;z-index:2147483000;border:1px solid #4b718b;border-radius:9px;background:#071522;color:#bfe9ff;padding:8px 10px;font:700 10px system-ui;opacity:.82';b.onclick=()=>{const sim=root.__CDS_ACTIVE_SIM;if(!sim){alert('Inicie uma partida primeiro.');return;}const r=sim.getPre25DAuditReport();const text=JSON.stringify(r,null,2);const w=window.open('','_blank');if(w)w.document.write('<pre style="white-space:pre-wrap;font:12px monospace">'+text.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</pre>');};document.body.appendChild(b);}
if(typeof document!=='undefined')(document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot());
})(typeof window!=='undefined'?window:globalThis);

