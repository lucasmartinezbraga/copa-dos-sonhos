#!/usr/bin/env node
'use strict';
/* AUDITORIA DE BUGS — nivel N2/N3/N4 fora do navegador
   =========================================================================
   Roda uma amostra de partidas com o catalogo de oraculos ligado
   (tools/auditoria/invariantes.js) e devolve UM JSON com:

     · toda violacao encontrada, com semente e minuto (= receita de repeticao);
     · as sondas de ritmo (quanto de cada partida e bola morta, e quanto dura
       cada tipo de cerimonia);
     · os oraculos de amostra: funcionalidade morta, alvos de calibracao,
       vies de lado e determinismo.

   Uso:
     node tools/auditoria/auditoria.js --build=dist/index.html --partidas=24 --workers=6
     node tools/auditoria/auditoria.js --build=... --partidas=200 --workers=8 --out=reports/auditoria/x.json
     node tools/auditoria/auditoria.js --build=... --verificar-neutralidade
*/

const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');
const N = require('./nucleo.js');
const INV = require('./invariantes.js');

const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));

const DT = 1 / 30;
const CHAVES = ['shots', 'onTarget', 'goals', 'xg', 'corners', 'fouls', 'yellow', 'red',
  'passes', 'passOk', 'tackles', 'offsides', 'throwIns', 'goalKicks'];

/* ---------------------------------------------------------- uma partida */
function rodarUma(pop, i, opts) {
  const { sim, meta } = N.montarPartida(pop, i, opts);
  const obs = opts.semObservador ? null : INV.criarObservador(sim, meta, opts);
  let passos = 0;
  while (!sim.isOver() && passos++ < INV.LIM.passosMax) sim.step(DT);
  const terminou = sim.isOver();
  const linha = { i, semente: meta.semente, formacoes: meta.formacoes, estilos: meta.estilos,
    elencos: meta.elencos, placar: sim.score.slice(), passos, terminou,
    segundosSimulados: +(passos * DT).toFixed(1) };
  for (const k of CHAVES) linha[k] = (+sim.stats[0][k] || 0) + (+sim.stats[1][k] || 0);
  try {
    const vivos = [];
    for (const tm of sim.teams) for (const p of tm.players) if (p && !p.red) vivos.push(+p.stamina || 0);
    linha.staminaFinal = vivos.length ? vivos.reduce((a, b) => a + b, 0) / vivos.length : null;
  } catch (_) { linha.staminaFinal = null; }
  const r = obs ? obs.finalizar(passos, terminou) : { violacoes: [], contagem: {}, eventos: {}, golsSeq: [], sondas: {} };
  linha.golsSeq = r.golsSeq;
  return { linha, resultado: r, assinatura: assinar(sim) };
}

/* Assinatura de partida: o suficiente para provar que duas execucoes deram no
   MESMO jogo, e barato o bastante para rodar sempre. */
function assinar(sim) {
  let h = 0;
  const soma = v => { h = (h * 31 + Math.round(v * 1000)) % 2147483647; };
  soma(sim.score[0]); soma(sim.score[1]); soma(sim.minute); soma(sim.half);
  for (let s = 0; s < 2; s++) {
    const st = sim.stats[s];
    for (const k of Object.keys(st).sort()) if (typeof st[k] === 'number') soma(st[k]);
    for (const p of sim.teams[s].players) { soma(p.x); soma(p.y); soma(p.stamina); }
  }
  const b = sim.ball; if (b) { soma(b.x); soma(b.y); soma(b.z); }
  return h;
}

