/* ============================================================================
 * R18.40A · IDENTIDADE DA BUILD
 * ----------------------------------------------------------------------------
 * Aplicado por ultimo na cadeia. Fica separado dos patches de jogo porque esta
 * rodada mediu sete subconjuntos e promoveu um: o rotulo tem de descrever o que
 * de fato entrou, e nao a intencao da rodada.
 *
 * ENTRA (bateria pareada n=48, sha da build medida = sha da build promovida):
 *   OS-10  a velocidade derivada satura no teto do proprio jogador
 *          18,28 -> 8,98 m/s. Gate TEC-01.
 *   OS-01  o goleiro caminha ate o ponto de contato que o plano calculou
 *          PARCIAL: CAU-03 vai de 21,34% para 17,75% (5 sementes, 60 partidas)
 *          contra alvo de 8%. NAO esta concluida.
 *
 * NAO ENTRA, medido e arquivado:
 *   OS-09  save_energy sai do codigo morto. Atinge INT-05 (3-12%) com gatilho
 *          73 ou 74, mas corta pressReach em 0,52 e derruba chutes abaixo do
 *          piso estrito de 12 (11,958 e 11,771 contra 12,042 sem ele).
 *   CAU-04 paridade de RAIO entre plano e checagem. E o mecanismo verdadeiro de
 *          OS-01: os sitios de chute pedem plano com raio 3.0 e a checagem usa
 *          1,95. Corrigir leva CAU-03 de 21,34% para 1,24% — mas derruba gols
 *          para 2,021 e chutes no alvo para 3,750, ambos fora da faixa, porque
 *          contato valido em _gkResolveSave nunca concede gol. Precisa de
 *          recalibracao de finalizacao: R18.40B.
 *   OS-02  escalacao por elegibilidade (Pele 98 saia do banco). Correta, e poe
 *          gols em 3,729 e xG em 3,008. Mesma recalibracao: R18.40B.
 *
 * Tambem nesta rodada, fora do jogo: o harness do laboratorio parou de engolir
 * "document is not defined" (gate TEC-05). Ele contava o bloco falho como
 * carregado e todos os relatorios anteriores diziam "0 erro". Agora reporta
 * 48 ok / 1 erro, registra bloco e linha, e aborta se faltar simbolo do motor.
 * A baseline re-medida com o harness corrigido devolveu agregados IDENTICOS.
 * ==========================================================================*/
const fs = require('fs'), crypto = require('crypto'), path = require('path');
const a = (n, d) => { const h = process.argv.slice(2).find(x => x.startsWith('--' + n + '=')); return h ? h.slice(n.length + 3) : d; };

let src = fs.readFileSync(a('in', 'cand.html'), 'utf8');
const applied = [];
function edit(id, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) { console.error('ABORTA [' + id + ']: ancora ' + n + 'x'); process.exit(1); }
  src = src.replace(from, to); applied.push(id);
}

edit('r1840a-id',
`  root.CDS_BUILD_ID='R18.35'; root.CDS_VERSION='5.29.0-R18.35';`,
`  root.CDS_R1840A=Object.freeze({version:'R18.40A',label:'O TETO DE VELOCIDADE E O GOLEIRO QUE VAI AO PONTO',
    entrou:[
      'OS-10 velocidade derivada satura no teto do jogador: 18,28 -> 8,98 m/s (TEC-01)',
      'OS-01 PARCIAL: o goleiro caminha ate o ponto planejado; CAU-03 21,34% -> 17,75%, alvo 8% nao atingido'
    ],
    naoEntrou:[
      'OS-09 save_energy: atinge INT-05 mas derruba chutes abaixo do piso estrito de 12',
      'CAU-04 paridade de raio (plano 3.0 x checagem 1,95): leva CAU-03 a 1,24% mas poe gols em 2,021 e no alvo em 3,750',
      'OS-02 escalacao: correta, poe gols em 3,729 e xG em 3,008 — recalibracao de finalizacao na R18.40B'
    ],
    laboratorio:'harness deixou de engolir "document is not defined" (TEC-05): 48 ok / 1 erro, com abort se faltar simbolo do motor. Baseline re-medida deu agregados identicos.',
    note:'O mecanismo verdadeiro de OS-01 nao e velocidade: os sitios de chute planejam com raio 3.0 (posto por tools/r1821/build_rc1.js) enquanto _gkResolveSave valida com 1,95. Um ponto a 3 m tem required=0, o corpo nao recebe ordem de andar e a checagem reprova. A correcao existe e esta medida, mas o jogo esta escorado nesse vazamento para produzir ~20% dos gols.'});
  root.CDS_BUILD_ID='R18.40A'; root.CDS_VERSION='5.30.0-R18.40A';`);

edit('r1840a-title-js', `  if(root.document)root.document.title='Copa dos Sonhos — R18.35';`,
                        `  if(root.document)root.document.title='Copa dos Sonhos — R18.40A';`);
edit('r1840a-title-head', `<title>Copa dos Sonhos — R18.35</title>`, `<title>Copa dos Sonhos — R18.40A</title>`);

fs.writeFileSync(a('out', 'r1840a.html'), src, 'utf8');
console.log('patches:', applied.join(', '));
console.log(path.basename(a('out', 'r1840a.html')), '|', crypto.createHash('sha256').update(fs.readFileSync(a('out', 'r1840a.html'))).digest('hex'));
