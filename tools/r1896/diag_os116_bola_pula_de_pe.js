const fs=require('fs'),vm=require('vm'),crypto=require('crypto');
const argv=Object.fromEntries(process.argv.slice(2).map(i=>{const[k,v]=i.replace(/^--/,'').split('=');return[k,v==null?true:v]}));
const noop=()=>{};const D=(n,v)=>{try{Object.defineProperty(global,n,{value:v,writable:true,configurable:true})}catch(_){global[n]=v}};
D('window',global);D('self',global);D('navigator',{userAgent:'c',language:'pt-BR'});D('location',{href:'r://x',search:'',hash:''});
D('performance',{now:()=>0});D('crypto',crypto.webcrypto);D('requestAnimationFrame',()=>0);D('cancelAnimationFrame',noop);
D('addEventListener',noop);D('removeEventListener',noop);D('matchMedia',()=>({matches:false,addEventListener:noop,removeEventListener:noop}));
D('alert',noop);D('confirm',()=>true);D('prompt',()=>null);D('localStorage',{getItem:()=>null,setItem:noop,removeItem:noop,clear:noop});
D('sessionStorage',global.localStorage);D('CanvasRenderingContext2D',undefined);D('HTMLElement',function(){});D('HTMLCanvasElement',function(){});
D('Image',function(){});D('Audio',function(){return{play:()=>Promise.resolve(),pause:noop}});D('__showBootError',noop);D('__cdsDebugWarn',noop);D('CDS_DEBUG',false);
const real=console;global.console={log:noop,warn:noop,error:noop};
const SKIP=new Set(['cds-2_5d-gate-a-contracts-v02','cds-pre25d-runtime-auditor-v04','cds-r109-async-cup','cds-mobile-boot-bridge','cds-ux-boot']);
const html=fs.readFileSync(argv.build,'utf8');const re=/<script([^>]*)>([\s\S]*?)<\/script>/gi;let m,idx=0;
while((m=re.exec(html))){const id=(m[1].match(/id="([^"]+)"/)||[])[1]||('s'+idx);idx++;if(SKIP.has(id))continue;try{vm.runInThisContext(m[2],{filename:id+'.js'})}catch(_){}}
const P=MatchSim.prototype;const dd=(a,b,c,d)=>Math.hypot(a-c,b-d);
const saltos=[];let dentro=null;
for(const n of ['_giveBall','_receive','_turnover','_contestLoose','_looseBall','_deflectTo']){
  const o=P[n];if(typeof o!=='function')continue;
  P[n]=function(){const b=this.ball;const x0=+b.x,y0=+b.y;const ant=dentro;dentro=n;
    try{return o.apply(this,arguments)}finally{dentro=ant;
      const d=dd(x0,y0,b.x,b.y);
      if(d>1.5&&!(this.dead>0))saltos.push({d:+d.toFixed(2),f:n});}};
}
const db=buildDB(DATA);const N=Number(argv.matches||6);const FORMS=Object.keys(FORMATIONS);
const sq=db.squads.find(s=>s.c==='Brasil'&&Number(s.y)===1970)||db.squads[0];
const mk=(f,h)=>{const p=autoLineup(sq,f,0);return{squad:sq,name:sq.c,flag:sq.f,color:h?'#2e9bff':'#ff3d7f',lineup:p.lineup,bench:p.bench,formKey:f,style:'balanced'}};
for(let i=0;i<N;i++){srand(4200000+i*7919);const s=new MatchSim(mk(FORMS[i%FORMS.length],true),mk(FORMS[i%FORMS.length],false),{neutral:true,labMode:true});let g=0;while(!s.isOver()&&g++<400000)s.step(1/30);}
const porF={};for(const s of saltos)porF[s.f]=(porF[s.f]||0)+1;
const ds=saltos.map(s=>s.d).sort((a,b)=>a-b);
real.log(JSON.stringify({build:String(argv.build).replace(/^.*[\\/]/,''),partidas:N,
 SALTO_DA_BOLA_AO_TROCAR_DE_PE:{total:saltos.length,por_partida:+(saltos.length/N).toFixed(1),
  mediana:ds.length?ds[Math.floor(ds.length/2)]:null,p90:ds.length?ds[Math.floor(ds.length*.9)]:null,max:ds.length?ds[ds.length-1]:null},
 por_funcao:porF},null,1));
