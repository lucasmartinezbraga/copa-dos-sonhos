#!/usr/bin/env node
'use strict';
process.env.CDS_LAB_PHASE47='1';process.env.CDS_LAB_PHASE8='1';process.env.CDS_LAB_PHASE9='1';
const path=require('path');const {createRuntime}=require('../tools/lab_runtime.js');const rt=createRuntime(path.resolve(__dirname,'..')),sb=rt.sandbox;
function team(idx,form='4-3-3'){const s=structuredClone(rt.db.squads[idx]),l=sb.autoLineup(s,form,0);return{squad:s,name:s.c,flag:'',color:'#fff',lineup:l.lineup,bench:l.bench,style:'balanced',axes:Object.assign({},sb.STYLE_AXES.balanced)};}
function play(seed){sb.srand(seed>>>0);const sim=new sb.MatchSim(team(312),team(288),{neutral:true,labMode:false});sim.setInteractive(0);let steps=0;while(!sim.isOver()&&steps++<500000)sim.step(1/60);if(!sim.isOver())throw new Error('partida não terminou');const d=sim.getManagerData(1);return{sim,d,steps};}
const a=play(20260909),b=play(20260909);
if(a.sim.score.join('-')!==b.sim.score.join('-'))throw new Error('placar não determinístico');
if(JSON.stringify(a.d.history)!==JSON.stringify(b.d.history))throw new Error('decisões do treinador não determinísticas');
if(a.d.metrics.preMatchPlans!==1||a.d.metrics.analyses<5)throw new Error('treinador não analisou a partida');
if(!a.d.history.length||!a.d.profile)throw new Error('dados do treinador ausentes');
for(const t of a.sim.teams)for(const p of t.players)for(const v of [p.x,p.y,p.stamina,p.rating])if(!Number.isFinite(v))throw new Error('estado inválido');
console.log(JSON.stringify({ok:true,version:sb.CDS_PHASE9.VERSION,score:a.sim.score,steps:a.steps,profile:a.d.profile,metrics:a.d.metrics,decisions:a.d.history},null,2));
