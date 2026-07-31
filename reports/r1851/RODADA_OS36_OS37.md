# RODADA OS-36 / OS-37 — a falta acontece, e a correção deixa de teletransportar

Duas observações do jogo, medidas antes de qualquer patch.

---

## OS-36 · "o jogador adversário não pode se aproximar na hora que outro tá batendo falta"

### Mecanismo

`_freeKick` (`:6767`) escolhe rotina, posiciona o cobrador, emite
`freekick_routine` e resolve. **Não há nenhuma linha em todo o motor que afaste
adversários da bola.** O círculo tracejado de 9,15 m que a OS-21 desenha
(`patch_os21_wall_and_taker.js`) era desenho puro: o `wall` do ramo
`result==='wall'` pega o defensor mais próximo de um ponto a 20% do caminho até
o gol — quem estivesse a 2 m da bola servia de barreira.

### Censo antes (`diag_os35_freekick_distance.js`, 8 partidas, 54 cobranças)

```
menor distancia de adversario ate a bola (media)   0.68 m
mediana                                            0.50 m
pior caso                                          0.00 m
cobrancas com adversario dentro de 9,15 m          54 = 100.0%
adversarios dentro do circulo: 2.96 no apito -> 3.41 na saida
```

Em **100%** das faltas há adversário dentro da distância regulamentar, a mediana
é **meio metro** da bola, e o número deles **cresce** durante a espera.

### O defeito que apareceu ao medir isso

```
ball.traveling apos a cadeia de camadas   false em 100% das cobrancas
pendingRestart                            31 de 44  (so crossed/short)
diretas que terminam em NADA              12 de 21
```

`armTaker` (`:20931`) devolve a bola ao ponto e zera `traveling` para o cobrador
**andar** até ela. `crossed` e `short` sobrevivem porque re-executam dentro de
`pendingRestart`. A **direta não tinha `pendingRestart`**: resolvia tudo no apito
e o voo era cancelado logo em seguida, sem nunca ser refeito. Já havia contado
`shots++`, `setPieceShots++` e `xg += pGoal` de um chute que não aconteceu, e o
cartão da OS-20 anunciava uma cobrança que morria em silêncio. É exatamente a
reclamação anterior: *"tem uma falta e ela ser batida de nada a ver"*.

### Edits

1. **núcleo** — a direta vira `pendingRestart`, como as outras duas rotinas. O
   bloco de resolução inteiro passa a ser um thunk executado quando a bola morta
   acaba. Nada dentro dele muda.
2. **camada** — distância regulamentar de verdade: no apito, com o jogo parado,
   2 a 4 adversários viram **barreira** sobre a linha bola→poste mais próximo a
   9,15 m, o resto é empurrado radialmente para fora do círculo, e um **clamp de
   entrada** por quadro impede que voltem enquanto a bola não sai. É clamp, não
   empurrão repetido: quem está fora não é tocado.

### Previsão registrada antes de medir

- menor distância: SOBE para ≥ 9,15 m; o gate real é não cair durante a espera
- cobranças com invasor: DESCE de 100% para ~0%
- diretas que terminam em nada: DESCE para ~0
- xG: **não** sobe — já estava sendo contado sem acontecer
- quadros acima de 12 m/s: não pode subir

### Medido

```
                                          R18.63      OS-36
menor distancia de adversario (media)      0.68 m      9.07 m
mediana                                    0.50 m      9.15 m
pior caso                                  0.00 m      8.56 m
adversarios dentro no apito                2.96        0.04
desfecho da direta: terminam em NADA       12/21       0/24
```

Bateria de 40 partidas:

```
                 R18.63    OS-36
goals             3.27      3.23
xg                2.84      2.66     <- ECO-02 (<=2,7) passa a caber
shots            22.77     21.15
onTarget          6.50      7.33     <- a direta agora chega ao gol
corners           2.90      2.85
penaltiesTaken    0.05      0.13
freeKickDirect    2.83      1.90
```

`freeKickDirect` cai porque a R18.63 **contava a direta no apito**, inclusive as
que morriam; agora só conta quando ela é batida. As 24 diretas medidas todas
executaram (`diretas emitidas 14 / executadas 14` no probe pareado) — nenhuma se
perde. A diferença restante é divergência de caos: a ordem de consumo de RNG
mudou, e a escolha `direct/crossed` depende de `dtg`, que depende de onde as
faltas passam a acontecer.

O que **não** melhorou: escanteios seguem em 2,85 contra a faixa ECO-05 de 4–10.
A previsão de que barreira e rebote empurrariam escanteios para cima **não se
confirmou**.

---

## OS-37 · a travadinha na animação — regressão minha

