const path=require('path');const {pathToFileURL}=require('url');
const {chromium}=require('/opt/node22/lib/node_modules/playwright');
const alvo=path.resolve(process.argv[2]||'dist/index.html');
(async()=>{
  const nav=await chromium.launch({headless:true,args:['--no-sandbox']});
  const pg=await nav.newPage({viewport:{width:1280,height:820}});
  await pg.goto(pathToFileURL(alvo).href,{waitUntil:'load',timeout:120000});
  await pg.waitForTimeout(1800);
  await pg.evaluate(()=>{
    const P=window.MatchSim.prototype; window.__d={v:[],tel:[]};
    const old=P.step;
    P.step=function(dt){
      const b=this.ball, zA=b?b.z:0, viaj=b?!!b.traveling:false;
      const r=old.apply(this,arguments);
      const zB=b?b.z:0;
      if((+dt||0)>0){
        const taxa=(zA-zB)/(+dt);
        /* so descidas COM a bola em voo antes e depois: trajetoria de verdade */
        if(taxa>0&&viaj&&b&&b.traveling) window.__d.v.push(+taxa.toFixed(2));
        else if(taxa>0&&zB===0&&zA>0.25) window.__d.tel.push(+taxa.toFixed(1));
      }
      return r;
    };
  });
  await pg.evaluate(()=>{window.__quickMatch(40,120);window.G.speed=6;});
  await pg.waitForTimeout(60000);
  const d=await pg.evaluate(()=>window.__d); await nav.close();
  const q=(a,p)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.min(s.length-1,Math.floor(s.length*p))]:NaN};
  console.log(`descidas em VOO legitimo: n=${d.v.length}`);
  for(const p of [.5,.9,.99,.999,1]) console.log(`   p${(p*100).toFixed(1).padStart(5)}  ${q(d.v,p).toFixed(1)} m/s`);
  console.log(`\nteletransportes (z>0,25 -> 0): n=${d.tel.length}`);
  for(const p of [.5,.9,1]) console.log(`   p${(p*100).toFixed(0).padStart(3)}  ${q(d.tel,p).toFixed(0)} m/s`);
})().catch(e=>{console.error(e);process.exit(1)});
