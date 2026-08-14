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

   LATERAL
     L1  bola na linha lateral vira lateral do time adversario ao ultimo toque
     L2  a bola e reposta SOBRE a linha
     L3  o cobrador chega a bola antes da reposicao
     L4  a reposicao entra em campo (nao sai de novo no mesmo lance)
     L5  o cobrador nao salta para a bola

   LIMITES CONHECIDOS DESTA VERSAO — leia antes de acreditar num numero baixo.
   Tres invariantes ainda nao sao medidos de forma confiavel, e a saida marca
   isso com "(0)" em vez de fingir aprovacao:

     · F2/F3/F6 e L3/L5 (o quadro da cobranca). As camadas de espera limpam
       `__cdsTakerWait` assim que o batedor chega, e so DEPOIS `dead` expira:
       no quadro do reinicio a marca ja nao existe. Tem de lembrar o ultimo
       batedor, como `passada-parada.js` faz.

     · A CONTAGEM DE LATERAL esta errada, e sei porque conferi contra a
       bateria: ela mede 15,98 lateral por partida e esta sonda pegou 1 em
       61 minutos. O motor detecta e resolve a saida DENTRO do mesmo passo,
       entao observar `ball.y` na borda antes e depois do passo perde quase
       todas. O gatilho tem de ser o evento, nao a geometria.

     · F4 (barreira) seleciona todo adversario com `_setPieceRole`, e esse
       campo marca marcador e zona tambem, nao so a barreira. A distancia
       minima que ela reporta pode ser um marcador em cima da bola, nao a
       barreira mal posicionada. Precisa distinguir o papel.

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
      lateral: { n: 0, L1: [0, 0], L2: [0, 0], L3: [0, 0], L4: [0, 0], L5: [0, 0],
                 piorL2: 0, piorL3: 0, piorL5: 0 },
      gestoVisto: Object.create(null),
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

    /* ------------------------------------------------- LATERAL + passo ---- */
    let lateralAberto = null, ultimoToqueAntes = null;
    const oldStep = P.step;
    P.step = function (dt) {
      const b = this.ball;
      const antesDead = this.dead > 0;
      const bxA = b ? b.x : 0, byA = b ? b.y : 0;
      const donoA = b ? b.owner : null;
      const w = this.__cdsTakerWait;
      const batAntes = w && w.taker ? { p: w.taker, x: w.taker.x, y: w.taker.y, ax: w.x, ay: w.y } : null;
      const ultToque = b ? b.lastTouch : null;
      /* fora pela lateral? guarda o ultimo toque ANTES de o motor resolver */
      const foraLat = b && !antesDead && (b.y <= 0.02 || b.y >= FWv - 0.02) && b.x > 0 && b.x < FLv;
      if (foraLat && ultToque) ultimoToqueAntes = { p: ultToque, x: b.x, y: b.y, t: this.t };

      const r = oldStep.apply(this, arguments);

      try {
        /* --- F1: a falta abriu reinicio? --- */
        if (faltaAberta && !faltaAberta.f1) {
          faltaAberta.f1 = true;
          ok(V.falta.F1, this.dead > 0 || !!this.pendingRestart);
          /* F4: se armou barreira, a que distancia da bola ela ficou? */
          const adv = this.teams[1 - faltaAberta.vitima.team].players
            .filter(p => p && !p.red && !p.isGK && p._setPieceRole);
          if (adv.length) {
            const d = adv.map(p => dist(p.x, p.y, this.ball.x, this.ball.y))
              .sort((a, c) => a - c)[0];
            V.falta.barreiraDist.push(+d.toFixed(2));
            ok(V.falta.F4, d >= 8.6);   // 9,15 com folga de execucao
          }
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
            ok(V.falta.F2, dist(this.ball.x, this.ball.y, faltaAberta.x, faltaAberta.y) <= 2.0);
            V.falta.piorF2 = Math.max(V.falta.piorF2, dist(this.ball.x, this.ball.y, faltaAberta.x, faltaAberta.y));
            ok(V.falta.F3, naBola <= 1.5); V.falta.piorF3 = Math.max(V.falta.piorF3, naBola);
            ok(V.falta.F6, salto <= teto); V.falta.piorF6 = Math.max(V.falta.piorF6, salto);
            faltaAberta = null;
          } else if (lateralAberto) {
            ok(V.lateral.L3, naBola <= 1.5); V.lateral.piorL3 = Math.max(V.lateral.piorL3, naBola);
            ok(V.lateral.L5, salto <= teto); V.lateral.piorL5 = Math.max(V.lateral.piorL5, salto);
            lateralAberto.cobrou = this.t;
          }
        }
        /* --- L1/L2: nasceu um lateral? --- */
        if (ultimoToqueAntes && !lateralAberto && this.dead > 0 && this.__cdsTakerWait) {
          const t = ultimoToqueAntes; ultimoToqueAntes = null;
          const bat = this.__cdsTakerWait.taker;
          V.lateral.n++;
          ok(V.lateral.L1, !!bat && bat.team !== t.p.team);
          const naLinha = Math.min(this.ball.y, FWv - this.ball.y);
          ok(V.lateral.L2, naLinha <= 1.2); V.lateral.piorL2 = Math.max(V.lateral.piorL2, naLinha);
          lateralAberto = { y: this.ball.y, t: this.t, cobrou: 0 };
        }
        if (ultimoToqueAntes && this.t - ultimoToqueAntes.t > 3) ultimoToqueAntes = null;
        /* --- L4: a reposicao entrou em campo? --- */
        if (lateralAberto && lateralAberto.cobrou && this.t - lateralAberto.cobrou > 1.2) {
          const dentro = this.ball.y > 0.05 && this.ball.y < FWv - 0.05;
          ok(V.lateral.L4, dentro);
          lateralAberto = null;
        }
        /* --- R3: o gesto de perda apareceu para quem foi desarmado? --- */
        const pr3 = V.roubada.pendenteR3;
        if (pr3 && performance.now() - pr3.t > 400) {
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

  console.log('\nLATERAL  (' + v.lateral.n + ' ocorrencias)');
  linha('L1 posse para o adversario do ultimo toque', v.lateral.L1);
  linha('L2 bola reposta sobre a linha (<=1,2 m)', v.lateral.L2, 'pior ' + v.lateral.piorL2.toFixed(2) + ' m');
  linha('L3 cobrador na bola na reposicao (<=1,5 m)', v.lateral.L3, 'pior ' + v.lateral.piorL3.toFixed(2) + ' m');
  linha('L4 a reposicao entra em campo', v.lateral.L4);
  linha('L5 cobrador nao salta para a bola', v.lateral.L5, 'pior ' + v.lateral.piorL5.toFixed(2) + ' m');

  console.log('');
  if (erros.length) { console.log('ERROS DE PAGINA:'); erros.slice(0, 5).forEach(e => console.log('  ', e)); }
  process.exit(0);
})();
