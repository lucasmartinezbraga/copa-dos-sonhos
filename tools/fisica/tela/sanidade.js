#!/usr/bin/env node
'use strict';
/* VARREDURA DE SANIDADE — procura defeito em vez de confirmar acerto
   -------------------------------------------------------------------------
   As outras sondas verificam invariantes que EU escolhi porque ja suspeitava
   deles. Esta faz o contrario: roda a partida inteira vigiando tudo que nunca
   pode acontecer, sem hipotese previa. E a rede que pega o bug que ninguem
   reportou ainda.

   Vigia, quadro a quadro:
     · NaN / Infinity em posicao, velocidade ou altura, de bola ou de atleta
     · atleta ou bola fora dos limites do campo
     · velocidade acima do fisicamente possivel
     · bola parada viva demais (cerimonia que nao termina)
     · bola solta parada no meio do campo sem ninguem disputar
     · posse impossivel: dono expulso, dono nulo com a bola colada
     · relogio que anda para tras
     · erro de pagina em qualquer quadro (inclui o laco de desenho)

   Uso: node tools/fisica/tela/sanidade.js [bundle.html] [--segundos=N]
*/

const path = require('path');
const { pathToFileURL } = require('url');

function carregarPlaywright() {
  for (const cand of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(cand); } catch (_) { }
  }
  console.error('playwright nao encontrado; sonda pulada');
  process.exit(0);
}

const { chromium } = carregarPlaywright();
const argv = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
const alvo = path.resolve(process.argv.slice(2).find(a => !a.startsWith('--')) || 'dist/index.html');
const SEGUNDOS = Number(argv.segundos || 240);

