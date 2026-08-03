/* ============================================================================
 * OS-77 · A FALTA ATRAS PASSA A SER BOLA PARADA DE VERDADE
 * ----------------------------------------------------------------------------
 * PROXIMA_RODADA.md item 1, observacao de campo:
 *   "O jogador sofreu falta e nao parou para bater, ele saiu andando com a
 *    bola. (Faltas atras)"
 *
 * MECANISMO — fim de `_awardFoul`, R18.83:
 *
 *     if (dtg < 42 && chance(0.92)) { this._freeKick(...); return; }
 *     // falta comum: reinicio com posse
 *     this.dead = 0.82;
 *     this.pendingRestart = () => { this._giveBall(this._nearestFieldMate(victim));
 *                                   this.ball.owner.settle = 0.6; };
 *
 * `dtg` e a distancia ate o gol ADVERSARIO, entao falta no proprio campo cai no
 * ramo de baixo. Esse ramo nunca poe a bola no chao: entrega a posse ao
 * companheiro mais proximo, onde quer que ele esteja.
 *
 * MEDIDO (documento, 4 partidas, diag_os73_foul_restart.js):
 *     faltas que caem neste ramo ............ 6,3 por partida
 *     deslocamento da bola ate reaparecer ... mediana 2,76 m | p90 6,13 m
 *     adversario mais proximo no reinicio ... mediana 2,93 m | p10 0,06 m
 * A regra real pede 9,15 m. Em 10% dos casos ha adversario a SEIS CENTIMETROS.
 *
 * O QUE ENTRA — as tres coisas que o documento pede, nessa ordem
 *   1. bola NO LOCAL da falta, nao no pe de quem estiver perto;
 *   2. quem cobra ANDA ate a bola — reaproveita `armTaker`, que ja poe a bola
 *      no ponto, manda o batedor caminhar por `__spTarget`, estende `dead` pelo
 *      tempo da caminhada e segura o reinicio ate ele chegar;
 *   3. AFASTAMENTO do adversario — reaproveita o guard da OS-36.
 *
 * POR QUE ESTE PATCH ENTRA NO BLOCO `cds-r18fix-restart-positions`
 * `armTaker` e closure daquele bloco e nao existe fora dele. Medido: os
 * simbolos vivem em blocos diferentes — `armarBarreira` e `__os36Guard` em
 * `cds-os36-freekick-distance`, `armTaker` em `cds-r18fix-restart-positions`.
 * Por isso o afastamento nao chama `armarBarreira` (inalcancavel daqui) e sim
 * MONTA o objeto de guard que o clamp de `_movePlayers` ja sabe consumir:
 * `{x, y, team, until, wall}`. O `wall` vai vazio de proposito — ele so serve
 * para o desenho da barreira e para a limpeza do marcador; a expulsao por raio
 * e feita pelo proprio clamp sobre `teams[1-g.team]`.
 *
 * ------------------------------------------------------------------ CONTRATO
 *
 * HIPOTESE (direcao)
 *   O deslocamento entre o local da falta e onde a bola reaparece CAI.
 *   A distancia do adversario mais proximo no reinicio SOBE.
 *   O numero de faltas por partida nao muda — o patch nao cria nem evita falta.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR
 *   1. deslocamento mediano cai de 2,76 m para perto de zero;
 *   2. adversario mais proximo sobe da mediana de 2,93 m, e o p10 sai de
 *      0,06 m;
 *   3. o p10 NAO chega a 9,15 m: o reinicio e rapido e o clamp por quadro
 *      limita o quanto o adversario consegue recuar no tempo disponivel. Se
 *      chegar a 9,15 m, alguem teleportou e o patch esta errado;
 *   4. `dead` sobe, porque o batedor caminha — e isso custa bola morta, que ja
 *      esta em 11,1% dos quadros.
 *
 * QUAL GATE DECIDE
 *   Primario: `diag_os73_foul_restart.js` — deslocamento e adversario proximo.
 *   Guarda obrigatoria: `diag_os37_frame_jump.js`. O documento e explicito —
 *   "se voce aumentar o afastamento sem aumentar o dead, os adversarios vao ser
 *   empurrados DURANTE o jogo corrido e isso aparece como salto por quadro.
 *   Meca o salto por quadro antes de promover."
 *   Ecologia: gols, xG, chutes dentro da banda; ECO-02 xG <= 2,7.
 *
 * ARMADILHA
 *   Alem do salto por quadro: `armTaker` estende `dead`, e bola morta ja e
 *   11,1% dos quadros. Se a duracao real da partida subir, o item 6 da fila
 *   (que quer o jogo MAIS RAPIDO) fica mais dificil. Os dois se contradizem, e
 *   quem decidir o item 6 precisa saber que este patch empurra na direcao
 *   oposta.
 * ==========================================================================*/
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const arg = (n, d) => { const h = process.argv.slice(2).find(x => x.startsWith('--' + n + '=')); return h ? h.slice(n.length + 3) : d; };
const PAUSA = Number(arg('pausa', 1.1));   // pausa base da caminhada do batedor
const TETO = Number(arg('teto', 3.2));     // teto de espera pelo batedor
const JANELA = Number(arg('janela', 1.6)); // por quanto tempo o afastamento vale

