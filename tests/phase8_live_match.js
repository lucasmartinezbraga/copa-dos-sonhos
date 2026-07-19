#!/usr/bin/env node
'use strict';
process.env.CDS_LAB_PHASE8='1';
const path=require('path');
const {createRuntime}=require('../tools/lab_runtime.js');
const rt=createRuntime(path.resolve(__dirname,'..')),sb=rt.sandbox;
function teamFor(idx){const squad=structuredClone(rt.db.squads[idx]),l=sb.autoLineup(squad,'4-3-3',0);return{squad,name:squad.c,flag:'',color:'#fff',lineup:l.lineup,bench:l.bench,style:'balanced',axes:Object.assign({},sb.STYLE_AXES.balanced)}}
sb.srand(20260719);
const events=Object.create(null),sim=new sb.MatchSim(teamFor(48),teamFor(189),{neutral:true,labMode:true,onEvent:e=>events[e.type]=(events[e.type]||0)+1});
sim.setInteractive(-1);
let steps=0;while(!sim.isOver()&&steps++<500000)sim.step(1/60);
if(!sim.isOver())throw new Error('partida não terminou');
if(!sb.CDS_PHASE8||sb.CDS_PHASE8.VERSION!=='5.1.0')throw new Error('módulo Fase 8 não carregado');
const data=[sim.getPhase8Data(0),sim.getPhase8Data(1)];
for(const d of data){
 if(!d||d.version!=='5.1.0')throw new Error('snapshot Fase 8 inválido');
 const g=d.goalkeeping,s=d.setPieces;
 for(const v of [g.shotsFaced,g.secureCatches,g.parries,g.reboundsConceded,g.sweeps,g.sweepsFailed,g.claimsAttempted,g.claimsWon,g.claimsMissed,g.punches,g.distribution.short,g.distribution.long,g.distribution.completed,g.distribution.failed,s.shots,s.goals,s.firstContactWon,s.firstContactLost,s.penalties.taken,s.penalties.scored,s.penalties.saved,s.penalties.missed])if(!Number.isFinite(v)||v<0)throw new Error('métrica inválida');
 if(g.secureCatches+g.parries!==g.shotsFaced)throw new Error('decomposição de defesas inconsistente');
 if(g.claimsWon+g.claimsMissed+g.punches!==g.claimsAttempted)throw new Error('decomposição de saídas inconsistente');
 if(s.penalties.scored+s.penalties.saved+s.penalties.missed!==s.penalties.taken)throw new Error('decomposição de pênaltis inconsistente');
}
console.log(JSON.stringify({ok:true,version:sb.CDS_PHASE8.VERSION,score:sim.score,steps,events,phase8:data},null,2));
