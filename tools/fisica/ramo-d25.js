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
const html=fs.readFileSync(process.argv[2],'utf8');
const re=/<script([^>]*)>([\s\S]*?)<\/script>/gi;let m,i=0;
while((m=re.exec(html))){const id=(m[1].match(/id="([^"]+)"/)||[])[1]||('s'+i);i++;if(SKIP.has(id))continue;try{vm.runInThisContext(m[2],{filename:id})}catch(_){}}
const db=buildDB(DATA),FORMS=Object.keys(FORMATIONS);
const STYLES=(typeof STYLE_KEYS!=='undefined'&&Array.isArray(STYLE_KEYS))?STYLE_KEYS:['balanced','tiki','direct','press','counter','wings','park'];
const sq=db.squads.find(s=>s.c==='Brasil'&&Number(s.y)===1970)||db.squads[0];
const mk=(f,st,h)=>{const p=autoLineup(sq,f,0);return{squad:sq,name:sq.c,flag:sq.f,color:h?'#1':'#2',lineup:p.lineup,bench:p.bench,formKey:f,style:st}};
const N=Number(process.argv[3]||40);
let foraNoVoo={deflect:0,shot:0,outro:0}, ballOutDe={voo:0,rolagem:0,outro:0};
for(let k=0;k<N;k++){
  srand(4200000+k*7919);
  const sim=new MatchSim(mk(FORMS[k%FORMS.length],STYLES[k%STYLES.length],true),mk(FORMS[(k*3+1)%FORMS.length],STYLES[(k*5+2)%STYLES.length],false),{neutral:true,labMode:true});
  const P=Object.getPrototypeOf(sim);
  // conta quantas vezes uma bola VIAJANDO esta fora do campo
  const oldTravel=P._ballTravel;
  sim._ballTravel=function(dt){const r=oldTravel.call(this,dt);const b=this.ball;
    if(b&&b.traveling&&(b.y<0||b.y>FW||b.x<0||b.x>FL)){
      if(b.kind==='deflect')foraNoVoo.deflect++;else if(b.kind==='shot')foraNoVoo.shot++;else foraNoVoo.outro++;}
    return r;};
  // de onde vem cada _ballOut
  const oldOut=P._ballOut;
  sim._ballOut=function(){const b=this.ball;
    if(b&&b.traveling)ballOutDe.voo++;else if(b&&(b.vx||b.vy))ballOutDe.rolagem++;else ballOutDe.outro++;
    return oldOut.call(this);};
  let s=0;while(!sim.isOver()&&s++<500000)sim.step(1/30);
}
const pp=v=>+(v/N).toFixed(2);
console.log(JSON.stringify({partidas:N,
  quadrosComBolaVIAJANDOforaDoCampo:{deflect:pp(foraNoVoo.deflect),shot:pp(foraNoVoo.shot),outro:pp(foraNoVoo.outro)},
  ballOutChamadoCom:{bolaViajando:pp(ballOutDe.voo),bolaRolando:pp(ballOutDe.rolagem),bolaParada:pp(ballOutDe.outro)}},null,1));
