#!/usr/bin/env node
'use strict';
/* A VIDA DO GESTO — quanto tempo cada estado FICA na tela, contra o que ele
   mesmo declara durar
   =========================================================================
   DE ONDE VEIO. Olhando a folha de quadros de um drible
   (tools/fisica/tela/lance-em-quadros.js --evento=dribble), a cadeia era:

       inside_cut       4 quadros  =  67 ms   (declara 0,22 s)
       dribble_success  5 quadros  =  83 ms   (declara 0,22 s)
       body_duel        6 quadros  = 100 ms   (declara 0,30 s)
       dribble_prepare  2 quadros  =  33 ms   (declara 0,14 s)

   Nenhum deles chegou perto da propria duracao. E os quatro sao mais CURTOS
   que os 110 ms que a mistura de pose da OS-235 leva para completar — ou seja,
   a silhueta do estado nunca chega a ser desenhada. Ela e sempre uma media
   entre o gesto anterior e o proximo.

   Isso ja tinha sido medido uma vez, para a LOCOMOCAO: a OS-246 achou 9,03
   trocas por atleta por segundo, 87% delas abaixo de 0,12 s, e resolveu com
   histerese nos limiares e permanencia minima. Mas o caminho da ACAO e outro
   — la o estado nao troca por limiar, troca porque outro pedido chegou por
   cima. A permanencia da OS-246 nao cobre esse caminho, de proposito: um
   pedido de acao TEM de poder interromper a locomocao.

   O QUE ESTA SONDA MEDE, por estado declarado:

     - quantas vezes ele foi ENTRADO
     - quanto tempo de PAREDE ele ficou, de fato (mediana, p10, p90)
     - a duracao que ele DECLARA
     - a fracao das entradas que morreu antes de 110 ms (a mistura de pose)
     - a fracao que morreu antes da propria duracao declarada
     - quem o SUBSTITUIU (os tres sucessores mais comuns)

   O ultimo campo e o que aponta o culpado: se `inside_cut` sempre morre para
   `dribble_success`, o defeito e a sequencia; se morre para `jog`, e a
   locomocao atropelando a acao.

   ZERO OBSERVACAO NAO E ZERO DEFEITO (OS-247): a sonda reprova se nao viu
   amostra suficiente.

   Uso: node tools/fisica/tela/vida-do-gesto.js [bundle.html] [--segundos=90]
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
const SEGUNDOS = Number(argv.segundos || 90);
const MIN_AMOSTRA = Number(argv.minimo || 6);
/* o mesmo numero da OS-235: abaixo disto a silhueta do estado nao chega */
const MISTURA_MS = Number(argv.mistura || 110);

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
    const S = window.__vg = { vidas: Object.create(null), quadros: 0, atletas: 0 };
    const atual = Object.create(null);          // chave -> { st, t0 }
    const laco = () => {
      try {
        const M = window.__CDS_ANIM_BY_KEY || {};
        const agora = performance.now();
        const ks = Object.keys(M);
        S.quadros++; S.atletas = ks.length;
        for (const k of ks) {
          const A = M[k]; if (!A) continue;
          const st = A.state || '?';
          const a = atual[k];
          if (!a) { atual[k] = { st: st, t0: agora }; continue; }
          if (a.st === st) continue;
          const dur = agora - a.t0;
          const V = S.vidas[a.st] || (S.vidas[a.st] = { n: 0, ms: [], seg: Object.create(null) });
          V.n++; if (V.ms.length < 20000) V.ms.push(Math.round(dur));
          V.seg[st] = (V.seg[st] || 0) + 1;
          atual[k] = { st: st, t0: agora };
        }
      } catch (_) { }
      requestAnimationFrame(laco);
    };
    requestAnimationFrame(laco);
  });

  const nome = await pg.evaluate(() => window.__quickMatch(40, 120));
  if (!/ x /.test(String(nome))) { console.error('partida nao subiu:', nome); await nav.close(); process.exit(2); }
  /* §OS-260 · a velocidade de exibicao entra na conta: se o relogio do gesto
     for o do SIMULADOR, as duracoes declaradas encolhem pelo multiplicador do
     botao, e a comparacao 1X x 3X mostra isso de forma direta. */
  const VEL = argv.vel ? Number(argv.vel) : null;
  if (VEL) await pg.evaluate(v => { try { window.G.speed = v; } catch (_) { } }, VEL);
  const velUsada = await pg.evaluate(() => { try { return window.G && window.G.speed; } catch (_) { return null; } });
  await pg.waitForTimeout(SEGUNDOS * 1000);

  const r = await pg.evaluate(cfg => {
    const S = window.__vg;
    /* a tabela de duracoes declaradas mora na camada de animacao */
    const ST = (window.CDS_ANIM && window.CDS_ANIM.STATES) || null;
    const DECL = ST ? Object.create(null) : null;
    if (ST) for (const k in ST) if (ST[k] && typeof ST[k].dur === 'number') DECL[k] = ST[k].dur;
    const linhas = [];
    for (const st of Object.keys(S.vidas)) {
      const V = S.vidas[st];
      const o = V.ms.slice().sort((a, b) => a - b);
      const q = f => o.length ? o[Math.min(o.length - 1, Math.floor(f * o.length))] : 0;
      const decl = DECL && DECL[st] != null ? DECL[st] : null;
      const suc = Object.keys(V.seg).sort((a, b) => V.seg[b] - V.seg[a]).slice(0, 3)
        .map(k => k + ':' + V.seg[k]);
      linhas.push({
        st: st, n: V.n, p10: q(.10), med: q(.50), p90: q(.90),
        decl: decl,
        curtos: o.filter(v => v < cfg.mistura).length,
        antesDecl: decl ? o.filter(v => v < decl * 1000 * 0.8).length : null,
        suc: suc,
      });
    }
    linhas.sort((a, b) => b.n - a.n);
    const AU = (window.CDS_ANIM_MIX && window.CDS_ANIM_MIX.auditoria) || null;
    return { linhas: linhas, quadros: S.quadros, atletas: S.atletas,
             aud: AU ? { chegou: AU.chegou, cortou: AU.cortou, somaK: AU.somaK,
                         pico: AU.pico, soma: AU.soma, quadros: AU.quadros } : null,
             erroAnim: window.__CDS_ANIM_ERRO || null };
  }, { mistura: MISTURA_MS });

  await nav.close();

  console.log('\n=== A VIDA DO GESTO ===  ' + SEGUNDOS + ' s | ' + r.quadros +
              ' quadros | ' + r.atletas + ' atletas | velocidade de exibicao ' + velUsada + 'X');
  console.log('    quanto tempo o estado FICA na tela, contra o que ele declara durar');
  console.log('    mistura de pose = ' + MISTURA_MS + ' ms (OS-235): abaixo disso a silhueta nao chega\n');

  if (r.erroAnim) {
    console.log('  !! __CDS_ANIM_ERRO: ' + r.erroAnim.n + ' erros — ' +
                String(r.erroAnim.primeiro).slice(0, 160));
  }

  const totalEntradas = r.linhas.reduce((s, l) => s + l.n, 0);
  if (!r.quadros || totalEntradas < 40) {
    console.log('  SEM AMOSTRA: ' + totalEntradas + ' entradas de estado. REPROVA (OS-247: zero');
    console.log('  observacao nao e zero defeito).');
    process.exit(1);
  }

  console.log('   ' + 'estado'.padEnd(20) + 'entrou'.padStart(7) + '   p10   mediana   p90' +
              '   declara' + '   <mistura' + '   antes do fim   substituido por');
  let somaCurtos = 0, somaN = 0, culpados = [];
  for (const l of r.linhas) {
    if (l.n < 3) continue;
    somaCurtos += l.curtos; somaN += l.n;
    const pc = 100 * l.curtos / l.n;
    if (l.n >= MIN_AMOSTRA && pc >= 70 && l.decl != null) culpados.push(l);
    console.log('   ' + l.st.slice(0, 20).padEnd(20) +
      String(l.n).padStart(7) +
      String(l.p10).padStart(6) + String(l.med).padStart(10) + String(l.p90).padStart(6) +
      (l.decl != null ? (l.decl * 1000).toFixed(0) : '  laco').padStart(10) +
      (pc.toFixed(0) + '%').padStart(11) +
      (l.antesDecl != null ? (100 * l.antesDecl / l.n).toFixed(0) + '%' : '   -').padStart(15) +
      '   ' + l.suc.join(' '));
  }
  console.log('\n   tempos em ms de PAREDE.  "<mistura" = fracao das entradas que morreu antes');
  console.log('   de a silhueta do estado chegar.  "antes do fim" = morreu antes de 80% da');
  console.log('   propria duracao declarada.\n');
  console.log('   GERAL: ' + (100 * somaCurtos / Math.max(1, somaN)).toFixed(1) +
              '% das ' + somaN + ' entradas duraram menos que a mistura de pose.');

  /* §OS-260 · a pergunta que decide: a silhueta do estado CHEGOU a ser
     desenhada, ou a troca cortou a mistura no meio? Duracao curta so e defeito
     se a pose nao chega; e so isto se ve. */
  if (r.aud) {
    const tot = r.aud.chegou + r.aud.cortou;
    const kMedio = r.aud.cortou ? r.aud.somaK / r.aud.cortou : 0;
    console.log('\n   A SILHUETA CHEGOU?  (auditoria de CDS_ANIM_MIX: o que foi DESENHADO)');
    console.log('     trocas de pose        ' + String(tot).padStart(7));
    console.log('     silhueta completou    ' + String(r.aud.chegou).padStart(7) +
                '   ' + (100 * r.aud.chegou / Math.max(1, tot)).toFixed(1) + '%');
    console.log('     cortada no meio       ' + String(r.aud.cortou).padStart(7) +
                '   ' + (100 * r.aud.cortou / Math.max(1, tot)).toFixed(1) +
                '%   parando em ' + (100 * kMedio).toFixed(0) + '% da pose, em media');
    console.log('     salto de silhueta     pico ' + r.aud.pico.toFixed(3) +
                ' | medio ' + (r.aud.soma / Math.max(1, r.aud.quadros)).toFixed(4) + ' por quadro');
  } else {
    console.log('\n   SEM AUDITORIA de mistura: CDS_ANIM_MIX ausente. REPROVA (OS-247).');
  }
  if (culpados.length) {
    console.log('\n   ESTADOS QUE PRATICAMENTE NUNCA SAO DESENHADOS (>=70% abaixo da mistura,');
    console.log('   com duracao declarada — ou seja, deviam durar e nao duram):');
    for (const l of culpados) {
      console.log('     ' + l.st.padEnd(20) + ' declara ' + (l.decl * 1000).toFixed(0) +
                  ' ms, vive ' + l.med + ' ms  ->  cede para ' + l.suc.join(' '));
    }
  } else {
    console.log('\n   Nenhum estado com duracao declarada morre sistematicamente antes da mistura.');
  }
  if (erros.length) { console.log('\nERROS DE PAGINA:'); [...new Set(erros)].slice(0, 3).forEach(e => console.log('  ', e.slice(0, 160))); }
  process.exit(0);
})();
