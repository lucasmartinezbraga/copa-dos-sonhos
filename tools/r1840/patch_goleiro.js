/* ============================================================================
 * R18.40 · O GOLEIRO VAI ATE ONDE O PLANO DISSE QUE ELE IA  (OS-01)
 * ----------------------------------------------------------------------------
 * O motor planeja a defesa com honestidade fisica. `_gkInterceptTarget` varre
 * 73 pontos da trajetoria e escolhe um ponto de encontro que respeita tempo de
 * reacao, velocidade de deslocamento e alcance. A camada R10
 * (27-r10-engine-closure.js) ainda REBASEIA o alvo da bola para esse ponto —
 * ou seja, a bola voa exatamente para onde o goleiro poderia chegar.
 *
 * Ninguem leva o goleiro ate la. `_goalkeeperTarget` posiciona por bissetriz e
 * profundidade, sem nenhuma nocao do plano; e `p._gkAI.wait` ainda congela o
 * alvo por ate 0,25 s. Quando a bola chega, `_gkResolveSave` pergunta se o
 * goleiro esta a 1,95 m — e como ele foi para outro lugar, a resposta e nao:
 *
 *     this._emit('visual_contact_failed', ...)
 *     this._continueTravel(..., {outcome:'goal_after_failed_reach'})
 *
 * Gol. Medido na R18.35: 21,9% dos gols (7 de 32 em 12 partidas).
 *
 * POR QUE ISSO NAO E "TIRAR GOL DO JOGO". O desfecho do chute ja foi sorteado
 * ANTES, em `saveCut`/`blockCut`/`postCut`: quando o sorteio caiu na fatia de
 * defesa, a calibracao JA PRETENDIA que aquele chute fosse defendido. O gol por
 * contato falho e vazamento por cima da distribuicao projetada, nao parte dela.
 * Corrigir devolve o jogo a curva que ele proprio declara.
 *
 * A CORRECAO: enquanto um chute viaja com este goleiro como ator do plano, o
 * alvo de movimento dele passa a ser o ponto de contato planejado, e a espera
 * do `_gkAI` e ignorada. Nao existe teletransporte: ele caminha pela mesma
 * camada de movimento de sempre, com a mesma velocidade maxima. Se nao der
 * tempo, continua nao dando — a diferenca e que agora ele TENTA.
 * ==========================================================================*/
const fs = require('fs'), crypto = require('crypto'), path = require('path');
const a = (n, d) => { const h = process.argv.slice(2).find(x => x.startsWith('--' + n + '=')); return h ? h.slice(n.length + 3) : d; };

let src = fs.readFileSync(a('in', 'r1840f.html'), 'utf8');
const applied = [];
function edit(id, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) { console.error('ABORTA [' + id + ']: ancora ' + n + 'x'); process.exit(1); }
  src = src.replace(from, to); applied.push(id);
}

edit('r1840-goleiro',
`    if(!p._gkAI)p._gkAI={x:rawX,y:ty,wait:0};`,
`    /* §R18.40 · O plano e a execucao passam a concordar. A camada R10 ja
       aponta a bola para o ponto de interceptacao calculado para ESTE goleiro;
       faltava o goleiro ir ate ele. Sem o desvio abaixo, o contato falha por
       ausencia e o lance vira gol automatico (21,9% dos gols medidos). A
       espera do _gkAI tambem e ignorada aqui: congelar o alvo por ate 0,25 s
       enquanto a bola voa e exatamente o que fazia o corpo chegar atrasado. */
    if(b&&b.traveling&&b.kind==='shot'&&b.meta&&b.meta.actor===p&&b.target
       &&Number.isFinite(b.target.x)&&Number.isFinite(b.target.y)){
      p._gkAI={x:b.target.x,y:b.target.y,wait:0};
      return [b.target.x,b.target.y];
    }
    if(!p._gkAI)p._gkAI={x:rawX,y:ty,wait:0};`);

const ID = `  root.CDS_BUILD_ID='R18.40'; root.CDS_VERSION='5.30.0-R18.40';`;
if (src.split(ID).length - 1 === 1) {
  src = src.replace(ID, `  root.CDS_R1840_GOLEIRO=Object.freeze({version:'R18.40',label:'O GOLEIRO VAI ATE O PONTO PLANEJADO',
    note:'_gkInterceptTarget planejava o ponto de contato e a camada R10 rebaseava a bola para ele, mas _goalkeeperTarget posicionava o goleiro por bissetriz e nunca ia ate la — e _gkAI.wait congelava o alvo por ate 0,25 s. O contato falhava por ausencia e virava gol automatico em 21,9% dos gols. O desfecho do chute ja era sorteado antes (saveCut/blockCut/postCut), entao esses gols eram vazamento por cima da distribuicao calibrada, nao parte dela.'});
  root.CDS_BUILD_ID='R18.40'; root.CDS_VERSION='5.30.0-R18.40';`);
}

fs.writeFileSync(a('out', 'r1840g.html'), src, 'utf8');
console.log('patches:', applied.join(', '));
console.log(path.basename(a('out', 'r1840g.html')), '|', crypto.createHash('sha256').update(fs.readFileSync(a('out', 'r1840g.html'))).digest('hex').slice(0, 12));