function rodarFatia(indices, opts) {
  const pop = N.montarPopulacao(opts.elenco);
  const partidas = [], violacoes = [];
  const contagem = Object.create(null);
  const eventos = Object.create(null);
  const cerimonia = Object.create(null);
  let segundosMortos = 0, segundosTotais = 0, pausas = 0;
  const falta = { n: 0, semContato: 0, dists: [], esperas: [], saidas: [], noPonto: [],
    desfechos: Object.create(null), amostras: [] };
  const recolocacao = [];
  const legal = Object.create(null);
  const cinza = { segundos: 0, quadros: 0, episodios: 0, metrosDeBola: 0, maiorEpisodio: 0 };
  let piscadas = 0;
  const vi = Object.create(null);
  const assinaturas = Object.create(null);

  for (const i of indices) {
    const { linha, resultado, assinatura } = rodarUma(pop, i, opts);
    partidas.push(linha);
    assinaturas[i] = assinatura;
    for (const v of resultado.violacoes) violacoes.push(v);
    for (const k of Object.keys(resultado.contagem)) contagem[k] = (contagem[k] || 0) + resultado.contagem[k];
    for (const k of Object.keys(resultado.eventos)) eventos[k] = (eventos[k] || 0) + resultado.eventos[k];
    const s = resultado.sondas || {};
    segundosMortos += s.segundosMortos || 0;
    segundosTotais += linha.segundosSimulados;
    pausas += s.pausas || 0;
    for (const k of Object.keys(s.cerimonia || {})) {
      const c = s.cerimonia[k];
      const acc = cerimonia[k] = cerimonia[k] || { n: 0, somaSim: 0, amostras: [] };
      acc.n += c.n; acc.somaSim += c.somaSim;
      acc.amostras.push(c.p50, c.p90, c.max);
    }
    piscadas += s.piscadasDeDead || 0;
    if (s.deadComJogoAndando) {
      const c = s.deadComJogoAndando;
      cinza.segundos += c.segundos; cinza.quadros += c.quadros;
      cinza.episodios += c.episodios; cinza.metrosDeBola += c.metrosDeBola;
      if (c.maiorEpisodio > cinza.maiorEpisodio) cinza.maiorEpisodio = c.maiorEpisodio;
    }
    if (s.recolocacaoDaBola && s.recolocacaoDaBola.n) recolocacao.push(...s.recolocacaoDaBola.bruto);
    for (const k of Object.keys(s.legalidadeDoReinicio || {})) {
      (legal[k] = legal[k] || []).push(...s.legalidadeDoReinicio[k].bruto);
    }
    const F = (s.falta || {});
    if (F.n) {
      falta.n += F.n; falta.semContato += F.semContatoVisivel || 0;
      falta.dists.push(...F.bruto.dists); falta.esperas.push(...F.bruto.esperas);
      falta.saidas.push(...F.bruto.saidas); falta.noPonto.push(...F.bruto.noPonto);
      for (const k of Object.keys(F.desfechos || {})) falta.desfechos[k] = (falta.desfechos[k] || 0) + F.desfechos[k];
      if (falta.amostras.length < 24) falta.amostras.push(...(s.faltasDetalhe || []).slice(0, 4));
    }
    for (const k of Object.keys(s.visualIntegrity || {})) {
      const v2 = Number(s.visualIntegrity[k]);
      if (Number.isFinite(v2)) vi[k] = (vi[k] || 0) + v2;
    }
  }
  return { partidas, violacoes, contagem, eventos, cerimonia, vi, assinaturas, falta, recolocacao, legal, cinza, piscadas,
    segundosMortos: +segundosMortos.toFixed(1), segundosTotais: +segundosTotais.toFixed(1), pausas };
}

/* ------------------------------------------------------------ agregacao */
function agregarPartidas(partidas) {
  const n = partidas.length || 1;
  const agregado = {};
  for (const k of CHAVES) {
    const v = partidas.map(p => p[k]).sort((a, b) => a - b);
    const media = v.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - media) ** 2, 0) / n);
    agregado[k] = { media: +media.toFixed(3), desvio: +sd.toFixed(3), min: v[0], max: v[n - 1] };
  }
  return agregado;
}

