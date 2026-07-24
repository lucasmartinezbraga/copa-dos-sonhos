/* ===========================================================================
   R15 · BOLA PARADA SEM TELEPORTE  (§17, §32, §36, §56)

   PROBLEMA MEDIDO. `tools/r15/teleport_profiler.js` atribuiu, em 6 partidas,
   1.296 saltos acima de 1,5 m aos seus escritores:

       _resetPositions      49,2%   médio 11,6 m   máx 87,9 m
       _goalKickOrRestart   20,7%   médio 20,8 m   máx 83,5 m
       _setCorner           13,1%   médio 21,0 m   máx 84,2 m
       _switchSides         10,2%   médio 50,0 m   máx 102,4 m   (legítimo)
       _emit                 6,8%   médio 42,9 m   máx 47,3 m

   `_goalKickOrRestart` não escreve posição: ele chama `oldSetCorner` por dentro
   da camada R12, e o perfilador atribuiu ao quadro externo. Somando as duas
   colunas, o ESCANTEIO responde por ~34% dos teleportes.

   `_setCorner` calcula os postos de 12 jogadores (cobrador, três alvos, rebote,
   duas coberturas, quatro marcadores, um de contra-ataque) e ESCREVE `p.x/p.y`
   direto. Depois dá `this.dead = .6` — a 6,5 m/s isso cobre 3,9 m, enquanto a
   rotina realoca gente pelo terço ofensivo inteiro. O §17 é explícito: a forma
   deve surgir da movimentação física, nunca de teletransporte.

   COMO ESTA CAMADA CORRIGE. Sem tocar no corpo de `_setCorner`, que é longo e
   contém toda a lógica de rotina e marcação:

     1. fotografa as posições antes;
     2. deixa o original rodar e calcular os destinos;
     3. devolve cada jogador para onde estava e guarda o destino como ALVO;
     4. alonga `dead` na medida de quem está mais longe;
     5. a cada passo, enquanto a bola está morta, caminha cada um até seu alvo
        respeitando `maxSpd`.

   A BOLA NÃO VOLTA. `_setCorner` a coloca na bandeirinha, e é lá que ela fica —
   quem anda até ela é o cobrador. É o mesmo desenho de `r14-throwin-walk`, que
   já fez isto para o arremesso lateral (dead .72 → até 4,5 s, com sprint).

   CUSTO. `dead` não consome minuto de jogo (10-base-bundle.js:2662): o relógio
   da partida só avança com `dead <= 0`. O gasto é tempo de física, não de jogo.

   TETO. 6 s. Se alguém estiver absurdamente longe, o reinício acontece com ele
   ainda a caminho — preferível a travar a partida.
   =========================================================================== */
