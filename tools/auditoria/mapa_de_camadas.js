#!/usr/bin/env node
'use strict';
/* MAPA DE CAMADAS — nivel N1: arqueologia de override (analise estatica)
   =========================================================================
   Este jogo nao e um programa: e uma pilha de 80 blocos que se sobrescrevem.
   Cada camada pega um metodo do prototipo, guarda o anterior e poe o seu no
   lugar. Isso cria uma familia de bugs que NENHUM teste de partida pega,
   porque o jogo continua rodando lindamente — so que rodando outra coisa:

     PATCH PERDIDO   a camada guarda `var old = P.m` e nunca chama `old`.
                     Tudo que as camadas anteriores fizeram naquele metodo
                     morreu em silencio. O codigo continua no arquivo, continua
                     sendo lido, continua sendo mantido — e nao roda.
     RAMO MORTO      o metodo do core foi substituido por completo. O
                     `if` que voce esta editando no core nao executa nunca.
                     (O proprio CLAUDE.md registra ter perdido uma rodada de
                     medicao editando um ramo assim.)
     PILHA FUNDA     o mesmo metodo remendado por muitas camadas: a ordem do
                     manifesto passa a ser regra de negocio nao escrita.
     SEM GUARDA      camada que nao se protege de dupla instalacao. Carregar o
                     bundle duas vezes (ou reordenar) duplica o efeito.

   Nao roda partida nenhuma: le o bundle e responde quem manda em cada metodo.

   Uso:
     node tools/auditoria/mapa_de_camadas.js --build=dist/index.html
     node tools/auditoria/mapa_de_camadas.js --build=... --metodo=_awardFoul
     node tools/auditoria/mapa_de_camadas.js --build=... --out=reports/auditoria/camadas.json
*/

const fs = require('fs');
const path = require('path');
const N = require('./nucleo.js');

const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));

const build = String(argv.build || 'dist/index.html');
const { sha, blocos } = N.blocosDoBundle(build);