/* G2 — alvos de calibracao computaveis a partir desta amostra */
function alvosDeCalibracao(partidas, agregado) {
  const alvosPath = path.resolve(__dirname, '../../calibration/targets.json');
  if (!fs.existsSync(alvosPath)) return null;
  const alvos = JSON.parse(fs.readFileSync(alvosPath, 'utf8')).metrics || {};
  const n = partidas.length || 1;
  const placares = partidas.map(p => p.placar).filter(Boolean);
  const staminas = partidas.map(p => p.staminaFinal).filter(v => v != null);
  const shots = agregado.shots.media || 1e-9, passes = agregado.passes.media || 1e-9;
  const medidos = {
    goalsPerMatch: agregado.goals.media,
    shotsPerMatch: agregado.shots.media,
    xgPerMatch: agregado.xg.media,
    onTargetRate: agregado.onTarget.media / shots,
    passCompletion: agregado.passOk.media / passes,
    foulsPerMatch: agregado.fouls.media,
    yellowsPerMatch: agregado.yellow.media,
    redsPerMatch: agregado.red.media,
    cornersPerMatch: agregado.corners.media,
    drawRate: placares.length ? placares.filter(s => s[0] === s[1]).length / n : null,
    zeroZeroRate: placares.length ? placares.filter(s => s[0] === 0 && s[1] === 0).length / n : null,
    blowoutRate: placares.length ? placares.filter(s => Math.abs(s[0] - s[1]) >= 3).length / n : null,
    averageEndingStamina: staminas.length ? staminas.reduce((a, b) => a + b, 0) / staminas.length : null,
  };
  const fora = [];
  const tabela = {};
  for (const k of Object.keys(medidos)) {
    const alvo = alvos[k]; const v = medidos[k];
    if (!alvo || v == null) continue;
    const dentro = v >= alvo.min && v <= alvo.max;
    tabela[k] = { medido: +v.toFixed(4), min: alvo.min, alvo: alvo.target, max: alvo.max, dentro };
    if (!dentro) fora.push({ metrica: k, medido: +v.toFixed(4), faixa: [alvo.min, alvo.max], peso: alvo.weight || 1 });
  }
  return { tabela, fora };
}

