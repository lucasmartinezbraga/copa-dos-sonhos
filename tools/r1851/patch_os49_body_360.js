#!/usr/bin/env node
'use strict';
/*
 * OS-49 · O CORPO PASSA A TER 360 GRAUS
 * --------------------------------------
 * Observacao de campo: "nem o jogador consegue conduzir a bola em 360 graus de
 * angulo igual FIFA".
 *
 * A CONDUCAO em si ja e 360 (6 partidas, 61.485 quadros de conducao):
 *
 *     frente (0-30)             43,4%
 *     diagonal (30-60)          20,4%
 *     lateral (60-120)          16,3%
 *     diagonal para tras        8,1%
 *     para tras (150-180)      11,9%
 *
 * Mais de um terço da conducao ja e lateral ou para tras. O que NAO gira e o
 * CORPO. Em `CDS_F25D.body` (:19533):
 *
 *     if (Math.abs(mvx) > 0.4) d.face = Math.sign(mvx);
 *
 * `face` so vale +1 ou -1, e so e atualizado quando ha deslocamento LATERAL de
 * tela. Quem corre para cima ou para baixo do campo mantem a orientacao antiga:
 * o atleta desce o gramado encarando o lado. Sao duas direcoes, nao 360.
 *
 * E `lean`, calculado logo acima com suavizacao, so desloca a CABECA (`hx`, na
 * linha 122 da funcao). O tronco nunca se inclina para onde corre.
 *
 * EDITS
 *
 * 1) FACE PELO VETOR INTEIRO. `d.ang` passa a guardar o angulo de deslocamento
 *    suavizado, e `face` sai de `cos(ang)`, com limiar baixo. Correndo na
 *    vertical, o atleta mantem o ultimo lado coerente em vez de congelar num
 *    lado arbitrario.
 *
 * 2) O TRONCO INCLINA PARA ONDE CORRE. Rotacao proporcional a componente
 *    lateral e a velocidade: `rotate(cos(ang) * amp * ${'${INCL}'})`. Corrida
 *    lateral inclina; corrida vertical fica em pe, que e o correto visto de
 *    cima.
 *
 * 3) PERSPECTIVA VERTICAL. Correndo para cima ou para baixo o atleta e visto
 *    mais de frente/costas: o corpo ESTREITA um pouco
 *    (`scale(1 - |sin(ang)| * ${'${ESTR}'}, 1)`) e a passada ganha um balanco
 *    vertical proprio. Sem isso a corrida vertical fica identica a lateral.
 *
 * Nao ha desenho novo nem estado novo — e a mesma figura, orientada. E camada
 * de APRESENTACAO pura: nao toca em posicao, decisao, fisica ou RNG.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR:
 *   - os numeros do motor tem de ficar IDENTICOS. Se mudarem, vazou.
 *   - o salto por quadro nao pode mudar: nada de posicao e escrito.
 *
 * ARMADILHA: rotacionar o corpo tambem gira a SOMBRA se o `ctx.save()` estiver
 * no lugar errado. A sombra e desenhada antes, fora deste bloco, entao fica no
 * gramado — mas se alguem mover o bloco, o defeito aparece.
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find(x => x.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const input = arg('in', 'dist/COPA DOS SONHOS - R18.73 - JOGO DE FUTEBOL.html');
const output = arg('out', 'dist/COPA DOS SONHOS - R18.74 - JOGO DE FUTEBOL.html');
const INCL = arg('inclinacao', '0.20');
const ESTR = arg('estreita', '0.22');
let src = fs.readFileSync(input, 'utf8');
const applied = [];

function edit(id, from, to) {
  const count = src.split(from).length - 1;
  if (count !== 1) {
    console.error('ABORTA [' + id + ']: ancora ' + count + 'x');
    process.exit(1);
  }
  src = src.replace(from, to);
  applied.push(id);
}

/* 1 ── angulo de deslocamento e face pelo vetor inteiro --------------------- */
edit(
  'os49-facing-vector',
  `    if (Math.abs(mvx) > 0.4) d.face = Math.sign(mvx);  // direção que o atleta encara (persistida)`,
  `    /* OS-49 · antes, \`face\` so mudava com deslocamento LATERAL maior que
       0,4 px, entao quem corria para cima ou para baixo do campo mantinha a
       orientacao antiga e descia o gramado encarando o lado. Agora a direcao
       sai do VETOR inteiro, com angulo suavizado. */
    if (mv > 0.08) {
      const _a = Math.atan2(mvy, mvx);
      if (d.ang == null) d.ang = _a;
      else {
        let _dd = _a - d.ang;
        while (_dd > Math.PI) _dd -= Math.PI * 2;
        while (_dd < -Math.PI) _dd += Math.PI * 2;
        d.ang += _dd * .35;
      }
      const _c = Math.cos(d.ang);
      if (Math.abs(_c) > .12) d.face = _c >= 0 ? 1 : -1;
    }`
);

/* 2 e 3 ── inclinacao e perspectiva vertical -------------------------------- */
edit(
  'os49-body-tilt',
  `    ctx.save();
    ctx.translate(x, y - bob - (spinning ? r * .16 * Math.sin(spinTh / 2) : 0));
    if (o.divePose) ctx.rotate(Math.PI / 2);
    else if (spinning) {`,
  `    /* OS-49 · o tronco passa a inclinar para onde corre, e a corrida vertical
       ganha perspectiva: visto mais de frente/costas, o corpo estreita. Sem
       isto, correr para cima e correr para o lado sao o mesmo desenho. */
    const _oa = (d.ang == null) ? 0 : d.ang;
    const _cos = Math.cos(_oa), _sin = Math.sin(_oa);
    const _vig = (o.divePose || spinning) ? 0 : Math.max(0, Math.min(1, d.spd / 1.5));
    ctx.save();
    ctx.translate(x, y - bob - (spinning ? r * .16 * Math.sin(spinTh / 2) : 0));
    if (!o.divePose && !spinning && _vig > .02) {
      ctx.rotate(_cos * _vig * ${INCL});
      const _sq = 1 - Math.abs(_sin) * _vig * ${ESTR};
      ctx.scale(_sq < .5 ? .5 : _sq, 1);
    }
    if (o.divePose) ctx.rotate(Math.PI / 2);
    else if (spinning) {`
);

fs.writeFileSync(output, src, 'utf8');
const sha = crypto.createHash('sha256').update(src).digest('hex');
console.log('patches:', applied.join(', '), '| inclinacao=' + INCL, 'estreita=' + ESTR);
console.log(path.basename(output), '| sha256', sha);
