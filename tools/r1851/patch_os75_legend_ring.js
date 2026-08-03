/* ============================================================================
 * OS-75 · O ANEL DOURADO DE LENDA SAI DO GRAMADO
 * ----------------------------------------------------------------------------
 * PROXIMA_RODADA.md item 3, observacao de campo:
 *   "que o circulo de craque do Messi fosse tirado"
 *
 * MECANISMO — bloco de desenho do jogador, na R18.83:
 *
 *     // aura de LENDA: anel dourado pulsante (r>=92)
 *     const isLegend = p.ref && p.ref.legend;
 *     if (isLegend) { ... ctx.arc(x, y, r + 3.5 + pulse*0.4, ...); ctx.stroke(); }
 *
 * O anel e desenhado sempre que o jogador e lenda, em qualquer estado.
 *
 * O QUE ENTRA, E POR QUE NAO E UM SUBSTITUTO INVENTADO
 * O documento avisa: "Tirar o anel remove o unico marcador visual de quem e
 * lenda no gramado... o caminho barato e o _onFire continuar marcado e a lenda
 * em estado normal ficar limpa. Pergunte antes de inventar um substituto."
 *
 * E exatamente o que este patch faz, e nada alem: a condicao passa de
 * `isLegend` para `isLegend && p._onFire`. Nenhum desenho novo, nenhuma cor
 * nova, nenhuma forma nova. O anel permanente — que e o que incomodou — some;
 * o anel de "em chamas", que ja existia e e estado temporario de forma, fica.
 *
 * Se o dono quiser o gramado 100% limpo, basta trocar a condicao por `false`:
 * o patch e parametrizado (--onfire=0).
 *
 * ------------------------------------------------------------------ CONTRATO
 *
 * HIPOTESE (direcao)
 *   O anel deixa de aparecer para lenda em estado normal. Nenhum numero do
 *   motor muda.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR
 *   1. a bateria fica IDENTICA a da R18.83 — mesmo sha de agregados, valor por
 *      valor. Se qualquer numero mudar, o patch vazou para a simulacao.
 *   2. `p._onFire` continua sendo lido, entao lenda em chamas ainda tem anel.
 *
 * QUAL GATE DECIDE
 *   Igualdade exata dos agregados contra a base. Patch de apresentacao pura:
 *   o HANDOFF §6 diz que o teste e "os numeros do motor ficam identicos".
 *
 * ARMADILHA
 *   `performance.now()` aparece no bloco. Em Node ele e stubado e a bateria nao
 *   desenha, entao a igualdade de agregados NAO prova que o desenho esta certo
 *   — prova so que nao vazou. A conferencia visual e no navegador, e o §9 do
 *   HANDOFF avisa para olhar no TAMANHO REAL de jogo, nao em canvas isolado.
 * ==========================================================================*/
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const arg = (n, d) => { const h = process.argv.slice(2).find(x => x.startsWith('--' + n + '=')); return h ? h.slice(n.length + 3) : d; };
const MANTEM_ONFIRE = arg('onfire', '1') !== '0';

let src = fs.readFileSync(arg('in'), 'utf8');
const aplicados = [];
function edit(id, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) { console.error('ABORTA [' + id + ']: ancora ' + n + 'x'); process.exit(1); }
  src = src.replace(from, to); aplicados.push(id);
}

const condicao = MANTEM_ONFIRE ? 'isLegend && p._onFire' : 'false';

edit('os75-anel-de-lenda',
`      const isLegend = p.ref && p.ref.legend;
      if (isLegend) {`,
`      const isLegend = p.ref && p.ref.legend;
      /* §OS-75 · o anel permanente de lenda sai do gramado (item 3 da fila).
         Era desenhado para toda lenda, em qualquer estado. Fica so o anel de
         "em chamas", que ja existia aqui e e estado temporario de forma — nao
         e substituto inventado, e o que o proprio documento sugeriu manter. */
      if (${condicao}) {`);

const saida = arg('out');
fs.writeFileSync(saida, src, 'utf8');
console.log('patches:', aplicados.join(', '));
console.log(path.basename(saida), '| mantem onFire:', MANTEM_ONFIRE, '|', crypto.createHash('sha256').update(fs.readFileSync(saida)).digest('hex').slice(0, 12));
