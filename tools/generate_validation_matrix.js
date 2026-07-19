#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),{performance}=require('perf_hooks');
const ROOT=path.resolve(__dirname,'..');
const out=path.resolve(process.argv[2]||path.join(ROOT,'reports/phase3/validation-matrix-214-jobs.json'));
const ctx={console,performance,CanvasRenderingContext2D:undefined};ctx.window=ctx;ctx.globalThis=ctx;ctx.__cdsDebugWarn=()=>{};ctx.__cdsDebugLog=()=>{};vm.createContext(ctx);
for(const rel of ['src/scripts/00-polyfills.js','src/scripts/10-data.js','src/scripts/20-core.js','src/scripts/25-data-integrity-v3.js'])vm.runInContext(fs.readFileSync(path.join(ROOT,rel),'utf8'),ctx,{filename:rel});
const db=ctx.buildDB(ctx.DATA),squads=db.squads.map((s,index)=>({index,name:s.c,rating:s.r}));
const forms=Array.from(ctx.FORMATION_KEYS),styles=Array.from(ctx.STYLE_KEYS),dt=ctx.ENGINE_CALIBRATION.timing.fixedStep||1/60;
const vars=Object.fromEntries(forms.map(k=>[k,ctx.FORMATIONS[k].variations.length]));
let state=0xA11CE42;function rnd(){state=(state+0x6D2B79F5)>>>0;let t=state;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;}const pick=a=>a[Math.floor(rnd()*a.length)];
const top=squads.filter(s=>s.rating>=87),low=squads.filter(s=>s.rating<=75),mid=squads.filter(s=>s.rating>=80&&s.rating<=88),iconic=squads.filter(s=>['Brasil','Argentina','Alemanha','Espanha','França','Itália','Holanda','Uruguai'].includes(s.name)&&s.rating>=84);
const spec=(s,style,form,v)=>({squadIndex:s.index,style,form,variation:v==null?Math.floor(rnd()*(vars[form]||1)):v});
const jobs=[];let id=0;
// 30 jogos de paridade: mede viés de lado e distribuição em forças iguais.
for(let i=0;i<30;i++){const s=pick(iconic.length?iconic:mid),style=pick(styles),form=pick(forms),v=Math.floor(rnd()*(vars[form]||1));jobs.push({id:`VP${id++}`,suite:'parity',group:'validation:parity',seed:110000+i,dt,a:spec(s,style,form,v),b:spec(s,style,form,v),meta:{equal:true}});}
// 40 aleatórios em 20 pares espelhados.
for(let i=0;i<20;i++){const a=pick(squads),b=pick(squads.filter(x=>x.index!==a.index)),sa=pick(styles),sb=pick(styles),fa=pick(forms),fb=pick(forms),seed=120000+i;
 const A=spec(a,sa,fa),B=spec(b,sb,fb);jobs.push({id:`VR${id++}`,suite:'random',group:'validation:random',seed,dt,a:A,b:B,meta:{pair:i,ratingGap:a.rating-b.rating}});jobs.push({id:`VR${id++}`,suite:'random',group:'validation:random',seed,dt,a:B,b:A,meta:{pair:i,ratingGap:b.rating-a.rating,mirrored:true}});}
// 40 forte x fraco em 20 pares espelhados.
for(let i=0;i<20;i++){const strong=pick(top),weak=pick(low),ss=pick(styles),ws=pick(styles),sf=pick(forms),wf=pick(forms),seed=130000+i;const S=spec(strong,ss,sf),W=spec(weak,ws,wf);
 jobs.push({id:`VS${id++}`,suite:'strongWeak',group:'validation:strongWeak',seed,dt,a:S,b:W,meta:{pair:i,favoriteSide:0,ratingGap:strong.rating-weak.rating}});jobs.push({id:`VS${id++}`,suite:'strongWeak',group:'validation:strongWeak',seed,dt,a:W,b:S,meta:{pair:i,favoriteSide:1,ratingGap:strong.rating-weak.rating,mirrored:true}});}
// 70 testes de estilo: 5 confrontos espelhados para cada estilo.
for(const style of styles){for(let i=0;i<5;i++){const s=pick(iconic.length?iconic:mid),form=pick(['4-3-3','4-2-3-1','3-4-2-1','5-4-1']),v=Math.floor(rnd()*(vars[form]||1)),seed=140000+styles.indexOf(style)*10+i;const T=spec(s,style,form,v),B=spec(s,'balanced',form,v);
 jobs.push({id:`VT${id++}`,suite:'styles',group:`style:${style}`,seed,dt,a:T,b:B,meta:{testedStyle:style,testedSide:0,pair:i}});jobs.push({id:`VT${id++}`,suite:'styles',group:`style:${style}`,seed,dt,a:B,b:T,meta:{testedStyle:style,testedSide:1,pair:i,mirrored:true}});}}
// 34 testes de formação: um par espelhado para cada uma das 17 formações.
for(const form of forms){const s=pick(iconic.length?iconic:mid),style=pick(['balanced','tiki','counter','press']),seed=150000+forms.indexOf(form),v=Math.floor(rnd()*(vars[form]||1)),baseV=Math.floor(rnd()*(vars['4-3-3']||1));const T=spec(s,style,form,v),B=spec(s,style,'4-3-3',baseV);
 jobs.push({id:`VF${id++}`,suite:'formations',group:`formation:${form}`,seed,dt,a:T,b:B,meta:{testedFormation:form,testedSide:0}});jobs.push({id:`VF${id++}`,suite:'formations',group:`formation:${form}`,seed,dt,a:B,b:T,meta:{testedFormation:form,testedSide:1,mirrored:true}});}
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(jobs,null,2));
console.log(JSON.stringify({output:out,jobs:jobs.length,breakdown:Object.fromEntries([...new Set(jobs.map(j=>j.suite))].map(k=>[k,jobs.filter(j=>j.suite===k).length])),dt},null,2));
