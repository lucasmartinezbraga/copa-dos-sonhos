#!/usr/bin/env node
'use strict';
/* FLUXO — nivel N6: as telas, no navegador de verdade
   =========================================================================
   Era o maior buraco declarado da metodologia: tudo que a auditoria via era o
   motor. Draft, escalacao, navegacao e mobile ficavam fora — e sao a metade do
   jogo que o jogador toca com o dedo.

   O que este nivel pergunta, em cada tamanho de tela:

     · a pagina sobe sem erro de script e sem console.error?
     · o documento vaza para os lados (rolagem horizontal)?
     · algum elemento estoura a largura da janela?
     · existe id repetido no DOM VIVO? (id repetido faz querySelector pegar o
       primeiro, e o primeiro pode ser o invisivel — botao que nao responde)
     · algum botao esta coberto por outro elemento no proprio centro?
       (`elementFromPoint` no centro do botao devolve outra coisa)
     · alvo de toque menor que 32 px no celular?
     · texto abaixo de 11 px?
     · e a tela de partida sobe e desenha?

   Cada tela vira um PNG em reports/auditoria/tela/, que e a evidencia.

   Uso:
     node tools/auditoria/fluxo.js --build=dist/index.html
     node tools/auditoria/fluxo.js --build=... --out=reports/auditoria/N6-fluxo.json
*/
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

function carregarPlaywright() {
  for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(c); } catch (_) {}
  }
  console.error('playwright nao encontrado — nivel N6 pulado');
  process.exit(0);
}
const { chromium } = carregarPlaywright();

const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
const alvo = path.resolve(argv.build || 'dist/index.html');
const dirPng = argv.png || 'reports/auditoria/tela';

const TELAS = [
  { nome: 'desktop', width: 1366, height: 768, movel: false },
  { nome: 'tablet', width: 820, height: 1180, movel: false },
  { nome: 'celular', width: 390, height: 844, movel: true },
];

/* Roda dentro da pagina: e o unico lugar onde da para perguntar o que esta
   realmente na tela. */
function auditarPagina(movel) {
  const out = { rolagemHorizontal: 0, estouram: [], idsRepetidos: [], botoesCobertos: [],
    alvosPequenos: [], textoMiudo: 0, appVisivel: false, botoes: 0 };
  const W = window.innerWidth;
  out.rolagemHorizontal = Math.max(0, document.documentElement.scrollWidth - W);

  const app = document.querySelector('#app');
  if (app) { const r = app.getBoundingClientRect(); out.appVisivel = r.width > 0 && r.height > 0; }

  /* ids repetidos no DOM vivo */
  const conta = Object.create(null);
  for (const el of document.querySelectorAll('[id]')) conta[el.id] = (conta[el.id] || 0) + 1;
  for (const k of Object.keys(conta)) {
    if (conta[k] > 1) {
      const els = Array.from(document.querySelectorAll('[id="' + CSS.escape(k) + '"]'));
      const visiveis = els.filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
      out.idsRepetidos.push({ id: k, n: els.length, visiveis: visiveis.length,
        primeiroEVisivel: !!(els[0] && els[0].getBoundingClientRect().width > 0) });
    }
  }

  const visivel = el => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05;
  };

  /* Um elemento que passa da borda dentro de uma faixa que ROLA de lado nao
     esta estourando: esta esperando o dedo. Sem esta checagem a ferramenta
     acusa toda barra de chips do jogo — foi o segundo alarme falso dela. */
  const dentroDeRolagem = el => {
    for (let a = el.parentElement; a; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (/(auto|scroll)/.test(cs.overflowX) && a.scrollWidth > a.clientWidth + 2) return true;
    }
    return false;
  };
  for (const el of document.querySelectorAll('*')) {
    if (!visivel(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > W + 2 && r.width < W * 3 && !dentroDeRolagem(el)) {
      out.estouram.push({ tag: el.tagName.toLowerCase(),
        classe: String(el.className || '').slice(0, 40),
        estouraPx: Math.round(r.right - W) });
    }
    const cs = getComputedStyle(el);
    if (el.childElementCount === 0 && el.textContent && el.textContent.trim() &&
        parseFloat(cs.fontSize) < 11) out.textoMiudo++;
  }
  out.estouram = out.estouram.slice(0, 12);

  const clicaveis = document.querySelectorAll('button, [role="button"], a[href], input, select');
  out.botoes = clicaveis.length;
  for (const el of clicaveis) {
    if (!visivel(el)) continue;
    const r = el.getBoundingClientRect();
    if (movel && (r.width < 32 || r.height < 32)) {
      out.alvosPequenos.push({ texto: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 28),
        w: Math.round(r.width), h: Math.round(r.height) });
    }
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx < 0 || cy < 0 || cx > W || cy > window.innerHeight) continue;
    const topo = document.elementFromPoint(cx, cy);
    if (topo && topo !== el && !el.contains(topo) && !topo.contains(el)) {
      out.botoesCobertos.push({ texto: (el.textContent || '').trim().slice(0, 28),
        coberto: topo.tagName.toLowerCase() + '.' + String(topo.className || '').slice(0, 26) });
    }
  }
  out.alvosPequenos = out.alvosPequenos.slice(0, 10);
  out.botoesCobertos = out.botoesCobertos.slice(0, 10);
  return out;
}

