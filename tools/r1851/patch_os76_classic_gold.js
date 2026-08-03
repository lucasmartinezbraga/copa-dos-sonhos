/* ============================================================================
 * OS-76 · CRAQUE DEIXA DE SER DOURADO NO MODO QUE ESCONDE O OVERALL
 * ----------------------------------------------------------------------------
 * PROXIMA_RODADA.md item 4, observacao de campo:
 *   "Gostaria que o craque nao fosse dourado no modo que nao mostra o overall."
 *
 * MECANISMO — em `paintList()`, na montagem da linha do draft:
 *
 *     const hideOvr = (G.modo === 'classico') && !benchPhase;
 *     ...
 *     const isLegend = p.r >= 92;
 *     const cls = 'row' + ... + (isLegend ? ' legend-row' : '');
 *
 * A estrela do nome JA respeita o modo (`G.modo !== 'classico' ? ...`), e o
 * numero ja e trocado por '?' (`hideOvr ? '?' : p.r`). O que vaza e a CLASSE
 * `legend-row`, aplicada so por rating: o fundo dourado entrega que aquele
 * jogador tem nota alta, no modo cuja premissa e esconder a nota.
 *
 * CORRECAO DE UM PONTO DO DOCUMENTO
 * Ele diz "nos tres pontos onde a linha e montada". Medido nesta build:
 * `legend-row` aparece 3 vezes, mas DUAS sao a definicao no CSS
 * (`.row.legend-row` e `.row.legend-row .nm`). O ponto de APLICACAO e um so, e
 * `hideOvr` ja esta no escopo dele, tres linhas acima. A correcao e uma
 * condicao, nao tres.
 *
 * O documento tambem manda "nao mexa no CSS" — e este patch nao mexe.
 *
 * ------------------------------------------------------------------ CONTRATO
 *
 * HIPOTESE (direcao)
 *   No modo classico, antes da fase de banco, a linha do craque deixa de ter
 *   fundo dourado. Fora do classico nada muda. Nenhum numero do motor muda.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR
 *   1. bateria IDENTICA a da R18.83, valor por valor;
 *   2. no modo NAO-classico a classe continua sendo aplicada (o patch nao pode
 *      apagar o destaque onde ele e legitimo);
 *   3. na fase de banco do classico (`benchPhase`), em que o overall volta a
 *      aparecer, o dourado tambem volta — porque `hideOvr` ja e falso ali.
 *
 * QUAL GATE DECIDE
 *   Igualdade exata dos agregados. E conferencia visual no navegador, em modo
 *   classico, com elenco que tenha lenda.
 *
 * ARMADILHA, do proprio documento
 *   "Existem outros pontos dourados fora da linha (chip `.legend-chip`,
 *   `.gold`, `--ouro`). Confira no navegador em modo classico... Um grep nao
 *   basta — foi assim que a listra de camisa passou."
 *   Este patch fecha a LINHA do draft. Se sobrar dourado em outro lugar do
 *   classico, e outro sitio e nao esta resolvido por aqui.
 * ==========================================================================*/
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const arg = (n, d) => { const h = process.argv.slice(2).find(x => x.startsWith('--' + n + '=')); return h ? h.slice(n.length + 3) : d; };

let src = fs.readFileSync(arg('in'), 'utf8');
const aplicados = [];
function edit(id, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) { console.error('ABORTA [' + id + ']: ancora ' + n + 'x'); process.exit(1); }
  src = src.replace(from, to); aplicados.push(id);
}

edit('os76-dourado-no-classico',
`(isLegend ? ' legend-row' : '')`,
`(isLegend && !hideOvr ? ' legend-row' : '')`);

const saida = arg('out');
fs.writeFileSync(saida, src, 'utf8');
console.log('patches:', aplicados.join(', '));
console.log(path.basename(saida), '|', crypto.createHash('sha256').update(fs.readFileSync(saida)).digest('hex').slice(0, 12));
