#!/usr/bin/env node
'use strict';
/* RELATORIO — junta as tres medicoes num laudo unico em Markdown
   =========================================================================
   Entra: o JSON da auditoria (N2/N3/N4), o da sonda de tela (N5) e o do mapa
   de camadas (N1). Sai: um laudo com achado, evidencia e RECEITA DE REPETICAO.

   A receita e o que separa laudo de reclamacao. Todo achado sai daqui com o
   comando exato que o reproduz.

   Uso:
     node tools/auditoria/relatorio.js --auditoria=a.json --tela=t.json \
       --camadas=c.json --out=reports/auditoria/laudo.md
*/
const fs = require('fs');
const path = require('path');

const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
const ler = p => (p && fs.existsSync(p)) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;

const A = ler(argv.auditoria);
const T = ler(argv.tela);
const C = ler(argv.camadas);
const N0 = ler(argv.n0);
const N6 = ler(argv.n6);
const TELAS = [argv.tela, argv.tela1x, argv.telaturbo].filter(Boolean).map(ler).filter(Boolean);
const build = (A && A.build) || (T && T.build) || (C && C.build) || '?';
const L = [];
const P = s => L.push(s);

P(`# Laudo de auditoria — ${build}`);
P('');
P(`Gerado em ${new Date().toISOString().slice(0, 16).replace('T', ' ')} · ` +
  `sha256 \`${String((A && A.sha256) || (C && C.sha256) || '').slice(0, 16)}\``);
if (argv.artefato) {
  P('');
  P(`Artefato auditado: \`${argv.artefato}\`. Nas medicoes ele aparece pelo nome da`);
  P('copia de trabalho usada na rodada — o sha256 acima e o que identifica o bundle.');
}
P('');
P('Metodologia: `docs/METODOLOGIA-DE-BUGS.md`. Cada achado abaixo traz a');
P('receita que o repete — sem receita, nao e achado, e impressao.');
P('');

/* ---------------------------------------------------------- 1. veredito */
P('## 1. Veredito');
P('');
if (A) {
  const r = A.resumo;
  P(`- **${r.totalViolacoes}** violacoes em **${r.regrasFeridas}** regra(s) sobre ${A.partidas} partidas`);
  P(`- gravidade: ${Object.entries(r.porGravidade).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  P(`- partidas que terminaram: ${r.partidasQueTerminaram}/${A.partidas}`);
  if (A.carga && A.carga.comErro) P(`- **blocos com erro de carga: ${A.carga.comErro}**`);
}
if (C) P(`- camadas: ${C.resumo.patch_perdido || 0} patch(es) perdido(s), ` +
  `${C.resumo.pilha_funda || 0} metodo(s) com 3+ donos, ${C.resumo.sem_guarda || 0} sem guarda`);
if (T) P(`- tela: partida inteira projetada em **${T.custoDeTela.partidaInteiraMin} min** ` +
  `no botao ${T.velocidadeBotao}X; ${(T.orcamentoDeTela.fracaoParedeBolaMorta * 100).toFixed(1)}% do tempo de tela e bola parada`);
if (N0) P(`- artefato: ${N0.blocos} blocos, ${(N0.bytes / 1048576).toFixed(2)} MB, ` +
  `${N0.achados.length} achado(s) de documento`);
if (N6) {
  const erros = N6.telas.reduce((a, v) => a + v.erros.length + v.consoleErros.length, 0);
  P(`- telas: 3 tamanhos percorridos, ${erros} erro(s) de script/console`);
}
P('');

/* ---------------------------------------------- o achado que manda no laudo */
if (A && A.economiaDoTempo && A.economiaDoTempo.deadComJogoAndando) {
  const CZ = A.economiaDoTempo.deadComJogoAndando;
  if (CZ.segundosPorPartida > 0) {
    P('### A faixa cinzenta do `dead`');
    P('');
    P('Tres subsistemas discordam sobre o que `dead > 0` significa:');
    P('');
    P('| quem | o que faz com `dead > 0` |');
    P('|---|---|');
    P('| relogio da partida | **para** para qualquer `dead > 0` |');
    P('| congelamento tatico | so entra em `dead > 0,4` |');
    P('| laco de render | **adianta 3,5x** para qualquer `dead > 0` (10,5x no botao 3X) |');
    P('');
    P(`Na faixa \`0 < dead <= 0,4\` isso da, por partida: **${CZ.segundosPorPartida} s** de simulacao`);
    P(`em **${CZ.episodiosPorPartida} episodios**, com a bola andando **${CZ.metrosDeBolaPorPartida} m**;`);
    P(`o pior episodio dura **${CZ.maiorEpisodio} s**. Nesses trechos o jogo continua sendo jogado,`);
    P('o relogio da partida fica parado e a tela acelera.');
    P('');
  }
}

