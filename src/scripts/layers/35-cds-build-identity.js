/* D33 · IDENTIDADE DE BUILD — treze arquivos fundidos em um.
   ===========================================================================
   Eram treze blocos <script> separados no bundle, cada um com entrada propria
   no manifesto e no verify.py, e nenhum deles sobrescrevia metodo nenhum: so
   publicavam `CDS_BUILD_ID`, `CDS_VERSION`, `document.title` e um objeto
   congelado de metadados por release.

   Verificado antes de fundir (o criterio de aceite do D33):
     - NENHUM dos onze objetos `CDS_R*_BUILD` / `CDS_OS8*` e lido em lugar
       algum de src/, tools/ ou tests/;
     - `CDS_BUILD_ID` so e lido por tools/fisica/tela/pinga.js, DEPOIS de todas
       as camadas — entao so o valor final importa, e ele continua vindo das
       camadas 86/88/89/90, que rodam depois desta.

   O conteudo esta preservado LINHA POR LINHA e na ordem original: estes
   objetos sao a memoria institucional do projeto (a nota da R18.19 removida
   por ablacao, o vazamento de raio do goleiro na R18.40A, o motivo de
   `_looseBall` ter sido evitado na R18.31). Fundir nao e apagar.

   Ordem original: 35, 37, 41, 42, 44, 46, 48, 50, 52, 59, 72, 73, 83. */

/* ─── era 35-r18155-build-identity.js ─────────────────────── */

(function(){
  try{
    window.CDS_BUILD_ID='R18.15.5';
    window.CDS_VERSION='5.9.6-R18.15.5-REINICIOS-CORRIGIDOS';
    document.title='Copa dos Sonhos — R18.15.5';
    window.CDS_R18155=Object.freeze({selectionToggle:true,preMatchPositionSwap:true,playerAttributesOwnSquad:true,playerAttributesOpponent:true,draftCampaignSeed:true,draftNationCooldown:4,cupDrawSeed:true,randomEraMix:{uniform:.70,strengthBiased:.30},questionMarkDraw:true,draftPitchFullyVisible:true,restartWalkFix:true,directShotMissGoalKick:true,untouchedPostOutGoalKick:true,staleCrossWindowCleared:true,engineChange:'restart-semantics-only'});
  }catch(_){ }
})();

/* ─── era 37-cds-r18161-build-identity.js ─────────────────────── */

(function(){try{window.CDS_BUILD_ID='R18.16.1';window.CDS_VERSION='5.12.0-R18.16.1-EXECUCAO-REAL-NA-AREA';document.title='Copa dos Sonhos — R18.16.1';window.CDS_R18161_BUILD=Object.freeze({baseline:'R18.16-PLANEJAMENTO-AREA',flagsBaseline:'R18.15.6-BANDEIRAS-REAIS',restartLaw:'R18.15.5',boxMovementPlanning:true,physicalRuns:true,eventDriven:true,frozenPlan:true,continuousAttributes:true,roles:6,noTeleport:true,noGlobalSpeedBonus:true,noXgChange:true,maxTargetShiftMeters:.72});}catch(_){}})();

/* ─── era 41-cds-r181732-mobile-start-meta.js ─────────────────────── */

window.CDS_R181732_MOBILE_START = Object.freeze({version:'R18.17.3.2',directCriticalBinding:true,pointerUpFallback:true,doubleFramePaint:true,idempotent:true});

/* ─── era 42-inline.js ─────────────────────── */
try{document.title='Copa dos Sonhos — R18.17.3.2';window.CDS_BUILD_ID='R18.17.3.2';}catch(_){}

/* ─── era 44-cds-r1818-build-meta.js ─────────────────────── */
window.CDS_R1818_BUILD=Object.freeze({version:'R18.18',baseline:'R18.17.3.2',label:'PROGRESSAO OFENSIVA E CRIACAO DE CHANCES'});try{document.title='Copa dos Sonhos — R18.18';window.CDS_BUILD_ID='R18.18';}catch(_){}

/* ─── era 46-cds-r18181-build-meta.js ─────────────────────── */
window.CDS_R18181_BUILD=Object.freeze({version:'R18.18.1',baseline:'R18.18',label:'SEGUNDA FASE E BOLA FORA NATURAL'});

/* ─── era 48-cds-r18182-build-meta.js ─────────────────────── */
window.CDS_R18182_BUILD=Object.freeze({version:'R18.18.2',baseline:'R18.18.1',label:'DISPUTAS E SAIDAS NATURAIS'});

/* ─── era 50-cds-r18183-build-meta.js ─────────────────────── */
window.CDS_R18183_BUILD=Object.freeze({version:'R18.18.3',baseline:'R18.18.2',label:'BLOQUEIOS, DEFESAS E ECOLOGIA DE ESCANTEIOS'});try{document.title='Copa dos Sonhos — R18.18.3';window.CDS_BUILD_ID='R18.18.3';}catch(_){}

/* ─── era 52-cds-r1820-build-meta.js ─────────────────────── */

window.CDS_R1820_BUILD=Object.freeze({version:'R18.20',baseline:'R18.18.3',label:'TÁTICA AUTORITATIVA + INTELIGÊNCIA DE CHANCE',includes:Object.freeze(['R18.18.3.1','R18.19','R18.19.1','R18.19.2','R18.20'])});

/* ─── era 59-cds-r1821rc1-build-meta.js ─────────────────────── */

