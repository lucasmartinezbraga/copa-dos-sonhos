#!/usr/bin/env node
'use strict';
process.env.CDS_LAB_PHASE47='1';process.env.CDS_LAB_PHASE8='1';process.env.CDS_LAB_PHASE9='1';
const path=require('path');const {createRuntime}=require('../tools/lab_runtime.js');const rt=createRuntime(path.resolve(__dirname,'..')),sb=rt.sandbox;
function team(idx,profile){const s=structuredClone(rt.db.squads[idx]),l=sb.autoLineup(s,'4-3-3',0);return{squad:s,name:s.c,flag:'',color:'#fff',lineup:l.lineup,bench:l.bench,style:'balanced',axes:Object.assign({},sb.STYLE_AXES.balanced),managerProfile:profile};}
function profileFor(seed){sb.srand(seed);const sim=new sb.MatchSim(team(312),team(288),{neutral:true});sim.setInteractive(0);return{profile:sim.getManagerData(1).profile,plan:sim.getManagerData(1).preMatch,stats:sim.stats[1]};}
const a=profileFor(12345),b=profileFor(12345);
if(!sb.CDS_PHASE9||sb.CDS_PHASE9.VERSION!=='5.2.2')throw new Error('módulo Fase 9 ausente');
if(JSON.stringify(a.profile)!==JSON.stringify(b.profile))throw new Error('perfil não determinístico');
if(JSON.stringify(a.plan)!==JSON.stringify(b.plan))throw new Error('plano pré-jogo não determinístico');
if(!a.plan||!a.plan.preset||!a.plan.opponent)throw new Error('plano pré-jogo incompleto');
if(a.stats.managerPreMatchPlans!==1)throw new Error('plano pré-jogo não contabilizado');
sb.srand(7);const explicit={key:'adaptive',label:'Professor',adaptability:97,riskTolerance:31};const sim=new sb.MatchSim(team(48),team(189,explicit),{neutral:true});sim.setInteractive(0);const p=sim.getManagerData(1).profile;
if(p.label!=='Professor'||p.adaptability!==97||p.riskTolerance!==31)throw new Error('perfil explícito não preservado');
sb.srand(11);const ag=new sb.MatchSim(team(48),team(189,'aggressive'),{neutral:true});ag.setInteractive(0);
sb.srand(11);const po=new sb.MatchSim(team(48),team(189,'possession'),{neutral:true});po.setInteractive(0);
if(ag.getManagerData(1).preMatch.preset!=='highPress'||po.getManagerData(1).preMatch.preset!=='possession')throw new Error('perfis diferentes não produziram planos diferentes');
console.log(JSON.stringify({ok:true,version:sb.CDS_PHASE9.VERSION,derived:a.profile,preMatch:a.plan,explicit:p,profilePlans:{aggressive:ag.getManagerData(1).preMatch.preset,possession:po.getManagerData(1).preMatch.preset}},null,2));
