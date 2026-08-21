
(function (root) {
'use strict';
/* OS-207 · A ANIMACAO PASSA A OLHAR O QUADRO INTEIRO
   ===========================================================================
   O dono reclamou de uma "bugadinha" na hora de bater falta, bater escanteio e
   sofrer falta. Nao e uma: sao defeitos diferentes que se encontram no mesmo
   instante do jogo — justamente o instante em que a bola esta parada, a camera
   nao acompanha nada e o olho tem tempo de olhar.

   Os outros estao corrigidos onde nascem, todos no desenho:
     · a passada do batedor que saltava de volta      -> 70-game-runtime (OS-89)
     · o tremor do #anti-cardume na bola parada       -> 70-game-runtime
     · quem sofre a falta nao tinha gesto             -> 21-cds-ux-boot + OS-46

   Esta camada corrige o que sobra, que e um problema de HORA, nao de conta.

   -------------------------------------------------------------------------
   A ANIMACAO LIA A VELOCIDADE ANTES DE A BOLA PARADA ESCREVER A POSICAO

   Cada camada envolve `P.step` capturando a anterior, entao a ORDEM DO
   DOCUMENTO decide quem roda por fora de quem. A ponte de animacao e o bloco
   21. Depois dela ainda escrevem `p.x/p.y` — varias tambem `p.vx/p.vy` — a
   OS-77 (falta comum), a OS-83 (impedimento), a OS-100 (lateral), a OS-107
   (bloco de bola parada), a OS-112 e a R18.99.

   Ou seja: TUDO que move gente durante a cerimonia escreve depois que a
   animacao ja escolheu a pose do quadro. O desenhista pinta a posicao FINAL;
   a maquina de estados escolheu a pose com a velocidade do meio do caminho.
   O resultado e o atleta deslizando pelo gramado numa pose parada, ou
   pedalando no lugar depois de ja ter chegado ao posto.

   A R18.99/T7 diagnosticou exatamente este sintoma — o comentario dela diz,
   com todas as letras, "o 'meio bugadinho' que se ve na hora da falta" — e a
   conta dela esta certa: velocidade e deslocamento dividido pelo passo. So que
   ela aplica isso QUATRO NIVEIS POR FORA da ponte. A velocidade corrigida
   existe e a animacao nunca a ve, porque o quadro dela ja passou.

   -------------------------------------------------------------------------
   POR QUE ISTO NAO MEXE NO JOGO

   A primeira versao desta camada tambem mexia no motor: freava a cerimonia e
   fazia o batedor caminhar por aqui. A bateria reprovou — 48 partidas, 12/13
   metricas de design cairam para 11/13, com `zeroZeroRate` indo de 0,062 para
   0,146 (faixa 0,045-0,12). Bola parada e onde se fazem gols; mexer no passo
   de quem se posiciona muda quantos saem. Aquilo foi revertido.

   O que ficou nao escreve NADA que o motor leia. A velocidade honesta e
   EMPRESTADA: a camada troca `p.vx/p.vy` pelo valor coerente com o
   deslocamento, manda a ponte amostrar, e devolve os valores originais no
   mesmo passo, antes de qualquer outra coisa rodar. O motor termina o quadro
   com exatamente os numeros que teria sem esta camada — a bateria confirma,
   agregado a agregado.

   Nenhum sorteio, nenhum consumo de RNG, nenhuma decisao nova, nenhuma
   posicao escrita. So a hora de olhar.
   =========================================================================== */
const M = root && root.MatchSim;
if (!M || !M.prototype || M.prototype.__OS207__) return;
const P = M.prototype; P.__OS207__ = true;

/* Mesma saturacao que `commitMovement` e a R18.99 ja usam. Existe porque a
   recolocacao administrativa (troca de campo, formacao inicial, reinicio apos
   gol) desloca dezenas de metros num quadro, e nenhuma perna anima a 800 m/s:
   a DIRECAO e verdadeira, o modulo satura no que o atleta corre. */
const VEL_TETO = 1.05;

function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : (d || 0); }

const oldStep = P.step;
P.step = function (dt) {
  const passo = Math.max(1 / 240, Math.min(0.15, num(dt, 1 / 30)));

  /* posicao no fim do quadro anterior: e contra ela que o deslocamento deste
     quadro e medido, depois que todo mundo ja escreveu */
  const antes = new Map();
  const teams0 = this.teams || [];
  for (let i = 0; i < teams0.length; i++) {
    const pl = teams0[i].players || [];
    for (let j = 0; j < pl.length; j++) {
      const p = pl[j];
      if (p && !p.red) antes.set(p, [num(p.x), num(p.y)]);
    }
  }

  const r = oldStep.apply(this, arguments);

  /* A AMOSTRAGEM DA ANIMACAO POR ULTIMO. Depois desta linha nada mais move
     ninguem neste quadro, entao a pose que a maquina de estados escolher e a
     pose do que o desenhista vai de fato pintar. */
  try {
    const B = root.CDS_ANIM_BRIDGE;
    if (B && typeof B.amostrar === 'function') {
      if (!B.dono) B.dono = 'OS-207';
      if (B.dono === 'OS-207') {
        const guardado = [];
        antes.forEach(function (p0, p) {
          if (p.red) return;
          guardado.push([p, p.vx, p.vy]);
          let vx = (num(p.x) - p0[0]) / passo, vy = (num(p.y) - p0[1]) / passo;
          const teto = num(p.maxSpd, 7) * VEL_TETO, v = Math.hypot(vx, vy);
          if (v > teto && v > 0) { vx = vx / v * teto; vy = vy / v * teto; }
          p.vx = vx; p.vy = vy;
        });
        try { B.amostrar.call(this, dt); }
        finally {
          /* devolve SEMPRE, mesmo se a amostragem estourar: o motor nao pode
             terminar o quadro com um numero que a apresentacao emprestou */
          for (let k = 0; k < guardado.length; k++) {
            guardado[k][0].vx = guardado[k][1];
            guardado[k][0].vy = guardado[k][2];
          }
        }
      }
    }
  } catch (_) { /* apresentacao nunca derruba o motor */ }

  return r;
};

root.CDS_OS207 = Object.freeze({
  versao: 'OS-207', instalado: true,
  feature: 'ANIM_SAMPLED_AFTER_EVERY_WRITER',
  presentationOnly: true, engineMutation: false, rngConsumption: false
});
root.CDS_BUILD_ID = 'R19.10'; root.CDS_VERSION = '5.80.1-R19.10';
try { document.title = 'Copa dos Sonhos — R19.10'; } catch (_) { }
})(typeof window !== 'undefined' ? window : globalThis);
