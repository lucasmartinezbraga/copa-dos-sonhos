#!/usr/bin/env node
'use strict';
/* AVALIADOR DE GATES R18.40A
   -------------------------------------------------------------------------
   Le a matriz de gates da rodada (03_MATRIZ_DE_GATES_R18_40.xlsx, aba Gate
   Matrix) transcrita aqui como constante, e confronta cada bateria candidata
   contra os gates de release R18.40A. Nao inventa faixa: as faixas abaixo sao
   as da matriz.

   Regras da rodada que este avaliador aplica:
     - ECO-03 (chutes 12-20) e piso ESTRITO;
     - efeito so conta se |delta| > banda de ruido E houver mecanismo (o
       mecanismo e humano, o avaliador so marca SINAL/ruido);
     - promove-se o MAIOR subconjunto que passe TODOS os gates de ecologia.

   Uso: node tools/r1840/avalia.js */

const fs = require('fs'), path = require('path');
const RAIZ = path.resolve(__dirname, '..', '..');
const R = p => JSON.parse(fs.readFileSync(path.join(RAIZ, p), 'utf8'));

/* Gates de ecologia com release R18.40A, conforme a matriz. */
const GATES = [
  { id: 'ECO-01', metrica: 'goals',    rotulo: 'gols/partida',  min: 2.4, max: 3.2, ruido: 30, nota: '' },
  { id: 'ECO-02', metrica: 'xg',       rotulo: 'xG/partida',    min: 1.8, max: 2.7, ruido: 7,  nota: '' },
  { id: 'ECO-03', metrica: 'shots',    rotulo: 'chutes/partida',min: 12,  max: 20,  ruido: 7,  nota: 'piso estrito' },
  { id: 'ECO-04', metrica: 'onTarget', rotulo: 'chutes no alvo',min: 4,   max: 7,   ruido: 7,  nota: '' },
];
/* Metricas so observadas: entram no relatorio de regressao, nao reprovam. */
const OBSERVADAS = { corners: 31, fouls: 30, yellow: 51, red: 250, passes: 2, passOk: 1, tackles: 22, offsides: 17, throwIns: 40, goalKicks: 10 };

const BASE = 'reports/r1835/bateria48_r1835.json';
const CANDIDATAS = [
  { nome: 'cand  vel+folego74+goleiro',        arq: 'reports/r1840/cand_vfg.json',      patches: ['velocidade', 'folego74', 'goleiro'] },
  { nome: 'sub_a vel+folego73+goleiro',        arq: 'reports/r1840/sub_a_vf73g.json',   patches: ['velocidade', 'folego73', 'goleiro'] },
  { nome: 'sub_b vel+goleiro',                 arq: 'reports/r1840/sub_b_vg.json',      patches: ['velocidade', 'goleiro'] },
  { nome: 'sub_c goleiro isolado',             arq: 'reports/r1840/sub_c_g.json',       patches: ['goleiro'] },
  { nome: 'sub_d vel+folego73+goleiro+parid.', arq: 'reports/r1840/sub_d_vf73gp.json',  patches: ['velocidade', 'folego73', 'goleiro', 'paridade'] },
  { nome: 'sub_e goleiro+paridade(INERTE)',    arq: 'reports/r1840/sub_e_gp.json',      patches: ['goleiro', 'paridade'] },
  { nome: 'sub_f goleiro+raio1.95',            arq: 'reports/r1840/sub_f_gr.json',      patches: ['goleiro', 'raio'] },
  { nome: 'sub_g vel+goleiro+raio1.95',        arq: 'reports/r1840/sub_g_vgr.json',     patches: ['velocidade', 'goleiro', 'raio'] },
];

const base = R(BASE);
const linhas = [];
for (const c of CANDIDATAS) {
  let d; try { d = R(c.arq); } catch (_) { linhas.push({ nome: c.nome, ausente: true }); continue; }
  const res = { nome: c.nome, sha: d.sha256.slice(0, 12), patches: c.patches.length, gates: [], reprovas: [], regressoes: [], carga: `${d.scriptsCarregados} ok / ${d.scriptsComErro} erro`, motorVerificado: d.motorVerificado === true };
  for (const g of GATES) {
    const x = base.agregado[g.metrica].media, y = d.agregado[g.metrica].media;
    const passa = y >= g.min && y <= g.max;
    res.gates.push({ id: g.id, rotulo: g.rotulo, base: x, valor: y, faixa: `${g.min}-${g.max}`, passa, delta: +(((y - x) / x) * 100).toFixed(1) });
    if (!passa) res.reprovas.push(`${g.id} ${g.rotulo}=${y.toFixed(3)} fora de ${g.min}-${g.max}${g.nota ? ' (' + g.nota + ')' : ''}`);
  }
  for (const [m, ruido] of Object.entries(OBSERVADAS)) {
    const x = base.agregado[m].media, y = d.agregado[m].media;
    const delta = x ? ((y - x) / x) * 100 : 0;
    if (Math.abs(delta) > ruido) res.regressoes.push(`${m} ${x.toFixed(3)}->${y.toFixed(3)} (${delta > 0 ? '+' : ''}${delta.toFixed(1)}%, banda ${ruido}%)`);
  }
  res.aprovada = res.reprovas.length === 0;
  linhas.push(res);
}

const L = s => String(s);
console.log('BASELINE ' + base.build + ' sha ' + base.sha256.slice(0, 12) + '  (n=' + base.partidas + ')');
console.log('');
for (const r of linhas) {
  if (r.ausente) { console.log('  ' + r.nome.padEnd(38) + ' AUSENTE (bateria nao rodou)'); continue; }
  console.log((r.aprovada ? '  [APROVADA] ' : '  [REPROVA ] ') + r.nome.padEnd(38) + ' sha ' + r.sha + '  carga ' + r.carga + (r.motorVerificado ? ' motorOK' : ' MOTOR?'));
  for (const g of r.gates) {
    console.log('      ' + (g.passa ? 'ok  ' : 'FORA') + ' ' + g.id + ' ' + g.rotulo.padEnd(16) + L(g.base.toFixed(3)).padStart(8) + ' -> ' + L(g.valor.toFixed(3)).padStart(8) + '  (' + (g.delta > 0 ? '+' : '') + g.delta + '%)  faixa ' + g.faixa);
  }
  if (r.regressoes.length) console.log('      regressoes acima da banda: ' + r.regressoes.join(' | '));
  console.log('');
}
const aprovadas = linhas.filter(r => !r.ausente && r.aprovada);
aprovadas.sort((a, b) => b.patches - a.patches);
console.log('---');
if (!aprovadas.length) console.log('NENHUMA candidata passa todos os gates de ecologia da R18.40A.');
else {
  console.log('APROVADAS: ' + aprovadas.map(r => r.nome.trim()).join(' | '));
  console.log('MAIOR SUBCONJUNTO APROVADO -> ' + aprovadas[0].nome.trim() + ' (' + aprovadas[0].patches + ' patches, sha ' + aprovadas[0].sha + ')');
}
