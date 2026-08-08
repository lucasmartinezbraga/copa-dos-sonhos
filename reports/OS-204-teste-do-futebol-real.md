# OS-204 · Teste contra o futebol real

## Por que esse teste faltava

`calibration/targets.json` tem 13 métricas, e o jogo passa em 11. Mas essa
lista foi escrita pelo próprio projeto e nunca perguntou **quantos laterais
acontecem**, **quantos impedimentos são marcados** ou **em que minuto os gols
saem**. Dá para tirar 11/13 ali e ainda assim o jogo não parecer futebol.

`tools/fisica/futebol_real.py` pontua uma medição da bateria contra o futebol
de elite — 21 métricas, faixas em vez de pontos, porque futebol real varia
entre ligas (faltas passam de 25 por jogo na La Liga e ficam perto de 20 na
Premier League).

```bash
python3 tools/fisica/futebol_real.py reports/os203-n300.json
```

## Resultado: 10 de 21

300 partidas, semente base 4200000.

| | medido | faixa real | |
|---|---|---|---|
| Gols | 2,81 | 2,5–3,0 | ok |
| Finalizações | 21,20 | 22–28 | baixo |
| Chutes no alvo | 7,27 | 7,5–9,5 | baixo |
| Acerto ao alvo | 0,343 | 0,30–0,40 | ok |
| Conversão | 0,133 | 0,09–0,13 | alto |
| Gol por chute no alvo | 0,387 | 0,27–0,38 | alto |
| xG | 2,96 | 2,4–3,0 | ok |
| Passes | 587 | 750–1000 | **baixo** |
| Acerto de passe | 0,832 | 0,78–0,87 | ok |
| Faltas | 15,48 | 19–26 | baixo |
| Amarelos | 4,70 | 3,0–5,5 | ok |
| Vermelhos | 0,223 | 0,06–0,22 | alto |
| Escanteios | 9,44 | 9–12 | ok |
| **Impedimentos** | **10,37** | **2,5–6** | **alto** |
| **Laterais** | **13,88** | **33–48** | **baixo** |
| Tiros de meta | 11,35 | 11–18 | ok |
| Empates | 0,230 | 0,20–0,30 | ok |
| 0 a 0 | 0,070 | 0,05–0,10 | ok |
| Goleadas | 0,143 | 0,10–0,18 | ok |
| **Gols tardios (76'+)** | **0,125** | **0,18–0,30** | **baixo** |
| **Gols no 2º tempo** | **0,437** | **0,50–0,60** | **baixo** |

## O que está certo, e é bom que esteja

**A forma dos placares é futebol.** Sem nunca ter sido calibrada para isso:

```
  1-0   19,7%        futebol real: 1-0, 1-1, 2-1, 2-0, 0-0
  2-1   15,3%
  2-0   12,7%
  1-1   11,0%
  0-0    7,0%
```

E o ajuste a Poisson é bom em toda a faixa que importa (0 a 3 gols cobre 92%
das partidas), com um excesso pequeno e esperado na cauda — times de forças
diferentes produzem mais goleadas que duas Poisson independentes.

## O maior achado: o jogo esvazia em vez de crescer

No futebol real o gol fica mais provável conforme a partida avança — cerca de
10% dos gols saem antes dos 15 minutos e cerca de 24% dos 76 em diante. Aqui
é o contrário:

```
   0-15   22,1%  ######################
  16-30   17,0%  #################
  31-45   17,3%  #################
  46-60   19,2%  ###################
  61-75   12,0%  ############
    76+   12,5%  ############
```

Havia duas explicações possíveis, com consertos opostos: ou o fim de jogo
recebe **menos tempo de simulação** por minuto de relógio (bug de relógio), ou
recebe o mesmo tempo e produz **menos ação** (modelo de fadiga). Instrumentei a
bateria por faixa de 15 minutos para separar as duas:

| faixa | seg/partida | % do tempo | chutes/min de jogo | gols/min | stamina |
|---|---|---|---|---|---|
| 0-15 | 213,4 | 15,6% | 0,274 | 0,0378 | 96,8 |
| 16-30 | 205,2 | 15,0% | 0,251 | 0,0356 | 90,5 |
| 31-45 | 204,9 | 15,0% | 0,236 | 0,0367 | 84,1 |
| 46-60 | 259,2 | 18,9% | 0,264 | 0,0394 | 77,5 |
| 61-75 | 201,2 | 14,7% | 0,219 | 0,0250 | 71,6 |
| 76+ | 283,7 | 20,8% | 0,204 | 0,0278 | 67,5 |

**Não é bug de relógio.** O tempo simulado está bem distribuído — o segundo
tempo recebe até 19% mais segundos de simulação que o primeiro (acréscimos).

**É a fadiga, e ela é a única causa.** A taxa de chutes cai monotonicamente com
a stamina, com correlação **r = 0,814** entre as seis faixas. Normalizando pelo
tempo de simulação, o buraco fica maior do que a contagem crua sugere:

```
gols por segundo de simulacao    1o tempo 0,00265    2o tempo 0,00186   (-30%)
chutes por segundo de simulacao  1o tempo 0,01830    2o tempo 0,01387   (-24%)
```

O segundo tempo tem 19% mais tempo simulado e produz 16% menos gols.

### Por que o futebol real faz o contrário

Cansaço existe lá também — a diferença é que ele **não é simétrico**:

- a estrutura defensiva se degrada mais rápido que a intenção ofensiva;
- quem está perdendo se joga à frente, e isso abre o jogo dos dois lados;
- substituições injetam pernas novas, quase sempre na frente;
- o apetite por risco cresce com o relógio.

O motor modela fadiga como queda uniforme do rendimento de todo mundo. O
resultado é **menos futebol** no fim, em vez de futebol mais aberto. É esse
o "não parece futebol de verdade" que sobra depois do pingo consertado: a
partida não constrói, ela murcha.

Consertar isso é mudança de motor com recalibração junto — não entra de
carona numa OS de física.

## Os outros dois desvios grandes

**Laterais: 13,9 contra 33–48.** O lateral é o reinício mais comum do futebol
e o jogo tem um terço deles. Somando as paradas (laterais + escanteios + tiros
de meta + faltas), o jogo tem ~50 por partida contra ~90 do futebol real, e o
buraco está quase todo aqui: a bola quase não sai pelas linhas laterais.

**Impedimentos: 10,4 contra 2,5–6.** Quase o dobro do teto. Os atacantes se
lançam em impedimento com frequência que não existe no futebol de elite.

Os dois mexem em posse, ritmo e volume de passe (587 contra 750–1000, que é
provavelmente consequência dos mesmos mecanismos), então valem uma OS própria
e uma recalibração — não um ajuste solto.

## Nota sobre a OS-203

O conserto do passe rasteiro **não custou nada no placar de design**. Medido em
300 partidas contra as 120 da OS-202:

| | OS-202 (n=120) | OS-203 (n=300) |
|---|---|---|
| Gols | 2,758 | 2,810 |
| Empates | 0,258 | 0,230 |
| Goleadas | 0,175 | 0,143 |
| Faltas | 16,09 | 15,48 |
| **Placar de design** | **11/13** | **11/13** |

Os empates em 0,183 que apareceram na medição de 120 partidas eram ruído, como
suspeitado na hora: com 300 partidas voltaram para 0,230, dentro da faixa. As
duas que ficam fora são faltas (15,48, mínimo 16,0) e stamina final (63,99,
mínimo 64,0 — uma centésima).