(function(root){'use strict';
try{
  root.CDS_R1821RC1_BUILD=Object.freeze({
    version:'R18.21-RC1', baseline:'R18.20', label:'DEFESA, PRESSAO E ECOLOGIA',
    removed:Object.freeze(['cds-r1819-tactical-authority']),
    layers:Object.freeze(["cds-r1821-throwin-law","cds-r1821-post-recovery-decision","cds-r1821-shot-plausibility","cds-r1821-press-anticipation","cds-r1821-respread-top","cds-r1821-tempo-e-pausas"]),
    note:'R18.19 removida por ablacao medida (n=49): -20% chutes, -26% tentativas de desarme, -36% faltas, e reprovacao dos 3 gates de identidade de estilo.'
  });
  root.CDS_R1825_ENTREGA=Object.freeze({
    version:'R18.25', label:'CRUZAMENTO ENTREGUE NA AREA', parte:'P3',
    note:'O cruzamento sem alvo era entregue em cima da linha de gol (x=g.x), 5,6 m atras do goleiro e de toda a defesa — por isso ninguem disputava. Medido: goleiro a 5,6 m de profundidade e bola a 0,0; lateralmente separados por so 2,7 m. Agora cai entre a pequena area e a marca do penalti.'
  });
  root.CDS_R1831_BOLALIVRE=Object.freeze({
    version:'R18.31', label:'ENTREGA SEM DISPUTA VIRA BOLA LIVRE', vmin:7,
    note:'O ramo !atk de _cross resolvia 5,47 lances por partida num chance(.76) entre escanteio e tiro de meta, sem ninguem tocar a bola. Agora a bola SEGUE: quem alcanca (1,7 m, regra do _looseRoll) fica com ela, e quem nao alcanca ve a bola sair — com o reinicio derivado por _ballOut do ultimo toque real. _looseBall foi evitado de proposito: ele entrega a bola ao mais proximo sem limite de distancia e foi o que inflou o xG em 30% na R18.22.'
  });
  root.CDS_R1835_FALTA=Object.freeze({version:'R18.35',label:'FALTA COMUM E COBRADA',pausa:1,teto:3.4,
    note:'94,7% das faltas caiam num ramo que devolvia a bola ao companheiro mais proximo — que e o proprio jogador que sofreu a falta (mediana 0,0 m). A bola nunca era colocada no local. Agora usa armTaker, a mesma maquina do lateral e do escanteio.'});
  root.CDS_R1840A=Object.freeze({version:'R18.40A',label:'O TETO DE VELOCIDADE E O GOLEIRO QUE VAI AO PONTO',
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
  root.CDS_BUILD_ID='R18.40A'; root.CDS_VERSION='5.30.0-R18.40A';
  root.CDS_R1821RC2_BUILD=Object.freeze({
    version:'R18.21-RC2', baseline:'R18.21-RC1', label:'REPLAY DE GOL',
    patches:Object.freeze(['d1-normaliza-quadros','d2-rebobina','d3-rede']),
    note:'Reparo do replay de gol. O clipe da timeline fisica vinha em METRO e a interface desenha em 0..1: os 22 jogadores iam ~1000x fora da tela e ctx.ellipse estourava a cada frame, deixando so o gramado. Medido no navegador: base 2330 excecoes de desenho em 19 gols e 0 voltas do clipe; corrigida 0 excecoes, 100% de cobertura e 99% da janela animada.'
  });
  if(root.document)root.document.title='Copa dos Sonhos — R18.40A';
}catch(_){}
})(typeof window!=='undefined'?window:globalThis);

/* ─── era 72-cds-os81-low-cross-contact-meta.js ─────────────────────── */

(function(root){root.CDS_OS81_LOW_CROSS_CONTACT=Object.freeze({version:'R18.84',baseline:'R18.83',radius:1.7,rngAdded:false,teleport:false});root.CDS_BUILD_ID='R18.84';root.CDS_VERSION='5.73.0-R18.84';try{document.title='Copa dos Sonhos — R18.84';}catch(_){}})(typeof window!=='undefined'?window:globalThis);

/* ─── era 73-cds-os82-intercept-control-meta.js ─────────────────────── */

(function(root){root.CDS_OS82_INTERCEPT_CONTROL=Object.freeze({version:'R18.85',baseline:'R18.84',controlRadius:1.00,minimumPreparation:2/30,rngAdded:false,teleport:false});root.CDS_BUILD_ID='R18.85';root.CDS_VERSION='5.74.0-R18.85';try{document.title='Copa dos Sonhos — R18.85';}catch(_){}})(typeof window!=='undefined'?window:globalThis);

/* ─── era 83-cds-r1886-build-meta.js ─────────────────────── */

(function(root){'use strict';
root.CDS_R1886=Object.freeze({version:'R18.86',baseline:'R18.85',features:Object.freeze([
  'OS-74_CORNER_SIDE','OS-75_NO_LEGEND_RING','OS-76_CLASSIC_HIDES_GOLD',
  'OS-77_COMMON_FOUL_RESTART','OS-78_DEFAULT_2X','OS-83_RESTART_WATCHDOG'
])});
root.CDS_BUILD_ID='R18.86';root.CDS_VERSION='5.75.0-R18.86';
try{document.title='Copa dos Sonhos — R18.86';}catch(_){}
})(typeof window!=='undefined'?window:globalThis);
