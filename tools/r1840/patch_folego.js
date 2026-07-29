/* ============================================================================
 * R18.40 · O PLANO "PRESERVAR ENERGIA" SAI DO CODIGO MORTO  (OS-09)
 * ----------------------------------------------------------------------------
 * `_adaptivePlan` so escolhe 'save_energy' quando a media de estamina do time
 * cai abaixo de 62. Medido nesta build, n=30 partidas:
 *
 *     decisoes taticas ................... 2 908
 *     save_energy escolhido .............. 1  (0,03%)
 *     estamina media do time, minimo ..... 61,8
 *     estamina media do time, p10 ........ 71,0
 *     apos 85' ........................... p10 65,8 · mediana 69,2
 *
 * O piso do jogo encosta em 62 uma vez em trinta partidas. Nao e um plano
 * "raro": e aritmetica — o gatilho foi posto abaixo do minimo que o motor
 * produz. A Ordem de Servico ofereceu duas saidas (subir o gatilho ou aumentar
 * o desgaste) e recomendou a primeira, porque a estamina hoje passa limpa na
 * auditoria (100 -> 73, queda continua) e nao deve ser mexida.
 *
 * Gatilho 62 -> 70. Com p10 = 71, isso poe a decisao ao alcance do jogo sem
 * torna-la comum — e as ramificacoes de placar (all_out, chase, close_game,
 * protect_lead) continuam ANTES dela na cascata, entao a urgencia do resultado
 * segue tendo prioridade sobre o folego, que e o comportamento correto.
 *
 * O limitador geral de fadiga (stamina < 66, algumas linhas abaixo) fica como
 * esta de proposito: ele altera pressao e ritmo de TODOS os planos e mexer nele
 * junto misturaria dois efeitos na mesma bateria.
 * ==========================================================================*/
const fs = require('fs'), crypto = require('crypto'), path = require('path');
const a = (n, d) => { const h = process.argv.slice(2).find(x => x.startsWith('--' + n + '=')); return h ? h.slice(n.length + 3) : d; };
const GATILHO = Number(a('gatilho', 70));

let src = fs.readFileSync(a('in', 'r1840v.html'), 'utf8');
const applied = [];
function edit(id, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) { console.error('ABORTA [' + id + ']: ancora ' + n + 'x'); process.exit(1); }
  src = src.replace(from, to); applied.push(id);
}

edit('r1840-folego',
`} else if (stamina < 62) {`,
`} else if (stamina < ${GATILHO}) {
      /* §R18.40 · Era 62. O piso de estamina media do time medido em 30
         partidas e 61,8 — o gatilho estava abaixo do minimo que o motor
         produz, e o plano foi escolhido 1 vez em 2 908 decisoes (0,03%).
         Com p10 = 71,0 este gatilho poe a decisao ao alcance do jogo sem
         torna-la comum. As rotas de placar continuam antes desta na cascata. */`);

const ID = `  root.CDS_BUILD_ID='R18.40'; root.CDS_VERSION='5.30.0-R18.40';`;
if (src.split(ID).length - 1 === 1) {
  src = src.replace(ID, `  root.CDS_R1840_FOLEGO=Object.freeze({version:'R18.40',label:'PRESERVAR ENERGIA SAI DO CODIGO MORTO',gatilho:${GATILHO},
    note:'save_energy exigia estamina media abaixo de 62 e o piso do jogo e 61,8: 1 escolha em 2908 decisoes. Gatilho para 70, com p10 de estamina em 71,0. A velocidade derivada tambem passou a saturar no teto do jogador — a folga aditiva do clamp de passo (+0,12 e +0,20) virava 11,9 e 15,0 m/s na divisao por dt, com maxima observada de 18,28.'});
  root.CDS_BUILD_ID='R18.40'; root.CDS_VERSION='5.30.0-R18.40';`);
}

fs.writeFileSync(a('out', 'r1840f.html'), src, 'utf8');
console.log('patches:', applied.join(', '));
console.log(path.basename(a('out', 'r1840f.html')), '| gatilho', GATILHO, '|', crypto.createHash('sha256').update(fs.readFileSync(a('out', 'r1840f.html'))).digest('hex').slice(0, 12));
