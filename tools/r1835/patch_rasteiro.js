/* R18.33 · O CRUZAMENTO RASTEIRO SÓ VAI PARA QUEM ESTÁ EM POSIÇÃO DE FINALIZAR.
   Medido na R18.31: low_cross_shot = 6,00/partida, 51% de TODAS as finalizações,
   mediana 25,3 m do gol, 23,6% além de 30 m, máximo 42 m — com pGoal de até 0,40,
   calibrado para bola a 5 m. O chute normal (shot_taken) está em 16,6 m de
   mediana e 1,8% além de 30 m: o problema é só esta rota.
   Causa: `lowPool` (linha 5305) aceita atacante a até 44 m do gol. */
const fs=require('fs'),crypto=require('crypto'),path=require('path');
const a=(n,d)=>{const h=process.argv.slice(2).find(x=>x.startsWith('--'+n+'='));return h?h.slice(n.length+3):d;};
const RAIO=Number(a('raio',44)), RAIO2=Number(a('raio2',27));
let src=fs.readFileSync(a('in','rl-livre.html'),'utf8');
const A=`    const lowPool = tm.players.filter(p=>p!==o&&!p.red&&!p.isGK&&D(p.x,p.y,g.x,g.y)<44 && (C.LINE_OF[p.slotPos]==='FWD' || C.SLOT_CLASS[p.slotPos]==='AM' || p._breaking || p._runDeep || D(p.x,p.y,g.x,g.y)<27));`;
const B=`    const lowPool = tm.players.filter(p=>p!==o&&!p.red&&!p.isGK&&D(p.x,p.y,g.x,g.y)<${RAIO} && (C.LINE_OF[p.slotPos]==='FWD' || C.SLOT_CLASS[p.slotPos]==='AM' || p._breaking || p._runDeep || D(p.x,p.y,g.x,g.y)<${RAIO2}));`;
if(src.split(A).length-1!==1){console.error('ancora nao unica');process.exit(1);}
src=src.replace(A,B);
const ID=`  root.CDS_BUILD_ID='R18.31'; root.CDS_VERSION='5.25.0-R18.31';`;
if(src.split(ID).length-1===1){
  src=src.replace(ID,`  root.CDS_R1833_RASTEIRO=Object.freeze({
    version:'R18.33', label:'CRUZAMENTO RASTEIRO SO PARA QUEM FINALIZA', raio:${RAIO}, raio2:${RAIO2},
    note:'low_cross_shot era 6,00/partida e 51% de TODAS as finalizacoes, com mediana 25,3 m do gol, 23,6% alem de 30 m e maximo 42 m — recebendo pGoal de ate 0,40, calibrado para bola a 5 m. O lowPool aceitava atacante a ate 44 m. Chute normal estava sadio (mediana 16,6 m, 1,8% alem de 30 m): a patologia era so esta rota.'
  });
  root.CDS_BUILD_ID='R18.33'; root.CDS_VERSION='5.27.0-R18.33';`);
  src=src.replace(`  if(root.document)root.document.title='Copa dos Sonhos — R18.31';`,`  if(root.document)root.document.title='Copa dos Sonhos — R18.33';`);
  src=src.replace(`<title>Copa dos Sonhos — R18.31</title>`,`<title>Copa dos Sonhos — R18.33</title>`);
}
fs.writeFileSync(a('out','rn.html'),src,'utf8');
console.log(path.basename(a('out','rn.html')),'| raio',RAIO,'raio2',RAIO2,'|',crypto.createHash('sha256').update(fs.readFileSync(a('out','rn.html'))).digest('hex').slice(0,12));
