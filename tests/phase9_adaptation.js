#!/usr/bin/env node
'use strict';
process.env.CDS_LAB_PHASE47='1';process.env.CDS_LAB_PHASE8='1';process.env.CDS_LAB_PHASE9='1';
const path=require('path');const {createRuntime}=require('../tools/lab_runtime.js');const rt=createRuntime(path.resolve(__dirname,'..')),sb=rt.sandbox;
function team(idx,profile){const s=structuredClone(rt.db.squads[idx]),l=sb.autoLineup(s,'4-3-3',0);return{squad:s,name:s.c,flag:'',color:'#fff',lineup:l.lineup,bench:l.bench,style:'balanced',axes:Object.assign({},sb.STYLE_AXES.balanced),managerProfile:profile};}
sb.srand(20260901);const sim=new sb.MatchSim(team(312),team(288,{key:'adaptive',label:'Laboratório',adaptability:96,riskTolerance:82,defensivePreference:72,substitutionTiming:55}),{neutral:true});sim.setInteractive(0);
const ai=1,tm=sim.teams[ai];
// 1. Perde tarde: precisa alterar estrutura e registrar expectativa.
sim.minute=72;sim.score=[2,0];sim.stats[ai].xg=.35;sim.stats[0].xg=1.9;sim.stats[ai].shots=3;sim.stats[0].shots=12;
const chase=sim._phase9Think(ai,true);if(!chase||chase.diagnosisCode!=='LOSING_LATE')throw new Error('IA não reagiu à desvantagem tardia');
if(!chase.expected||sim.stats[ai].managerChanges<1)throw new Error('mudança sem rastreabilidade');
const historyAfter=tm.managerAI.history.length;sim._phase9Think(ai,false);if(tm.managerAI.history.length!==historyAfter)throw new Error('memória/cooldown não bloqueou repetição');
// 2. Avalia a mudança com janela posterior positiva.
sim.minute+=8;sim.stats[ai].xg+=1.1;sim.stats[ai].shots+=7;sim.stats[0].xg+=.1;sim.stats[0].shots+=1;const evaluation=sim._phase9Evaluate(ai,true);
if(!evaluation||!evaluation.success)throw new Error('avaliação positiva não reconhecida');
// 3. Sobrecarga lateral: reforça o corredor sem alternância aleatória.
sim.minute+=10;sim.score=[1,1];sim.stats[0].attacksL=16;sim.stats[0].attacksR=4;sim.stats[ai].xg=1;sim.stats[0].xg=1;sim.stats[ai].shots=8;sim.stats[0].shots=8;tm.managerAI.lastActionMinute=-99;tm.managerAI.pendingEvaluation=null;
const side=sim._phase9Think(ai,true);if(!side||side.diagnosisCode!=='LEFT_OVERLOAD'||tm.managerAI.sideShift.side!=='L')throw new Error('reforço lateral não aplicado');
// 4. Uma mudança ruim é avaliada e desfeita pelo perfil adaptável.
sim.minute+=7;sim.stats[0].xg+=1.4;sim.stats[0].shots+=5;const bad=sim._phase9Evaluate(ai,true);if(!bad||bad.success)throw new Error('mudança ruim não foi reconhecida');if(sim.stats[ai].managerReversals<1)throw new Error('treinador adaptável não desfez mudança ruim');
// 5. Fadiga: renova o time com reserva compatível.
sim.minute+=10;sim.stats[0].attacksL=6;sim.stats[0].attacksR=6;for(const p of tm.players)if(!p.isGK&&!p.red)p.stamina=48;tm.managerAI.lastActionMinute=-99;tm.managerAI.pendingEvaluation=null;
const beforeSubs=sim.stats[ai].managerSubstitutions;const fatigue=sim._phase9Think(ai,true);if(!fatigue||fatigue.diagnosisCode!=='FATIGUE')throw new Error('fadiga não diagnosticada');
if(sim.stats[ai].managerSubstitutions<=beforeSubs)throw new Error('substituição física não realizada');
// 6. Estrutura de histórico obrigatória.
for(const h of tm.managerAI.history.filter(x=>x.type==='change'))for(const k of ['minute','diagnosis','evidence','action','expected'])if(h[k]==null)throw new Error('histórico incompleto: '+k);
const data=sim.getManagerData(ai);if(data.metrics.changes<3||data.metrics.evaluations<2||data.metrics.substitutions<1||data.metrics.reversals<1)throw new Error('métricas da IA incompletas');
console.log(JSON.stringify({ok:true,version:sb.CDS_PHASE9.VERSION,profile:data.profile,metrics:data.metrics,history:data.history},null,2));
