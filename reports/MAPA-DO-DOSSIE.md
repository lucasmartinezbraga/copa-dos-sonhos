# MAPA DO DOSSIÊ — onde está cada coisa

Índice completo do pacote. Cada linha diz **o que é**, **onde está** e
**quando você precisa dela**.
---

## Se você tem 2 minutos

| quero… | abra |
|---|---|
| saber onde o projeto está | `01-comece-aqui/ESTADO.md` |
| ler o relatório | `02-relatorio/COPA-DOS-SONHOS-investigacao.pdf` |
| só ver os gráficos | `03-graficos/png/` |
| entregar para uma IA | `01-comece-aqui/COLE-ISTO.txt` + este zip |
| jogar o jogo | `07-jogo/COPA DOS SONHOS - R19.09.html` |
| mexer no código | `08-codigo-fonte/` ou o repositório |

---

## Os 34 defeitos — onde cada um mora no CÓDIGO

Ordenado por fase. `arquivo:linha` é onde estava na análise; a **âncora**
em `04-dados/defeitos.json` não envelhece.

| # | fase | estado | defeito | onde no código |
|---|---|---|---|---|
| **D28** | F0 |  | deadBallRecovery: delta de 0,02 move o placar de design em | `20-core.js:572` |
| **D01** | F1 |  | Duas fisicas de bola convivem (g=20 no core, g=9,81 na cam | `40-match-engine-and-manager-ai.js:2396`<br>`40-match-engine-and-manager-ai.js:2475` |
| **D02** | F1 |  | _contestLoose entrega a bola sem teto de distancia | `40-match-engine-and-manager-ai.js:2519` |
| **D03** | F1 |  | ~190 linhas mortas guardadas por return antecipado dentro  | `40-match-engine-and-manager-ai.js:369`<br>`40-match-engine-and-manager-ai.js:2020` |
| **D04** | F1 | ✅ | _looseBall do core esta morto e nao parece | `40-match-engine-and-manager-ai.js:2507`<br>`08-cds-p04-physical-reception-584-r6.js:767` |
| **D25** | F1 | ✅ | _ballTravel isenta 'deflect' de sair do campo, sem justifi | `40-match-engine-and-manager-ai.js:2418` |
| **D30** | F1 | ? | Minigame de bola parada desligado desde a R18 | `40-match-engine-and-manager-ai.js:369` |
| **D32** | F1 | ✅ | Armadilha de escopo: CAL nao existe dentro de uma camada | `20-core.js:518`<br>`66-cds-os39-block-on-flight.js:15` |
| **D08** | F2 |  | Laterais pela metade — a direcao do desvio e sempre para d | `40-match-engine-and-manager-ai.js:1240`<br>`40-match-engine-and-manager-ai.js:2808` |
| **D09** | F2 |  | O portao naturalTarget da camada 45 quase nunca dispara | `45-cds-r18181-second-phase-natural-out.js:135` |
| **D12** | F2 |  | Sorteio censurado 2: r13 manda a bola para fora a 64% e o  | `17-cds-r13-football-observer-cadence.js:206`<br>`40-match-engine-and-manager-ai.js:2507` |
| **D29** | F2 |  | Duas faixas de design conflitantes para escanteios no mesm | `20-core.js:643` |
| **D11** | F3 |  | Sorteio censurado 1: r12 sorteia o chute contextual, r183  | `16-cds-r12-transactional-core-r123.js:153`<br>`20-cds-r183-natural-football.js:86` |
| **D13** | F3 |  | Sorteio censurado 3: erro de chute sorteado ate 6,5 m e co | `55-cds-r1821-shot-plausibility.js:72` |
| **D10** | F4 | ◐ | O orcamento de posse mora em duas linhas que nao se conhec | `40-match-engine-and-manager-ai.js:2569`<br>`40-match-engine-and-manager-ai.js:2603` |
| **D14** | F4 |  | Sete contencoes em step consertam bugs que nunca foram pro | `84-cds-r1899-antiteleporte.js:43`<br>`75-cds-os83-restart-watchdog.js:15` |
| **D15** | F4 |  | 255 linhas de antiteleporte contendo um bug nunca diagnost | `84-cds-r1899-antiteleporte.js:43` |
| **D26** | F4 |  | decideT escrito em tres lugares e reescrito todo quadro pe | `40-match-engine-and-manager-ai.js:503`<br>`40-match-engine-and-manager-ai.js:2603` |
| **D33** | F4 |  | Treze arquivos, 81 linhas, que so publicam numero de versa | `59-cds-r1821rc1-build-meta.js:?` |
| **D34** | F4 |  | Ate 81 sobrescritas nunca alcancadas — TETO SUPERIOR, nao  | *distribuído* |
| **D16** | F5 |  | Quatro camadas falsificam _breaking/_markRef porque falta  | `71-cds-os51-beaten-defender.js:21`<br>`23-cds-r185-bloco-defensivo.js:51` |
| **D17** | F5 |  | Promover para o core os metodos cuja camada e TERMINAL | `40-match-engine-and-manager-ai.js:3214`<br>`07-cds-physics-timeline-581.js:33` |
| **D18** | F5 |  | _cross tem 255 linhas e nove correcoes embutidas | `40-match-engine-and-manager-ai.js:993` |
| **D19** | F6 |  | A partida murcha: 20,0% dos gols ate 15', 14,1% apos 76' | `20-core.js:564` |
| **D20** | F6 |  | O bloco nao compacta ao perder a bola (encurta 0,4 m; real | `40-match-engine-and-manager-ai.js:3214` |
| **D21** | F6 | ? | clockRate: 23 min de fisica para 90 de partida — decisao d | `20-core.js:564` |
| **D22** | F6 |  | Acerto ao alvo 0,326 abaixo do minimo de design 0,34 (unic | `20-core.js:615` |
| **D24** | F6 |  | Tarja preta ocupa 24% a 43% da caixa do campo | `70-game-runtime-and-rendering.js:1300` |
| **D05** | — | ✅ | Passe rasteiro decolava (14 cm de salto, 2 quiques) | `88-os200-balistica-real.js:347` |
| **D06** | — | ✅ | Goleiro mergulhava no primeiro instante alcancavel (folga  | `88-os200-balistica-real.js:730` |
| **D07** | — | ✅ | _bestPass tinha 25+ termos e nenhum era a linha de impedim | `40-match-engine-and-manager-ai.js:1379` |
| **D23** | — | 🛡 | Distribuicao de placares — saudavel, serve de guarda-corpo | *distribuído* |
| **D27** | — | 🛡 | Faltas nao saem de foulBase, saem do numero de duelos | `20-core.js:598` |
| **D31** | pos-F5 | ⏸ | A IA de treinador mora dentro do modulo do motor (~1.100 l | `40-match-engine-and-manager-ai.js:4410` |

---

## Onde está cada arquivo do jogo

| arquivo | linhas | o que é | defeitos que moram nele |
|---|---|---|---|
| `src/scripts/40-match-engine-and-manager-ai.js` | 5.262 | **o motor de partida** + IA de treinador | D01, D02, D03, D04, D07, D08, D10, D12, D17, D18, D20, D25, D26, D30, D31 |
| `src/scripts/20-core.js` | 1.550 | calibração `ENGINE_CALIBRATION`, utilidades, RNG | D19, D21, D22, D27, D28, D29, D32 |
| `src/scripts/layers/88-os200-balistica-real.js` | — | camada | D05, D06 |
| `src/scripts/layers/84-cds-r1899-antiteleporte.js` | — | camada | D14, D15 |
| `src/scripts/layers/08-cds-p04-physical-reception-584-r6.js` | — | camada | D04 |
| `src/scripts/layers/45-cds-r18181-second-phase-natural-out.js` | — | camada | D09 |
| `src/scripts/layers/16-cds-r12-transactional-core-r123.js` | — | camada | D11 |
| `src/scripts/layers/20-cds-r183-natural-football.js` | — | camada | D11 |
| `src/scripts/layers/17-cds-r13-football-observer-cadence.js` | — | camada | D12 |
| `src/scripts/layers/55-cds-r1821-shot-plausibility.js` | — | camada | D13 |
| `src/scripts/layers/75-cds-os83-restart-watchdog.js` | — | camada | D14 |
| `src/scripts/layers/71-cds-os51-beaten-defender.js` | — | camada | D16 |
| `src/scripts/layers/23-cds-r185-bloco-defensivo.js` | — | camada | D16 |
| `src/scripts/layers/07-cds-physics-timeline-581.js` | — | camada | D17 |
| `src/scripts/70-game-runtime-and-rendering.js` | 4.039 | runtime, desenho, narração | D24 |
| `src/scripts/layers/66-cds-os39-block-on-flight.js` | — | camada | D32 |
| `src/scripts/layers/59-cds-r1821rc1-build-meta.js` | — | camada | D33 |

---

## As ferramentas — qual pergunta cada uma responde

| ferramenta | responde | custo |
|---|---|---|
| `doutor.sh` | o ambiente está pronto? | 5 s |
| `defeito.py D08` | **um defeito: ficha + código atual + seção** | instantâneo |
| `defeito.py --proximo` | o que fazer agora | instantâneo |
| `defeitos.py` | valida que os endereços ainda apontam certo | 2 s |
| `aceitar.sh --antes/--depois` | **a mudança entra ou não** | ~30 min (4 núcleos) |
| `comparar.py` | aplica o critério de 2 SE | instantâneo |
| `fisica/bateria.js` | as 14 métricas + sondas de física | ~25 min / 300 partidas |
| `fisica/placar.py` | 13 métricas de design | instantâneo |
| `fisica/futebol_real.py` | 21 métricas de futebol de elite | instantâneo |
| `fisica/pilha.js` | **quais sobrescritas rodam** | ~40 s |
| `fisica/narrar.js` | a partida em prosa de futebol | ~5 s |
| `fisica/direcao.js` | para onde a bola é mandada | ~2 min |
| `fisica/ramo-d25.js` | um ramo específico é alcançado? | ~2 min |
| `fisica/tela/pinga.js` | a bola quica na tela? | ~1 min |
| `fisica/tela/forma.js` | bloco, largura, apoio | ~2 min |
| `fisica/tela/caixa.js` | tarja preta, 4 resoluções | ~2 min |
| `dossie/graficos.py` | gera os 8 gráficos | 3 s |
| `dossie/pdf.py` + `imprimir.js` | gera o PDF | ~40 s |

---

## Os gráficos e o que cada um prova

| # | gráfico | prova | defeito |
|---|---|---|---|
| G1 | gols por faixa | a partida murcha: 20,0% até 15', 14,8% após 76' | D19 |
| G2 | direção do desvio | 85,8% dos alvos a mais de 8 m da lateral | D08 |
| G3 | reinícios | o buraco é inteiro dos laterais | D08 |
| G4 | forma do bloco | encurta 0,4 m ao perder a bola (real 8–10 m) | D20 |
| G5 | funil da finalização | as 3 taxas derivadas estão na faixa | — |
| G6 | evolução do placar | os 2 maiores saltos vieram de 1 linha cada | — |
| G7 | defeitos por fase | o mapa dos 34 | todos |
| G8 | placares | distribuição saudável — serve de guarda-corpo | D23 |

---

## Os dados — o que cada arquivo contém

| arquivo | o que é |
|---|---|
| `defeitos.json` | **os 34 defeitos legíveis por máquina**, com âncoras e seções |
| `targets.json` | as 13 faixas de design — o alvo do placar 12/13 |
| `REFERENCIA.json` | a linha de base atual: 300 partidas do estado commitado |
| `pilha-estado.json` | quais das 362 sobrescritas rodam, com contagem de chamadas |
| `build-manifest.json` | a ORDEM das 89 camadas — a de número maior roda por fora |
| `a2-goleiro-n300.json` | 300 partidas, partida a partida, com sequência de gols |
| `direcao-desvios.json` | a sonda que fechou o diagnóstico dos laterais |
| `d25-sonda-ramo.json` | a sonda que provou que o ramo do D25 não é alcançado |
| `historico/` | 9 medições, da OS-200 até a A1 — a curva do placar |

---

## Os laudos — a história de cada mudança

| laudo | o que aconteceu |
|---|---|
| `OS-200-fisica-da-bola.md` | a integração numérica entrou |
| `OS-201-relogio-e-fadiga.md` | clockRate 0,13 → 0,085; fadiga desacoplada |
| `OS-202-perseguicao-e-ritmo.md` | o marcador corta o ângulo; botões de velocidade |
| `OS-203-a-bola-para-de-pingar.md` | o passe rasteiro parou de quicar |
| `OS-204-teste-do-futebol-real.md` | o segundo placar nasceu — 21 métricas |
| `OS-205-ler-a-partida.md` | o narrador |
| `OS-206-o-portador-tem-um-plano.md` | posse 0,43 → 1,03 s |
| `A1-o-passador-ve-o-impedimento.md` | **aceito** · impedimentos 10,03 → 5,11 |
| `A2-o-goleiro-escolhe-onde-mergulha.md` | **aceito** · design 11/13 → 12/13 |
| `A3-tentativa-revertida.md` | **REVERTIDO** pelo próprio critério de aceite |
| `A4-tentativa-revertida.md` | **REVERTIDO** · o ramo editado não rodava |
| `PLANO-v3` / `PLANO-v4` | os cinco padrões de composição, e os dez |

---

## A regra que mais quebra trabalho aqui

```bash
node tools/fisica/pilha.js dist/index.html 14
```

São **362 sobrescritas** em 60 camadas empilhadas sobre `MatchSim.prototype`.
Uma camada pode substituir um método e **não chamar a versão de baixo**.

Editar o motor e nada acontecer já ocorreu **seis vezes**. A sexta foi o D25,
e ela ensinou o limite da ferramenta: `pilha.js` disse VIVA para as quatro
sobrescritas de `_ballTravel` e estava **certa** — elas chamam a de baixo.
O que ela não responde é se **uma linha específica** dentro do método é
alcançada. **VIVA é propriedade do método, não de cada linha dele.**
