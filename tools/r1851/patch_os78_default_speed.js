/* ============================================================================
 * OS-78 · A PARTIDA COMECA EM 2x
 * ----------------------------------------------------------------------------
 * PROXIMA_RODADA.md item 6, observacao de campo:
 *   "Acho que pode ser um pouco mais rapido o jogo, pense em um tempo ideal."
 *
 * O documento apresenta tres caminhos e recomenda o (2), com a razao medida:
 *
 *   (1) Subir clockRate. "Barato, uma linha, e destroi a melhor calibracao que
 *       existe." Medido na OS-67: clockRate 0,13 -> 0,08125 leva gols de 1,81
 *       para 4,38 e passes de 451 para 758. E o botao mestre de VOLUME, nao de
 *       velocidade de tela.
 *   (2) Mudar a velocidade padrao de exibicao. "E a unica opcao com custo zero
 *       em realismo." O jogo ja tem 1x/2x/4x/TURBO.
 *   (3) Cortar tempo morto (11,1% dos quadros).
 *
 * Este patch e o (2), e so ele: `G.speed` nasce em 1.0 e passa a nascer em 2.0.
 * Nenhum numero do motor e tocado — o mesmo jogo, desenhado mais rapido.
 *
 * ------------------------------------------------------------------ CONTRATO
 *
 * HIPOTESE (direcao)
 *   A duracao real da partida CAI. Nenhum agregado do motor muda.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR
 *   1. bateria IDENTICA a da base — este parametro nao entra na simulacao;
 *   2. os controles 1x/2x/4x/TURBO continuam funcionando, e dá para voltar a 1x;
 *   3. a duracao real cai — o documento estima ~14 min para ~7 min, mas isso e
 *      ESTIMATIVA DELE, nao medicao minha. Nao repito o numero como se fosse meu.
 *
 * QUAL GATE DECIDE
 *   Igualdade exata dos agregados (custo zero em realismo).
 *   A duracao real so vale medida no NAVEGADOR: o documento e explicito —
 *   "Nao meca isso em Node. A duracao real depende do laco de render, nao da
 *   simulacao. Em Node voce mede segundos de simulacao, que e outra coisa."
 *   Por isso NAO afirmo aqui quanto a partida passou a durar.
 *
 * ARMADILHA
 *   Se `G.speed` for lido em algum lugar como indice de array (0..3) e nao como
 *   multiplicador, 2.0 quebraria a selecao. A base usa 1.0 (float), o que indica
 *   multiplicador — mas a conferencia e no navegador, vendo o rotulo do controle
 *   de velocidade marcar 2x ao entrar na partida.
 *
 *   E ha um conflito de fila que precisa ficar dito: o item 1 (falta atras)
 *   ADICIONA cerimonia e estende `dead`, empurrando a duracao para cima. Os
 *   dois itens da mesma fila puxam em direcoes opostas.
 * ==========================================================================*/
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const arg = (n, d) => { const h = process.argv.slice(2).find(x => x.startsWith('--' + n + '=')); return h ? h.slice(n.length + 3) : d; };
const VEL = arg('vel', '2.0');

let src = fs.readFileSync(arg('in'), 'utf8');
const aplicados = [];
function edit(id, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) { console.error('ABORTA [' + id + ']: ancora ' + n + 'x'); process.exit(1); }
  src = src.replace(from, to); aplicados.push(id);
}

edit('os78-velocidade-padrao',
`  cup: null,
  speed: 1.0,`,
`  cup: null,
  /* §OS-78 · a partida comeca em 2x (item 6 da fila). O documento mediu que
     clockRate e botao de VOLUME, nao de velocidade de tela: mexer nele leva
     gols de 1,81 para 4,38. A velocidade de exibicao e a unica alavanca de
     tempo com custo zero em realismo — o mesmo jogo, desenhado mais rapido.
     Os controles 1x/2x/4x/TURBO continuam la para voltar. */
  speed: ${VEL},`);

const saida = arg('out');
fs.writeFileSync(saida, src, 'utf8');
console.log('patches:', aplicados.join(', '));
console.log(path.basename(saida), '| speed', VEL, '|', crypto.createHash('sha256').update(fs.readFileSync(saida)).digest('hex').slice(0, 12));
