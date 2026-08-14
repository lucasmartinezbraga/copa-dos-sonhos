#!/usr/bin/env node
'use strict';
/* SONDA DE DESENHO DA BOLA PARADA — OS-207
   -------------------------------------------------------------------------
   A sonda `cerimonia.js` mede a POSE contra o MOVIMENTO, mas roda a simulacao
   na mao: ela nunca desenha nada. Duas das quatro correcoes da OS-207 vivem
   exclusivamente no laco de desenho e ficariam sem medicao nenhuma:

     · o salto de volta da passada do batedor (OS-89), e
     · o balanco #anti-cardume tremendo com a bola parada.

   Esta sonda roda o jogo DE VERDADE — `window.__quickMatch` sobe uma partida
   com o laco de rAF, o canvas e o `paintField` reais — e intercepta
   `CDS_F25D.body`, que e por onde toda posicao DESENHADA passa. O que ela ve e
   o que o dono ve.

   Mede, por atleta e por quadro desenhado:

     1. SALTO DE DESENHO. Deslocamento na tela entre quadros consecutivos,
        convertido para metros. Acima do que a fisica permite andar num quadro,
        e salto: o corpo mudou de lugar sem ter ido.

     2. TREMOR. Reversao de direcao do deslocamento desenhado entre quadros
        consecutivos, com a bola morta. Zigue-zague quadro a quadro nao e
        caminhada, e vibracao.

   Uso: node tools/fisica/tela/passada-parada.js [bundle.html] [--segundos=N]
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
const SEGUNDOS = Number(argv.segundos || 150);

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

  /* o gancho entra ANTES da partida subir, para nao perder quadro nenhum.
     ATENCAO: `root.CDS_F25D` e `Object.freeze`, entao trocar um metodo dentro
     dele falha EM SILENCIO — a primeira versao desta sonda fez isso e reportou
     zero quadro com o jogo desenhando normalmente. O objeto e congelado, a
     ligacao em `window` nao: troca-se o objeto inteiro por uma copia. */
  await pagina.evaluate(() => {
    const F = Object.assign({}, window.CDS_F25D);
    window.__sonda = {
      quadros: 0, amostras: 0,
      saltos: 0, somaSalto: 0, maxSalto: 0,
      tremores: 0, paresMortos: 0,
      mortos: 0, vivos: 0,
    };
    const S = window.__sonda;
    const ant = Object.create(null);   // ultima posicao desenhada, por chave
    const dAnt = Object.create(null);  // ultimo deslocamento desenhado
    let quadroAtual = -1, marca = 0, marcaAnt = 0;

    const orig = F.body;
    F.body = function (ctx, o) {
      try {
        const sim = window.GAME && window.GAME._sim && window.GAME._sim();
        const morta = !!(sim && (sim.dead > 0 || sim.waiting));
        /* um quadro de desenho = uma rajada de chamadas de `body`. A troca de
           quadro e detectada pelo relogio de parede: dentro do mesmo quadro o
           `performance.now()` nao anda. */
        const agora = performance.now();
        if (agora !== marca) { marcaAnt = marca || agora; marca = agora; quadroAtual++; S.quadros++; if (morta) S.mortos++; else S.vivos++; }
        if (!morta) { ant[o.key] = null; dAnt[o.key] = null; return orig.apply(this, arguments); }

        /* px por metro: a MESMA conta do desenho (§D41), para que "salto de
           2 m" aqui queira dizer 2 m no gramado e nao 2 m de chute */
        let pxM = 8;
        try {
          const fW = window.G.CW - 2 * window.G.M, FLv = window.FL || 105;
          if (fW > 0 && o.r > 0) pxM = (fW / FLv) * (o.r / 13);
        } catch (_) { }
        if (!(pxM > 0.5)) pxM = 8;
        const a = ant[o.key];
        if (a) {
          S.amostras++;
          const dx = o.x - a[0], dy = o.y - a[1];
          const dm = Math.hypot(dx, dy) / pxM;
          /* teto do passo. ATENCAO ao botao de velocidade: entre dois quadros
             DESENHADOS passa `parede x G.speed` de tempo de JOGO, e o atleta
             anda esse tanto por direito. A primeira versao desta sonda usou o
             tempo de parede cru rodando a 6X e acusou 38% de "salto" que era
             so o avanco rapido — o numero era do botao, nao do defeito. */
          const parede = Math.max(1 / 240, Math.min(0.2, (agora - marcaAnt) / 1000));
          let vel = 1; try { if (window.G && window.G.speed > 0) vel = window.G.speed; } catch (_) { }
          const passoS = parede * vel;
          if (dm > 7.5 * passoS * 1.6 + 0.05) { S.saltos++; S.somaSalto += dm; if (dm > S.maxSalto) S.maxSalto = dm; }
          const d0 = dAnt[o.key];
          if (d0 && Math.hypot(dx, dy) > 0.25 && Math.hypot(d0[0], d0[1]) > 0.25) {
            S.paresMortos++;
            const dot = (dx * d0[0] + dy * d0[1]) / (Math.hypot(dx, dy) * Math.hypot(d0[0], d0[1]));
            if (dot < -0.5) S.tremores++;
          }
          dAnt[o.key] = [dx, dy];
        }
        ant[o.key] = [o.x, o.y];
      } catch (_) { }
      return orig.apply(this, arguments);
    };
    window.CDS_F25D = F;   // a copia destravada entra no lugar do objeto congelado
  });

  const nome = await pagina.evaluate(() => window.__quickMatch(40, 120));
  if (!/ x /.test(String(nome))) {
    console.error('nao consegui subir a partida:', nome);
    await navegador.close(); process.exit(2);
  }
  /* roda na velocidade PADRAO do jogo (3X, OS-202): a sonda tem de ver o que
     o dono ve, e o teto de salto ja desconta o botao de velocidade. */
  await pagina.waitForTimeout(SEGUNDOS * 1000);

  const r = await pagina.evaluate(() => window.__sonda);
  await navegador.close();

  const pct = (a, b) => b ? (100 * a / b).toFixed(2) + '%' : '—';
  console.log('\n=== DESENHO DA BOLA PARADA ===\n');
  console.log('bundle:', alvo);
  console.log('quadros desenhados:', r.quadros, '| com bola morta:', r.mortos, '| rolando:', r.vivos);
  console.log('amostras (atleta x quadro, bola morta):', r.amostras);
  console.log('');
  console.log('1 · SALTO DE DESENHO (corpo muda de lugar sem ter ido)');
  console.log('    saltos            ', r.saltos, '(' + pct(r.saltos, r.amostras) + ')');
  console.log('    salto medio       ', r.saltos ? (r.somaSalto / r.saltos).toFixed(2) + ' m' : '—');
  console.log('    salto maximo      ', r.maxSalto.toFixed(2), 'm');
  console.log('');
  console.log('2 · TREMOR (reversao de direcao entre quadros)');
  console.log('    pares avaliados   ', r.paresMortos);
  console.log('    reversoes         ', r.tremores, '(' + pct(r.tremores, r.paresMortos) + ')');
  console.log('');
  if (erros.length) { console.log('ERROS DE PAGINA:'); erros.slice(0, 5).forEach(e => console.log('  ', e)); }
  process.exit(0);
})();
