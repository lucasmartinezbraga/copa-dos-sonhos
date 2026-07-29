/* ============================================================================
 * R18.22 · CRUZAMENTO SEM ALVO VIRA DISPUTA, NÃO CARA-OU-COROA
 * ----------------------------------------------------------------------------
 * MEDIDO (sonda neutra no RNG, 15 partidas, 3 formações, 219 cruzamentos):
 *
 *   · 5,47 cruzamentos por partida — 37,5% de TODOS — caem no ramo `!atk` de
 *     `_cross`, em que a área está vazia e NENHUM jogador encosta na bola.
 *   · O lance é resolvido por `chance(CAL.restarts.failedCrossCorner)` — um
 *     cara-ou-coroa literal entre escanteio e tiro de meta.
 *   · E só 2,26 dos 5,47 chegam sequer ao sorteio: os outros 3,21 se perdem no
 *     caminho, sem resolução nenhuma.
 *
 * No futebol, uma bola cruzada para a área sem atacante é do GOLEIRO ou do
 * ZAGUEIRO — vira defesa, corte de cabeça, segunda bola e, quando o corte sai
 * torto, escanteio. É de onde saem o duelo aéreo e o escanteio que faltam:
 * `header_clear` está em 0,53/partida e escanteio em 0,80 contra alvo 4–10.
 *
 * A rotina de corte JÁ EXISTE e é boa — `_clearBall(o)`, linha ~5502: escolhe o
 * companheiro melhor colocado, lança a segunda bola e emite `header_clear`, com
 * regra própria de "corte afobado" que manda 16% para escanteio quando o
 * zagueiro está pressionado perto da própria meta. O relatório da RC1 mediu que
 * ela é **chamada zero vezes em partida real**. Este patch a coloca em uso.
 *
 * Nada de constante nova de calibração: usa `facet`, `duelProb` e as rotinas
 * físicas que o motor já usa em volta. Nenhuma chamada direta a `_setCorner` —
 * o escanteio passa a EMERGIR do corte, como no futebol.
 * ==========================================================================*/
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const BASE_SHA = '3b2fece8ac4a9d9cbd93d01959bc53f4bbc230a98dcb41e46650a52691b8ddb4'; // R18.21-RC2

function arg(name, def) {
  const hit = process.argv.slice(2).find(a => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : def;
}
const inFile = arg('in', 'rc1-fix.html');
const outFile = arg('out', 'rc2-cross.html');
const force = arg('force', '') === '1';

let src = fs.readFileSync(inFile, 'utf8');
const sha = crypto.createHash('sha256').update(fs.readFileSync(inFile)).digest('hex');
if (sha !== BASE_SHA && !force) {
  console.error('ABORTA: sha da base não bate.\n  esperado ' + BASE_SHA + '\n  lido     ' + sha);
  process.exit(1);
}

const applied = [];
function edit(id, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) { console.error('ABORTA [' + id + ']: âncora encontrada ' + n + 'x (esperado 1)'); process.exit(1); }
  src = src.replace(from, to);
  applied.push(id);
}

