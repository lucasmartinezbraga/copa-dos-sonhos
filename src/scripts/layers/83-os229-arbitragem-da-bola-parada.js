
(function (root) {
'use strict';
/* OS-229 · A ARBITRAGEM DA BOLA PARADA — UM ESCRITOR A MENOS, NAO A MAIS
   ===========================================================================
   RELATO, repetido a sessao inteira: "na hora da falta continua dando uma
   bugada maxima", "muito jitterzinho ta osso".

   E o dono estava certo em desconfiar de que se estava tratando sintoma. A
   OS-207 corrigiu o que a ANIMACAO via; o defeito da POSICAO ficou de pe, e
   so ficou visivel com numero quando a medicao separou o jitter por SITUACAO
   de jogo (`tools/fisica/tela`, reversao de direcao da posicao fisica):

       portador                    0,1%      passo medio 0,062 m
       arranque                    0,2%                  0,058
       presser                     0,4%                  0,072
       bloco, jogo rolando         0,6%                  0,046
       bola morta, SEM alvo        0,6%                  0,037
       bola morta, COM __spTarget  2,5%                  0,166   <- aqui

   A fisica e suave em TODA parte menos numa populacao: quem tem alvo de bola
   parada durante a bola morta. Passo 3,5 vezes maior e reversao 4 vezes mais
   frequente. Nao e "o jogo treme": e ESTE conjunto de jogadores tremendo.

   POR QUE. Dois sistemas escrevem o mesmo corpo no mesmo quadro. O tatico
   (`_integrate` -> `commitMovement`) puxa o jogador para o alvo de jogo, e a
   maquina de bola parada (a caminhada da R15) o puxa para o posto. Nenhum dos
   dois sabe do outro. O passo somado e maior que qualquer um deles sozinho --
   dai 0,166 m contra 0,046 -- e quando os dois alvos ficam em lados opostos,
   o corpo alterna de direcao a cada quadro.

   TRES CORRECOES JA FORAM TENTADAS E MEDIDAS, TODAS ERRADAS:

     · mexer no `freeze` do nucleo (OS-207, primeira versao)
       bateria 12/13 -> 11/13. Mexer no passo de quem se posiciona muda placar.
     · alongar a janela de caminhada (OS-211)
       bateria -> 10/13 E nao corrigiu: G1 seguiu 0/4.
     · acrescentar um escritor FINAL, como no pontape (OS-225)
       tremor de desenho 4,88% -> 8,53%. Mais um escritor e mais um lado no
       cabo-de-guerra, nao o fim dele.

   O QUE FALTAVA ERA O OPOSTO DE TODAS ELAS: nao freiar, nao alongar, nao
   acrescentar. TIRAR.

   Se o jogador foi designado a um posto de bola parada, quem manda nele e a
   maquina de bola parada -- ponto. O alvo tatico nao tem o que dizer sobre um
   corpo que esta indo se posicionar para um escanteio. Aqui o `_integrate`
   simplesmente NAO PLANEJA movimento para quem tem `__spTarget` com a bola
   morta: `commitMovement` entao mantem a posicao anterior, e a caminhada da
   R15 -- que roda depois -- fica sendo o unico escritor daquele corpo.

   Nao ha politica nova, nao ha alvo novo, nao ha sorteio: um dos dois lados
   do cabo-de-guerra larga a corda.
   =========================================================================== */
const M = root && root.MatchSim;
if (!M || !M.prototype || M.prototype.__OS229__) return;
const P = M.prototype; P.__OS229__ = true;

function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : (d || 0); }

const oldIntegrate = P._integrate;
if (typeof oldIntegrate === 'function') {
  P._integrate = function (p, tx, ty, dt, freeze) {
    /* O portador e o goleiro ficam de fora: o primeiro tem a bola no pe e
       precisa do movimento normal, o segundo nunca recebe posto de bola
       parada e tem logica propria. */
    if (p && !p.isGK && p.__spTarget && num(this.dead) > 0 &&
        this.ball && this.ball.owner !== p) {
      /* nao planeja nada. `commitMovement` mantem a posicao da fotografia, e
         a caminhada de bola parada escreve sozinha, depois. */
      this.__os229Cedidos = num(this.__os229Cedidos) + 1;
      return;
    }
    return oldIntegrate.apply(this, arguments);
  };
}

P.getOS229Audit = function () {
  return { versao: 'OS-229', quadrosCedidos: num(this.__os229Cedidos) };
};

root.CDS_OS229 = Object.freeze({
  versao: 'OS-229', instalado: true,
  feature: 'SET_PIECE_WALK_IS_THE_ONLY_WRITER',
  rngAdded: false, xgChange: false
});
root.CDS_BUILD_ID = 'R19.14'; root.CDS_VERSION = '5.80.5-R19.14';
try { document.title = 'Copa dos Sonhos — R19.14'; } catch (_) { }
})(typeof window !== 'undefined' ? window : globalThis);
