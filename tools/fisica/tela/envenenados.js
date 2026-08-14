#!/usr/bin/env node
'use strict';
/* O D35 APARECE NA TELA? — a pergunta que nenhuma metrica responde.
   =========================================================================
   O D35 deixa ~6 dos 20 jogadores de linha marcados como se estivessem em
   arrancada, ate o apito final. Para eles valem, permanentemente:

     tProg = max(tProg, ballProg + 16)   ficam 16 m a frente da bola
     !p._breaking -> sem teto            isentos do impedimento
     ty = ty + undefined*9 = NaN         alvo LATERAL destruido
     +2,4 no _bestPass                   alvo preferencial de passe

   As 14 metricas nao veem nada disso: consertar derruba o jogo, entao o
   defeito esta "aprovado" pelos portoes. A unica pergunta que sobra e se o
   JOGADOR VE. Esta sonda abre o jogo de verdade no Chromium, fotografa o campo
   e, no MESMO instante, le o estado do sim para dizer quem esta envenenado e
   onde ele esta.

   O que olhar na foto, com a lista ao lado:
     - jogador parado atras da linha defensiva adversaria com a bola longe
     - jogador que nao acompanha o deslocamento lateral do time
     - aglomeracao a 16 m a frente da bola

   Uso: node tools/fisica/tela/envenenados.js [build.html] [saida] [fotos]
*/
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const alvo = path.resolve(process.argv[2] || 'dist/index.html');
const saida = process.argv[3] || '/tmp/envenenados';
const nFotos = Number(process.argv[4] || 6);
const intervalo = Number(process.argv[5] || 9000);
fs.mkdirSync(saida, { recursive: true });

(async () => {
  const nav = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const pg = await nav.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on('pageerror', e => console.error('ERRO NA PAGINA:', String(e).slice(0, 160)));
  await pg.goto(pathToFileURL(alvo).href, { waitUntil: 'load', timeout: 120000 });
  await pg.waitForTimeout(1800);
  await pg.evaluate(() => { window.__quickMatch(40, 120); window.G.speed = 3; });
  await pg.waitForTimeout(2500);

  const caixa = await pg.evaluate(() => {
    const cs = [...document.querySelectorAll('canvas')]
      .map(c => { const r = c.getBoundingClientRect(); return { r, a: r.width * r.height }; })
      .sort((a, b) => b.a - a.a);
    if (!cs.length) return null;
    const r = cs[0].r;
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  if (!caixa) { console.error('nenhum canvas visivel'); await nav.close(); process.exit(1); }

  const linhas = [];
  for (let i = 0; i < nFotos; i++) {
    await pg.waitForTimeout(intervalo);
    const estado = await pg.evaluate(() => {
      const sim = window.__CDS_ACTIVE_SIM;
      if (!sim || !sim.teams) return null;
      const FL = window.FL || 105;
      const b = sim.ball || {};
      const out = { minuto: +(+sim.minute).toFixed(1), placar: (sim.score || []).join('x'),
                    bola: { x: +(+b.x).toFixed(1), y: +(+b.y).toFixed(1) }, jogadores: [] };
      for (const tm of sim.teams) {
        const dir = tm.attackDir;
        const prog = x => dir > 0 ? x : FL - x;
        let linha = FL - 2;
        try { linha = +sim._offsideLine(tm.side); } catch (_) {}
        for (const p of tm.players) {
          if (!p || p.red || p.isGK) continue;
          const br = p._breaking;
          if (!br) continue;
          const venenoso = !Number.isFinite(+br.dir) || !Number.isFinite(+br.t);
          out.jogadores.push({
            time: tm.side, pos: p.slotPos, idx: p.idx,
            envenenado: venenoso,
            x: +(+p.x).toFixed(1), y: +(+p.y).toFixed(1),
            aFrenteDaBola_m: +(prog(+p.x) - prog(+b.x)).toFixed(1),
            alemDaLinha_m: +(prog(+p.x) - linha).toFixed(1),
            smyNaN: !Number.isFinite(+p._smy),
          });
        }
      }
      return out;
    });
    const arq = path.join(saida, `t${String(i).padStart(2, '0')}.png`);
    await pg.screenshot({ path: arq, clip: caixa });
    if (estado) {
      const env = estado.jogadores.filter(j => j.envenenado);
      linhas.push({ foto: path.basename(arq), ...estado, envenenados: env.length });
      console.log(`\n${path.basename(arq)}  minuto ${estado.minuto}  placar ${estado.placar}` +
                  `  bola (${estado.bola.x}, ${estado.bola.y})`);
      console.log(`  ${env.length} envenenado(s) de 20 em campo`);
      for (const j of env) {
        console.log(`    time ${j.time} ${j.pos.padEnd(4)} idx${String(j.idx).padStart(2)}` +
                    `  em (${String(j.x).padStart(5)}, ${String(j.y).padStart(4)})` +
                    `  ${String(j.aFrenteDaBola_m).padStart(6)} m a frente da bola` +
                    `  ${String(j.alemDaLinha_m).padStart(6)} m alem da linha` +
                    `  alvoLateralNaN=${j.smyNaN}`);
      }
    }
  }
  fs.writeFileSync(path.join(saida, 'estado.json'), JSON.stringify(linhas, null, 1));
  console.log(`\n${nFotos} fotos e estado.json em ${saida}`);
  await nav.close();
})().catch(e => { console.error(e); process.exit(1); });
