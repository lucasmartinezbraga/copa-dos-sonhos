/* ============================================================================
 * R18.29 · A LINHA DEFENSIVA DESCE NA POSIÇÃO DE CRUZAMENTO
 * ----------------------------------------------------------------------------
 * QUATRO tentativas anteriores falharam pelo MESMO motivo estrutural, e vale
 * registrar: o método base `_defendTarget` da classe é CÓDIGO MORTO para
 * zagueiro e meio-campo. A camada R13 (linha ~16770) o reimplementa por
 * completo e retorna em todos os ramos — presser, antecipação, `_markRef`,
 * dropper, cobertura, sombra — sem nunca chamar adiante. Censo: 8.392
 * avaliações do ramo base durante a fase de cruzamento, e TODAS eram LW/ST/RW.
 * Nenhum zagueiro. Por isso quatro calibrações diferentes deram números
 * idênticos: eu estava afinando código que não governa.
 *
 * O CONTROLE REAL é `desiredLine13` (linha ~16613), que define a profundidade
 * coletiva da linha. Os jogadores da linha DEF são presos a ela por ±2,45 m
 * (linha 20069) e ±3,0 m (16795), por desenho: "a última linha trabalha como
 * uma unidade". Mexer em jogador é lutar contra esse desenho; mexer na LINHA é
 * trabalhar com ele.
 *
 * O NÚMERO que explica a área deserta:
 *     base = clamp13(23 + bp*.235, 21, 43)     // 'balanced'
 * Com a bola a 25 m do próprio gol a linha fica em 28,9 m, e o **piso de 21 m**
 * proíbe estruturalmente a defesa de entrar na própria grande área (16,5 m). A
 * única rota para baixo é `deepest - 2.2`, que segue o atacante mais adiantado
 * — e os atacantes não entram na área (0,04 a até 12 m do ponto de chegada).
 * A defesa espelha o ataque, e o cruzamento cai sem ninguém: 0,25 defensor na
 * grande área, zagueiro mais próximo a 26,6 m do próprio gol.
 *
 * No futebol, com a bola aberta e junto da linha de fundo a ameaça deixa de ser
 * o passe em profundidade e passa a ser a ENTREGA — a linha desce para dentro
 * da área, onde a bola vai cair, e aceita perder a linha de impedimento.
 *
 * Só nessa fase. Fora dela `desired` é bit a bit o mesmo de antes.
 * ==========================================================================*/
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const BASE_SHA = 'ddccf733e8803af282420f9ba095165e22f7eee0147a04af6a12d5cc12552653'; // R18.25

function arg(n, d) { const h = process.argv.slice(2).find(a => a.startsWith('--' + n + '=')); return h ? h.slice(n.length + 3) : d; }
const inFile = arg('in', 'rc5-entrega.html'), outFile = arg('out', 'rc9-linha.html'), force = arg('force', '') === '1';

/* calibração — exposta para varredura medida */
const INICIO = Number(arg('inicio', 38));   // bp (m do próprio gol) em que a ameaça começa
const ESCALA = Number(arg('escala', 20));   // m para a ameaça ir de 0 a 1
const ALVO   = Number(arg('alvo', 12.5));   // profundidade da linha na ameaça máxima
const GANHO  = Number(arg('ganho', 1.6));   // quão rápido a ameaça vira recuo

let src = fs.readFileSync(inFile, 'utf8');
const sha = crypto.createHash('sha256').update(fs.readFileSync(inFile)).digest('hex');
if (sha !== BASE_SHA && !force) { console.error('ABORTA: sha da base não bate.'); process.exit(1); }

const applied = [];
function edit(id, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) { console.error('ABORTA [' + id + ']: âncora ' + n + 'x'); process.exit(1); }
  src = src.replace(from, to); applied.push(id);
}

edit('r1829-linha-desce-no-cruzamento',
`  desired=clamp13(desired,8,50);`,
`  /* §R18.29 · POSIÇÃO DE CRUZAMENTO: bola aberta e junto da linha de fundo.
     A ameaça vira a ENTREGA, não a profundidade — a linha desce para dentro da
     própria área, que é onde a bola vai cair, e aceita perder o impedimento.
     Sem isto o piso de 21 m em \`base\` impede a defesa de entrar na própria
     grande área e o cruzamento chega sem ninguém (0,25 defensor lá dentro). */
  const _ab13=Math.min(1,Math.abs(finite13(b.y,FW13/2)-FW13/2)/Math.max(1,FW13/2-6));
  const _pf13=clamp13((${INICIO}-bp)/${ESCALA},0,1);
  const _cruz13=_ab13*_pf13;
  if(_cruz13>0.05){
    desired=lerp13(desired,${ALVO},Math.min(1,_cruz13*${GANHO}));
    tm._r13CrossDrop=_cruz13;
  } else tm._r13CrossDrop=0;
  desired=clamp13(desired,8,50);`);

edit('r1829-id',
`  root.CDS_BUILD_ID='R18.25'; root.CDS_VERSION='5.19.0-R18.25';`,
`  root.CDS_R1829_LINHA=Object.freeze({
    version:'R18.29', label:'LINHA DESCE NO CRUZAMENTO',
    calib:{inicio:${INICIO},escala:${ESCALA},alvo:${ALVO},ganho:${GANHO}},
    note:'desiredLine13 tinha piso de 21 m em base, proibindo a linha de entrar na propria grande area (16,5 m); a unica rota para baixo era seguir o atacante mais adiantado, e os atacantes nao entram na area. Agora, e so na posicao de cruzamento, a linha desce para dentro da area. O metodo base _defendTarget e codigo morto para DEF/MID: a camada R13 o reimplementa e nunca chama adiante.'
  });
  root.CDS_BUILD_ID='R18.29'; root.CDS_VERSION='5.23.0-R18.29';`);

edit('r1829-title', `  if(root.document)root.document.title='Copa dos Sonhos — R18.25';`,
                    `  if(root.document)root.document.title='Copa dos Sonhos — R18.29';`);
edit('r1829-head', `<title>Copa dos Sonhos — R18.25</title>`, `<title>Copa dos Sonhos — R18.29</title>`);

fs.writeFileSync(outFile, src, 'utf8');
console.log(path.basename(outFile), '|', crypto.createHash('sha256').update(fs.readFileSync(outFile)).digest('hex').slice(0, 12),
            '| inicio', INICIO, 'escala', ESCALA, 'alvo', ALVO, 'ganho', GANHO);
