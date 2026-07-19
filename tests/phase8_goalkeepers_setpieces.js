#!/usr/bin/env node
'use strict';
const path=require('path');
const {createRuntime}=require('../tools/lab_runtime.js');
const root=path.resolve(__dirname,'..');
const rt=createRuntime(root), sb=rt.sandbox;
function assert(ok,msg){if(!ok)throw new Error(msg);}
function teamFor(idx,form='4-3-3'){
  const squad=structuredClone(rt.db.squads[idx]);
  const l=sb.autoLineup(squad,form,0);
  return {squad,name:squad.c,flag:'',color:'#fff',lineup:l.lineup,bench:l.bench,
    style:'balanced',axes:Object.assign({},sb.STYLE_AXES.balanced)};
}
function makeSim(seed=1,onEvent=()=>{}){
  sb.srand(seed>>>0);
  const sim=new sb.MatchSim(teamFor(48),teamFor(189),{neutral:true,onEvent});
  sim.setInteractive(-1);sim.waiting=false;sim.dead=0;sim.pendingRestart=null;
  return sim;
}
function advance(sim,seconds=8){let n=Math.ceil(seconds*60);while(n--&&!sim.isOver())sim.step(1/60);}

// Rotinas de escanteio + estruturas defensivas explícitas.
const routines=['near_post','far_post','penalty_spot','short'];
const defStyles=['zonal','man','mixed'];
const cornerSeen=new Set(),defSeen=new Set();
for(let i=0;i<routines.length;i++){
  const events=[];const sim=makeSim(100+i,e=>events.push(e));
  const style=defStyles[i%defStyles.length];
  sim._setCorner(0,routines[i],style);
  const ev=events.find(e=>e.type==='corner');
  assert(ev&&ev.routine===routines[i],'rotina de escanteio não registrada: '+routines[i]);
  assert(ev.defStyle===style,'estrutura defensiva não registrada: '+style);
  assert(Array.isArray(ev.assignments)&&ev.assignments.length>=3,'responsabilidades ofensivas ausentes');
  cornerSeen.add(ev.routine);defSeen.add(ev.defStyle);
  advance(sim,9);
  for(const tm of sim.teams)for(const p of tm.players)assert(Number.isFinite(p.x)&&Number.isFinite(p.y),'posição inválida após escanteio');
}
assert(cornerSeen.size===4,'nem todas as rotinas de escanteio foram exercitadas');
assert(defSeen.size===3,'nem todas as defesas de escanteio foram exercitadas');

// Faltas diretas, cruzadas e curtas usam o estado real do motor.
for(const [i,routine] of ['direct','crossed','short'].entries()){
  const events=[];const sim=makeSim(300+i,e=>events.push(e));
  const input={assisted:true,routine,aimX:.68,aimY:.48,power:.74,curve:.08};
  sim._freeKick(0,sim.teams[0].oppGoal.x-sim.teams[0].attackDir*24,28,input);
  advance(sim,8);
  const st=sim.stats[0];
  assert(st[routine==='direct'?'freeKickDirect':routine==='crossed'?'freeKickCrossed':'freeKickShort']===1,'contador de falta incorreto: '+routine);
  assert(events.some(e=>e.type==='freekick_routine'&&e.routine===routine),'evento de rotina de falta ausente: '+routine);
}

// Pênaltis: toda cobrança termina exatamente em gol, defesa ou erro.
let pen={taken:0,scored:0,saved:0,missed:0};
for(let seed=500;seed<530;seed++){
  const sim=makeSim(seed);
  const forcedMiss=seed===500;
  sim._penalty(0,{assisted:true,aimX:forcedMiss?-0.2:.5,aimY:forcedMiss?.5:.52,power:.72,curve:0,pressure:.35});
  const st=sim.stats[0];
  pen.taken+=st.penaltiesTaken;pen.scored+=st.penaltiesScored;pen.saved+=st.penaltiesSaved;pen.missed+=st.penaltiesMissed;
}
assert(pen.taken===30,'quantidade de pênaltis incorreta');
assert(pen.taken===pen.scored+pen.saved+pen.missed,'decomposição dos pênaltis inconsistente');
assert(pen.missed>=1,'erro para fora não registrado');