let src = fs.readFileSync(arg('in'), 'utf8');
const aplicados = [];
function edit(id, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) { console.error('ABORTA [' + id + ']: ancora ' + n + 'x'); process.exit(1); }
  src = src.replace(from, to); aplicados.push(id);
}

/* O gancho entra DENTRO do bloco onde armTaker vive. A ancora e o comentario do
   proprio passo que segura o reinicio, que so existe naquele bloco. */
edit('os77-falta-atras',
`  // O passo segura o reinício: enquanto o batedor não chegar (e dentro do teto),`,
`  /* §OS-77 · A FALTA ATRAS PASSA A SER BOLA PARADA DE VERDADE.
     Medido: 6,3 faltas por partida caem no ramo "reinicio com posse", que nunca
     poe a bola no chao — ela reaparece a 2,76 m de mediana do local da falta, e
     em 10% dos casos com adversario a 6 cm. Agora a bola vai ao ponto, o
     batedor caminha ate ela (armTaker) e o adversario e afastado pelo mesmo
     guard com clamp por quadro que a OS-36 ja usa — sem teleporte. */
  var _os77rota = null;
  var _os77pen = P._penalty, _os77fk = P._freeKick;
  if (typeof _os77pen === 'function') P._penalty = function () { _os77rota = 'penalti'; return _os77pen.apply(this, arguments); };
  if (typeof _os77fk === 'function') P._freeKick = function () { _os77rota = 'direta'; return _os77fk.apply(this, arguments); };
  var _os77award = P._awardFoul;
  if (typeof _os77award === 'function') {
    P._awardFoul = function (fouler, victim) {
      _os77rota = 'comum';
      var r = _os77award.apply(this, arguments);
      try {
        if (_os77rota === 'comum' && victim && !victim.red && this.pendingRestart) {
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
          /* Afastamento: monta o guard que o clamp de _movePlayers ja consome.
             wall vazio de proposito — ele so serve ao desenho da barreira. */
          this.__os36Guard = { x: sx, y: sy, team: victim.team, until: num(this.t) + ${JANELA}, wall: [] };
          this._emit('falta_atras_cobrada', { by: cand, x: sx, y: sy });
        }
      } catch (_) {}
      _os77rota = null;
      return r;
    };
  }

  // O passo segura o reinício: enquanto o batedor não chegar (e dentro do teto),`);

const saida = arg('out');
fs.writeFileSync(saida, src, 'utf8');
console.log('patches:', aplicados.join(', '));
console.log(path.basename(saida), '| pausa', PAUSA, 'teto', TETO, 'janela', JANELA, '|', crypto.createHash('sha256').update(fs.readFileSync(saida)).digest('hex').slice(0, 12));
