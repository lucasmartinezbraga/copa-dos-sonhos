/* ============================================================================
 * OS-74 · O LADO DO ESCANTEIO PASSA A SEGUIR A BOLA
 * ----------------------------------------------------------------------------
 * PROXIMA_RODADA.md, item 2, observacao de campo do dono do projeto:
 *   "Precisa validar o lado do escanteio, se sair pra um lado ou outro."
 *
 * MECANISMO — dist/COPA DOS SONHOS - R18.83, no corpo base de `_setCorner`:
 *
 *     const cy = chance(.5) ? 1.5 : FW-1.5, sign=cy<FW/2?-1:1;
 *
 * O canto e sorteado. A informacao de por onde a bola saiu existe em
 * `this.ball.y` no instante da chamada e simplesmente nao e consultada.
 *
 * MEDIDO ANTES DE PATCHAR (tools/r1851/diag_os74_corner_side.js, 8 partidas,
 * build 5897f3af409f):
 *     escanteios legiveis ................ 54
 *     lado do canto == lado da saida ..... 20  (37,0%)
 * Compativel com cara-ou-coroa (z ~ -1,9 contra 50%). O sorteio e real.
 *
 * ACHADO SECUNDARIO, NAO TRATADO AQUI: das 87 chamadas de `_setCorner`, 33 nao
 * levam a bola a canto nenhum — ela fica a 12-20 m da linha, no meio do campo.
 * Sao escanteios cunhados com a bola em jogo. E outro defeito, de outra ficha.
 *
 * ------------------------------------------------------------------ CONTRATO
 *
 * HIPOTESE (direcao, nao porcentagem)
 *   A concordancia entre o lado da saida e o lado do canto SOBE.
 *   Nenhum agregado de futebol muda de forma sistematica: o patch nao cria nem
 *   destroi escanteio, so escolhe de que canto ele sai.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR
 *   1. concordancia sobe de 37,0% para perto de 100% no grupo legivel;
 *   2. o numero de escanteios por partida NAO muda;
 *   3. gols, xG, chutes e chutes no alvo ficam dentro da banda de ruido;
 *   4. os 33 casos em que a bola nao vai ao canto CONTINUAM existindo — este
 *      patch nao os toca, e se eles sumirem eu mexi em algo que nao queria.
 *
 * QUAL GATE DECIDE
 *   Primario: a taxa de concordancia do proprio diag_os74 (alvo: > 90%).
 *   Nao pode regredir: ECO-05 escanteios entre 4 e 10, ECO-02 xG <= 2,7, e os
 *   demais agregados dentro da banda.
 *
 * ARMADILHA, E ELA MOLDOU O PATCH
 *   Trocar `chance(.5) ? ... : ...` por uma leitura de `ball.y` REMOVERIA uma
 *   extracao do gerador seedado. O HANDOFF §6 avisa: mudar o caminho de consumo
 *   de RNG faz duas configuracoes divergirem por CAOS, nao por efeito, e a
 *   bateria pareada perde o sentido. Por isso o `chance(.5)` continua sendo
 *   CHAMADO e o resultado dele e descartado. O fluxo do gerador fica identico
 *   ao da base, e qualquer diferenca na bateria e efeito de verdade.
 *
 *   Segunda armadilha, do proprio documento: quando a bola ja foi recolocada
 *   antes de `_setCorner` rodar, `ball.y` pode ser o centro do campo. Nesse
 *   caso o sorteio e mantido — nao ha informacao de lado para usar, e inventar
 *   uma seria pior que sortear. O limiar e |y - FW/2| > 4 m.
 * ==========================================================================*/
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const arg = (n, d) => { const h = process.argv.slice(2).find(x => x.startsWith('--' + n + '=')); return h ? h.slice(n.length + 3) : d; };
const MARGEM = Number(arg('margem', 4));

let src = fs.readFileSync(arg('in'), 'utf8');
const aplicados = [];
function edit(id, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) { console.error('ABORTA [' + id + ']: ancora ' + n + 'x'); process.exit(1); }
  src = src.replace(from, to); aplicados.push(id);
}

edit('os74-lado-do-escanteio',
`const cy = chance(.5) ? 1.5 : FW-1.5, sign=cy<FW/2?-1:1;`,
`/* §OS-74 · o lado do escanteio passa a seguir por onde a bola saiu.
     Medido antes: 37,0% de concordancia em 54 escanteios legiveis, compativel
     com cara-ou-coroa. A informacao ja estava em this.ball.y e nao era lida.
     O chance(.5) continua sendo CHAMADO de proposito, e o resultado dele so e
     usado quando nao ha lado confiavel: assim o consumo do gerador seedado fica
     identico ao da base e a bateria pareada mede efeito, nao caos (HANDOFF §6).
     Quando a bola ja foi recolocada ao centro antes desta chamada nao existe
     lado para ler, e ai o sorteio decide — inventar um seria pior. */
  const _os74Sorteio = chance(.5);
  const _os74Y = (this.ball && Number.isFinite(this.ball.y)) ? this.ball.y : null;
  const _os74TemLado = _os74Y !== null && Math.abs(_os74Y - FW / 2) > ${MARGEM};
  const cy = _os74TemLado ? (_os74Y < FW / 2 ? 1.5 : FW - 1.5) : (_os74Sorteio ? 1.5 : FW - 1.5), sign=cy<FW/2?-1:1;`);

const saida = arg('out');
fs.writeFileSync(saida, src, 'utf8');
console.log('patches:', aplicados.join(', '));
console.log(path.basename(saida), '| margem', MARGEM, '|', crypto.createHash('sha256').update(fs.readFileSync(saida)).digest('hex').slice(0, 12));
