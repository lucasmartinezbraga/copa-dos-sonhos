# RODADA OS-38 / OS-39 — o escanteio entra na faixa, e por que a OS-38 errou o lugar

Esta é a terceira investida contra a **OS-05** (escanteios em 1,1 contra a faixa
ECO-05 de 4–10). As duas anteriores foram reprovadas por medição e estão
registradas: supressão geométrica (OS-05B) e orçamento de raio (OS-23).

---

## O censo do funil (`diag_os38_corner_funnel.js`, 12 partidas, R18.65)

```
escanteios 4,50/partida
  causa clearance  2,667      causa save  1,000
  causa block      0,333      duelo de area  0,167
```

No futebol real o **chute bloqueado é a maior fonte de escanteio**. Aqui ele
respondia por 7% deles:

```
chutes 17,70/partida     evento blocked 0,33 = 1,9% dos chutes
```

A referência real fica perto de 25%.

### O mecanismo (`:6194`)

O desfecho do chute sai de **uma rolagem** `r2` particionada em fatias:

```
saveCut  = savedShare + ...
blockCut = saveCut + CAL.shooting.blockedShare   // :2766, 0.18
postCut  = blockCut + postShare
```

18% dos chutes são **nomeados** bloqueio por sorteio. Só depois disso o código
procura um defensor na linha; se não houver nenhum a 2,2 m, o lance vira `miss`
com `reason:'no_physical_block'`.

E a geometria diz o contrário (10 partidas, 177 chutes):

```
defensor mais proximo A LINHA do chute
  <1 m 14,7%   1-2 m 8,5%   2-3 m 4,0%   3-4 m 4,5%
  sem defensor no segmento   28,8%
  <= 2,2 m (a porta)         23,2%
```

O defensor está na linha em quase um quarto dos chutes, e a moeda de 18%
descarta 82% desses casos **antes de olhar para o campo**. A ordem está
invertida: quem decide se um chute é bloqueado é o defensor estar no caminho; o
acaso pertence a se ele alcança a bola, não a se ele existe.

---

## OS-38 — REPROVADA por errar o LUGAR

Pus o bloqueio geométrico antes da partição de `_shoot`. Medido:

```
                                          R18.65    OS-38
evento blocked (12 partidas)               0,33      0,83
corners (40 partidas)                      3,13      3,83
```

Subiu, mas muito menos do que a previsão (2 a 3 bloqueios). O censo de execução
mostrou por quê:

```
chutes contados em stats           20,40 /partida
chegam ao ponto da OS-38            4,20   = 21%
com defensor a <= 2,8 m da linha    1,70
```

**79% dos chutes nunca passam por aquela partição.** `header_shot` (6,3/partida),
`low_cross_shot` (4,3), bola parada e o ramo do goleiro inalcançável resolvem em
caminhos próprios. Editar a partição alcança um quinto do jogo. A OS-38 saiu da
cadeia.

---

## OS-39 — o bloqueio onde a bola voa

Todo chute, de qualquer origem, vira um `_startTravel(..., 'shot', ...)`. "Tem
alguém na frente?" é uma pergunta física, e o voo é onde a física existe. A
camada envolve `_startTravel` e procura o defensor mais próximo do **segmento
bola→alvo**:

```
pBlock = clamp(0.90 - ld*0.28, .08, .90)
  ld = 0,0 m -> 0,90    ld = 1,0 m -> 0,62
  ld = 2,0 m -> 0,34    ld = 2,8 m -> 0,12
```

Bloqueando, o voo é redirecionado ao ponto de contato com o desfecho físico que
o motor já usa: `_physicalContactValid`, `_recordVisualContact`, evento
`blocked`, escanteio por `CAL.restarts.shotBlockCorner`. Nasce de contato
defensivo provado, então passa pelas camadas R18.18.2/18.3 em vez de virar
`unprovenCornerCall`.

Não intercepta voos que já são bloqueio ou defesa, nem voos com agente marcado.
**Intercepta de propósito** os voos de gol e de erro — e alcança a cobrança
direta de falta, onde a barreira da OS-36 está plantada na linha. É a barreira
funcionando como barreira.

