/* ============================================================================
 * R18.27 · P4 — A LINHA RECUA NA BOLA ABERTA NO TERÇO FINAL
 * ----------------------------------------------------------------------------
 * MEDIDO no instante em que o cruzamento sai (52 lances, 12 partidas):
 *
 *   voo do cruzamento .............................. 30,9 m
 *   zagueiro mais próximo do PRÓPRIO GOL ........... 26,6 m
 *   zagueiro mais próximo do ponto de chegada ...... 18,2 m
 *   defensores dentro da própria grande área ....... 0,25
 *   defensores a até 10 m do ponto de chegada ...... 0,19
 *
 * Um cruzamento sai de 30 metros e há um QUARTO de zagueiro dentro da área.
 * No futebol essa bola encontra quatro a seis defensores lá dentro. É daí que
 * vêm o corte de cabeça, o desvio e o escanteio — e é a ausência disso que
 * obriga o motor a fabricar escanteio com `chance()` (80% dos escanteios são
 * concedidos com a bola ainda em jogo).
 *
 * A CAUSA está no bloco de zona de `_defendTarget`: a linha desloca apenas
 * `shiftScale = 0.25` do avanço da bola. Quando o ataque vai do meio (52,5 m)
 * para 20 m do gol, a zaga recua 8 m e fica a 26 m da própria meta.
 *
 * Mudar `shiftScale` mexeria no bloco em TODAS as fases e é justamente o que os
 * gates de identidade de estilo medem (`parkIdentity`, `tikiIdentity`). Esta
 * camada não faz isso: ela age só numa fase bem definida — bola ABERTA e no
 * TERÇO FINAL, isto é, posição de cruzamento — e nela puxa a linha para dentro
 * da própria área. Fora dessa fase o alvo é bit a bit o mesmo de antes.
 * ==========================================================================*/
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const BASE_SHA = 'ddccf733e8803af282420f9ba095165e22f7eee0147a04af6a12d5cc12552653'; // R18.25 (P3)

function arg(n, d) { const h = process.argv.slice(2).find(a => a.startsWith('--' + n + '=')); return h ? h.slice(n.length + 3) : d; }
const inFile = arg('in', 'rc5-entrega.html'), outFile = arg('out', 'rc8-zaga.html'), force = arg('force', '') === '1';

let src = fs.readFileSync(inFile, 'utf8');
const sha = crypto.createHash('sha256').update(fs.readFileSync(inFile)).digest('hex');
if (sha !== BASE_SHA && !force) { console.error('ABORTA: sha da base não bate.\n esperado ' + BASE_SHA + '\n lido     ' + sha); process.exit(1); }

const applied = [];
function edit(id, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) { console.error('ABORTA [' + id + ']: âncora ' + n + 'x (esperado 1)'); process.exit(1); }
  src = src.replace(from, to); applied.push(id);
}

edit('r1827-defesa-zonal-de-cruzamento',
`    // ZAGUEIRO ACOMPANHA INFILTRAÇÃO (§2): marca o atacante que arranca nas costas`,
`    /* §R18.27 · DEFESA DE CRUZAMENTO É ZONAL. Com a bola aberta no terço final
       os zagueiros largam a marcação individual e ocupam a própria área.
       Sem isto a defesa ESPELHA o ataque: o ramo de marcação abaixo devolve a
       posição do marcado, e como os atacantes não entram na área (0,04 a até
       12 m do ponto de chegada) os zagueiros também não (0,25 na grande área).
       A bola então cai sem ninguém, e o motor precisa fabricar escanteio com
       chance() — 80% deles são concedidos com a bola ainda em jogo.
       Fora desta fase o método segue idêntico ao anterior. */
    const _abertura = Math.min(1, Math.abs(b.y - FW/2) / Math.max(1, FW/2 - 6));
    const _profund = clamp((40 - Math.abs(b.x - tm.goal.x)) / 22, 0, 1);
    const _amecaCruz = _abertura * _profund;
    if (_amecaCruz > 0.22 && C.LINE_OF[p.oopPos || p.slotPos] === 'DEF' && p !== tm._cover && p !== presser) {
      const _prof = 7 + (1 - _amecaCruz) * 9;
      const _bx = tm.goal.x + dir * _prof;
      const _by = clamp(lerp(p.hy, FW / 2, .42), FW / 2 - 11.5, FW / 2 + 11.5);
      return [clamp(_bx, 1, FL - 1), clamp(_by, 3, FW - 3)];
    }
    // ZAGUEIRO ACOMPANHA INFILTRAÇÃO (§2): marca o atacante que arranca nas costas`);

edit('r1827-identidade',
`  root.CDS_BUILD_ID='R18.25'; root.CDS_VERSION='5.19.0-R18.25';`,
`  root.CDS_R1827_ZAGA=Object.freeze({
    version:'R18.27', label:'LINHA RECUA NA BOLA ABERTA', parte:'P4',
    note:'Com o cruzamento saindo, o zagueiro mais proximo estava a 26,6 m do proprio gol e havia 0,25 defensor dentro da grande area. O bloco de zona desloca so 0.25 do avanco da bola. Agora, e SO na fase de bola aberta no terco final, a linha recua para dentro da area. shiftScale global intocado para nao mexer nos gates de identidade de estilo.'
  });
  root.CDS_BUILD_ID='R18.27'; root.CDS_VERSION='5.21.0-R18.27';`);

edit('r1827-title-runtime', `  if(root.document)root.document.title='Copa dos Sonhos — R18.25';`,
                            `  if(root.document)root.document.title='Copa dos Sonhos — R18.27';`);
edit('r1827-title-head', `<title>Copa dos Sonhos — R18.25</title>`, `<title>Copa dos Sonhos — R18.27</title>`);

fs.writeFileSync(outFile, src, 'utf8');
console.log('patches:', applied.join(', '));
console.log('saída:', path.basename(outFile), fs.statSync(outFile).size, 'bytes');
console.log('sha256:', crypto.createHash('sha256').update(fs.readFileSync(outFile)).digest('hex'));
