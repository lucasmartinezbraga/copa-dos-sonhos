/* ============================================================================
 * R18.30 · DEVER DEFENSIVO — defender a própria área também é dever de bola
 * ----------------------------------------------------------------------------
 * CADEIA MEDIDA, elo a elo:
 *
 * 1. O alvo devolvido pela cadeia COMPLETA de `_defendTarget` JÁ está dentro da
 *    área (15,05 m; mediana 13,25) — não é embrulho nem clamp.
 * 2. O zagueiro fica a 22,11 m: defasagem persistente de **+7,06 m**.
 * 3. NÃO é separação — a defasagem é 7,22 m mesmo com ZERO companheiros a
 *    <5,5 m (n=48.899) e é plana em todos os níveis de aperto.
 * 4. NÃO é alvo móvel — o alvo salta 0,20 m por tick em média.
 * 5. NÃO é tempo — a defasagem cai de 7,1 m para 4,3 m e ESTACIONA; o avanço
 *    por tick vai a 0,00 e depois a −0,01. Ele para seco.
 * 6. É a MARCHA. Em `_integrate` (linha ~7567):
 *
 *      const hasBallDuty = p._breaking || p._burst || p === this.ball.owner ||
 *                          (this.ball.traveling && this.ball.receiver === p);
 *      if (hasBallDuty || dist > 16) effort = 1; else effort = 0.55..1;  // TROTE
 *
 *    As quatro condições de urgência são TODAS ofensivas: dono da bola,
 *    recebedor, arranque, explosão. Um zagueiro recuando para defender um
 *    cruzamento não tem nenhuma delas. Medido em 142.212 amostras: só 17,1%
 *    têm `hasBallDuty`, o esforço médio é 0,80 e o teto de velocidade cai para
 *    4,44 m/s contra 5,96 m/s de sprint do próprio jogador. **Ele defende a
 *    própria área a 74% da capacidade.**
 *
 * O conserto é declarar o que faltava: quando a bola VIAJA para dentro da
 * própria área, quem defende tem dever de bola e corre. Nada mais muda — nem
 * alvo, nem linha, nem sorteio. Uma condição.
 * ==========================================================================*/
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

function arg(n, d) { const h = process.argv.slice(2).find(a => a.startsWith('--' + n + '=')); return h ? h.slice(n.length + 3) : d; }
const inFile = arg('in', 'rc5-entrega.html'), outFile = arg('out', 'rd-dever.html');
const RAIO = Number(arg('raio', 20));   // m do próprio gol que definem "minha área"

let src = fs.readFileSync(inFile, 'utf8');
const applied = [];
function edit(id, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) { console.error('ABORTA [' + id + ']: âncora ' + n + 'x'); process.exit(1); }
  src = src.replace(from, to); applied.push(id);
}

edit('r1830-dever-defensivo',
`const duty=p._breaking||p._burst||p===this.ball.owner||p.__chase||(this.ball.traveling&&this.ball.receiver===p);let effort;`,
`/* §R18.30 · DEVER DEFENSIVO. As condicoes de \`duty\` sao todas de urgencia
     OFENSIVA (dono, recebedor, arranque, explosao) mais \`__chase\`, que exige
     estar a 2,5 m da bola ou ser o pressionador. Um zagueiro recuando para
     defender um cruzamento em voo nao e nenhum deles, entao a menos de 16 m do
     alvo cai para ~0,77 de esforco: teto de 4,44 m/s contra 5,96 m/s de sprint
     dele. Defende a propria area trotando, e para a 4,3 m do alvo. Quando a
     bola VIAJA para dentro da propria area, quem defende corre. */
  p.__defDuty=!p.isGK&&!!_bb&&!!_bb.traveling&&_bb.kind==='pass'&&!!_bb.target&&this.poss!==p.team&&!!this.teams[p.team]&&!!this.teams[p.team].goal&&Math.hypot(finite(_bb.target.x)-finite(this.teams[p.team].goal.x),finite(_bb.target.y)-finite(this.teams[p.team].goal.y))<${RAIO};
  const duty=p._breaking||p._burst||p===this.ball.owner||p.__chase||p.__defDuty||(this.ball.traveling&&this.ball.receiver===p);let effort;`);

const idAnchor = src.indexOf(`root.CDS_BUILD_ID='R18.29'`) >= 0
  ? [`  root.CDS_BUILD_ID='R18.29'; root.CDS_VERSION='5.23.0-R18.29';`, 'R18.29']
  : [`  root.CDS_BUILD_ID='R18.25'; root.CDS_VERSION='5.19.0-R18.25';`, 'R18.25'];

edit('r1830-id', idAnchor[0],
`  root.CDS_R1830_DEVER=Object.freeze({
    version:'R18.30', label:'DEVER DEFENSIVO', sobre:'${idAnchor[1]}', raio:${RAIO},
    note:'hasBallDuty em _integrate so reconhecia urgencia ofensiva (dono, recebedor, arranque, explosao). Zagueiro recuando para defender cruzamento nao tinha nenhuma: 142.212 amostras, 17,1% com duty, esforco medio 0,80, teto 4,44 m/s contra 5,96 m/s de sprint. Defendia a propria area a 74% da capacidade.'
  });
  root.CDS_BUILD_ID='R18.30'; root.CDS_VERSION='5.24.0-R18.30';`);

fs.writeFileSync(outFile, src, 'utf8');
console.log(path.basename(outFile), '|', crypto.createHash('sha256').update(fs.readFileSync(outFile)).digest('hex').slice(0, 12),
            '| sobre', idAnchor[1], '| raio', RAIO);