(async () => {
  const navegador = await chromium.launch({
    headless: true,
    ...(process.env.CDS_CHROMIUM ? { executablePath: process.env.CDS_CHROMIUM } : {}),
    args: ['--no-sandbox'],
  });
  const pagina = await navegador.newPage({ viewport: { width: 1366, height: 768 } });
  const erros = [];
  pagina.on('pageerror', e => erros.push(String(e)));
  pagina.on('console', m => { if (m.type() === 'error') erros.push('console: ' + m.text().slice(0, 160)); });
  await pagina.goto(pathToFileURL(alvo).href, { waitUntil: 'load', timeout: 120000 });
  await pagina.waitForTimeout(1500);

  await pagina.evaluate(() => {
    const FLv = window.FL || 105, FWv = window.FW || 68;
    const S = window.__san = { quadros: 0, achados: Object.create(null), exemplos: Object.create(null) };
    const flag = (k, ex) => {
      S.achados[k] = (S.achados[k] || 0) + 1;
      if (!S.exemplos[k]) S.exemplos[k] = ex;
    };
    const fin = v => typeof v === 'number' && isFinite(v);
    const P = window.MatchSim.prototype;
    const old = P.step;
    let tAnt = -1, deadDesde = -1, soltaDesde = -1;

    P.step = function (dt) {
      const r = old.apply(this, arguments);
      try {
        S.quadros++;
        const b = this.ball, t = Number(this.t) || 0;

        if (tAnt >= 0 && t < tAnt - 1e-9) flag('relogio_para_tras', { t, tAnt });
        tAnt = t;

        if (b) {
          if (!fin(b.x) || !fin(b.y) || !fin(b.z)) flag('bola_NaN', { x: b.x, y: b.y, z: b.z });
          else {
            /* Fora do campo SO conta se a bola nao estiver em voo: um chute
               que passa por cima cruza a linha de fundo e continua no ar ate
               pousar -- isso e futebol, nao defeito. A primeira versao desta
               sonda contava os quadros de voo e acusou ~107 "bolas fora" por
               partida; medindo por EPISODIO, sao 1 episodio de 0,02 s, com a
               bola viajando. O flag util e a bola PARADA fora do campo. */
            if (!b.traveling && (b.x < -2 || b.x > FLv + 2 || b.y < -2 || b.y > FWv + 2))
              flag('bola_parada_fora_do_campo', { x: +b.x.toFixed(1), y: +b.y.toFixed(1) });
            if (b.z < -0.05) flag('bola_abaixo_do_gramado', { z: +b.z.toFixed(2) });
            if (b.z > 45) flag('bola_alta_demais', { z: +b.z.toFixed(1) });
          }
          if (!fin(b.vx) || !fin(b.vy) || !fin(b.vz)) flag('velocidade_da_bola_NaN', {});
          else if (Math.hypot(b.vx, b.vy, b.vz) > 70) flag('bola_rapida_demais', { v: +Math.hypot(b.vx, b.vy, b.vz).toFixed(1) });

          const o = b.owner;
          if (o && o.red) flag('dono_expulso', { n: o.ref && o.ref.n });
          if (o && !fin(o.x)) flag('dono_sem_posicao', {});
          /* bola solta e imovel no meio do campo por muito tempo = lance morto */
          const parada = !o && !b.traveling && Math.hypot(b.vx || 0, b.vy || 0) < 0.2 && !(this.dead > 0);
          if (parada) { if (soltaDesde < 0) soltaDesde = t; else if (t - soltaDesde > 6) { flag('bola_solta_parada_6s', { x: +b.x.toFixed(1), y: +b.y.toFixed(1) }); soltaDesde = t; } }
          else soltaDesde = -1;
        }

        if (this.dead > 0) { if (deadDesde < 0) deadDesde = t; else if (t - deadDesde > 25) { flag('bola_morta_25s', { dead: +this.dead.toFixed(2) }); deadDesde = t; } }
        else deadDesde = -1;

        for (const tm of this.teams || []) {
          for (const p of tm.players || []) {
            if (!p || p.red) continue;
            if (!fin(p.x) || !fin(p.y)) { flag('jogador_NaN', { n: p.ref && p.ref.n }); continue; }
            if (p.x < -1 || p.x > FLv + 1 || p.y < -1 || p.y > FWv + 1)
              flag('jogador_fora_do_campo', { n: p.ref && p.ref.n, x: +p.x.toFixed(1), y: +p.y.toFixed(1) });
            if (!fin(p.vx) || !fin(p.vy)) flag('velocidade_de_jogador_NaN', { n: p.ref && p.ref.n });
            else {
              const v = Math.hypot(p.vx, p.vy);
              if (v > (p.maxSpd || 7) * 1.6) flag('jogador_rapido_demais', { n: p.ref && p.ref.n, v: +v.toFixed(1), max: p.maxSpd });
            }
            if (!fin(p.stamina) || p.stamina < 0 || p.stamina > 100)
              flag('folego_invalido', { n: p.ref && p.ref.n, s: p.stamina });
          }
        }
      } catch (e) { flag('excecao_na_sonda', { msg: String(e && e.message) }); }
      return r;
    };
  });

  const nome = await pagina.evaluate(() => window.__quickMatch(40, 120));
  if (!/ x /.test(String(nome))) { console.error('partida nao subiu:', nome); await navegador.close(); process.exit(2); }
  await pagina.waitForTimeout(SEGUNDOS * 1000);
  const r = await pagina.evaluate(() => ({ s: window.__san, minuto: window.GAME._sim().minute }));
  await navegador.close();

  console.log('\n=== VARREDURA DE SANIDADE ===\n');
  console.log('bundle:', alvo, '| minuto:', r.minuto.toFixed(1), '| quadros:', r.s.quadros);
  const ks = Object.keys(r.s.achados).sort((a, b) => r.s.achados[b] - r.s.achados[a]);
  if (!ks.length) console.log('\nnenhum defeito de sanidade encontrado.');
  else {
    console.log('');
    for (const k of ks) {
      console.log('  ' + k.padEnd(30), String(r.s.achados[k]).padStart(8),
                  ' ex: ' + JSON.stringify(r.s.exemplos[k]));
    }
  }
  console.log('');
  if (erros.length) { console.log('ERROS DE PAGINA (' + erros.length + '):'); [...new Set(erros)].slice(0, 8).forEach(e => console.log('  ', e.slice(0, 200))); }
  else console.log('nenhum erro de pagina.');
  process.exit(0);
})();
