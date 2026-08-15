#!/usr/bin/env node
'use strict';
/* VALIDACAO DE LANCE — falta, roubada de bola e lateral, do motor ate a tela
   -------------------------------------------------------------------------
   Nao mede "media por partida": mede se CADA ocorrencia obedece as regras que
   o proprio jogo diz seguir. Um agregado dentro da faixa esconde lance
   individual quebrado -- e lance quebrado e o que o dono ve.

   Cada invariante e verificado por ocorrencia e reportado como
   "N de M cumpriram". O que falha vira contagem, com o pior caso.

   FALTA
     F1  toda falta vira reinicio (bola morta + reinicio pendente)
     F2  a bola termina no ponto da falta
     F3  o batedor esta NA bola quando a cobranca sai
     F4  falta direta perto do gol arma barreira a 9,15 m
     F5  quem sofreu ganha o gesto de falta na tela
     F6  o batedor nao salta no quadro da cobranca

   ROUBADA DE BOLA
     R1  `tackle` troca a posse de verdade
     R2  `tackle_missed` deixa a bola com quem levava E atrasa o defensor
     R3  quem perdeu a bola ganha o gesto de perda na tela
     R4  a bola nao teleporta no desarme

   SAIDA DE BOLA APOS GOL  (relato do dono: "depois que rola o gol o jogo
   comeca do nada com os jogadores espalhados no campo")
     G1  no pontape, cada time esta na PROPRIA metade
     G2  no pontape, cada atleta esta perto do seu posto de formacao
     G3  no pontape, o circulo central so tem quem tem de estar

   LATERAL
     L1  bola na linha lateral vira lateral do time adversario ao ultimo toque
     L2  a bola e reposta SOBRE a linha
     L3  o cobrador chega a bola antes da reposicao
     L4  a reposicao entra em campo (nao sai de novo no mesmo lance)
     L5  o cobrador nao salta para a bola

   TRES ARMADILHAS DE MEDICAO, que a primeira versao desta sonda caiu em todas.
   Ficam escritas porque cada uma produziu um numero convincente e ERRADO:

     · A GEOMETRIA NAO PEGA A SAIDA. Observar `ball.y` na borda antes e depois
       do passo perde quase todo lateral, porque o motor detecta E resolve a
       saida dentro do MESMO passo. A primeira versao contou 1 lateral em 61
       minutos; a bateria mede 15,98 por partida. O gatilho e o evento
       (`throw_in`) e o envelope e `_ballOut`, nao a posicao da bola.

     · A MARCA DO BATEDOR MORRE ANTES DA COBRANCA. As camadas de espera limpam
       `__cdsTakerWait` assim que ele chega, e so DEPOIS `dead` expira: no
       quadro do reinicio ela ja nao existe. Medir por ela devolve ZERO
       amostra -- nao "tudo certo", zero. O batedor tem de ser lembrado.

     · `_setPieceRole` NAO IDENTIFICA A BARREIRA. Ele marca zona, marcacao,
       cobertura e contra-ataque tambem. Pegar o adversario mais proximo entre
       todos que o carregam mede o MARCADOR em cima da bola e acusa "barreira
       a 0,60 m" que nao existe. A barreira de verdade esta em
       `__os36Guard.wall`, e so ela vale.

   Uso: node tools/fisica/tela/validar-lances.js [bundle.html] [--segundos=N]
*/

const path = require('path');
const { pathToFileURL } = require('url');

function carregarPlaywright() {
  for (const cand of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(cand); } catch (_) { /* tenta o proximo */ }
  }
  console.error('playwright nao encontrado; sonda pulada');
  process.exit(0);
}

const { chromium } = carregarPlaywright();
const argv = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
const alvo = path.resolve(process.argv.slice(2).find(a => !a.startsWith('--')) || 'dist/index.html');
const SEGUNDOS = Number(argv.segundos || 240);

