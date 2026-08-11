#!/usr/bin/env python3
"""Gera e VALIDA reports/defeitos.json — o indice legivel por maquina do catalogo.

Por que este arquivo existe
---------------------------
`reports/INVESTIGACAO-COMPLETA-2026-08.md` tem ~31 mil palavras. Uma IA que va
trabalhar num defeito nao precisa de 107 paginas: precisa do defeito, de onde
ele mora, e do comando que diz se ela acertou.

E precisa de um endereco que NAO QUEBRE. Numero de linha envelhece na primeira
edicao do motor; por isso cada defeito carrega uma ANCORA — um trecho literal do
codigo que aparece exatamente uma vez no arquivo. Este script FALHA se alguma
ancora deixar de ser unica, o que transforma o envelhecimento do documento em
erro de build em vez de bug silencioso.

Uso:
  python3 tools/defeitos.py            # valida e regrava reports/defeitos.json
  python3 tools/defeitos.py --check    # so valida (para CI); nao escreve
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
MOTOR = "src/scripts/40-match-engine-and-manager-ai.js"
CORE = "src/scripts/20-core.js"
RUNTIME = "src/scripts/70-game-runtime-and-rendering.js"
L = "src/scripts/layers/"

# ── o catalogo ────────────────────────────────────────────────────────────────
# ancora: trecho literal que tem de aparecer EXATAMENTE UMA VEZ no arquivo.
# linha:  onde estava quando o documento foi escrito (referencia, pode envelhecer).
DEFEITOS = [
 dict(id="D01", sev="estrutural", fase="F1", estado="aberto",
      titulo="Duas fisicas de bola convivem (g=20 no core, g=9,81 na camada 88)",
      locais=[dict(arquivo=MOTOR, linha=2396, ancora="b.z += b.vz * dt; b.vz -= 20 * dt;"),
              dict(arquivo=MOTOR, linha=2465, ancora="_deflectTo(x, y, spd) {")],
      evidencia="150,40 chamadas por partida caem no integrador de g=20 (57,05 _deflectTo + 93,35 _looseBall)",
      dono="core e o dono da fisica do desvio; 45/47/49 so reescrevem o ALVO",
      intercepta=["07","17","45","47","49"],
      criterio=["chamadas com g=20 -> 0","corners +-0,50","goals +-0,20","throwIns nao pode cair"],
      depende=[], risco="medio: b._timeout deixa de valer; vigie quiques e porCimaDoTravessao"),

 dict(id="D02", sev="futebol", fase="F1", estado="aberto",
      titulo="_contestLoose entrega a bola sem teto de distancia",
      locais=[dict(arquivo=MOTOR, linha=2489, ancora="const zone = cands.filter")],
      evidencia="21,3 entregas por partida com o mais proximo a mais de 3 m; 22,2 bolas pousando fora e resgatadas a 6,8 m",
      dono="core alcancado; 08 e 45 sao VIVAS",
      intercepta=["08","45"],
      criterio=["entregas com folga >3 m: 21,3 -> <=3","passes >=370","throwIns sobe"],
      depende=["D01"], risco="ALTO: a bola pode morrer no meio do campo. Rodar pinga.js e narrar 5 partidas."),

 dict(id="D03", sev="higiene", fase="F1", estado="aberto",
      titulo="~190 linhas mortas guardadas por return antecipado dentro do motor",
      locais=[dict(arquivo=MOTOR, linha=369, ancora="_requestSetPiece(kind, data, execute) {"),
              dict(arquivo=MOTOR, linha=2019, ancora="this._os200ResolverChute(o,{g,tm,gk,atk,gkF,pGoal,")],
      evidencia="pilha.js: contagem zero nos ramos antigos em 14 partidas; o guarda nunca e falso num build de tools/build.py",
      dono="nao alcancavel por definicao",
      intercepta=[],
      criterio=["as 14 metricas IDENTICAS ao digito (nao '+-2 SE')"],
      depende=[], risco="o mais baixo do catalogo"),

 dict(id="D04", sev="higiene", fase="F1", estado="aberto",
      titulo="_looseBall do core esta morto e nao parece",
      locais=[dict(arquivo=MOTOR, linha=2483, ancora="// jogador mais próximo assume após breve disputa"),
              dict(arquivo=L+"08-cds-p04-physical-reception-584-r6.js", linha=767, ancora="P._looseBall = function p04LooseBall(x, y) {")],
      evidencia="tentativa A4 editou este corpo: nenhuma das 14 metricas moveu 0,15 SE",
      dono="camada 08 (p04) intercepta e NAO chama o core quando a bola esta viva",
      intercepta=["08","17","45","47","49"],
      criterio=["metricas identicas (a mudanca e comentario)"],
      depende=[], risco="nenhum"),

 dict(id="D05", sev="futebol", fase="—", estado="feito",
      titulo="Passe rasteiro decolava (14 cm de salto, 2 quiques)",
      locais=[dict(arquivo=L+"88-os200-balistica-real.js", linha=347, ancora="const ELEV_RASTEIRA = 0;")],
      evidencia="54 quiques por minuto de jogo (tela/pinga.js); nenhuma das 14 metricas via",
      dono="camada 88, por regime", intercepta=["88"],
      criterio=["feito"], depende=[], risco="nao consertar no core: os 0,12 sao a origem do CHUTE"),

 dict(id="D06", sev="futebol", fase="—", estado="feito",
      titulo="Goleiro mergulhava no primeiro instante alcancavel (folga ~0 por construcao)",
      locais=[dict(arquivo=L+"88-os200-balistica-real.js", linha=None, ancora="folga > achado.folga")],
      evidencia="golPorChuteNoAlvo 0,428 -> 0,378; folga media 0,24 -> 1,31 m; design 11/13 -> 12/13",
      dono="camada 88", intercepta=["88"],
      criterio=["feito"], depende=[], risco="XG_ESCALA teve de ser re-derivada (0,651)"),

 dict(id="D07", sev="futebol", fase="—", estado="feito",
      titulo="_bestPass tinha 25+ termos e nenhum era a linha de impedimento",
      locais=[dict(arquivo=MOTOR, linha=1379, ancora="const linhaImped = this._offsideLine(o.team);")],
      evidencia="impedimentos 10,03 -> 5,11 por partida",
      dono="core", intercepta=["24"],
      criterio=["feito"], depende=[], risco="removeu um freio: +0,42 gol, que expos D06"),

 dict(id="D08", sev="futebol", fase="F2", estado="aberto",
      titulo="Laterais pela metade — a direcao do desvio e sempre para dentro",
      locais=[dict(arquivo=MOTOR, linha=1240, ancora="else this._deflectTo(clamp(this.ball.x-hdDir*R(2,6),2,FL-2)"),
              dict(arquivo=MOTOR, linha=2787, ancora="this._deflectTo(clamp(this.ball.x-tmA.attackDir*R(1,5),2,FL-2)")],
      evidencia="85,8% dos alvos a mais de 8 m da lateral; 16,8 alvos/partida mirados para fora ~ 15,9 laterais medidos",
      dono="pontos de chamada no motor, com clamp(...,2,FL-2)",
      intercepta=["45","47","49"],
      criterio=["throwIns 15,91 -> 30-45","corners >=10,68","passes >=379,7","goals +-0,20","futebol real >=16/21"],
      depende=["D01","D02","D12"],
      risco="ALTO. Tetos: throwIns<=48. Camada nova precisa ficar ABAIXO de 45/47/49 no manifesto."),

 dict(id="D09", sev="higiene", fase="F2", estado="aberto",
      titulo="O portao naturalTarget da camada 45 quase nunca dispara",
      locais=[dict(arquivo=L+"45-cds-r18181-second-phase-natural-out.js", linha=135, ancora="function naturalTarget(sim,x,y,kind){")],
      evidencia="23 de 6.016 chamadas (0,4%) chegam com alvo dentro da janela de 2,05 m que o portao exige",
      dono="camada 45 esta CORRETA; falta combustivel",
      intercepta=[],
      criterio=["naturalOutDeflections sobe quando D08 alimentar"],
      depende=["D08"], risco="nenhum: nao ha mudanca, e verificacao"),

 dict(id="D10", sev="futebol", fase="F4", estado="parcial",
      titulo="O orcamento de posse mora em duas linhas que nao se conhecem",
      locais=[dict(arquivo=MOTOR, linha=2548, ancora="else m.settle=lerp(CAL.possession.firstTouchMax"),
              dict(arquivo=MOTOR, linha=2582, ancora="this.decideT=0.28;")],
      evidencia="settle (0,10-0,34) + decideT (0,28) = 0,38-0,62 s; mediana medida 0,43 s antes da OS-206",
      dono="camada 90 compensa por cima; as duas linhas continuam la",
      intercepta=["17","90"],
      criterio=["orcamento unico em ENGINE_CALIBRATION.possession","mediana de posse 0,9-1,3 s"],
      depende=["D26"], risco="medio"),

 dict(id="D11", sev="estrutural", fase="F3", estado="aberto",
      titulo="Sorteio censurado 1: r12 sorteia o chute contextual, r183 existe para veta-lo",
      locais=[dict(arquivo=L+"16-cds-r12-transactional-core-r123.js", linha=153, ancora="tm.__r122LastContextShot=now;"),
              dict(arquivo=L+"20-cds-r183-natural-football.js", linha=63, ancora="dg.smartShotVetoes=(dg.smartShotVetoes||0)+1;")],
      evidencia="o comentario da camada 20 e a prova literal: 'Marcar o instante atual veta unicamente essa roleta'",
      dono="_decide tem 8 camadas; 51 roda por fora de todas",
      intercepta=["16","17","18","20","27","43","45","51"],
      criterio=["14 metricas dentro de 2 SE SEM pareamento de semente","-250 linhas","zero variaveis de contrato com nome de release"],
      depende=[], risco="medio: remover chance() desalinha o RNG; compare distribuicoes, nao partidas"),

 dict(id="D12", sev="estrutural", fase="F2", estado="aberto",
      titulo="Sorteio censurado 2: r13 manda a bola para fora a 64% e o core recolhe",
      locais=[dict(arquivo=L+"17-cds-r13-football-observer-cadence.js", linha=203, ancora="if(edge<5.5&&hit13(this,.64))ty=y<FW13/2?-.7:FW13+.7;"),
              dict(arquivo=MOTOR, linha=2483, ancora="// jogador mais próximo assume após breve disputa")],
      evidencia="22,2 bolas por partida pousando fora e entregues a alguem a 6,8 m",
      dono="ATENCAO: a camada 08 intercepta _looseBall e nao chama o core. O conserto tem de ser feito LA TAMBEM.",
      intercepta=["08","17","45","47","49"],
      criterio=["throwIns >=17,4 (2 SE) sem D08"],
      depende=["D02"], risco="medio: mais reinicios = mais bola parada; vigie passes"),

 dict(id="D13", sev="futebol", fase="F3", estado="aberto",
      titulo="Sorteio censurado 3: erro de chute sorteado ate 6,5 m e comprimido pela camada 55",
      locais=[dict(arquivo=L+"55-cds-r1821-shot-plausibility.js", linha=72, ancora="const excessoMax = 6.5 - POST;")],
      evidencia="o comentario diz 'pior caso observado no motor' — a camada foi calibrada contra o motor, nao contra futebol",
      dono="camada 88 e TERMINAL para a mira; territorio seguro",
      intercepta=["88"],
      criterio=["onTarget >=7,72","acerto ao alvo 0,34-0,40","goals +-0,20","-111 linhas"],
      depende=["D01"], risco="ALTO para onTargetRate, que ja esta em 0,326. Varrer sigmaGraus com calibrar.py."),

 dict(id="D14", sev="estrutural", fase="F4", estado="aberto",
      titulo="Sete contencoes em step consertam bugs que nunca foram procurados",
      locais=[dict(arquivo=L+"84-cds-r1899-antiteleporte.js", linha=43, ancora="const P = M.prototype; P.__R1899__ = true;"),
              dict(arquivo=L+"75-cds-os83-restart-watchdog.js", linha=15, ancora="P.step=function(dt){")],
      evidencia="step tem 19 sobrescritas; 7 sao corretivas; 853 linhas no total",
      dono="cada camada",
      intercepta=["12","16","33","74","75","84","87"],
      criterio=["contador = 0 em 300 partidas -> apagar","metricas identicas ao digito apos cada remocao","<=2 contencoes ao final"],
      depende=[], risco="medio, controlado pela ordem: assercao (segura) antes de remocao"),

 dict(id="D15", sev="higiene", fase="F4", estado="aberto",
      titulo="255 linhas de antiteleporte contendo um bug nunca diagnosticado",
      locais=[dict(arquivo=L+"84-cds-r1899-antiteleporte.js", linha=43, ancora="const P = M.prototype; P.__R1899__ = true;")],
      evidencia="2,1% de todo o codigo de camadas para conter um bug de movimentacao",
      dono="camada 84",
      intercepta=["84"],
      criterio=["salto.js correlaciona os saltos com quadros de escrita dupla de intencao"],
      depende=["D14"], risco="baixo enquanto for so diagnostico"),

 dict(id="D16", sev="estrutural", fase="F5", estado="aberto",
      titulo="Quatro camadas falsificam _breaking/_markRef porque falta parametro de esforco",
      locais=[dict(arquivo=L+"71-cds-os51-beaten-defender.js", linha=23, ancora="var oldInt=P._integrate;"),
              dict(arquivo=L+"23-cds-r185-bloco-defensivo.js", linha=51, ancora="P._integrate=function(p,tx,ty,dt,freeze){")],
      evidencia="_breaking e lido em _cross para montar lowPool — a elegibilidade para receber cruzamento depende de um campo que outras camadas mentem",
      dono="ATENCAO: a camada 16 e TERMINAL para _integrate. O parametro tem de ser adicionado LA, nao no core.",
      intercepta=["16","17","23","24","71"],
      criterio=["comprimento do bloco com bola +-1,5 m","largura +-2 m","tackles +-1,07","leituras falsas de _breaking: 0"],
      depende=["D14"], risco="medio-alto: mexe em movimentacao. Rodar forma.js antes e depois."),

 dict(id="D17", sev="higiene", fase="F5", estado="aberto",
      titulo="Promover para o core os metodos cuja camada e TERMINAL",
      locais=[dict(arquivo=MOTOR, linha=3193, ancora="this._integrate(p, tx, ty, dt, freeze);"),
              dict(arquivo=L+"07-cds-physics-timeline-581.js", linha=None, ancora="P._planPhysicalSegment")],
      evidencia=("_integrate e _defendTarget EXISTEM no core e estao mortos (camadas 16 e 17 sao TERMINAIS). "
                 "CORRECAO v2: _planPhysicalSegment, _trajectoryPoint e _physicalTargetZ NUNCA existiram no core — "
                 "nascem na camada 07 e sao substituidos pela 88. O codigo morto ali e da camada 07, nao do motor."),
      dono="camada 16 (_integrate), camada 17 (_defendTarget), camada 07 (os tres de fisica)",
      intercepta=["07","08","16","17","88"],
      criterio=["metricas identicas ao digito por promocao","pilha.js mostra uma sobrescrita a menos"],
      depende=["D16"], risco="baixo em comportamento, alto em atrito. UM metodo por commit."),

 dict(id="D18", sev="higiene", fase="F5", estado="aberto",
      titulo="_cross tem 255 linhas e nove correcoes embutidas",
      locais=[dict(arquivo=MOTOR, linha=993, ancora="_cross(o) {")],
      evidencia="OS-12, OS-27, OS-44, OS-45, OS-81, OS-83, OS-200, R18.25, R18.31 numa funcao so",
      dono="core", intercepta=["16"],
      criterio=["metricas identicas em cada extracao","_cross <=60 linhas ao final"],
      depende=[], risco="baixo por commit, alto se feito de uma vez. Nunca mais de um bloco por commit."),

 dict(id="D19", sev="futebol", fase="F6", estado="aberto",
      titulo="A partida murcha: 20,0% dos gols ate 15', 14,1% apos 76'",
      locais=[dict(arquivo=CORE, linha=565, ancora="clockRate: 0.085")],
      evidencia="queda de -1,17 pp por faixa, R2=0,86; r=0,814 entre stamina e taxa de chutes",
      dono="dreno no core, normalizado por ADV4.context.clockRateRef",
      intercepta=[],
      criterio=["gols 76-90' >=20%","gols 0-15' <=15%","goals +-0,20","stamina final 55-68","passes +-5,53"],
      depende=["D17"], risco="ALTO: toca todo lance. NAO medir junto com D20 (200 partidas de intervalo)."),

 dict(id="D20", sev="futebol", fase="F6", estado="aberto",
      titulo="O bloco nao compacta ao perder a bola (encurta 0,4 m; real 8-10 m)",
      locais=[dict(arquivo=MOTOR, linha=3193, ancora="this._integrate(p, tx, ty, dt, freeze);")],
      evidencia="forma.js, 1.198 amostras: comprimento 37,8 com bola -> 37,4 sem; largura 49,4 -> 45,2",
      dono="_defendTarget tem 9 camadas e NENHUMA tem autoridade sobre a forma coletiva",
      intercepta=["07","16","26","65","70"],
      criterio=["comprimento sem bola 28-34 m","largura sem bola 34-44 m","comprimento COM bola 30-40 m","tackles +-1,07","goals +-0,20","shots +-0,84"],
      depende=["D19"], risco="ALTO. _comprimirBloco desloca ALVO, nunca corpo — senao cai no bug que a camada 84 contem."),

 dict(id="D21", sev="estrutural", fase="F6", estado="decidir",
      titulo="clockRate: 23 min de fisica para 90 de partida — decisao de produto",
      locais=[dict(arquivo=CORE, linha=565, ancora="clockRate: 0.085")],
      evidencia="posse realista e contagem de passes realista sao hoje mutuamente exclusivas",
      dono="produto",
      intercepta=[],
      criterio=["decisao registrada em calibration/targets.json"],
      depende=[], risco="AVISO: a fadiga ja e invariante ao clockRate. Se mexer no relogio, NAO mexa no dreno junto."),

 dict(id="D22", sev="futebol", fase="F6", estado="aberto",
      titulo="Acerto ao alvo 0,326 abaixo do minimo de design 0,34 (unica metrica que falta para 13/13)",
      locais=[dict(arquivo=CORE, linha=611, ancora="conversionScale: 2.25")],
      evidencia="0,326 medido; dentro da faixa real 0,30-0,40, fora da faixa de design",
      dono="camada 88 (mira)",
      intercepta=["88"],
      criterio=["design 13/13 por qualquer via","goals +-0,20"],
      depende=["D13"], risco="baixo: pode se resolver sozinho com D13"),

 dict(id="D23", sev="higiene", fase="—", estado="guarda-corpo",
      titulo="Distribuicao de placares — saudavel, serve de guarda-corpo",
      locais=[],
      evidencia="0 a 0 em 7,7% (real 7-9%); goleadas ~3% (real 2-4%)",
      dono="—", intercepta=[],
      criterio=["goleadas <=6% apos qualquer mudanca de D19 ou D20"],
      depende=[], risco="deadBallRecovery +0,02 ja derrubou empates de 29,2% para 17,5%"),

 dict(id="D24", sev="tela", fase="F6", estado="aberto",
      titulo="Tarja preta ocupa 24% a 43% da caixa do campo",
      locais=[dict(arquivo=RUNTIME, linha=1300, ancora="const cv=$('#fieldcv'), r=cv.getBoundingClientRect();")],
      evidencia="caixa.js em 4 resolucoes: 19% a 43%",
      dono="runtime de desenho (cobertura de leitura: 10%)",
      intercepta=[],
      criterio=["letterbox <=4% nas 4 resolucoes","olhar.js: as 4 linhas do campo visiveis"],
      depende=[], risco="a recomendacao MENOS fundamentada do documento"),

 dict(id="D25", sev="higiene", fase="F1", estado="aberto",
      titulo="_ballTravel isenta 'deflect' de sair do campo, sem justificativa",
      locais=[dict(arquivo=MOTOR, linha=2416, ancora="if(b.kind!=='shot'&&b.kind!=='deflect'&&")],
      evidencia="o comentario justifica a excecao para 'shot' (o alvo do gol fica alem da linha) e nao justifica 'deflect'",
      dono="core alcancado; 07/08/16/17 sao VIVAS",
      intercepta=["07","08","16","17"],
      criterio=["throwIns >=17,4","corners +-0,50"],
      depende=[],
      risco="medio. FACA ESTE PRIMEIRO de todos os de D08: uma linha, efeito medivel, reversao trivial."),

 dict(id="D26", sev="higiene", fase="F4", estado="aberto",
      titulo="decideT escrito em tres lugares e reescrito todo quadro pela camada 17",
      locais=[dict(arquivo=MOTOR, linha=503, ancora="this.decideT = CAL.timing.decisionInterval * fat * iqReact / rit;"),
              dict(arquivo=MOTOR, linha=2582, ancora="this.decideT=0.28;")],
      evidencia="a curva de sobrevivencia da posse tem um vale exatamente em 0,28 s — o relogio de decisao vazando para a estatistica",
      dono="a camada 17 e a autoridade real. A mudanca tem de ser feita LA.",
      intercepta=["17"],
      criterio=["passes +-5,53","shots +-0,84","mediana de posse 0,9-1,3 s","curva de sobrevivencia sem vale em 0,28"],
      depende=["D14"], risco="medio: mexe no ritmo de decisao"),

 dict(id="D27", sev="futebol", fase="—", estado="guarda-corpo",
      titulo="Faltas nao saem de foulBase, saem do numero de duelos",
      locais=[dict(arquivo=CORE, linha=598, ancora="foulBase: 0.29")],
      evidencia="faltas 22,25 hoje (faixa real 19-26), trazidas pela OS-206 e nao pelo parametro",
      dono="—", intercepta=[],
      criterio=["qualquer mudanca no numero de duelos reverifica faltas E cartoes JUNTOS"],
      depende=[], risco="dois erros se compensavam: poucas faltas + cartoes demais por falta"),

 dict(id="D28", sev="higiene", fase="F0", estado="aberto",
      titulo="deadBallRecovery: delta de 0,02 move o placar de design em 2 pontos",
      locais=[dict(arquivo=CORE, linha=572, ancora="deadBallRecovery: 0.062")],
      evidencia="0,055 -> 0,075: empates 29,2% -> 17,5%, goleadas 17,5% -> 20,8%, design 12/13 -> 10/13",
      dono="—", intercepta=[],
      criterio=["calibration/sensibilidade.json existe com o delta medido de cada constante"],
      depende=[], risco="nenhum: e documentacao"),

 dict(id="D29", sev="higiene", fase="F2", estado="aberto",
      titulo="Duas faixas de design conflitantes para escanteios no mesmo arquivo",
      locais=[dict(arquivo=CORE, linha=634, ancora="lowCrossSaveCorner: 0.55")],
      evidencia="o comentario diz 5,0-11,5; targets.corners diz [3, 9]; medido 11,18",
      dono="—", intercepta=[],
      criterio=["uma faixa so, alinhada ao futebol real"],
      depende=["D08"], risco="fazer DEPOIS de D08 ou o alvo tera de mudar duas vezes"),

 dict(id="D30", sev="higiene", fase="F1", estado="decidir",
      titulo="Minigame de bola parada desligado desde a R18",
      locais=[dict(arquivo=MOTOR, linha=369, ancora="_requestSetPiece(kind, data, execute) {")],
      evidencia="15 linhas mortas + 2 pontos de chamada que testam input==null sem necessidade + camadas 63/64 (255 linhas) de status desconhecido",
      dono="produto",
      intercepta=["63","64"],
      criterio=["pilha.js diz se 63/64 rodam, ANTES de decidir"],
      depende=[], risco="baixo se medido antes"),

 dict(id="D31", sev="higiene", fase="pos-F5", estado="adiado",
      titulo="A IA de treinador mora dentro do modulo do motor (~1.100 linhas, 21% do arquivo)",
      locais=[dict(arquivo=MOTOR, linha=None, ancora="function chooseOut(tm,mode)")],
      evidencia="usa estado privado da IIFE; e a maior fatia nao lida deste documento",
      dono="—", intercepta=[],
      criterio=["contratos publicos + testes especificos antes de separar"],
      depende=["D17"], risco="separar um modulo que depende de metodos prestes a mudar de lugar e trabalho dobrado"),

 dict(id="D32", sev="higiene", fase="F1", estado="aberto",
      titulo="Armadilha de escopo: CAL nao existe dentro de uma camada",
      locais=[dict(arquivo=CORE, linha=518, ancora="const ENGINE_CALIBRATION = Object.freeze({")],
      evidencia="o erro pode passar pela bateria (vm.runInThisContext) e so aparecer no navegador",
      dono="todas as camadas", intercepta=[],
      criterio=["verify.py reprova 'CAL.' em src/scripts/layers/"],
      depende=[], risco="nenhum: e lint"),

 dict(id="D33", sev="higiene", fase="F4", estado="aberto",
      titulo="Treze arquivos, 81 linhas, que so publicam numero de versao",
      locais=[dict(arquivo=L+"59-cds-r1821rc1-build-meta.js", linha=None, ancora="")],
      evidencia="89 blocos poderiam ser 77; o manifesto encolhe 13%",
      dono="—", intercepta=[],
      criterio=["grep por __CDS_* antes de fundir","metricas identicas"],
      depende=[], risco="baixo mas nao zero: algo pode ler por nome"),

 dict(id="D34", sev="estrutural", fase="F4", estado="aberto",
      titulo="Ate 81 sobrescritas nunca alcancadas — TETO SUPERIOR, nao contagem",
      locais=[],
      evidencia="14 partidas nao exercitam penalti decisivo, expulsao dupla, prorrogacao nem metade da bola parada",
      dono="—", intercepta=[],
      criterio=["rodar pilha.js com 300 partidas ANTES de apagar qualquer coisa","<=15 em zero ao final"],
      depende=[],
      risco="ALTO se alguem apagar as 81 direto. O primeiro plano escreveu este numero como se fosse fato — era teto."),
]

DOCUMENTO = "reports/INVESTIGACAO-COMPLETA-2026-08.md"


def mapear_secoes() -> tuple[dict[str, dict], list[str]]:
    """Descobre onde cada defeito mora DENTRO do documento.

    O documento tem ~4.900 linhas. Uma IA nao deve le-lo inteiro: deve pedir uma
    secao. Este mapa e recalculado a cada execucao, entao nunca envelhece — e a
    validacao cruzada abaixo falha se o catalogo e o documento discordarem, que
    e o unico jeito de os dois nao virarem ficcao um do outro.
    """
    import re
    erros: list[str] = []
    doc = (RAIZ / DOCUMENTO)
    if not doc.exists():
        return {}, [f"documento nao existe: {DOCUMENTO}"]
    linhas = doc.read_text(encoding="utf8").split("\n")
    # todo cabecalho de nivel 1 ou 2 encerra a secao anterior
    marcos: list[tuple[int, str | None]] = []
    for i, ln in enumerate(linhas, start=1):
        m = re.match(r"^## (D\d\d) ", ln)
        if m:
            marcos.append((i, m.group(1)))
        elif re.match(r"^#{1,2} [^#]", ln):
            marcos.append((i, None))

    secoes: dict[str, dict] = {}
    for idx, (linha, ident) in enumerate(marcos):
        if ident is None:
            continue
        fim = marcos[idx + 1][0] - 1 if idx + 1 < len(marcos) else len(linhas)
        secoes[ident] = {"arquivo": DOCUMENTO, "linha_inicio": linha,
                         "linha_fim": fim, "titulo": linhas[linha - 1].lstrip("# ")}

    ids_catalogo = {d["id"] for d in DEFEITOS}
    for i in sorted(ids_catalogo - set(secoes)):
        erros.append(f"{i}: existe no catalogo e NAO tem secao no documento")
    for i in sorted(set(secoes) - ids_catalogo):
        erros.append(f"{i}: tem secao no documento e NAO existe no catalogo")
    return secoes, erros


# ── validacao ────────────────────────────────────────────────────────────────
def validar() -> list[str]:
    erros = []
    for d in DEFEITOS:
        for loc in d["locais"]:
            anc = loc.get("ancora") or ""
            if not anc:
                continue
            p = RAIZ / loc["arquivo"]
            if not p.exists():
                erros.append(f'{d["id"]}: arquivo nao existe: {loc["arquivo"]}')
                continue
            texto = p.read_text(encoding="utf8")
            n = texto.count(anc)
            if n == 0:
                erros.append(f'{d["id"]}: ancora SUMIU de {loc["arquivo"]}: {anc[:60]!r}')
            elif n > 1:
                erros.append(f'{d["id"]}: ancora aparece {n}x em {loc["arquivo"]} (tem de ser unica): {anc[:60]!r}')
            else:
                # linha real, para o consumidor nao depender do numero congelado
                loc["linha_atual"] = texto[: texto.index(anc)].count("\n") + 1
    return erros


def main() -> int:
    erros = validar()
    secoes, erros_secao = mapear_secoes()
    erros += erros_secao
    for d in DEFEITOS:
        if d["id"] in secoes:
            d["secao"] = secoes[d["id"]]
    for e in erros:
        print("ERRO:", e, file=sys.stderr)
    if erros:
        print(f"\n{len(erros)} ancora(s) invalida(s). O catalogo envelheceu — "
              f"atualize tools/defeitos.py antes de seguir.", file=sys.stderr)
        return 1

    por_estado: dict[str, int] = {}
    for d in DEFEITOS:
        por_estado[d["estado"]] = por_estado.get(d["estado"], 0) + 1

    saida = {
        "documento": "reports/INVESTIGACAO-COMPLETA-2026-08.md",
        "build_da_analise": "ff808761f579765613f0a13fdab1112a9ab335837300fbd61e2f92e6c8c95e7e",
        "placar_na_analise": {"design": "12/13", "futebol_real": "15/21"},
        "total": len(DEFEITOS),
        "por_estado": por_estado,
        "leia_primeiro": "reports/LEIA-PRIMEIRO.md",
        "como_ler_um_defeito": "python3 tools/defeito.py D08   # entrada, secao do documento e o CODIGO ATUAL",
        "comece_por": {
            "id": "D25",
            "porque": ("Uma linha, efeito medivel, reversao trivial. Se throwIns NAO subir com "
                       "ela, a hipotese central de D08 precisa ser revista antes de investir "
                       "em D01 e na camada nova. E o teste mais barato da tese mais cara."),
        },
        "aviso": ("NAO leia o documento inteiro: sao ~4.900 linhas. Use tools/defeito.py "
                  "para carregar so o defeito em que voce vai trabalhar."),
        "protocolo_obrigatorio": [
            "node tools/fisica/pilha.js dist/index.html 14   # QUEM E O DONO do metodo",
            "bash tools/aceitar.sh --antes",
            "edite src/ (NUNCA dist/)",
            "bash tools/aceitar.sh --depois",
        ],
        "defeitos": DEFEITOS,
    }
    destino = RAIZ / "reports" / "defeitos.json"
    if "--check" not in sys.argv:
        destino.write_text(json.dumps(saida, ensure_ascii=False, indent=1), encoding="utf8")
        print(f"ok: {len(DEFEITOS)} defeitos, {sum(len(d['locais']) for d in DEFEITOS)} ancoras "
              f"validadas, {len(secoes)} secoes mapeadas -> {destino}")
    else:
        print(f"ok: {len(DEFEITOS)} defeitos, ancoras unicas, {len(secoes)} secoes casando com o documento")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