edit('r1822-cruzamento-disputado',
`    const atk=bestAir;
    const deliveryFail = clamp(.34-(crossSkill-55)/210-(setPiece?.08:0),.10,.43);
    if(!atk || chance(deliveryFail)){
      this._startTravel(o,{x:g.x,y:FW/2+R(-8,8)},'pass',()=>{if(chance(CAL.restarts.failedCrossCorner))this._setCorner(o.team);else this._goalKickOrRestart(1-o.team);},null,'launch');
      return;
    }`,
`    const atk=bestAir;
    const deliveryFail = clamp(.34-(crossSkill-55)/210-(setPiece?.08:0),.10,.43);
    if(!atk || chance(deliveryFail)){
      /* §R18.22 · a bola cruzada sem atacante é do goleiro ou do zagueiro.
         Antes: ninguém tocava e um chance(.76) escolhia entre escanteio e tiro
         de meta — 5,47 lances por partida resolvidos no sorteio. */
      this._startTravel(o,{x:g.x,y:FW/2+R(-8,8)},'pass',()=>{
        const bx=this.ball.x, by=this.ball.y, bz=finiteOr(this.ball.z,0);
        const gkD=this.teams[1-o.team].players.find(p=>p.isGK&&!p.red);
        /* 1 · o goleiro sai no que é dele: perto, alto e alcançável. */
        if(gkD){
          const dGk=D(gkD.x,gkD.y,bx,by), cv=this._physicalContactValid(gkD,3.0,bz);
          if(dGk<=5.2&&cv.ok&&chance(clamp(.26+facet(gkD,'gk')/100*.40,.26,.74))){
            this._recordVisualContact('gk_claim',gkD,bx,by,{z:bz,maxZ:cv.maxZ,surface:cv.surface,terminal:true,outgoingVelocity:{x:0,y:0,z:0}});
            this._emit('gk_claim',{gk:gkD,by:o,kind:'catch'});
            this._giveBall(gkD); return;
          }
        }
        /* 2 · senão, o zagueiro melhor colocado corta de cabeça. A rotina de
           corte já existe e traz consigo a regra do corte afobado, de onde o
           escanteio passa a nascer naturalmente. */
        const marker=defs.slice().sort((a,b)=>D(a.x,a.y,bx,by)-D(b.x,b.y,bx,by))[0];
        if(marker&&D(marker.x,marker.y,bx,by)<=7.0){
          const cvd=this._physicalContactValid(marker,2.2,bz);
          if(cvd.ok){
            this._recordVisualContact('header_clear',marker,bx,by,{z:bz,maxZ:cvd.maxZ,surface:cvd.surface});
            marker.rating+=.05;
            this._clearBall(marker); return;
          }
        }
        /* 3 · ninguém alcançou: a bola segue viva, como no futebol. */
        this._looseBall(bx,by);
      },null,'launch');
      return;
    }`);

/* `finiteOr` não existe no escopo do motor; declara junto do resto dos ajudantes
   de `_cross`, sem tocar em nada mais. */
edit('r1822-ajudante',
`  _cross(o) {
    const tm = this.teams[o.team];`,
`  _cross(o) {
    const finiteOr=(v,d)=>Number.isFinite(v)?v:d;
    const tm = this.teams[o.team];`);

edit('r1822-identidade',
`  root.CDS_BUILD_ID='R18.21-RC2'; root.CDS_VERSION='5.15.1-R18.21-RC2';`,
`  root.CDS_R1822_CRUZAMENTO=Object.freeze({
    version:'R18.22', label:'CRUZAMENTO DISPUTADO',
    note:'O ramo !atk de _cross resolvia 5,47 lances por partida (37,5% dos cruzamentos) num chance(.76) entre escanteio e tiro de meta, sem ninguem tocar a bola. Agora goleiro ou zagueiro disputam, e o escanteio emerge do corte via _clearBall — rotina que existia e era chamada zero vezes.'
  });
  root.CDS_BUILD_ID='R18.22'; root.CDS_VERSION='5.16.0-R18.22';`);

edit('r1822-identidade-title',
`  if(root.document)root.document.title='Copa dos Sonhos — R18.21-RC2';`,
`  if(root.document)root.document.title='Copa dos Sonhos — R18.22';`);

edit('r1822-title-head',
`<title>Copa dos Sonhos — R18.21-RC2</title>`,
`<title>Copa dos Sonhos — R18.22</title>`);

fs.writeFileSync(outFile, src, 'utf8');
console.log('patches aplicados:', applied.join(', '));
console.log('saída:', path.basename(outFile), fs.statSync(outFile).size, 'bytes');
console.log('sha256:', crypto.createHash('sha256').update(fs.readFileSync(outFile)).digest('hex'));
