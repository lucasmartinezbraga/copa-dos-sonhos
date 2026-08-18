#!/usr/bin/env node
'use strict';
/* VARREDURA DO CONCEITO ESCRITO QUE NAO ACONTECE
   =========================================================================
   O briefing chama de "padrao de defeito que se repete neste codigo":

       Um conceito e escrito, e lido, e nao pode acontecer.

   Ja apareceu DEZ vezes -- `locoFor(speed, prev)` que declarava a histerese e
   nunca lia `prev`; o `1.8` de `armTaker` que a OS-77 reorcava; o ramo
   `if (p === presser)` que a camada R13 intercepta; o teto de altura que
   impedia todo chute de passar do travessao. Toda vez foi achado por acaso,
   depois de uma medicao dar numero estranho.

   Nunca foi PROCURADO. Esta varredura procura, estaticamente, as tres formas
   mais baratas de detectar:

     1. PARAMETRO DECLARADO E NUNCA LIDO
        A assinatura promete um comportamento que o corpo nao entrega. Foi
        exatamente a `locoFor(speed, prev)`.

     2. CONSTANTE DEFINIDA E NUNCA USADA
        Um numero com nome e comentario explicando o que ele governa, e
        ninguem o le. Costuma ser resto de uma correcao que mudou de lugar.

     3. CAMPO ESCRITO E NUNCA LIDO (e o contrario)
        `this.__algumaCoisa = x` sem nenhum leitor no projeto inteiro -- ou um
        leitor sem nenhum escritor, que e pior, porque le `undefined` calado.

   Nao substitui medicao: aponta CANDIDATOS. Cada achado precisa ser lido antes
   de virar conserto -- varios serao intencionais (API publica, compatibilidade).

   Uso: node tools/varredura-do-conceito.js [--dir=src] [--tudo]
*/
const fs = require('fs');
const path = require('path');

const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
const RAIZ = path.resolve(argv.dir || 'src');
const TUDO = !!argv.tudo;

function arquivos(dir, acc = []) {
  for (const nome of fs.readdirSync(dir)) {
    const p = path.join(dir, nome);
    const st = fs.statSync(p);
    if (st.isDirectory()) arquivos(p, acc);
    else if (/\.js$/.test(nome)) acc.push(p);
  }
  return acc;
}

/* Remove comentarios e literais de string/template para que uma palavra dentro
   de um comentario nao conte como uso. Preserva o comprimento, para que os
   indices continuem validos. */
function limpar(src) {
  let out = '', i = 0, n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') { out += ' '; i++; } continue; }
    if (c === '/' && d === '*') {
      out += '  '; i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++; }
      out += '  '; i += 2; continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const asp = c; out += ' '; i++;
      while (i < n && src[i] !== asp) {
        if (src[i] === '\\') { out += '  '; i += 2; continue; }
        out += src[i] === '\n' ? '\n' : ' '; i++;
      }
      out += ' '; i++; continue;
    }
    out += c; i++;
  }
  return out;
}

/* acha o corpo { ... } que comeca no primeiro '{' depois de `de` */
function corpo(src, de) {
  let i = src.indexOf('{', de);
  if (i < 0) return null;
  let nivel = 0, ini = i;
  for (; i < src.length; i++) {
    if (src[i] === '{') nivel++;
    else if (src[i] === '}') { nivel--; if (!nivel) return { ini: ini + 1, fim: i }; }
  }
  return null;
}

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function usa(texto, nome) {
  return new RegExp('(?<![.\\w$])' + esc(nome) + '(?![\\w$])').test(texto);
}

