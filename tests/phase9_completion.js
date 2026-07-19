#!/usr/bin/env node
'use strict';
process.env.CDS_LAB_PHASE47='1';process.env.CDS_LAB_PHASE8='1';process.env.CDS_LAB_PHASE9='1';
const path=require('path');const {createRuntime}=require('../tools/lab_runtime.js');const rt=createRuntime(path.resolve(__dirname,'..')),sb=rt.sandbox;
function team(idx,profile,knowledge){const s=structuredClone(rt.db.squads[idx]),l=sb.autoLineup(s,'4-3-3',0);return{squad:s,name:s.c,flag:'',color:'#fff',lineup:l.lineup,bench:l.bench,style:'balanced',axes:Object.assign({},sb.STYLE_AXES.balanced),atkForm:'4-3-3',defForm:'4-3-3',managerProfile:profile,managerKnowledge:knowledge||{}};}
const knowledge={recentResults:['V 2-0','E 1-1','V 3-1'],fatigue:23,cards:{yellow:['Jogador A'],red:[]},suspensions:['Suspenso X'],injuries:['Lesionado Y']};
sb.srand(9011);const sim=new sb.MatchSim(team(312,'adaptive',knowledge),team(288,'pragmatic'),{neutral:true});sim.setInteractive(0);
if(!sb.CDS_PHASE9||sb.CDS_PHASE9.VERSION!=='5.2.1')throw new Error('versão 5.2.1 ausente');
const plan=sim.getManagerData(1).preMatch;
for(const k of ['form','keyPlayers','pace','aerial','goalkeeperBuild','recentResults','fatigue','cards','suspensions','injuries'])if(!(k in plan.opponent))throw new Error('plano pré-jogo sem '+k);
if(!plan.opponent.keyPlayers.length||!plan.opponent.keyPlayers[0].likelyRole)throw new Error('jogadores-chave/funções prováveis ausentes');
if(!Array.isArray(plan.opponent.recentResults)||plan.opponent.recentResults.length!==3||plan.opponent.suspensions[0]!=='Suspenso X'||plan.opponent.injuries[0]!=='Lesionado Y')throw new Error('contexto legítimo da Copa não incorporado');
// Diagnósticos faltantes: ponta desconectado, zona vazia, função incompatível e amarelo atacado.
const tm=sim.teams[1],opp=sim.teams[0];sim.minute=35;
const winger=tm.players.find(p=>['LW','RW','LM','RM'].includes(p.slotPos));if(!winger)throw new Error('ponta não encontrado');
winger.x=95;winger.y=2;for(const p of tm.players)if(p!==winger&&!p.isGK){p.x=42;p.y=45;}
winger.ipDuty='attack';winger.oopDuty='attack';winger.yellow=1;sim.stats[0].attacksL=15;sim.stats[0].attacksR=2;
const metrics=sb.CDS_PHASE9.metricSnapshot(sim,1),diags=sb.CDS_PHASE9.diagnose(sim,1,metrics),codes=new Set(diags.map(d=>d.code));
for(const code of ['WINGER_DISCONNECTED','LOW_ZONE_OCCUPANCY','ROLE_MISMATCH','YELLOW_TARGETED'])if(!codes.has(code))throw new Error('diagnóstico ausente: '+code);
// Resposta individual: corrigir função/dever, orientar pressão e trocar cruzamento.
const mismatch=diags.find(d=>d.code==='ROLE_MISMATCH'),roleAction=sb.CDS_PHASE9.actionFor(mismatch,sim,1,tm.managerAI.profile),roleEntry=sb.CDS_PHASE9.applyAction(sim,1,mismatch,roleAction);
if(!roleEntry||!roleEntry.roleChange||!roleEntry.affectedPlayers.length||!roleEntry.intensity)throw new Error('mudança individual sem rastreabilidade');
tm.managerAI.pendingEvaluation=null;tm.managerAI.lastActionMinute=-99;
const crossDiag={code:'DANGEROUS_CROSSES',severity:.8,label:'Cruzamentos perigosos',evidence:'teste',objective:'defend',affectedPlayers:[],affectedSectors:['wide','box']};
const crossEntry=sb.CDS_PHASE9.applyAction(sim,1,crossDiag,sb.CDS_PHASE9.actionFor(crossDiag,sim,1,tm.managerAI.profile));
if(!crossEntry||tm.instructions.inPossession.finalThird.crossType!=='low'||!tm.managerAI.pressOrientation)throw new Error('tipo de cruzamento/pressão direcionada não aplicado');
// Avaliação registra decisão de manter, ajustar ou desfazer.
sim.minute+=10;sim.stats[1].xg+=.7;sim.stats[1].shots+=4;const ev=sim._phase9Evaluate(1,true);if(!ev||!['maintain','adjust','revert'].includes(ev.decision))throw new Error('decisão posterior ausente');
// Save round-trip completo.
const saved=sim.exportManagerState(1);if(!saved||!saved.teamConfig||!saved.state.history.length)throw new Error('export de memória incompleto');
sb.srand(9011);const restored=new sb.MatchSim(team(312,'adaptive',knowledge),team(288,'pragmatic'),{neutral:true});restored.setInteractive(0);if(!restored.importManagerState(1,saved))throw new Error('import de memória falhou');
const a=sim.getManagerData(1),b=restored.getManagerData(1);if(JSON.stringify(a.history)!==JSON.stringify(b.history)||a.profile.key!==b.profile.key)throw new Error('round-trip não preservou memória/perfil');
for(const h of a.history.filter(x=>x.type==='change'))for(const k of ['minute','diagnosis','evidence','affectedPlayers','affectedSectors','intensity','expected','beforeConfig','afterConfig'])if(h[k]==null)throw new Error('decisão sem campo '+k);
console.log(JSON.stringify({ok:true,version:sb.CDS_PHASE9.VERSION,preMatch:plan.opponent,diagnostics:[...codes],roleChange:roleEntry.roleChange,crossType:tm.instructions.inPossession.finalThird.crossType,evaluation:ev,saveRoundTrip:true,metrics:a.metrics},null,2));