/* G1 — evento que o codigo sabe emitir e que a amostra nunca viu */
function eventosDeclarados(caminho) {
  const { html } = N.blocosDoBundle(caminho);
  const set = new Set();
  const re = /_emit\(\s*['"]([a-zA-Z0-9_:-]+)['"]/g;
  let m; while ((m = re.exec(html))) set.add(m[1]);
  return Array.from(set).sort();
}

/* ============================================================== PROCESSOS */
if (process.env.CDS_AUD_FATIA) {
  N.instalarAmbiente();
  const consoleReal = console;
  global.console = { log: N.noop, warn: N.noop, error: consoleReal.error, info: N.noop, debug: N.noop };
  process.on('message', msg => {
    N.carregar(msg.build, {});
    const r = rodarFatia(msg.indices, msg.opts);
    process.send(r);
    process.exit(0);
  });
} else {
  const build = String(argv.build || 'dist/index.html');
  const total = Number(argv.partidas || 24);
  const W = Math.max(1, Number(argv.workers || 1));
  const opts = { elenco: String(argv.elenco || 'variado'),
    maxPorRegra: Number(argv['max-por-regra'] || 3) };
  const t0 = Date.now();

  if (argv['verificar-neutralidade']) {
    /* A auditoria so vale se NAO mudar o jogo. Aqui a prova: a mesma partida
       com e sem observador tem de dar a mesma assinatura. */
    N.instalarAmbiente();
    const consoleReal = console;
    global.console = { log: N.noop, warn: N.noop, error: consoleReal.error, info: N.noop, debug: N.noop };
    N.carregar(build, {});
    const pop = N.montarPopulacao(opts.elenco);
    const iguais = [];
    for (let i = 0; i < Number(argv.partidas || 3); i++) {
      const com = rodarUma(pop, i, opts).assinatura;
      const sem = rodarUma(pop, i, Object.assign({}, opts, { semObservador: true })).assinatura;
      iguais.push({ partida: i, com, sem, igual: com === sem });
    }
    consoleReal.log(JSON.stringify({ neutralidade: iguais,
      ok: iguais.every(x => x.igual) }, null, 2));
    process.exit(iguais.every(x => x.igual) ? 0 : 1);
  }

  const indices = Array.from({ length: total }, (_, i) => i);
  const finalizar = (r) => {
    const agregado = agregarPartidas(r.partidas);
    const declarados = eventosDeclarados(build);
    const observados = Object.keys(r.eventos).sort();
    const mortos = declarados.filter(e => !r.eventos[e]);
    /* cerimonia: os percentis vem das fatias; aqui fica a media ponderada da
       soma e a pior amostra vista. */
    const cerimonia = {};
    for (const k of Object.keys(r.cerimonia).sort()) {
      const c = r.cerimonia[k];
      cerimonia[k] = { n: c.n, porPartida: +(c.n / total).toFixed(2),
        somaSimTotal: +c.somaSim.toFixed(1),
        mediaSim: c.n ? +(c.somaSim / c.n).toFixed(3) : 0,
        piorSim: +Math.max.apply(null, c.amostras.concat([0])).toFixed(3) };
    }
    const porRegra = {};
    for (const id of Object.keys(r.contagem).sort()) {
      const meta = INV.PORID[id] || {};
      porRegra[id] = { n: r.contagem[id], gravidade: meta.gravidade, classe: meta.classe,
        titulo: meta.titulo, porque: meta.porque,
        exemplos: r.violacoes.filter(v => v.id === id).slice(0, 3) };
    }
    /* G3 — vies de lado */
    const golsA = r.partidas.reduce((a, p) => a + p.placar[0], 0);
    const golsB = r.partidas.reduce((a, p) => a + p.placar[1], 0);
    const vitA = r.partidas.filter(p => p.placar[0] > p.placar[1]).length;
    const vitB = r.partidas.filter(p => p.placar[1] > p.placar[0]).length;
    /* H1 — determinismo entre processos: o mesmo indice rodado em fatias
       diferentes tem de dar a mesma assinatura. Cada fatia devolve as suas. */
    const saida = {
      ferramenta: 'tools/auditoria/auditoria.js',
      versao: '1.0.0',
      geradoEm: new Date().toISOString(),
      build: path.basename(build), sha256: r.sha, partidas: total,
      elenco: opts.elenco, workers: W, segundos: +((Date.now() - t0) / 1000).toFixed(1),
      carga: r.carga,
      resumo: {
        totalViolacoes: Object.values(r.contagem).reduce((a, b) => a + b, 0),
        regrasFeridas: Object.keys(r.contagem).length,
        porGravidade: contarPor(porRegra, 'gravidade'),
        partidasQueTerminaram: r.partidas.filter(p => p.terminou).length,
      },
      porRegra,
      economiaDoTempo: {
        segundosSimuladosPorPartida: +(r.segundosTotais / total).toFixed(1),
        segundosMortosPorPartida: +(r.segundosMortos / total).toFixed(1),
        deadComJogoAndando: {
          segundosPorPartida: +(r.cinza.segundos / total).toFixed(1),
          episodiosPorPartida: +(r.cinza.episodios / total).toFixed(1),
          metrosDeBolaPorPartida: +(r.cinza.metrosDeBola / total).toFixed(1),
          maiorEpisodio: +r.cinza.maiorEpisodio.toFixed(2),
          obs: 'segundos de simulacao com 0 < dead <= 0,4 e a bola andando: nucleo fora do lance, relogio parado, tela adiantada 3,5x',
        },
        piscadasDeDeadPorPartida: +(r.piscadas / total).toFixed(1),
        fracaoBolaMorta: +(r.segundosMortos / Math.max(1e-9, r.segundosTotais)).toFixed(4),
        pausasPorPartida: +(r.pausas / total).toFixed(1),
        cerimonia,
      },
      lanceDeFalta: resumoFalta(r.falta, total),
      legalidadeDoReinicio: (function () {
        const out = {};
        for (const k of Object.keys(r.legal).sort()) {
          const v = r.legal[k];
          out[k] = { n: v.length, erroP50: INV.pct(v, .5), erroP90: INV.pct(v, .9),
            erroMax: +Math.max.apply(null, v).toFixed(2),
            foraDaTolerancia: v.filter(x => x > INV.LIM.reinicioFolga).length };
        }
        return out;
      })(),
      recolocacaoDaBola: r.recolocacao.length ? {
        n: r.recolocacao.length, porPartida: +(r.recolocacao.length / total).toFixed(1),
        p50: INV.pct(r.recolocacao, .5), p90: INV.pct(r.recolocacao, .9),
        max: +Math.max.apply(null, r.recolocacao).toFixed(1),
        acimaDe10m: r.recolocacao.filter(v => v > 10).length,
        obs: 'metros que a bola pula, de graca, no quadro do reinicio',
      } : { n: 0 },
      eventos: { observados: r.eventos, declarados, mortos },
      calibracao: alvosDeCalibracao(r.partidas, agregado),
      viesDeLado: { golsCasa: golsA, golsFora: golsB, vitoriasCasa: vitA, vitoriasFora: vitB,
        avisoElencoVariado: opts.elenco !== 'paridade' },
      integridadeVisual: r.vi,
      agregado,
      partidasDetalhe: r.partidas.map(p => ({ i: p.i, semente: p.semente, placar: p.placar,
        elencos: p.elencos, formacoes: p.formacoes, estilos: p.estilos, terminou: p.terminou,
        segundosSimulados: p.segundosSimulados })),
      violacoes: r.violacoes,
    };
    const txt = JSON.stringify(saida, null, 2);
    if (argv.out) {
      fs.mkdirSync(path.dirname(argv.out), { recursive: true });
      fs.writeFileSync(argv.out, txt);
      console.log(resumoLegivel(saida));
      console.log(`\njson completo -> ${argv.out}`);
    } else {
      console.log(txt);
    }
  };

  if (W === 1) {
    N.instalarAmbiente();
    const consoleReal = console;
    global.console = { log: N.noop, warn: N.noop, error: consoleReal.error, info: N.noop, debug: N.noop };
    const carga = N.carregar(build, {});
    const r = rodarFatia(indices, opts);
    global.console = consoleReal;
    finalizar(Object.assign(r, { carga: resumoCarga(carga), sha: carga.sha }));
  } else {
    const fatias = Array.from({ length: W }, () => []);
    indices.forEach((i, k) => fatias[k % W].push(i));
    const acc = { partidas: [], violacoes: [], contagem: {}, eventos: {}, cerimonia: {}, vi: {},
      assinaturas: {}, segundosMortos: 0, segundosTotais: 0, pausas: 0,
      falta: { n: 0, semContato: 0, dists: [], esperas: [], saidas: [], noPonto: [],
        desfechos: {}, amostras: [] }, recolocacao: [], legal: {},
      cinza: { segundos: 0, quadros: 0, episodios: 0, metrosDeBola: 0, maiorEpisodio: 0 }, piscadas: 0 };
    let vivos = W;
    /* a carga e lida uma vez no pai so para o inventario de blocos */
    const { sha, blocos } = N.blocosDoBundle(build);
    for (const fatia of fatias) {
      const filho = fork(__filename, [], { env: Object.assign({}, process.env, { CDS_AUD_FATIA: '1' }) });
      filho.on('message', m => {
        acc.partidas.push(...m.partidas);
        acc.violacoes.push(...m.violacoes);
        for (const k of Object.keys(m.contagem)) acc.contagem[k] = (acc.contagem[k] || 0) + m.contagem[k];
        for (const k of Object.keys(m.eventos)) acc.eventos[k] = (acc.eventos[k] || 0) + m.eventos[k];
        for (const k of Object.keys(m.cerimonia)) {
          const c = m.cerimonia[k];
          const a = acc.cerimonia[k] = acc.cerimonia[k] || { n: 0, somaSim: 0, amostras: [] };
          a.n += c.n; a.somaSim += c.somaSim; a.amostras.push(...c.amostras);
        }
        for (const k of Object.keys(m.vi)) acc.vi[k] = (acc.vi[k] || 0) + m.vi[k];
        acc.falta.n += m.falta.n; acc.falta.semContato += m.falta.semContato;
        acc.falta.dists.push(...m.falta.dists); acc.falta.esperas.push(...m.falta.esperas);
        acc.falta.saidas.push(...m.falta.saidas); acc.falta.noPonto.push(...m.falta.noPonto);
        for (const k of Object.keys(m.falta.desfechos)) acc.falta.desfechos[k] = (acc.falta.desfechos[k] || 0) + m.falta.desfechos[k];
        if (acc.falta.amostras.length < 24) acc.falta.amostras.push(...m.falta.amostras.slice(0, 6));
        acc.recolocacao.push(...m.recolocacao);
        for (const k of Object.keys(m.legal)) (acc.legal[k] = acc.legal[k] || []).push(...m.legal[k]);
        acc.piscadas += m.piscadas;
        acc.cinza.segundos += m.cinza.segundos; acc.cinza.quadros += m.cinza.quadros;
        acc.cinza.episodios += m.cinza.episodios; acc.cinza.metrosDeBola += m.cinza.metrosDeBola;
        if (m.cinza.maiorEpisodio > acc.cinza.maiorEpisodio) acc.cinza.maiorEpisodio = m.cinza.maiorEpisodio;
        Object.assign(acc.assinaturas, m.assinaturas);
        acc.segundosMortos += m.segundosMortos;
        acc.segundosTotais += m.segundosTotais;
        acc.pausas += m.pausas;
      });
      filho.on('exit', () => {
        if (--vivos === 0) {
          acc.partidas.sort((a, b) => a.i - b.i);
          acc.violacoes.sort((a, b) => a.partida - b.partida || a.t - b.t);
          finalizar(Object.assign(acc, { sha, carga: { totalBlocos: blocos.length } }));
        }
      });
      filho.send({ build: path.resolve(build), indices: fatia, opts });
    }
  }
}

/* O LANCE DE FALTA, em numeros. Cada linha responde a uma queixa concreta:
     fracaoSemContatoVisivel -> "a falta acontece do nada"
     esperaSim               -> "nao tem pausa pro batedor bater"
     desfechos.carregou      -> "o jogador sai andando, nao sai batendo"
     bolaNoPontoM            -> "a batida as vezes tambem e nada a ver"      */
function resumoFalta(f, partidas) {
  if (!f || !f.n) return { n: 0 };
  return {
    n: f.n, porPartida: +(f.n / partidas).toFixed(1),
    semContatoVisivel: f.semContato,
    fracaoSemContatoVisivel: +(f.semContato / f.n).toFixed(3),
    distanciaNoApitoM: { p50: INV.pct(f.dists, .5), p90: INV.pct(f.dists, .9),
      max: f.dists.length ? +Math.max.apply(null, f.dists).toFixed(2) : null },
    esperaAteReiniciarSim: { p50: INV.pct(f.esperas, .5), p90: INV.pct(f.esperas, .9),
      max: f.esperas.length ? +Math.max.apply(null, f.esperas).toFixed(2) : null },
    saidaAposReinicioSim: { p50: INV.pct(f.saidas, .5), p90: INV.pct(f.saidas, .9) },
    bolaNoPontoM: { p50: INV.pct(f.noPonto, .5), p90: INV.pct(f.noPonto, .9),
      max: f.noPonto.length ? +Math.max.apply(null, f.noPonto).toFixed(2) : null },
    desfechos: f.desfechos,
    fracaoCarregou: +((f.desfechos.carregou || 0) / f.n).toFixed(3),
    amostras: f.amostras.slice(0, 12),
  };
}

function resumoCarga(c) {
  return { totalBlocos: c.totalBlocos, comErro: c.excecoes.length,
    excecoes: c.excecoes, simbolosFaltando: c.faltando };
}
function contarPor(porRegra, campo) {
  const r = {};
  for (const id of Object.keys(porRegra)) {
    const k = porRegra[id][campo] || '?';
    r[k] = (r[k] || 0) + porRegra[id].n;
  }
  return r;
}
function resumoLegivel(s) {
  const L = [];
  L.push('');
  L.push('=== AUDITORIA DE BUGS ===');
  L.push(`build ${s.build}  sha ${String(s.sha256).slice(0, 12)}  partidas ${s.partidas}  ${s.segundos}s`);
  L.push('');
  L.push(`violacoes: ${s.resumo.totalViolacoes} em ${s.resumo.regrasFeridas} regra(s)  ` +
    Object.entries(s.resumo.porGravidade).map(([k, v]) => `${k}:${v}`).join(' '));
  for (const id of Object.keys(s.porRegra)) {
    const r = s.porRegra[id];
    L.push(`  ${r.gravidade}  ${id}  ${String(r.n).padStart(6)}x  ${r.titulo}`);
  }
  L.push('');
  const CZ = s.economiaDoTempo.deadComJogoAndando;
  if (CZ) {
    L.push('');
    L.push(`FAIXA CINZENTA (dead>0 com a bola andando): ${CZ.segundosPorPartida}s/jogo em ` +
      `${CZ.episodiosPorPartida} episodios, ${CZ.metrosDeBolaPorPartida} m de bola, pior episodio ${CZ.maiorEpisodio}s`);
    L.push(`  janelas de dead sem reinicio nenhum (piscadas): ${s.economiaDoTempo.piscadasDeDeadPorPartida}/jogo`);
  }
  L.push('');
  L.push(`bola morta: ${(s.economiaDoTempo.fracaoBolaMorta * 100).toFixed(1)}% da simulacao, ` +
    `${s.economiaDoTempo.pausasPorPartida} pausas por partida`);
  for (const k of Object.keys(s.economiaDoTempo.cerimonia)) {
    const c = s.economiaDoTempo.cerimonia[k];
    L.push(`  ${k.padEnd(16)} ${String(c.porPartida).padStart(6)}/jogo  media ${c.mediaSim}s  pior ${c.piorSim}s`);
  }
  if (s.lanceDeFalta && s.lanceDeFalta.n) {
    const f = s.lanceDeFalta;
    L.push('');
    L.push(`lance de falta: ${f.n} faltas (${f.porPartida}/jogo)`);
    L.push(`  sem contato visivel antes do apito : ${(f.fracaoSemContatoVisivel * 100).toFixed(1)}%`);
    L.push(`  distancia infrator-vitima no apito  : p50 ${f.distanciaNoApitoM.p50} m  p90 ${f.distanciaNoApitoM.p90} m`);
    L.push(`  espera ate a bola voltar a rolar    : p50 ${f.esperaAteReiniciarSim.p50} s  p90 ${f.esperaAteReiniciarSim.p90} s`);
    L.push(`  bola no ponto da falta no reinicio  : p50 ${f.bolaNoPontoM.p50} m  p90 ${f.bolaNoPontoM.p90} m`);
    L.push(`  desfecho: ${Object.entries(f.desfechos).map(([k, v]) => k + ':' + v).join('  ')}`);
    L.push(`  SAIU ANDANDO em vez de bater        : ${(f.fracaoCarregou * 100).toFixed(1)}%`);
  }
  if (s.legalidadeDoReinicio && Object.keys(s.legalidadeDoReinicio).length) {
    L.push('');
    L.push('legalidade do reinicio (erro ate o ponto legal, em m):');
    for (const k of Object.keys(s.legalidadeDoReinicio)) {
      const g = s.legalidadeDoReinicio[k];
      L.push(`  ${k.padEnd(12)} n=${String(g.n).padStart(5)}  p50 ${String(g.erroP50).padStart(6)}  ` +
        `p90 ${String(g.erroP90).padStart(6)}  max ${String(g.erroMax).padStart(7)}  fora ${g.foraDaTolerancia}`);
    }
  }
  if (s.recolocacaoDaBola && s.recolocacaoDaBola.n) {
    const R = s.recolocacaoDaBola;
    L.push('');
    L.push(`recolocacao da bola no reinicio: ${R.porPartida}/jogo  p50 ${R.p50} m  p90 ${R.p90} m  pior ${R.max} m  ` +
      `(${R.acimaDe10m} acima de 10 m)`);
  }
  if (s.eventos.mortos.length) {
    L.push('');
    L.push(`eventos declarados e nunca vistos (${s.eventos.mortos.length}): ${s.eventos.mortos.join(', ')}`);
  }
  if (s.calibracao && s.calibracao.fora.length) {
    L.push('');
    L.push('alvos de calibracao fora da faixa:');
    for (const f of s.calibracao.fora) L.push(`  ${f.metrica.padEnd(22)} ${f.medido}  faixa ${f.faixa[0]}..${f.faixa[1]}`);
  }
  return L.join('\n');
}
