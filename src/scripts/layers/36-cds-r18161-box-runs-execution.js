
/* R18.16.1 — EXECUÇÃO REAL DAS CORRIDAS OFENSIVAS NA ÁREA
   -------------------------------------------------------------------------
   Fecha a R18.16 transformando o planejamento de zonas em corridas físicas:
   - o plano nasce somente depois de passe, cruzamento ou chute já executado e permanece congelado;
   - cada jogador recebe função exclusiva, alvo congelado e atraso de reação;
   - atributos variam continuamente timing, prioridade e amplitude da corrida;
   - deslocamentos usam exclusivamente o integrador físico normal;
   - linha de impedimento, posição da bola e mudança de posse cancelam/limitam;
   - sem teleport, bônus de velocidade, bônus de xG ou consumo extra de RNG.

   Funções: primeiro poste, segundo poste, intervalo entre zagueiros, cutback,
   entrada atrasada e rebote. */
(function(root){
  'use strict';
  const M=root&&root.MatchSim;if(!M||!M.prototype)return;
  const P=M.prototype;if(P.__r18161BoxRuns)return;P.__r18161BoxRuns=true;
  const V='5.12.0-R18.16.1';
  const FL=Number(root.FL)||105,FW=Number(root.FW)||68,CY=FW/2;
  const finite=(v,d=0)=>Number.isFinite(v)?v:d;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const lerp=(a,b,t)=>a+(b-a)*t;
  const attr=(p,k,f=65)=>{try{const q=p&&p.ref?p.ref:p;if(q&&q.attributesV3&&Number.isFinite(q.attributesV3[k]))return q.attributesV3[k];const x=root.getAttr&&root.getAttr(q,k);if(Number.isFinite(x))return x;}catch(_){}return f;};
  const line=p=>{const s=p&&p.slotPos;if(!p||p.isGK||s==='GK')return'GK';if(['CB','LB','RB','LWB','RWB'].includes(s))return'DEF';if(['CDM','CM','CAM','LM','RM'].includes(s))return'MID';return'FWD';};
  const prog=(tm,x)=>tm.attackDir>0?finite(x):FL-finite(x);
  const unprog=(tm,x)=>tm.attackDir>0?x:FL-x;
  const dist=(p,t)=>Math.hypot(finite(p.x)-finite(t.x),finite(p.y)-finite(t.y));
  const dxy=(a,b)=>Math.hypot(finite(a[0])-finite(b.x),finite(a[1])-finite(b.y));
  const stats=sim=>sim.__r18161Stats||(sim.__r18161Stats={evaluations:0,plans:0,plansWide:0,plansCentral:0,plansShot:0,assignments:0,runsEligible:0,runsStarted:0,runsCompleted:0,runsCancelled:0,targetsFrozen:0,totalTargetShift:0,maxTargetShift:0,totalReactionDelay:0,roleFirstPost:0,roleFarPost:0,roleSplitCB:0,roleCutback:0,roleLateRun:0,roleRebound:0,iqTotal:0,priorityOverrides:0,offsidesClamped:0});
  const IQ={
    first_post:p=>attr(p,'antecipacao')*.24+attr(p,'movimentacao',attr(p,'posicionamento'))*.22+attr(p,'aceleracao')*.17+attr(p,'finalizacao')*.14+attr(p,'decisao')*.09+attr(p,'compostura')*.07+attr(p,'trabalho_equipe')*.04+attr(p,'forca')*.03,
    far_post:p=>attr(p,'cabeceio')*.22+attr(p,'impulsao')*.18+attr(p,'movimentacao',attr(p,'posicionamento'))*.17+attr(p,'antecipacao')*.15+attr(p,'forca')*.11+attr(p,'finalizacao')*.08+attr(p,'decisao')*.05+attr(p,'compostura')*.04,
    split_cb:p=>attr(p,'movimentacao',attr(p,'posicionamento'))*.24+attr(p,'antecipacao')*.21+attr(p,'finalizacao')*.15+attr(p,'forca')*.13+attr(p,'decisao')*.10+attr(p,'compostura')*.09+attr(p,'aceleracao')*.05+attr(p,'trabalho_equipe')*.03,
    cutback:p=>attr(p,'movimentacao',attr(p,'posicionamento'))*.22+attr(p,'decisao')*.18+attr(p,'finalizacao')*.17+attr(p,'compostura')*.15+attr(p,'antecipacao')*.13+attr(p,'primeiro_toque')*.08+attr(p,'trabalho_equipe')*.07,
    late_run:p=>attr(p,'aceleracao')*.21+attr(p,'antecipacao')*.20+attr(p,'movimentacao',attr(p,'posicionamento'))*.19+attr(p,'decisao')*.16+attr(p,'finalizacao')*.10+attr(p,'compostura')*.08+attr(p,'trabalho_equipe')*.06,
    rebound:p=>attr(p,'antecipacao')*.25+attr(p,'movimentacao',attr(p,'posicionamento'))*.21+attr(p,'decisao')*.17+attr(p,'compostura')*.12+attr(p,'chute_longe')*.10+attr(p,'primeiro_toque')*.08+attr(p,'trabalho_equipe')*.07
  };
  const POS={first_post:{ST:0,CF:.18,LW:.42,RW:.42,CAM:.55,CM:.9},far_post:{LW:0,RW:0,ST:.18,CF:.28,LM:.35,RM:.35,CAM:.65},split_cb:{ST:0,CF:.12,CAM:.45,LW:.72,RW:.72,CM:.82},cutback:{CAM:0,CM:.12,CF:.28,LM:.34,RM:.34,LW:.45,RW:.45,CDM:.78},late_run:{CAM:0,CM:.08,LM:.25,RM:.25,CF:.42,CDM:.55,LW:.68,RW:.68},rebound:{CM:0,CAM:.12,CDM:.18,LM:.32,RM:.32,CF:.52,ST:.72}};
  const roleIQ=(p,r)=>(IQ[r]||IQ.cutback)(p);
  const reactionDelay=iq=>clamp(.18-(iq-75)*.006,.055,.31);
  const runScale=iq=>clamp((iq-74)/16,0,1);
  const ROLE_SHIFT={first_post:.68,far_post:.72,split_cb:.66,cutback:.52,late_run:.70,rebound:.46};
  function cbGapY(sim,tm){const opp=sim.teams&&sim.teams[1-tm.side];if(!opp)return CY;let c=(opp.players||[]).filter(p=>p&&!p.red&&!p.isGK&&p.slotPos==='CB');if(c.length<2)c=(opp.players||[]).filter(p=>p&&!p.red&&!p.isGK&&line(p)==='DEF');c=c.slice().sort((a,b)=>prog(opp,b.x)-prog(opp,a.x)).slice(0,2);return c.length>=2?clamp((finite(c[0].y,CY)+finite(c[1].y,CY))/2,CY-7,CY+7):CY;}
  function onsideCap(sim,tm,bp){let off=FL-2;try{off=finite(sim._offsideLine(tm.side),FL-2);}catch(_){}return clamp(Math.max(bp-.18,off-.30),70,FL-2.1);}
  function zone(sim,tm,role,side,bp,gap){let rp=FL-11,ry=CY;if(role==='first_post'){rp=FL-6.8;ry=CY+side*4.5;}else if(role==='far_post'){rp=FL-7.6;ry=CY-side*6.4;}else if(role==='split_cb'){rp=FL-8.9;ry=gap;}else if(role==='cutback'){rp=FL-12.7;ry=CY+side*1.7;}else if(role==='late_run'){rp=FL-15.7;ry=CY-side*3.6;}else if(role==='rebound'){rp=FL-18.3;ry=CY+side*4.8;}if(role!=='late_run'&&role!=='rebound')rp=Math.min(rp,onsideCap(sim,tm,bp));return{x:unprog(tm,clamp(rp,70,FL-2.1)),y:clamp(ry,4,FW-4)};}
  function candidates(tm,owner,reserved){return (tm.players||[]).filter(p=>p&&!p.red&&!p.isGK&&p!==owner&&p!==reserved&&!p._setPieceRole&&(line(p)==='FWD'||['CAM','CM','LM','RM','CDM'].includes(p.slotPos)));}
  function choose(cand,used,role,target){
    const pool=cand.filter(p=>!used.has(p)).map(p=>{const iq=roleIQ(p,role),d=dist(p,target),pos=(POS[role]&&POS[role][p.slotPos]);const pp=Number.isFinite(pos)?pos:1.2;return{p,iq,d,posPenalty:pp,score:d+pp-iq*.025};}).sort((a,b)=>a.score-b.score||a.d-b.d||b.iq-a.iq);
    if(!pool.length)return null;
    const chosen=pool[0],nearest=pool.slice().sort((a,b)=>a.d-b.d)[0];used.add(chosen.p);
    return{player:chosen.p,role,iq:chosen.iq,zone:target,nearestPlayer:nearest.p,nearestDistance:nearest.d,distance:chosen.d,priorityOverride:chosen.p!==nearest.p,reaction:reactionDelay(chosen.iq),createdTarget:null,runTarget:null,started:false,completed:false,cancelled:false};
  }
  function cancelPlan(sim,tm,reason){const plan=tm&&tm._r18161BoxPlan;if(!plan||plan.cancelled)return;plan.cancelled=true;plan.cancelReason=reason||'context_changed';const st=stats(sim);for(const a of plan.assignments||[]){if(a.started&&!a.completed&&!a.cancelled){a.cancelled=true;st.runsCancelled++;}if(a.player&&a.player._r18161BoxRole&&a.player._r18161BoxRole.planId===plan.id)a.player._r18161BoxRole=null;}}
  P._r18161CreateFlightPlan=function(tm,actor,target,phase,receiver,deliveryKind){
    const st=stats(this),now=finite(this.t),b=this.ball;if(!tm||!actor||actor.team!==tm.side||finite(this.dead)>.04)return null;
    if(tm._r18161BoxPlan&&!tm._r18161BoxPlan.cancelled)cancelPlan(this,tm,'new_delivery');
    const bp=prog(tm,actor.x),side=finite(actor.y,CY)<CY?-1:1,gap=cbGapY(this,tm);
    const cand=candidates(tm,actor,receiver);if(cand.length<1)return null;
    let order,maxRoles=1;
    if(phase==='wide_cross'){const rel=(finite(target&&target.y,CY)-CY)*side;if(rel>2)order=['far_post'];else if(rel<-2)order=['first_post'];else order=['cutback'];}
    else if(phase==='central_box'){const targetProg=target?prog(tm,target.x):0;order=[targetProg>=91?'late_run':'split_cb'];}
    else order=['rebound'];
    const used=new Set(),assign=[];
    for(const r of order){const a=choose(cand,used,r,zone(this,tm,r,side,bp,gap));if(a)assign.push(a);if(assign.length>=maxRoles)break;}
    const byIdx={};for(const a of assign)byIdx[a.player.idx]=a;
    const flight=b&&b._physicsPlan&&b._physicsPlan.segment?finite(b._physicsPlan.segment.duration,.55):.55;
    const window=clamp(flight+.18,.45,.90);
    const plan={id:'r18161_'+tm.side+'_'+Math.round(now*1000)+'_'+finite(actor.idx),version:V,key:[finite(actor.idx),phase,Math.round(now*30)].join('|'),phase,ballSide:side,ballProg:bp,ownerIdx:finite(actor.idx),created:now,until:now+window,assignments:assign,byIdx,cancelled:false,deliveryTarget:target?{x:finite(target.x),y:finite(target.y)}:null};tm._r18161BoxPlan=plan;
    st.plans++;if(phase==='wide_cross')st.plansWide++;else if(phase==='central_box')st.plansCentral++;else st.plansShot++;
    for(const a of assign){st.assignments++;st.runsEligible++;st.iqTotal+=a.iq;st.totalReactionDelay+=a.reaction;if(a.priorityOverride)st.priorityOverrides++;if(a.role==='first_post')st.roleFirstPost++;else if(a.role==='far_post')st.roleFarPost++;else if(a.role==='split_cb')st.roleSplitCB++;else if(a.role==='cutback')st.roleCutback++;else if(a.role==='late_run')st.roleLateRun++;else st.roleRebound++;a.player._r18161BoxRole={planId:plan.id,role:a.role,iq:a.iq,reaction:a.reaction,zone:{x:a.zone.x,y:a.zone.y},until:plan.until};}
    return plan;
  };
  P._r18161ActivePlan=function(tm){const plan=tm&&tm._r18161BoxPlan,now=finite(this.t);if(!plan||plan.cancelled||plan.until<=now||this.poss!==tm.side)return null;return plan;};
  const oldStartTravel=P._startTravel;
  P._startTravel=function(actor,target,kind,onArrive,receiver,passKind,meta){
    const origin={x:actor&&finite(actor.x),y:actor&&finite(actor.y)},team=actor&&(actor.team===0||actor.team===1)?actor.team:null;
    const pk=passKind||kind;const r=oldStartTravel.apply(this,arguments);if(team==null||!actor||actor.isGK||actor._setPieceRole)return r;
    const tm=this.teams&&this.teams[team];if(!tm)return r;
    const ap=prog(tm,origin.x),tp=target?prog(tm,target.x):0,wide=Math.abs(finite(origin.y,CY)-CY)>=10.5,centralTarget=target&&Math.abs(finite(target.y,CY)-CY)<=13.5;
    let phase=null;
    if(kind==='pass'&&(pk==='launch'||pk==='through')&&ap>=76&&tp>=84&&centralTarget)phase=wide?'wide_cross':'central_box';
    else if(kind==='shot'&&ap>=79&&meta&&(meta.outcome==='save'||meta.outcome==='block'))phase='shot_rebound';
    if(phase)this._r18161CreateFlightPlan(tm,actor,target,phase,receiver,pk);
    return r;
  };
  function freezeRunTarget(sim,tm,p,a,base,plan){
    if(a.runTarget)return a.runTarget;
    const dx=a.zone.x-finite(base[0]),dy=a.zone.y-finite(base[1]),d=Math.hypot(dx,dy);if(d<.001)return null;
    const scale=runScale(a.iq);if(scale<=.03)return null;const maxShift=(ROLE_SHIFT[a.role]||.6)*scale,shift=Math.min(d,maxShift);if(shift<.05)return null;
    const xWeight=(a.role==='late_run'||a.role==='rebound')?.36:.22,wd=Math.hypot(dx*xWeight,dy)||1;
    let tx=finite(base[0])+(dx*xWeight)/wd*shift,ty=finite(base[1])+dy/wd*shift;
    if(!['late_run','rebound','cutback'].includes(a.role)){
      const bp=prog(tm,sim.ball&&sim.ball.x),cap=onsideCap(sim,tm,bp),tp=prog(tm,tx);
      if(tp>cap){tx=unprog(tm,cap);stats(sim).offsidesClamped++;}
    }
    a.createdTarget={x:finite(base[0]),y:finite(base[1])};a.runTarget={x:clamp(tx,1,FL-1),y:clamp(ty,2.5,FW-2.5),shift};
    const st=stats(sim);st.targetsFrozen++;st.totalTargetShift+=shift;st.maxTargetShift=Math.max(st.maxTargetShift,shift);
    p._r18161BoxTarget={planId:plan.id,role:a.role,iq:a.iq,reaction:a.reaction,x:a.runTarget.x,y:a.runTarget.y,zoneX:a.zone.x,zoneY:a.zone.y,targetShiftMeters:shift,until:plan.until};
    return a.runTarget;
  }
  const oldAttack=P._attackTarget;
  P._attackTarget=function(tm,p,b){
    const base=oldAttack.apply(this,arguments);if(!base||!tm||!p||p.red||p.isGK||p._setPieceRole||finite(this.dead)>.04)return base;
    const plan=this._r18161ActivePlan(tm);if(!plan)return base;const a=plan.byIdx&&plan.byIdx[p.idx];if(!a)return base;
    const now=finite(this.t),maxZoneDistance=a.role==='rebound'?5.5:7.5;if(a.distance>maxZoneDistance||(a.role==='rebound'&&(a.distance>3.5||a.iq<88)))return base;if(now<a.createdAt)a.createdAt=plan.created;
    if(now<plan.created+a.reaction)return base;
    const rt=freezeRunTarget(this,tm,p,a,base,plan);if(!rt)return base;
    if(!a.started){a.started=true;a.startedAt=now;stats(this).runsStarted++;}
    if(!a.completed&&Math.hypot(finite(p.x)-rt.x,finite(p.y)-rt.y)<=.85){a.completed=true;a.completedAt=now;stats(this).runsCompleted++;}
    return[rt.x,rt.y];
  };
  const oldStep=P.step;
  if(oldStep)P.step=function(){
    const r=oldStep.apply(this,arguments),now=finite(this.t);
    for(const tm of this.teams||[]){const plan=tm._r18161BoxPlan;if(plan&&!plan.cancelled&&(now>=plan.until||this.poss!==tm.side))cancelPlan(this,tm,now>=plan.until?'window_expired':'possession_changed');}
    return r;
  };
  P.getBoxMovementProfile=function(p,role){const r=role&&IQ[role]?role:'first_post',iq=roleIQ(p,r);return{version:V,role:r,boxMovementIQ:iq,reactionDelaySeconds:reactionDelay(iq),runTargetScale:runScale(iq),maxTargetShiftMeters:(ROLE_SHIFT[r]||1.8)*runScale(iq),continuous:true,usesNormalIntegrator:true,formulas:{first_post:{antecipacao:.24,movimentacao:.22,aceleracao:.17,finalizacao:.14,decisao:.09,compostura:.07,trabalho_equipe:.04,forca:.03},far_post:{cabeceio:.22,impulsao:.18,movimentacao:.17,antecipacao:.15,forca:.11,finalizacao:.08,decisao:.05,compostura:.04},split_cb:{movimentacao:.24,antecipacao:.21,finalizacao:.15,forca:.13,decisao:.10,compostura:.09,aceleracao:.05,trabalho_equipe:.03},cutback:{movimentacao:.22,decisao:.18,finalizacao:.17,compostura:.15,antecipacao:.13,primeiro_toque:.08,trabalho_equipe:.07},late_run:{aceleracao:.21,antecipacao:.20,movimentacao:.19,decisao:.16,finalizacao:.10,compostura:.08,trabalho_equipe:.06},rebound:{antecipacao:.25,movimentacao:.21,decisao:.17,compostura:.12,chute_longe:.10,primeiro_toque:.08,trabalho_equipe:.07}}};};
  P.getBoxMovementAudit=function(){const s=stats(this);return{version:V,connectedPath:'P._attackTarget → frozen run target → P._movePlayers → P._integrate',stats:Object.assign({},s),rates:{started:s.runsEligible?s.runsStarted/s.runsEligible:0,completed:s.runsStarted?s.runsCompleted/s.runsStarted:0,cancelled:s.runsStarted?s.runsCancelled/s.runsStarted:0,priorityOverride:s.assignments?s.priorityOverrides/s.assignments:0},means:{assignmentIQ:s.assignments?s.iqTotal/s.assignments:0,reactionDelaySeconds:s.assignments?s.totalReactionDelay/s.assignments:0,targetShiftMeters:s.targetsFrozen?s.totalTargetShift/s.targetsFrozen:0},roles:{firstPost:s.roleFirstPost,farPost:s.roleFarPost,betweenCenterBacks:s.roleSplitCB,cutback:s.roleCutback,lateRun:s.roleLateRun,rebound:s.roleRebound},activation:{wideCross:{minProgress:78,minWidthFromCenter:10.5},centralBox:{minProgress:81,maxWidthFromCenter:10.5},eventDriven:true,maxInitialZoneDistanceMeters:7.5,planWindowSeconds:[.45,.90],maxActiveRolesWide:1,maxActiveRolesCentral:1,maxActiveRolesShot:1,targetShiftRangeMeters:[0,.72]},physics:{teleport:false,speedBonus:false,arrival:'P._integrate',rngConsumption:false,xgChange:false,targetsFrozen:true,onsideClamp:true}};};
  const oldAudit=P.getFullFootballAudit;P.getFullFootballAudit=function(){const r=oldAudit?oldAudit.apply(this,arguments):{};r.version=V;r.boxMovement=this.getBoxMovementAudit();return r;};
  root.CDS_R18161=Object.freeze({version:V,roles:['first_post','far_post','split_cb','cutback','late_run','rebound'],frozenPlan:true,continuousAttributes:true,physicalRuns:true,normalIntegrator:true,consumesMatchRng:false,speedBonus:false,xgBonus:false,maxPlanSeconds:.90,maxTargetShiftMeters:.72});
})(typeof window!=='undefined'?window:globalThis);
