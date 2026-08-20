#!/usr/bin/env node
'use strict';
/* O CORTE DO LANCE — o véu esconde a arrumação, ou só esconde a imagem?
   =========================================================================
   POR QUE ESTA SONDA EXISTE. A OS-267/268 põe um corte de transmissão sobre o
   reposicionamento: a tela escurece, o campo se monta escondido, a imagem
   volta pronta. Isso tem DOIS jeitos de dar errado, e nenhum aparece em
   `verify`, `smoke` ou na bateria — todos continuam certos com a tela preta:

     · o corte é curto demais e a imagem volta com metade do time andando;
     · o corte é longo demais e o dono fica olhando um retângulo preto.

   A primeira versão da OS-268 conseguiu OS DOIS AO MESMO TEMPO — 1,9 s de véu
   com onze jogadores ainda caminhando ao voltar — e passou em tudo. Só medindo
   as duas grandezas JUNTAS o defeito aparece: cada uma sozinha tem um remédio
   que piora a outra.

   NÃO É DESTRUTIVA. `__cdsCorte` consome estado (anula a janela quando a bola
   volta a rolar), então chamá-la para medir MUDA o que o render vê. Esta sonda
   ENVOLVE a chamada que o laço já faz e grava o que ela devolveu.

   O QUE MEDE, por janela de véu:

     C1  ao voltar a imagem, quantos ainda têm `__spTarget` (0 é o alvo)
     C2  duração total do véu, de parede
     C3  quanto tempo ficou PRETO de verdade (alfa > 0,98)
     C4  quanto tempo de parede a arrumação leva depois de cada `_kickoff`

   C1 SÓ VALE PARA O CORTE DO PONTAPÉ, e a distinção é de projeto. O corte da
   falta tem duração FIXA e não espera nada: ele cobre a barreira se formando, e
   o batedor andando até a bola depois que a imagem volta é futebol — é o que a
   cerimônia da OS-263 existe para deixar você ver. Só o corte do pontapé é
   adaptativo, e é dele a promessa de "voltar com tudo já reajustado".

   §0 · PROVA DE OBSERVAÇÃO (OS-247). O caso que interessa é o pontapé depois
   do gol, e gol é estocástico: uma janela de uma partida pode ter zero. Em vez
   de sortear o veredito, a sonda RECOMEÇA a partida até juntar a amostra, com
   teto de tempo. Chegar no teto sem nenhum corte de arrumação grande REPROVA —
   zero observação não é zero defeito.

   Uso: node tools/fisica/tela/o-corte-do-lance.js --vel=3 --seg=700
*/
const path = require('path');
const { pathToFileURL } = require('url');
function carregarPlaywright() {
  for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(c); } catch (_) { }
  }
  console.error('playwright nao encontrado; ferramenta pulada'); process.exit(0);
}
const { chromium } = carregarPlaywright();
const argv = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
const alvo = path.resolve(argv.build || process.argv.slice(2).find(a => !a.startsWith('--')) || 'dist/index.html');
const VEL = Number(argv.vel || 3);
const SEG = Number(argv.seg || 700);          // teto de parede da colheita

/* Tetos. Saem do que foi medido, não de gosto — ver o laudo da OS-268. */
const TETO_VEU = 1400;      // ms de parede: janela inteira, saída + escuro + entrada
const TETO_PRETO = 900;     // ms de parede: só o alfa cheio
const TETO_ARRUMA = 1200;   // ms de parede: caminhada de volta depois do pontapé
const ANDANDO_OK = 2;       // quantos ainda podem estar caminhando quando a imagem volta
const ARRUMACAO_GRANDE = 10; // atletas caminhando que fazem a janela valer como amostra
const ALVO_GRANDES = 2;     // quantas dessas bastam para decidir
const ALVO_FALTAS = 8;