(async () => {
  const navegador = await chromium.launch({
    headless: true,
    ...(process.env.CDS_CHROMIUM ? { executablePath: process.env.CDS_CHROMIUM } : {}),
    args: ['--no-sandbox'],
  });
  const pagina = await navegador.newPage({ viewport: { width: 1366, height: 768 } });
  const erros = [];
  pagina.on('pageerror', e => erros.push(String(e)));
  await pagina.goto(pathToFileURL(alvo).href, { waitUntil: 'load', timeout: 120000 });
  await pagina.waitForTimeout(1500);

  await pagina.evaluate(() => {
    const P = window.MatchSim.prototype;
    const FLv = window.FL || 105, FWv = window.FW || 68;
    const V = window.__val = {
      falta: { n: 0, F1: [0, 0], F2: [0, 0], F3: [0, 0], F4: [0, 0], F5: [0, 0], F6: [0, 0],
               piorF2: 0, piorF3: 0, piorF6: 0, barreiraDist: [] },
      roubada: { tackles: 0, R1: [0, 0], R2: [0, 0], R3: [0, 0], R4: [0, 0],
                 missed: 0, piorR4: 0 },
      lateral: { n: 0, execucoes: 0, L1: [0, 0], L2: [0, 0], L3: [0, 0], L4: [0, 0], L5: [0, 0],
                 piorL2: 0, piorL3: 0, piorL5: 0, pendenteL4: null },
      gestoVisto: Object.create(null),
      ultBatedor: null,
      saida: { n: 0, G1: [0, 0], G2: [0, 0], G3: [0, 0],
               piorG1: 0, piorG2: 0, foraDeCasa: [], distCasa: [] },
      golPendente: null,
    };
    const ok = (par, cond) => { par[1]++; if (cond) par[0]++; };
    const dist = (a, b, c, d) => Math.hypot(a - c, b - d);

    /* ---- estados DESENHADOS por atleta, para os invariantes de tela ---- */
    const F = Object.assign({}, window.CDS_F25D);
    const vistoPor = Object.create(null);   // chave -> {estado: ultimoT}
    const origBody = F.body;
    F.body = function (ctx, o) {
      try {
        const A = window.__CDS_ANIM_BY_KEY && window.__CDS_ANIM_BY_KEY[o.key];
        if (A && A.state) {
          (vistoPor[o.key] || (vistoPor[o.key] = Object.create(null)))[A.state] = performance.now();
        }
      } catch (_) { }
      return origBody.apply(this, arguments);
    };
    window.CDS_F25D = F;
    const chaveDe = p => (p.team != null ? p.team : '?') + ':' +
      ((p.ref && (p.ref.id != null ? 'i' + p.ref.id : p.ref.n)) || p.n || ('#' + (p.num || 0)));
    /* um gesto conta como visto se apareceu na tela nos ultimos 2,5 s de parede */
    const viu = (p, est) => {
      const m = vistoPor[chaveDe(p)];
      return !!(m && m[est] && performance.now() - m[est] < 2500);
    };

    /* ---------------------------------------------------------- FALTA ---- */
    let faltaAberta = null;
    const oldEmit = P._emit;
    P._emit = function (type, data) {
      const r = oldEmit.apply(this, arguments);
      try {
        if (type === 'foul' && data && data.on) {
          V.falta.n++;
          faltaAberta = { vitima: data.on, autor: data.by,
                          x: data.on.x, y: data.on.y, t: this.t, checadoF5: false };
        }
        if (type === 'goal') { V.golPendente = { t: this.t }; }
        if (type === 'tackle' && data && data.by) {
          V.roubada.tackles++;
          /* R1: a posse tem de ficar com o time de quem desarmou. Vale tanto
             dono novo quanto bola solta empurrada por ele (o poke). */
          const b = this.ball;
          const trocou = (b.owner && b.owner.team === data.by.team) ||
                         (!b.owner && b.lastTouch === data.by);
          ok(V.roubada.R1, trocou);
          if (data.on) {
            V.roubada.pendenteR3 = { p: data.on, t: performance.now() };
          }
        }
        /* L4: `throw_in` e a reposicao SAINDO. Checa 1,2 s depois se a bola
           entrou em campo em vez de sair de novo no mesmo lance. */
        if (type === 'throw_in') {
          V.lateral.execucoes++;
          V.lateral.pendenteL4 = { t: this.t };
        }
        if (type === 'tackle_missed' && data && data.by) {
          V.roubada.missed++;
          /* R2: quem levava segue com ela, e o defensor pagou atraso */
          const b = this.ball;
          const seguiu = !!(b.owner && data.on && b.owner === data.on);
          const atrasado = Number(data.by._beatenUntil) > Number(this.t);
          ok(V.roubada.R2, seguiu && atrasado);
        }
      } catch (_) { }
      return r;
    };

    /* --------------------------------------------------------- LATERAL ---- */
    /* O envelope da saida e `_ballOut`: e a unica hora em que o ultimo toque
       ainda e o de quem colocou a bola fora. Depois disso o motor ja resolveu. */
    let lateralAberto = null;
    const oldBallOut = P._ballOut;
    if (typeof oldBallOut === 'function') {
      P._ballOut = function () {
        const b = this.ball;
        const ehLateral = b && b.x > 0 && b.x < FLv && (b.y <= 0.05 || b.y >= FWv - 0.05);
        const toque = b ? b.lastTouch : null;
        const r = oldBallOut.apply(this, arguments);
        try {
          if (ehLateral && toque) {
            V.lateral.n++;
            const bat = this.__cdsTakerWait && this.__cdsTakerWait.taker;
            ok(V.lateral.L1, !!bat && bat.team !== toque.team);
            const naLinha = Math.min(this.ball.y, FWv - this.ball.y);
            ok(V.lateral.L2, naLinha <= 1.2);
            V.lateral.piorL2 = Math.max(V.lateral.piorL2, naLinha);
            lateralAberto = { t: this.t };
          }
        } catch (_) { }
        return r;
      };
    }

    const oldStep = P.step;
    P.step = function (dt) {
      const b = this.ball;
      const antesDead = this.dead > 0;
      const bxA = b ? b.x : 0, byA = b ? b.y : 0;
      const donoA = b ? b.owner : null;
      /* O BATEDOR TEM DE SER LEMBRADO. As camadas de espera limpam
         `__cdsTakerWait` assim que ele chega e so DEPOIS `dead` expira: no
         quadro da cobranca a marca ja nao existe, e medir por ela devolve
         zero amostra. Guarda-se o ultimo conhecido enquanto a bola esta morta. */
      const w = this.__cdsTakerWait;
      if (w && w.taker) V.ultBatedor = { p: w.taker, ax: w.x, ay: w.y };
      const _ub = V.ultBatedor;
      const batAntes = (_ub && antesDead) ? { p: _ub.p, x: _ub.p.x, y: _ub.p.y, ax: _ub.ax, ay: _ub.ay } : null;

      const r = oldStep.apply(this, arguments);

      try {
        /* --- G1/G2/G3: o pontape depois do gol --- */
        if (V.golPendente && antesDead && !(this.dead > 0)) {
          const gp = V.golPendente; V.golPendente = null;
          if (this.t - gp.t < 60) {
            V.saida.n++;
            let foraDeMetade = 0, piorMetade = 0, somaCasa = 0, nCasa = 0, piorCasa = 0, noCirculo = 0;
            for (const tm of this.teams) {
              /* `attackDir > 0` ataca para x crescente, entao a propria metade
                 e a de x menor. E a mesma convencao de `_kickoff`. */
              const paraDireita = (tm.attackDir || 1) > 0;
              for (const q of tm.players) {
                if (!q || q.red) continue;
                const naPropria = paraDireita ? q.x <= FLv / 2 + 0.5 : q.x >= FLv / 2 - 0.5;
                if (!naPropria) {
                  foraDeMetade++;
                  const excesso = paraDireita ? q.x - FLv / 2 : FLv / 2 - q.x;
                  piorMetade = Math.max(piorMetade, excesso);
                }
                /* posto de formacao: `dhx/dhy` e a casa defensiva que o motor
                   ja calcula; `hx/hy` e a queda quando ela nao existe */
                const hx = Number.isFinite(q.dhx) ? q.dhx : q.hx;
                const hy = Number.isFinite(q.dhy) ? q.dhy : q.hy;
                if (Number.isFinite(hx) && Number.isFinite(hy)) {
                  const d = dist(q.x, q.y, hx, hy);
                  somaCasa += d; nCasa++; piorCasa = Math.max(piorCasa, d);
                }
                if (dist(q.x, q.y, FLv / 2, FWv / 2) < 9.15) noCirculo++;
              }
            }
            ok(V.saida.G1, foraDeMetade === 0);
            V.saida.piorG1 = Math.max(V.saida.piorG1, piorMetade);
            V.saida.foraDeCasa.push(foraDeMetade);
            /* G2: "perto do posto" = 6 m. Acima disso o time nao esta armado,
               esta espalhado -- que e exatamente o relato. */
            ok(V.saida.G2, nCasa > 0 && piorCasa <= 6);
            V.saida.piorG2 = Math.max(V.saida.piorG2, piorCasa);
            if (nCasa) V.saida.distCasa.push(+(somaCasa / nCasa).toFixed(2));
            /* G3: o circulo e do time que bate; 2 e o maximo tolerado */
            ok(V.saida.G3, noCirculo <= 2);
          }
        }
        if (V.golPendente && this.t - V.golPendente.t > 60) V.golPendente = null;
        /* --- F1: a falta abriu reinicio? --- */
        if (faltaAberta && !faltaAberta.f1) {
          faltaAberta.f1 = true;
          ok(V.falta.F1, this.dead > 0 || !!this.pendingRestart);
          /* F4: a barreira e a lista que a OS-36 montou, e so ela. Adiada
             para quando ela existir: ela e armada depois, com o jogo parado. */
          faltaAberta.esperaBarreira = true;
        }
        /* --- F4: guarda a barreira; ela e MEDIDA na cobranca, nao aqui.
           Desde a R18.99 a barreira CAMINHA ate os 9,15 m em vez de ser
           teleportada. Medir no instante em que `__os36Guard` nasce le a
           posicao de ONDE ELES ESTAVAM -- foi assim que a versao anterior
           acusou "barreira a 0,29 m" que nao existe. O que importa e onde ela
           esta quando a bola sai. --- */
        if (faltaAberta && !faltaAberta.wall) {
          const g = this.__os36Guard;
          if (g && g.wall && g.wall.length) faltaAberta.wall = g.wall;
        }
        /* --- F5: o gesto de falta apareceu para quem sofreu? --- */
        if (faltaAberta && !faltaAberta.checadoF5 && this.t - faltaAberta.t > 0.25) {
          faltaAberta.checadoF5 = true;
          ok(V.falta.F5, viu(faltaAberta.vitima, 'fouled') || viu(faltaAberta.vitima, 'get_up'));
        }
        /* --- F2/F3/F6 no quadro da cobranca --- */
        if (antesDead && !(this.dead > 0) && batAntes) {
          const bat = batAntes.p;
          const salto = dist(bat.x, bat.y, batAntes.x, batAntes.y);
          const teto = (bat.maxSpd || 7) * 1.18 * Math.max(1 / 240, Math.min(0.15, dt)) + 0.12;
          const naBola = dist(bat.x, bat.y, this.ball.x, this.ball.y);
          if (faltaAberta) {
            if (faltaAberta.wall && faltaAberta.wall.length) {
              const d = faltaAberta.wall.map(q => dist(q.x, q.y, this.ball.x, this.ball.y))
                .sort((a, c) => a - c)[0];
              V.falta.barreiraDist.push(+d.toFixed(2));
              ok(V.falta.F4, d >= 8.6);   // 9,15 m com folga de execucao
            }
            ok(V.falta.F2, dist(this.ball.x, this.ball.y, faltaAberta.x, faltaAberta.y) <= 2.0);
            V.falta.piorF2 = Math.max(V.falta.piorF2, dist(this.ball.x, this.ball.y, faltaAberta.x, faltaAberta.y));
            ok(V.falta.F3, naBola <= 1.5); V.falta.piorF3 = Math.max(V.falta.piorF3, naBola);
            ok(V.falta.F6, salto <= teto); V.falta.piorF6 = Math.max(V.falta.piorF6, salto);
            faltaAberta = null; V.ultBatedor = null;
          } else if (lateralAberto) {
            ok(V.lateral.L3, naBola <= 1.5); V.lateral.piorL3 = Math.max(V.lateral.piorL3, naBola);
            ok(V.lateral.L5, salto <= teto); V.lateral.piorL5 = Math.max(V.lateral.piorL5, salto);
            lateralAberto = null; V.ultBatedor = null;
          } else V.ultBatedor = null;
        }
        /* --- L4: a reposicao entrou em campo? --- */
        const pl4 = V.lateral.pendenteL4;
        if (pl4 && this.t - pl4.t > 1.2) {
          ok(V.lateral.L4, this.ball.y > 0.05 && this.ball.y < FWv - 0.05);
          V.lateral.pendenteL4 = null;
        }
        /* --- R3: o gesto de perda apareceu para quem foi desarmado? --- */
        const pr3 = V.roubada.pendenteR3;
        if (pr3 && performance.now() - pr3.t > 700) {
          ok(V.roubada.R3, viu(pr3.p, 'dribble_failure') || viu(pr3.p, 'lose_control') ||
                           viu(pr3.p, 'body_duel'));
          V.roubada.pendenteR3 = null;
        }
        /* --- R4: a bola nao teleporta no desarme --- */
        if (b && donoA && b.owner && b.owner !== donoA) {
          const salto = dist(b.x, b.y, bxA, byA);
          ok(V.roubada.R4, salto <= 3.0);
          V.roubada.piorR4 = Math.max(V.roubada.piorR4, salto);
        }
      } catch (_) { }
      return r;
    };
  });

  const nome = await pagina.evaluate(() => window.__quickMatch(40, 120));
  if (!/ x /.test(String(nome))) { console.error('partida nao subiu:', nome); await navegador.close(); process.exit(2); }
  await pagina.waitForTimeout(SEGUNDOS * 1000);
  const V = await pagina.evaluate(() => ({ v: window.__val, minuto: window.GAME._sim().minute }));
  await navegador.close();

  const v = V.v;
  const linha = (nome, par, extra) => {
    const [a, b] = par;
    const pc = b ? (100 * a / b) : 0;
    const marca = !b ? ' --' : (a === b ? ' ok' : (pc >= 90 ? 'ATN' : 'BAI'));
    console.log('   ' + marca + '  ' + nome.padEnd(52), b ? (a + '/' + b).padStart(9) : '    (0)',
      b ? (pc.toFixed(1) + '%').padStart(7) : '', extra || '');
  };
  console.log('\n=== VALIDACAO DE LANCE ===\n');
  console.log('bundle:', alvo, '| minuto de jogo:', V.minuto.toFixed(1));

  console.log('\nFALTA  (' + v.falta.n + ' ocorrencias)');
  linha('F1 vira reinicio', v.falta.F1);
  linha('F2 bola no ponto da falta (<=2,0 m)', v.falta.F2, 'pior ' + v.falta.piorF2.toFixed(2) + ' m');
  linha('F3 batedor NA bola na cobranca (<=1,5 m)', v.falta.F3, 'pior ' + v.falta.piorF3.toFixed(2) + ' m');
  linha('F4 barreira a 9,15 m', v.falta.F4,
    v.falta.barreiraDist.length ? 'menor ' + Math.min(...v.falta.barreiraDist).toFixed(2) + ' m' : '');
  linha('F5 gesto de falta em quem sofreu', v.falta.F5);
  linha('F6 batedor nao salta na cobranca', v.falta.F6, 'pior ' + v.falta.piorF6.toFixed(2) + ' m');

  console.log('\nROUBADA DE BOLA  (' + v.roubada.tackles + ' desarmes, ' + v.roubada.missed + ' errados)');
  linha('R1 desarme troca a posse', v.roubada.R1);
  linha('R2 bote errado: bola fica e defensor atrasa', v.roubada.R2);
  linha('R3 gesto de perda em quem foi desarmado', v.roubada.R3);
  linha('R4 bola nao teleporta na troca (<=3,0 m)', v.roubada.R4, 'pior ' + v.roubada.piorR4.toFixed(2) + ' m');

  const media = a => a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : '—';
  console.log('\nSAIDA DE BOLA APOS GOL  (' + v.saida.n + ' ocorrencias)');
  linha('G1 cada time na propria metade', v.saida.G1,
    'pior invasao ' + v.saida.piorG1.toFixed(1) + ' m | fora de metade, media ' + media(v.saida.foraDeCasa) + ' jogadores');
  linha('G2 todos perto do posto de formacao (<=6 m)', v.saida.G2,
    'pior ' + v.saida.piorG2.toFixed(1) + ' m | distancia media ao posto ' + media(v.saida.distCasa) + ' m');
  linha('G3 circulo central so com quem deve', v.saida.G3);

  console.log('\nLATERAL  (' + v.lateral.n + ' saidas, ' + v.lateral.execucoes + ' reposicoes executadas)');
  linha('L1 posse para o adversario do ultimo toque', v.lateral.L1);
  linha('L2 bola reposta sobre a linha (<=1,2 m)', v.lateral.L2, 'pior ' + v.lateral.piorL2.toFixed(2) + ' m');
  linha('L3 cobrador na bola na reposicao (<=1,5 m)', v.lateral.L3, 'pior ' + v.lateral.piorL3.toFixed(2) + ' m');
  linha('L4 a reposicao entra em campo', v.lateral.L4);
  linha('L5 cobrador nao salta para a bola', v.lateral.L5, 'pior ' + v.lateral.piorL5.toFixed(2) + ' m');

  console.log('');
  if (erros.length) { console.log('ERROS DE PAGINA:'); erros.slice(0, 5).forEach(e => console.log('  ', e)); }
  process.exit(0);
})();