(function (root) {
  'use strict';
  var M = root && root.MatchSim;
  if (!M || !M.prototype) return;
  var P = M.prototype;
  if (P.__r15SetPieceWalk) return;
  P.__r15SetPieceWalk = true;

  /* O teto de `dead` foi de 6,0 s para 2,2 s. Motivo, medido em 294 partidas
     com elencos reais (R15.2 → primeira R15.4): o teleporte caiu 54%, mas os
     gols caíram 14,6% enquanto chutes subiam 12% e escanteios 17%. Como `dead`
     NÃO move o relógio da partida (10-base-bundle.js:2662), alongá-lo até 6 s
     por bola parada injeta muito tempo de física com o jogo parado, deslocando
     a proporção entre jogo corrido e bola parada dentro dos mesmos 90 minutos.

     2,2 s a 6,0 m/s cobrem ~13 m, que é a distância típica de reposicionamento
     de escanteio. Quem estiver além disso chega com a bola já rolando — o que
     é futebol, não teleporte: jogador atrasado para o escanteio existe.

     `MIN_MOVE` sobe de 0,5 m para 3,0 m: reposicionamento curto não precisa de
     janela nenhuma e alongava `dead` sem necessidade. */
  var WALK_SPEED = 0.92;   // fração de maxSpd ao se reposicionar (não é sprint)
  var DEAD_CAP = 2.2;      // s de física
  var MIN_MOVE = 3.0;      // abaixo disto o ajuste é curto demais para importar

  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : (d || 0); }

  /* Converte a escrita direta de posição em alvo a ser percorrido. */
  function deferPositions(sim, snap) {
    var far = 0;
    snap.forEach(function (xy, p) {
      if (!p || p.red) return;
      var tx = num(p.x), ty = num(p.y);
      var d = Math.hypot(tx - xy[0], ty - xy[1]);
      if (d <= MIN_MOVE) return;
      p.__spTarget = { x: tx, y: ty };
      p.x = xy[0]; p.y = xy[1];
      p.vx = 0; p.vy = 0;
      if (d > far) far = d;
    });
    if (far > 0) {
      var need = 0.6 + far / (6.5 * WALK_SPEED);
      sim.dead = Math.max(num(sim.dead), Math.min(DEAD_CAP, need));
    }
    return far;
  }

  function snapshot(sim) {
    var m = new Map();
    var teams = sim.teams || [];
    for (var i = 0; i < teams.length; i++) {
      var pl = teams[i].players || [];
      for (var j = 0; j < pl.length; j++) {
        var p = pl[j];
        if (p && !p.red) m.set(p, [num(p.x), num(p.y)]);
      }
    }
    return m;
  }

  var oldSetCorner = P._setCorner;
  P._setCorner = function () {
    var snap = snapshot(this);
    var r = oldSetCorner.apply(this, arguments);
    deferPositions(this, snap);
    return r;
  };

  /* O escanteio também nasce por DENTRO de `_goalKickOrRestart`: a camada R12
     (29-r12-transactional-core.js:138) capturou `oldSetCorner` no carregamento,
     antes deste wrapper, e o invoca diretamente na rotina de "escanteio vindo de
     cruzamento". Envolver só `_setCorner` deixava esse caminho teleportando —
     medido: 25% dos saltos continuavam atribuídos a `_goalKickOrRestart` depois
     da primeira versão desta camada.

     Envolver a função inteira cobre o caminho sem precisar descobrir qual
     referência interna cada camada guardou. Quando nenhuma posição muda — que é
     o caso normal do tiro de meta — `deferPositions` não faz nada. */
  var oldGoalKick = P._goalKickOrRestart;
  P._goalKickOrRestart = function () {
    var snap = snapshot(this);
    var r = oldGoalKick.apply(this, arguments);
    deferPositions(this, snap);
    return r;
  };

  /* KICKOFF APÓS GOL. `_kickoff` chama `_resetPositions`, que snapa os 22 à
     formação — medido como 70% dos teleportes restantes na R15.5 (kickoff,
     intervalo e reinício após gol), com salto médio de 11,7 m e máximo de 75 m.
     Depois de um gol os jogadores estão espalhados perto de uma das metas;
     voltar à formação é caminhada real, não teletransporte.

     DUAS GUARDAS:
     · `this.t > 0.5` — no início da partida (t≈0) os jogadores estão sendo
       COLOCADOS pela primeira vez; não há posição anterior de onde caminhar, e
       animar isso seria inventar movimento. O reset inicial passa direto.
     · o cobrador do meio, que `_kickoff` posiciona no centro DEPOIS de
       `_resetPositions`, é reescrito para o centro pela própria `_kickoff` e
       fica lá — é onde o batedor deve estar. `deferPositions` roda antes dessa
       reescrita e captura o resto; a linha `mid.x=FL/2` sobrepõe o alvo dele. */
  var oldKickoff = P._kickoff;
  P._kickoff = function () {
    var snap = snapshot(this);
    var r = oldKickoff.apply(this, arguments);
    if (num(this.t) > 0.5) deferPositions(this, snap);
    return r;
  };

  /* Caminhada durante a bola morta. Roda DEPOIS do passo original para que o
     alvo de bola parada prevaleça sobre o alvo tático normal — sem isso,
     `_movePlayers` recalcularia o destino a cada quadro e o jogador nunca
     chegaria ao posto do escanteio. */
  var oldStep = P.step;
  P.step = function (dt) {
    var r = oldStep.apply(this, arguments);
    var teams = this.teams || [];
    var step = Math.max(1 / 240, Math.min(0.15, num(dt, 1 / 30)));
    var dead = num(this.dead) > 0;
    for (var i = 0; i < teams.length; i++) {
      var pl = teams[i].players || [];
      for (var j = 0; j < pl.length; j++) {
        var p = pl[j];
        if (!p || !p.__spTarget) continue;
        if (!dead || p.red) { p.__spTarget = null; continue; }
        var t = p.__spTarget;
        var dx = t.x - num(p.x), dy = t.y - num(p.y);
        var d = Math.hypot(dx, dy);
        var max = num(p.maxSpd, 7) * WALK_SPEED * step;
        if (d <= max || d < 1e-6) {
          p.x = t.x; p.y = t.y; p.__spTarget = null;
          p.vx = 0; p.vy = 0;
        } else {
          p.x += dx / d * max;
          p.y += dy / d * max;
          p.vx = dx / d * num(p.maxSpd, 7) * WALK_SPEED;
          p.vy = dy / d * num(p.maxSpd, 7) * WALK_SPEED;
        }
      }
    }
    return r;
  };
})(typeof window !== 'undefined' ? window : globalThis);
