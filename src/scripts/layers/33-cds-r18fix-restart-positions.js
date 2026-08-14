
/* Copa dos Sonhos — Correção de reinícios (aditiva, não toca o núcleo).
   Quatro sintomas, uma causa: em todo reinício o batedor era TELEPORTADO ao
   ponto e o lance disparava num `dead` curto — ninguém andava até a bola nem
   havia pausa real.

   1) TRANSIÇÕES (intervalo/prorrogação/2º tempo): _switchSides espelha as
      posições, deixando o time que atacava com jogadores dentro do campo
      adversário (medido: 5 jogadores até ~30 m além do meio). Aqui cada time é
      confinado ao PRÓPRIO campo no kickoff de transição.
   2) LATERAL, 3) FALTA, 4) ESCANTEIO: o batedor passa a ser um jogador que ANDA
      até a bola, e o lance ESPERA ele chegar (pausa real) antes de executar.
   `dead` é limitado por reinício para não distorcer a proporção jogo/bola-parada
   (o relógio de jogo não corre em bola morta). */
(function (root) {
  'use strict';
  var M = root && root.MatchSim; if (!M || !M.prototype) return;
  var P = M.prototype; if (P.__cdsRestartFix) return; P.__cdsRestartFix = true;
  var V = '5.9.6-R18.15.4-restart-fix';
  var FL = Number(root.FL) || 105, FW = Number(root.FW) || 68, HALF = FL / 2, MARGIN = 1.5;
  var WALK = 6.5;            // m/s de caminhada (mesma da camada de bola parada)
  var num = function (v, d) { return (typeof v === 'number' && isFinite(v)) ? v : (d || 0); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var dist = function (ax, ay, bx, by) { return Math.hypot(num(ax) - num(bx), num(ay) - num(by)); };

  // ===== BUG 1: transições sem invasão ======================================
  function confineOwnHalf(sim, exceptTaker) {
    for (var i = 0; i < sim.teams.length; i++) {
      var tm = sim.teams[i], dir = tm.attackDir;      // >0 ataca +x → campo próprio x<HALF
      for (var j = 0; j < tm.players.length; j++) {
        var p = tm.players[j];
        if (p.red) continue;
        if (exceptTaker && p === sim.ball.owner) continue;
        p.__spTarget = null;
        var hx = num(p.dhx, p.hx), hy = num(p.dhy, p.hy);
        if (dir > 0) hx = Math.min(hx, HALF - MARGIN); else hx = Math.max(hx, HALF + MARGIN);
        p.x = hx; p.y = hy; p.vx = 0; p.vy = 0;
      }
      tm.phase = 0;
    }
  }
  var switchAt = -1;
  var oldSwitch = P._switchSides;
  P._switchSides = function () { var r = oldSwitch.apply(this, arguments); switchAt = num(this.t); confineOwnHalf(this, false); return r; };
  var oldKick = P._kickoff;
  P._kickoff = function () {
    var r = oldKick.apply(this, arguments);
    if (switchAt >= 0 && num(this.t) - switchAt < 30) confineOwnHalf(this, true);
    return r;
  };

  // ===== BUGS 2-4: batedor anda até a bola e o lance espera ele ==============
  /* Arma a caminhada do batedor até `spot` e segura o reinício até a chegada
     (ou até `maxWait` s). `basePause` garante uma pausa mínima mesmo quando o
     batedor já está no ponto. `ballTo` cola a bola no ponto (não no batedor que
     está a caminho). */
  function armTaker(sim, taker, spotX, spotY, basePause, maxWait, ballTo) {
    if (!taker) return;
    spotX = clamp(spotX, 1, FL - 1); spotY = clamp(spotY, 1, FW - 1);
    taker.__spTarget = { x: spotX, y: spotY };        // caminha (camada de bola parada anda por passo)
    var d = dist(taker.x, taker.y, spotX, spotY);
    var need = basePause + d / WALK;
    sim.dead = Math.max(num(sim.dead), Math.min(maxWait, need));
    if (ballTo) { sim.ball.owner = null; sim.ball.traveling = false; sim.ball.x = spotX; sim.ball.y = spotY; sim.ball.z = 0; sim.ball.vx = sim.ball.vy = sim.ball.vz = 0; }
    sim.__cdsTakerWait = { taker: taker, x: spotX, y: spotY, until: num(sim.t) + Math.min(maxWait, need) };
  }

  /* §R18.35 · A FALTA COMUM PASSA A SER COBRADA. 94,7% das faltas caíam num
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
          /* §D37 · QUEM SOFREU A FALTA NAO COBRA — e por isso ninguem caminhava.
             O filtro escolhia o jogador MAIS PROXIMO do ponto da falta, e o
             ponto da falta E a posicao da vitima: o mais proximo era ela mesma,
             a 0,0 m. Com d=0 o `armTaker` calcula `need = 1 + 0/6,5 = 1 s` e
             nao ha caminhada nenhuma — o juiz apita e a bola sai quase junto.
             E literalmente o defeito que a R18.35 foi escrita para consertar
             ("distancia mediana 0,0 m"), reintroduzido pelo criterio de escolha.

             Medido na tela (tools/fisica/tela/bolaparada.js), antes:
                 falta    dead 0,82 s   cobrador a 0,00 m, velocidade 0
                 escanteio dead 4,75 s  cobrador a 26,65 m, caminha e chega

             Agora a vitima sai da lista: um companheiro caminha ate a bola, e a
             pausa passa a ser proporcional a distancia, como no escanteio e no
             lateral. Ela volta a ser candidata so se nao houver mais ninguem. */
          var elegiveis = tm.players.filter(function (p) {
            return p && !p.red && !p.isGK && p !== victim;
          });
          if (!elegiveis.length) elegiveis = tm.players.filter(function (p) { return p && !p.red; });
          var cand = elegiveis.sort(function (m, n2) {
            return dist(m.x, m.y, sx, sy) - dist(n2.x, n2.y, sx, sy);
          })[0] || victim;
          armTaker(this, cand, sx, sy, 1, 3.4, true);
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

  // O passo segura o reinício: enquanto o batedor não chegar (e dentro do teto),
  // mantém `dead` vivo para o pendingRestart não disparar sem o batedor.
  var oldStep = P.step;
  P.step = function () {
    var r = oldStep.apply(this, arguments);
    // transição: reancora ao próprio campo enquanto a bola está morta
    if (switchAt >= 0) { if (num(this.dead) > 0) confineOwnHalf(this, true); else switchAt = -1; }
    // espera do batedor
    var w = this.__cdsTakerWait;
    if (w) {
      if (!this.pendingRestart) { this.__cdsTakerWait = null; }
      else if (num(this.dead) <= 0.05) {
        /* OS-77 · 1,6 m liberava o reinicio antes de o pe chegar a bola. */
        var arrived = dist(w.taker.x, w.taker.y, w.x, w.y) <= 0.75 || w.taker.red;
        if (arrived || num(this.t) >= w.until) { this.__cdsTakerWait = null; }   // libera: dead expira → cobra
        else { this.dead = 0.12; }                                                // ainda vindo: segura
      }
    }
    return r;
  };

  // --- LATERAL (bug 2): batedor = jogador de campo mais próximo, que anda -----
  var oldBallOut = P._ballOut;
  P._ballOut = function () {
    var b = this.ball;
    var isThrow = num(b.x) > 0 && num(b.x) < FL && (num(b.y) <= 0 || num(b.y) >= FW);
    var lastTeam = b.lastTouch ? b.lastTouch.team : this.poss;
    var r = oldBallOut.apply(this, arguments);
    if (isThrow) {
      var to = 1 - lastTeam, spotX = clamp(num(b.x), 1, FL - 1), spotY = clamp(num(b.y), 1, FW - 1);
      var cand = null, cd = 1e9, list = this.teams[to].players;
      for (var k = 0; k < list.length; k++) { var p = list[k]; if (p.red || p.isGK) continue; var dd = dist(p.x, p.y, spotX, spotY); if (dd < cd) { cd = dd; cand = p; } }
      if (cand) {
        var sim = this;
        armTaker(this, cand, spotX, spotY, 0.6, 3.2, true);
        this.pendingRestart = function () { cand.x = spotX; cand.y = spotY; cand.__spTarget = null; sim._giveBall(cand); cand.settle = 0.5; };
      }
    }
    return r;
  };

  /* Envolve o pendingRestart para GARANTIR que o batedor está no ponto exato no
     instante da cobrança (snap final) — mesmo que a caminhada não tenha
     terminado, o lance sai do lugar certo (não do meio do caminho). */
  function snapTakerBeforeRestart(sim, taker, spotX, spotY) {
    var pr = sim.pendingRestart;
    if (!pr) return;
    sim.pendingRestart = function () { taker.x = spotX; taker.y = spotY; taker.__spTarget = null; return pr(); };
  }

  // --- FALTA (bug 3): batedor anda até a bola; pausa real antes de cobrar -----
  var oldFree = P._freeKick;
  P._freeKick = function (team, x, y, input) {
    // fotografa o time ANTES: o núcleo vai teleportar o batedor para (x,y).
    var snap = null;
    if (input == null && typeof team === 'number') {
      snap = new Map();
      var pl0 = this.teams[team].players;
      for (var s = 0; s < pl0.length; s++) if (!pl0[s].red) snap.set(pl0[s], [num(pl0[s].x), num(pl0[s].y)]);
    }
    var r = oldFree.apply(this, arguments);
    if (snap) {
      var spotX = clamp(num(x), 1, FL - 1), spotY = clamp(num(y), 1, FW - 1);
      // batedor = jogador do time agora mais próximo do ponto (o núcleo o pôs lá)
      /* §OS-87 · a MARCA manda; a proximidade e so o desempate.
         Eleger "o mais proximo do ponto" so funciona quando o nucleo
         teleportou o batedor para la, o que ele faz no ramo `crossed` e NAO
         faz no `direct`. Sem esta preferencia, quem caminhava ate a bola era
         a vitima da falta e quem chutava era outro, a 9,162 m de distancia
         (mediana medida em 28 cobrancas). Mesma convencao do escanteio. */
      var taker = null, cd = 1e9, list = this.teams[team].players;
      for (var k0 = 0; k0 < list.length; k0++) {
        var pm = list[k0];
        if (pm && !pm.red && !pm.isGK && pm._setPieceRole === 'taker') { taker = pm; break; }
      }
      if (!taker) for (var k = 0; k < list.length; k++) { var p = list[k]; if (p.red || p.isGK) continue; var dd = dist(p.x, p.y, spotX, spotY); if (dd < cd) { cd = dd; taker = p; } }
      if (taker) {
        var old = snap.get(taker);
        if (old) { taker.x = old[0]; taker.y = old[1]; }   // devolve à origem → ANDA até a bola
        /* §OS-87 · ponto de APROXIMACAO, 1,4 m atras da bola na linha
           bola->gol. Quem bate falta chega por tras dela, olhando para a
           meta; parar em cima do ponto fazia o corpo cobrir a propria bola.
           A bola continua sendo colocada no ponto exato pelo `armTaker`. */
        var _o87g = this.teams[team] && this.teams[team].oppGoal;
        var _o87x = spotX, _o87y = spotY;
        if (_o87g) {
          var _vx = _o87g.x - spotX, _vy = _o87g.y - spotY;
          var _vl = Math.max(0.6, Math.hypot(_vx, _vy));
          _o87x = clamp(spotX - _vx / _vl * 1.4, 1, FL - 1);
          _o87y = clamp(spotY - _vy / _vl * 1.4, 1, FW - 1);
        }
        armTaker(this, taker, spotX, spotY, 0.8, 4.0, true);
        taker.__spTarget = { x: _o87x, y: _o87y };
        if (this.__cdsTakerWait) { this.__cdsTakerWait.x = _o87x; this.__cdsTakerWait.y = _o87y; }
        snapTakerBeforeRestart(this, taker, _o87x, _o87y);
      }
    }
    return r;
  };

  // --- ESCANTEIO (bug 4): batedor VAI à bandeirinha e cobra de lá -------------
  var oldCorner = P._setCorner;
  P._setCorner = function () {
    var r = oldCorner.apply(this, arguments);
    // o núcleo marcou o batedor com _setPieceRole='taker' e pôs a bola na bandeirinha.
    var taker = null, tm;
    for (var i = 0; i < this.teams.length; i++) { tm = this.teams[i]; for (var j = 0; j < tm.players.length; j++) { if (tm.players[j]._setPieceRole === 'taker') { taker = tm.players[j]; break; } } if (taker) break; }
    if (taker) {
      var spotX = num(this.ball.x, taker.x), spotY = num(this.ball.y, taker.y);
      armTaker(this, taker, spotX, spotY, 0.8, 5.0, true);   // janela maior: o batedor sempre chega
      snapTakerBeforeRestart(this, taker, spotX, spotY);      // e cobra da bandeirinha
    }
    return r;
  };

  root.CDS_R18_RESTART_FIX = Object.freeze({ version: V, transitionConfine: true, takerWalksTo: ['throwin', 'freekick', 'corner'] });
})(typeof window !== 'undefined' ? window : globalThis);
