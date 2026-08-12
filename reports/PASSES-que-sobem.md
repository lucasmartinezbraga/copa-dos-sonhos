# "O time cansado circula em vez de arriscar" — o que sobrou depois de medir

**Data:** 2026-08-12 · **Sondas:** `ramo-passes.js`, `ramo-posse.js` ·
**Resultado: a frase estava errada em duas camadas, e o que sobra é menor e
mais específico do que ela dizia.**

---

## De onde veio a frase

`tools/auditor.py --forma 3` apontou sozinho, sobre `reports/REFERENCIA.json`:

```
passes SOBE em 5 das 5 transicoes de faixa: 15,5 → 16,0 → 16,1 → 17,0 → 17,2 → 18,2
chutes  CAI em 4 das 5 transicoes:          1,16 → 1,13 → 1,05 → 1,03 → 1,06 → 0,84
```

Lido como: **o time cansado circula a bola em vez de arriscar.** É uma leitura
plausível, encaixa no D19, e está errada.

---

## Erro 1 · o denominador

O auditor normaliza por **segundo simulado**, que inclui bola parada. Medido por
**minuto de jogo** (`sim.minute`, o mesmo denominador do funil do D19):

| | por segundo simulado | por minuto de jogo |
|---|---|---|
| razão passes 76+/0‑15 | **1,17** | **1,057** |

Os passes sobem **5,7%**, não 17%. É a armadilha **B3** num disfarce novo: o
número não estava errado, estava respondendo a outra pergunta.

**Uma métrica que sobe 5,7% não sustenta uma frase como "circula em vez de
arriscar".**

## Erro 2 · nada no passe muda

`ramo-passes.js`, 24 partidas, razão 76+/0‑15:

| | razão | |
|---|---|---|
| distância do passe | 1,006 | estável |
| fração para trás | 0,941 | estável |
| fração para frente | 1,075 | estável |
| onde a posse começa | 1,007 | estável |
| **progresso por passe** | **1,183** | ⬆ sobe |
| **passe termina na faixa de chute** | **0,744** | ⬇ cai |

O passe é **igual**: mesmo comprimento, mesma direção, mesma origem. E ganha
**mais** chão. O que cai é onde ele termina.

> **Duas medidas desta sonda estavam quebradas** e foram corrigidas depois:
> `passes por posse` e `duração da posse`. O dono da bola é `null` enquanto ela
> viaja, então cada passe encerrava a "posse" — elas mediam **lance de bola**,
> não posse de equipe. O mesmo defeito estava em `ramo-posse.js` e está
> corrigido nos dois.

---

## O que sobra, e é real

`ramo-posse.js` com a segmentação corrigida, seguindo cada posse do início ao
fim. **48 partidas**, razão 76+/0‑15:

| | razão | |
|---|---|---|
| posses por minuto | 0,891 | ⬇ |
| progresso máximo da posse | 0,967 | estável |
| chega ao terço final (≤40 m) | 0,937 | estável |
| chega à faixa de chute (≤27 m) | 0,850 | ⬇ leve |
| **posses que terminam em chute** | **0,699** | ⬇⬇ |

**Só as posses que chegaram à faixa de chute:**

| | razão | |
|---|---|---|
| tempo na faixa por chegada | 0,896 | ⬇ leve |
| **chutam** | **0,823** | ⬇ |
| saem da faixa | 1,140 | ⬆ |
| **perdem a bola ali dentro** | **1,399** | ⬆ |

**O time chega. O que piora é o que ele faz depois de chegar.** A perda de bola
dentro da faixa de chute vai de 18,2% para 25,5% das chegadas — 7,3 pontos, cerca
de 3,4 SE com ~300 chegadas por faixa.

---

## O achado maior — a métrica principal do projeto estava distorcida

Perseguindo o pico de 46–60 eu fui olhar a duração das faixas. **Elas não têm o
mesmo tamanho.** Medido em 96 partidas, lendo `sim.minute`:

| faixa | min de jogo por partida |
|---|---|
| 0–15 · 16–30 · 31–45 · 61–75 | **15,00** |
| **46–60** | **18,70** (+25%) |
| **76+** | **21,14** (+41%) |

O 76+ é aberto — vai até o fim, acréscimos incluídos — então ser maior é
esperado. O **46–60 é maior porque os acréscimos do primeiro tempo caem nele**:
o minuto 45,0–48,7 tem índice de faixa 3.

