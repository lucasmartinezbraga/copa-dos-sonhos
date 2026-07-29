/* ============================================================================
 * R18.31 · A ENTREGA SEM DISPUTA VIRA BOLA LIVRE — o sorteio morre sozinho
 * ----------------------------------------------------------------------------
 * O ramo `!atk` de `_cross` (5,47 lances/partida, 37,5% de todos os cruzamentos)
 * resolvia o lance com `chance(CAL.restarts.failedCrossCorner)` — um cara-ou-
 * coroa entre escanteio e tiro de meta, sem ninguém tocar a bola.
 *
 * POR QUE ISSO, E NÃO MAIS POSICIONAMENTO. Persegui a área vazia por quatro
 * camadas (ponto de entrega, posição do goleiro, profundidade da linha, marcha
 * do jogador). Cada correção estava certa e nenhuma virou futebol: a melhor
 * entregou 0,18 zagueiro na área. O motivo é que **estar na área não paga** —
 * o desfecho é sorteado independentemente de quem está lá. Enquanto a presença
 * não tiver consequência, nenhum ajuste de posição cria motivo para estar lá.
 *
 * A PEÇA QUE FALTAVA JÁ EXISTE E ESTÁ CORRETA. `_ballOut()` (linha ~6927)
 * deriva o reinício da GEOMETRIA: linha de fundo com último toque da defesa =
 * escanteio, senão tiro de meta; lateral = reposição para quem não tocou. O
 * censo mediu que ela acerta **99,3%** das vezes em que a bola realmente sai.
 * O problema nunca foi a regra — era a bola nunca chegar até ela.
 *
 * ARMADILHA EVITADA: `_looseBall(x,y)` NÃO é "bola fica solta". Ele zera a
 * velocidade e chama `_contestLoose()`, que entrega a bola ao jogador mais
 * próximo **sem nenhum limite de distância**. Foi assim que a R18.22 inflou o
 * xG em 30%: a bola materializava na pequena área no pé de quem estivesse mais
 * perto. Aqui a bola é solta pelo caminho certo — `_looseRoll` (linha ~6538),
 * que rola com atrito, exige **1,7 m** para alguém alcançar e chama `_ballOut`
 * quando cruza a linha.
 *
 * Resultado esperado, e é o ponto: quem está na área ganha a bola; quem não
 * está, vê a bola sair. A presença passa a pagar, e o escanteio passa a nascer
 * de um toque de verdade.
 * ==========================================================================*/
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const BASE_SHA = 'ddccf733e8803af282420f9ba095165e22f7eee0147a04af6a12d5cc12552653'; // R18.25

function arg(n, d) { const h = process.argv.slice(2).find(a => a.startsWith('--' + n + '=')); return h ? h.slice(n.length + 3) : d; }
const inFile = arg('in', 'rc5-entrega.html'), outFile = arg('out', 'rl-livre.html'), force = arg('force', '') === '1';
const VMIN = Number(arg('vmin', 7));   // m/s mínimos com que a bola segue

let src = fs.readFileSync(inFile, 'utf8');
const sha = crypto.createHash('sha256').update(fs.readFileSync(inFile)).digest('hex');
if (sha !== BASE_SHA && !force) { console.error('ABORTA: sha da base não bate.'); process.exit(1); }

const applied = [];
function edit(id, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) { console.error('ABORTA [' + id + ']: âncora ' + n + 'x'); process.exit(1); }
  src = src.replace(from, to); applied.push(id);
}

edit('r1831-bola-livre',
`      this._startTravel(o,{x:g.x-tm.attackDir*(5.5+R(0,5.5)),y:FW/2+R(-8,8)},'pass',()=>{if(chance(CAL.restarts.failedCrossCorner))this._setCorner(o.team);else this._goalKickOrRestart(1-o.team);},null,'launch');`,
`      const __alvo={x:g.x-tm.attackDir*(5.5+R(0,5.5)),y:FW/2+R(-8,8)};
      this._startTravel(o,__alvo,'pass',()=>{
        /* §R18.31 · a bola NÃO é resolvida: ela segue. Quem alcançar (1,7 m,
           regra do _looseRoll) fica com ela; se ninguém alcançar, ela cruza a
           linha e o reinício nasce de _ballOut, que já deriva escanteio ou
           tiro de meta do último toque real. Nada de _looseBall aqui: aquele
           entrega a bola ao mais próximo sem limite de distância. */
        const _b=this.ball;
        _b.owner=null; _b.traveling=false; _b.meta=null; _b.receiver=null; _b.onArrive=null;
        let _vx=Number.isFinite(_b.vx)?_b.vx:0, _vy=Number.isFinite(_b.vy)?_b.vy:0;
        const _v=Math.hypot(_vx,_vy);
        if(!(_v>${VMIN})){
          /* a bola tem de MANTER a jogada viva: segue no rumo da entrega. */
          const _dx=__alvo.x-o.x, _dy=__alvo.y-o.y, _L=Math.max(.001,Math.hypot(_dx,_dy));
          _vx=_dx/_L*${VMIN}; _vy=_dy/_L*${VMIN};
        }
        _b.vx=_vx; _b.vy=_vy; _b.vz=Math.min(0,Number.isFinite(_b.vz)?_b.vz:0);
        _b._looseT=0; _b.__p04Live=true;
        this._emit('cross_livre',{by:o,x:_b.x,y:_b.y});
      },null,'launch');`);

edit('r1831-id',
`  root.CDS_BUILD_ID='R18.25'; root.CDS_VERSION='5.19.0-R18.25';`,
`  root.CDS_R1831_BOLALIVRE=Object.freeze({
    version:'R18.31', label:'ENTREGA SEM DISPUTA VIRA BOLA LIVRE', vmin:${VMIN},
    note:'O ramo !atk de _cross resolvia 5,47 lances por partida num chance(.76) entre escanteio e tiro de meta, sem ninguem tocar a bola. Agora a bola SEGUE: quem alcanca (1,7 m, regra do _looseRoll) fica com ela, e quem nao alcanca ve a bola sair — com o reinicio derivado por _ballOut do ultimo toque real. _looseBall foi evitado de proposito: ele entrega a bola ao mais proximo sem limite de distancia e foi o que inflou o xG em 30% na R18.22.'
  });
  root.CDS_BUILD_ID='R18.31'; root.CDS_VERSION='5.25.0-R18.31';`);

edit('r1831-title', `  if(root.document)root.document.title='Copa dos Sonhos — R18.25';`,
                    `  if(root.document)root.document.title='Copa dos Sonhos — R18.31';`);
edit('r1831-head', `<title>Copa dos Sonhos — R18.25</title>`, `<title>Copa dos Sonhos — R18.31</title>`);

fs.writeFileSync(outFile, src, 'utf8');
console.log(path.basename(outFile), '|', crypto.createHash('sha256').update(fs.readFileSync(outFile)).digest('hex').slice(0, 12), '| vmin', VMIN);
