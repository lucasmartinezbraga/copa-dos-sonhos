/* ============================================================================
 * R18.28 · DEFESA DE CRUZAMENTO É ZONAL — os zagueiros ocupam a própria área
 * ----------------------------------------------------------------------------
 * MEDIDO no instante em que o cruzamento sai (52 lances, 12 partidas):
 *   zagueiro mais próximo do próprio gol .......... 26,6 m
 *   defensores dentro da própria grande área ...... 0,25
 *   atacantes a até 12 m do ponto de chegada ...... 0,04
 *
 * CAUSA, localizada: com a bola no terço final `defThird` é verdadeiro e TODO
 * defensor com `_markRef` retorna pelo ramo de marcação individual (linha
 * ~7468), antes de qualquer bloco de zona. A defesa ESPELHA o ataque — como os
 * atacantes não entram na área, os zagueiros também não, e a bola cai sem
 * ninguém. (Duas tentativas anteriores mexeram no bloco de zona e deram efeito
 * ZERO justamente porque aquele código não é alcançado nesta fase.)
 *
 * No futebol a defesa de cruzamento é zonal: os centrais largam o homem e
 * ocupam a área, porque é lá que a bola vai cair. Esta camada insere essa fase
 * ANTES do ramo de marcação, e só nela. Fora da fase o método é idêntico.
 *
 * Parâmetros expostos para varredura medida, não para adivinhação.
 * ==========================================================================*/
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const BASE_SHA = 'ddccf733e8803af282420f9ba095165e22f7eee0147a04af6a12d5cc12552653'; // R18.25

function arg(n, d) { const h = process.argv.slice(2).find(a => a.startsWith('--' + n + '=')); return h ? h.slice(n.length + 3) : d; }
const inFile = arg('in', 'rc5-entrega.html'), outFile = arg('out', 'rc9-zonal.html'), force = arg('force', '') === '1';

/* calibração */
const ALCANCE   = Number(arg('alcance', 44));   // m do gol em que a ameaça começa
const ESCALA    = Number(arg('escala', 26));    // m para a ameaça ir de 0 a 1
const LIMIAR    = Number(arg('limiar', 0.12));  // ameaça mínima para agir
const PROF_MIN  = Number(arg('profmin', 8));    // profundidade na ameaça máxima
const PROF_EXTRA= Number(arg('profextra', 7));  // acréscimo na ameaça mínima
const LARG      = Number(arg('larg', 10));      // meia-largura ocupada
const MID       = arg('mid', '1') === '1';      // meio também recua

let src = fs.readFileSync(inFile, 'utf8');
const sha = crypto.createHash('sha256').update(fs.readFileSync(inFile)).digest('hex');
if (sha !== BASE_SHA && !force) { console.error('ABORTA: sha da base não bate.'); process.exit(1); }

const applied = [];
function edit(id, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) { console.error('ABORTA [' + id + ']: âncora ' + n + 'x'); process.exit(1); }
  src = src.replace(from, to); applied.push(id);
}

edit('r1828-zonal',
`    if (p === presser) return [b.x, b.y];               // único presser vai à bola`,
`    if (p === presser) return [b.x, b.y];               // único presser vai à bola
    /* §R18.28 · DEFESA DE CRUZAMENTO É ZONAL. Com a bola aberta no terço final
       os zagueiros largam a marcação individual e ocupam a própria área — é lá
       que a bola cai. Sem isto a defesa espelha o ataque e a área fica deserta
       dos dois lados (0,25 defensor na grande área quando o cruzamento sai).
       Fora desta fase o método segue idêntico. */
    const _ab = Math.min(1, Math.abs(b.y - FW / 2) / Math.max(1, FW / 2 - 6));
    const _pf = clamp((${ALCANCE} - Math.abs(b.x - tm.goal.x)) / ${ESCALA}, 0, 1);
    const _ameaca = _ab * _pf;
    if (_ameaca > ${LIMIAR} && p !== presser && p !== tm._cover) {
      const _ln = C.LINE_OF[p.oopPos || p.slotPos];
      this.__zonalCenso=this.__zonalCenso||{elegivel:0,linha:{},slot:{},oop:{},temC:0};
      this.__zonalCenso.elegivel++;
      this.__zonalCenso.linha[String(_ln)]=(this.__zonalCenso.linha[String(_ln)]||0)+1;
      this.__zonalCenso.slot[String(p.slotPos)]=(this.__zonalCenso.slot[String(p.slotPos)]||0)+1;
      this.__zonalCenso.oop[String(p.oopPos)]=(this.__zonalCenso.oop[String(p.oopPos)]||0)+1;
      if(C&&C.LINE_OF)this.__zonalCenso.temC++;
      const _forte = Math.min(1, _ameaca * 2);
      if (_ln === 'DEF') {
        const _prof = ${PROF_MIN} + (1 - _forte) * ${PROF_EXTRA};
        const _lat = clamp(lerp(p.hy, FW / 2, .40), FW / 2 - ${LARG}, FW / 2 + ${LARG});
        return [clamp(tm.goal.x + dir * _prof, 1, FL - 1), clamp(_lat, 3, FW - 3)];
      }
      ${MID ? `if (_ln === 'MID') {
        const _prof = ${PROF_MIN} + 9 + (1 - _forte) * 6;
        const _lat = clamp(lerp(p.hy, FW / 2, .22), FW / 2 - 15, FW / 2 + 15);
        return [clamp(tm.goal.x + dir * _prof, 1, FL - 1), clamp(_lat, 3, FW - 3)];
      }` : ''}
    }`);

edit('r1828-id',
`  root.CDS_BUILD_ID='R18.25'; root.CDS_VERSION='5.19.0-R18.25';`,
`  root.CDS_R1828_ZONAL=Object.freeze({
    version:'R18.28', label:'DEFESA ZONAL DE CRUZAMENTO',
    calib:{alcance:${ALCANCE},escala:${ESCALA},limiar:${LIMIAR},profmin:${PROF_MIN},profextra:${PROF_EXTRA},larg:${LARG},mid:${MID}},
    note:'Com a bola aberta no terco final os zagueiros largam a marcacao individual e ocupam a area. A marcacao individual (linha ~7468) retornava antes de qualquer bloco de zona, entao a defesa espelhava o ataque e a area ficava deserta dos dois lados.'
  });
  root.CDS_BUILD_ID='R18.28'; root.CDS_VERSION='5.22.0-R18.28';`);

edit('r1828-title', `  if(root.document)root.document.title='Copa dos Sonhos — R18.25';`,
                    `  if(root.document)root.document.title='Copa dos Sonhos — R18.28';`);
edit('r1828-head', `<title>Copa dos Sonhos — R18.25</title>`, `<title>Copa dos Sonhos — R18.28</title>`);

fs.writeFileSync(outFile, src, 'utf8');
console.log(path.basename(outFile), '|', crypto.createHash('sha256').update(fs.readFileSync(outFile)).digest('hex').slice(0, 12),
            '| alcance', ALCANCE, 'escala', ESCALA, 'limiar', LIMIAR, 'profmin', PROF_MIN, 'profextra', PROF_EXTRA, 'larg', LARG, 'mid', MID);
