#!/usr/bin/env node
'use strict';
/*
 * OS-62 · OS ROTULOS PARAM DE SE ATROPELAR
 * -----------------------------------------
 * Achado na captura: com a camera fechada da OS-57 os chips de sobrenome
 * aparecem em varios atletas ao mesmo tempo e se sobrepoem —
 * "CARRASCO"/"INCE" um por cima do outro, "TIELEMANS"/"MCMANAMAN" ilegiveis,
 * "CAMPBELL" cobrindo o numero do companheiro.
 *
 * MECANISMO (:13829). O chip e desenhado num deslocamento FIXO abaixo do
 * atleta:
 *
 *     const py2 = y + r + 2;
 *
 * Nao ha nenhuma nocao de que outro chip ja ocupa aquele espaco. O clamp
 * existente so impede sair pela lateral do canvas. Como o gatilho e "esta perto
 * da bola", os chips aparecem exatamente onde os jogadores estao mais juntos —
 * o pior caso possivel.
 *
 * EDIT · uma lista de retangulos ocupados por quadro. Cada chip tenta o lugar
 * de sempre; se colidir, desce em degraus de ${'${DEGRAU}'} px ate ${'${TENTATIVAS}'}
 * vezes, e se ainda assim nao couber, e OMITIDO — melhor um nome a menos do que
 * dois nomes ilegiveis um sobre o outro.
 *
 * A lista e zerada quando o quadro recomeca, detectado pela virada do contador
 * de atletas desenhados.
 *
 * PREVISAO: numeros do motor IDENTICOS. O gate e a captura: nenhum par de chips
 * sobreposto.
 */
const fs=require('fs'),crypto=require('crypto'),path=require('path');
const arg=(n,d)=>{const h=process.argv.slice(2).find(x=>x.startsWith('--'+n+'='));return h?h.slice(n.length+3):d;};
const input=arg('in','dist/COPA DOS SONHOS - R18.80 - JOGO DE FUTEBOL.html');
const output=arg('out','dist/COPA DOS SONHOS - R18.81 - JOGO DE FUTEBOL.html');
const DEGRAU=arg('degrau','12'), TENTATIVAS=arg('tentativas','3');
let src=fs.readFileSync(input,'utf8');
const applied=[];
function edit(id,from,to){
  const c=src.split(from).length-1;
  if(c!==1){console.error('ABORTA ['+id+']: ancora '+c+'x');process.exit(1);}
  src=src.replace(from,to);applied.push(id);
}

edit('os62-decollide',
`      const nm = lastWord(p.n, 9);
      ctx.font = \`bold 7.5px Arial,sans-serif\`;
      const tw = ctx.measureText(nm).width;
      const pw = tw + 8, ph2 = 11, py2 = y + r + 2, pxc = Math.max(M + pw/2 + 2, Math.min(CW - M - pw/2 - 2, x));
      ctx.fillStyle = 'rgba(4,8,18,.78)';
      ctx.beginPath();
      ctx.roundRect(pxc - pw/2, py2, pw, ph2, 6);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(nm, pxc, py2 + ph2/2 + 0.5);`,
`      /* OS-62 · o chip usava deslocamento FIXO (y + r + 2) sem nenhuma nocao de
         que outro ja ocupava o lugar. E o gatilho e "perto da bola", ou seja,
         exatamente onde os atletas estao mais juntos. Agora ha lista de
         ocupacao: desce em degraus e, se nao couber, omite — melhor um nome a
         menos do que dois ilegiveis. */
      const nm = lastWord(p.n, 9);
      ctx.font = \`bold 7.5px Arial,sans-serif\`;
      const tw = ctx.measureText(nm).width;
      const pw = tw + 8, ph2 = 11, pxc = Math.max(M + pw/2 + 2, Math.min(CW - M - pw/2 - 2, x));
      if (!window.__cdsChips || window.__cdsChips.n !== _cdsChipFrame) {
        window.__cdsChips = { n: _cdsChipFrame, r: [] };
      }
      const _oc = window.__cdsChips.r;
      const _bate = (ax, ay) => _oc.some(q =>
        Math.abs(ax - q.x) < (pw + q.w) / 2 - 1 && Math.abs(ay - q.y) < (ph2 + q.h) / 2 - 1);
      let py2 = y + r + 2, _ok = !_bate(pxc, py2 + ph2 / 2);
      for (let _t = 0; !_ok && _t < ${TENTATIVAS}; _t++) {
        py2 += ${DEGRAU};
        _ok = !_bate(pxc, py2 + ph2 / 2);
      }
      if (_ok) {
        _oc.push({ x: pxc, y: py2 + ph2 / 2, w: pw, h: ph2 });
        ctx.fillStyle = 'rgba(4,8,18,.78)';
        ctx.beginPath();
        ctx.roundRect(pxc - pw/2, py2, pw, ph2, 6);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillText(nm, pxc, py2 + ph2/2 + 0.5);
      }`);

/* contador de quadro para zerar a lista de ocupacao ------------------------- */
edit('os62-frame-counter',
`const CW=1024, CH=500, M=14;`,
`let _cdsChipFrame = 0; /* OS-62 · vira a cada quadro para zerar a ocupacao dos chips */
const CW=1024, CH=500, M=14;`);

edit('os62-frame-tick',
`  /* trajetória: passe tracejado amarelo / chute linha branca */
  const bT = st.ball;`,
`  _cdsChipFrame++;   /* OS-62 · fecha o quadro de chips */
  /* trajetória: passe tracejado amarelo / chute linha branca */
  const bT = st.ball;`);

fs.writeFileSync(output,src,'utf8');
console.log('patches:',applied.join(', '),'| degrau='+DEGRAU,'tentativas='+TENTATIVAS);
console.log(path.basename(output),'| sha256',crypto.createHash('sha256').update(src).digest('hex'));