/* Formas de escrita no prototipo que este projeto usa de fato. */
const ATRIBUICAO = [
  /\bP\.([A-Za-z_$][\w$]*)\s*=\s*function/g,
  /\bP\.([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function/g,
  /\bM\.prototype\.([A-Za-z_$][\w$]*)\s*=\s*function/g,
  /\bMatchSim\.prototype\.([A-Za-z_$][\w$]*)\s*=\s*function/g,
  /Object\.defineProperty\(\s*P\s*,\s*['"]([A-Za-z_$][\w$]*)['"]/g,
];
/* captura do anterior: `const oldX = P.m` / `var oldX = P.m` */
const CAPTURA = /\b(?:const|var|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:P|M\.prototype|MatchSim\.prototype)\.([A-Za-z_$][\w$]*)\s*[;,\n]/g;
/* metodos do core: definidos dentro de `class MatchSim { ... }` */
const METODO_DE_CLASSE = /^\s{2}(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/gm;

const porMetodo = Object.create(null);
const porBloco = [];
const nucleo = new Set();

for (const b of blocos) {
  const corpo = b.corpo;
  const ehCore = /class\s+MatchSim\s*\{/.test(corpo);
  if (ehCore) {
    const trecho = corpo.slice(corpo.indexOf('class MatchSim'));
    let m; METODO_DE_CLASSE.lastIndex = 0;
    while ((m = METODO_DE_CLASSE.exec(trecho))) nucleo.add(m[1]);
  }

  const escritos = new Set();
  for (const re of ATRIBUICAO) {
    re.lastIndex = 0;
    let m; while ((m = re.exec(corpo))) escritos.add(m[1]);
  }
  /* quem foi capturado e se foi de fato chamado */
  const capturas = [];
  CAPTURA.lastIndex = 0;
  let c; while ((c = CAPTURA.exec(corpo))) {
    const nomeVar = c[1], metodo = c[2];
    const chamou = new RegExp('\\b' + nomeVar.replace(/\$/g, '\\$') +
      '\\s*(?:\\.(?:apply|call|bind)\\s*\\(|\\()').test(corpo);
    capturas.push({ metodo, variavel: nomeVar, encadeia: chamou });
  }
  const temGuarda = /__[A-Z0-9_]{3,}__|\.__[a-zA-Z0-9_]+\s*\)\s*return|instalad[oa]/.test(corpo);

  const info = { ordem: b.ordem, id: b.id, bytes: b.bytes,
    escreve: Array.from(escritos).sort(), capturas, temGuarda, ehCore };
  porBloco.push(info);

  for (const nome of escritos) {
    const cap = capturas.find(x => x.metodo === nome);
    (porMetodo[nome] = porMetodo[nome] || []).push({
      ordem: b.ordem, camada: b.id,
      encadeia: cap ? cap.encadeia : false,
      capturou: !!cap,
    });
  }
}

/* ------------------------------------------------------------- achados */
const achados = [];
for (const nome of Object.keys(porMetodo).sort()) {
  const pilha = porMetodo[nome];
  const doCore = nucleo.has(nome);
  /* PATCH PERDIDO: escreve sobre uma pilha ja existente sem encadear */
  pilha.forEach((p, k) => {
    const anteriores = k + (doCore ? 1 : 0);
    if (anteriores > 0 && !p.encadeia) {
      achados.push({ tipo: 'patch_perdido', gravidade: 'S2', metodo: nome,
        camada: p.camada, ordem: p.ordem,
        detalhe: `substitui ${nome} sem chamar o anterior; ${anteriores} implementacao(oes) anterior(es) ficam mortas`,
        anteriores: (doCore ? ['core'] : []).concat(pilha.slice(0, k).map(x => x.camada)) });
    }
  });
  if (pilha.length >= 3) {
    achados.push({ tipo: 'pilha_funda', gravidade: 'S3', metodo: nome,
      camadas: pilha.map(p => p.camada), ordem: pilha[0].ordem,
      detalhe: `${nome} e remendado por ${pilha.length} camadas; a ordem do manifesto virou regra de negocio` });
  }
}
for (const b of porBloco) {
  if (!b.ehCore && b.escreve.length && !b.temGuarda) {
    achados.push({ tipo: 'sem_guarda', gravidade: 'S3', camada: b.id, ordem: b.ordem,
      detalhe: `escreve ${b.escreve.length} metodo(s) sem guarda de dupla instalacao` });
  }
}

const ordemGrav = { S1: 0, S2: 1, S3: 2, S4: 3 };
achados.sort((a, b) => (ordemGrav[a.gravidade] - ordemGrav[b.gravidade]) || a.ordem - b.ordem);

const saida = {
  ferramenta: 'tools/auditoria/mapa_de_camadas.js',
  geradoEm: new Date().toISOString(),
  build: path.basename(build), sha256: sha,
  blocos: blocos.length,
  metodosDoCore: nucleo.size,
  metodosRemendados: Object.keys(porMetodo).length,
  achados,
  resumo: achados.reduce((a, x) => { a[x.tipo] = (a[x.tipo] || 0) + 1; return a; }, {}),
  porMetodo,
  porBloco: porBloco.map(b => ({ ordem: b.ordem, id: b.id, escreve: b.escreve.length,
    encadeia: b.capturas.filter(c => c.encadeia).length,
    naoEncadeia: b.capturas.filter(c => !c.encadeia).length, temGuarda: b.temGuarda })),
};

if (argv.metodo) {
  const nome = String(argv.metodo);
  const pilha = porMetodo[nome] || [];
  console.log(`\n=== QUEM MANDA EM ${nome} ===`);
  console.log(nucleo.has(nome) ? '  core           define o original' : '  (nao existe no core)');
  for (const p of pilha) {
    console.log(`  ${String(p.ordem).padStart(3)} ${p.camada.padEnd(40)} ` +
      (p.encadeia ? 'encadeia o anterior' : p.capturou ? 'CAPTUROU E NAO CHAMOU' : 'SUBSTITUI SEM CAPTURAR'));
  }
  console.log(pilha.length ? `\n  quem roda de verdade: ${pilha[pilha.length - 1].camada}` : '');
  process.exit(0);
}

if (argv.out) {
  fs.mkdirSync(path.dirname(argv.out), { recursive: true });
  fs.writeFileSync(argv.out, JSON.stringify(saida, null, 2));
}
console.log(legivel(saida));
if (argv.out) console.log(`\njson -> ${argv.out}`);

function legivel(s) {
  const L = [];
  L.push('');
  L.push('=== MAPA DE CAMADAS ===');
  L.push(`build ${s.build}  ${s.blocos} blocos  ${s.metodosDoCore} metodos no core  ` +
    `${s.metodosRemendados} metodos remendados`);
  L.push('');
  L.push('achados: ' + Object.entries(s.resumo).map(([k, v]) => `${k}:${v}`).join('  '));
  L.push('');
  const perdidos = s.achados.filter(a => a.tipo === 'patch_perdido');
  if (perdidos.length) {
    L.push(`PATCH PERDIDO (${perdidos.length}) — codigo anterior que deixou de rodar:`);
    for (const a of perdidos.slice(0, 25)) {
      L.push(`  ${String(a.ordem).padStart(3)} ${a.camada.padEnd(38)} ${a.metodo}`);
      L.push(`      apaga: ${a.anteriores.join(', ')}`);
    }
    if (perdidos.length > 25) L.push(`  ... e mais ${perdidos.length - 25}`);
    L.push('');
  }
  const fundas = s.achados.filter(a => a.tipo === 'pilha_funda');
  if (fundas.length) {
    L.push(`PILHA FUNDA (${fundas.length}) — metodo com 3+ donos:`);
    for (const a of fundas.slice(0, 15)) {
      L.push(`  ${a.metodo.padEnd(30)} ${a.camadas.length}x  ${a.camadas.join(' > ')}`);
    }
    if (fundas.length > 15) L.push(`  ... e mais ${fundas.length - 15}`);
    L.push('');
  }
  const semg = s.achados.filter(a => a.tipo === 'sem_guarda');
  if (semg.length) {
    L.push(`SEM GUARDA DE DUPLA INSTALACAO (${semg.length}): ` +
      semg.slice(0, 12).map(a => a.camada).join(', ') + (semg.length > 12 ? ' ...' : ''));
  }
  return L.join('\n');
}
