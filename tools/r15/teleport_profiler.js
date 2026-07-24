#!/usr/bin/env node
'use strict';
/* Perfilador de escritores de posição: envolve TODOS os métodos do protótipo e
   atribui cada salto ao método mais interno em execução no momento. */
const fs=require('fs'),vm=require('vm'),crypto=require('crypto');
const argv=Object.fromEntries(process.argv.slice(2).map(a=>{const[k,v]=a.replace(/^--/,'').split('=');return[k,v==null?true:v];}));
function noop(){}
function def(n,v){try{Object.defineProperty(global,n,{value:v,writable:true,configurable:true});}catch(_){global[n]=v;}}
def('window',global);def('self',global);def('navigator',{userAgent:'x',language:'pt-BR'});
def('location',{href:'r://x',search:'',hash:''});def('performance',{now:()=>0});def('crypto',crypto.webcrypto);
def('requestAnimationFrame',noop);def('cancelAnimationFrame',noop);
def('localStorage',{_d:{},getItem(k){return this._d[k]==null?null:this._d[k];},setItem(k,v){this._d[k]=String(v);},removeItem(k){delete this._d[k];},clear(){this._d={};}});
const rc=console;def('console',Object.assign({},console,{log:noop,info:noop,warn:noop,debug:noop}));
const SKIP=new Set(['cds-2_5d-gate-a-contracts-v02','cds-pre25d-runtime-auditor-v04','cds-r109-async-cup','cds-mobile-boot-bridge','cds-ux-boot']);
const html=fs.readFileSync(argv.build,'utf8');
const re=/<script([^>]*)>([\s\S]*?)<\/script>/gi;let m,i=0;
while((m=re.exec(html))){const id=(m[1].match(/id="([^"]+)"/)||[])[1]||('script-'+i);i++;if(SKIP.has(id))continue;
try{vm.runInThisContext(m[2],{filename:id+'.js'});}catch(e){if(/^script-\d+$/.test(id)&&/document is not defined/.test(String(e&&e.message)))continue;throw e;}}
const P=MatchSim.prototype;
const LIM=1.5, stack=[], tally={};
const SKIPM=new Set(['constructor','step','_movePlayers','_integrate','_resolveOverlaps']);
for(const name of Object.getOwnPropertyNames(P)){
  if(SKIPM.has(name))continue;
  const d=Object.getOwnPropertyDescriptor(P,name);
  if(!d||typeof d.value!=='function')continue;
  const orig=d.value;
  P[name]=function(){
    const snap=[];
    for(const tm of this.teams||[])for(const p of tm.players||[])if(p&&!p.red)snap.push([p,+p.x||0,+p.y||0]);
    stack.push(name);
    try{return orig.apply(this,arguments);}
    finally{
      stack.pop();
      // Só contabiliza se ESTE for o quadro mais interno que ainda não contou.
      for(const z of snap){const d2=Math.hypot((+z[0].x||0)-z[1],(+z[0].y||0)-z[2]);
        if(d2>LIM&&!z[0].__counted){z[0].__counted=name;
          const t=tally[name]||(tally[name]={n:0,max:0,sum:0});t.n++;t.sum+=d2;if(d2>t.max)t.max=d2;}}
      if(stack.length===0)for(const tm of this.teams||[])for(const p of tm.players||[])delete p.__counted;
    }
  };
}
function labTeam(db,f,s,home){
  const sq=db.squads[0],pk=autoLineup(sq,f,0),keys=(global.CDSDataV3&&global.CDSDataV3.attributes)||[];
  pk.lineup=pk.lineup.map((slot,idx)=>{const pos=slot.pos||'CM';return Object.assign({},slot,{p:{
    id:'L_'+pos+idx,n:'A'+(idx+1),slot:pos,pos,r:82,starter:1,traits:[],behaviorTraits:[],naturalRoles:[],
    a8:[82,82,82,82,82,82,82,82],attributesV3:Object.fromEntries(keys.map(k=>[k,82])),
    profileV3:{dominantFoot:'R',weakFoot:4,heightCmSim:pos==='GK'?190:182,bodyType:'average',primaryPosition:pos},_a:{}}});});
  pk.bench=[];
  return{squad:sq,name:sq.c,flag:sq.f,color:home?'#2e9bff':'#ff3d7f',lineup:pk.lineup,bench:[],formKey:f,style:s};
}
const db=buildDB(DATA),seeds=Number(argv.seeds||6);
for(let s=0;s<seeds;s++){
  srand(5400000+s*911);
  const sim=new MatchSim(labTeam(db,'4-3-3','balanced',true),labTeam(db,'4-3-3','balanced',false),{neutral:true,labMode:true});
  sim.teams[0].formKey='4-3-3';sim.teams[1].formKey='4-3-3';
  const DT=1/30;let n=0;while(!sim.isOver()&&n++<500000)sim.step(DT);
}
const rows=Object.entries(tally).sort((a,b)=>b[1].n-a[1].n);
const tot=rows.reduce((a,r)=>a+r[1].n,0)||1;
rc.error(`${seeds} partidas · saltos >${LIM} m atribuidos: ${tot}\n`);
rc.error(`${'metodo'.padEnd(26)}${'saltos'.padStart(8)}${'share'.padStart(8)}${'medio'.padStart(9)}${'max'.padStart(9)}`);
for(const[k,v]of rows.slice(0,12))
  rc.error(`${k.padEnd(26)}${String(v.n).padStart(8)}${(v.n/tot*100).toFixed(1).padStart(7)}%${(v.sum/v.n).toFixed(1).padStart(9)}${v.max.toFixed(1).padStart(9)}`);
fs.writeFileSync(argv.out||'reports/r15/teleport-perfil.json',JSON.stringify({
  build:argv.build,seeds,limit:LIM,total:tot,
  byMethod:Object.fromEntries(rows.map(([k,v])=>[k,{n:v.n,share:+(v.n/tot).toFixed(4),mean:+(v.sum/v.n).toFixed(2),max:+v.max.toFixed(2)}]))},null,1));
