/* ============================================================================
 * R18.50 · IDENTIDADE DA BUILD
 * ----------------------------------------------------------------------------
 * ENTRA: OS-09 — o plano tatico 'save_energy' sai do codigo morto.
 *   `_adaptivePlan` so o escolhia com estamina media do time abaixo de 62, e o
 *   piso que o motor produz esta acima disso. Gatilho 62 -> 76.
 *   INT-05 (3-12% das decisoes): 0,00% -> 6,67%. `balance` 51,12% (piso 40%).
 *   Os seis gates cumprem em 3/3 bases, e COE-01 MELHORA (1,062 -> 1,037),
 *   respondendo ao aviso de drift que o relatorio da R18.49 deixou em §E.
 *
 * O gatilho e 76 e nao 73 porque a auditoria registrava "73 = 3,56%" da era
 * R18.40, e isso nao vale mais nesta build: medido aqui, 73 entrega 2,41%,
 * abaixo do piso de INT-05. As rodadas de bloco mudaram a dinamica de estamina.
 *
 * NAO ENTRA: OS-05 (fonte de escanteio). O mecanismo foi localizado e a
 * tentativa esta medida e rejeitada — ver reports/r1850/RELATORIO.md §C.
 * ==========================================================================*/
const fs = require('fs'), crypto = require('crypto'), path = require('path');
const a = (n, d) => { const h = process.argv.slice(2).find(x => x.startsWith('--' + n + '=')); return h ? h.slice(n.length + 3) : d; };
const GAT = a('gatilho', '76');

let src = fs.readFileSync(a('in', 'f76.html'), 'utf8');
const applied = [];
function edit(id, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) { console.error('ABORTA [' + id + ']: ancora ' + n + 'x'); process.exit(1); }
  src = src.replace(from, to); applied.push(id);
}

edit('r1850-id',
`  root.CDS_BUILD_ID='R18.49'; root.CDS_VERSION='5.36.0-R18.49';`,
`  root.CDS_R1850=Object.freeze({version:'R18.50',label:'PRESERVAR ENERGIA SAI DO CODIGO MORTO',gatilho:${GAT},
    entrou:['OS-09 save_energy: gatilho de estamina 62 -> ${GAT}. INT-05 0,00% -> 6,67% das decisoes, balance 51,12%'],
    gates:'ECO-01 2,500 · ECO-02 2,435 · ECO-03 14,813 · ECO-04 4,813 · COE-01 1,037 · CAU-03 2,344 — seis em 3/3 bases',
    naoEntrou:['OS-05 fonte de escanteio: mecanismo localizado (o corte de cabeca no ramo aereo entregava a bola por _turnover em vez de deixa-la viajar), tentativa medida e REJEITADA — quebrava a entrega do escanteio, evento corner ia a zero'],
    note:'O gatilho 73 que a auditoria registrava vinha da era R18.40 e nao vale nesta build: medido aqui entrega 2,41%, abaixo do piso de INT-05. As rodadas de bloco mudaram a dinamica de estamina. COE-01 melhorou de 1,062 para 1,037, respondendo ao aviso de drift do relatorio da R18.49.'});
  root.CDS_BUILD_ID='R18.50'; root.CDS_VERSION='5.37.0-R18.50';`);

const T1 = `  if(root.document)root.document.title='Copa dos Sonhos — R18.49';`;
if (src.split(T1).length - 1 === 1) src = src.replace(T1, `  if(root.document)root.document.title='Copa dos Sonhos — R18.50';`);
const T2 = `<title>Copa dos Sonhos — R18.49</title>`;
if (src.split(T2).length - 1 === 1) src = src.replace(T2, `<title>Copa dos Sonhos — R18.50</title>`);

fs.writeFileSync(a('out', 'r1850.html'), src, 'utf8');
console.log('patches:', applied.join(', '));
console.log(path.basename(a('out', 'r1850.html')), '|', crypto.createHash('sha256').update(fs.readFileSync(a('out', 'r1850.html'))).digest('hex'));
