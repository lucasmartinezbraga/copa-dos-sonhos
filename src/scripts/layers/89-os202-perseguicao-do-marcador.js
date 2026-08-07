
/* ════════════════════════════════════════════════════════════════════════════
   OS-202 · O MARCADOR CORTA O ANGULO
   ════════════════════════════════════════════════════════════════════════════

   O PROBLEMA, MEDIDO
   ------------------
   As faltas ficam em 15,3 por partida contra um minimo de design de 16, e duas
   tentativas anteriores (subir `foulBase`, criar falta na disputa aerea)
   provaram que o volume nao sai da probabilidade POR DUELO — sai de QUANTOS
   DUELOS acontecem. Entao fui medir o funil do duelo, em 10 partidas:

     com bola dominada           11.520 quadros  (28,2% do jogo)
       presser FORA do raio       7.641          <- 66% do tempo util
       presser no raio, cooldown    345
       presser no raio, liberado  1.744          <- so aqui pode haver duelo

     distancia media presser -> portador   7,55 m
     raio de bote                          3,01 m

   O marcador designado passa o jogo a 7,55 m do portador enquanto o bote so
   acontece dentro de 3,01 m. Ele e escolhido, mandado, e nao chega.

   POR QUE NAO CHEGA
   -----------------
   O alvo dele era a posicao da bola deslocada 1,25 m para o lado do proprio
   gol (camada R13). Isso e perseguicao pura: mirar onde o portador ESTA. Contra
   alguem de velocidade parecida a distancia nao fecha nunca — e a corrida do
   cachorro atras do carro. Defensor de verdade mira onde o portador VAI estar.

   ONDE ISTO TINHA QUE MORAR
   -------------------------
   No core, `_defendTarget` tem um ramo `if (p === presser) return [b.x, b.y]`
   que parece o lugar certo e NAO E: a camada R13 intercepta o presser antes e
   retorna sem chamar o core. Editei o core primeiro, medi, e os numeros vieram
   identicos — o mesmo tipo de engano que ja tinha aparecido com o arrasto da
   R13. Por isso a correcao vive aqui, na ultima camada, que tem a palavra
   final.

   O QUE MUDA
   ----------
   O ponto de encontro passa a levar em conta a velocidade do portador. O quanto
   antecipar sai da propria distancia — quanto mais longe, mais tempo a corrida
   leva —, limitado a meio segundo de leitura: a primeira versao usava o tempo
   cheio de aproximacao e mandava o marcador para 9,3 m adiante da bola, o que
   e passar batido, nao cortar o angulo.

   O lado do proprio gol da R13 e preservado: pressionar por tras seria trocar
   proximidade por marcacao falsa.
   ════════════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  const M = root && root.MatchSim;
  if (!M || !M.prototype || M.prototype.__OS202__) return;
  const P = M.prototype;
  P.__OS202__ = true;

  const FL = Number(root.FL) || 105, FW = Number(root.FW) || 68;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const finito = (v, d) => Number.isFinite(v) ? v : (d === undefined ? 0 : d);
  const _getAttr = (typeof getAttr === 'function') ? getAttr : () => 60;

  const T = (root && root.CDS_OS202_TUNE) || {};
  const num = (v, padrao) => Number.isFinite(v) ? v : padrao;

  /* Teto de antecipacao, em segundos de corrida. Meio segundo e o corte de
     angulo; mais que isso vira passar batido. */
  const LEAD_MAX = num(T.leadMax, 0.55);
  /* Deslocamento para o lado do proprio gol, herdado da R13. */
  const GOAL_SIDE = num(T.goalSide, 1.25);

  const oldDefend = P._defendTarget;
  P._defendTarget = function (tm, p, b, presser) {
    if (p !== presser || !b || !b.owner || b.owner.team === tm.side || b.traveling) {
      return oldDefend.apply(this, arguments);
    }
    const dono = b.owner;
    if (dono === p) return oldDefend.apply(this, arguments);

    const gap = Math.hypot(dono.x - p.x, dono.y - p.y);
    const vmax = Math.max(3, finito(p.maxSpd, 7));
    /* leitura de jogo: quem antecipa bem escolhe melhor o ponto de encontro */
    const leitura = 0.50 + (finito(_getAttr(p, 'antecipacao'), 60)
      + finito(_getAttr(p, 'posicionamento'), 60)) / 200 * 0.50;
    const lead = clamp(gap / vmax, 0, LEAD_MAX) * leitura;

    /* ponto de encontro */
    let ax = dono.x + finito(dono.vx) * lead;
    let ay = dono.y + finito(dono.vy) * lead;

    /* e o mesmo lado de gol da R13, para nao marcar pelas costas */
    const vx = tm.goal.x - ax, vy = tm.goal.y - ay;
    const L = Math.max(0.1, Math.hypot(vx, vy));
    ax += vx / L * GOAL_SIDE;
    ay += vy / L * GOAL_SIDE;

    return [clamp(ax, 1, FL - 1), clamp(ay, 1, FW - 1)];
  };

  root.CDS_OS202 = Object.freeze({ versao: 'OS-202', instalado: true, leadMax: LEAD_MAX });
})(typeof window !== 'undefined' ? window : globalThis);
