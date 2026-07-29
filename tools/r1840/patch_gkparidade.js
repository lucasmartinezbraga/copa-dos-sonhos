/* ============================================================================
 * R18.40 · O PLANEJADOR DO GOLEIRO PARA DE PROMETER O QUE O CORPO NAO ENTREGA
 * (gate CAU-04, dependencia declarada de OS-01)
 * ----------------------------------------------------------------------------
 * `_gkInterceptTarget` decide onde o goleiro consegue chegar usando:
 *
 *     const moveSpeed = 6.2 + quality * 2.8;      // 6,20 a 9,00 m/s
 *
 * e o corpo, na camada de movimento, usa `p.maxSpd`. Medido nos goleiros de
 * Brasil 1970: o plano promete **8,53 m/s** e o corpo entrega **6,05 m/s** —
 * 41% de otimismo. O planejador entao seleciona pontos de contato fisicamente
 * inalcancaveis, a camada R10 rebaseia a bola para esses pontos, e quando a
 * bola chega o goleiro nao esta la. E o residuo de OS-01: mesmo depois de o
 * goleiro passar a CAMINHAR para o ponto planejado (patch_goleiro.js), sobrou
 * 10,8% de gols por contato falho contra um alvo de 8%.
 *
 * A correcao e a paridade que o gate CAU-04 pede: o plano nao promete mais que
 * o corpo. `Math.min` do modelo antigo com o `maxSpd` real.
 *
 * CONSEQUENCIA ESPERADA, E ELA E DESEJADA. Com a promessa honesta, o conjunto
 * de pontos alcancaveis diminui e `_gkInterceptTarget` devolve `null` mais
 * vezes. Onde devolve null, `saveReachable` e falso, `saveCut` vira zero e o
 * chute segue para os ramos de bloqueio, trave, gol ou erro — ou seja, alguns
 * chutes que hoje entram na fatia de defesa passam a nao entrar. Isso EMPURRA
 * GOLS PARA CIMA, ao contrario do patch do goleiro. Os dois efeitos se somam na
 * direcao certa: menos gol por ausencia do corpo, mais gol por chute que o
 * goleiro de fato nao alcancava. A bateria pareada n=48 diz se o saldo cabe na
 * faixa ECO-01 (2,4 a 3,2).
 *
 * NAO se toca em `quality`, `reaction` nem no radius: so no teto de velocidade.
 * ==========================================================================*/
const fs = require('fs'), crypto = require('crypto'), path = require('path');
const a = (n, d) => { const h = process.argv.slice(2).find(x => x.startsWith('--' + n + '=')); return h ? h.slice(n.length + 3) : d; };
/* fator de arranque: 1.00 = paridade estrita com maxSpd, que e o que CAU-04
   pede. Fica parametrizado porque um mergulho real cobre chao mais rapido que
   uma corrida, e a rodada seguinte pode querer medir isso com mecanismo. */
const DIVE = Number(a('dive', 1.00));

let src = fs.readFileSync(a('in', 'sc.html'), 'utf8');
const applied = [];
function edit(id, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) { console.error('ABORTA [' + id + ']: ancora ' + n + 'x'); process.exit(1); }
  src = src.replace(from, to); applied.push(id);
}

edit('r1840-gk-paridade',
`    const moveSpeed=6.2+quality*2.8;`,
`    /* §R18.40 · gate CAU-04: o plano nao pode prometer mais que o corpo.
       Medido: o modelo antigo prometia 8,53 m/s para um goleiro cujo maxSpd e
       6,05 m/s. O planejador escolhia pontos inalcancaveis, a camada R10
       rebaseava a bola para eles e o contato falhava por ausencia. */
    const _gkTeto=Number.isFinite(gk.maxSpd)?gk.maxSpd*${DIVE}:7;
    const moveSpeed=Math.min(6.2+quality*2.8,_gkTeto);`);

fs.writeFileSync(a('out', 'gkp.html'), src, 'utf8');
console.log('patches:', applied.join(', '));
console.log(path.basename(a('out', 'gkp.html')), '| dive', DIVE, '|', crypto.createHash('sha256').update(fs.readFileSync(a('out', 'gkp.html'))).digest('hex').slice(0, 12));
