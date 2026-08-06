#!/usr/bin/env node
'use strict';
/* Smoke de navegador do bundle.
   -------------------------------------------------------------------------
   Existe porque a bateria em Node carrega o bundle com `vm.runInThisContext`,
   que NAO e como o navegador carrega. Isso ja escondeu diferenca real de
   escopo antes, e so o navegador prova que o jogo de fato sobe: DOM, canvas,
   boot e render entram aqui e nao la.

   Uso: node tests/browser_smoke.js [caminho/do/bundle.html]
*/

const path = require('path');
const { pathToFileURL } = require('url');

function carregarPlaywright() {
  for (const cand of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(cand); } catch (_) { /* tenta o proximo */ }
  }
  console.error('playwright nao encontrado; smoke de navegador pulado');
  process.exit(0);
}

const { chromium } = carregarPlaywright();
const alvo = path.resolve(process.argv[2] || 'dist/index.html');

(async () => {
  const erros = [];
  const consoleErros = [];
  const navegador = await chromium.launch({
    headless: true,
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox'],
  });
  const pagina = await navegador.newPage({ viewport: { width: 1366, height: 768 } });
  pagina.on('pageerror', e => erros.push(String(e)));
  pagina.on('console', m => { if (m.type() === 'error') consoleErros.push(m.text()); });

  await pagina.goto(pathToFileURL(alvo).href, { waitUntil: 'load', timeout: 120000 });
  await pagina.waitForTimeout(1500);

  const estado = await pagina.evaluate(() => {
    const out = {
      titulo: document.title,
      temApp: !!document.querySelector('#app'),
      motor: typeof window.MatchSim,
      os200: !!window.CDS_OS200,
      calibracaoAlcancavel: null,
      partida: null,
      fisica: null,
    };
    /* A camada de fisica le a calibracao por `ENGINE_CALIBRATION`, e nao por
       `CAL`: o core e uma IIFE, entao `CAL` fica preso no escopo dele e nao
       chega a camada nenhuma — nem aqui, nem no vm de Node. Esta verificacao
       guarda a via que a camada realmente usa. */
    try { out.calibracaoAlcancavel = (typeof ENGINE_CALIBRATION !== 'undefined'); }
    catch (_) { out.calibracaoAlcancavel = false; }

    try {
      const db = window.buildDB(window.DATA);
      const squad = db.squads[0];
      const mk = (f, cor) => {
        const p = window.autoLineup(squad, f, 0);
        return { squad, name: squad.c, flag: squad.f, color: cor,
                 lineup: p.lineup, bench: p.bench, formKey: f, style: 'balanced' };
      };
      const forms = Object.keys(window.FORMATIONS);
      window.srand(4200000);
      const sim = new window.MatchSim(mk(forms[0], '#2e9bff'), mk(forms[1], '#ff3d7f'),
        { neutral: true, labMode: true });
      let apiceMax = 0, quiques = 0, zAnt = 0, tocou = false, passos = 0;
      while (!sim.isOver() && passos++ < 200000) {
        sim.step(1 / 30);
        const z = (sim.ball && sim.ball.z) || 0;
        if (z > apiceMax) apiceMax = z;
        /* quique de verdade: subiu mais de 15 cm depois de tocar o gramado.
           Um limiar menor conta o tremor de uma bola rolando. */
        if (zAnt <= 0.02 && z > 0.15 && tocou) { quiques++; tocou = false; }
        if (zAnt > 0.02 && z <= 0.02) tocou = true;
        zAnt = z;
      }
      out.partida = { terminou: sim.isOver(), placar: sim.score.slice(),
                      chutes: sim.stats[0].shots + sim.stats[1].shots };
      out.fisica = { apiceMax: +apiceMax.toFixed(2), quiques,
                     relatorio: sim.getOS200Report ? sim.getOS200Report() : null };
    } catch (e) {
      out.erroPartida = String(e && e.stack || e);
    }
    return out;
  });

  await navegador.close();

  let falhas = 0;
  const checar = (nome, ok, detalhe) => {
    console.log(`${ok ? '  ok  ' : ' FALHA'}  ${nome}${detalhe ? '  ->  ' + detalhe : ''}`);
    if (!ok) falhas++;
  };

  console.log('\n=== SMOKE DE NAVEGADOR ===\n');
  console.log(`bundle: ${alvo}`);
  console.log(`titulo: ${estado.titulo}`);
  if (estado.erroPartida) console.log(`erro na partida:\n${estado.erroPartida}`);

  checar('pagina carrega sem erro de script', erros.length === 0,
    erros.slice(0, 3).join(' | ') || 'nenhum');
  checar('#app existe no DOM', estado.temApp);
  checar('MatchSim exportado', estado.motor === 'function');
  checar('camada de fisica OS-200 instalada', estado.os200 === true);
  checar('ENGINE_CALIBRATION alcancavel pelas camadas', estado.calibracaoAlcancavel === true,
    'e a via que a camada de fisica usa para ler a calibracao');
  checar('partida completa sem excecao', !!(estado.partida && estado.partida.terminou),
    estado.partida ? `placar ${estado.partida.placar.join('x')}, ${estado.partida.chutes} chutes` : 'nao rodou');
  checar('bola sobe acima do travessao em algum momento',
    !!(estado.fisica && estado.fisica.apiceMax > 2.44),
    estado.fisica ? `apice maximo ${estado.fisica.apiceMax} m` : '-');
  checar('bola quica durante a partida', !!(estado.fisica && estado.fisica.quiques > 0),
    estado.fisica ? `${estado.fisica.quiques} quiques` : '-');

  if (consoleErros.length) {
    console.log(`\nconsole.error observados (${consoleErros.length}):`);
    for (const m of consoleErros.slice(0, 5)) console.log('  - ' + m.slice(0, 200));
  }
  console.log(`\n${falhas ? falhas + ' verificacao(oes) falharam' : 'todas as verificacoes passaram'}\n`);
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
