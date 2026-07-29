/* ============================================================================
 * R18.25 · P3 — O CRUZAMENTO SEM ALVO É ENTREGUE NA ÁREA, NÃO NA LINHA DE GOL
 * ----------------------------------------------------------------------------
 * Duas hipóteses minhas caíram antes desta. P1 (goleiro sai) e P2 (goleiro para
 * de seguir o ponta) foram implementadas, medidas e não moveram a distância:
 * 9,4 m antes, 8,9 m e 9,4 m depois. A geometria completa mostra por quê:
 *
 *   NA CHEGADA          goleiro   bola
 *   profundidade ....... 5,6 m    0,0 m   (a linha de gol)
 *   desvio lateral ..... 2,9 m    5,6 m
 *   distância entre eles ......... 9,4 m
 *
 * Lateralmente eles estão a 2,7 m. TODA a distância está na profundidade: o
 * alvo é `{x: g.x, ...}` — em cima da própria linha de gol, 5,6 m ATRÁS do
 * goleiro e atrás de toda a defesa. Cruzamento nenhum é entregue ali. Nenhum
 * jogador de futebol fica na própria linha de gol, então por construção não há
 * quem dispute: a "área vazia" deste ramo é artefato do ponto de entrega.
 *
 * O próprio motor já sabe a geometria certa: o ramo do cruzamento RASTEIRO, 50
 * linhas acima, entrega em `x: g.x - tm.attackDir*5.2`. Aqui a bola passa a cair
 * entre a pequena área e a marca do pênalti — onde o goleiro (5,6 m) e a defesa
 * de fato estão.
 *
 * Nada mais é tocado: nem sorteio, nem `_goalkeeperClaim`, nem posicionamento.
 * A rotina de saída do goleiro (linha ~6999) tem raio de 1,25–2,9 m e passa a
 * alcançar sozinha; o soco dela é um dos poucos escanteios que o jogo produz
 * por evento real.
 * ==========================================================================*/
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const BASE_SHA = '3b2fece8ac4a9d9cbd93d01959bc53f4bbc230a98dcb41e46650a52691b8ddb4'; // R18.21-RC2

function arg(n, d) { const h = process.argv.slice(2).find(a => a.startsWith('--' + n + '=')); return h ? h.slice(n.length + 3) : d; }
const inFile = arg('in', 'rc1-fix.html'), outFile = arg('out', 'rc5-entrega.html'), force = arg('force', '') === '1';

let src = fs.readFileSync(inFile, 'utf8');
const sha = crypto.createHash('sha256').update(fs.readFileSync(inFile)).digest('hex');
if (sha !== BASE_SHA && !force) { console.error('ABORTA: sha da base não bate.\n esperado ' + BASE_SHA + '\n lido     ' + sha); process.exit(1); }

const applied = [];
function edit(id, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) { console.error('ABORTA [' + id + ']: âncora ' + n + 'x (esperado 1)'); process.exit(1); }
  src = src.replace(from, to); applied.push(id);
}

edit('r1825-entrega-na-area',
`      this._startTravel(o,{x:g.x,y:FW/2+R(-8,8)},'pass',()=>{if(chance(CAL.restarts.failedCrossCorner))this._setCorner(o.team);else this._goalKickOrRestart(1-o.team);},null,'launch');`,
`      /* §R18.25 · o alvo era {x:g.x}, EM CIMA da linha de gol — 5,6 m atrás do
         goleiro e atrás de toda a defesa. Ninguém disputava porque ninguém está
         na própria linha de gol. Agora cai entre a pequena área e a marca do
         pênalti, mesma geometria que o ramo rasteiro já usa (g.x - dir*5.2). */
      this._startTravel(o,{x:g.x-tm.attackDir*(5.5+R(0,5.5)),y:FW/2+R(-8,8)},'pass',()=>{if(chance(CAL.restarts.failedCrossCorner))this._setCorner(o.team);else this._goalKickOrRestart(1-o.team);},null,'launch');`);

edit('r1825-identidade',
`  root.CDS_BUILD_ID='R18.21-RC2'; root.CDS_VERSION='5.15.1-R18.21-RC2';`,
`  root.CDS_R1825_ENTREGA=Object.freeze({
    version:'R18.25', label:'CRUZAMENTO ENTREGUE NA AREA', parte:'P3',
    note:'O cruzamento sem alvo era entregue em cima da linha de gol (x=g.x), 5,6 m atras do goleiro e de toda a defesa — por isso ninguem disputava. Medido: goleiro a 5,6 m de profundidade e bola a 0,0; lateralmente separados por so 2,7 m. Agora cai entre a pequena area e a marca do penalti.'
  });
  root.CDS_BUILD_ID='R18.25'; root.CDS_VERSION='5.19.0-R18.25';`);

edit('r1825-title-runtime', `  if(root.document)root.document.title='Copa dos Sonhos — R18.21-RC2';`,
                            `  if(root.document)root.document.title='Copa dos Sonhos — R18.25';`);
edit('r1825-title-head', `<title>Copa dos Sonhos — R18.21-RC2</title>`, `<title>Copa dos Sonhos — R18.25</title>`);

fs.writeFileSync(outFile, src, 'utf8');
console.log('patches:', applied.join(', '));
console.log('saída:', path.basename(outFile), fs.statSync(outFile).size, 'bytes');
console.log('sha256:', crypto.createHash('sha256').update(fs.readFileSync(outFile)).digest('hex'));
