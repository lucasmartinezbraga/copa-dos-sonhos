#!/usr/bin/env node
'use strict';
/* TEC-03 · ERROS DE CONSOLE NO NAVEGADOR — regressao de UI
   -------------------------------------------------------------------------
   O harness de Node nao carrega a UI nem a Copa (o bundle para em
   `document.addEventListener`), entao TEC-03 nao pode ser verificado la. A
   R18.43 injeta uma camada nova, e uma camada que lance no boot passaria
   invisivel pela bateria. Este smoke abre a build num Chromium de verdade,
   coleta erros de console e excecoes de pagina, confirma que a camada foi
   registrada e que os simbolos da Copa existem (que e o que o laboratorio
   perde), e reprova se houver erro.

   Uso: node tools/r1843/browser_smoke.js --build="dist/....html"
*/
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const a = (n, d) => { const h = process.argv.slice(2).find(x => x.startsWith('--' + n + '=')); return h ? h.slice(n.length + 3) : d; };
const BUILD = a('build', '');
if (!BUILD || !fs.existsSync(BUILD)) { console.error('ABORTA: --build inexistente'); process.exit(2); }

(async () => {
  /* O Chromium pre-instalado do ambiente e o 1194; a versao de playwright
     resolvida pelo npm pode esperar outro build e nao acha o binario. Procuro o
     executavel de fato presente em vez de confiar na resolucao padrao. */
  const CANDIDATOS = [
    process.env.CDS_CHROME,
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
  ].filter(Boolean).filter(p => fs.existsSync(p));
  let browser = null, ultimoErro = null;
  for (const exe of CANDIDATOS) {
    try { browser = await chromium.launch({ executablePath: exe }); break; }
    catch (e) { ultimoErro = e; }
  }
  if (!browser) { try { browser = await chromium.launch(); } catch (e) { ultimoErro = e; } }
  if (!browser) { console.error('ABORTA: nenhum Chromium utilizavel. ' + (ultimoErro && ultimoErro.message)); process.exit(2); }
  const page = await browser.newPage();
  const erros = [], avisos = [];
  page.on('console', m => {
    if (m.type() === 'error') erros.push(m.text().slice(0, 300));
    else if (m.type() === 'warning') avisos.push(m.text().slice(0, 200));
  });
  page.on('pageerror', e => erros.push('pageerror: ' + String(e && e.message || e).slice(0, 300)));

  await page.goto('file://' + path.resolve(BUILD), { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(3500);

  const sonda = await page.evaluate(() => {
    const w = window;
    return {
      buildId: w.CDS_BUILD_ID || null,
      versao: w.CDS_VERSION || null,
      camada1843: w.CDS_R1843_ESPACO ? w.CDS_R1843_ESPACO.version : null,
      pisoDef: w.CDS_R1843_ESPACO ? w.CDS_R1843_ESPACO.pisoDef : null,
      pisoAtk: w.CDS_R1843_ESPACO ? w.CDS_R1843_ESPACO.pisoAtk : null,
      temMatchSim: typeof w.MatchSim === 'function',
      temAuditoriaBloco: !!(w.MatchSim && w.MatchSim.prototype && typeof w.MatchSim.prototype.getBlockDepthAudit === 'function'),
      /* Camada da Copa: exatamente o que o harness de Node nao ve. */
      temCUP: typeof w.CUP !== 'undefined',
      temTeamFor: !!(w.CUP && typeof w.CUP.teamFor === 'function'),
      temBestFormationFor: typeof w.bestFormationFor === 'function',
      temAutoLineup: typeof w.autoLineup === 'function',
      titulo: document.title,
    };
  });

  /* Uma partida curta no navegador, para a camada rodar no ambiente real e nao
     so no laboratorio. */
  const jogo = await page.evaluate(() => {
    try {
      const db = buildDB(DATA);
      const sq = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
      const mk = (f, st, home) => { const p = autoLineup(sq, f, 0); return { squad: sq, name: sq.c, flag: sq.f, color: home ? '#2e9bff' : '#ff3d7f', lineup: p.lineup, bench: p.bench, formKey: f, style: st }; };
      const F = Object.keys(FORMATIONS);
      srand(4200000);
      const sim = new MatchSim(mk(F[0], 'balanced', true), mk(F[1], 'press', false), { neutral: true, labMode: true });
      let s = 0; while (!sim.isOver() && s++ < 400000) sim.step(1 / 30);
      const au = sim.getBlockDepthAudit ? sim.getBlockDepthAudit() : null;
      return { ok: true, placar: sim.score.slice(), chutes: (sim.stats[0].shots + sim.stats[1].shots),
        elevadosDef: au && au.elevadosDef, elevadosAtk: au && au.elevadosAtk,
        cortadoPorImpedimento: au && au.cortadoPorImpedimento };
    } catch (e) { return { ok: false, erro: String(e && e.message || e) }; }
  });

  await browser.close();
  console.log(JSON.stringify({ build: path.basename(BUILD), sonda, jogo,
    errosDeConsole: erros.length, erros: erros.slice(0, 12),
    avisos: avisos.length }, null, 2));

  const falhas = [];
  if (erros.length) falhas.push(erros.length + ' erro(s) de console');
  if (!sonda.camada1843) falhas.push('camada R18.43 ausente no navegador');
  if (!sonda.temAuditoriaBloco) falhas.push('getBlockDepthAudit ausente');
  if (!sonda.temCUP || !sonda.temTeamFor) falhas.push('camada da Copa nao carregou');
  if (!jogo.ok) falhas.push('partida no navegador falhou: ' + jogo.erro);
  if (jogo.ok && !jogo.elevadosDef && !jogo.elevadosAtk) falhas.push('camada INERTE no navegador');
  if (falhas.length) { console.error('REPROVA: ' + falhas.join(' | ')); process.exit(1); }
  console.error('OK: TEC-03 sem erros, camada ativa e Copa carregada no navegador.');
})().catch(e => { console.error('ERRO NO SMOKE: ' + (e && e.stack || e)); process.exit(2); });