/* ------------------------------------------------- 2. achados de partida */
if (A && Object.keys(A.porRegra).length) {
  P('## 2. Achados de simulacao (N2/N3)');
  P('');
  P('| gravidade | regra | ocorrencias | titulo |');
  P('|---|---|---|---|');
  const ordem = { S1: 0, S2: 1, S3: 2, S4: 3 };
  const ids = Object.keys(A.porRegra).sort((a, b) =>
    (ordem[A.porRegra[a].gravidade] - ordem[A.porRegra[b].gravidade]) || (A.porRegra[b].n - A.porRegra[a].n));
  for (const id of ids) {
    const r = A.porRegra[id];
    P(`| ${r.gravidade} | \`${id}\` | ${r.n} | ${r.titulo} |`);
  }
  P('');
  for (const id of ids) {
    const r = A.porRegra[id];
    P(`### ${id} · ${r.titulo} (${r.gravidade}, ${r.n}x)`);
    P('');
    if (r.porque) P(`${r.porque}`);
    P('');
    for (const ex of (r.exemplos || []).slice(0, 2)) {
      P(`- partida ${ex.partida}, ${ex.tempo}o tempo, ${ex.minuto}' — \`${JSON.stringify(ex.detalhe)}\``);
    }
    const ex0 = (r.exemplos || [])[0];
    if (ex0) {
      P('');
      P('```bash');
      P(`node tools/auditoria/repro.js --build=<bundle> --partida=${ex0.partida} --regra=${id}`);
      P('```');
    }
    P('');
  }
}

/* ------------------------------------------------- legalidade do reinicio */
if (A && A.legalidadeDoReinicio && Object.keys(A.legalidadeDoReinicio).length) {
  P('## 2b. Legalidade do reinicio');
  P('');
  P('Distancia entre a bola e o ponto legal, no quadro em que o motor consome o reinicio.');
  P('');
  P('| reinicio | n | erro p50 | erro p90 | pior | fora da tolerancia |');
  P('|---|---|---|---|---|---|');
  for (const k of Object.keys(A.legalidadeDoReinicio)) {
    const g = A.legalidadeDoReinicio[k];
    P(`| ${k} | ${g.n} | ${g.erroP50} m | ${g.erroP90} m | ${g.erroMax} m | ${g.foraDaTolerancia} |`);
  }
  P('');
  P('O pontape de saida fica **fora** desta tabela de proposito: entre a cerimonia do gol,');
  P('a volta para casa e o proprio pontape, o instante do reinicio deixa de ser identificavel');
  P('por `pendingRestart`, e um numero inventado seria pior que um buraco declarado.');
  P('');
}