### Previsão registrada antes de medir

- `blocked`: 0,83 → faixa de 3 a 5 por partida
- **escanteios 3,13: SOBEM** — a previsão que decide a rodada
- gols 3,00: DESCEM
- xG 2,56: DESCE ou fica igual; ECO-02 (≤ 2,7) não pode estourar
- recusa se `blocked` passar de ~35% dos chutes ou se os gols caírem abaixo de 2,0

### Medido — 40 partidas, mesmas sementes

```
                 R18.65    OS-39
corners           3.13      5.80    <- ECO-05 (4-10) CUMPRIDO
goals             3.00      2.33
xg                2.56      2.82    <- ECO-02 (<=2,7) ESTOURADO
shots            21.55     22.35
onTarget          7.58      7.22
penaltiesTaken    0.07      0.15

12 partidas:     blocked   0.33 -> 2.25  (10,8% dos chutes)
                 causa block no funil   0.33 -> 1.42
```

### O que acertei e o que errei

**Escanteios entraram na faixa** — 3,13 → 5,80. É a primeira vez nesta linhagem;
a OS-05 abriu em 1,1. Gols caíram como previsto.

`blocked` ficou em **2,25**, abaixo da faixa de 3 a 5 que registrei. O limite não
é o alcance: **28,8% dos chutes não têm defensor nenhum no segmento**, e alargar
o raio não cria defensor onde não há. Isso é o mesmo buraco do gate de marcação —
os defensores não estão nas linhas de chute. Fica aberto.

**xG subiu para 2,82 e estourou o ECO-02.** Previ que desceria. Errei. A causa é
contábil e é legítima: `stats.xg` é somado no instante do chute, e um chute
bloqueado continua sendo um chute — modelos de xG reais também contam chute
bloqueado. Com mais escanteios vêm mais finalizações de área, com xG por chute
maior (0,119 → 0,126). O que mudou de verdade foi a **razão gol/xG**: 1,17 antes
(mais gols que xG, o que é anômalo) contra **0,83** agora, que é a direção
correta. **Não vou calibrar xG para caber no gate** — seria exatamente a caça a
gate que já discartou a OS-34. O estouro fica registrado.

---

## Gates que não podiam piorar

```
salto por quadro (4 partidas, 1/60)   R18.65   R18.66
  12-18 m/s                            0.451%   0.541%
  > 18 m/s                             0.010%   0.010%
  ACIMA DE 12 m/s                      0.460%   0.551%
  cortes de cena (>3 m)                266      276
```

Sobe um pouco, e a causa é medida: mais escanteios significam mais reinícios, e
reinício é recolocação de posição. A faixa de teletransporte violento (> 18 m/s)
não se move. Nenhuma posição nova é escrita por esta rodada.

```
estrutura (diag_os06, 12 partidas)     R18.65   R18.66
  gate marking reprovado                7/12     7/12
  gate lines reprovado                  0/12     1/12
  severeCollapseRate reprovado          2/12     4/12
  colunaLongeDaBola                    0.0260   0.0322
```

Aqui **piorei duas coisas** e não vou escondê-las atrás da vitória do escanteio:
`lines` reprova uma partida a mais, `severeCollapse` dobra e a coluna sobe de
novo. A hipótese é que sejam as próprias bolas paradas — escanteios subiram 85%,
e escanteio é, para essas métricas, onze jogadores amontoados na área. **Não
medi essa atribuição**, então fica como hipótese, não como explicação. Se for
outra coisa, é regressão minha.

Navegador (`playwright` + chromium, partida completa a 1/60): sem `pageerror`,
sem erro de console, 8 faltas / 5 barreiras armadas.

---

## Fica aberto

- **xG 2,82 contra ECO-02 ≤ 2,7** — estouro registrado, não calibrado.
- `blocked` em 10,8% dos chutes contra ~25% real, limitado por 28,8% dos chutes
  não terem defensor nenhum no segmento.
- gate de marcação 7/12 — não se moveu em nenhuma rodada desta linhagem.
- `severeCollapse` e `coluna` piores, com causa apenas hipotética.