(async () => {
  fs.mkdirSync(dirPng, { recursive: true });
  const navegador = await chromium.launch({ headless: true,
    ...(process.env.CDS_CHROMIUM ? { executablePath: process.env.CDS_CHROMIUM } : {}),
    args: ['--no-sandbox'] });

  const resultado = [];
  for (const t of TELAS) {
    const pagina = await navegador.newPage({ viewport: { width: t.width, height: t.height },
      isMobile: t.movel, hasTouch: t.movel,
      userAgent: t.movel ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : undefined });
    const erros = [], consoleErros = [];
    pagina.on('pageerror', e => erros.push(String(e).slice(0, 200)));
    pagina.on('console', m => { if (m.type() === 'error') consoleErros.push(m.text().slice(0, 200)); });

    const t0 = Date.now();
    await pagina.goto(pathToFileURL(alvo).href, { waitUntil: 'load', timeout: 120000 });
    await pagina.waitForTimeout(2200);
    const bootMs = Date.now() - t0;

    const telas = [];
    const medir = async (nome) => {
      const r = await pagina.evaluate(auditarPagina, t.movel);
      const png = path.join(dirPng, `${t.nome}-${nome}.png`);
      await pagina.screenshot({ path: png });
      telas.push(Object.assign({ tela: nome, png: png }, r));
      return r;
    };

    await medir('inicio');

    /* caminho 1: o botao principal da home */
    try {
      const bt = await pagina.$('#bt-start');
      if (bt) { await bt.click({ timeout: 4000 }); await pagina.waitForTimeout(1600); await medir('apos-montar-time'); }
      else telas.push({ tela: 'apos-montar-time', erro: '#bt-start ausente' });
    } catch (e) { telas.push({ tela: 'apos-montar-time', erro: String(e).slice(0, 140) }); }

    /* caminho 2: a tela de partida, pelo atalho de desenvolvimento */
    let partida = null;
    try {
      const r = await pagina.evaluate(() => {
        if (typeof window.__quickMatch !== 'function') return { erro: '__quickMatch ausente' };
        const nome = window.__quickMatch(40, 120);
        return { ok: true, nome };
      });
      if (r.ok) {
        await pagina.waitForTimeout(3000);
        const m = await medir('partida');
        partida = await pagina.evaluate(() => {
          const sim = window.GAME && window.GAME._sim && window.GAME._sim();
          /* o MAIOR canvas desenhado e o campo; `querySelector` pegava um
             canvas auxiliar de 0x0 e reportava a partida como sem imagem */
          let cv = null, area = -1;
          for (const c of document.querySelectorAll('canvas')) {
            const r = c.getBoundingClientRect();
            if (r.width * r.height > area) { area = r.width * r.height; cv = c; }
          }
          const rc = cv ? cv.getBoundingClientRect() : null;
          const fracaoCampo = rc ? +((rc.width * rc.height) / (window.innerWidth * window.innerHeight)).toFixed(3) : null;
          return { fracaoDaTelaComCampo: fracaoCampo,
            simulou: sim ? +sim.t.toFixed(1) : null, minuto: sim ? +sim.minute.toFixed(1) : null,
            canvasNaPagina: document.querySelectorAll('canvas').length,
            temCanvas: !!cv, canvas: cv ? { w: cv.width, h: cv.height,
              css: Math.round(cv.getBoundingClientRect().width) + 'x' + Math.round(cv.getBoundingClientRect().height) } : null };
        });
        partida.medida = { rolagemHorizontal: m.rolagemHorizontal, estouram: m.estouram.length };
      } else partida = r;
    } catch (e) { partida = { erro: String(e).slice(0, 140) }; }

    resultado.push({ viewport: `${t.width}x${t.height}`, nome: t.nome, movel: t.movel,
      bootMs, erros, consoleErros: Array.from(new Set(consoleErros)).slice(0, 6), telas, partida });
    await pagina.close();
  }
  await navegador.close();

  const saida = { ferramenta: 'tools/auditoria/fluxo.js', geradoEm: new Date().toISOString(),
    build: path.basename(alvo), telas: resultado };
  if (argv.out) {
    fs.mkdirSync(path.dirname(argv.out), { recursive: true });
    fs.writeFileSync(argv.out, JSON.stringify(saida, null, 2));
  }
  console.log(legivel(saida));
  if (argv.out) console.log(`\njson -> ${argv.out}   pngs -> ${dirPng}/`);
})().catch(e => { console.error(e); process.exit(1); });