/* ---------------------------------------------------------- 3. o lance */
if (A && A.lanceDeFalta && A.lanceDeFalta.n) {
  const f = A.lanceDeFalta;
  P('## 3. O lance de falta');
  P('');
  P('| pergunta | medida |');
  P('|---|---|');
  P(`| faltas por partida | ${f.porPartida} |`);
  P(`| sem contato visivel antes do apito | ${(f.fracaoSemContatoVisivel * 100).toFixed(1)}% |`);
  P(`| distancia infrator-vitima no apito | p50 ${f.distanciaNoApitoM.p50} m · p90 ${f.distanciaNoApitoM.p90} m |`);
  P(`| espera ate a bola voltar a rolar | p50 ${f.esperaAteReiniciarSim.p50} s · p90 ${f.esperaAteReiniciarSim.p90} s |`);
  P(`| bola no ponto da falta no reinicio | p50 ${f.bolaNoPontoM.p50} m · p90 ${f.bolaNoPontoM.p90} m |`);
  P(`| **saiu andando em vez de bater** | **${(f.fracaoCarregou * 100).toFixed(1)}%** |`);
  P('');
  P(`Desfechos: ${Object.entries(f.desfechos).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  P('');
}
if (A && A.recolocacaoDaBola && A.recolocacaoDaBola.n) {
  const R = A.recolocacaoDaBola;
  P('### A bola que pisca');
  P('');
  P(`No quadro do reinicio a bola muda de lugar de graca: **${R.porPartida} vezes por partida**,`);
  P(`p50 ${R.p50} m, p90 ${R.p90} m, pior caso ${R.max} m — **${R.acimaDe10m} saltos acima de 10 m**`);
  P('na amostra. Nada disso e desenhado: ela some de um ponto e aparece no outro.');
  P('');
}
if (A && A.economiaDoTempo) {
  const E = A.economiaDoTempo;
  P('### Economia da bola parada (simulacao)');
  P('');
  P(`${(E.fracaoBolaMorta * 100).toFixed(1)}% da simulacao e bola morta, em ${E.pausasPorPartida} pausas por partida.`);
  P('');
  P('| reinicio | por partida | pausa media (sim) | pior |');
  P('|---|---|---|---|');
  for (const k of Object.keys(E.cerimonia)) {
    const c = E.cerimonia[k];
    P(`| ${k} | ${c.porPartida} | ${c.mediaSim} s | ${c.piorSim} s |`);
  }
  P('');
}

/* ------------------------------------------------- custo de tela por botao */
if (TELAS.length > 1) {
  P('## 3b. O custo de tela, botao a botao');
  P('');
  P('| botao | parede/simulacao | partida inteira | bola parada (tela) | bola parada (simulacao) | tremor | salto |');
  P('|---|---|---|---|---|---|---|');
  for (const t of TELAS.sort((a, b) => a.velocidadeBotao - b.velocidadeBotao)) {
    const d = t.fluidez.desenho || {};
    P(`| ${t.velocidadeBotao}X | ${t.custoDeTela.paredePorSimulacao} | ${t.custoDeTela.partidaInteiraMin} min | ` +
      `${(t.orcamentoDeTela.fracaoParedeBolaMorta * 100).toFixed(1)}% | ` +
      `${(t.orcamentoDeTela.fracaoSimBolaMorta * 100).toFixed(1)}% | ` +
      `${d.fracaoTremor != null ? (d.fracaoTremor * 100).toFixed(2) + '%' : '-'} | ` +
      `${d.fracaoSalto != null ? (d.fracaoSalto * 100).toFixed(2) + '%' : '-'} |`);
  }
  P('');
}

/* ----------------------------------------------------------- 4. ritmo */
if (T) {
  P('## 4. Ritmo e fluidez (N5 — relogio de parede)');
  P('');
  P(`Janela medida: ${T.janelaS}s no botao ${T.velocidadeBotao}X.`);
  P('');
  P(`- **${T.custoDeTela.paredePorSimulacao} s de parede por segundo de simulacao** ` +
    `→ partida inteira ~**${T.custoDeTela.partidaInteiraMin} min**`);
  P(`- bola parada: **${(T.orcamentoDeTela.fracaoParedeBolaMorta * 100).toFixed(1)}% do tempo de tela** ` +
    `contra ${(T.orcamentoDeTela.fracaoSimBolaMorta * 100).toFixed(1)}% da simulacao`);
  P(`- fluidez: ${T.fluidez.fpsMedio} fps · ` +
    `${(T.fluidez.fracaoQuadrosSemPasso * 100).toFixed(1)}% dos quadros sem passo (imagem parada) · ` +
    `${(T.fluidez.fracaoQuadrosCom2OuMais * 100).toFixed(1)}% com 2+ passos (salto)`);
  P('');
  P('| reinicio | n | parede p50 | parede p90 | pior | sim p50 |');
  P('|---|---|---|---|---|---|');
  for (const k of Object.keys(T.pausas)) {
    const p = T.pausas[k];
    P(`| ${k} | ${p.n} | ${p.paredeMsP50} ms | ${p.paredeMsP90} ms | ${p.paredeMsMax} ms | ${p.simSP50} s |`);
  }
  P('');
}

/* ------------------------------------------------------------ 4b. telas */
if (N6) {
  P('## 4b. Fluxo de telas (N6)');
  P('');
  P('| tamanho | boot | erros | achados | campo na partida |');
  P('|---|---|---|---|---|');
  for (const v of N6.telas) {
    const achados = [];
    for (const t of v.telas) {
      if (t.erro) { achados.push(`${t.tela}: ${t.erro}`); continue; }
      if (t.rolagemHorizontal > 0) achados.push(`${t.tela}: rolagem +${t.rolagemHorizontal}px`);
      if (t.estouram && t.estouram.length) achados.push(`${t.tela}: ${t.estouram.length} estourando`);
      if (t.botoesCobertos && t.botoesCobertos.length) achados.push(`${t.tela}: ${t.botoesCobertos.length} botao coberto`);
      if (t.alvosPequenos && t.alvosPequenos.length) achados.push(`${t.tela}: ${t.alvosPequenos.length} alvo < 32px`);
      if (t.textoMiudo) achados.push(`${t.tela}: ${t.textoMiudo} texto < 11px`);
    }
    const campo = v.partida && v.partida.fracaoDaTelaComCampo != null
      ? (v.partida.fracaoDaTelaComCampo * 100).toFixed(0) + '%' : '-';
    P(`| ${v.nome} ${v.viewport} | ${v.bootMs} ms | ${v.erros.length + v.consoleErros.length} | ` +
      `${achados.join('; ') || 'limpo'} | ${campo} |`);
  }
  P('');
  P('Capturas em `reports/auditoria/tela/`.');
  P('');
}

/* --------------------------------------------------------- 5. camadas */
if (C) {
  P('## 5. Camadas (N1 — analise estatica)');
  P('');
  const perdidos = C.achados.filter(a => a.tipo === 'patch_perdido');
  P(`${C.blocos} blocos · ${C.metodosDoCore} metodos no core · ${C.metodosRemendados} remendados.`);
  P('');
  if (perdidos.length) {
    P('**Patch perdido** — a camada substitui sem chamar o anterior, e o que estava embaixo para de rodar:');
    P('');
    P('| ordem | camada | metodo | apaga |');
    P('|---|---|---|---|');
    for (const a of perdidos) P(`| ${a.ordem} | \`${a.camada}\` | \`${a.metodo}\` | ${a.anteriores.join(', ')} |`);
    P('');
  }
  const fundas = C.achados.filter(a => a.tipo === 'pilha_funda');
  if (fundas.length) {
    P('**Pilha funda** — metodos com tres ou mais donos (a ordem do manifesto e regra de negocio):');
    P('');
    for (const a of fundas.slice(0, 20)) P(`- \`${a.metodo}\` — ${a.camadas.length}x: ${a.camadas.join(' → ')}`);
    P('');
  }
}

