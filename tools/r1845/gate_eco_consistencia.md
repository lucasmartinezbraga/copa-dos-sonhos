# ECO-01 / ECO-02 / ECO-03 são mutuamente insatisfazíveis com finalização honesta

Este documento não propõe mexer em faixa para aprovar candidata nenhuma — a
candidata da R18.45 reprova de qualquer jeito, e por muito. Ele mostra que o
**conjunto** de gates de ecologia exclui o estado final correto, e por isso
precisa de decisão de quem governa a matriz antes que finalização honesta possa
ser promovida.

## As três restrições

| gate | faixa | métrica (soma dos dois times) |
|---|---|---|
| ECO-01 | 2,4 – 3,2 | gols por partida |
| ECO-02 | 1,8 – 2,7 | xG por partida |
| ECO-03 | 12 – 20 | chutes por partida |

E duas propriedades que qualquer motor de futebol deveria respeitar:

- **COE-01** (gate novo da R18.44, cumprido): `gols ≈ xG`, razão em [0,90; 1,15].
- **Finalização honesta**: `xG por chute ≈ 0,105–0,12`. Referência de futebol
  real: ~2,7 de xG total em ~25 chutes ⇒ **0,108**. O `baseXg` posicional do jogo
  aberto do próprio motor já mede **0,103**, ou seja, o motor concorda com essa
  referência quando consultado sobre posição.

## A incompatibilidade, em uma linha de aritmética

Com `gols ≈ xG` e `xG = chutes × xG/chute`, o teto de `ECO-03` fixa o **máximo de
gols possível**:

```
gols_max = 20 chutes × 0,108 = 2,16
```

E `ECO-01` exige **gols ≥ 2,4**.

**Nenhum valor de chutes admitido por `ECO-03` produz gols suficientes para
`ECO-01`, se a finalização for honesta.** O piso de `ECO-01` exige
`2,4 / 0,108 = 22,2 chutes`, contra teto de 20.

O mesmo vale, mais folgado, para `ECO-02`: piso de 1,8 exige 16,7 chutes, o que
`ECO-03` permite. Logo o conflito é especificamente **ECO-01 contra ECO-03**.

## O que isso explica

Os pisos de `ECO-01` e `ECO-02` vinham sendo cumpridos **porque 44–48% das
finalizações estavam com preço inflado.** Medido na R18.44: `low_cross_shot`
recebia `pGoal` achatado de 0,204 a uma distância média de 24,3 m, onde a tabela
`CAL` do próprio motor vale 0,032. Corrigido o preço para posicional, o xG/chute
cai de 0,1695 para 0,105–0,132 (conforme o bônus situacional) e os gols caem para
1,65–1,92 — abaixo do piso.

Ou seja: **o conjunto de gates estava sendo sustentado por um defeito.** Não é que
o conserto quebre os gates; é que os gates dependiam do preço errado.

## Por que real football também reprova

Futebol real, somando os dois times: ~25 chutes por partida. `ECO-03` tem teto de
**20**. **O futebol real reprova `ECO-03` como está escrito.** Um gate que exclui a
referência que ele deveria representar está mal derivado — o mesmo diagnóstico que
`tools/r1840/gate_eco03.md` fez pelo lado do piso, agora pelo lado do teto.

A Ordem de Serviço classifica chute como "Momento", camada que deve ficar em
0,7–1,0× do futebol real. Isso dá `17,5 – 25`, e não `12 – 20`.

## Proposta

```
ECO-03  chutes por partida   17 - 27   (era 12 - 20)
        derivado de futebol real (~25, soma dos dois times) na faixa 0,7-1,0x
        da Ordem de Servico para camadas de "Momento"
        aplicado a MEDIANA de 3 bases, como a R18.40 estabeleceu

ECO-04  chutes no alvo        6 - 10   (era 4 - 7)
        futebol real ~8,5; mesma logica de derivacao
```

`ECO-01` (2,4–3,2 gols) e `ECO-02` (1,8–2,7 xG) **ficam como estão** — batem com
futebol real (~2,7 gols, ~2,7 xG) e não há razão medida para mexer.

## O que essa mudança NÃO faz, e é o teste de que não é auto-servente

Subir o teto de `ECO-03` **não aprova a candidata da R18.45.** Ela entrega 14,3–14,6
chutes, dentro tanto da faixa antiga quanto da nova, e reprova por `ECO-01`
(1,65–1,92 gols contra piso 2,4). Nada nesta proposta faz a candidata passar.

O que a proposta faz é **tornar alcançável** um estado final que hoje é proibido:
finalização honesta (0,108 por chute) com volume realista (~22–25 chutes), dando
2,4–2,7 de xG e 2,4–2,7 de gols — que cumpre `ECO-01`, `ECO-02`, `ECO-03` (na faixa
nova), `ECO-04` (na faixa nova) e `COE-01` simultaneamente.

Hoje esse estado é inalcançável por construção, e é por isso que a rodada
R18.40B encontrou `ECO-02` e `ECO-03` "quase incompatíveis": eles são, mais o
`ECO-01`, e a causa é o teto de chutes, não a escalação.

## Consequência para o plano

Finalização honesta e volume de chutes **precisam vir na mesma rodada**, ou o
intervalo entre elas reprova `ECO-01`. O trabalho de volume é `INT-03` (chute
irracional do meio-campo, microcenário SH-01) e a frequência do próprio
cruzamento rasteiro — ver `reports/r1845/RELATORIO.md` §E sobre o pool de alvos a
44 m do gol, que fabrica finalizações que não são cruzamento.