(async () => {
  const nav = await chromium.launch({
    headless: true,
    ...(process.env.CDS_CHROMIUM ? { executablePath: process.env.CDS_CHROMIUM } : {}),
    args: ['--no-sandbox'],
  });
  const pg = await nav.newPage({ viewport: { width: 1366, height: 768 } });
  const erros = []; pg.on('pageerror', e => erros.push(String(e)));
  await pg.goto(pathToFileURL(alvo).href, { waitUntil: 'load', timeout: 120000 });
  await pg.waitForTimeout(1200);

  /* Os ganchos vivem no PROTÓTIPO e no `window`: sobrevivem a `__quickMatch`,
     que troca o `sim` mas não a classe. Instalados uma vez só. */
  const instalado = await pg.evaluate((vel) => {
    if (window.G) window.G.speed = vel;
    const L = window.__CDS_CORTE_SONDA = { ev: [], veu: [], partidas: 0 };
    const M = window.MatchSim && window.MatchSim.prototype;
    if (!M) return 'MatchSim ausente';
    const andando = s => {
      let n = 0;
      try { for (const tm of s.teams) for (const p of tm.players) if (p && !p.red && p.__spTarget) n++; } catch (_) { }
      return n;
    };
    const oEmit = M._emit;
    M._emit = function (t) {
      try { L.ev.push({ t: performance.now(), tipo: t }); } catch (_) { }
      return oEmit.apply(this, arguments);
    };
    /* a arrumação acaba quando o último `__spTarget` some; marca no passo */
    const oStep = M.step;
    M.step = function () {
      const r = oStep.apply(this, arguments);
      try {
        window.__CDS_SIM_VIVO = this;   // o `sim` do render nao e exposto em `G`
        /* `andando` varre 22 atletas e o laco de render roda MUITOS passos por
           quadro: so contar quando ha pontape aberto, senao a propria sonda
           engrossa o quadro e distorce o relogio de parede que ela mede */
        if (this.__sondaKick && andando(this) === 0) {
          L.ev.push({ t: performance.now(), tipo: '_arrumado', desde: Math.round(performance.now() - this.__sondaKick) });
          this.__sondaKick = null;
        }
      } catch (_) { }
      return r;
    };
    const oKick = M._kickoff;
    M._kickoff = function (side, start) {
      const r = oKick.apply(this, arguments);
      try {
        L.ev.push({ t: performance.now(), tipo: '_kickoff', inicio: !!start, andando: andando(this) });
        this.__sondaKick = performance.now();
      } catch (_) { }
      return r;
    };
    /* ENVOLVE o consumidor real em vez de chamar um segundo */
    const oCorte = window.__cdsCorte;
    if (typeof oCorte !== 'function') { L.semCorte = true; return 'sem __cdsCorte'; }
    window.__cdsCorte = function (sim) {
      const v = oCorte.apply(this, arguments);
      try {
        L.veu.push({ t: performance.now(), v: v ? v.veu : 0, tipo: v ? v.tipo : null, andando: sim ? andando(sim) : -1 });
        if (L.veu.length > 120000) L.veu.shift();
      } catch (_) { }
      return v;
    };
    return 'ok';
  }, VEL);

  const comecar = async (i) => pg.evaluate(([a, b, vel]) => {
    const n = window.__quickMatch(a, b);
    if (window.G) window.G.speed = vel;
    if (window.__CDS_CORTE_SONDA) window.__CDS_CORTE_SONDA.partidas++;
    return n;
  }, [40 + (i * 7) % 60, 120 + (i * 11) % 60, VEL]);

  const nome = await comecar(0);
  if (!/ x /.test(String(nome))) { console.error('partida nao subiu:', nome); await nav.close(); process.exit(2); }
  if (instalado !== 'ok') console.error('AVISO: ' + instalado);

  /* Recorta janelas contíguas de véu a partir das amostras cruas. */
  const recortar = veu => {
    const j = []; let cur = null;
    for (const a of veu) {
      if (a.v > 0.002) {
        if (!cur) cur = { ini: a.t, fim: a.t, tipo: a.tipo, preto: 0, quadros: 0, andandoIni: a.andando, andandoFim: a.andando, vales: 0 };
        cur.fim = a.t; cur.quadros++; if (a.v > 0.98) cur.preto++;
        if (a.andando > cur.andandoIni) cur.andandoIni = a.andando;
        /* VALE: `andando` cai a zero e volta a subir dentro da mesma janela.
           Importa porque o escuro adaptativo para de se estender no primeiro
           quadro sem ninguem caminhando -- um vale de um quadro devolveria a
           imagem no meio da arrumacao. */
        if (cur.andandoFim === 0 && a.andando > 0 && cur.quadros > 1) cur.vales++;
        cur.andandoFim = a.andando; cur.tipo = cur.tipo || a.tipo;
      } else if (cur) { j.push(cur); cur = null; }
    }
    for (const w of j) {
      w.dur = w.fim - w.ini;
      w.pretoMs = w.quadros > 1 ? w.preto * (w.dur / (w.quadros - 1)) : 0;
    }
    return j;
  };

  /* COLHEITA. Espera em fatias; recomeça a partida quando ela acaba; para
     assim que a amostra basta. Assim o caso comum custa uma partida e o caso
     sem gol não vira sorteio. */
  const t0 = Date.now(); let partida = 0, janelas = [];
  while ((Date.now() - t0) / 1000 < SEG) {
    await pg.waitForTimeout(15000);
    const cru = await pg.evaluate(() => window.__CDS_CORTE_SONDA);
    janelas = recortar(cru.veu);
    const grandes = janelas.filter(w => w.tipo === 'kickoff' && w.andandoIni >= ARRUMACAO_GRANDE).length;
    const faltas = janelas.filter(w => w.tipo !== 'kickoff').length;
    if (grandes >= ALVO_GRANDES && faltas >= ALVO_FALTAS) break;
    const acabou = await pg.evaluate(() => {
      try { const s = window.__CDS_SIM_VIVO; return !!s && s.isOver && s.isOver(); } catch (_) { return false; }
    });
    if (acabou) { partida++; await comecar(partida); await pg.waitForTimeout(800); }
  }

  const L = await pg.evaluate(() => window.__CDS_CORTE_SONDA);
  await nav.close();
  janelas = recortar(L.veu);

  const conta = t => L.ev.filter(e => e.tipo === t).length;
  const grandes = janelas.filter(w => w.tipo === 'kickoff' && w.andandoIni >= ARRUMACAO_GRANDE);
  const deFalta = janelas.filter(w => w.tipo !== 'kickoff');
  const arrumadas = L.ev.filter(e => e.tipo === '_arrumado' && e.desde > 40);

  console.log('\n=== O CORTE DO LANCE ===  ' + VEL + 'X | ' + ((Date.now() - t0) / 1000).toFixed(0) +
    ' s | partidas ' + L.partidas + ' | gols ' + conta('goal') + ' | faltas ' + conta('foul') +
    ' | janelas ' + janelas.length + ' (' + grandes.length + ' com arrumacao grande)');
  if (erros.length) console.log('   ERROS DE PAGINA: ' + erros.slice(0, 3).join(' | '));

  const falhas = [];
  if (L.semCorte) falhas.push('`__cdsCorte` ausente: a camada do corte nao subiu');
  if (!janelas.length) falhas.push('SEM AMOSTRA: nenhuma janela de veu (OS-247)');
  if (deFalta.length < 3) falhas.push('SEM AMOSTRA: so ' + deFalta.length + ' corte(s) de falta (OS-247)');
  if (!grandes.length) falhas.push('SEM AMOSTRA: nenhum corte de PONTAPE cobrindo arrumacao de >= ' +
    ARRUMACAO_GRANDE + ' atletas em ' + SEG + ' s (OS-247)');

  const linha = (rot, arr, un) => {
    if (!arr.length) { console.log('   ' + rot.padEnd(44) + '       (sem amostra)'); return; }
    const o = arr.slice().sort((a, b) => a - b);
    console.log('   ' + rot.padEnd(44) + o[Math.floor(o.length / 2)].toFixed(0).padStart(6) + un +
      '   pior ' + o[o.length - 1].toFixed(0).padStart(5) + un + '   n ' + o.length);
  };
  console.log('');
  linha('C2 duracao do veu, falta', deFalta.map(w => w.dur), ' ms');
  linha('C2 duracao do veu, arrumacao grande', grandes.map(w => w.dur), ' ms');
  linha('C3 tempo de tela PRETA', janelas.map(w => w.pretoMs), ' ms');
  linha('C4 arrumacao depois do pontape', arrumadas.map(e => e.desde), ' ms');
  linha('C1 ainda caminhando ao voltar a imagem', grandes.map(w => w.andandoFim), '   ');

  /* Cada corte de pontapé, um por linha: a mediana esconde justamente o caso
     que interessa quando só há dois ou três por partida. */
  if (grandes.length) {
    console.log('\n   cada corte de pontape com arrumacao grande:');
    for (const w of grandes)
      console.log('     dur ' + w.dur.toFixed(0).padStart(5) + ' ms   preto ' +
        w.pretoMs.toFixed(0).padStart(4) + ' ms   caminhando ' + String(w.andandoIni).padStart(2) +
        ' -> ' + String(w.andandoFim).padStart(2) + '   vales ' + w.vales);
  }

  for (const w of janelas) {
    if (w.dur > TETO_VEU) falhas.push('veu de ' + w.dur.toFixed(0) + ' ms em `' + w.tipo + '` (teto ' + TETO_VEU + ')');
    if (w.pretoMs > TETO_PRETO) falhas.push('tela preta por ' + w.pretoMs.toFixed(0) + ' ms em `' + w.tipo + '` (teto ' + TETO_PRETO + ')');
  }
  for (const w of grandes) {
    if (w.andandoFim > ANDANDO_OK)
      falhas.push('a imagem voltou com ' + w.andandoFim + ' atletas ainda caminhando (limite ' + ANDANDO_OK + ')');
  }
  for (const e of arrumadas) {
    if (e.desde > TETO_ARRUMA)
      falhas.push('arrumacao levou ' + e.desde + ' ms de parede depois do pontape (teto ' + TETO_ARRUMA + ')');
  }

  console.log('');
  if (falhas.length) {
    console.log('   REPROVA — ' + falhas.length + ' defeito(s):');
    for (const f of falhas.slice(0, 12)) console.log('     · ' + f);
    process.exit(1);
  }
  console.log('   APROVA — o veu cobre a arrumacao e devolve a imagem com o campo montado.');
  process.exit(0);
})();
