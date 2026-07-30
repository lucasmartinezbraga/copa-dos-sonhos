#!/usr/bin/env node
'use strict';
/* ============================================================================
 * R18.49 · O CONE DA CONDUCAO — "esta no meu caminho" em vez de "esta na frente"
 * ----------------------------------------------------------------------------
 * DE ONDE VEM. A R18.48 diagnosticou OS-08 e mediu: conducao e 1,182% das acoes
 * (bate exatamente com o 1,18% da matriz) e cada conducao percorre 2,301 m contra
 * um alvo de 8 a 11,6 m. A tentativa de consertar por JANELA DE COMPROMISSO
 * falhou, e falhou por defeito MEU: a camada retornava de `_decide` sem chamar a
 * cadeia, o ganho de 2,3 -> 6,7 m era artefato do bypass, e `COE-01` pegou
 * (gols/xG 1,010 -> 1,289). Rodando a cadeia inteira, o ganho vira +21% e a
 * coerencia volta. A licao registrada foi: para conduzir mais e preciso mudar a
 * DECISAO, nao contorna-la. Esta rodada ataca a decisao.
 *
 * O SITIO, no dispatch de `_decide` (base; a cadeia do r122 delega ao final):
 *
 *   let cone = 0; for (const d of opps) if (this._inForwardCone(o, d, g, inAtt ? 4.5 : 5.5, 9)) cone++;
 *   if (cone === 0 && dtg > 6) { this._carry(o, g); return; }
 *
 * E o predicado:
 *
 *   _inForwardCone(o, d, g, radius, len) {
 *     const dirx = Math.sign(g.x - o.x);
 *     const fx = (d.x - o.x) * dirx;
 *     return fx > 0 && fx < len && Math.abs(d.y - o.y) < radius;
 *   }
 *
 * DOIS DEFEITOS, e o nome do metodo esconde o primeiro.
 *
 * 1. NAO E UM CONE, E UM RETANGULO. `fx < len && |dy| < radius` descreve uma
 *    caixa de 9 m de profundidade por 9 a 11 m de largura a frente do portador.
 *    Um defensor a 8 m adiante e 4 m ao lado esta DENTRO dela e nao esta no
 *    caminho de ninguem. Um cone de verdade abre com a distancia: perto do
 *    portador o corredor e estreito, longe ele e largo — o inverso de uma caixa.
 *
 * 2. `cone === 0` E ABSOLUTO. UM unico defensor naquela caixa proibe conduzir,
 *    qualquer que seja o jogador. No futebol conduzir CONTORNANDO um defensor e
 *    a acao normal de quem tem drible e arranque; e o que separa um ponta de um
 *    zagueiro. Um portao absoluto por posicao de terceiro e o mesmo tipo de erro
 *    que a R18.40 encontrou na escalacao (`a.tier - b.tier` como primeira chave
 *    de um comparador em cascata): um veto que nao aceita ser compensado por
 *    qualidade.
 *
 * O CONSERTO, dois termos independentes e parametrizados.
 *
 *   (a) A caixa vira cone de verdade: a meia-largura passa a crescer com a
 *       distancia a frente, `RAIO_BASE + fx * ABERTURA`, e o comprimento cai de
 *       9 m para `COMPR`. Perto do portador o teste fica MAIS exigente que hoje
 *       (defensor colado bloqueia), longe fica menos — que e a geometria certa.
 *
 *   (b) O portao absoluto vira portao com compensacao: `cone <= 1` e permitido
 *       quando o portador tem drible e arranque acima de `PERICIA`. Zagueiro
 *       continua sem conduzir contra defensor; ponta driblador passa.
 *
 * O QUE NAO TOCO. `_carry` em si (o alvo de 8-11,6 m), `decisionInterval`, a
 * ordem do dispatch, o passe de progressao que vem antes, e nenhuma curva de xG.
 * Nao consome RNG e nao teleporta.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR, para poder ser derrubada.
 *   - `INT-01` deve subir de 1,182% para algo entre 2% e 5%. Se passar de ~8% o
 *     patch trocou passe por conducao em excesso, o que aparece como queda de
 *     `pass` e de posse — regressao, nao melhora.
 *   - `metros_por_conducao` deve ficar PARADO em ~2,3 m, porque o compromisso nao
 *     e desta rodada. Se subir, algo mais mudou e eu nao entendi o mecanismo.
 *   - `posse_no_terco_final_pct` e `situacoes_de_chute` sao o teste de utilidade:
 *     conduzir mais tem de CHEGAR mais. Se os metros somarem e o terco final nao
 *     mexer, a conducao esta andando para o lado.
 *   - `COE-01` (gols/xG em [0,90;1,15]) tem de FICAR. Foi o unico gate que pegou
 *     o artefato da R18.48 e e o guarda desta rodada tambem.
 *
 * USO
 *   node tools/r1849/patch_cone.js --in=E.html --out=S.html
 *        [--raioBase=2.6] [--abertura=0.30] [--compr=6.5]
 *        [--maxCone=1] [--pericia=74]
 * ==========================================================================*/
