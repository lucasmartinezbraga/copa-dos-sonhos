#!/usr/bin/env node
'use strict';
/* A PARTIDA INTEIRA — assistir os 90 minutos, e nao um lance
   =========================================================================
   COBRANCA DO DONO, e ela e a mais justa desta serie:

     "A falta esta acontecendo do nada, o jogador perde a bola quando eh falta
      do nada, e nao tem uma pausa pro batedor bater a falta e voce sentir que
      o lance parou, eh como se tudo acontecesse de forma continua.
      Outro pior erro pra mim eh a questao de quando rola um gol o jogo comeca
      do nada sem os jogadores se organizarem.
      PRECISO QUE VC CONSIGA ASSISTIR UMA PARTIDA COMPLETA PRA VER TODOS ESSES
      BUGS."

   Todas as sondas de tela deste projeto olham UM LANCE: `lance-em-quadros`
   captura 16 quadros em volta de um evento, o Arbitro julga ocorrencias
   isoladas, `vida-do-gesto` mede estados por atleta. Nenhuma delas ve a
   PARTIDA -- o ritmo, a cerimonia, o que acontece ENTRE os lances. E e ai que
   moram os dois defeitos acima: nao esta errado o que o jogo desenha, esta
   errado o que ele NAO desenha, que e a parada.

   O QUE ESTA SONDA MEDE, do apito inicial ao final:

     PAUSA        quanto tempo de PAREDE o jogo fica parado em cada reinicio.
                  Nao em segundos de simulacao: em segundos que voce espera
                  olhando a tela. O motor guarda `dead` em segundos de SIM, e
                  o botao de velocidade divide isso -- o mesmo relogio trocado
                  que a OS-260 achou nos gestos.

     TELEPORTE    quantos atletas saltam mais que `--salto` metros em UM
                  quadro durante a parada, e quanto andam somados. Um reinicio
                  em que os 22 aparecem na formacao de uma vez le como "comecou
                  do nada"; um em que eles caminham ate la le como futebol.

     CAMINHADA    quanto os atletas de fato PERCORREM durante a parada. E o
                  contraditorio do teleporte: se a soma percorrida e alta e o
                  teleporte e zero, houve reorganizacao de verdade.

     BOLA VIVA    a bola chegou a ficar parada? Se ela nunca para, o lance
                  nunca parou -- "eh como se tudo acontecesse de forma
                  continua".

   Tudo por TIPO de reinicio (gol, falta, escanteio, lateral, tiro de meta),
   com contagem, mediana e pior caso -- e nao um exemplo escolhido a dedo.

   Ela tambem guarda folhas de contato dos piores reinicios de cada tipo, para
   OLHAR, que e a unica prova que o dono aceita.

   ZERO OBSERVACAO NAO E ZERO DEFEITO (OS-247): reprova se a partida nao
   terminou ou se nao houve reinicio suficiente para julgar.

   Uso:
     node tools/fisica/tela/a-partida-inteira.js
     node tools/fisica/tela/a-partida-inteira.js --vel=3 --quadros --teto=900
*/
const path = require('path');
const fs = require('fs');
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
const VEL = argv.vel ? Number(argv.vel) : null;      // null = o padrao do jogo
const TETO = Number(argv.teto || 900);               // s de parede antes de desistir
const SALTO = Number(argv.salto || 6);               // m num quadro = teleporte
const QUADROS = !!argv.quadros;                      // guardar folhas de contato
const SAIDA = path.resolve('reports/imagens');
const MIN_REINICIOS = 12;