function legivel(s) {
  const L = ['', '=== FLUXO DE TELAS (N6) ===', `build ${s.build}`, ''];
  for (const v of s.telas) {
    L.push(`--- ${v.nome} ${v.viewport}${v.movel ? ' (toque)' : ''}  boot ${v.bootMs} ms`);
    if (v.erros.length) L.push(`    ERRO DE SCRIPT: ${v.erros.join(' | ')}`);
    if (v.consoleErros.length) L.push(`    console.error: ${v.consoleErros.join(' | ')}`);
    for (const t of v.telas) {
      if (t.erro) { L.push(`    ${String(t.tela).padEnd(18)} FALHOU: ${t.erro}`); continue; }
      const p = [];
      if (t.rolagemHorizontal > 0) p.push(`rolagem horizontal +${t.rolagemHorizontal}px`);
      if (t.estouram.length) p.push(`${t.estouram.length} elemento(s) estourando`);
      if (t.idsRepetidos.length) p.push(`${t.idsRepetidos.length} id(s) repetidos`);
      if (t.botoesCobertos.length) p.push(`${t.botoesCobertos.length} botao(oes) cobertos`);
      if (t.alvosPequenos.length) p.push(`${t.alvosPequenos.length} alvo(s) < 32px`);
      if (t.textoMiudo) p.push(`${t.textoMiudo} texto(s) < 11px`);
      if (!t.appVisivel) p.push('#app com tamanho zero');
      L.push(`    ${String(t.tela).padEnd(18)} ${t.botoes} clicaveis  ${p.length ? '· ' + p.join(' · ') : '· limpo'}`);
      for (const b of (t.botoesCobertos || []).slice(0, 3)) L.push(`         coberto: "${b.texto}" por ${b.coberto}`);
      for (const a of (t.alvosPequenos || []).slice(0, 3)) L.push(`         pequeno: "${a.texto}" ${a.w}x${a.h}`);
      for (const i of (t.idsRepetidos || []).slice(0, 3)) L.push(`         id "${i.id}" x${i.n} (visiveis: ${i.visiveis}, o 1o e visivel: ${i.primeiroEVisivel})`);
    }
    if (v.partida) {
      L.push(`    partida: ${v.partida.erro ? 'FALHOU — ' + v.partida.erro :
        `simulou ${v.partida.simulou}s ate ${v.partida.minuto}'  canvas ${v.partida.canvas ? v.partida.canvas.w + 'x' + v.partida.canvas.h + ' (css ' + v.partida.canvas.css + ')' : 'ausente'}` +
        (v.partida.fracaoDaTelaComCampo != null ? `  ·  o CAMPO ocupa ${(v.partida.fracaoDaTelaComCampo * 100).toFixed(0)}% da tela` : '')}`);
    }
    L.push('');
  }
  return L.join('\n');
}