const fs = require('fs'), crypto = require('crypto'), path = require('path');
const a = (n, d) => { const h = process.argv.slice(2).find(x => x.startsWith('--' + n + '=')); return h ? h.slice(n.length + 3) : d; };
const RAIO_BASE = a('raioBase', '2.6');
const ABERTURA = a('abertura', '0.30');
const COMPR = a('compr', '6.5');
const MAX_CONE = a('maxCone', '1');
const PERICIA = a('pericia', '74');

let src = fs.readFileSync(a('in', 'entrada.html'), 'utf8');
const applied = [];
function troca(id, de, para) {
  const n = src.split(de).length - 1;
  if (n !== 1) { console.error('ABORTA [' + id + ']: ancora ' + n + 'x, esperado 1'); process.exit(1); }
  src = src.split(de).join(para); applied.push(id);
}

/* (a) A contagem passa a usar um cone de verdade, calculado no proprio sitio em
   vez de chamar `_inForwardCone` — o predicado antigo fica intacto para os
   outros usos que ele tem no motor (`_openLaneAhead` e companhia). Nao mexo num
   predicado compartilhado para resolver um problema de um chamador. */
troca('r1849-cone-geometria',
  `    let cone = 0; for (const d of opps) if (this._inForwardCone(o, d, g, inAtt ? 4.5 : 5.5, 9)) cone++;`,
  `    let cone = 0;`
  + ` { const _cdx = Math.sign(g.x - o.x), _cl = ${COMPR}, _cr0 = ${RAIO_BASE}, _cab = ${ABERTURA};`
  + ` for (const d of opps) { if (d.red || d.isGK) continue;`
  + `   const _fx = (d.x - o.x) * _cdx;`
  + `   if (_fx <= 0 || _fx >= _cl) continue;`
  + `   if (Math.abs(d.y - o.y) < _cr0 + _fx * _cab) cone++; } }`);

/* (b) O portao absoluto aceita compensacao por pericia de conducao. */
troca('r1849-cone-portao',
  `    if (cone === 0 && dtg > 6) { this._carry(o, g); return; }`,
  `    { const _cnDri = getAttr(o, 'drible'), _cnAcc = getAttr(o, 'aceleracao');`
  + ` const _cnTeto = ((_cnDri + _cnAcc) / 2 >= ${PERICIA}) ? ${MAX_CONE} : 0;`
  + ` if (cone <= _cnTeto && dtg > 6) { this._carry(o, g); return; } }`);

const META = `<script id="cds-r1849-carry-cone">
/* R18.49 · O cone da conducao. */
(function(root){try{
  root.CDS_R1849_CONE=Object.freeze({version:'5.36.0-R18.49',
    label:'CONE DA CONDUCAO',
    raioBase:${RAIO_BASE}, abertura:${ABERTURA}, comprimento:${COMPR},
    maxCone:${MAX_CONE}, pericia:${PERICIA},
    note:'O teste que liberava conduzir chamava _inForwardCone(o,d,g,4.5|5.5,9), que apesar do nome e um RETANGULO: fx<9 e |dy|<4,5-5,5. Um defensor a 8 m adiante e 4 m ao lado bloqueava a conducao sem estar no caminho. E cone===0 era portao absoluto: um defensor proibia conduzir para qualquer jogador. Agora (a) a meia-largura cresce com a distancia (raioBase + fx*abertura) e o comprimento cai para o valor acima, e (b) cone<=maxCone e permitido quando (drible+aceleracao)/2 >= pericia. _inForwardCone segue intacto para os outros chamadores; _carry, decisionInterval e a ordem do dispatch nao foram tocados.',
    predicadoCompartilhadoTocado:false, carryTocado:false, decisionIntervalTocado:false,
    rngUsed:false, teleport:false});
  root.CDS_BUILD_ID='R18.49'; root.CDS_VERSION='5.36.0-R18.49';
  if(root.document) root.document.title='Copa dos Sonhos — R18.49';
}catch(_){}})(typeof window!=='undefined'?window:globalThis);
</script>
</body></html>`;
if (src.split('</body></html>').length - 1 !== 1) { console.error('ABORTA: ancora </body></html> nao unica'); process.exit(1); }
src = src.replace('</body></html>', META);

const dest = a('out', 'r1849.html');
fs.writeFileSync(dest, src, 'utf8');
console.log(path.basename(dest), '|', applied.join(', '),
  '| cone', RAIO_BASE + '+' + ABERTURA + '*fx', 'x', COMPR, 'm | maxCone', MAX_CONE, '| pericia', PERICIA, '|',
  crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex').slice(0, 12));
