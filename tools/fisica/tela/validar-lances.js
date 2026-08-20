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
      falta: { n: 0, F1: [0, 0], F2: [0, 0], F3: [0, 0], F4: [0, 0], F5: [0, 0], F6: [0, 0], F7: [0, 0],
               piorF2: 0, piorF3: 0, piorF6: 0, barreiraDist: [] },
      roubada: { tackles: 0, R1: [0, 0], R2: [0, 0], R3: [0, 0], R4: [0, 0],
                 missed: 0, piorR4: 0 },
      lateral: { n: 0, execucoes: 0, L1: [0, 0], L2: [0, 0], L3: [0, 0], L4: [0, 0], L5: [0, 0],
                 piorL2: 0, piorL3: 0, piorL5: 0, pendenteL4: null },
      /* §3a rodada · O ESCANTEIO PASSA A TER SECAO PROPRIA. Sem ela, o salto
         do batedor de escanteio era contado contra a falta aberta pouco antes
         -- media pela marca `__cdsTakerWait` sem perguntar de QUE lance ela
         era. Era por isso que o F6 acusava "salto de 16,83 m na falta" quando
         a falta estava perfeita e quem saltava era o escanteio. */
      /* E2 mede contra o passo fisico (~0,4 m) e por isso reprova saltos de
         0,42 m que ninguem enxerga. E4 mede o que o dono ve: 2 m de corpo
         aparecendo noutro lugar. Os dois juntos separam rigor de relevancia. */
      escanteio: { n: 0, E1: [0, 0], E2: [0, 0], E3: [0, 0], E4: [0, 0], piorE1: 0, piorE2: 0 },
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

    let faltaAberta = null;
    /* ---- DE QUE LANCE E ESTA ESPERA? -------------------------------------
       `__cdsTakerWait` nasce em quatro rotas com tetos diferentes (falta 1,8 s
       · lateral 3,2 · falta direta 4,0 · escanteio 5,0) e o objeto nao diz de
       qual veio. Marca-se a rota ativa durante a chamada que cria a espera. */
    /* A etiqueta e cravada DENTRO da chamada que cria a espera. Ler uma
       variavel "rota atual" depois do passo devolveria sempre null: o `finally`
       ja a restaurou muito antes de o passo terminar -- a mesma armadilha que
       ja custou uma rodada de medicao nesta sessao. */
    for (const [nome, tag] of [['_awardFoul', 'falta'], ['_freeKick', 'falta'],
                               ['_ballOut', 'lateral'], ['_setCorner', 'escanteio']]) {
      const f = P[nome];
      if (typeof f !== 'function') continue;
      P[nome] = function () {
        const antes = this.__cdsTakerWait;
        const r = f.apply(this, arguments);
        try {
          const w = this.__cdsTakerWait;
          if (w && w !== antes && w.__rota == null) {
            w.__rota = tag;
            /* §3a rodada, 3o erro · A FALTA E AMARRADA A SUA PROPRIA ESPERA.
               Casar "a falta aberta" com "o ultimo batedor" por estado ambiente
               erra sempre que o juiz da vantagem: a falta velha sobrevive e e
               medida contra o reinicio da falta SEGUINTE -- F2 acusou 18,97 m e
               F3 15,72 m de defeito inexistente. Expirar por tempo (30 s) so
               reduz a frequencia do erro. A espera criada DENTRO de _awardFoul
               e, por construcao, a espera daquela falta: amarra-se aqui. */
            if (tag === 'falta') w.__faltaRef = faltaAberta;
            /* §4a rodada, 4o erro · F2/F3 SO VALEM PARA FALTA QUE VIRA
               COBRANCA. `_awardFoul` tem DOIS desfechos, e o motor escreve os
               dois de proposito (:2524):

                   if (dtg < 42 && chance(.92)) { this._freeKick(...); return; }
                   // falta comum: reinicio com posse
                   this.pendingRestart = () => this._giveBall(nearestFieldMate);

               So o primeiro poe a bola NO PONTO da falta. O segundo entrega a
               bola ao companheiro mais proximo, onde quer que ele esteja -- e
               medir "a bola terminou no ponto da falta" nesse caso e cobrar do
               jogo uma regra que ele nao tem.
               Isso deixava F2/F3 BIMODAIS: 23/23 numa passada e 13/15 na
               seguinte, no MESMO build, conforme calhasse de haver falta comum
               na amostra. Duas rodadas anteriores ja tinham perseguido esta
               assinatura como se fosse defeito de posicionamento. */
            if (nome === '_freeKick' && faltaAberta) faltaAberta.viraCobranca = true;
          }
        } catch (_) { }
        return r;
      };
    }

    /* ---------------------------------------------------------- FALTA ---- */
    const oldEmit = P._emit;
    P._emit = function (type, data) {
      const r = oldEmit.apply(this, arguments);
      try {
        if (type === 'foul' && data && data.on) {
          V.falta.n++;
          faltaAberta = { vitima: data.on, autor: data.by,
                          x: data.on.x, y: data.on.y, t: this.t, checadoF5: false,
                          /* §2a rodada · o TEMPO em que a falta nasceu. Se a
                             cobranca sair depois da troca de lado, o campo
                             inteiro esta espelhado e a distancia ao ponto vira
                             34 m de mentira. Foi o que a primeira medicao de
                             90 minutos acusou -- os runs curtos nunca cruzavam
                             o intervalo e por isso nunca mostraram isso. */
                          half: this.half };
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
      /* §2a rodada · A IDENTIDADE DA ESPERA IMPORTA.
         `ultBatedor` era guardado sem amarra: se a falta nao gerava reinicio
         (vantagem), a marca sobrevivia e o PROXIMO reinicio -- de outro lance
         qualquer -- era medido contra a falta velha. Dai "batedor saltou
         15,5 m": nao saltou, sao dois lances diferentes somados.
         Agora a marca guarda o OBJETO da espera; se o motor armar outra, a
         anterior e descartada em vez de contaminar. */
      const w = this.__cdsTakerWait;
      if (w && w.taker) {
        if (!V.ultBatedor || V.ultBatedor.w !== w) {
          V.ultBatedor = { p: w.taker, ax: w.x, ay: w.y, half: this.half, w: w, t0: this.t,
                           rota: w.__rota || '?', falta: w.__faltaRef || null };
          if (w.__rota === 'escanteio') V.escanteio.n++;
        }
      }
      const _ub = V.ultBatedor;
      const batAntes = (_ub && antesDead)
        ? { p: _ub.p, x: _ub.p.x, y: _ub.p.y, ax: _ub.ax, ay: _ub.ay, rota: _ub.rota,
            falta: _ub.falta } : null;

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
        /* uma falta que nao virou reinicio em 30 s de jogo foi vantagem, e nao
           pode ficar esperando para contaminar o proximo lance */
        if (faltaAberta && this.t - faltaAberta.t > 30) faltaAberta = null;
        /* --- F5: o gesto de falta apareceu para quem sofreu? --- */
        if (faltaAberta && !faltaAberta.checadoF5 && this.t - faltaAberta.t > 0.25) {
          faltaAberta.checadoF5 = true;
          ok(V.falta.F5, viu(faltaAberta.vitima, 'fouled') || viu(faltaAberta.vitima, 'get_up'));
        }
        /* --- F2/F3/F6 no quadro da cobranca --- */
        /* descarta o que atravessou a troca de lado: nao e defeito do lance,
           e o campo espelhado entre a marcacao e a cobranca */
        const _mesmoTempo = !V.ultBatedor || V.ultBatedor.half === this.half;
        /* a espera tem de ter nascido DEPOIS da falta que estamos medindo */
        const _daFalta = !faltaAberta || !V.ultBatedor ||
                         V.ultBatedor.t0 >= faltaAberta.t - 0.01;
        if (antesDead && !(this.dead > 0) && batAntes && _mesmoTempo && _daFalta &&
            (!faltaAberta || faltaAberta.half === this.half)) {
          const bat = batAntes.p;
          const salto = dist(bat.x, bat.y, batAntes.x, batAntes.y);
          const teto = (bat.maxSpd || 7) * 1.18 * Math.max(1 / 240, Math.min(0.15, dt)) + 0.12;
          const naBola = dist(bat.x, bat.y, this.ball.x, this.ball.y);
          const _rota = batAntes.rota;
          if (_rota === 'escanteio') {
            /* E1 batedor NA bandeirinha · E2 nao salta · E3 bola na quina */
            ok(V.escanteio.E1, naBola <= 1.5);
            V.escanteio.piorE1 = Math.max(V.escanteio.piorE1, naBola);
            ok(V.escanteio.E2, salto <= teto);
            ok(V.escanteio.E4, salto <= 2.0);
            V.escanteio.piorE2 = Math.max(V.escanteio.piorE2, salto);
            const _qx = Math.min(this.ball.x, FLv - this.ball.x);
            const _qy = Math.min(this.ball.y, FWv - this.ball.y);
            ok(V.escanteio.E3, _qx <= 2.5 && _qy <= 2.5);
            V.ultBatedor = null;
            /* §3a rodada, 2o erro · UMA FALTA ABERTA TEM DE MORRER AQUI.
               Se o lance que reiniciou foi um escanteio, a falta anterior nao
               gerou reinicio (o juiz deu vantagem) e nao vai gerar mais. Antes
               da separacao por rota isso passava despercebido porque o
               escanteio era contado COMO a falta e a limpava. Com a rota
               separada, a falta velha sobrevivia e era casada com o reinicio
               da falta SEGUINTE — medindo a bola nova contra o ponto velho:
               F2 acusou 14,45 m e F3 15,49 m de "defeito" que nao existe. */
            faltaAberta = null;
          } else if (batAntes.falta && _rota === 'falta') {
            if (batAntes.falta.wall && batAntes.falta.wall.length) {
              const d = batAntes.falta.wall.map(q => dist(q.x, q.y, this.ball.x, this.ball.y))
                .sort((a, c) => a - c)[0];
              V.falta.barreiraDist.push(+d.toFixed(2));
              ok(V.falta.F4, d >= 8.6);   // 9,15 m com folga de execucao
            }
            const _fa = batAntes.falta;
            /* §so a falta que virou COBRANCA tem ponto a respeitar; ver acima */
            if (_fa.viraCobranca) {
              ok(V.falta.F2, dist(this.ball.x, this.ball.y, _fa.x, _fa.y) <= 2.0);
              V.falta.piorF2 = Math.max(V.falta.piorF2, dist(this.ball.x, this.ball.y, _fa.x, _fa.y));
              ok(V.falta.F3, naBola <= 1.5); V.falta.piorF3 = Math.max(V.falta.piorF3, naBola);
            }
            ok(V.falta.F6, salto <= teto); V.falta.piorF6 = Math.max(V.falta.piorF6, salto);
            /* o par VISIVEL do F6, como E4 e o par do E2: tirar o estrito do
               portao sem por o visivel no lugar deixaria a falta sem checagem
               de salto nenhuma */
            ok(V.falta.F7, salto <= 2.0);
            faltaAberta = null; V.ultBatedor = null;
          } else if (lateralAberto && _rota === 'lateral') {
            ok(V.lateral.L3, naBola <= 1.5); V.lateral.piorL3 = Math.max(V.lateral.piorL3, naBola);
            ok(V.lateral.L5, salto <= teto); V.lateral.piorL5 = Math.max(V.lateral.piorL5, salto);
            lateralAberto = null; V.ultBatedor = null; faltaAberta = null;
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
  /* §OS-247 · o placar de reprovacao vira CODIGO DE SAIDA. Sonda que sempre
     sai 0 nao serve de portao — e portao e exatamente o que faltava.

     MAS: limiar de 90% sobre denominador 2 nao mede nada. A primeira versao
     deste portao reprovou o build por "F4 barreira a 9,15 m: 50,0%", que era
     UMA barreira de DUAS numa janela de 120 s. Numero de aparencia grave,
     conteudo nenhum.

     Entao ha um piso de amostra. Abaixo dele o invariante fica INCONCLUSIVO —
     e, pela regra da OS-247, inconclusivo NAO e aprovacao: se metade ou mais
     dos invariantes ficar sem amostra, a sonda reprova assim mesmo, pedindo
     uma janela maior em vez de fingir que olhou. */
  const MIN_AMOSTRA = 8;
  /* §RIGOR NAO E RELEVANCIA, e um portao que confunde os dois grita sempre.
     -----------------------------------------------------------------------
     MEDIDO com `tools/fisica/lances.js`, 48 partidas, 1450 cobrancas de falta
     e 557 de escanteio:

         F6 batedor nao salta   1117/1450  77,0% [74,8-79,1]  pior 0,80 m
         F7 nenhum salto VISIVEL  1450/1450  100%  [99,7-100]
         E2 batedor nao salta    399/557   71,6% [67,8-75,2]  pior 1,06 m
         E4 nenhum salto VISIVEL  557/557   100%  [99,3-100]

     Um em cada quatro lances de bola parada termina com um ajuste submetrico
     do batedor -- e ele NUNCA e visivel. F6 e E2 medem o teto de uma passada
     (~0,16 m); F7 e E4 medem o que o dono ve (2 m).

     Um portao que reprova por F6 reprova TODO build, para sempre, por um
     defeito invisivel e estavel -- e portao que grita sempre ensina a ignorar
     reprovacao, que e pior do que nao ter portao. Entao os estritos ficam como
     INFORMACAO (aparecem no painel, com o numero), e quem reprova e o que se
     ve. Se F6 desabar de 77% para 40%, F7 acusa junto -- porque o salto teria
     de crescer para sumir do teto de uma passada e entrar no de 2 m. */
  const SO_INFORMA = new Set(['F6 batedor nao salta na cobranca',
                              'E2 batedor nao salta na cobranca']);
  const reprovas = [], inconclusivos = [];
  let avaliados = 0;   // TODOS os invariantes, nao so os que falharam
  const linha = (nome, par, extra) => {
    const [a, b] = par;
    const pc = b ? (100 * a / b) : 0;
    const pouco = b > 0 && b < MIN_AMOSTRA;
    const marca = SO_INFORMA.has(nome) ? 'inf'
                : !b ? ' --' : pouco ? 'ins' : (a === b ? ' ok' : (pc >= 90 ? 'ATN' : 'BAI'));
    console.log('   ' + marca + '  ' + nome.padEnd(52), b ? (a + '/' + b).padStart(9) : '    (0)',
      b ? (pc.toFixed(1) + '%').padStart(7) : '', extra || '');
    if (!SO_INFORMA.has(nome)) avaliados++;
    if (SO_INFORMA.has(nome)) return;                  // rigor: informa, nao reprova
    if (!b || pouco) inconclusivos.push(nome + ' (' + b + ' amostra' + (b === 1 ? '' : 's') + ')');
    else if (pc < 90) reprovas.push(nome + ' ' + pc.toFixed(1) + '%  (' + a + '/' + b + ')');
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
  linha('F7 nenhum salto VISIVEL (<=2,0 m)', v.falta.F7, 'pior ' + v.falta.piorF6.toFixed(2) + ' m');

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

  console.log('\nESCANTEIO  (' + v.escanteio.n + ' ocorrencias)');
  linha('E1 batedor na bandeirinha (<=1,5 m)', v.escanteio.E1, 'pior ' + v.escanteio.piorE1.toFixed(2) + ' m');
  linha('E2 batedor nao salta na cobranca', v.escanteio.E2, 'pior ' + v.escanteio.piorE2.toFixed(2) + ' m');
  linha('E3 bola na quina do campo (<=2,5 m)', v.escanteio.E3);
  linha('E4 nenhum salto VISIVEL (<=2,0 m)', v.escanteio.E4);

  console.log('');
  /* o denominador e o painel INTEIRO. A primeira versao somava so reprovados e
     inconclusivos e anunciava "9 de 10 sem amostra" num painel de 22 — numero
     que soa catastrofico e nao quer dizer nada. */
  const total = avaliados;
  if (reprovas.length) {
    console.log('REPROVADO em ' + reprovas.length + ' invariante(s) com amostra suficiente:');
    for (const m of reprovas) console.log('   · ' + m);
  } else console.log('nenhum invariante com amostra suficiente ficou abaixo de 90%.');
  if (inconclusivos.length) {
    console.log('\nsem amostra suficiente (minimo ' + MIN_AMOSTRA + ') — NAO conta como aprovacao:');
    for (const m of inconclusivos) console.log('   · ' + m);
    console.log('   rode com --segundos maior para julgar estes.');
  }
  if (erros.length) { console.log('ERROS DE PAGINA:'); erros.slice(0, 5).forEach(e => console.log('  ', e)); }
  /* metade ou mais do painel sem amostra = a janela foi curta demais para
     julgar; reprova pedindo mais tempo, em vez de aprovar sem ter olhado */
  const cego = inconclusivos.length >= Math.ceil(total / 2) && inconclusivos.length > 0;
  if (cego) console.log('\nJANELA CURTA DEMAIS: ' + inconclusivos.length + ' de ' + total +
                        ' invariantes sem amostra. Isso reprova.');
  process.exit((reprovas.length || erros.length || cego) ? 1 : 0);
})();
