#!/usr/bin/env node
/* D01 · quantos quadros de voo caem no integrador do core (g = 20 m/s2) em vez
   do plano fisico da camada 88 (g = 9,81)?

   A camada 07 so chama o core quando a bola NAO tem _physicsPlan. Esta sonda
   conta os quadros de cada caso, por tipo de bola.

   Uso: node tools/fisica/ramo-g20.js <build.html> [partidas] */
const fs=require('fs'),vm=require('vm'),crypto=require('crypto');
function noop(){} function def(n,v){try{Object.defineProperty(global,n,{value:v,writable:true,configurable:true})}catch(_){global[n]=v}}
def('window',global);def('self',global);def('navigator',{userAgent:'x',language:'pt-BR'});
def('location',{href:'',search:'',hash:''});def('performance',{now:()=>0});def('crypto',crypto.webcrypto);
def('requestAnimationFrame',()=>0);def('cancelAnimationFrame',noop);def('addEventListener',noop);def('removeEventListener',noop);
def('matchMedia',()=>({matches:false,addEventListener:noop,removeEventListener:noop}));def('alert',noop);
def('localStorage',{getItem:()=>null,setItem:noop,removeItem:noop,clear:noop});def('sessionStorage',global.localStorage);
def('CanvasRenderingContext2D',undefined);def('HTMLElement',function(){});def('HTMLCanvasElement',function(){});
def('Image',function(){});def('Audio',function(){return{play:()=>Promise.resolve(),pause:noop}});
def('__showBootError',noop);def('__cdsDebugWarn',noop);def('CDS_DEBUG',false);
const SKIP=new Set(['cds-2_5d-gate-a-contracts-v02','cds-pre25d-runtime-auditor-v04','cds-r109-async-cup','cds-mobile-boot-bridge','cds-ux-boot']);
const html=fs.readFileSync(process.argv[2]||'dist/index.html','utf8');
const re=/<script([^>]*)>([\s\S]*?)<\/script>/gi;let m,i=0;
while((m=re.exec(html))){const id=(m[1].match(/id="([^"]+)"/)||[])[1]||('s'+i);i++;if(SKIP.has(id))continue;try{vm.runInThisContext(m[2],{filename:id})}catch(_){}}
const db=buildDB(DATA),FORMS=Object.keys(FORMATIONS);
const STYLES=(typeof STYLE_KEYS!=='undefined'&&Array.isArray(STYLE_KEYS))?STYLE_KEYS:['balanced','tiki','direct','press','counter','wings','park'];
const sq=db.squads.find(s=>s.c==='Brasil'&&Number(s.y)===1970)||db.squads[0];
const mk=(f,st,h)=>{const p=autoLineup(sq,f,0);return{squad:sq,name:sq.c,flag:sq.f,color:h?'#1':'#2',lineup:p.lineup,bench:p.bench,formKey:f,style:st}};
const N=Number(process.argv[3]||12);
const comPlano={}, semPlano={};
const inc=(o,k)=>o[k]=(o[k]||0)+1;
for(let k=0;k<N;k++){
  srand(4200000+k*7919);
  const sim=new MatchSim(mk(FORMS[k%FORMS.length],STYLES[k%STYLES.length],true),mk(FORMS[(k*3+1)%FORMS.length],STYLES[(k*5+2)%STYLES.length],false),{neutral:true,labMode:true});
  const P=Object.getPrototypeOf(sim), topo=P._ballTravel;
  sim._ballTravel=function(dt){
    const b=this.ball;
    if(b&&b.traveling){
      const kind=b.kind||'?';
      if(b._physicsPlan&&b._physicsPlan.segment)inc(comPlano,kind); else inc(semPlano,kind);
    }
    return topo.call(this,dt);
  };
  let s=0;while(!sim.isOver()&&s++<500000)sim.step(1/30);
}
const pp=o=>Object.fromEntries(Object.entries(o).sort((a,b)=>b[1]-a[1]).map(([k,v])=>[k,+(v/N).toFixed(2)]));
const soma=o=>Object.values(o).reduce((a,b)=>a+b,0);
console.log(JSON.stringify({partidas:N,
  quadrosComPlanoFisico_g981:pp(comPlano), totalComPlano:+(soma(comPlano)/N).toFixed(2),
  quadrosSemPlano_caemNoCore_g20:pp(semPlano), totalSemPlano:+(soma(semPlano)/N).toFixed(2),
  percentualNoIntegradorErrado:+(100*soma(semPlano)/Math.max(1,soma(comPlano)+soma(semPlano))).toFixed(1)},null,1));
