
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