// Saídas em cruzamentos: tentativa pode resultar em domínio, soco ou erro.
let claims={attempted:0,won:0,missed:0,punches:0};
for(let seed=700;seed<780;seed++){
  const sim=makeSim(seed),tm=sim.teams[0],gk=tm.players.find(p=>p.isGK),rival=sim.teams[1].players.find(p=>!p.isGK);
  gk.x=tm.goal.x+tm.attackDir*5;gk.y=34;rival.x=gk.x+tm.attackDir*1.5;rival.y=34;
  Object.assign(sim.ball,{owner:null,traveling:true,kind:'pass',passKind:'launch',target:{x:gk.x,y:gk.y},lastTouch:rival,x:gk.x,y:gk.y,z:1.1,onArrive:()=>{}});
  sim._goalkeeperClaim(tm,gk,sim.ball,1/60);
  const st=sim.stats[0];claims.attempted+=st.gkClaimsAttempted;claims.won+=st.gkClaimsWon;claims.missed+=st.gkClaimsMissed;claims.punches+=st.gkPunches;
}
assert(claims.attempted===80,'tentativas de saída não contabilizadas');
assert(claims.attempted===claims.won+claims.missed+claims.punches,'resultados de saída inconsistentes');
assert(claims.won>0&&claims.punches>0&&claims.missed>0,'saídas não produziram variedade contextual');

// Partidas completas: determinismo, distribuição e risco da saída em profundidade.
function play(seed){
  const events=Object.create(null),sim=makeSim(seed,e=>events[e.type]=(events[e.type]||0)+1);
  let guard=0;while(!sim.isOver()&&guard++<500000)sim.step(1/60);
  assert(sim.isOver(),'partida não terminou');
  return {score:sim.score.slice(),stats:sim.stats.map(s=>Object.assign({},s)),events};
}
let distAttempts=0,distOutcomes=0;
for(let seed=1;seed<=4;seed++){
  const out=play(seed);
  for(const st of out.stats){
    distAttempts+=st.gkDistributionShort+st.gkDistributionLong;distOutcomes+=st.gkDistributionCompleted+st.gkDistributionFailed;
    for(const k of ['gkSweeps','gkSweepsFailed','gkDistributionShort','gkDistributionLong','gkDistributionCompleted','gkDistributionFailed'])assert(Number.isFinite(st[k])&&st[k]>=0,'estatística inválida: '+k);
  }
}
assert(distAttempts>0&&distOutcomes>0&&distOutcomes<=distAttempts,'métricas de distribuição inconsistentes');

// Cenário determinístico de passe em profundidade: o goleiro decide sair, falha
// e permanece fora do lance por uma janela real, sem precisar depender da frequência
// estatística rara desse evento em uma partida completa.
const sweepSim=makeSim(43),atkTm=sweepSim.teams[0],defTm=sweepSim.teams[1];
const passer=atkTm.players.find(p=>!p.isGK),receiver=atkTm.players.filter(p=>!p.isGK)[1];
const sweepGk=defTm.players.find(p=>p.isGK),sweepDefs=defTm.players.filter(p=>!p.isGK);
passer.x=65;passer.y=34;receiver.x=86;receiver.y=34;receiver._runDeep=true;receiver._breaking={t:3};
sweepGk.oopRole='sweeper';sweepGk.x=101;sweepGk.y=34;
sweepDefs.forEach((d,i)=>{d.x=92+(i%2)*2;d.y=15+(i*5)%38;});
sweepSim._giveBall(passer);
sweepSim._pass(passer,{m:receiver,dist:21,progressM:21,intoBox:true,risk:.2,paceEdge:.8,lineVuln:.8,score:2,throughThreat:1});
if(sweepSim.ball.onArrive){const cb=sweepSim.ball.onArrive;sweepSim.ball.onArrive=null;sweepSim.ball.traveling=false;cb();}
const sweepsFailed=sweepSim.stats[1].gkSweepsFailed;
assert(sweepsFailed===1,'falha contextual da saída em profundidade não registrada');
assert((sweepGk._sweptFailUntil||0)>sweepSim.t,'goleiro não ficou vulnerável após falhar');
const da=play(20260719),db=play(20260719);
assert(JSON.stringify({score:da.score,stats:da.stats.map(s=>[s.gkSweepsFailed,s.gkClaimsWon,s.gkPunches,s.freeKickDirect,s.cornersNearPost])})===JSON.stringify({score:db.score,stats:db.stats.map(s=>[s.gkSweepsFailed,s.gkClaimsWon,s.gkPunches,s.freeKickDirect,s.cornersNearPost])}),'determinismo da Fase 8 quebrado');

console.log(JSON.stringify({ok:true,corners:[...cornerSeen],cornerDefences:[...defSeen],penalties:pen,claims,sweepsFailed,distribution:{attempts:distAttempts,outcomes:distOutcomes}},null,2));