/* --------------------------------------------------------- 5b. artefato */
if (N0) {
  P('## 5b. O artefato (N0)');
  P('');
  P(`${N0.build} · ${(N0.bytes / 1048576).toFixed(2)} MB · ${N0.blocos} blocos de script · ${N0.estilos} de estilo`);
  P('');
  if (!N0.achados.length) P('Nenhum achado de documento.');
  else {
    P('| grav. | achado | |');
    P('|---|---|---|');
    for (const a of N0.achados) {
      const d = typeof a.detalhe === 'string' ? a.detalhe
        : Array.isArray(a.detalhe) ? a.detalhe.slice(0, 3).map(x => typeof x === 'string' ? x : JSON.stringify(x)).join('; ')
        : (a.detalhe && a.detalhe.valores ? `${a.detalhe.valores.length} valores, vence "${a.detalhe.venceOUltimo}"` : '');
      P(`| ${a.gravidade} | ${a.titulo} | ${String(d).slice(0, 120)} |`);
    }
  }
  P('');
}

/* ------------------------------------------------------ 6. calibracao */
if (A && A.calibracao) {
  P('## 6. Calibracao de design');
  P('');
  P('| metrica | medido | faixa | |');
  P('|---|---|---|---|');
  for (const k of Object.keys(A.calibracao.tabela)) {
    const t = A.calibracao.tabela[k];
    P(`| ${k} | ${t.medido} | ${t.min} .. ${t.max} | ${t.dentro ? 'ok' : '**fora**'} |`);
  }
  P('');
}

/* ------------------------------------------------------- 7. codigo morto */
if (A && A.eventos && A.eventos.mortos.length) {
  P('## 7. Caminhos que nunca executaram');
  P('');
  P(`Eventos que o codigo sabe emitir e que ${A.partidas} partidas nunca produziram:`);
  P('');
  for (const e of A.eventos.mortos) P(`- \`${e}\``);
  P('');
  P('Nem todo item aqui e defeito (prorrogacao so acontece em mata-mata empatado),');
  P('mas cada um precisa de uma explicacao — ou vira caminho morto.');
  P('');
}

const saida = argv.out || 'reports/auditoria/laudo.md';
fs.mkdirSync(path.dirname(saida), { recursive: true });
fs.writeFileSync(saida, L.join('\n'));
console.log(`laudo -> ${saida}  (${L.length} linhas)`);
