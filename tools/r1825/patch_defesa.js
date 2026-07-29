/* ============================================================================
 * R18.23 · P1 — O GOLEIRO SAI NA BOLA QUE ENTRA NA SUA ÁREA
 * ----------------------------------------------------------------------------
 * MEDIDO na chegada de cruzamentos sem alvo (26 lances, 12 partidas):
 *   · zagueiro mais próximo ....... 22,1 m
 *   · goleiro ..................... 9,4 m
 *   · defensores até 6 m .......... 0,00
 *   · altura da bola .............. 0,6 m
 *   · alguém passa na validação ... 0%
 * A área não está vazia de atacantes — está vazia de TODO MUNDO, e o goleiro
 * está a 9,4 m de uma bola que cruza a própria linha de gol a meio metro.
 *
 * A CAUSA é precisa. `_goalkeeperClaim` (linha ~6999) já existe e está correta,
 * mas a linha 7006 só testa se a bola JÁ ESTÁ dentro de ~1,25–2,9 m dele:
 *     if (D(p.x,p.y,b.x,b.y) > radius || b.z > 2.7) return false;
 * O goleiro nunca VAI até a bola — ele segue na posição de linha do `_gkAI`
 * enquanto o cruzamento passa. O motor já sabe fazer o oposto: na linha 7063 o
 * recebedor de um passe ataca o ponto físico de chegada durante o voo. Falta
 * exatamente esse ramo para o goleiro.
 *
 * Esta camada NÃO toca em `_goalkeeperClaim`, nem em `_cross`, nem em nenhum
 * sorteio. Ela só faz o goleiro ir. Quando ele chega, a rotina de saída que já
 * existe resolve sozinha em encaixe, soco ou soco para escanteio — e o soco é
 * um dos poucos escanteios do jogo que nasce de evento real.
 *
 * Os atributos `saida_gol` e `dominio_area` passam a decidir se ele sai, e a
 * que distância. Hoje eles só entram no raio do teste passivo.
 * ==========================================================================*/
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const BASE_SHA = '3b2fece8ac4a9d9cbd93d01959bc53f4bbc230a98dcb41e46650a52691b8ddb4'; // R18.21-RC2

function arg(n, d) { const h = process.argv.slice(2).find(a => a.startsWith('--' + n + '=')); return h ? h.slice(n.length + 3) : d; }
const inFile = arg('in', 'rc1-fix.html'), outFile = arg('out', 'rc3-gk.html'), force = arg('force', '') === '1';

let src = fs.readFileSync(inFile, 'utf8');
const sha = crypto.createHash('sha256').update(fs.readFileSync(inFile)).digest('hex');
if (sha !== BASE_SHA && !force) { console.error('ABORTA: sha da base não bate.\n esperado ' + BASE_SHA + '\n lido     ' + sha); process.exit(1); }

const applied = [];
function edit(id, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) { console.error('ABORTA [' + id + ']: âncora ' + n + 'x (esperado 1)'); process.exit(1); }
  src = src.replace(from, to); applied.push(id);
}

/* ── a decisão de sair, latcheada uma vez por entrega ─────────────────────── */
edit('r1823-metodo-saida',
`  _goalkeeperClaim(tm, p, b, dt) {`,
`  /* §R18.23 · o goleiro decide UMA vez por entrega se sai na bola, e então
     converge para o ponto de chegada — como o recebedor de passe já faz na
     linha 7063. Sem isso ele assiste ao cruzamento passar a 9,4 m.
     A decisão é latcheada no objeto do alvo para não re-sortear por frame:
     re-sortear tornaria o resultado dependente da taxa de quadros. */
  _gkCrossCommit(tm, p, b) {
    if (!b || !b.traveling || b.kind !== 'pass' || !b.target || !b.lastTouch) { p._gkFor = null; p._gkGo = null; return null; }
    if (b.lastTouch.team === tm.side) { p._gkFor = null; p._gkGo = null; return null; }
    if (D(b.target.x, b.target.y, tm.goal.x, tm.goal.y) > 16.5) { p._gkFor = null; p._gkGo = null; return null; }
    if (p._gkFor === b.target) return p._gkGo;
    p._gkFor = b.target;
    const exit = getAttr(p, 'saida_gol'), domain = getAttr(p, 'dominio_area');
    const dist = D(p.x, p.y, b.target.x, b.target.y);
    /* comanda a área quem tem saida_gol e dominio_area; e ninguém sai numa bola
       longe demais para chegar antes dela. */
    const pCome = clamp(.18 + (exit * .55 + domain * .45) / 100 * .66 - Math.max(0, dist - 6) * .045, .04, .92);
    p._gkGo = chance(pCome) ? { x: clamp(b.target.x, 1, FL - 1), y: clamp(b.target.y, 1, FW - 1) } : null;
    if (p._gkGo) this.stats[tm.side].gkCrossCommits = (this.stats[tm.side].gkCrossCommits || 0) + 1;
    return p._gkGo;
  }

  _goalkeeperClaim(tm, p, b, dt) {`);

/* ── e o ramo de movimento passa a respeitar essa decisão ────────────────── */
edit('r1823-movimento',
`        } else if (p.isGK) {
          this._goalkeeperClaim(tm, p, b, dt);
          [tx, ty] = this._goalkeeperTarget(tm, p, b, dt);`,
`        } else if (p.isGK) {
          this._goalkeeperClaim(tm, p, b, dt);
          [tx, ty] = this._goalkeeperTarget(tm, p, b, dt);
          /* §R18.23: saiu para a bola? então o alvo é a bola, não a linha. */
          const _gkGo = this._gkCrossCommit(tm, p, b);
          if (_gkGo) { tx = _gkGo.x; ty = _gkGo.y; }`);

edit('r1823-identidade',
`  root.CDS_BUILD_ID='R18.21-RC2'; root.CDS_VERSION='5.15.1-R18.21-RC2';`,
`  root.CDS_R1823_DEFESA=Object.freeze({
    version:'R18.23', label:'GOLEIRO SAI NA AREA', parte:'P1',
    note:'O goleiro estava a 9,4 m da bola que entrava na propria area, porque _goalkeeperClaim so testa se a bola JA esta a ~2 m dele. Agora ele decide sair (saida_gol/dominio_area) e converge para o ponto de chegada, como o recebedor de passe ja fazia. Nenhum sorteio foi tocado.'
  });
  root.CDS_BUILD_ID='R18.23'; root.CDS_VERSION='5.17.0-R18.23';`);

edit('r1823-title-runtime', `  if(root.document)root.document.title='Copa dos Sonhos — R18.21-RC2';`,
                            `  if(root.document)root.document.title='Copa dos Sonhos — R18.23';`);
edit('r1823-title-head', `<title>Copa dos Sonhos — R18.21-RC2</title>`, `<title>Copa dos Sonhos — R18.23</title>`);

fs.writeFileSync(outFile, src, 'utf8');
console.log('patches:', applied.join(', '));
console.log('saída:', path.basename(outFile), fs.statSync(outFile).size, 'bytes');
console.log('sha256:', crypto.createHash('sha256').update(fs.readFileSync(outFile)).digest('hex'));
