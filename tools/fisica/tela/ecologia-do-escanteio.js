#!/usr/bin/env node
'use strict';
/* Le os contadores que a propria camada R18.18.3 ja mantem: quantos escanteios
   cada um dos seis caminhos fabrica, e quantos ficam vivos. */
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
  await pg.evaluate(()=>window.__quickMatch(40,120));
  await pg.waitForTimeout(Number(argv.segundos||480)*1000);
  const r=await pg.evaluate(()=>{const s=window.GAME._sim();
    const e=s.__r18183||{};const o={};for(const k of Object.keys(e))if(typeof e[k]==='number')o[k]=e[k];
    return {e:o,causa:(e.cornerCause||{}),m:s.minute,
            corners:(s.stats&&s.stats[0]?s.stats[0].corners:0)+(s.stats&&s.stats[1]?s.stats[1].corners:0)};});
  await nav.close();
  const pp=r.m>0?90/r.m:1;
  console.log('\n=== ECOLOGIA DE ESCANTEIO (contadores da R18.18.3) ===  minuto',r.m.toFixed(1));
  console.log('escanteios no placar:',r.corners,'->',(r.corners*pp).toFixed(1),'por partida (alvo 8,0 · teto 11,5)\n');
  const par=[['bloqueio',['blockResolutions','blockCorners','blockThrowIns','blockLive']],
             ['espalmada',['saveParriesResolved','saveParryCorners','saveParryLive']],
             ['soco',['punchesResolved','punchCorners','punchLive']],
             ['outros',['emergencyClearCorners','boxDuelCorners','clearBehindPhysical']]];
  for(const [t,ks] of par){
    console.log('  '+t);
    for(const k of ks) if(r.e[k]!=null)
      console.log('    '+k.padEnd(24),String(r.e[k]).padStart(4),'->',(r.e[k]*pp).toFixed(1).padStart(5),'/partida');
  }
  console.log('\n  causa marcada:',JSON.stringify(r.causa));
  const outC=(r.e.blockCorners||0)+(r.e.saveParryCorners||0)+(r.e.punchCorners||0)+
             (r.e.emergencyClearCorners||0)+(r.e.boxDuelCorners||0)+(r.e.clearBehindPhysical||0);
  console.log('  TOTAL fabricado pela camada:',outC,'->',(outC*pp).toFixed(1),'/partida');
  process.exit(0);
})();
