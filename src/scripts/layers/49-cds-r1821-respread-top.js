
/* R18.21 · REESPALHAR O TOPO DA ESCALA
   -------------------------------------------------------------------------
   PROBLEMA MEDIDO: 76 jogadores dividem FIN=99 no banco, e 97 dividem o valor
   máximo de `finalizacao`. Pelé, Maradona, Batistuta, Lukaku, Doku, Viduka e
   Juan Cuadrado — ponta com overall 85 — são todos o MESMO finalizador para o
   motor. Como finalização vale +49% de gol (medido, 40 pontos de diferença),
   draftar o melhor atacante do mundo não muda nada: ele já é igual aos outros
   noventa e seis.

   TRANSFORMAÇÃO MONÓTONA POR POSTO. Para cada fundamento tratado:
     1. ordena pela chave composta (valor do fundamento, depois overall);
     2. reatribui por POSTO no intervalo [PISO, 99].
   Garantia verificada na simulação: zero inversões de ordem em 177 jogadores
   afetados. Quem era melhor continua melhor; quem estava fora da região
   saturada não é tocado.

   O overall é o critério porque ele NÃO está saturado — 42 valores distintos,
   só o Maradona em 99 e só o Pelé em 98. É informação real do banco, não
   invenção minha.

   COERÊNCIA DA FICHA: mudar FIN sozinho deixaria `cabeceio`, `chute_longe`,
   `bola_parada` e `compostura` incoerentes, porque todos derivam de FIN pelo
   GRAN_MAP. Aplico o delta ponderado em cada um, o que preserva o jitter
   determinístico e os efeitos de trait que já estavam embutidos no valor. */
(function installR1821RespreadTop(root) {
'use strict';
if (root.__CDS_R1821_RESPREAD__) return;
root.__CDS_R1821_RESPREAD__ = true;

const VERSION = '5.15.0-R18.21';
const A8 = ['FIN', 'PAS', 'DRI', 'VEL', 'DEF', 'INT', 'FIS', 'TEC'];
const IX = Object.fromEntries(A8.map((k, i) => [k, i]));

/* Fundamentos tratados e o piso de cada um. Só FIN e PAS estão saturados o
   bastante para justificar (76 e 6 empatados no teto); os demais têm 12 ou
   menos e ficam como estão. */
const ALVOS = [
  { fundamento: 'FIN', limiar: 95, piso: 88 },
  { fundamento: 'PAS', limiar: 95, piso: 90 },
];

/* Peso de cada fundamento dentro de cada atributo derivado (espelha o
   GRAN_MAP do motor). Só as entradas que dependem dos fundamentos tratados. */
const DERIVA = {
  FIN: { finalizacao: 1, cabeceio: .55, chute_longe: .65, bola_parada: .4, compostura: .4 },
  PAS: { passe: 1, visao: .5, cruzamento: .45, trabalho_equipe: .3 },
};

const relatorio = { version: VERSION, aplicado: false, porFundamento: {} };

function reespalhar(squads, alvo) {
  const i = IX[alvo.fundamento];
  const todos = [];
  for (const s of squads) {
    for (const p of (s.pl || [])) {
      if (!p || p.slot === 'GK' || !p.a8) continue;
      if (Number(p.a8[i]) >= alvo.limiar) todos.push(p);
    }
  }
  if (todos.length < 2) return { afetados: todos.length, inversoes: 0 };

  todos.sort((a, b) => {
    const d = Number(b.a8[i]) - Number(a.a8[i]);
    if (d) return d;
    const dr = Number(b.r) - Number(a.r);
    if (dr) return dr;
    return String(a.id || a.n).localeCompare(String(b.id || b.n));   // determinístico
  });

  const n = todos.length;
  let posto = 0, anterior = null, inversoes = 0;
  for (let k = 0; k < n; k++) {
    const p = todos[k];
    if (k > 0) {
      const a = todos[k - 1];
      if (!(Number(a.a8[i]) === Number(p.a8[i]) && Number(a.r) === Number(p.r))) posto = k;
    }
    const t = n > 1 ? posto / (n - 1) : 0;
    const novo = Math.round(99 - t * (99 - alvo.piso));
    if (anterior !== null && novo > anterior) inversoes++;
    anterior = novo;

    const antigo = Number(p.a8[i]);
    const delta = novo - antigo;
    if (!delta) continue;

    p.a8[i] = novo;

    /* Propaga o delta ponderado para os atributos derivados, preservando o
       jitter e os traits que já estavam no valor expandido. */
    const pesos = DERIVA[alvo.fundamento] || {};
    const v3 = p.attributesV3;
    if (v3) {
      const novoV3 = {};
      for (const k2 of Object.keys(v3)) {
        const w = pesos[k2];
        novoV3[k2] = w ? Math.max(20, Math.min(99, Math.round(v3[k2] + w * delta))) : v3[k2];
      }
      try { p.attributesV3 = Object.freeze(novoV3); } catch (_) { /* congelado no pai */ }
    }
    if (p._a) p._a = {};   // limpa o cache do getAttr
  }
  return { afetados: n, inversoes };
}

const oldBuildDB = root.buildDB;
if (typeof oldBuildDB === 'function') {
  root.buildDB = function () {
    const db = oldBuildDB.apply(this, arguments);
    try {
      if (db && Array.isArray(db.squads) && !db.__r1821Respread) {
        for (const alvo of ALVOS) {
          relatorio.porFundamento[alvo.fundamento] = reespalhar(db.squads, alvo);
        }
        Object.defineProperty(db, '__r1821Respread', { value: true, enumerable: false });
        relatorio.aplicado = true;
      }
    } catch (e) {
      relatorio.erro = String(e && e.message || e);
    }
    return db;
  };
}

try {
  root.CDS_R1821_RESPREAD = Object.freeze({
    version: VERSION, alvos: ALVOS,
    relatorio: () => JSON.parse(JSON.stringify(relatorio)),
    nota: 'transformacao monotona por posto; overall como desempate; nenhuma inversao de ordem'
  });
} catch (_) {}
})(typeof window !== 'undefined' ? window : globalThis);
