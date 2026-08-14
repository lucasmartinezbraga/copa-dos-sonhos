#!/usr/bin/env node
'use strict';
/* SONDA DA CERIMONIA DE BOLA PARADA — OS-207
   -------------------------------------------------------------------------
   Existe porque a bateria de fisica NAO consegue medir isto: ela pula o bloco
   `cds-ux-boot` (tools/fisica/bateria.js:65), que e justamente onde moram a
   ponte de animacao e o desenhista. So o navegador carrega tudo.

   MEDE A POSE CONTRA O MOVIMENTO, que e o defeito de verdade.

   A primeira versao desta sonda comparava `vx/vy` com o deslocamento e
   chamava a diferenca de "desacordo". Estava medindo o proxy errado: a
   recolocacao administrativa desloca 40 m num quadro e nenhuma perna anima a
   800 m/s, entao a velocidade SATURA de proposito e a sonda contava isso como
   defeito. Numero grande, informacao nenhuma.

   O que importa e o que o dono ve: o atleta desenhado PARADO enquanto desliza
   pelo gramado, ou pedalando no lugar depois de ja ter chegado. Isso se mede
   comparando a faixa de locomocao que a maquina de estados escolheu com a
   velocidade que o deslocamento do quadro implica — as duas coisas que o
   desenhista junta na tela.

   Faixas (as mesmas de `locoFor`, no bloco 21):
     idle < 0,25 | walk < 1,6 | jog < 3,6 | run < 5,8 | sprint >= 5,8

   Uso: node tools/fisica/tela/cerimonia.js [bundle.html] [--partidas=N]
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
const PARTIDAS = Number(argv.partidas || 6);

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

  const r = await pagina.evaluate((PARTIDAS) => {
    const db = window.buildDB(window.DATA);
    const forms = Object.keys(window.FORMATIONS);
    const out = {
      os207: !!window.CDS_OS207, pontePropria: false,
      quadrosMortos: 0, amostras: 0, admin: 0,
      poseErrada: 0, deslizando: 0, pedalando: 0,
      partidas: 0,
    };
    const SALTO_ADMIN = 2.50;
    const LOCO = [[0.25, 'idle'], [1.6, 'walk'], [3.6, 'jog'], [5.8, 'run'], [Infinity, 'sprint']];
    const faixaDe = v => { for (const [lim, nome] of LOCO) if (v < lim) return nome; return 'sprint'; };
    const ehLoco = s => s === 'idle' || s === 'walk' || s === 'jog' || s === 'run' || s === 'sprint';

    for (let m = 0; m < PARTIDAS; m++) {
      const squad = db.squads[m % db.squads.length];
      const mk = (f, cor) => {
        const p = window.autoLineup(squad, f, 0);
        return { squad, name: squad.c, flag: squad.f, color: cor,
                 lineup: p.lineup, bench: p.bench, formKey: f, style: 'balanced' };
      };
      window.srand(4200000 + m * 7919);
      const sim = new window.MatchSim(mk(forms[m % forms.length], '#2e9bff'),
                                      mk(forms[(m + 1) % forms.length], '#ff3d7f'),
                                      { neutral: true, labMode: true });

      const ant = new Map();
      let passos = 0;
      const dt = 1 / 30;

      while (!sim.isOver() && passos++ < 200000) {
        const morta = sim.dead > 0;
        sim.step(dt);

        if (!morta) { ant.clear(); continue; }
        out.quadrosMortos++;
        for (const tm of sim.teams) {
          for (const p of tm.players) {
            if (!p || p.red) continue;
            const a = ant.get(p);
            if (a) {
              const salto = Math.hypot(p.x - a[0], p.y - a[1]);
              if (salto > SALTO_ADMIN) { out.admin++; }
              else {
                const est = sim.animOf ? sim.animOf(p) : null;
                const s = est && est.state;
                /* so a LOCOMOCAO e comparavel: um chute ou um carrinho
                   legitimamente sobrepoem a corrida, e nao sao erro de pose */
                if (s && ehLoco(s)) {
                  out.amostras++;
                  const real = faixaDe(salto / dt);
                  if (real !== s) {
                    out.poseErrada++;
                    if (s === 'idle' && salto / dt >= 0.25) out.deslizando++;
                    if (s !== 'idle' && salto / dt < 0.25) out.pedalando++;
                  }
                }
              }
            }
            ant.set(p, [p.x, p.y]);
          }
        }
      }
      out.partidas++;
    }
    out.pontePropria = !!(window.CDS_ANIM_BRIDGE && window.CDS_ANIM_BRIDGE.dono);
    return out;
  }, PARTIDAS);

  await navegador.close();

  const pct = (a, b) => b ? (100 * a / b).toFixed(2) + '%' : '—';
  console.log('\n=== POSE CONTRA MOVIMENTO NA BOLA PARADA ===\n');
  console.log('bundle:', alvo);
  console.log('OS-207 instalada:', r.os207, '| ponte amostrada por ela:', r.pontePropria);
  console.log('partidas:', r.partidas, '| quadros de bola morta:', r.quadrosMortos);
  console.log('');
  console.log('amostras de locomocao  ', r.amostras,
              '| recolocacao administrativa (fora da conta):', r.admin);
  console.log('pose fora da faixa     ', r.poseErrada, '(' + pct(r.poseErrada, r.amostras) + ')');
  console.log('  desenhado PARADO e deslizando ', r.deslizando, '(' + pct(r.deslizando, r.amostras) + ')');
  console.log('  desenhado CORRENDO e parado   ', r.pedalando, '(' + pct(r.pedalando, r.amostras) + ')');
  console.log('');
  if (erros.length) { console.log('ERROS DE PAGINA:'); erros.forEach(e => console.log('  ', e)); }
  process.exit(0);
})();
