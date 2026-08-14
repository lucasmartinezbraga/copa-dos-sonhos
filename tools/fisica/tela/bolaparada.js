#!/usr/bin/env node
'use strict';
/* BOLA PARADA NA TELA — falta e escanteio, quadro a quadro.
   =========================================================================
   As baterias nao veem animacao: `vm.runInThisContext` nao desenha nada. Toda
   a familia de defeitos "parece bugado quando o jogador vai bater" e invisivel
   para as 14 metricas, para o placar de design e para o do futebol real.

   Esta sonda abre o jogo de verdade no Chromium, fica esperando um ESCANTEIO ou
   uma FALTA acontecer, e entao fotografa uma rajada de quadros desde o apito
   ate depois da batida — com o estado do sim lido no MESMO instante de cada
   foto, para a imagem e o numero falarem do mesmo quadro.

   O que cada foto carrega no estado:
     dead / pendingRestart   o relogio da bola parada
     bola x,y,z              onde ela esta, e se esta no chao
     cobrador                quem foi designado, e a que distancia da bola
     _setPieceRole           os papeis que a camada de escanteio distribuiu
     andando                 quantos jogadores tem velocidade > 0,3 m/s

   Uso:
     node tools/fisica/tela/bolaparada.js [build.html] [saida] [eventos] [ms]
*/
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const alvo = path.resolve(process.argv[2] || 'dist/index.html');
const saida = process.argv[3] || '/tmp/bolaparada';
const nEventos = Number(process.argv[4] || 4);
const passo = Number(process.argv[5] || 260);   // ms entre quadros da rajada
const QUADROS = 10;                              // quadros por evento
fs.mkdirSync(saida, { recursive: true });

const LER = () => {
  const sim = window.__CDS_ACTIVE_SIM;
  if (!sim || !sim.teams) return null;
  const b = sim.ball || {};
  const fin = v => (typeof v === 'number' && isFinite(v)) ? +v.toFixed(2) : null;
  let cobrador = null, andando = 0, papeis = [];
  for (const tm of sim.teams) for (const p of tm.players) {
    if (!p || p.red) continue;
    const v = Math.hypot(+p.vx || 0, +p.vy || 0);
    if (v > 0.3) andando++;
    if (p._setPieceRole) papeis.push({ pos: p.slotPos, papel: p._setPieceRole,
      d: fin(Math.hypot((+p.x) - (+b.x), (+p.y) - (+b.y))) });
    if (p._isTaker || p.__taker || p._setPieceRole === 'taker') cobrador = p;
  }
  /* o cobrador raramente tem flag: pega o mais proximo da bola parada */
  if (!cobrador && (sim.dead > 0 || sim.pendingRestart)) {
    let melhor = 1e9;
    for (const tm of sim.teams) for (const p of tm.players) {
      if (!p || p.red || p.isGK) continue;
      const d = Math.hypot((+p.x) - (+b.x), (+p.y) - (+b.y));
      if (d < melhor) { melhor = d; cobrador = p; }
    }
  }
  return {
    minuto: fin(sim.minute), dead: fin(sim.dead),
    pendingRestart: !!sim.pendingRestart, waiting: !!sim.waiting,
    bola: { x: fin(b.x), y: fin(b.y), z: fin(b.z), viajando: !!b.traveling,
            dono: b.owner ? b.owner.slotPos : null },
    cobrador: cobrador ? { pos: cobrador.slotPos, time: cobrador.team,
      x: fin(cobrador.x), y: fin(cobrador.y),
      dist: fin(Math.hypot((+cobrador.x) - (+b.x), (+cobrador.y) - (+b.y))),
      vel: fin(Math.hypot(+cobrador.vx || 0, +cobrador.vy || 0)),
      settle: fin(cobrador.settle) } : null,
    andando, papeis: papeis.slice(0, 8),
  };
};

(async () => {
  const nav = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const pg = await nav.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on('pageerror', e => console.error('ERRO NA PAGINA:', String(e).slice(0, 200)));
  await pg.goto(pathToFileURL(alvo).href, { waitUntil: 'load', timeout: 120000 });
  await pg.waitForTimeout(1800);
  /* velocidade 1 para a animacao acontecer em tempo real */
  await pg.evaluate(() => { window.__quickMatch(40, 120); window.G.speed = 1; });
  await pg.waitForTimeout(2000);

  /* marca no proprio jogo quando um escanteio ou uma falta e emitido */
  await pg.evaluate(() => {
    const sim = window.__CDS_ACTIVE_SIM;
    if (!sim) return;
    window.__bp = { fila: [] };
    const P = Object.getPrototypeOf(sim), old = P._emit;
    sim._emit = function (tipo, dados) {
      if (tipo === 'corner' || tipo === 'foul' || tipo === 'freekick') {
        window.__bp.fila.push({ tipo, t: +this.t, minuto: +this.minute });
      }
      return old.apply(this, arguments);
    };
  });

  const caixa = await pg.evaluate(() => {
    const cs = [...document.querySelectorAll('canvas')]
      .map(c => { const r = c.getBoundingClientRect(); return { r, a: r.width * r.height }; })
      .sort((a, b) => b.a - a.a);
    if (!cs.length) return null;
    const r = cs[0].r;
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  if (!caixa) { console.error('nenhum canvas visivel'); await nav.close(); process.exit(1); }

  const registro = [];
  let pegos = 0, espera = 0;
  while (pegos < nEventos && espera < 900) {
    await pg.waitForTimeout(150); espera++;
    const ev = await pg.evaluate(() => (window.__bp && window.__bp.fila.shift()) || null);
    if (!ev) continue;
    pegos++;
    console.log(`\n=== ${ev.tipo.toUpperCase()} no minuto ${ev.minuto.toFixed(1)} ===`);
    for (let k = 0; k < QUADROS; k++) {
      const est = await pg.evaluate(LER);
      const arq = path.join(saida, `${String(pegos).padStart(2, '0')}-${ev.tipo}-q${String(k).padStart(2, '0')}.png`);
      await pg.screenshot({ path: arq, clip: caixa });
      if (est) {
        registro.push({ foto: path.basename(arq), evento: ev.tipo, quadro: k, ...est });
        const c = est.cobrador;
        console.log(`  q${String(k).padStart(2)}  dead ${String(est.dead).padStart(5)}` +
          ` pend ${est.pendingRestart ? 'S' : 'n'}` +
          `  bola (${est.bola.x}, ${est.bola.y}) z=${est.bola.z}${est.bola.viajando ? ' VOANDO' : ''}` +
          (c ? `  cobrador ${c.pos} a ${c.dist} m, vel ${c.vel}` : '  (sem cobrador)') +
          `  andando ${est.andando}` + (est.papeis.length ? `  papeis ${est.papeis.length}` : ''));
      }
      await pg.waitForTimeout(passo);
    }
  }
  fs.writeFileSync(path.join(saida, 'estado.json'), JSON.stringify(registro, null, 1));
  console.log(`\n${pegos} evento(s), ${registro.length} fotos em ${saida}`);
  await nav.close();
})().catch(e => { console.error(e); process.exit(1); });