### Mecanismo

O bloco P47 de `_movePlayers` (`:8087`) roda a cada 0,25 s de simulação e corrige
aglomeração escrevendo em `p.x`/`p.y` **direto, num único quadro**:

```
k = min((2.05-d)*.16, .16)   -> ate 0,16 m instantaneos por par
OS-26 (faixa)                -> ate 0,30 m instantaneos por par
```

O passo normal de um jogador no navegador é `7 m/s × 1/60 = 0,117 m`. Uma única
correção de faixa vale 2,5 passos, e o laço é **pareado** — o mesmo jogador
recebe empurrão de vários companheiros no mesmo quadro.

### Censo (`diag_os37_frame_jump.js`, 4 partidas, passo 1/60 = o do navegador)

```
                      R18.50     R18.63     R18.65 (vcorr=5)
< 6 m/s               85.273%    84.418%    85.121%
6-9                   14.008%    13.545%    13.684%
9-12                   0.387%     0.579%     0.735%
12-18                  0.328%     1.106%     0.451%
> 18                   0.004%     0.352%     0.009%
ACIMA DE 12 m/s        0.332%     1.458%     0.460%
```

**A OS-26 quadruplicou a taxa de salto** (0,332% → 1,458%). A regressão é minha.

### Edit

A física do empurrão não muda — muda a **entrega**. O empurrão vai para um saldo
(`_nudgeX`/`_nudgeY`, teto de 1,2 m) e um sangrador roda **a cada quadro**
entregando no máximo `5 m/s × dt`. Uma correção de 0,30 m se dissolve em 0,06 s,
0,083 m por quadro — abaixo do passo normal. O deslocamento total é o mesmo; o
saldo sempre zera antes do próximo tique de 0,25 s.

`vcorr` foi calibrado, não escolhido: **3 m/s ficou pior que 5** (0,594% contra
0,460%). Com 3 m/s o saldo não termina de escoar antes do tique seguinte e se
soma a ele. Com 7 m/s volta a subir (0,489%). 5 m/s fica abaixo dos ~7 m/s de
corrida e esvazia limpo.

### Medido

A faixa `> 18 m/s`, que é o teletransporte violento, **some**: 0,352% → 0,009%.
Atribuição por origem:

```
saltos que nascem DENTRO de _movePlayers    R18.50 0.016%   R18.65 0.014%
```

Ou seja, dentro da cadeia de movimento a R18.65 está **igual à base**. O resíduo
(0,460% contra 0,332%) nasce **fora** de `_movePlayers` — 95% dos saltos, nas
duas builds. O rastro de pilha aponta `_resetPositions`/`_kickoff`,
`deferPositions` (R14), `confineOwnHalf`, `_setCorner` e `_switchSides`: são
recolocações de reinício, presentes na base. Elas aparecem mais na R18.65 porque
a partida tem ~50% mais quadros (clockRate 0,16 da OS-30) e mais ações de bola.
**Não corrigi isso** — é arquitetura da base, não regressão desta linhagem, e
mexer nela sem censo próprio seria repetir o erro que esta rodada acabou de
consertar.

---

## Gate de navegador

`playwright` + chromium, partida completa a 1/60:

```
pageerror: []   console error: []
OS-36 ativo, 4 faltas / 4 barreiras armadas, 172 quadros de invasao contida
```

---

## Gates de estrutura (`diag_os06_marking_duty.js`, 12 partidas)

```
                          R18.63    OS-36 só   R18.65 (OS-36+OS-37)
gate marking reprovado     7/12       8/12        7/12
gate lines reprovado       0/12         —         0/12
colunaLongeDaBola         0.0227     0.0251      0.0260
marcaDyMedio               1.861      1.956       1.892
coberturaEntreLinhas       0.7205       —        0.7233
```

Previ que `colunaLongeDaBola` **não podia subir**. Subiu — e a medição isolada
mostra por quê: **a OS-36 sozinha já leva a 0,0251**, sem nenhum sangrador. A
deriva é a **barreira**: quatro defensores enfileirados no mesmo `x` são,
para essa métrica, exatamente uma coluna. É coluna correta. O sangrador da OS-37
custa 0,0009 em cima disso, dentro do ruído de 12 partidas.

O gate de marcação segue reprovando 7 de 12 — **igual à R18.63**, sem melhora e
sem piora. Continua aberto.

---

## Fica aberto

- escanteios 2,85 contra a faixa ECO-05 de 4–10 — a previsão de que barreira e
  rebote empurrariam para cima **não se confirmou**;
- gate de marcação reprovando ~58% das partidas;
- salto por quadro fora de `_movePlayers` (reinícios), presente também na base.
