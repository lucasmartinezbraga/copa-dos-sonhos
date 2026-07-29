/* ============================================================================
 * R18.32 · O BLOQUEIO PRODUZ VELOCIDADE, NÃO DESFECHO
 * ----------------------------------------------------------------------------
 * Depois da R18.31 a concordância geométrica dos reinícios subiu de 70,1% para
 * 93,0%. Os 7% que sobram vêm de quatro `chance()` que ainda CONVOCAM escanteio.
 * Três deles são o mesmo mecanismo — um defensor bloqueia — e caem juntos:
 *
 *   linha 5345  bloqueio de cruzamento   chance(.42)                 → escanteio
 *                                        senão `_turnover(def)`
 *   linha 5420  bloqueio de cabeceio     chance(aerialBlockCorner)   → escanteio
 *                                        senão `_deflectTo` preso dentro do campo
 *   linha 6171  bloqueio de chute        chance(shotBlockCorner)     → escanteio
 *                                        senão `_looseBall` NA FRENTE DO GOL
 *
 * O de 6171 tem os dois vícios: fabrica o escanteio E, no `else`, chama
 * `_looseBall`, que zera a velocidade e entrega a bola ao jogador mais próximo
 * **sem limite de distância** — a fábrica de chance fácil que inflou o xG em 30%
 * na R18.22.
 *
 * No futebol um bloqueio é um CONTATO: a bola sai dele com energia e direção, e
 * onde ela para é consequência. Se cruzar a linha de fundo com o último toque do
 * defensor, é escanteio — de verdade, não sorteado. Se sair pelo lado, lateral.
 * Se seguir em campo, é segunda bola. `_ballOut()` já decide tudo isso e acerta
 * 99,3% das vezes.
 *
 * Uma rotina, três sítios, nenhum número de calibração novo.
 * ==========================================================================*/
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const BASE_SHA = '1377d8081a33eb465166714bee57dd9fffde4afd5b08f8554f2f72cbb5d94417'; // R18.31

function arg(n, d) { const h = process.argv.slice(2).find(a => a.startsWith('--' + n + '=')); return h ? h.slice(n.length + 3) : d; }
const inFile = arg('in', 'rl-livre.html'), outFile = arg('out', 'rm-deflexao.html'), force = arg('force', '') === '1';

let src = fs.readFileSync(inFile, 'utf8');
const sha = crypto.createHash('sha256').update(fs.readFileSync(inFile)).digest('hex');
if (sha !== BASE_SHA && !force) { console.error('ABORTA: sha da base não bate.'); process.exit(1); }

const applied = [];
function edit(id, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) { console.error('ABORTA [' + id + ']: âncora ' + n + 'x (esperado 1)'); process.exit(1); }
  src = src.replace(from, to); applied.push(id);
}

/* ── a rotina, ao lado de `_looseBall` para ficar claro o contraste ──────── */
edit('r1832-rotina',
`  _looseBall(x, y) {`,
`  /* §R18.32 · DEFLEXÃO LIVRE. Um bloqueio produz VELOCIDADE, não desfecho.
     A bola sai do contato com energia e rumo plausíveis, o último toque passa a
     ser de quem bloqueou, e o reinício nasce de \`_ballOut\`: escanteio se ela
     cruzar a linha de fundo, lateral se sair pelo lado, segunda bola se seguir
     em jogo. NÃO usar \`_looseBall\` aqui — ele zera a velocidade e entrega a
     bola ao mais próximo sem nenhum limite de distância. */
  _deflexaoLivre(actor) {
    const b = this.ball;
    b.owner = null; b.traveling = false; b.meta = null; b.receiver = null; b.onArrive = null;
    if (actor) b.lastTouch = actor;
    const ivx = Number.isFinite(b.vx) ? b.vx : 0, ivy = Number.isFinite(b.vy) ? b.vy : 0;
    const iv = Math.hypot(ivx, ivy);
    /* o bloqueio raspa: mantém parte da energia e espalha o rumo para os dois
       lados — inclusive para trás, que é de onde nasce o escanteio real. */
    const ang = (iv > 0.2 ? Math.atan2(ivy, ivx) : R(0, 6.28)) + R(-2.2, 2.2);
    const spd = clamp(Math.max(4.5, (iv > 0.2 ? iv : 18) * (0.22 + R(0, 0.46))), 4.5, 26);
    b.vx = Math.cos(ang) * spd; b.vy = Math.sin(ang) * spd;
    b.vz = Math.max(0, R(0, 2.2));
    b._looseT = 0; b.__p04Live = true;
    this._emit('deflexao', { by: actor });
  }

  _looseBall(x, y) {`);

/* ── sítio 1 · bloqueio de cruzamento ───────────────────────────────────── */
edit('r1832-bloqueio-cruzamento',
`          if(chance(.42)) this._setCorner(o.team); else this._turnover(def);`,
`          this._deflexaoLivre(def);   /* §R18.32: era chance(.42) → escanteio */`);

/* ── sítio 2 · bloqueio de cabeceio ─────────────────────────────────────── */
edit('r1832-bloqueio-cabeceio',
`                if(chance(CAL.restarts.aerialBlockCorner))this._setCorner(o.team);
                else this._deflectTo(clamp(this.ball.x-hdDir*R(2,6),2,FL-2),clamp(this.ball.y+R(-5,5),2,FW-2),10);`,
`                this._deflexaoLivre(def);   /* §R18.32: era aerialBlockCorner → escanteio,
                   e o \`else\` prendia a deflexão dentro do campo com clamp(...,2,FL-2),
                   impedindo justamente a bola de sair e virar escanteio de verdade. */`);

/* ── sítio 3 · bloqueio de chute ────────────────────────────────────────── */
edit('r1832-bloqueio-chute',
`            if(chance(CAL.restarts.shotBlockCorner))this._setCorner(o.team);
            else this._looseBall(this.ball.x,this.ball.y);`,
`            this._deflexaoLivre(blocker);   /* §R18.32: era shotBlockCorner → escanteio,
               e o \`else\` era _looseBall NA FRENTE DO GOL — o mesmo mecanismo que
               inflou o xG em 30% na R18.22. */`);

edit('r1832-id',
`  root.CDS_BUILD_ID='R18.31'; root.CDS_VERSION='5.25.0-R18.31';`,
`  root.CDS_R1832_DEFLEXAO=Object.freeze({
    version:'R18.32', label:'BLOQUEIO PRODUZ VELOCIDADE',
    sitios:Object.freeze(['bloqueio_cruzamento_chance042','bloqueio_cabeceio_aerialBlockCorner','bloqueio_chute_shotBlockCorner']),
    note:'Tres sorteios de escanteio caem juntos: sao o mesmo mecanismo (um defensor bloqueia). Agora o bloqueio produz velocidade e o reinicio nasce de _ballOut. O sitio do chute tinha os dois vicios: fabricava escanteio e, no else, chamava _looseBall na frente do gol.'
  });
  root.CDS_BUILD_ID='R18.32'; root.CDS_VERSION='5.26.0-R18.32';`);

edit('r1832-title', `  if(root.document)root.document.title='Copa dos Sonhos — R18.31';`,
                    `  if(root.document)root.document.title='Copa dos Sonhos — R18.32';`);
edit('r1832-head', `<title>Copa dos Sonhos — R18.31</title>`, `<title>Copa dos Sonhos — R18.32</title>`);

fs.writeFileSync(outFile, src, 'utf8');
console.log('patches:', applied.join(', '));
console.log(path.basename(outFile), '|', crypto.createHash('sha256').update(fs.readFileSync(outFile)).digest('hex').slice(0, 12));
