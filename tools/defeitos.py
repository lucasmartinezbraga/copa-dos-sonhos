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
 dict(id="D01", sev="estrutural", fase="F1", estado="feito",
      titulo="Duas fisicas de bola — em _looseRoll, nao em _ballTravel (premissa corrigida)",
      locais=[dict(arquivo=MOTOR, linha=2210, ancora="ESTA INTEGRAÇÃO NÃO RODA"),
              dict(arquivo=MOTOR, linha=2350, ancora="AQUI está a segunda física"),
              dict(arquivo=MOTOR, linha=2465, ancora="_deflectTo(x, y, spd) {")],
      evidencia="150,40 chamadas por partida caem no integrador de g=20 (57,05 _deflectTo + 93,35 _looseBall)",
      dono="core e o dono da fisica do desvio; 45/47/49 so reescrevem o ALVO",
      intercepta=["07","17","45","47","49"],
      criterio=["quadros de voo sem plano fisico: 0 (MEDIDO, ja era 0)","corners +-0,50","goals +-0,20"],
      depende=[], risco="baixo: a mudanca real e uma linha em _looseRoll",
      feito_em=("PREMISSA CORRIGIDA. A sonda tools/fisica/ramo-g20.js mediu ZERO quadros de voo "
                "sem plano fisico em 12 partidas — o desvio SEMPRE teve balistica real, porque a "
                "camada 07 cria o plano logo depois de chamar o core. A linha b.vz -= 20*dt de "
                "_ballTravel e codigo morto. A segunda fisica estava em _looseRoll: 39,25 quadros "
                "por partida, bola a 0,995 m de altura media e ate 2,685 m, caindo com o DOBRO da "
                "gravidade. Corrigido para 9,81 la; a linha morta do _ballTravel ficou anotada. "
                "CONSEQUENCIA: D01 era pre-requisito de D02 e D08 — a cadeia F2 perde essa "
                "justificativa.")),

 dict(id="D02", sev="futebol", fase="F1", estado="refutado",
      titulo="_contestLoose entrega sem teto de distancia — REFUTADO pela medicao",
      locais=[dict(arquivo=MOTOR, linha=2489, ancora="const zone = cands.filter")],
      evidencia="21,3 entregas por partida com o mais proximo a mais de 3 m; 22,2 bolas pousando fora e resgatadas a 6,8 m",
      dono="core alcancado; 08 e 45 sao VIVAS",
      intercepta=["08","45"],
      criterio=["REFUTADO — nao implementar"],
      depende=[], risco="ALTO e SEM GANHO: o conserto seria inerte e a bola pode morrer no meio do campo.",
      feito_em=("PREMISSA REFUTADA — NAO IMPLEMENTAR. A sonda tools/fisica/ramo-d02.js mediu no "
                "TOPO da pilha, 12 partidas: 36,67 entregas efetivas por partida, distancia media "
                "de quem RECEBEU 0,49 m, MAXIMA 1,53 m, 100% dentro de 1,7 m. Bola ja fora do "
                "campo: 0,08 chamadas/partida e ZERO entregas. O teto de distancia existe na "
                "pratica — as camadas 08 e 45 filtram antes, e o filtro sem limite do core nunca e "
                "alcancado com bola distante. Os numeros do documento (21,3 entregas com folga "
                "acima de 3 m; 22,2 bolas resgatadas a 6,8 m) vieram da sonda da tentativa A4 e "
                "NAO REPRODUZEM.")),

 dict(id="D03", sev="higiene", fase="F1", estado="feito",
      titulo="~190 linhas mortas guardadas por return antecipado dentro do motor",
      locais=[dict(arquivo=MOTOR, linha=369, ancora="_requestSetPiece() { return false; }"),
              dict(arquivo=MOTOR, linha=2019, ancora="this._os200ResolverChute(o,{g,tm,gk,atk,gkF,pGoal,")],
      evidencia="pilha.js: contagem zero nos ramos antigos em 14 partidas; o guarda nunca e falso num build de tools/build.py",
      dono="nao alcancavel por definicao",
      intercepta=[],
      criterio=["as 14 metricas IDENTICAS ao digito (nao '+-2 SE')"],
      feito_em=("176 linhas removidas do motor: 17 em _requestSetPiece, 10 no ramo rasteiro "
                "de _cross, 30 no ramo aereo e 136 em _shoot. Os quatro guardas "
                "`if(this._os200ResolverChute)` sairam junto — a ausencia da camada 88 agora "
                "vira erro visivel em vez de um chute resolvido por um caminho nao medido. "
                "5.262 -> 5.086 linhas."),
      depende=[], risco="o mais baixo do catalogo"),

 dict(id="D04", sev="higiene", fase="F1", estado="feito",
      titulo="_looseBall do core esta morto e nao parece",
      locais=[dict(arquivo=MOTOR, linha=2483, ancora="// jogador mais próximo assume após breve disputa"),
              dict(arquivo=L+"08-cds-p04-physical-reception-584-r6.js", linha=767, ancora="P._looseBall = function p04LooseBall(x, y) {")],
      evidencia="tentativa A4 editou este corpo: nenhuma das 14 metricas moveu 0,15 SE",
      dono="camada 08 (p04) intercepta e NAO chama o core quando a bola esta viva",
      intercepta=["08","17","45","47","49"],
      criterio=["metricas identicas (a mudanca e comentario)"],
      depende=[], risco="nenhum",
      feito_em=("aviso escrito no core acima de _looseBall. Verificado com "
                "aceitar.sh --depois --identico: as 14 metricas IDENTICAS ao digito. "
                "E o exemplo trabalhado do ciclo completo.")),

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
      locais=[dict(arquivo=MOTOR, linha=2622, ancora="this._deflectTo(clamp(this.ball.x-tmA.attackDir*R(1,5),2,FL-2)")],
      evidencia=("85,8% dos alvos a mais de 8 m da lateral; 16,8 alvos/partida mirados para fora ~ 15,9 laterais medidos. "
                 "CORRECAO apos D03: dos 5 pontos de chamada que este defeito listava, UM estava dentro do ramo "
                 "morto de _cross e sumiu com a limpeza. O clamp sobrevivente no motor e o do alivio na barreira; "
                 "os demais estao nas camadas. Recontar antes de atacar D08."),
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

 dict(id="D11", sev="estrutural", fase="F3", estado="feito",
      titulo="Sorteio censurado 1: o censor roda em 51,4% das decisoes (MEDIDO)",
      locais=[dict(arquivo=L+"16-cds-r12-transactional-core-r123.js", linha=153, ancora="tm.__r122LastContextShot=now;"),
              dict(arquivo=L+"20-cds-r183-natural-football.js", linha=63, ancora="dg.smartShotVetoes=(dg.smartShotVetoes||0)+1;")],
      evidencia="o comentario da camada 20 e a prova literal: 'Marcar o instante atual veta unicamente essa roleta'",
      dono="_decide tem 8 camadas; 51 roda por fora de todas",
      intercepta=["16","17","18","20","27","43","45","51"],
      criterio=["14 metricas dentro de 2 SE SEM pareamento de semente","-250 linhas","zero variaveis de contrato com nome de release"],
      medido=("CONFIRMADO E MAIOR. ramos.js, 12 partidas: 264,67 VETOS em 515,17 decisoes examinadas "
              "= 51,4%. Metade das decisoes do jogo passa pelo censor. O documento tratava como "
              "mecanismo pontual. E o defeito estrutural com maior alcance medido do catalogo — "
              "sobe de F3 para o primeiro candidato depois da F1."),
      feito_em=("FUSAO FEITA. O _decide da camada 20 deixou de existir; no lugar ha um PREDICADO "
                "PURO _r183ExcecaoAoChuteContextual, sem efeito colateral, sem RNG e sem estado "
                "compartilhado, com as quatro excecoes nomeadas. A camada 16 o consulta no momento "
                "exato do sorteio. A variavel __r122LastContextShot deixou de ser envenenada — ela "
                "continua servindo ao auto-limite legitimo de 1,15 s. Some junto um efeito colateral "
                "que ninguem tinha declarado: o veto PERSISTIA 1,15 s porque envenenava um campo que "
                "serve para outra coisa. E o custo caiu 13x: o predicado ia de 515,17 avaliacoes por "
                "partida para 38,83, porque agora so roda quando o sorteio vai mesmo acontecer.\n"
                "ACEITO NA SEGUNDA TENTATIVA. A PRIMEIRA REPROVOU e o motivo vale mais que "
                "o conserto: eu tratei a persistencia como efeito colateral a limpar. O veto "
                "antigo carimbava __r122LastContextShot e com isso SUPRIMIA a roleta por 1,15 s; "
                "consultar o predicado so no instante do sorteio matou essa janela. Resultado "
                "medido em 300 partidas: as 14 metricas agregadas NAO se moveram e o placar de "
                "design caiu 12/13 -> 10/13, com drawRate 0,270 -> 0,190 (3,53 SE, fora da faixa) "
                "e blowoutRate 0,153 -> 0,197 (1,89 SE, fora). Com a janela restaurada em campo "
                "PROPRIO (__r183VetoChuteContextual): 14/14 em 2 SE com deltas <= 0,13, design de "
                "volta a 12/13. LICAO: efeito colateral pode ser o mecanismo. E o portao estava "
                "cego — drawRate e blowoutRate nao estao entre as 14; dai nasceu "
                "tools/regressao_design.py, hoje dentro do aceitar.sh."),
      depende=[], risco="medio: remover chance() desalinha o RNG; compare distribuicoes, nao partidas"),

 dict(id="D12", sev="estrutural", fase="F2", estado="aberto",
      titulo="Sorteio censurado 2 — formulacao refutada; sobra o alvo puxado de volta",
      locais=[dict(arquivo=L+"17-cds-r13-football-observer-cadence.js", linha=203, ancora="if(edge<5.5&&hit13(this,.64))ty=y<FW13/2?-.7:FW13+.7;"),
              dict(arquivo=MOTOR, linha=2483, ancora="// jogador mais próximo assume após breve disputa")],
      evidencia="22,2 bolas por partida pousando fora e entregues a alguem a 6,8 m",
      dono="ATENCAO: a camada 08 intercepta _looseBall e nao chama o core. O conserto tem de ser feito LA TAMBEM.",
      intercepta=["08","17","45","47","49"],
      criterio=["throwIns >=17,4 (2 SE) sem D08"],
      medido=("FORMULACAO REFUTADA. ramos.js: _looseBall chamado 92,08/partida; terminou COM DONO "
              "apenas 2,58 (2,8%), ficou solta 89,50 (97,2%). O core NAO recolhe a bola. Sobra um fio "
              "vivo: 19,92 alvos ja chegam fora e so 11 pousam fora — os ~9 de diferenca sao alguma "
              "camada puxando o alvo de volta, e isso ainda nao foi investigado."),
      depende=["D02"], risco="medio: mais reinicios = mais bola parada; vigie passes"),

 dict(id="D13", sev="futebol", fase="F3", estado="aberto",
      titulo="Sorteio censurado 3: erro de chute sorteado ate 6,5 m e comprimido pela camada 55",
      locais=[dict(arquivo=L+"55-cds-r1821-shot-plausibility.js", linha=72, ancora="const excessoMax = 6.5 - POST;")],
      evidencia="o comentario diz 'pior caso observado no motor' — a camada foi calibrada contra o motor, nao contra futebol",
      dono="camada 88 e TERMINAL para a mira; territorio seguro",
      intercepta=["88"],
      criterio=["onTarget >=7,72","acerto ao alvo 0,34-0,40","goals +-0,20","-111 linhas"],
      medido=("CONFIRMADO E MAIOR. ramos.js: 12,33 de 23,42 chutes por partida tem o erro comprimido "
              "(52,7%). Amplitude media antes 6,80 m, depois 4,57 m, MAXIMA antes 13,30 m — o dobro "
              "dos 6,5 m que a constante excessoMax do censor supoe como pior caso."),
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
      medido=("NAO MENSURAVEL HOJE. getR1899Audit() nao existe — as 255 linhas de antiteleporte nao "
              "publicam contador nenhum. PRIMEIRO PASSO nao e consertar nem apagar: e acrescentar um "
              "contador e rodar 300 partidas. Sem isso, remover 255 linhas e aposta."),
      depende=["D14"], risco="baixo enquanto for so diagnostico"),

 dict(id="D16", sev="higiene", fase="F5", estado="aberto",
      titulo="Quatro camadas falsificam _breaking/_markRef porque falta parametro de esforco",
      locais=[dict(arquivo=L+"71-cds-os51-beaten-defender.js", linha=23, ancora="var oldInt=P._integrate;"),
              dict(arquivo=L+"23-cds-r185-bloco-defensivo.js", linha=51, ancora="P._integrate=function(p,tx,ty,dt,freeze){")],
      evidencia="_breaking e lido em _cross para montar lowPool — a elegibilidade para receber cruzamento depende de um campo que outras camadas mentem",
      dono="ATENCAO: a camada 16 e TERMINAL para _integrate. O parametro tem de ser adicionado LA, nao no core.",
      intercepta=["16","17","23","24","71"],
      criterio=["comprimento do bloco com bola +-1,5 m","largura +-2 m","tackles +-1,07","leituras falsas de _breaking: 0"],
      medido=("RECLASSIFICADO. ramos.js: _integrate chamado 886.981,58 vezes por partida e _breaking "
              "saiu diferente ZERO vezes. A falsificacao nao vaza para _cross, que era o risco "
              "apontado. Sai de corretude e entra em legibilidade: nao ha bug escondido, ha um modelo "
              "ausente. Severidade rebaixada de estrutural para higiene."),
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
      titulo="A partida murcha — SUBESTIMADO: 21,8% ate 15' e 11,3% apos 76' por MINUTO de jogo",
      locais=[dict(arquivo=CORE, linha=565, ancora="clockRate: 0.085")],
      evidencia="queda de -1,17 pp por faixa, R2=0,86; r=0,814 entre stamina e taxa de chutes",
      dono="dreno no core, normalizado por ADV4.context.clockRateRef",
      intercepta=[],
      criterio=["gols 76-90' >=20%","gols 0-15' <=15%","goals +-0,20","stamina final 55-68","passes +-5,53"],
      feito_em=("TRES TENTATIVAS REPROVADAS, todas medidas em 300 partidas. Laudo completo em "
                "reports/D19-D20-a-mesma-alavanca.md. Resumo: (1) achatar a fadiga na velocidade "
                "passou nos dois portoes e levou os gols de 76+ de 14,7% para 16,1%, mas nao atingiu "
                "os criterios declarados e PIOROU o D20 (encurtamento do bloco 2,8 -> 0,8 m); "
                "(2) compactar o bloco reprovou feio (chutes -2,18, gols -0,374); (3) o piso que "
                "envelhece com a stamina quase recuperou os gols (-0,07) e NAO moveu a distribuicao. "
                "CONCLUSAO: forma e volume de chances sao a MESMA alavanca em sentidos opostos. Falta "
                "ao motor uma FASE DE TRANSICAO (o time que perde a bola recompoe, nao so troca de "
                "alvo). E trabalho de modelo, nao de constante."),
      medido=("O NUMERO PUBLICADO ESTAVA SUBESTIMADO. As seis faixas nao tem a mesma duracao: "
              "0-15, 16-30, 31-45 e 61-75 dao 15,00 minutos de jogo por partida, o 46-60 da 18,70 "
              "(os acrescimos do 1o tempo caem nele) e o 76+ da 21,14 (e aberto). Medido em 96 "
              "partidas lendo sim.minute. Comparar percentuais BRUTOS entre faixas de tamanhos "
              "diferentes inventava um pico no 46-60 (18,1% brutos -> 15,7% por minuto) e "
              "disfarcava a queda do fim (14,7% -> 11,3%). Por minuto de jogo: 21,8% ate os 15 e "
              "11,3% depois dos 76 — razao inicio/fim de 1,92x, nao 1,36x. bateria.js passou a "
              "medir minutosDeJogoPorPartida e futebol_real.py publica as duas colunas.\n"
              "CAUSA ISOLADA — tools/fisica/ramo-d19.js, 48 partidas. O r=0,814 do documento "
              "e correlacao, nao mecanismo: stamina cai monotonicamente e qualquer coisa que "
              "caia junto correlaciona alto com ela. A sonda separou as quatro historias "
              "possiveis pela razao 76+ / 0-15, tudo POR MINUTO DE JOGO (`sim.minute`, nao "
              "`sim.t`):\n"
              "  H1 chutes por minuto ....... 0,685  <== E ESTA\n"
              "  H2 acerto ao alvo por chute  0,996  estavel — DESCARTADA\n"
              "  H3 fracao de bola em jogo .. 1,078  estavel — DESCARTADA\n"
              "  H4 simulacao por minuto .... 0,928  uniforme — DESCARTADA\n"
              "O jogo NAO erra mais no fim: ele CRIA 31% menos chutes e converte igual. O "
              "conserto e no que gera a chance, nao na finalizacao nem no relogio.\n"
              "AVISO: a MESMA sonda com 8 partidas deu H2 = 0,504, que parecia um segundo "
              "mecanismo e era ruido (131 gols em 48 partidas dao SE ~3,1 pp por faixa; com 8 "
              "partidas nao da para concluir nada). E a armadilha B7 acontecendo ao vivo."),
      depende=["D17"], risco="ALTO: toca todo lance. NAO medir junto com D20 (200 partidas de intervalo)."),

 dict(id="D20", sev="futebol", fase="F6", estado="refutado",
      titulo="O bloco nao compacta — REFUTADO: ele compacta 9 m em 4 s",
      locais=[dict(arquivo=MOTOR, linha=3193, ancora="this._integrate(p, tx, ty, dt, freeze);")],
      evidencia="forma.js, 1.198 amostras: comprimento 37,8 com bola -> 37,4 sem; largura 49,4 -> 45,2",
      dono="_defendTarget tem 9 camadas e NENHUMA tem autoridade sobre a forma coletiva",
      intercepta=["07","16","26","65","70"],
      criterio=["REFUTADO — nao implementar"],
      medido=("PREMISSA REFUTADA — NAO IMPLEMENTAR. O numero 0,4 m (depois 2,8 m) vinha de "
              "comparar, no MESMO instante, o time que ataca com o time que defende — dois times "
              "diferentes. E foto transversal lida como se fosse longitudinal.\n"
              "Medido corretamente por tools/fisica/ramo-transicao.js, seguindo o MESMO time "
              "antes e depois da perda, 32 partidas e ~20 mil amostras por faixa:\n"
              "    desde a perda    1o tempo   2o tempo\n"
              "    0-0,5 s ......... 42,6 m     40,2 m\n"
              "    2-3 s ........... 36,3       35,0\n"
              "    4-6 s ........... 33,6       33,2\n"
              "    encurtamento .... 9,0 m      7,0 m   (futebol real: 8-10)\n"
              "A fase de transicao EXISTE e recompoe como o futebol de elite: ~9 m em ~4 s. O "
              "bloco assentado fica em 33,6 m, dentro da faixa real de 25-35.\n"
              "O QUE SOBRA, e nao e este defeito: no 2o tempo o bloco so estica ate 40,2 m em "
              "vez de 42,6 quando a posse e perdida. Nao e a recomposicao que piora — e o ataque "
              "adversario que estica menos. Isso e o D19 visto do outro lado, e o alvo continua "
              "sendo penetracao, nao forma.\n"
              "tools/fisica/tela/forma.js foi corrigido: agora publica o bloco defensivo separado "
              "por fase (recompondo x assentado) alem da foto transversal."),
      depende=["D19"], risco="nenhum: nao ha o que implementar"),

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
      criterio=["design 13/13 por qualquer via","goals +-0,20","futebol real NAO pode cair de 15/21"],
      medido=("TENTATIVA REVERTIDA. O aviso do codigo ('a resposta e ingreme, exige rodar a "
              "grade') foi seguido: tools/fisica/calibrar.py, 4 pontos x 48 partidas.\n"
              "    erroBase   gols   noAlvo\n"
              "      15,3     2,73   0,306   <- atual\n"
              "      14,9     2,81   0,332\n"
              "      14,5     3,25   0,363\n"
              "      14,1     2,71   0,348\n"
              "A coluna de gols e ruidosa (nao e monotonica; 2 SE ~ 0,49 com 48 partidas), "
              "entao escolhi 14,9, o passo modesto. Em 300 partidas: APROVADO nos dois "
              "portoes e MESMO ASSIM revertido, por dois motivos:\n"
              "  1. NAO ATINGIU O ALVO. acertoAoAlvo 0,320 -> 0,331, e o minimo de design e "
              "0,34. Continuou 12/13.\n"
              "  2. CUSTOU UMA METRICA DO FUTEBOL REAL. golPorChuteNoAlvo 0,379 -> 0,382, "
              "acima do teto real de 0,38. O placar do futebol real caiu de 15/21 para 14/21 "
              "— e nenhum dos dois portoes vigia esse placar.\n"
              "MINHA PREVISAO ESTAVA ERRADA e o erro e instrutivo: eu esperava que "
              "golPorChuteNoAlvo CAISSE (mais chutes no alvo, mesmos gols). Ele subiu, porque "
              "os gols subiram junto — o goleiro converte os chutes extras na mesma taxa.\n"
              "CONCLUSAO: acertoAoAlvo e gol|noAlvo estao amarrados pela mesma alavanca. Para "
              "chegar a 0,34 sem estourar o teto de 0,38 e preciso mexer em DOIS parametros "
              "juntos — erroBase E defesaBase — o que pede uma grade 2D, nao uma linha.\n"
              "E FICA A PERGUNTA DE PRODUTO: 0,320 esta DENTRO da faixa do futebol real "
              "(0,30-0,40) e FORA da faixa de design (0,34-0,47). O minimo de design e mais "
              "exigente que o futebol de verdade. Talvez o alvo e que esteja errado."),
      depende=["D13"], risco="baixo: pode se resolver sozinho com D13"),

 dict(id="D23", sev="higiene", fase="—", estado="guarda-corpo",
      titulo="Distribuicao de placares — saudavel, serve de guarda-corpo",
      locais=[],
      evidencia="0 a 0 em 7,7% (real 7-9%); goleadas ~3% (real 2-4%)",
      dono="—", intercepta=[],
      criterio=["goleadas <=6% apos qualquer mudanca de D19 ou D20"],
      depende=[], risco="deadBallRecovery +0,02 ja derrubou empates de 29,2% para 17,5%"),

 dict(id="D24", sev="tela", fase="F6", estado="feito",
      titulo="Tarja preta — RESOLVIDA: o campo cresce ate a moldura (31,8/22,3/28,2/46,0% -> 5,0/3,9/5,8/11,5%)",
      locais=[dict(arquivo=RUNTIME, linha=1300, ancora="const cv=$('#fieldcv'), r=cv.getBoundingClientRect();")],
      evidencia="caixa.js em 4 resolucoes: 19% a 43%",
      dono="runtime de desenho (cobertura de leitura: 10%)",
      intercepta=[],
      criterio=["CRITERIO ANTIGO IMPOSSIVEL — ver medido","vazio no quadro <=14% com layout (caminho 1)","<=4% so com proporcao responsiva (caminho 2)"],
      medido=("TENTATIVA REVERTIDA — a metrica melhorou 4x e o jogo quebrou na tela.\n"
              "1) O CRITERIO ANTIGO E ARITMETICAMENTE IMPOSSIVEL. Com proporcao FIXA, "
              "vazio = 1 - min(A,Acaixa)/max(A,Acaixa). As caixas medidas vao de 1,174 "
              "(1024x768) a 1,655 (1920x1080) — razao 0,709. Nenhum A fixo da <=4% nas "
              "quatro; o melhor possivel (media geometrica, 1,394) deixa 15,8% nas pontas. "
              "So proporcao RESPONSIVA atinge o alvo, e isso e mudanca de layout.\n"
              "2) A PROPORCAO 2,048 NAO E CSS, E CALIBRACAO DO PALCO 2.5D. O campo real e "
              "105x68 (1,544) e o mundo logico e 1024x500 (2,048): o gramado sai 37% mais "
              "largo do que e. Corrigi para CH=673 (gramado 996x645 = 105:68 exato) e o "
              "vazio no quadro caiu de 31,8/22,3/28,2/46,0% para 8,2/11,5/7,6/27,3%. "
              "Build, verify e smoke passaram. E a tela mostrou o gramado virado num "
              "trapezio torto, com um gol so em quadro. A camada 21 projeta com "
              "topY=M+34, bottomY=CH-3 e R0=0,72 calibrados para a faixa de 451 px que "
              "CH=500 produz; com 624 px a perspectiva se desmonta. Junto vao a escala de "
              "altura da bola (22 px/m), o plano de chao e o raio do atleta.\n"
              "3) O INSTRUMENTO ESTAVA CEGO DUAS VEZES. caixa.js media so a tarja "
              "VERTICAL — esticar o canvas na altura 'consertaria' criando tarja lateral "
              "invisivel para ela (depois do conserto, 1920x1080 ficou 0% vertical e 8% "
              "lateral). E media dentro do ELEMENTO canvas, nao do quadro que o jogador "
              "ve. Agora mede AREA e publica os dois. Sem isso eu teria reportado vitoria "
              "sobre um jogo quebrado.\n"
              "ENTREGUE (caminho 1): o quadro passou a ter altura de conteudo e a se centralizar, "
              "em vez de esticar na linha 1fr do grid do cockpit. Vazio no quadro 31,8/22,3/28,2/"
              "46,0% -> 0,5/0,3/0,5/0,8%. aceitar.sh --identico: 14/14 identicas ao digito. "
              "Capturas conferidas nas 4 resolucoes.\n"
              "CORRECAO DE UMA CONCLUSAO MINHA: a forma do campo na tela NAO depende de CH — "
              "`vn=(fy-M)/fH` normaliza antes de projetar. O que quebrou a tentativa 2 foi "
              "`bottomY = CH-3`, nao CH. Experimento com a faixa FIXA em 451 px e CH=619: "
              "perspectiva intacta (reports/fotos-d24c/). Falta so re-enquadrar a camera, que "
              "tambem depende de CH.\n"
              "CAMINHOS, em ordem de custo: (1) FEITO — devolver ao layout a altura que o "
              "field-wrap reserva e o canvas nao usa — barato, nao mexe no render; "
              "(2) proporcao responsiva com o palco 2.5D re-derivado — a unica que atinge "
              "<=4%; (3) corrigir a geometria do campo junto, porque 2,11 contra 1,544 e "
              "defeito proprio. Laudo em reports/D24-a-tarja-preta.md."),
      depende=[], risco="a recomendacao MENOS fundamentada do documento"),

 dict(id="D25", sev="higiene", fase="F1", estado="feito",
      titulo="_ballTravel isenta 'deflect' de sair do campo, sem justificativa",
      locais=[dict(arquivo=MOTOR, linha=2416, ancora="D25 · `deflect` NÃO tinha.")],
      evidencia="o comentario justifica a excecao para 'shot' (o alvo do gol fica alem da linha) e nao justifica 'deflect'",
      dono="core alcancado; 07/08/16/17 sao VIVAS",
      intercepta=["07","08","16","17"],
      criterio=["throwIns >=17,4","corners +-0,50"],
      depende=[],
      risco="medio. FACA ESTE PRIMEIRO de todos os de D08: uma linha, efeito medivel, reversao trivial.",
      feito_em=("FEITO E SEM EFEITO MEDIDO. A excecao foi removida (o comentario dela agora "
                "explica por que 'shot' tem razao de ser e 'deflect' nao tinha), mas as 14 "
                "metricas ficaram IDENTICAS ao digito em 40 partidas pareadas. "
                "A sonda tools/fisica/ramo-d25.js explica: ha 77,5 quadros por partida com "
                "bola de desvio viajando FORA do campo, e _ballOut e chamado em voo ZERO "
                "vezes — as saidas ja vinham por _looseRoll (7,9/partida) e por bola parada "
                "(19,6/partida). A linha editada nao e alcancada no caso do desvio: alguma "
                "das 4 sobrescritas de _ballTravel resolve o segmento antes. "
                "CONSEQUENCIA PARA D08: a premissa de que o desvio escapava da maquina de "
                "reinicio esta ERRADA. O orcamento de laterais nao se abre por aqui.")),

 dict(id="D26", sev="higiene", fase="F4", estado="aberto",
      titulo="decideT escrito em tres lugares e reescrito todo quadro pela camada 17",
      locais=[dict(arquivo=MOTOR, linha=503, ancora="this.decideT = CAL.timing.decisionInterval * fat * iqReact / rit;"),
              dict(arquivo=MOTOR, linha=2582, ancora="this.decideT=0.28;")],
      evidencia="a curva de sobrevivencia da posse tem um vale exatamente em 0,28 s — o relogio de decisao vazando para a estatistica",
      dono="a camada 17 e a autoridade real. A mudanca tem de ser feita LA.",
      intercepta=["17"],
      criterio=["passes +-5,53","shots +-0,84","mediana de posse 0,9-1,3 s","curva de sobrevivencia sem vale em 0,28"],
      medido=("CONFIRMADO, DESCRICAO INTACTA. ramos.js: 35.195,25 mudancas de decideT por partida — a "
              "camada 17 reescreve quase todo quadro, como o documento dizia por leitura. O literal "
              "0,28 aparece 55,25 vezes (as recepcoes). Unico dos sete que sobreviveu intacto."),
      depende=["D14"], risco="medio: mexe no ritmo de decisao"),

 dict(id="D27", sev="futebol", fase="—", estado="guarda-corpo",
      titulo="Faltas nao saem de foulBase, saem do numero de duelos",
      locais=[dict(arquivo=CORE, linha=598, ancora="foulBase: 0.29")],
      evidencia="faltas 22,25 hoje (faixa real 19-26), trazidas pela OS-206 e nao pelo parametro",
      dono="—", intercepta=[],
      criterio=["qualquer mudanca no numero de duelos reverifica faltas E cartoes JUNTOS"],
      depende=[], risco="dois erros se compensavam: poucas faltas + cartoes demais por falta"),

 dict(id="D28", sev="higiene", fase="F0", estado="feito",
      titulo="deadBallRecovery: delta de 0,02 move o placar de design em 2 pontos",
      locais=[dict(arquivo=CORE, linha=572, ancora="deadBallRecovery: 0.062")],
      evidencia="0,055 -> 0,075: empates 29,2% -> 17,5%, goleadas 17,5% -> 20,8%, design 12/13 -> 10/13",
      dono="—", intercepta=[],
      criterio=["calibration/sensibilidade.json existe com o delta medido de cada constante"],
      feito_em=("calibration/sensibilidade.json · 10 constantes com o delta MEDIDO de cada "
                "uma e a licao que ela deixou. O conhecimento existia so em comentarios "
                "espalhados; agora esta num lugar so."),
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
      locais=[dict(arquivo=MOTOR, linha=369, ancora="_requestSetPiece() { return false; }")],
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

 dict(id="D32", sev="higiene", fase="F1", estado="feito",
      titulo="Armadilha de escopo: CAL nao existe dentro de uma camada",
      locais=[dict(arquivo=CORE, linha=518, ancora="const ENGINE_CALIBRATION = Object.freeze({"),
              dict(arquivo=L+"66-cds-os39-block-on-flight.js", linha=8, ancora="var _CALIB=root.ENGINE_CALIBRATION;")],
      evidencia="o erro pode passar pela bateria (vm.runInThisContext) e so aparecer no navegador",
      dono="todas as camadas", intercepta=[],
      criterio=["verify.py reprova 'CAL.' em src/scripts/layers/"],
      depende=[], risco="nenhum: e lint",
      feito_em=("lint em tools/verify.py (passo 6). Na PRIMEIRA execucao ele pegou uma "
                "violacao real e viva: a camada 66 lia restarts.shotBlockCorner por "
                "`root.CAL && ...`, que NUNCA acerta porque window.CAL e undefined "
                "(medido). Caia no 0,66 codificado em silencio — a calibracao estava "
                "desconectada e mexer no 20-core.js nao teria efeito ali. O padrao por "
                "acaso era igual ao valor calibrado, entao o defeito era invisivel. "
                "Corrigido para ENGINE_CALIBRATION; o lint impede a reintroducao.")),

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

 dict(id="D36", sev="futebol", fase="F3", estado="aberto",
      titulo="Nao existe corrida cronometrada contra a linha — impedimento nao tem sincronia para errar",
      locais=[dict(arquivo=MOTOR, linha=3203,
                   ancora="p._breaking = { t: 1.4, dir: chance(0.5) ? 1 : -1 };"),
              dict(arquivo=MOTOR, linha=1710,
                   ancora="const rxRcv = dir > 0 ? m.x : FL - m.x;"),
              dict(arquivo=MOTOR, linha=3347,
                   ancora="const onsideCap = Math.max(ballProg - 0.25, this._offsideLine(tm.side) - 0.25);")],
      evidencia=("`p._breaking` e um TEMPORIZADOR de 1,4 s. Ele nao consulta onde a linha "
                 "defensiva esta, nao sabe quando o passe vai sair e nao e cancelado se o "
                 "portador demora. Impedimento e erro de SINCRONIA entre a corrida e o passe, "
                 "e nao ha sincronia nenhuma para errar. Medido: 32,94 arrancadas por partida "
                 "produzem 0,91 impedimento. Tres alavancas varridas em 48 partidas pareadas "
                 "cada, e nenhuma alcanca a faixa 2,5-6,0 do futebol real sem quebrar outra "
                 "coisa: (1) margem do ombro — cinco configuracoes, todas entre 0,88 e 1,06, "
                 "porque quem esta no ombro esta ONSIDE por construcao; (2) duracao da "
                 "arrancada — sobe monotonicamente 0,94/1,17/1,27/1,46/1,71 e chegar a 2,5 "
                 "exigiria 5 a 6 s, que nao e arrancada, e o jogador morando atras da linha; "
                 "(3) custo do impedimento no _bestPass (A1) — solta-lo leva o impedimento a "
                 "2,21 mas TROCA gol por impedimento: gols 2,604 -> 2,167 e chutes 21,42 -> "
                 "19,62, abaixo do piso de design. A A1 nao estava mal calibrada."),
      dono="motor: a criacao em :3203 e o teto em :3347",
      intercepta=["17", "36", "43", "60", "91 (revertida)"],
      criterio=["offsides 2,5-6,0 (ATINGIDO: 3,000)", "shots >=20 (ATINGIDO: 20,120)",
                "goals 2,4-3,2 (FALHOU: 2,323)", "zeroZeroRate <=0,12 (FALHOU: 0,143)"],
      depende=["D19"],
      risco=("CONSTRUIDO, MEDIDO E REVERTIDO. O mecanismo FUNCIONA: o impedimento era avaliado "
             "em `m.x`, a MESMA foto que o _bestPass usa, entao o passador nunca errava. Fazendo "
             "a posicao do receptor avancar com a propria velocidade durante o intervalo de "
             "execucao (0,60 s calibrado), o impedimento vai de 0,910 para 3,000 — dentro da "
             "faixa. E REPROVA assim mesmo: impedimento E ataque perdido, ~0,64 chute cada, e "
             "o jogo ja esta no piso de volume. goals 2,407 -> 2,323 e zeroZeroRate 0,123 -> "
             "0,143; design 11/13 -> 10/13. NAO REFACA sem antes recalibrar o volume ofensivo "
             "(D19): removido o defeito do D35, faltam ~15% dos chutes e ~19% dos gols, e "
             "nenhum dos seis mecanismos testados os recupera. Medicao em "
             "reports/d36-tentativa-reprovada.json."),
      laudo="reports/D36-o-impedimento-de-tempo.md"),

 dict(id="D35", sev="estrutural", fase="F2", estado="aberto",
      titulo="A marca de arrancada que nunca sai — e o VOLUME DO JOGO esta apoiado nela",
      locais=[dict(arquivo=L+"17-cds-r13-football-observer-cadence.js", linha=295,
                   ancora="taker._breaking=taker._breaking||{throwInDuty:true};"),
              dict(arquivo=MOTOR, linha=1345,
                   ancora="if (margem > -1.2) penaImped = clamp(0.85 + margem * 0.62, 0, 3.1)"),
              dict(arquivo=MOTOR, linha=3208,
                   ancora="if (p._breaking) { p._breaking.t -= this._stepDt || 1 / 60; if (p._breaking.t <= 0) p._breaking = null; }")],
      evidencia=("a camada 17 armava o cobrador com {throwInDuty:true}, sem `t` e sem `dir`. "
                 "`undefined - dt` e NaN e `NaN <= 0` e FALSO, entao a marca nunca era apagada. "
                 "Medido em 16 partidas: 6,19 dos 20 jogadores de linha terminavam a partida "
                 "envenenados, contagio medio aos 36,6 min, 20,4% dos quadros de jogador. As "
                 "arrancadas legitimas eram 3.402 contra 174.719 quadros envenenados (51x). "
                 "`ty = clamp(ty + undefined*9, ...)` deixava 18,6% das chamadas de "
                 "_attackTarget com alvo LATERAL NaN e 902.014 chegavam assim ao _integrate. "
                 "O envenenado ficava ainda 16 m a frente da bola, ISENTO DO TETO DE "
                 "IMPEDIMENTO, fora da suavizacao de reacao, com +2,4 no _bestPass e impedido "
                 "de iniciar uma arrancada de verdade."),
      dono="camada 17 (R13) arma; motor le em 8 pontos",
      intercepta=["17"],
      criterio=["nenhum ty NaN chegando ao _integrate",
                "offsides 2,5-6,0 (a faixa do proprio projeto, nao os 4-8 que eu escrevi de cabeca)",
                "shots >=20", "goals 2,4-3,2", "zeroZeroRate <=0,12"],
      depende=["D36"],
      risco=("ALTO. NAO CONSERTE SOZINHO — ja foi tentado e REPROVOU. O conserto e "
             "trivialmente correto (`{t:1.4,dir:0,until}` + varredura, e as invariantes "
             "passam: 220.103 alvos NaN -> 0) e mesmo assim derruba o jogo, porque o "
             "VOLUME esta apoiado no defeito: os ~6 jogadores envenenados por partida "
             "ficavam ISENTOS DO TETO DE IMPEDIMENTO e 16 m a frente da bola. "
             "Medido em 300 partidas pareadas: offsides 5,167 -> 1,043; shots 23,71 -> "
             "19,99; goals 2,877 -> 2,380; xg 3,013 -> 2,483; corners 11,34 -> 9,29; "
             "zeroZeroRate 0,080 -> 0,167 (4,03 SE). Placar de design 12/13 -> 9/13. "
             "O par correto e: consertar o defeito E dar aos atacantes um motivo "
             "LEGITIMO de atacar as costas da linha, na mesma rodada — e a unica "
             "excecao conhecida a armadilha B5. Medicao em "
             "reports/d35-tentativa-reprovada.json."),
      laudo="reports/D35-a-marca-que-nunca-sai.md"),
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
        "leia_antes_de_consertar": ("Volume VIII-A · quatro premissas cairam na fase F1 porque as "
            "sondas originais mediram o codigo do motor, e o motor nao e o que roda. Antes de "
            "consertar um ramo especifico, escreva uma sonda de 40 linhas que conte AQUELE ramo. "
            "Modelos: tools/fisica/ramo-d25.js, ramo-g20.js, ramo-rolagem.js, ramo-d02.js."),
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
