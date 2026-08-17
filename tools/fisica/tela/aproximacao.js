#!/usr/bin/env node
'use strict';
/* A APROXIMACAO DO BATEDOR, quadro a quadro.
   Para cada espera de bola parada: quanto ele tinha de andar, quanto tempo
   teve, quanto ANDOU DE FATO, e quanto sobrou para o snap do reinicio.
   Se ele anda a passo cheio e o tempo acaba, o gargalo e o teto.
   Se ele para no meio, o gargalo e outro escritor. */
const path=require('path'); const {pathToFileURL}=require('url');
function pw(){for(const c of ['playwright','/opt/node22/lib/node_modules/playwright']){try{return require(c);}catch(_){}}process.exit(0);}
const {chromium}=pw();
const argv=Object.fromEntries(process.argv.slice(2).filter(a=>a.startsWith('--')).map(a=>{const[k,v]=a.replace(/^--/,'').split('=');return[k,v==null?true:v];}));
const alvo=path.resolve(process.argv.slice(2).find(a=>!a.startsWith('--'))||'dist/index.html');
(async()=>{
  const nav=await chromium.launch({headless:true,...(process.env.CDS_CHROMIUM?{executablePath:process.env.CDS_CHROMIUM}:{}),args:['--no-sandbox']});
  const pg=await nav.newPage({viewport:{width:1366,height:768}});
  await pg.goto(pathToFileURL(alvo).href,{waitUntil:'load',timeout:120000});
  await pg.waitForTimeout(1200);
  await pg.evaluate(()=>{
    const S=window.__ap={casos:[]};
    const P=window.MatchSim.prototype, old=P.step;
    let cur=null;
    P.step=function(dt){
      const wAntes=this.__cdsTakerWait;
      let px=0,py=0;
      if(cur&&wAntes===cur.w&&cur.t){px=cur.t.x;py=cur.t.y;}
      const r=old.apply(this,arguments);
      try{
        const w=this.__cdsTakerWait;
        if(w&&(!cur||cur.w!==w)){
          const t=w.taker;
          cur={w:w,t:t,d0:t?Math.hypot(t.x-w.x,t.y-w.y):0,t0:this.t,
               until:w.until,andou:0,quadros:0,parados:0,dfim:0};
          S.casos.push(cur);
        }else if(cur&&w===cur.w&&cur.t){
          const passo=Math.hypot(cur.t.x-px,cur.t.y-py);
          cur.andou+=passo; cur.quadros++;
          if(passo<0.02)cur.parados++;
          cur.dfim=Math.hypot(cur.t.x-w.x,cur.t.y-w.y);
          cur.tfim=this.t;
        }else if(cur&&!w&&cur.t){
          /* a marca morreu: e aqui que o reinicio dispara */
          if(!cur.fechado){cur.fechado=true;cur.dSnap=Math.hypot(cur.t.x-cur.w.x,cur.t.y-cur.w.y);}
          cur=null;
        }
      }catch(_){}
      return r;
    };
  });
  await pg.evaluate(()=>window.__quickMatch(40,120));
  await pg.waitForTimeout(420000);
  const r=await pg.evaluate(()=>({c:window.__ap.casos.map(c=>({d0:c.d0,andou:c.andou,dfim:c.dfim,dSnap:c.dSnap,
      janela:(c.until-c.t0),usado:(c.tfim||c.t0)-c.t0,quadros:c.quadros,parados:c.parados})),m:window.GAME._sim().minute}));
  await nav.close();
  console.log('\n=== APROXIMACAO DO BATEDOR ===  minuto', r.m.toFixed(1), '| casos', r.c.length, '\n');
  console.log('  precisava  andou   sobrou  snap   janela  usado  quadros  parados(%)');
  const falhos=[];
  for(const c of r.c){
    const f=(c.dSnap!=null?c.dSnap:c.dfim)>1.0;
    if(f)falhos.push(c);
    console.log('  '+c.d0.toFixed(1).padStart(8), c.andou.toFixed(1).padStart(7), (c.dfim||0).toFixed(1).padStart(7),
      (c.dSnap!=null?c.dSnap.toFixed(1):'  -').padStart(6), c.janela.toFixed(2).padStart(7), c.usado.toFixed(2).padStart(6),
      String(c.quadros).padStart(7), (100*c.parados/Math.max(1,c.quadros)).toFixed(0).padStart(8), f?' <-- SNAP GRANDE':'');
  }
  console.log('\ncasos com snap > 1 m:', falhos.length, 'de', r.c.length);
  if(falhos.length){
    const med=a=>a.reduce((x,y)=>x+y,0)/a.length;
    console.log('  nesses casos: precisava', med(falhos.map(c=>c.d0)).toFixed(1),
      'm | andou', med(falhos.map(c=>c.andou)).toFixed(1),
      'm | janela', med(falhos.map(c=>c.janela)).toFixed(2),
      's | usou', med(falhos.map(c=>c.usado)).toFixed(2),
      's | quadros parado', med(falhos.map(c=>100*c.parados/Math.max(1,c.quadros))).toFixed(0)+'%');
    console.log('  velocidade efetiva:', (med(falhos.map(c=>c.andou))/Math.max(.01,med(falhos.map(c=>c.usado)))).toFixed(2), 'm/s   (a caminhada nominal e 6,5)');
  }
  process.exit(0);
})();