E o histograma de gols do projeto — o número que sustenta o D19 inteiro e que
aparece em todo laudo — comparava **percentuais brutos entre faixas de tamanhos
diferentes**:

| faixa | bruto (o que era publicado) | por minuto de jogo |
|---|---|---|
| 0–15 | 20,0% | **21,8%** |
| 16–30 | 17,0% | 18,5% |
| 31–45 | 14,6% | 15,8% |
| **46–60** | **18,1%** ⬅ pico | **15,7%** |
| 61–75 | 15,5% | 16,9% |
| **76+** | 14,7% | **11,3%** |
| **razão início/fim** | **1,36×** | **1,92×** |

Duas consequências, e elas vão em direções opostas:

1. **O pico do 46–60 não existe.** Era o tamanho da faixa. Foi ele que me fez
   perseguir uma explicação de intervalo que não havia.
2. **A queda do fim de jogo é muito pior do que o projeto media.** 1,92× em vez
   de 1,36×. O D19 estava **subestimado** o tempo todo.

`tools/fisica/futebol_real.py` agora publica as duas colunas, e `bateria.js`
passou a medir `minutosDeJogoPorPartida` por faixa — o valor deixa de ser
constante escrita à mão e passa a vir da medição, com fallback avisado para os
arquivos gravados antes.

---

## O que este laudo NÃO autoriza

**Não é um gradiente limpo de fadiga.** O padrão por faixa não é monotônico — a
pior faixa é a de **46–60 min**, não a de 76+:

| faixa | chegadas | % chuta | % perde ali |
|---|---|---|---|
| 0–15 | 318 | 59,1 | 18,2 |
| 16–30 | 301 | 56,5 | 20,6 |
| 31–45 | 282 | 51,8 | 26,6 |
| **46–60** | 366 | **44,3** | **29,8** |
| 61–75 | 302 | 53,3 | 24,2 |
| 76+ | 337 | 48,7 | 25,5 |

E a magnitude **encolheu quando o n cresceu**:

| | n = 24 | n = 48 |
|---|---|---|
| perde a bola na área | 2,029 | **1,399** |
| chuta da área | 0,759 | **0,823** |

É a armadilha **B7** de novo — a segunda vez no mesmo dia. Com ~300 chegadas por
faixa, `SE ≈ 2,2 pontos percentuais`: diferenças abaixo de ~4,4 pp não são sinal.

**Rodado com n = 96.** A razão encolheu de novo e o padrão **continua não
monotônico**:

| faixa | chegadas | % chuta | % perde ali | SE |
|---|---|---|---|---|
| 0–15 | 673 | 58,8 | 20,7 | ±1,6 |
| 16–30 | 608 | 55,4 | 22,0 | ±1,7 |
| 31–45 | 591 | 50,6 | 27,2 | ±1,8 |
| **46–60** | 761 | **46,3** | **29,3** | ±1,7 |
| 61–75 | 607 | 50,3 | 27,7 | ±1,8 |
| 76+ | 684 | 50,9 | 25,4 | ±1,7 |

| | n=24 | n=48 | **n=96** |
|---|---|---|---|
| perde a bola na área | 2,029 | 1,399 | **1,232** |
| chuta da área | 0,759 | 0,823 | **0,865** |

**Se fosse fadiga, o pior seria o 76+.** O pior é o 46–60 e depois melhora — e
esse pico se explicou sozinho quando fui medir a duração das faixas (seção
acima). O que resta é uma degradação real mas modesta na conversão após a
chegada: **58,8% → ~50%** das chegadas viram chute, estável do 31–45 em diante.

**Não implemente nada com base nisto.** Uma queda que se estabiliza a partir dos
31 minutos e não piora até o fim não é fadiga, e não é o D19.

---

## Onde isto se encaixa no D19

O funil do D19 mediu que o **tempo** na faixa de chute cai 39% e os chutes 39%.
Esta sonda mostra que a **chegada** cai só 15%. A diferença está no que acontece
depois de chegar — e é ali que a investigação continua, não no passe.

O r = 0,814 que abriu tudo isso continua sendo correlação. O passe continua
inocente. E "circular em vez de arriscar" era uma frase bonita sustentada por um
denominador.
