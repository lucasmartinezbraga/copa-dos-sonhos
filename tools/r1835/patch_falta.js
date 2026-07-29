/* ============================================================================
 * R18.35 · A FALTA COMUM PASSA A SER COBRADA
 * ----------------------------------------------------------------------------
 * RELATO DO USUÁRIO JOGANDO: "a falta ainda não é cobrada, o jogador só segue
 * andando com a bola". Medido, e é literal.
 *
 *   faltas por partida .................... 6,25
 *   que caem no ramo COMUM de _awardFoul .. 94,7% (71 de 75)
 *   cobrança direta ....................... 4
 *   pênalti ............................... 0
 *
 * O ramo comum (linha ~6687) faz:
 *     this.dead = 0.82;
 *     this.pendingRestart = () => { this._giveBall(this._nearestFieldMate(victim)); ... };
 *
 * A bola NÃO é colocada no local da falta. E o "companheiro mais próximo" é o
 * PRÓPRIO jogador que sofreu a falta: distância mediana medida = **0,0 m**.
 * Ou seja, o motor apita, espera 0,8 s e devolve a bola ao mesmo jogador no
 * mesmo lugar. Não existe cobrança em 94,7% das faltas.
 *
 * A máquina de bola parada JÁ EXISTE nesta build: `armTaker` (linha ~20687)
 * coloca a bola no ponto, manda o batedor caminhar (`__spTarget`), estende
 * `dead` pelo tempo da caminhada e segura o reinício até ele chegar. Ela é
 * usada em lateral, escanteio e tiro de meta. Faltava ligar a falta nela.
 *
 * O patch entra DENTRO da camada onde `armTaker` vive — de fora ela não é
 * alcançável (é closure). E discrimina a rota embrulhando `_penalty` e
 * `_freeKick`, para agir só no ramo comum.
 * ==========================================================================*/
const fs=require('fs'),crypto=require('crypto'),path=require('path');
const a=(n,d)=>{const h=process.argv.slice(2).find(x=>x.startsWith('--'+n+'='));return h?h.slice(n.length+3):d;};
const PAUSA=Number(a('pausa',1.2)), TETO=Number(a('teto',4.0));
let src=fs.readFileSync(a('in','rl-livre.html'),'utf8');
const applied=[];
function edit(id,from,to){const n=src.split(from).length-1;if(n!==1){console.error('ABORTA ['+id+']: ancora '+n+'x');process.exit(1);}src=src.replace(from,to);applied.push(id);}

edit('r1835-falta-cobrada',
`  // O passo segura o reinício: enquanto o batedor não chegar (e dentro do teto),`,
`  /* §R18.35 · A FALTA COMUM PASSA A SER COBRADA. 94,7% das faltas caíam num
     ramo que devolvia a bola ao companheiro mais próximo — que é o próprio
     jogador que sofreu a falta (distância mediana 0,0 m). A bola nunca era
     colocada no local e ninguém caminhava: o jogo apitava e seguia. Agora a
     falta usa a mesma máquina de bola parada do lateral e do escanteio. */
  var _r1835rota = null;
  var _r1835pen = P._penalty, _r1835fk = P._freeKick;
  if (typeof _r1835pen === 'function') P._penalty = function () { _r1835rota = 'penalti'; return _r1835pen.apply(this, arguments); };
  if (typeof _r1835fk === 'function') P._freeKick = function () { _r1835rota = 'direta'; return _r1835fk.apply(this, arguments); };
  var _r1835award = P._awardFoul;
  if (typeof _r1835award === 'function') {
    P._awardFoul = function (fouler, victim) {
      _r1835rota = 'comum';
      var r = _r1835award.apply(this, arguments);
      try {
        if (_r1835rota === 'comum' && victim && !victim.red && this.pendingRestart) {
          var sx = clamp(num(victim.x), 1, FL - 1), sy = clamp(num(victim.y), 1, FW - 1);
          var tm = this.teams[victim.team];
          var cand = tm.players.filter(function (p) { return p && !p.red && !p.isGK; })
                       .sort(function (m, n2) { return dist(m.x, m.y, sx, sy) - dist(n2.x, n2.y, sx, sy); })[0] || victim;
          armTaker(this, cand, sx, sy, ${PAUSA}, ${TETO}, true);
          var sim = this;
          this.pendingRestart = function () {
            sim._giveBall(cand);
            if (sim.ball.owner) sim.ball.owner.settle = 0.6;
          };
          this._emit('falta_cobrada', { by: cand, x: sx, y: sy });
        }
      } catch (_) {}
      _r1835rota = null;
      return r;
    };
  }

  // O passo segura o reinício: enquanto o batedor não chegar (e dentro do teto),`);

const ID=`  root.CDS_BUILD_ID='R18.31'; root.CDS_VERSION='5.25.0-R18.31';`;
if(src.split(ID).length-1===1){
  src=src.replace(ID,`  root.CDS_R1835_FALTA=Object.freeze({version:'R18.35',label:'FALTA COMUM E COBRADA',pausa:${PAUSA},teto:${TETO},
    note:'94,7% das faltas caiam num ramo que devolvia a bola ao companheiro mais proximo — que e o proprio jogador que sofreu a falta (mediana 0,0 m). A bola nunca era colocada no local. Agora usa armTaker, a mesma maquina do lateral e do escanteio.'});
  root.CDS_BUILD_ID='R18.35'; root.CDS_VERSION='5.29.0-R18.35';`);
  src=src.replace(`  if(root.document)root.document.title='Copa dos Sonhos — R18.31';`,`  if(root.document)root.document.title='Copa dos Sonhos — R18.35';`);
  src=src.replace(`<title>Copa dos Sonhos — R18.31</title>`,`<title>Copa dos Sonhos — R18.35</title>`);
}
fs.writeFileSync(a('out','rf.html'),src,'utf8');
console.log('patches:',applied.join(', '));
console.log(path.basename(a('out','rf.html')),'| pausa',PAUSA,'teto',TETO,'|',crypto.createHash('sha256').update(fs.readFileSync(a('out','rf.html'))).digest('hex').slice(0,12));
