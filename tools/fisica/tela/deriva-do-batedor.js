#!/usr/bin/env node
'use strict';
/* DERIVA DO BATEDOR — ele nunca chega, ou chega e depois e levado embora?
   =========================================================================
   Pendencia aberta pelo portao novo: `validar-lances.js` F6 acusa 16 de 19
   cobrancas de falta com salto acima de uma passada, pior 0,56 m. E
   pre-existente (o controle mede 12/14) e a hipotese da OS-248 morreu -- a
   camada de recomposicao so e armada em `_kickoff` e nem roda em falta.

   Antes de propor causa de novo, esta sonda responde a pergunta mais barata
   que separa as duas familias possiveis:

     A. ORCAMENTO CURTO      a distancia a bola cai o tempo todo e ainda e > 0
                             quando a cobranca sai. Ele nunca chegou.
     B. DERIVA               a distancia chega a ~0 e VOLTA A CRESCER antes da
                             cobranca. Alguem o levou embora depois de chegar.

   Sao consertos opostos: (A) pede velocidade ou janela; (B) pede achar o
   escritor. Chutar entre as duas foi exatamente o erro da OS-248.

   A sonda grava, por cobranca, a serie de distancia ao ponto quadro a quadro,
   e classifica. Quando classifica DERIVA, reporta tambem em que instante a
   distancia voltou a subir e quanto ela cresceu -- que e a assinatura para
   procurar o escritor.

   Cuidado ja conhecido (armadilha 4 do briefing): `__cdsTakerWait` some assim
   que o batedor chega, e a cobranca acontece DEPOIS. Medir por ela devolve
   zero amostra. Aqui a marca e LEMBRADA pela sonda -- o que e legitimo para
   medir, e foi ilegitimo quando eu tentei usar isso para corrigir.

   Uso: node tools/fisica/tela/deriva-do-batedor.js [bundle.html] [--segundos=300]
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
const SEGUNDOS = Number(argv.segundos || 300);

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
    const S = window.__db = { lances: [], rotas: Object.create(null) };
    const P = window.MatchSim.prototype;

    /* de que rota veio a espera: a mesma separacao que `validar-lances.js`
       precisou fazer para nao contar o salto do escanteio contra a falta */
    for (const [nome, rota] of [['_awardFoul', 'falta'], ['_freeKick', 'falta'],
                                ['_setCorner', 'escanteio'], ['_throwIn', 'lateral']]) {
      const old = P[nome];
      if (typeof old !== 'function') continue;
      P[nome] = function () {
        const r = old.apply(this, arguments);
        try { this.__dbRota = rota; } catch (_) { }
        return r;
      };
    }

    const oldStep = P.step;
    let atual = null;
    P.step = function (dt) {
      const r = oldStep.apply(this, arguments);
      try {
        const t = Number(this.t) || 0, morta = (Number(this.dead) || 0) > 0;
        const w = this.__cdsTakerWait;
        if (w && w.taker && morta) {
          /* nasce o lance, ou continua o que ja estava */
          if (!atual || atual.taker !== w.taker) {
            atual = { taker: w.taker, alvo: { x: Number(w.x), y: Number(w.y) },
                      rota: this.__dbRota || '?', serie: [], t0: t,
                      nome: w.taker.n || '?' };
          }
        }
        if (atual) {
          const p = atual.taker;
          const d = Math.hypot((Number(p.x) || 0) - atual.alvo.x,
                               (Number(p.y) || 0) - atual.alvo.y);
          atual.serie.push({ t: +(t - atual.t0).toFixed(3), d: +d.toFixed(3) });
          if (atual.serie.length > 4000) atual.serie.shift();
          /* a bola voltou a viver: a cobranca saiu neste quadro */
          if (!morta) {
            atual.dFinal = d;
            /* §2a pergunta · DOIS ALVOS QUE DISCORDAM.
               Se ele chegou no alvo da espera e mesmo assim aparece longe dele
               no quadro do reinicio, alguem o mandou para OUTRO ponto. O
               candidato obvio e `snapTakerBeforeRestart`, que crava o batedor
               no ponto do LANCE. Se o alvo da espera nao for o mesmo ponto, o
               teleporte e a distancia entre os dois -- e nenhum orcamento de
               caminhada conserta isso. */
            const b = this.ball || {};
            atual.bola = { x: Number(b.x) || 0, y: Number(b.y) || 0 };
            atual.dAlvoBola = Math.hypot(atual.alvo.x - atual.bola.x,
                                         atual.alvo.y - atual.bola.y);
            atual.dBatedorBola = Math.hypot((Number(p.x) || 0) - atual.bola.x,
                                            (Number(p.y) || 0) - atual.bola.y);
            if (S.lances.length < 400) S.lances.push(atual);
            S.rotas[atual.rota] = (S.rotas[atual.rota] || 0) + 1;
            atual = null;
          }
        }
      } catch (_) { }
      return r;
    };
  });

  const nome = await pg.evaluate(() => window.__quickMatch(40, 120));
  if (!/ x /.test(String(nome))) { console.error('partida nao subiu:', nome); await nav.close(); process.exit(2); }
  await pg.waitForTimeout(SEGUNDOS * 1000);
  const R = await pg.evaluate(() => ({ L: window.__db.lances, rotas: window.__db.rotas,
                                       minuto: window.GAME._sim().minute }));
  await nav.close();

  console.log('\n=== DERIVA DO BATEDOR ===  minuto', R.minuto.toFixed(1),
              '|', R.L.length, 'cobrancas |', JSON.stringify(R.rotas));

  const familias = { orcamento: [], deriva: [], chegou: [], curto: [] };
  for (const l of R.L) {
    const s = l.serie;
    if (!s || s.length < 3) { familias.curto.push(l); continue; }
    let iMin = 0;
    for (let i = 1; i < s.length; i++) if (s[i].d < s[iMin].d) iMin = i;
    const dMin = s[iMin].d, dFim = s[s.length - 1].d;
    l._dMin = dMin; l._dFim = dFim; l._iMin = iMin;
    l._cresceu = dFim - dMin;
    l._tMin = s[iMin].t;
    if (dFim <= 0.16) familias.chegou.push(l);
    else if (l._cresceu > 0.10) familias.deriva.push(l);
    else familias.orcamento.push(l);
  }

  const fmt = a => a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : '—';
  console.log('\n  CLASSIFICACAO (o salto do reinicio e a distancia que sobrou)');
  console.log('   chegou e ficou (sobra <= 0,16 m):', familias.chegou.length);
  console.log('   ORCAMENTO CURTO (nunca chegou)  :', familias.orcamento.length,
              '| sobra media', fmt(familias.orcamento.map(l => l._dFim)), 'm');
  console.log('   DERIVA (chegou e foi levado)    :', familias.deriva.length,
              '| sobra media', fmt(familias.deriva.map(l => l._dFim)), 'm',
              '| cresceu', fmt(familias.deriva.map(l => l._cresceu)), 'm');
  console.log('   serie curta demais              :', familias.curto.length);

  const piores = R.L.filter(l => l._dFim != null).sort((a, b) => b._dFim - a._dFim).slice(0, 6);
  console.log('\n  OS PIORES, com a serie resumida:');
  for (const l of piores) {
    const s = l.serie;
    const amostra = [];
    const passo = Math.max(1, Math.floor(s.length / 8));
    for (let i = 0; i < s.length; i += passo) amostra.push(s[i].t + 's:' + s[i].d.toFixed(2));
    amostra.push('FIM:' + l._dFim.toFixed(2));
    console.log('   ' + (l.rota + '/' + l.nome).padEnd(22) +
                ' minimo ' + l._dMin.toFixed(2) + ' m em t+' + l._tMin.toFixed(2) + 's' +
                ' -> sobrou ' + l._dFim.toFixed(2) + ' m');
    console.log('        ' + amostra.join('  '));
    if (l.dAlvoBola != null) {
      console.log('        alvo da espera -> bola no reinicio: ' + l.dAlvoBola.toFixed(2) + ' m' +
                  '   |   batedor -> bola: ' + l.dBatedorBola.toFixed(2) + ' m' +
                  (Math.abs(l.dAlvoBola - l._dFim) < 0.5 && l.dBatedorBola < 1.0
                     ? '   <<< DOIS ALVOS: ele foi cravado na BOLA, e a espera apontava para outro lugar'
                     : ''));
    }
  }

  console.log('\n  LEITURA: ORCAMENTO pede velocidade ou janela; DERIVA pede achar');
  console.log('  o escritor que mexe nele DEPOIS da chegada. Sao consertos opostos,');
  console.log('  e chutar entre os dois foi o erro da OS-248.');
  if (erros.length) { console.log('\nERROS:'); [...new Set(erros)].slice(0, 4).forEach(e => console.log('  ', e.slice(0, 160))); }
  process.exit(0);
})();
