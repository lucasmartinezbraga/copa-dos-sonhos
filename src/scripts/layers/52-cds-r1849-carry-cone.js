
/* R18.49 · O cone da conducao. */
(function(root){try{
  root.CDS_R1849_CONE=Object.freeze({version:'5.36.0-R18.49',
    label:'CONE DA CONDUCAO',
    raioBase:2.6, abertura:0.30, comprimento:6.5,
    maxCone:0, pericia:999,
    note:'O teste que liberava conduzir chamava _inForwardCone(o,d,g,4.5|5.5,9), que apesar do nome e um RETANGULO: fx<9 e |dy|<4,5-5,5. Um defensor a 8 m adiante e 4 m ao lado bloqueava a conducao sem estar no caminho. E cone===0 era portao absoluto: um defensor proibia conduzir para qualquer jogador. Agora (a) a meia-largura cresce com a distancia (raioBase + fx*abertura) e o comprimento cai para o valor acima, e (b) cone<=maxCone e permitido quando (drible+aceleracao)/2 >= pericia. _inForwardCone segue intacto para os outros chamadores; _carry, decisionInterval e a ordem do dispatch nao foram tocados.',
    predicadoCompartilhadoTocado:false, carryTocado:false, decisionIntervalTocado:false,
    rngUsed:false, teleport:false});
  root.CDS_R1850=Object.freeze({version:'R18.50',label:'PRESERVAR ENERGIA SAI DO CODIGO MORTO',gatilho:76,
    entrou:['OS-09 save_energy: gatilho de estamina 62 -> 76. INT-05 0,00% -> 6,67% das decisoes, balance 51,12%'],
    gates:'ECO-01 2,500 · ECO-02 2,435 · ECO-03 14,813 · ECO-04 4,813 · COE-01 1,037 · CAU-03 2,344 — seis em 3/3 bases',
    naoEntrou:['OS-05 fonte de escanteio: mecanismo localizado (o corte de cabeca no ramo aereo entregava a bola por _turnover em vez de deixa-la viajar), tentativa medida e REJEITADA — quebrava a entrega do escanteio, evento corner ia a zero'],
    note:'O gatilho 73 que a auditoria registrava vinha da era R18.40 e nao vale nesta build: medido aqui entrega 2,41%, abaixo do piso de INT-05. As rodadas de bloco mudaram a dinamica de estamina. COE-01 melhorou de 1,062 para 1,037, respondendo ao aviso de drift do relatorio da R18.49.'});
  root.CDS_BUILD_ID='R18.50'; root.CDS_VERSION='5.37.0-R18.50';
  if(root.document) root.document.title='Copa dos Sonhos — R18.49';
}catch(_){}})(typeof window!=='undefined'?window:globalThis);
