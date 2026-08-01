# RODADA OS-52 … OS-55 — o tempo de jogo, a falta central, o drible por atributo e o pênalti no gramado

## OS-52 · os gols não eram conversão, eram volume

A dívida aberta era gols em 1,85 contra ~2,7 reais. Antes de mexer em conversão:

```
17,10 chutes -> 1,85 gols = 10,8% de aproveitamento     (real ~10 a 11%)
```

**A conversão estava certa.** O que faltava era volume:

```
chutes             17,10   contra ~25 reais
posses            123,70   contra ~200 a 260
cadeias por chute    8,2   <- ja dentro da faixa real
```

A razão construção/finalização já estava certa desde a OS-45. O limitador é o
**tempo**: com `clockRate` em 0,16, os 90 minutos cabem em ~562 s de ação, e por
segundo de ação o jogo já produz mais que o futebol real. Mexer em conversão
seria consertar o numerador de uma fração cujo denominador é o problema — o erro
que a OS-22 registrou e que eu quase repeti.

Varredura (24 partidas por ponto):

```
             0,16     0,13     0,115
goals        1,85     2,71     2,38
xg           2,01     2,62     2,90   <- 0,115 estoura o gate
shots       17,10    22,67    24,13
corners      4,75     5,92     6,92
```

**Custo explícito:** a partida passa de ~9,4 para ~11,5 min de relógio real.

---

## OS-53 · "o jeito que bate a falta é mais cruzamento do que batida direta"

Medido: `freeKickDirect 2,55` contra `freeKickCrossed 3,70`.

A rotina saía **só da distância** (`:6781`) — o **ângulo não entrava em lugar
nenhum**. Falta a 22 m na linha lateral, de onde ninguém chuta, caía em
`direct`; falta a 28 m em frente ao gol, que todo cobrador bate, caía em
`crossed`. Agora entra o afastamento lateral: central e até 33 m é direta; o
resto até 42 m é cruzamento.

---

## OS-54 · "quem tem mais drible deveria driblar de fato"

O drible de assinatura era uma **porta binária seguida de moeda fixa**
(`:16384`): abaixo de 86 de drible ninguém faz nada nunca; de 86 para cima todo
mundo faz na mesma taxa de 26%, do craque de 99 ao que encosta no limiar. O
atributo entrava uma vez, para abrir a porta, e sumia.

Agora a propensão é contínua: `p = clamp((dri-72)/72 + (DRIBBLER? .06), .02, .46)`.

A primeira calibragem `(dri-70)/58` foi medida e **rejeitada**: com o Brasil de
70 dos dois lados, metade dos dribles vencidos virava drible de assinatura
(49,5%). A curva final põe o mesmo elenco em 39,9%.

---

## OS-55 · "recrie completamente a animação do pênalti"

O pênalti **de jogo** disparava `penScene` e o desenhista fazia, em `:13588`:

```js
if (penScene && performance.now() < penScene.until) { drawPenScene(ctx); return; }
```

O campo inteiro sumia por 3,9 s e entrava uma cutscene com fundo próprio, gol em
perspectiva, corrida e mergulho — e `penActive` (`:12484`) **pausava o
simulador**. É a mesma cutscene que já tinha sido removida da falta a pedido
("sem ser mini game"): na falta ela saiu, no pênalti sobreviveu.

A cobrança volta para o gramado: bola voando de verdade, goleiro na linha, motor
de sempre, apresentação pela tarja (OS-20/OS-50) e pelo anel do cobrador
(OS-21/OS-50). A **disputa de pênaltis** (shootout) não foi tocada — ali a cena
própria é o enquadramento certo, porque não há partida ao redor.

---

## Medido — 40 partidas, mesmas sementes

```
                 R18.74   R18.75
goals             1.85     2.70    <- media real
xg                2.01     2.72    <- 0,02 acima do ECO-02
shots            17.10    23.50
corners           4.75     6.35
passes          368.13   462.88
freeKickDirect    2.55     4.58    <- passa o cruzado
freeKickCrossed   3.70     3.05

razoes preservadas: cadeias por chute 8,2 -> 8,6 (faixa real 8 a 10)
dribles com efeito (Brasil 70): 8,8 -> 19,5 por partida
```

**Gols em 2,70 com xG em 2,72** — razão 0,99, que é o que se vê no futebol.

O xG passou 0,02 do ECO-02. Registro o estouro e **não vou calibrar para caber**:
a 0,115 de `clockRate` ele iria a 2,90, e a 0,16 os gols voltam para 1,85. O
ponto escolhido é o que acerta gols, chutes e escanteios ao mesmo tempo.

Navegador: sem `pageerror`, sem erro de console.

## Fica aberto

- xG 2,72 contra o gate de 2,7.
- faltas 14,4 por partida contra ~22 reais.
- passes 463 contra ~900 — o relógio comprimido ainda cobra isso.
