#!/usr/bin/env node
'use strict';
/* O ARBITRO — o lance e futebol de verdade, ou so nao esta quebrado?
   =========================================================================
   Relato do dono: "voce ainda nao tem um mecanismo bom o suficiente para
   avaliar se o lance e futebol de verdade ou nao".

   Ele esta certo, e ha prova: por uma rodada inteira a maquina de estados de
   animacao esteve DESLIGADA -- um `ReferenceError` por quadro, engolido por um
   `catch` mudo, deixava os 22 atletas sem gesto nenhum. Passaram por cima
   disso, sem acusar nada:

       tools/verify.py            (sintaxe e reprodutibilidade)
       tests/browser_smoke.js     (o jogo sobe)
       tools/fisica/bateria.js    (13 metricas de design)
       tools/fisica/tela/*.js     (continuidade quadro a quadro)

   Todos mediam COISAS QUE CONTINUAVAM CERTAS. Nenhum perguntava se o que esta
   na tela e coerente com o que o motor diz estar acontecendo.

   E dessa pergunta que esta sonda trata. Ela nao mede media, nao mede
   suavidade: ela confronta CAMADAS que precisam concordar, e trata desacordo
   como defeito com exemplo nomeado.

     0. A SONDA ENXERGA      antes de afirmar "nenhum defeito", provar que
                             estava olhando. Zero observacao nao e zero
                             defeito -- foi exatamente assim que o bug de hoje
                             sobreviveu.
     1. O GESTO E O CORPO    o gesto desenhado nao pode mentir sobre a
                             cinematica: correr parado, parar correndo.
     2. O EVENTO E O GESTO   todo lance do motor com autor (passe, chute,
                             desarme, falta, defesa) tem de virar gesto no
                             autor numa janela em torno dele. A janela e
                             SIMETRICA (-0,55 s a +0,35 s) porque a sequencia
                             comeca antes de a bola sair, e o passe se ancora
                             na SAIDA (`_startTravel`), nao em `_emit('pass')`
                             — que e a chegada. Ler as duas notas no codigo
                             antes de mexer nos numeros: as duas nasceram de
                             medicao errada.
     3. A BOLA TEM DONO      posse que troca a distancia, bola orfa parada em
                             campo, bola acelerando sem ninguem perto, bola
                             fora do campo com o jogo vivo.
     4. OS CORPOS OCUPAM ESPACO   dois atletas no mesmo ponto nao e futebol.
     5. A FASE ANDA          estado que dura e fase que nao anda e quadro
                             congelado com nome de animacao.

   Cada item vira "cumpriu N de M" com exemplo do pior caso. O veredito final e
   REPROVADO se qualquer item passar do seu limite declarado -- e os limites
   estao no codigo, nao na cabeca de quem le.

   PROVA DA PROPRIA SONDA: `--autoteste` desliga de proposito a publicacao do
   estado de animacao — a mesma pane da OS-247 — e exige REPROVACAO. Sonda que
   nunca foi vista reprovar um defeito conhecido nao esta provada.

   Uso: node tools/fisica/tela/arbitro.js [bundle.html] [--segundos=180]
        node tools/fisica/tela/arbitro.js dist/index.html --segundos=45 --autoteste
*/
const path = require('path');
const { pathToFileURL } = require('url');
function carregarPlaywright() {
  for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(c); } catch (_) { }
  }
  console.error('playwright nao encontrado; sonda pulada'); process.exit(0);
}
const { chromium } = carregarPlaywright();
const argv = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
const alvo = path.resolve(process.argv.slice(2).find(a => !a.startsWith('--')) || 'dist/index.html');
const SEGUNDOS = Number(argv.segundos || 180);