const RE_FUNC = /(?:function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)|([A-Za-z_$][\w$]*)\s*[:=]\s*function\s*\(([^)]*)\)|([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{)/g;
const RE_CONST = /^\s{0,4}(?:const|let|var)\s+([A-Z][A-Z0-9_]{2,})\s*=/gm;
/* §CUIDADO, e o meu proprio bug: a primeira versao usava
   `\.(__\w*)(?!\s*=[^=])` para "leitura". O lookahead negativo faz o motor
   BACKTRACKEAR o grupo ate a lookahead passar, entao `__os250Gasto` era
   reportado como `__os250Gast`. Nome truncado nao casa com nada e a secao
   inteira virou lixo convincente.
   A forma certa: capturar o nome INTEIRO uma vez, e decidir leitura/escrita
   olhando o que vem depois, fora do regex. */
const RE_CAMPO = /\.(__[A-Za-z_$][\w$]*)/g;

const lista = arquivos(RAIZ);
const achadosParam = [], achadosConst = [], campoEscrito = new Map(), campoLido = new Map();
const corpus = [];

for (const f of lista) {
  const bruto = fs.readFileSync(f, 'utf8');
  const src = limpar(bruto);
  corpus.push({ f, src });

  /* --- 1. parametros declarados e nunca lidos --- */
  RE_FUNC.lastIndex = 0;
  let m;
  while ((m = RE_FUNC.exec(src))) {
    const nome = m[1] || m[3] || m[5];
    const params = (m[2] != null ? m[2] : (m[4] != null ? m[4] : m[6])) || '';
    if (!nome || /^(if|for|while|switch|catch|return|typeof|function)$/.test(nome)) continue;
    const b = corpo(src, m.index + m[0].length - 1);
    if (!b) continue;
    const texto = src.slice(b.ini, b.fim);
    const ps = params.split(',').map(s => s.trim()).filter(Boolean);
    if (!ps.length || ps.length > 8) continue;
    /* EMBRULHO QUE REPASSA `arguments` NAO PRECISA LER O PARAMETRO PELO NOME.
       Metade das camadas deste projeto e `const old = P.metodo; P.metodo =
       function (a, b, c) { ...; return old.apply(this, arguments); }` -- ali um
       parametro "nao lido" e so documentacao da assinatura, e sinaliza-lo
       afogaria o achado de verdade em 40 linhas de ruido. */
    if (usa(texto, 'arguments')) continue;
    ps.forEach((p, idx) => {
      const puro = p.replace(/=.*$/, '').trim();
      if (!/^[A-Za-z_$][\w$]*$/.test(puro)) return;     // destructuring, rest: fora
      if (puro.startsWith('_')) return;                 // convencao de "nao uso"
      if (usa(texto, puro)) return;
      /* parametro nao lido so INTERESSA quando ha parametro depois dele que E
         lido, ou quando ele e o ultimo de uma assinatura documentada: senao e
         so uma sobra inofensiva de arity */
      const depoisUsado = ps.slice(idx + 1).some(q => usa(texto, q.replace(/=.*$/, '').trim()));
      achadosParam.push({ f, nome, param: puro, pos: idx, depoisUsado,
                          linha: src.slice(0, m.index).split('\n').length });
    });
  }

  /* --- 2. constantes de modulo nunca usadas --- */
  RE_CONST.lastIndex = 0;
  while ((m = RE_CONST.exec(src))) {
    const nome = m[1];
    const antes = src.slice(0, m.index), depois = src.slice(m.index + m[0].length);
    if (usa(depois, nome) || usa(antes, nome)) continue;
    achadosConst.push({ f, nome, linha: antes.split('\n').length });
  }

  /* --- 3. campos privados: escritos x lidos --- */
  RE_CAMPO.lastIndex = 0;
  while ((m = RE_CAMPO.exec(src))) {
    const nome = m[1];
    const resto = src.slice(m.index + m[0].length);
    /* escrita = `= algo` que nao seja comparacao (`==`, `===`, `=>`) */
    const escrita = /^\s*(?:\+|-|\*|\/)?=(?![=>])/.test(resto);
    const mapa = escrita ? campoEscrito : campoLido;
    if (!mapa.has(nome)) mapa.set(nome, new Set());
    mapa.get(nome).add(path.basename(f));
  }
}

const rel = f => path.relative(process.cwd(), f);

console.log('\n=== VARREDURA DO CONCEITO ===  ' + lista.length + ' arquivos em ' + rel(RAIZ) + '\n');

console.log('1. PARAMETRO DECLARADO E NUNCA LIDO');
const graves = achadosParam.filter(a => a.depoisUsado);
const leves = achadosParam.filter(a => !a.depoisUsado);
console.log('   graves (ha parametro DEPOIS dele que e usado -> a assinatura promete e nao entrega): '
            + graves.length);
for (const a of graves) {
  console.log('      ' + rel(a.f) + ':' + a.linha + '  ' + a.nome + '(...) -> `' + a.param + '` na posicao ' + a.pos);
}
console.log('   leves (ultimo parametro, sobra de arity): ' + leves.length);
if (TUDO) for (const a of leves) console.log('      ' + rel(a.f) + ':' + a.linha + '  ' + a.nome + ' -> ' + a.param);

console.log('\n2. CONSTANTE DE MODULO DEFINIDA E NUNCA USADA: ' + achadosConst.length);
for (const a of achadosConst) console.log('      ' + rel(a.f) + ':' + a.linha + '  ' + a.nome);

console.log('\n3. CAMPO PRIVADO SEM PAR');
const soEscrito = [...campoEscrito.keys()].filter(k => !campoLido.has(k));
const soLido = [...campoLido.keys()].filter(k => !campoEscrito.has(k));
console.log('   escrito e NUNCA lido (' + soEscrito.length + '):');
for (const k of soEscrito) console.log('      ' + k + '   <- ' + [...campoEscrito.get(k)].join(', '));
console.log('   lido e NUNCA escrito (' + soLido.length + ') — este e o pior: le `undefined` calado');
for (const k of soLido) console.log('      ' + k + '   -> ' + [...campoLido.get(k)].join(', '));

console.log('\nNao e laudo: e lista de candidatos. Cada um precisa ser LIDO antes');
console.log('de virar conserto — parte sera intencional (API publica, arity de');
console.log('compatibilidade, campo lido por outra camada via nome dinamico).');
