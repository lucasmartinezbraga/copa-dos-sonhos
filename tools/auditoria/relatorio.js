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
P('');

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
