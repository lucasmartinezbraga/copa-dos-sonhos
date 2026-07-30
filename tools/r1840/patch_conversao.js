/* ============================================================================
 * R18.40B · CONVERSAO RECALIBRADA SOBRE O XI CORRETO
 * ----------------------------------------------------------------------------
 * A candidata (c) — vel + goleiro + escalacao + raio — resolve o deficit de
 * chutes (15,604 contra piso 12, nas tres bases) e poe CAU-03 em 1,51%, mas
 * estoura dois tetos: gols 3,375 (teto 3,2) e xG 2,980 (teto 2,7).
 *
 * DE ONDE VEM O EXCESSO, decomposto:
 *   volume ............. 11,854 -> 15,604 chutes (+31,6%)
 *                        sozinho levaria xG de 2,059 a 2,71
 *   qualidade/chute .... 0,1737 -> 0,1910 (+10%)
 *                        leva a 2,98
 * Ou seja, o xG sobe principalmente porque ha MAIS chute — que e precisamente o
 * que ECO-03 cobra. Reduzir `distanceXg` para baixar o xG seria falsificar a
 * qualidade da chance: a tabela diz o que vale um chute de 6 m contra um de
 * 22 m, e isso nao mudou.
 *
 * O UNICO LEVER LEGITIMO e a conversao. Note que `gols/xG` caiu de 1,285 na
 * baseline para 1,133 aqui: a baseline convertia 28,5% ACIMA do proprio modelo
 * de xG, que e a assinatura do vazamento do goleiro entregando gol de graca.
 * Fechar o vazamento ja tornou o modelo mais coerente; `conversionScale` acerta
 * o nivel que restou.
 *
 * Alvo: gols de 3,375 para dentro de 2,4-3,2, sem mexer em volume nem em
 * qualidade de chance. Reducao necessaria ~5,5%.
 * ==========================================================================*/
const fs = require('fs'), crypto = require('crypto'), path = require('path');
const a = (n, d) => { const h = process.argv.slice(2).find(x => x.startsWith('--' + n + '=')); return h ? h.slice(n.length + 3) : d; };
const ESCALA = a('escala', '2.12');

let src = fs.readFileSync(a('in', 'b2.html'), 'utf8');
const applied = [];
function edit(id, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) { console.error('ABORTA [' + id + ']: ancora ' + n + 'x'); process.exit(1); }
  src = src.replace(from, to); applied.push(id);
}

edit('r1840b-conversao',
`    conversionScale: 2.25,`,
`    /* §R18.40B · era 2.25. Recalibrado sobre o XI correto: com a escalacao por
       elegibilidade o volume de chutes sobe 31,6% e os gols passavam de 3,375
       contra teto de 3,2. Mexe SO na conversao — distanceXg (qualidade da
       chance) fica intacta, porque o que vale um chute de 6 m contra um de 22 m
       nao mudou. */
    conversionScale: ${ESCALA},`);

fs.writeFileSync(a('out', 'b3.html'), src, 'utf8');
console.log('patches:', applied.join(', '));
console.log(path.basename(a('out', 'b3.html')), '| conversionScale', ESCALA, '|', crypto.createHash('sha256').update(fs.readFileSync(a('out', 'b3.html'))).digest('hex').slice(0, 12));
