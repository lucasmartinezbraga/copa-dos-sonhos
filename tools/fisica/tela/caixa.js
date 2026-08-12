const path=require('path');const {pathToFileURL}=require('url');
const {chromium}=require('/opt/node22/lib/node_modules/playwright');
const alvo=path.resolve(process.argv[2]||'dist/index.html');
const larguras=[[1400,900],[1920,1080],[1280,800],[1024,768]];
/* O criterio de aceite do D24 e "vazio <= 4% nas 4 resolucoes". Ele e medido
   em AREA desde 2026-08-12 — ver o comentario no calculo abaixo. */
(async()=>{
  const nav=await chromium.launch({headless:true,args:['--no-sandbox']});
  for(const [w,h] of larguras){
    const pg=await nav.newPage({viewport:{width:w,height:h}});
    await pg.goto(pathToFileURL(alvo).href,{waitUntil:'load',timeout:120000});
    await pg.waitForTimeout(1500);
    await pg.evaluate(()=>{window.__quickMatch(40,120);});
    await pg.waitForTimeout(1200);
    const r=await pg.evaluate(()=>{
      const c=document.querySelector('#fieldcv');const b=c.getBoundingClientRect();
      const cs=getComputedStyle(c);const wrap=c.parentElement;const wb=wrap.getBoundingClientRect();
      const regras=[];
      for(const sh of document.styleSheets){
        let rr; try{rr=sh.cssRules}catch(e){continue}
        const varre=(lista,ctx)=>{for(const x of lista){
          if(x.type===4){varre(x.cssRules,x.conditionText);continue}
          if(x.type!==1)continue;
          try{ if(!c.matches(x.selectorText))continue }catch(e){continue}
          const t=x.style;
          if(t.height||t.aspectRatio||t.width||t.objectFit)
            regras.push({sel:x.selectorText.slice(0,70),mq:ctx||'',h:t.height,w:t.width,ar:t.aspectRatio,of:t.objectFit});
        }};
        varre(rr,'');
      }
      return {vw:innerWidth,vh:innerHeight,backing:[c.width,c.height],
        caixa:[Math.round(b.width),Math.round(b.height)],
        wrap:[Math.round(wb.width),Math.round(wb.height)],
        css:{h:cs.height,w:cs.width,ar:cs.aspectRatio,of:cs.objectFit},regras};
    });
    const arCanvas=r.backing[0]/r.backing[1], arCaixa=r.caixa[0]/r.caixa[1];
    /* AREA, nao so altura. A versao anterior media apenas a tarja VERTICAL —
       `1 - alturaUsada/alturaDaCaixa`. Com essa metrica, esticar o canvas na
       altura "conserta" o defeito e cria tarja LATERAL que ela nao ve: daria
       para zerar o numero piorando a tela. Otimizar metrica cega e a armadilha
       B1/B8 deste projeto.
       Agora: quanto da AREA da caixa o campo ocupa, com as duas sobras
       separadas para se saber de que lado esta. */
    const usada=Math.min(r.caixa[1], r.caixa[0]/arCanvas);       /* altura ocupada */
    const usadaW=Math.min(r.caixa[0], r.caixa[1]*arCanvas);      /* largura ocupada */
    const sobraV=100*(1-usada/r.caixa[1]);
    const sobraH=100*(1-usadaW/r.caixa[0]);
    const sobraArea=100*(1-(usada*usadaW)/(r.caixa[0]*r.caixa[1]));
    /* O NUMERO QUE VALE E CONTRA O QUADRO, NAO CONTRA O CANVAS.
       As linhas acima medem o quanto o desenho preenche o ELEMENTO canvas. Dá
       para zerar isso sem melhorar nada: basta o canvas se dimensionar por
       aspecto (width:auto) — a sobra sai de dentro dele e vai para o
       `.field-wrap`, onde continua preta e continua na cara do jogador.
       Este e o numero honesto: quanto do QUADRO esta ocupado pelo gramado. */
    const vazioQuadro=100*(1-(usada*usadaW)/(r.wrap[0]*r.wrap[1]));
    console.log(`\n=== viewport ${w}x${h} ===`);
    console.log(` backing ${r.backing.join('x')} (ar ${arCanvas.toFixed(3)})  caixa ${r.caixa.join('x')} (ar ${arCaixa.toFixed(3)})`);
    console.log(` campo ocupa ${usadaW.toFixed(0)}x${usada.toFixed(0)} de ${r.caixa.join('x')}`);
    console.log(` VAZIO no canvas: ${sobraArea.toFixed(1)}%   (vertical ${sobraV.toFixed(1)}%, lateral ${sobraH.toFixed(1)}%)`);
    console.log(` VAZIO NO QUADRO: ${vazioQuadro.toFixed(1)}%   quadro ${r.wrap.join('x')}   <== e este que o jogador ve`);
    console.log(` computado: height=${r.css.h} aspect-ratio=${r.css.ar} object-fit=${r.css.of}`);
    for(const g of r.regras) console.log(`   @${(g.mq||'-').slice(0,46)}  {${g.sel}}  h=${g.h||''} w=${g.w||''} ar=${g.ar||''} of=${g.of||''}`);
    await pg.close();
  }
  await nav.close();
})().catch(e=>{console.error(e);process.exit(1)});