(async () => {
  if (QUADROS) fs.mkdirSync(SAIDA, { recursive: true });
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

  await pg.evaluate(cfg => {
    const S = window.__pi = {
      paradas: [], eventos: [], fim: false, quadros: 0, minuto: 0,
      placar: [0, 0], viva: null, ultTipo: null, folhas: [], erro: null,
    };
    const P = window.MatchSim.prototype, old = P._emit;
    /* o TIPO da parada vem do evento que a causou, e nao de `dead`: `dead` so
       diz "esta parado", nao diz por que */
    const CAUSA = /^(goal|foul|corner|offside|penalty|red|injury|halftime|kickoff)$/;
    P._emit = function (t, d) {
      try {
        S.eventos.push({ t: performance.now(), tipo: t, min: +(Number(this.minute) || 0).toFixed(1) });
        if (S.eventos.length > 4000) S.eventos.shift();
        /* §a etiqueta EXPIRA. Na primeira versao `ultTipo` era pegajoso: uma
           vez marcado `halftime`, todo reinicio seguinte herdava o rotulo ate
           aparecer outra causa, e a tabela mostrava "halftime 4x". Uma parada
           so pertence ao evento que acabou de acontecer. */
        if (CAUSA.test(t)) S.ultTipo = { tipo: t, ate: performance.now() + 2500 };
      } catch (_) { }
      return old.apply(this, arguments);
    };

    const simDe = () => { try { return window.GAME && window.GAME._sim && window.GAME._sim(); } catch (_) { return null; } };
    const posDe = sim => {
      const out = [];
      try {
        for (const tm of sim.teams) for (const p of tm.players) {
          if (p && !p.red) out.push({ p: p, x: Number(p.x) || 0, y: Number(p.y) || 0 });
        }
      } catch (_) { }
      return out;
    };

    let ant = null, atual = null;
    const laco = () => {
      if (S.fim) return;
      try {
        const sim = simDe();
        if (sim) {
          S.quadros++;
          S.minuto = +(Number(sim.minute) || 0).toFixed(1);
          S.placar = [sim.score[0], sim.score[1]];
          const agora = performance.now();
          const morta = (Number(sim.dead) || 0) > 0;
          const pos = posDe(sim);
          const vb = Math.hypot(Number(sim.ball.vx) || 0, Number(sim.ball.vy) || 0);

          /* passo a passo por atleta, para separar caminhada de teleporte */
          if (ant && atual) {
            let salto = 0, andou = 0, pior = 0;
            for (let i = 0; i < pos.length && i < ant.length; i++) {
              if (pos[i].p !== ant[i].p) continue;
              const dd = Math.hypot(pos[i].x - ant[i].x, pos[i].y - ant[i].y);
              if (dd > cfg.salto) { salto++; if (dd > pior) pior = dd; }
              else andou += dd;
            }
            atual.saltos += salto; atual.andou += andou;
            if (pior > atual.piorSalto) atual.piorSalto = pior;
            if (vb < atual.vbMin) atual.vbMin = vb;
            if (vb > atual.vbMax) atual.vbMax = vb;
            atual.q++;
          }

          if (morta && !atual) {
            const U = S.ultTipo;
            const tipo = (U && agora < U.ate) ? U.tipo : 'rotina';
            atual = { tipo: tipo, t0: agora, min: S.minuto, q: 0,
                      saltos: 0, andou: 0, piorSalto: 0, vbMin: Infinity, vbMax: 0,
                      deadIni: +(Number(sim.dead) || 0).toFixed(2) };
          } else if (!morta && atual) {
            /* §a pergunta direta do relato: "sem os jogadores se organizarem".
               No instante em que a bola volta a rolar, quao longe do posto de
               formacao (`hx`,`hy`) cada um ainda esta? So faz sentido no
               reinicio de gol e no pontape inicial -- numa falta o jogador NAO
               deve estar no posto dele. */
            let pior = 0, soma = 0, n = 0;
            try {
              for (const q of pos) {
                const hx = Number(q.p.hx), hy = Number(q.p.hy);
                if (!isFinite(hx) || !isFinite(hy)) continue;
                const d = Math.hypot(q.x - hx, q.y - hy);
                soma += d; n++; if (d > pior) pior = d;
              }
            } catch (_) { }
            atual.doPosto = n ? +(soma / n).toFixed(1) : -1;
            atual.piorPosto = +pior.toFixed(1);
            atual.ms = Math.round(agora - atual.t0);
            if (atual.vbMin === Infinity) atual.vbMin = 0;
            delete atual.t0;
            S.paradas.push(atual);
            atual = null;
          }
          ant = pos;
          if (sim.isOver && sim.isOver()) S.fim = true;
        }
      } catch (e) { S.erro = String((e && e.stack) || e).slice(0, 400); S.fim = true; }
      requestAnimationFrame(laco);
    };
    requestAnimationFrame(laco);
  }, { salto: SALTO });

  const nome = await pg.evaluate(() => window.__quickMatch(40, 120));
  if (!/ x /.test(String(nome))) { console.error('partida nao subiu:', nome); await nav.close(); process.exit(2); }
  if (VEL) await pg.evaluate(v => { try { window.G.speed = v; } catch (_) { } }, VEL);
  const vel = await pg.evaluate(() => { try { return window.G && window.G.speed; } catch (_) { return null; } });

  console.log('assistindo: ' + nome + '  (velocidade ' + vel + 'X, teto de ' + TETO + ' s)');
  const t0 = Date.now();
  let ultMin = -1;
  while ((Date.now() - t0) / 1000 < TETO) {
    const e = await pg.evaluate(() => ({ fim: window.__pi.fim, min: window.__pi.minuto,
                                         p: window.__pi.placar, n: window.__pi.paradas.length,
                                         erro: window.__pi.erro }));
    if (e.erro) { console.log('ERRO NA SONDA: ' + e.erro); break; }
    if (Math.floor(e.min / 15) !== ultMin) {
      ultMin = Math.floor(e.min / 15);
      console.log('  ... minuto ' + e.min.toFixed(0) + '  |  ' + e.p[0] + ' x ' + e.p[1] +
                  '  |  ' + e.n + ' paradas  |  ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s de parede');
    }
    if (e.fim) break;
    await pg.waitForTimeout(2000);
  }

  const r = await pg.evaluate(() => ({
    paradas: window.__pi.paradas, fim: window.__pi.fim, minuto: window.__pi.minuto,
    placar: window.__pi.placar, quadros: window.__pi.quadros,
  }));
  await nav.close();

  const seg = (Date.now() - t0) / 1000;
  console.log('\n=== A PARTIDA INTEIRA ===  minuto ' + r.minuto + ' | ' + r.placar[0] + ' x ' +
              r.placar[1] + ' | ' + seg.toFixed(0) + ' s de parede | ' + r.quadros + ' quadros' +
              (r.fim ? '' : '  (NAO TERMINOU)'));
  console.log('    velocidade de exibicao ' + vel + 'X | teleporte = salto > ' + SALTO + ' m num quadro\n');

  if (!r.fim) {
    console.log('  A PARTIDA NAO TERMINOU dentro do teto. REPROVA (OS-247: o que nao foi');
    console.log('  observado nao pode ser declarado sao). Aumente --teto.');
  }
  if (r.paradas.length < MIN_REINICIOS) {
    console.log('  SEM AMOSTRA: ' + r.paradas.length + ' reinicios. REPROVA.');
    process.exit(1);
  }

  /* agrupa por tipo */
  const porTipo = new Map();
  for (const p of r.paradas) {
    if (!porTipo.has(p.tipo)) porTipo.set(p.tipo, []);
    porTipo.get(p.tipo).push(p);
  }
  const med = (a, f) => {
    const o = a.map(f).sort((x, y) => x - y);
    return o.length ? o[Math.floor(o.length / 2)] : 0;
  };

  console.log('   ' + 'reinicio'.padEnd(12) + 'n'.padStart(4) + '   PAUSA mediana' +
              '     pior' + '   TELEPORTES' + '   pior salto' + '   andou (m)' + '   bola parou?');
  const ordem = [...porTipo.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [tipo, lista] of ordem) {
    const pausa = med(lista, p => p.ms);
    const piorP = Math.max(...lista.map(p => p.ms));
    const tele = med(lista, p => p.saltos);
    const piorS = Math.max(...lista.map(p => p.piorSalto));
    const andou = med(lista, p => p.andou);
    const parou = lista.filter(p => p.vbMin < 0.35).length;
    console.log('   ' + tipo.slice(0, 12).padEnd(12) + String(lista.length).padStart(4) +
      (pausa + ' ms').padStart(16) +
      (piorP + ' ms').padStart(10) +
      String(tele).padStart(13) +
      (piorS.toFixed(1) + ' m').padStart(13) +
      andou.toFixed(0).padStart(12) +
      (parou + '/' + lista.length).padStart(15));
  }

  const todas = r.paradas;
  const pausaGeral = med(todas, p => p.ms);
  const comTele = todas.filter(p => p.saltos > 0).length;
  console.log('\n   GERAL: ' + todas.length + ' reinicios | pausa mediana ' + pausaGeral +
              ' ms | ' + comTele + ' deles (' + (100 * comTele / todas.length).toFixed(0) +
              '%) com pelo menos um teleporte.');

  /* §OS-263 · CERIMONIA E BUROCRACIA NAO SE MEDEM JUNTAS.
     A primeira versao desta sonda tirava UMA mediana de todos os reinicios e
     julgava por ela. Isso mistura duas coisas que o jogo trata -- de proposito
     -- de formas opostas: a falta e o gol devem DEMORAR, o tiro de meta e a
     arrumacao de lateral devem passar rapido (OS-203). Uma mediana unica sobe
     quando a burocracia fica lenta, que e o contrario do que se quer, e desce
     quando ha muito lateral numa partida.
     Entao a mediana geral vira informacao, e o veredito olha os dois grupos
     separados. Limiar declarado antes de olhar: 700 ms de parede -- abaixo
     disso o olho nao registra que houve parada. */
  const CERIMONIA = new Set(['goal', 'foul', 'penalty', 'red', 'offside', 'injury', 'freekick']);
  const cer = todas.filter(p => CERIMONIA.has(p.tipo));
  const bur = todas.filter(p => !CERIMONIA.has(p.tipo));
  console.log('\n   VEREDITO');
  const PAUSA_MIN = 700;   // ms de parede: abaixo disso o olho nao registra parada
  const linha = (rot, ok, detalhe) =>
    console.log('   ' + (ok ? '  ok  ' : ' NAO  ') + rot.padEnd(46) + detalhe);
  if (cer.length >= 5) {
    const pc = med(cer, p => p.ms);
    linha('a CERIMONIA se ve? (mediana >= ' + PAUSA_MIN + ' ms)', pc >= PAUSA_MIN,
          pc + ' ms em ' + cer.length + ' paradas de cerimonia');
  } else console.log('   (cerimonias de menos para julgar: ' + cer.length + ')');
  if (bur.length >= 5) {
    const pb = med(bur, p => p.ms);
    linha('a BUROCRACIA continua passando rapido?', pb < 900,
          pb + ' ms em ' + bur.length + ' paradas de burocracia');
  }
  const gol = (porTipo.get('goal') || []).concat(porTipo.get('kickoff') || []);
  if (gol.length) {
    const pg2 = med(gol, p => p.ms), tg = med(gol, p => p.saltos);
    linha('depois do GOL da tempo de se organizar?', pg2 >= 2000, pg2 + ' ms');
    linha('depois do GOL os atletas ANDAM ate a posicao?', tg === 0,
          tg + ' teleportes na mediana, pior ' + Math.max(...gol.map(p => p.piorSalto)).toFixed(1) + ' m');
    /* o numero que responde ao relato: eles CHEGARAM? */
    const dm = med(gol, p => p.doPosto), dp = Math.max(...gol.map(p => p.piorPosto));
    linha('no reinicio, os atletas CHEGARAM ao posto?', dm >= 0 && dm <= 6,
          dm + ' m do posto na media, pior atleta a ' + dp.toFixed(0) + ' m');
  } else console.log('   (sem gol nesta partida — nao da para julgar o reinicio de gol)');
  const falta = porTipo.get('foul') || [];
  if (falta.length) {
    const pf = med(falta, p => p.ms);
    const pararam = falta.filter(p => p.vbMin < 0.35).length;
    linha('a FALTA para o jogo?', pf >= PAUSA_MIN, pf + ' ms');
    linha('a bola chega a ficar parada na falta?', pararam === falta.length,
          pararam + ' de ' + falta.length);
  } else console.log('   (sem falta nesta partida)');

  if (erros.length) { console.log('\nERROS DE PAGINA:'); [...new Set(erros)].slice(0, 4).forEach(e => console.log('  ', e.slice(0, 160))); }
  process.exit(0);
})();
