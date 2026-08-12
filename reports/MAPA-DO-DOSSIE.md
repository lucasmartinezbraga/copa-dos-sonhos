# MAPA DO DOSSIÊ — onde está cada coisa

Índice completo. Cada linha diz **o que é**, **onde está** e **quando você**
**precisa dela**.
---

## Se você tem 2 minutos

| quero… | abra |
|---|---|
| saber onde o projeto está | `01-comece-aqui/ESTADO.md` |
| ler o relatório | `02-relatorio/COPA-DOS-SONHOS-investigacao.pdf` |
| só ver os gráficos | `03-graficos/png/` |
| entregar para uma IA | `01-comece-aqui/COLE-ISTO.txt` + este zip |
| jogar | `07-jogo/COPA DOS SONHOS - R19.09.html` |
| mexer no código | `08-codigo-fonte/` ou o repositório |

---

## Os 34 defeitos — onde cada um mora no CÓDIGO

`arquivo:linha` é onde estava na análise; a **âncora** em `04-dados/defeitos.json`
não envelhece — e `tools/defeitos.py` falha se ela deixar de apontar certo.

| # | fase | | defeito | onde no código |
|---|---|---|---|---|
| **D28** | F0 | ✅ | deadBallRecovery: delta de 0,02 move o placar de design  | `20-core.js:572` |
| **D01** | F1 |  | Duas fisicas de bola convivem (g=20 no core, g=9,81 na c | `40-match-engine-and-manager-ai.js:2210`<br>`40-match-engine-and-manager-ai.js:2289` |
| **D02** | F1 |  | _contestLoose entrega a bola sem teto de distancia | `40-match-engine-and-manager-ai.js:2333` |
| **D03** | F1 | ✅ | ~190 linhas mortas guardadas por return antecipado dentr | `40-match-engine-and-manager-ai.js:378`<br>`40-match-engine-and-manager-ai.js:1973` |
| **D04** | F1 | ✅ | _looseBall do core esta morto e nao parece | `40-match-engine-and-manager-ai.js:2321`<br>`08-cds-p04-physical-reception-584-r6.js:767` |
| **D25** | F1 | ✅ | _ballTravel isenta 'deflect' de sair do campo, sem justi | `40-match-engine-and-manager-ai.js:2232` |
| **D30** | F1 | ? | Minigame de bola parada desligado desde a R18 | `40-match-engine-and-manager-ai.js:378` |
| **D32** | F1 | ✅ | Armadilha de escopo: CAL nao existe dentro de uma camada | `20-core.js:518`<br>`66-cds-os39-block-on-flight.js:15` |
| **D08** | F2 |  | Laterais pela metade — a direcao do desvio e sempre para | `40-match-engine-and-manager-ai.js:2622` |
| **D09** | F2 |  | O portao naturalTarget da camada 45 quase nunca dispara | `45-cds-r18181-second-phase-natural-out.js:135` |
| **D12** | F2 |  | Sorteio censurado 2: r13 manda a bola para fora a 64% e  | `17-cds-r13-football-observer-cadence.js:206`<br>`40-match-engine-and-manager-ai.js:2321` |
| **D29** | F2 |  | Duas faixas de design conflitantes para escanteios no me | `20-core.js:643` |
| **D11** | F3 |  | Sorteio censurado 1: r12 sorteia o chute contextual, r18 | `16-cds-r12-transactional-core-r123.js:153`<br>`20-cds-r183-natural-football.js:86` |
| **D13** | F3 |  | Sorteio censurado 3: erro de chute sorteado ate 6,5 m e  | `55-cds-r1821-shot-plausibility.js:72` |
| **D10** | F4 | ◐ | O orcamento de posse mora em duas linhas que nao se conh | `40-match-engine-and-manager-ai.js:2383`<br>`40-match-engine-and-manager-ai.js:2417` |
| **D14** | F4 |  | Sete contencoes em step consertam bugs que nunca foram p | `84-cds-r1899-antiteleporte.js:43`<br>`75-cds-os83-restart-watchdog.js:15` |
| **D15** | F4 |  | 255 linhas de antiteleporte contendo um bug nunca diagno | `84-cds-r1899-antiteleporte.js:43` |
| **D26** | F4 |  | decideT escrito em tres lugares e reescrito todo quadro  | `40-match-engine-and-manager-ai.js:491`<br>`40-match-engine-and-manager-ai.js:2417` |
| **D33** | F4 |  | Treze arquivos, 81 linhas, que so publicam numero de ver | `59-cds-r1821rc1-build-meta.js:?` |
| **D34** | F4 |  | Ate 81 sobrescritas nunca alcancadas — TETO SUPERIOR, na | *distribuído* |
| **D16** | F5 |  | Quatro camadas falsificam _breaking/_markRef porque falt | `71-cds-os51-beaten-defender.js:21`<br>`23-cds-r185-bloco-defensivo.js:51` |
| **D17** | F5 |  | Promover para o core os metodos cuja camada e TERMINAL | `40-match-engine-and-manager-ai.js:3028`<br>`07-cds-physics-timeline-581.js:33` |
| **D18** | F5 |  | _cross tem 255 linhas e nove correcoes embutidas | `40-match-engine-and-manager-ai.js:981` |
| **D19** | F6 |  | A partida murcha: 20,0% dos gols ate 15', 14,1% apos 76' | `20-core.js:564` |
| **D20** | F6 |  | O bloco nao compacta ao perder a bola (encurta 0,4 m; re | `40-match-engine-and-manager-ai.js:3028` |
| **D21** | F6 | ? | clockRate: 23 min de fisica para 90 de partida — decisao | `20-core.js:564` |
| **D22** | F6 |  | Acerto ao alvo 0,326 abaixo do minimo de design 0,34 (un | `20-core.js:615` |
| **D24** | F6 |  | Tarja preta ocupa 24% a 43% da caixa do campo | `70-game-runtime-and-rendering.js:1300` |
| **D05** | — | ✅ | Passe rasteiro decolava (14 cm de salto, 2 quiques) | `88-os200-balistica-real.js:347` |
| **D06** | — | ✅ | Goleiro mergulhava no primeiro instante alcancavel (folg | `88-os200-balistica-real.js:730` |
| **D07** | — | ✅ | _bestPass tinha 25+ termos e nenhum era a linha de imped | `40-match-engine-and-manager-ai.js:1325` |
| **D23** | — | 🛡 | Distribuicao de placares — saudavel, serve de guarda-cor | *distribuído* |
| **D27** | — | 🛡 | Faltas nao saem de foulBase, saem do numero de duelos | `20-core.js:598` |
| **D31** | pos-F5 | ⏸ | A IA de treinador mora dentro do modulo do motor (~1.100 | `40-match-engine-and-manager-ai.js:4224` |

---

## Onde está cada arquivo do jogo

| arquivo | o que é | defeitos |
|---|---|---|
| `src/scripts/40-match-engine-and-manager-ai.js` | **o motor de partida** (5.086 linhas) + IA de treinador | D01, D02, D03, D04, D07, D08, D10, D12, D17, D18, D20, D25, D26, D30, D31 |
| `src/scripts/20-core.js` | calibração `ENGINE_CALIBRATION`, utilidades, RNG | D19, D21, D22, D27, D28, D29, D32 |
| `src/scripts/layers/88-os200-balistica-real.js` | camada | D05, D06 |
| `src/scripts/layers/84-cds-r1899-antiteleporte.js` | camada | D14, D15 |
| `src/scripts/layers/08-cds-p04-physical-reception-584-r6.js` | camada | D04 |
| `src/scripts/layers/45-cds-r18181-second-phase-natural-out.js` | camada | D09 |
| `src/scripts/layers/16-cds-r12-transactional-core-r123.js` | camada | D11 |
| `src/scripts/layers/20-cds-r183-natural-football.js` | camada | D11 |
| `src/scripts/layers/17-cds-r13-football-observer-cadence.js` | camada | D12 |
| `src/scripts/layers/55-cds-r1821-shot-plausibility.js` | camada | D13 |
| `src/scripts/layers/75-cds-os83-restart-watchdog.js` | camada | D14 |
| `src/scripts/layers/71-cds-os51-beaten-defender.js` | camada | D16 |
| `src/scripts/layers/23-cds-r185-bloco-defensivo.js` | camada | D16 |
| `src/scripts/layers/07-cds-physics-timeline-581.js` | camada | D17 |
| `src/scripts/70-game-runtime-and-rendering.js` | runtime, desenho, narração | D24 |
| `src/scripts/layers/66-cds-os39-block-on-flight.js` | camada | D32 |
| `src/scripts/layers/59-cds-r1821rc1-build-meta.js` | camada | D33 |

---

## As ferramentas — qual pergunta cada uma responde

| ferramenta | responde | custo |
|---|---|---|
| `doutor.sh` | o ambiente está pronto? | 5 s |
| `defeito.py D08` | **um defeito: ficha + código atual + seção** | instantâneo |
| `defeito.py --proximo` | o que fazer agora | instantâneo |
| `defeitos.py` | valida que os endereços ainda apontam certo | 2 s |
| `aceitar.sh --antes/--depois` | **a mudança entra ou não** | ~25 min (4 núcleos) |
| `comparar.py` | aplica o critério de 2 SE | instantâneo |
| `fisica/bateria.js` | as 14 métricas + sondas de física | ~20 min / 300 partidas |
| `fisica/placar.py` | 13 métricas de design | instantâneo |
| `fisica/futebol_real.py` | 21 métricas de futebol de elite | instantâneo |
| `fisica/pilha.js` | **quais sobrescritas rodam** (método, não linha) | ~40 s |
| `fisica/ramo-d25.js` | **uma LINHA específica é alcançada?** | ~2 min |
| `fisica/narrar.js` | a partida em prosa de futebol | ~5 s |
| `fisica/direcao.js` | para onde a bola é mandada | ~2 min |
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
| G4 | forma do bloco | encurta 0,4 m ao perder a bola (real 8–10) | D20 |
| G5 | funil da finalização | as 3 taxas derivadas estão na faixa | — |
| G6 | evolução do placar | os 2 maiores saltos vieram de 1 linha cada | — |
| G7 | defeitos por fase | o mapa dos 34 | todos |
| G8 | placares | distribuição saudável — guarda-corpo | D23 |

---

## Os dados

| arquivo | o que é |
|---|---|
| `defeitos.json` | **os 34 defeitos legíveis por máquina**, com âncoras e seções |
| `targets.json` | as 13 faixas de design — o alvo do placar 12/13 |
| `sensibilidade.json` | **10 constantes com o delta MEDIDO de cada uma** (D28) |
| `REFERENCIA.json` | a linha de base atual: 300 partidas do estado commitado |
| `pilha-estado.json` | quais das 362 sobrescritas rodam |
| `build-manifest.json` | a ORDEM das 89 camadas |
| `a2-goleiro-n300.json` | 300 partidas, partida a partida |
| `direcao-desvios.json` | a sonda dos laterais |
| `d25-sonda-ramo.json` | **a sonda que provou que o ramo do D25 não é alcançado** |
| `historico/` | 9 medições, da OS-200 até a A1 |

---

## Os laudos

| laudo | o que aconteceu |
|---|---|
| `OS-200` | a integração numérica entrou |
| `OS-201` | clockRate 0,13 → 0,085 |
| `OS-202` | o marcador corta o ângulo |
| `OS-203` | o passe rasteiro parou de quicar |
| `OS-204` | o segundo placar nasceu — 21 métricas |
| `OS-205` | o narrador |
| `OS-206` | posse 0,43 → 1,03 s |
| `A1` | **aceito** · impedimentos 10,03 → 5,11 |
| `A2` | **aceito** · design 11/13 → 12/13 |
| `A3` | **REVERTIDO** pelo próprio critério |
| `A4` | **REVERTIDO** · o ramo editado não rodava |
| `PLANO-v3`/`v4` | os dez padrões de composição |

---

## O que a execução mediu — leia antes de confiar numa seção

| defeito | veredito da medição |
|---|---|
| D01, D02, D25, D08 | **quatro premissas caíram** na primeira rodada |
| D11, D13 | ✅ confirmados — e **maiores** do que o texto dizia |
| D26 | ✅ confirmado, descrição intacta |
| D12, D16 | ⚠ formulação corrigida |
| D15 | ⛔ não mensurável — a camada não publica contador |

Os defeitos medidos por **agregado** (D19, D20, D22, D24) não dependem de qual
linha executa e seguem válidos. Os formulados por **leitura de código** foram
todos remedidos, e a seção 8A.4 do relatório traz o resultado de cada um.

## A regra que mais quebra trabalho aqui

```bash
node tools/fisica/pilha.js dist/index.html 14
```

**362 sobrescritas** em 60 camadas. Uma camada pode substituir um método e
**não chamar a de baixo**. Editar o motor e nada acontecer já ocorreu **seis**
vezes.

> **E a ferramenta tem limite.** Na sexta (D25) ela respondeu VIVA e estava
> **certa** — o método rodava, a linha editada não. **VIVA é propriedade do**
> **método, não de cada linha dele.** Quando o alvo é uma linha, instrumente
> aquela linha: `tools/fisica/ramo-d25.js` é o modelo, 40 linhas, 2 minutos.
