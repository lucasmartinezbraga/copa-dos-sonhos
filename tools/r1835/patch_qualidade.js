/* R18.34 · A FINALIZAÇÃO DO RASTEIRO PASSA A DEPENDER DA DISTÂNCIA.
   `pGoal` do low_cross_shot (linha ~5354) NÃO TEM TERMO DE DISTÂNCIA:
       clamp((.16+(finish-keeper)/100*.23+ctx.execution*.09)*.82, .06, .40)
   O mesmo 0,40 vale a 5 m e a 42 m. Medido: mediana 25,3 m do gol, 23,6% além
   de 30 m, 51% de TODAS as finalizações do jogo. Cortar a rota custa 30% da
   producao de chance (medido, R18.33); dar-lhe distancia mantem o volume e
   torna o chute longo o que ele e: improvavel. */
const fs=require('fs'),crypto=require('crypto'),path=require('path');
const a=(n,d)=>{const h=process.argv.slice(2).find(x=>x.startsWith('--'+n+'='));return h?h.slice(n.length+3):d;};
const PERTO=Number(a('perto',9)), LONGE=Number(a('longe',30)), PISO=Number(a('piso',0.16));
let src=fs.readFileSync(a('in','rl-livre.html'),'utf8');
const A=`        const pGoal=clamp((.16+(finish-keeper)/100*.23+ctx.execution*.09)*.82,.06,.40);`;
const B=`        /* §R18.34 · distância. Sem este fator o mesmo pGoal de 0,40 valia a 5 m
           e a 42 m — e 51% das finalizações do jogo saem desta rota, com mediana
           de 25,3 m. Agora a chance cai com a distância, como no futebol. */
        const _dGol=D(atk.x,atk.y,g.x,g.y);
        const _fd=clamp(1-(clamp(_dGol,${PERTO},${LONGE})-${PERTO})/(${LONGE}-${PERTO})*(1-${PISO}),${PISO},1);
        const pGoal=clamp((.16+(finish-keeper)/100*.23+ctx.execution*.09)*.82*_fd,.02,.40);`;
if(src.split(A).length-1!==1){console.error('ancora nao unica');process.exit(1);}
src=src.replace(A,B);
const ID=`  root.CDS_BUILD_ID='R18.31'; root.CDS_VERSION='5.25.0-R18.31';`;
if(src.split(ID).length-1===1){
  src=src.replace(ID,`  root.CDS_R1834_QUALIDADE=Object.freeze({version:'R18.34',label:'FINALIZACAO DO RASTEIRO DEPENDE DA DISTANCIA',perto:${PERTO},longe:${LONGE},piso:${PISO},
    note:'pGoal do low_cross_shot nao tinha termo de distancia: 0,40 valia a 5 m e a 42 m. A rota e 51% das finalizacoes, com mediana 25,3 m.'});
  root.CDS_BUILD_ID='R18.34'; root.CDS_VERSION='5.28.0-R18.34';`);
  src=src.replace(`  if(root.document)root.document.title='Copa dos Sonhos — R18.31';`,`  if(root.document)root.document.title='Copa dos Sonhos — R18.34';`);
  src=src.replace(`<title>Copa dos Sonhos — R18.31</title>`,`<title>Copa dos Sonhos — R18.34</title>`);
}
fs.writeFileSync(a('out','rq.html'),src,'utf8');
console.log(path.basename(a('out','rq.html')),'| perto',PERTO,'longe',LONGE,'piso',PISO,'|',crypto.createHash('sha256').update(fs.readFileSync(a('out','rq.html'))).digest('hex').slice(0,12));
