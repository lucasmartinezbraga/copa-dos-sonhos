/* ============================================================================
 * R18.24 · P2 — O GOLEIRO PARA DE SEGUIR O PONTA ATÉ O POSTE
 * ----------------------------------------------------------------------------
 * P1 (R18.23) provou que a decisão de sair está certa e a execução é impossível:
 * o goleiro decide sair 3,89×/partida, está a 9,45 m do ponto de chegada e só
 * cobre 3,84 m, porque `speedOf` lhe dá ~5 m/s. Não dá para consertar correndo.
 *
 * A CAUSA está na posição de partida, e é uma linha só. Em `_goalkeeperTarget`,
 * o ramo do portador faz:
 *     ty = clamp(lerp(FW/2, attacker.y, .44+pos/240), 11, FW-11);
 * Com `posicionamento` ~70 o fator é 0,73. Ponta aberto em y=10 leva o goleiro
 * para y≈16 — colado no poste. O cruzamento então é entregue no MEIO
 * (target.y = FW/2 ± 8, ou seja 26..42) e cai exatamente atrás dele. Ele seguiu
 * o portador para um lado e a bola foi para o outro.
 *
 * No futebol o acompanhamento lateral do goleiro segue o ÂNGULO DE CHUTE. Com o
 * portador aberto e junto da linha de fundo esse ângulo é mínimo e a ameaça
 * deixa de ser o chute: passa a ser a ENTREGA. O goleiro protege o primeiro
 * poste sem abandonar o miolo da meta.
 *
 * Esta camada mexe em UMA expressão. Não toca em sorteio, nem em `_cross`, nem
 * na rotina de saída — e é independente de P1, para poder ser medida sozinha.
 * ==========================================================================*/
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const BASE_SHA = '3b2fece8ac4a9d9cbd93d01959bc53f4bbc230a98dcb41e46650a52691b8ddb4'; // R18.21-RC2

function arg(n, d) { const h = process.argv.slice(2).find(a => a.startsWith('--' + n + '=')); return h ? h.slice(n.length + 3) : d; }
const inFile = arg('in', 'rc1-fix.html'), outFile = arg('out', 'rc4-gkpos.html'), force = arg('force', '') === '1';

let src = fs.readFileSync(inFile, 'utf8');
const sha = crypto.createHash('sha256').update(fs.readFileSync(inFile)).digest('hex');
if (sha !== BASE_SHA && !force) { console.error('ABORTA: sha da base não bate.\n esperado ' + BASE_SHA + '\n lido     ' + sha); process.exit(1); }

const applied = [];
function edit(id, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) { console.error('ABORTA [' + id + ']: âncora ' + n + 'x (esperado 1)'); process.exit(1); }
  src = src.replace(from, to); applied.push(id);
}

edit('r1824-posicao-lateral',
`        ty=clamp(lerp(FW/2,attacker.y,.44+pos/240),11,FW-11);`,
`        /* §R18.24 · com o portador ABERTO e junto da LINHA DE FUNDO o ângulo de
           chute é mínimo e a ameaça vira a entrega, não o chute. Seguir a
           lateral dele com fator .73 levava o goleiro ao poste e o cruzamento
           caía atrás dele, no miolo. O acompanhamento decai na posição de
           cruzamento; frontal continua idêntico ao anterior. */
        const _wide=Math.min(1,Math.abs(attacker.y-FW/2)/Math.max(1,FW/2-6));
        const _deep=clamp(1-Math.abs(attacker.x-goal.x)/26,0,1);
        const _crossing=_wide*_deep;
        ty=clamp(lerp(FW/2,attacker.y,(.44+pos/240)*(1-_crossing*.62)),11,FW-11);`);

edit('r1824-identidade',
`  root.CDS_BUILD_ID='R18.21-RC2'; root.CDS_VERSION='5.15.1-R18.21-RC2';`,
`  root.CDS_R1824_GKPOS=Object.freeze({
    version:'R18.24', label:'POSICAO DO GOLEIRO NO CRUZAMENTO', parte:'P2',
    note:'O goleiro seguia a lateral do portador com fator ~0,73; com o ponta aberto na linha ele ia ao poste e o cruzamento caia atras dele, no meio. Medido: 9,45 m do ponto de chegada, cobrindo 3,84 m a 4,32 m/s. Agora o acompanhamento decai na posicao de cruzamento. Ameaca frontal inalterada.'
  });
  root.CDS_BUILD_ID='R18.24'; root.CDS_VERSION='5.18.0-R18.24';`);

edit('r1824-title-runtime', `  if(root.document)root.document.title='Copa dos Sonhos — R18.21-RC2';`,
                            `  if(root.document)root.document.title='Copa dos Sonhos — R18.24';`);
edit('r1824-title-head', `<title>Copa dos Sonhos — R18.21-RC2</title>`, `<title>Copa dos Sonhos — R18.24</title>`);

fs.writeFileSync(outFile, src, 'utf8');
console.log('patches:', applied.join(', '));
console.log('saída:', path.basename(outFile), fs.statSync(outFile).size, 'bytes');
console.log('sha256:', crypto.createHash('sha256').update(fs.readFileSync(outFile)).digest('hex'));
