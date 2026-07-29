/* ============================================================================
 * R18.21 · REPARO DO REPLAY DE GOL — três patches cirúrgicos
 * ----------------------------------------------------------------------------
 * O replay por timeline física NUNCA apareceu. Medido no navegador:
 *
 *  D1 (fatal) ESPAÇO DE COORDENADAS. `getState()` entrega posição NORMALIZADA
 *     (divide por FL/FW) e toda a interface — `cx`/`cy` — trabalha em 0..1.
 *     `captureTimelineFrame` grava METROS crus. O replay então desenhava os 22
 *     jogadores a ~1000× fora da tela; o primeiro cuja escala de perspectiva
 *     ficava negativa estourava em `ctx.ellipse` (raio negativo), o `catch` do
 *     laço engolia, e sobrava o gramado vazio — sem bola, sem selo de REPLAY.
 *     Acontecia em 100% dos gols de jogo aberto, uma vez por frame.
 *
 *  D2 O CLIPE NÃO REBOBINA. `advanceTimelineReplay` só avança o índice; quando
 *     `elapsed` volta a zero o índice fica onde estava. A guarda de reinício
 *     exige `i >= frames.length-1`, inalcançável porque `elapsed` é zerado no
 *     instante em que passa de `duration` — que é justamente o tempo do último
 *     quadro. Medido: animava ~770 ms e congelava os ~1430 ms restantes (65%
 *     da janela de replay era imagem parada).
 *
 *  D3 SEM REDE. Havendo timeline física, o replay de buffer era desligado ANTES
 *     de se saber se o de timeline instalaria. Falhando a instalação, não
 *     sobrava replay nenhum.
 *
 * Nada aqui toca o motor: são três edições na camada de apresentação.
 * ==========================================================================*/
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const BASE_SHA = 'ef461809b98e5751d4d3f8d9d82aaaefae1fd49819274a95f62f18bff16a71e7';

function arg(name, def) {
  const hit = process.argv.slice(2).find(a => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : def;
}

const inFile = arg('in', 'rc1.html');
const outFile = arg('out', 'rc1-fix.html');
const skipShaCheck = arg('force', '') === '1';

let src = fs.readFileSync(inFile, 'utf8');
const sha = crypto.createHash('sha256').update(fs.readFileSync(inFile)).digest('hex');
if (sha !== BASE_SHA && !skipShaCheck) {
  console.error('ABORTA: sha da base não bate.\n  esperado ' + BASE_SHA + '\n  lido     ' + sha);
  process.exit(1);
}

const applied = [];
function edit(id, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) { console.error('ABORTA [' + id + ']: âncora encontrada ' + n + 'x (esperado 1)'); process.exit(1); }
  src = src.replace(from, to);
  applied.push({ id, delta: to.length - from.length });
}

/* ── D1 · espaço de coordenadas ─────────────────────────────────────────── */
edit('d1-normaliza-quadros',
`function timelineReplayFrames(tl){
  const vf=tl&&tl.visualFrames||[];
  return vf.map(f=>({
    time:Number.isFinite(f.offset)?f.offset:Math.max(0,(f.time||0)-(tl.startTime||0)),
    ball:{x:f.ball.x,y:f.ball.y,z:f.ball.z||0},
    p:(f.players||[]).map(pl=>({x:pl.x,y:pl.y,c:pl.color,num:pl.num,gk:!!pl.gk,ball:!!pl.hasBall,n:pl.name||'',id:pl.id,team:pl.team}))
  }));
}`,
`function timelineReplayFrames(tl){
  /* §fix REPLAY-D1: a timeline física guarda METRO (captureTimelineFrame lê
     p.x/p.y crus do motor); a interface inteira desenha em 0..1, porque é isso
     que getState() entrega (x:p.x/FL, y:p.y/FW). Sem esta conversão o replay
     mandava todo mundo para ~1000× fora da tela e ctx.ellipse estourava com
     raio negativo a cada frame, deixando só o gramado. z fica em metro nos
     dois espaços — igual a getState(). */
  const vf=tl&&tl.visualFrames||[];
  const _FL=(typeof window!=='undefined'&&window.FL)||105, _FW=(typeof window!=='undefined'&&window.FW)||68;
  return vf.map(f=>({
    time:Number.isFinite(f.offset)?f.offset:Math.max(0,(f.time||0)-(tl.startTime||0)),
    ball:{x:f.ball.x/_FL,y:f.ball.y/_FW,z:f.ball.z||0},
    p:(f.players||[]).map(pl=>({x:pl.x/_FL,y:pl.y/_FW,c:pl.color,num:pl.num,gk:!!pl.gk,ball:!!pl.hasBall,n:pl.name||'',id:pl.id,team:pl.team}))
  }));
}`);

