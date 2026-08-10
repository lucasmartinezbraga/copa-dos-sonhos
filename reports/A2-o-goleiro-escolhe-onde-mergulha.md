# A2 · O goleiro escolhe onde mergulha

Continuação direta da A1, que deixou `golPorChuteNoAlvo` em **0,428** contra
0,27–0,38 do futebol real: chute no alvo virava gol com frequência alta demais.

## Como o defeito foi encontrado

Pelo diagnóstico da própria camada 88, em 300 partidas:

```
chutes que entraram na boca do gol   1.805
  fora de alcance do goleiro           613   (34,0%)  -> gol sem ele encostar
  alcancados                         1.192   (66,0%)
    folga media quando alcanca        0,24 m
    P media de defesa                 0,795
```

Duas coisas saltam: **34% dos chutes no alvo eram inalcançáveis**, e quando ele
alcançava era **raspando** — 24 cm de folga.

A primeira hipótese foi a envergadura: 1,05 a 1,60 m é menos do que um goleiro
alcança parado (a envergadura de braços de um profissional passa de 1,85 m, ou
seja ~0,93 m de cada lado do tronco, e o mergulho estende bem mais).

**Subir a envergadura para 1,45 piorou o jogo**: gols de 3,27 para 3,40, e
`golPorChuteNoAlvo` ficou em 0,436. Foi esse resultado invertido que denunciou a
causa real.

## A causa

`_os200Defesa` procurava o **primeiro** instante em que o goleiro poderia tocar
a bola, e parava ali:

```js
if (folga >= 0) { achado = { ponto: s, folga, disponivel }; break; }
```

Esse instante tem folga próxima de zero **por construção** — é exatamente o
ponto onde o alcance passa a existir. Como a chance de defesa é
`DEFESA_BASE + folga × DEFESA_POR_METRO`, **todo chute era resolvido no pior
ponto possível da defesa.**

E por isso dar mais alcance piorava: antecipava o encontro para um ponto ainda
mais apertado, em vez de dar conforto ao goleiro.

Um goleiro não mergulha no primeiro milissegundo em que poderia encostar. Ele
escolhe onde chega melhor.

## O conserto

Uma linha: guardar a **melhor** folga em vez de parar na primeira.

```js
if (folga >= 0 && (!achado || folga > achado.folga)) achado = { ponto: s, folga, disponivel };
```

Nenhuma constante de calibração foi tocada. A envergadura ficou no valor
original (1,05 + q × 0,55), agora varrível por `CDS_OS200_TUNE` para quem
quiser medir de novo.

## Resultado — 120 partidas

| | antes (A1) | depois | faixa |
|---|---|---|---|
| **Gol por chute no alvo** | 0,428 | **0,378** | 0,27–0,38 real ✓ |
| **Gols por partida** | 3,27 | **2,833** | 2,4–3,2 design ✓ · 2,5–3,0 real ✓ |
| Folga média do goleiro | 0,24 m | **1,31 m** | |
| P média de defesa | 0,795 | **0,886** | |
| Finalizações | 23,72 | 23,93 | 22–28 ✓ |
| **Placar de design** | 11/13 | **12/13** | |

Fora de alcance segue em 34,0% — o conserto não deu alcance nenhum ao goleiro.
Ele apenas deixou de ser obrigado a mergulhar no pior momento.

`onTargetRate` 0,313 continua abaixo do mínimo de design (0,34), mas está dentro
da faixa do futebol real para acerto ao alvo (0,30–0,40).

## Nota de método

Este defeito não aparece em nenhuma métrica agregada — gols, chutes e xG saíam
todos plausíveis. Ele só apareceu porque:

1. a A1 removeu um freio (o impedimento) e expôs o excesso de conversão;
2. a camada 88 tinha diagnóstico próprio por ramo (`defForaDeAlcance`,
   `defSomaFolga`, `defSomaP`);
3. e a hipótese errada (envergadura) produziu um resultado **invertido**, que é
   o sinal mais barato que existe de que a causa está em outro lugar.

O terceiro ponto é o que vale guardar: quando aumentar um recurso piora o
resultado, o modelo está usando o recurso do jeito errado.
