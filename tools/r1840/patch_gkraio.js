/* ============================================================================
 * R18.40 · O PLANO E A CHECAGEM VOLTAM A USAR O MESMO RAIO  (CAU-04 de verdade)
 * ----------------------------------------------------------------------------
 * A CACADA. `patch_gkparidade.js` (velocidade do planejador) saiu INERTE: a
 * bateria n=48 do sub_e ficou byte-identica a do sub_c, e o A/B da sequencia de
 * retorno de `_gkInterceptTarget` deu o mesmo hash. Motivo: existem DUAS
 * definicoes de `_gkInterceptTarget` na build. A do bundle base (offset ~973k)
 * e SOBRESCRITA por `P._gkInterceptTarget=function(...)` do bloco
 * cds-physics-timeline-581 (offset ~1496k) — que e justamente o
 * `20-physics-timeline.js` que a ficha OS-01 citava. Patch no lugar sombreado.
 *
 * O MECANISMO REAL, e nao e velocidade. O planejador vivo faz:
 *
 *     required = max(0, dist(gk, ponto) - radius)      // radius = argumento
 *     hMargin  = horizontalReach(...).center - required
 *
 * e os tres sitios de CHUTE o chamam com **radius = 3.0**, enquanto
 * `_gkResolveSave` valida o contato com **_physicalContactValid(gk, 1.95, z)**.
 * Com radius 3.0 um ponto a 3 m do goleiro tem `required = 0`: o plano declara
 * que ele JA esta lá, o corpo nao recebe ordem de andar, a bola chega, e a
 * checagem de 1,95 m reprova. Vira `goal_after_failed_reach`.
 *
 * QUEM INTRODUZIU. `tools/r1821/build_rc1.js` linha ~128 troca 1.95 por 3.0 nos
 * sitios de chute de proposito (a preocupacao era a rota do cruzamento rasteiro)
 * e deixa falta e penalti em 1,95 "de proposito: ali o goleiro esta
 * posicionado". A checagem nunca foi acompanhada. O defeito e desta troca.
 *
 * POR QUE VOLTAR O PLANO, E NAO ABRIR A CHECAGEM. O proprio motor modela o
 * alcance de corpo do goleiro em `horizontalReach`:
 *     body = 1.18 + altura*0.22 + q*0.18   ~= 2,1 m
 * e a checagem usa 1,95 m mais 0,18 m de tolerancia da camada R10 = 2,13 m —
 * coerente com o corpo. 3,0 m e o numero fora da curva. Abrir a checagem para
 * 3,0 faria o goleiro "tocar" bolas a tres metros, que e exatamente o tipo de
 * falsidade visual que a auditoria existe para pegar.
 *
 * Bola parada continua em 1,95 (nunca foi alterada) e nao e tocada aqui.
 * ==========================================================================*/
const fs = require('fs'), crypto = require('crypto'), path = require('path');
const a = (n, d) => { const h = process.argv.slice(2).find(x => x.startsWith('--' + n + '=')); return h ? h.slice(n.length + 3) : d; };
const RAIO = a('raio', '1.95');

let src = fs.readFileSync(a('in', 'sc.html'), 'utf8');
const applied = [];
function trocaTodas(id, from, to, esperado) {
  const n = src.split(from).length - 1;
  if (n !== esperado) { console.error('ABORTA [' + id + ']: ancora ' + n + 'x, esperado ' + esperado); process.exit(1); }
  src = src.split(from).join(to); applied.push(id + ' x' + n);
}

/* Os dois sitios de finalizacao apos cruzamento/cabeceio. */
trocaTodas('r1840-raio-atk',
  `const st=this._gkInterceptTarget(gk,atk.x,atk.y,goalAim,shotSpeed,3.0);`,
  `const st=this._gkInterceptTarget(gk,atk.x,atk.y,goalAim,shotSpeed,${RAIO});`, 2);

/* O sitio do chute normal. */
trocaTodas('r1840-raio-shot',
  `const saveTarget=this._gkInterceptTarget(gk,o.x,o.y,goalAim,shotSpeed,3.0);`,
  `const saveTarget=this._gkInterceptTarget(gk,o.x,o.y,goalAim,shotSpeed,${RAIO});`, 1);

fs.writeFileSync(a('out', 'gkr.html'), src, 'utf8');
console.log('patches:', applied.join(', '));
console.log(path.basename(a('out', 'gkr.html')), '| raio', RAIO, '|', crypto.createHash('sha256').update(fs.readFileSync(a('out', 'gkr.html'))).digest('hex').slice(0, 12));