/* ── D2 · rebobinar o clipe ────────────────────────────────────────────── */
edit('d2-rebobina',
`function advanceTimelineReplay(dt){
  if(!replay||replay.source!=='physics_timeline'||!replay.frames.length)return;
  replay.elapsed=(replay.elapsed||0)+dt*(replay.playbackRate||.72);
  if(replay.elapsed>replay.duration)replay.elapsed=0;
  let i=replay.idx||0;
  while(i+1<replay.frames.length&&replay.frames[i+1].time<=replay.elapsed)i++;
  if(i>=replay.frames.length-1&&replay.elapsed<(replay.frames[i].time||0))i=0;
  replay.idx=i;
}`,
`function advanceTimelineReplay(dt){
  /* §fix REPLAY-D2: o índice era procurado A PARTIR do índice corrente e só
     andava para a frente. Ao dar a volta (elapsed zerado) ele não voltava: a
     guarda de reinício pedia i>=frames.length-1, inalcançável porque elapsed é
     zerado assim que passa de duration — que é o tempo do ÚLTIMO quadro. O
     clipe congelava no penúltimo quadro pelo resto da janela. Agora a busca
     parte sempre de zero (são no máximo ~26 quadros) e a volta guarda o resto,
     em vez de descartá-lo. */
  if(!replay||replay.source!=='physics_timeline'||!replay.frames.length)return;
  const n=replay.frames.length,dur=Math.max(1e-3,replay.duration||0);
  let e=(replay.elapsed||0)+dt*(replay.playbackRate||.72);
  if(e>=dur)e-=dur*Math.floor(e/dur);
  if(!(e>=0))e=0;
  replay.elapsed=e;
  let i=0;
  while(i+1<n&&replay.frames[i+1].time<=e)i++;
  replay.idx=i;
  replay.loops=(replay.loops||0)+(i<(replay._lastIdx||0)?1:0);
  replay._lastIdx=i;
}`);

/* ── D3 · rede de segurança ────────────────────────────────────────────── */
edit('d3-rede',
`    const hasPhysicalTimeline=!!__phys;
    const hasReplay = hasPhysicalTimeline ? false : (setPieceGoal ? false : startReplay());
    if (hasPhysicalTimeline || setPieceGoal) replay = null;
    if(!hasPhysicalTimeline&&hasReplay)timelinePresentation.metrics.legacyGoalReplays++;`,
`    const hasPhysicalTimeline=!!__phys;
    /* §fix REPLAY-D3: o replay de buffer era desligado ANTES de se saber se o
       de timeline instalaria (a ponte só chama startTimelineReplay quando a
       timeline é finalizada e aprovada). Falhando ali, não sobrava replay
       nenhum. Agora o buffer é armado como rede; quando a timeline finaliza,
       startTimelineReplay o SUBSTITUI pela versão física — que é a fonte
       autoritativa. A cena de bola parada segue sendo o próprio replay. */
    const hasReplay = setPieceGoal ? false : startReplay();
    if (setPieceGoal) replay = null;
    if(!hasPhysicalTimeline&&hasReplay)timelinePresentation.metrics.legacyGoalReplays++;`);

/* ── identidade ────────────────────────────────────────────────────────── */
edit('id-replay-fix',
`window.CDS_TIMELINE_PRESENTATION={version:'5.8.2',`,
`try{window.CDS_R1821_REPLAY_FIX=Object.freeze({version:'1.0',patches:['d1-normaliza-quadros','d2-rebobina','d3-rede']});}catch(_){}
window.CDS_TIMELINE_PRESENTATION={version:'5.8.2',`);

/* A identidade em runtime tem de contar a verdade — a <title> estática do
   <head> já ficou parada em R18.17 uma vez e custou tempo. */
edit('id-runtime',
`  root.CDS_BUILD_ID='R18.21-RC1'; root.CDS_VERSION='5.15.0-R18.21-RC1';
  if(root.document)root.document.title='Copa dos Sonhos — R18.21-RC1';`,
`  root.CDS_BUILD_ID='R18.21-RC2'; root.CDS_VERSION='5.15.1-R18.21-RC2';
  root.CDS_R1821RC2_BUILD=Object.freeze({
    version:'R18.21-RC2', baseline:'R18.21-RC1', label:'REPLAY DE GOL',
    patches:Object.freeze(['d1-normaliza-quadros','d2-rebobina','d3-rede']),
    note:'Reparo do replay de gol. O clipe da timeline fisica vinha em METRO e a interface desenha em 0..1: os 22 jogadores iam ~1000x fora da tela e ctx.ellipse estourava a cada frame, deixando so o gramado. Medido no navegador: base 2330 excecoes de desenho em 19 gols e 0 voltas do clipe; corrigida 0 excecoes, 100% de cobertura e 99% da janela animada.'
  });
  if(root.document)root.document.title='Copa dos Sonhos — R18.21-RC2';`);

edit('id-title-head',
`<title>Copa dos Sonhos — R18.17</title>`,
`<title>Copa dos Sonhos — R18.21-RC2</title>`);

fs.writeFileSync(outFile, src, 'utf8');
const outSha = crypto.createHash('sha256').update(fs.readFileSync(outFile)).digest('hex');
console.log('patches aplicados:', applied.map(a => a.id).join(', '));
console.log('saída:', path.basename(outFile), fs.statSync(outFile).size, 'bytes');
console.log('sha256:', outSha);