(async () => {
  const nav = await chromium.launch({
    headless: true,
    ...(process.env.CDS_CHROMIUM ? { executablePath: process.env.CDS_CHROMIUM } : {}),
    args: ['--no-sandbox'],
  });
  const pg = await nav.newPage({ viewport: { width: 1366, height: 768 } });
  const erros = [];
  pg.on('pageerror', e => erros.push(String(e)));
  await pg.goto(pathToFileURL(alvo).href, { waitUntil: 'load', timeout: 120000 });
  await pg.waitForTimeout(1200);

  await pg.evaluate(() => {
    const A = window.__arb = {
      passos: 0, tempo: 0, desenhos: 0, comEstado: 0, atletas: Object.create(null),
      erroAmostragem: null,
      mentira: { amostras: 0, falhas: 0, tipos: Object.create(null) },
      teleporte: { n: 0, pior: 0, amostras: 0 },
      cadeia: {},                       // familia -> {n, ok, exemplos:[]}
      bola: { trocas: 0, longe: 0, piorLonge: 0, orfa: 0, orfaPior: 0,
              fantasma: 0, piorFantasma: 0, fora: 0, foraPior: 0, amostras: 0 },
      corpos: { amostras: 0, sobrepostos: 0, piorPar: null, episodios: 0 },
      fase: { episodios: 0, congelados: 0, pior: 0 },
    };

    /* chave de desenho: A MESMA que a ponte publica e que CDS_F25D.body monta.
       Se divergir aqui, a sonda mede zero e chama de "tudo certo". */
    const chaveDe = p => (p.team != null ? p.team : '?') + ':' +
      ((p.ref && (p.ref.id != null ? 'i' + p.ref.id : p.ref.n)) || p.n || ('#' + (p.num || 0)));

    /* ---- 0. observabilidade do desenho ---------------------------------- */
    const F = Object.assign({}, window.CDS_F25D), origBody = F.body;
    F.body = function (ctx, o) {
      try {
        const k = o && o.key;
        if (k) {
          A.desenhos++;
          A.atletas[k] = 1;
          const M = window.__CDS_ANIM_BY_KEY;
          if (M && M[k] && M[k].state) A.comEstado++;
        }
      } catch (_) { }
      return origBody.apply(this, arguments);
    };
    window.CDS_F25D = F;

    /* ---- 2. a corrente evento -> gesto ---------------------------------- */
    /* §A ANCORA DO PASSE NAO E `_emit('pass')`.
       -----------------------------------------------------------------------
       Terceiro erro de medicao desta sonda, e o mais instrutivo: `_emit('pass')`
       esta DENTRO do `onArrive` de `_startTravel` — ou seja, e o evento de
       CHEGADA da bola no companheiro, nao o da saida do pe. Ancorando nele, a
       fita de estados mostrava o gesto de passe completo e correto 1,1 a 2,0 s
       "antes do evento", e a sonda chamava isso de falha:

           -1.30:pass_prepare  -1.13:pass_contact  -1.05:pass_followthrough
           -0.92:pass_recover  -0.77:strafe  ...  0.00:<evento 'pass'>

       Aqueles 1,3 s sao o TEMPO DE VOO da bola. O gesto estava perfeito.
       A saida e `_startTravel(o, alvo, 'pass', ...)`, e e nela que a corrente
       do passe se ancora. */
    const FAMILIA = {
      passe:   { ev: ['__saida_de_passe__'],
                 re: /^(pass_|first_touch_pass|long_pass|cross|gk_throw|gk_kick)/ },
      chute:   { ev: ['shot_taken', 'header_shot', 'penalty', 'low_cross_shot'],
                 re: /^(shot_|placed_shot|power_shot|volley|header)/ },
      desarme: { ev: ['tackle', 'intercept'],
                 re: /^(standing_tackle|slide_tackle|block|body_duel|intercept|press|jockey)/ },
      falta:   { ev: ['foul'], alvo: 'on', re: /^(fouled|get_up)/ },
      defesa:  { ev: ['save', 'gk_claim', 'gk_punch', 'gk_sweep'], alvo: 'gk', re: /^gk_/ },
    };
    const porEvento = Object.create(null);
    for (const f in FAMILIA) {
      A.cadeia[f] = { n: 0, ok: 0, exemplos: [], antecedencia: [] };
      for (const e of FAMILIA[f].ev) porEvento[e] = f;
    }
    const pendentes = [];
    const P = window.MatchSim.prototype;
    const oldEmit = P._emit;
    P._emit = function (tipo, dados) {
      const r = oldEmit.apply(this, arguments);
      try {
        const fam = porEvento[tipo];
        if (fam && dados) {
          const campo = FAMILIA[fam].alvo || 'by';
          const quem = dados[campo];
          if (quem && !quem.red) {
            const k = chaveDe(quem);
            const t0 = Number(this.t) || 0;
            pendentes.push({ fam: fam, tipo: tipo, k: k, t0: t0, ate: t0 + 0.35,
                             visto: false, nome: quem.n || k });
          }
        }
      } catch (_) { }
      return r;
    };

    /* a SAIDA do passe: o quadro em que a bola deixa o pe */
    const oldTravel = P._startTravel;
    if (typeof oldTravel === 'function') {
      P._startTravel = function (o, alvo, kind, onArrive, receiver, passKind, meta) {
        try {
          if (kind === 'pass' && o && !o.red) {
            const t0 = Number(this.t) || 0;
            pendentes.push({ fam: 'passe', tipo: 'saida(' + (passKind || kind) + ')',
                             k: chaveDe(o), t0: t0, ate: t0 + 0.35, visto: false,
                             nome: o.n || chaveDe(o) });
          }
        } catch (_) { }
        return oldTravel.apply(this, arguments);
      };
    }

    /* ---- o passo: tudo que precisa dos dois lados ao mesmo tempo -------- */
    /* O CAMPO E 0..FL x 0..FW, NAO CENTRADO NA ORIGEM. A primeira versao desta
       sonda testou `|x| > FL/2` e acusou "bola fora do campo em 66% dos
       quadros" — que era, literalmente, a metade direita do gramado. O teste
       tem de ser o mesmo do motor (`40-match-engine`, `_ballOut`):
           b.x < -0.5 || b.x > FL+0.5 || b.y < -0.5 || b.y > FW+0.5          */
    const FL = 105, FW = 68;
    const ant = new Map();                 // p -> {x,y}
    let bolaAnt = null, donoAnt = null;
    let orfaDesde = -1, foraDesde = -1;
    const perto = Object.create(null);      // par -> t inicial
    const faseAnt = Object.create(null);    // chave -> {st, ph, desde, mexeu}
    /* HISTORICO DE ESTADO POR ATLETA. Existe por causa de um erro de medicao:
       a sequencia de passe (`pass_prepare -> pass_contact -> ...`) e pedida
       ANTES de a bola sair, e `_emit('pass')` so acontece na SAIDA. Olhando so
       para a frente a partir do evento, o passador ja tinha voltado a correr —
       e a sonda acusou "17% dos passes viram gesto", o oposto da verdade. A
       janela tem de ser simetrica em torno do evento. */
    const histEstado = Object.create(null);
    const ultEstado = Object.create(null);
    const desincronia = Object.create(null);  // chave -> t em que a incoerencia comecou
    const JANELA_ANTES = Number(window.__ARB_ANTES) || 0.55, JANELA_DEPOIS = 0.35;
    const oldStep = P.step;
    P.step = function (dt) {
      const r = oldStep.apply(this, arguments);
      try {
        const _dt = Math.max(1e-3, Number(dt) || 0);
        const t = Number(this.t) || 0;
        A.passos++; A.tempo = t;
        const M = window.__CDS_ANIM_BY_KEY || null;
        if (window.__CDS_ANIM_ERRO && !A.erroAmostragem) A.erroAmostragem = window.__CDS_ANIM_ERRO.primeiro;
        const morta = (Number(this.dead) || 0) > 0;
        const b = this.ball || {};

        const vivos = [];
        for (const tm of this.teams) for (const p of tm.players) if (p && !p.red) vivos.push(p);

        /* 1. o gesto mente sobre o corpo? A velocidade usada e a MESMA que a
           apresentacao ve: deslocamento por quadro, nao `p.vx` do motor. */
        for (const p of vivos) {
          const a0 = ant.get(p);
          const x = Number(p.x) || 0, y = Number(p.y) || 0;
          const v = a0 ? Math.hypot(x - a0[0], y - a0[1]) / _dt : null;
          ant.set(p, [x, y]);
          if (v == null || morta) continue;
          /* RECOLOCACAO ADMINISTRATIVA NAO E GESTO QUE MENTE. Ninguem anda a
             18,9 m/s: quando o deslocamento por quadro implica velocidade
             impossivel, o que houve foi o motor reposicionando o atleta
             (troca de lado, formacao, reinicio) — nao a animacao mentindo. Sao
             coisas diferentes e viram dois numeros diferentes; misturar as
             duas foi o que fez a primeira versao acusar "walk a 18,9 m/s". */
          if (v > 12) { A.teleporte.n++; if (v > A.teleporte.pior) A.teleporte.pior = v; continue; }
          A.teleporte.amostras++;
          const k = chaveDe(p);
          const s = M && M[k];
          if (!s || !s.state) continue;
          if (ultEstado[k] !== s.state) {
            ultEstado[k] = s.state;
            const h = histEstado[k] || (histEstado[k] = []);
            h.push({ t: t, st: s.state });
            while (h.length && h[0].t < t - 3) h.shift();
          }
          /* so estados de LOCOMOCAO entram: gesto de acao pode e deve
             acontecer com o corpo em qualquer velocidade */
          const st = s.state;
          let falha = null;
          if ((st === 'run' || st === 'sprint') && v < 0.8) falha = 'corre parado (' + st + ')';
          else if (st === 'idle' && v > 2.5) falha = 'parado correndo';
          else if (st === 'walk' && v > 5.0) falha = 'anda a ' + v.toFixed(1) + ' m/s';
          if (st === 'idle' || st === 'walk' || st === 'run' || st === 'sprint') {
            A.mentira.amostras++;
            /* A OS-246 segura o gesto de piso por 150 ms de proposito: quem
               para de correr fica em `run` por um instante, e isso e o
               desenho certo, nao mentira. So conta como defeito a
               incoerencia que PERSISTE alem do dobro da permanencia. */
            if (!falha) desincronia[k] = 0;
            else if (!desincronia[k]) { desincronia[k] = t; falha = null; }
            else if (t - desincronia[k] < 0.30) falha = null;
            if (falha) {
              A.mentira.falhas++;
              const rot = falha.replace(/[\d.,]+/g, 'N');
              const T = A.mentira.tipos[rot] || (A.mentira.tipos[rot] = { n: 0, pior: null });
              T.n++;
              /* o pior caso de cada tipo e o mais EXTREMO no sentido do
                 proprio defeito: para "corre parado" e a menor velocidade,
                 para "parado correndo" e a maior */
              const menor = st === 'run' || st === 'sprint';
              if (!T.pior || (menor ? v < T.pior.v : v > T.pior.v)) {
                T.pior = { q: p.n || k, st: st, v: +v.toFixed(2), t: +t.toFixed(1) };
              }
            }
          }

          /* 5. a fase anda? estado que dura com fase parada e quadro morto.
             SO PARA GESTO COM DURACAO: estado ciclico tem `dur = 0` e o
             snapshot devolve `phase = 0` sempre, por construcao — o ciclo da
             perna dele vem da onda do desenhista, nao daqui. A primeira versao
             desta sonda nao separou os dois e acusou "0,7% dos gestos com fase
             avancando", que era a definicao de estado ciclico, nao um defeito. */
          const f0 = faseAnt[k];
          const ph = Number(s.phase) || 0;
          if (s.loop) { faseAnt[k] = null; continue; }
          if (f0 && f0.st === st) {
            if (Math.abs(ph - f0.ph) > 1e-4) f0.mexeu = true;
            const dur = t - f0.desde;
            if (dur > 0.6 && !f0.contado) {
              f0.contado = true; A.fase.episodios++;
              if (!f0.mexeu) { A.fase.congelados++; if (dur > A.fase.pior) A.fase.pior = dur; }
            }
            f0.ph = ph;
          } else {
            faseAnt[k] = { st: st, ph: ph, desde: t, mexeu: false, contado: false };
          }
        }

        /* 2. fecha as pendencias da corrente */
        for (let i = pendentes.length - 1; i >= 0; i--) {
          const q = pendentes[i];
          const s = M && M[q.k];
          const st = s && s.state;
          const re = FAMILIA[q.fam].re;
          if (st && re.test(st)) q.visto = true;
          if (q.visto || t > q.ate) {
            if (!q.visto) {
              /* janela simetrica: o gesto pode ter acontecido ANTES do evento
                 (a sequencia de passe comeca antes de a bola sair) */
              const h = histEstado[q.k] || [];
              for (let j = h.length - 1; j >= 0; j--) {
                if (h[j].t < q.t0 - JANELA_ANTES) break;
                if (h[j].t <= q.t0 + JANELA_DEPOIS && re.test(h[j].st)) {
                  q.visto = true; q.quando = +(h[j].t - q.t0).toFixed(2); break;
                }
              }
            }
            const C = A.cadeia[q.fam];
            C.n++;
            if (q.visto) {
              C.ok++;
              if (q.quando != null) C.antecedencia.push(q.quando);
            } else if (C.exemplos.length < 6) {
              /* NAO BASTA DIZER "ficou em backpedal": para saber se o gesto
                 nunca existiu ou so caiu fora da janela, o exemplo tem de
                 mostrar a FITA de estados em volta do evento. */
              const h = histEstado[q.k] || [];
              const fita = h.filter(e => e.t > q.t0 - 2.5 && e.t < q.t0 + 1.0)
                            .map(e => (e.t - q.t0).toFixed(2) + ':' + e.st).join('  ');
              C.exemplos.push(q.tipo + ' de ' + q.nome + '\n            ' + (fita || '(sem troca de estado na janela de 3,5 s)'));
            }
            pendentes.splice(i, 1);
          }
        }

        /* 3. a bola tem dono, e o dono estava la */
        const bx = Number(b.x) || 0, by = Number(b.y) || 0;
        A.bola.amostras++;
        let dMin = 1e9;
        for (const p of vivos) {
          const d = Math.hypot((Number(p.x) || 0) - bx, (Number(p.y) || 0) - by);
          if (d < dMin) dMin = d;
        }
        if (b.owner !== donoAnt) {
          if (b.owner && !morta) {
            A.bola.trocas++;
            const d = Math.hypot((Number(b.owner.x) || 0) - bx, (Number(b.owner.y) || 0) - by);
            if (d > 3.0) { A.bola.longe++; if (d > A.bola.piorLonge) A.bola.piorLonge = d; }
          }
          donoAnt = b.owner;
        }
        const vb = bolaAnt ? Math.hypot(bx - bolaAnt[0], by - bolaAnt[1]) / _dt : 0;
        const dvb = bolaAnt ? Math.abs(vb - bolaAnt[2]) : 0;
        if (bolaAnt && !morta && dvb > 8 && dMin > 2.5) {
          A.bola.fantasma++; if (dvb > A.bola.piorFantasma) A.bola.piorFantasma = dvb;
        }
        bolaAnt = [bx, by, vb];
        const orfa = !morta && !b.owner && !b.traveling && vb < 0.4;
        if (orfa) { if (orfaDesde < 0) orfaDesde = t; else if (t - orfaDesde > 1.5) { A.bola.orfa++; if (t - orfaDesde > A.bola.orfaPior) A.bola.orfaPior = t - orfaDesde; } }
        else orfaDesde = -1;
        const fora = !morta && (bx < -0.6 || bx > FL + 0.6 || by < -0.6 || by > FW + 0.6);
        if (fora) { if (foraDesde < 0) foraDesde = t; else if (t - foraDesde > 0.5) { A.bola.fora++; if (t - foraDesde > A.bola.foraPior) A.bola.foraPior = t - foraDesde; } }
        else foraDesde = -1;

        /* 4. dois corpos no mesmo ponto */
        if (!morta) {
          A.corpos.amostras++;
          for (let i = 0; i < vivos.length; i++) {
            for (let j = i + 1; j < vivos.length; j++) {
              const p = vivos[i], q = vivos[j];
              const d = Math.hypot((Number(p.x) || 0) - (Number(q.x) || 0),
                                   (Number(p.y) || 0) - (Number(q.y) || 0));
              const par = i + ':' + j;
              if (d < 0.40) {
                if (perto[par] == null) perto[par] = t;
                else if (t - perto[par] > 0.6) {
                  A.corpos.sobrepostos++;
                  if (!A.corpos.piorPar || t - perto[par] > A.corpos.piorPar.dur) {
                    A.corpos.piorPar = { a: p.n || '?', b: q.n || '?', dur: +(t - perto[par]).toFixed(2), d: +d.toFixed(2) };
                  }
                  perto[par] = t;      // conta uma vez a cada 0,6 s de sobreposicao
                }
              } else if (perto[par] != null) delete perto[par];
            }
          }
        }
      } catch (e) { A.erroSonda = String(e).slice(0, 200); }
      return r;
    };
  });

  const nome = await pg.evaluate(() => window.__quickMatch(40, 120));
  if (!/ x /.test(String(nome))) { console.error('partida nao subiu:', nome); await nav.close(); process.exit(2); }

  /* §AUTOTESTE · SONDA QUE NUNCA REPROVOU NADA NAO ESTA PROVADA.
     Com `--autoteste`, a publicacao do estado de animacao e desligada de
     proposito — exatamente o efeito que o `ReferenceError` da OS-247 teve por
     uma rodada inteira. Se o Arbitro nao REPROVAR aqui, ele nao serve de
     portao, e e melhor descobrir isso agora do que na proxima pane. */
  if (argv.autoteste) {
    console.log('\n*** AUTOTESTE: desligando a publicacao de estado de proposito.');
    console.log('*** O Arbitro TEM de reprovar a secao 0. Se aprovar, ele nao serve.\n');
    await pg.evaluate(() => {
      const nada = undefined;
      try { delete window.__CDS_ANIM_BY_KEY; } catch (_) { }
      Object.defineProperty(window, '__CDS_ANIM_BY_KEY', {
        get() { return nada; }, set() { }, configurable: false,
      });
    });
  }
  await pg.waitForTimeout(SEGUNDOS * 1000);
  const R = await pg.evaluate(() => {
    const A = window.__arb;
    return { A: A, atletas: Object.keys(A.atletas).length, minuto: window.GAME._sim().minute };
  });
  await nav.close();

  const A = R.A;
  const reprovas = [];
  const pct = (a, b) => (100 * a / Math.max(1, b));
  const item = (rot, ok, total, limite, extra) => {
    const p = pct(ok, total);
    const bom = total === 0 ? null : p >= limite;
    const marca = total === 0 ? ' -- ' : bom ? ' ok ' : 'FALHA';
    console.log('   [' + marca + '] ' + rot.padEnd(42) + String(ok).padStart(6) + ' de ' +
                String(total).padEnd(7) + (total ? p.toFixed(1) + '%' : 'sem amostra') +
                (extra ? '   ' + extra : ''));
    if (total === 0) reprovas.push('SEM AMOSTRA: ' + rot + ' (a sonda nao viu nada -- isso nao e aprovacao)');
    else if (!bom) reprovas.push(rot + ': ' + p.toFixed(1) + '% (minimo ' + limite + '%)');
  };

  console.log('\n' + '='.repeat(78));
  console.log('O ARBITRO — ' + SEGUNDOS + ' s de partida | minuto ' + R.minuto.toFixed(1) +
              ' | ' + A.passos + ' passos de motor');
  console.log('='.repeat(78));

  console.log('\n 0. A SONDA ENXERGA');
  item('atletas desenhados com estado publicado', A.comEstado, A.desenhos, 95,
       R.atletas + ' atletas distintos');
  if (A.erroAmostragem) {
    console.log('   [FALHA] a amostragem de animacao esta ESTOURANDO:');
    console.log('           ' + A.erroAmostragem.split('\n')[0]);
    reprovas.push('a amostragem de animacao lanca excecao a cada quadro');
  }
  if (A.erroSonda) console.log('   aviso: a propria sonda estourou -> ' + A.erroSonda);

  console.log('\n 1. O GESTO E O CORPO  (o gesto de locomocao nao pode mentir)');
  item('atleta nao teleporta com o jogo vivo',
       A.teleporte.amostras, A.teleporte.amostras + A.teleporte.n, 99.9,
       A.teleporte.pior ? 'pior: ' + A.teleporte.pior.toFixed(1) + ' m/s num quadro' : '');
  item('gesto coerente com a velocidade', A.mentira.amostras - A.mentira.falhas, A.mentira.amostras, 99);
  for (const k in A.mentira.tipos) {
    const T = A.mentira.tipos[k];
    console.log('        ' + String(T.n).padStart(6) + '  ' + k.padEnd(28) +
                (T.pior ? 'pior: ' + T.pior.q + ' a ' + T.pior.v + ' m/s' : ''));
  }

  console.log('\n 2. O EVENTO E O GESTO  (0,35 s para o corpo reconhecer o lance)');
  for (const f in A.cadeia) {
    const C = A.cadeia[f];
    const a = C.antecedencia.slice().sort((x, y) => x - y);
    const med = a.length ? a[Math.floor(a.length / 2)] : null;
    item(f, C.ok, C.n, 90,
         med != null ? 'gesto entra em media ' + (med < 0 ? Math.abs(med) + ' s ANTES' : med + ' s depois') + ' do evento' : '');
    for (const e of C.exemplos) console.log('        ' + e);
  }

  console.log('\n 3. A BOLA TEM DONO');
  item('troca de posse com o dono na bola', A.bola.trocas - A.bola.longe, A.bola.trocas, 98,
       A.bola.piorLonge ? 'pior: ' + A.bola.piorLonge.toFixed(1) + ' m' : '');
  item('quadros sem bola orfa parada', A.bola.amostras - A.bola.orfa, A.bola.amostras, 99.5,
       A.bola.orfaPior ? 'pior: ' + A.bola.orfaPior.toFixed(1) + ' s' : '');
  item('quadros sem aceleracao fantasma', A.bola.amostras - A.bola.fantasma, A.bola.amostras, 99.5,
       A.bola.piorFantasma ? 'pior: ' + A.bola.piorFantasma.toFixed(1) + ' m/s' : '');
  item('quadros com a bola dentro do campo', A.bola.amostras - A.bola.fora, A.bola.amostras, 99.5,
       A.bola.foraPior ? 'pior: ' + A.bola.foraPior.toFixed(1) + ' s' : '');

  console.log('\n 4. OS CORPOS OCUPAM ESPACO');
  item('quadros sem dois atletas no mesmo ponto', A.corpos.amostras - A.corpos.sobrepostos, A.corpos.amostras, 99,
       A.corpos.piorPar ? 'pior: ' + A.corpos.piorPar.a + ' e ' + A.corpos.piorPar.b + ' a ' +
       A.corpos.piorPar.d + ' m por ' + A.corpos.piorPar.dur + ' s' : '');

  console.log('\n 5. A FASE ANDA  (estado que dura com fase parada e quadro congelado)');
  item('gestos com fase avancando', A.fase.episodios - A.fase.congelados, A.fase.episodios, 98,
       A.fase.pior ? 'pior: ' + A.fase.pior.toFixed(1) + ' s parado' : '');

  console.log('\n' + '='.repeat(78));
  if (reprovas.length) {
    console.log('VEREDITO: REPROVADO — ' + reprovas.length + ' item(ns)');
    for (const m of reprovas) console.log('   · ' + m);
  } else {
    console.log('VEREDITO: APROVADO em todos os itens observados.');
  }
  console.log('='.repeat(78));
  if (erros.length) { console.log('\nERROS DE PAGINA:'); [...new Set(erros)].slice(0, 5).forEach(e => console.log('  ', e.slice(0, 160))); }
  if (argv.autoteste) {
    const pegou = reprovas.some(m => /estado publicado|SEM AMOSTRA/.test(m));
    console.log(pegou
      ? '\nAUTOTESTE OK: o Arbitro reprovou a pane que a OS-247 escondeu por uma rodada inteira.'
      : '\nAUTOTESTE FALHOU: o defeito foi injetado e a sonda nao o viu. NAO confie nela.');
    process.exit(pegou ? 0 : 3);
  }
  process.exit(reprovas.length ? 1 : 0);
})();
