#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),{performance}=require('perf_hooks');
const ROOT=path.resolve(__dirname,'..');global.window=global;global.performance=performance;global.CanvasRenderingContext2D=undefined;window.__cdsDebugWarn=()=>{};window.__cdsDebugLog=()=>{};
for(const rel of ['src/scripts/00-polyfills.js','src/scripts/10-data.js','src/scripts/20-core.js','src/scripts/25-data-integrity-v3.js','src/scripts/30-tactics.js','src/scripts/40-match-engine-and-manager-ai.js','src/scripts/50-tournament.js'])vm.runInThisContext(fs.readFileSync(path.join(ROOT,rel),'utf8'),{filename:rel});
const db=buildDB(DATA);
function teamFor(idx){const squad=structuredClone(db.squads[idx]),l=autoLineup(squad,'4-3-3',0);return{squad,name:squad.c,flag:'',color:'#fff',lineup:l.lineup,bench:l.bench,style:'balanced',axes:Object.assign({},STYLE_AXES.balanced)}}
function run(seed){srand(seed>>>0);const sim=new MatchSim(teamFor(48),teamFor(189),{neutral:true});const out=CUP.shootout(sim);return{score:out.score,log:out.log.map(x=>({team:x.team,id:x.p.ref.id,name:x.p.ref.n,isGK:x.p.isGK,ok:x.ok,pen:facet(x.p.ref,'pen')}))};}
const a=run(20260719),b=run(20260719);
if(JSON.stringify(a)!==JSON.stringify(b))throw new Error('disputa não determinística');
if(a.score[0]===a.score[1])throw new Error('morte súbita não produziu vencedor');
if(a.log.length<6||a.log.length>200)throw new Error('quantidade inválida de cobranças');
if(a.log.some((x,i)=>x.isGK&&i<Math.min(10,a.log.length)))throw new Error('goleiro escolhido antes dos jogadores de linha');
for(const team of [0,1]){
 const first=a.log.filter(x=>x.team===team).slice(0,5);
 for(let i=1;i<first.length;i++)if(first[i].pen>first[i-1].pen)throw new Error('ordem de cobradores não respeita atributo de pênalti');
}
console.log(JSON.stringify({ok:true,score:a.score,kicks:a.log.length,firstTen:a.log.slice(0,10)},null,2));
