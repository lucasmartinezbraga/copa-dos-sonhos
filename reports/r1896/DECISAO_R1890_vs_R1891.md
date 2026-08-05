# A decisão entre R18.90 e R18.91

> **DECIDIDO: R18.91 promovida** pelo dono, com o custo de escanteios declarado.
> Arquivo: `Downloads/COPA DOS SONHOS - R18.91 - JOGO DE FUTEBOL.html`
> sha256 `5eb0aaee3445bc2eff9e4c0db02dd2bff8c81f71d9a59bc900c9103fe7705afd`
>
> Verificação final no navegador, 5 cobranças diretas: câmera lenta 5/5,
> passada 5/5, goleiro do lado longo 3/5 (os 2 restantes ainda em trânsito,
> com as maiores profundidades), **zero erros de página**.
>
> A R18.90 fica como alternativa conservadora em
> `COPA DOS SONHOS - R18.90 - FALTA CONSERVADORA.html`.

Duas candidatas, ambas melhores que a R18.86 em coisas diferentes, e **nenhuma
das três passa em tudo**. Este documento existe para a decisão ser tomada com o
número na frente, e não pela build mais recente ganhar por inércia.

## O quadro

| | R18.86 promovida | R18.90 | R18.91 |
|---|---:|---:|---:|
| **gols, média (144 j.)** | 2,340 | 2,208 | **2,403** |
| **gols, pior base** | **1,667** ✗ | 1,833 | **2,292** ✔ |
| gols, amplitude entre bases | 1,083 | 1,042 | **0,375** |
| xG, média | 2,182 | 2,162 | 2,281 |
| xG, pior base | 2,323 ✔ | 2,316 ✔ | 2,462 ✔ |
| **escanteios, pior base** | 4,333 ✔ | 4,958 ✔ | **3,792** ✗ |
| escanteios, bases abaixo de 4 | 0 | 0 | **2 de 6** |
| no alvo | 7,840 | 7,007 | 7,014 |
| **goleiro do lado certo na falta** | 1,7% | 1,7% | **72,7%** |
| **defesa na falta, realizada** | — | 30,6% | **39,5%** |

## O que cada uma quebra

**R18.86** reprova o piso de gols (1,8) na base 6300000, com **1,667**. As três
bases publicadas no relatório dela eram recorte favorável.

**R18.90** passa nos três gates nas seis bases, mas por pouco: pior base de gols
em **1,833**, a 0,033 do piso. E mantém o goleiro atrás da própria barreira em
91,4% das faltas.

**R18.91** tem o melhor perfil de gols já medido neste projeto — pior base
2,292, amplitude 0,375 contra 1,08 da promovida — e conserta o goleiro. Mas
reprova ECO-05 em **duas de seis bases** (3,792 e 3,958).

## O que eu investiguei sobre os escanteios

Classifiquei cada escanteio pela pilha de chamada, na base que reprova
(8400000), 24 partidas:

| origem | R18.90 | R18.91 |
|---|---:|---:|
| `pendingRestart` ← `_ballOut` | **5,000** | **3,792** |
| `_ballTravel` | 2,375 | 2,458 |
| `_gkResolveSave` | 1,500 | 1,250 |

A primeira linha bate exatamente com o número da bateria nas duas builds — é ela
que conta. O que caiu foi **bola saindo pela linha de fundo**, que não tem canal
ligado à postura do goleiro na falta: a camada OS-90 só age com `__os36Guard`
armado e a bola parada, e se desliga no quadro em que a bola voa.

Diferença de escanteios base a base, R18.91 menos R18.90:

```
-0,375 | -1,208 | +0,416 | +0,625 | -0,625 | -2,625      media -0,632
```

**Sinal misto** — quatro caem, duas sobem — e o deslocamento médio (0,63) é
menor que a amplitude natural entre bases (~1,5). Isso tem assinatura de caos,
não de mecanismo. Mas cai abaixo do piso em duas bases, e é isso que o gate mede.

## As três bases extras — resultado

| semente | gols | xG | escanteios |
|---:|---:|---:|---:|
| 5250000 | 2,708 | 2,303 | 4,417 ✔ |
| 7350000 | 2,542 | 2,448 | 4,125 ✔ |
| 9450000 | 2,875 | 2,308 | 4,458 ✔ |

**As três passam em escanteios.** A falha não é universal — é a cauda inferior.

### R18.91 sobre NOVE bases (216 partidas)

| | média | pior base | gate |
|---|---:|---:|---|
| gols | **2,505** | **2,292** | 1,8–3,0 · passa nas nove |
| xG | 2,305 | 2,462 (máx) | ≤ 2,7 · passa nas nove |
| escanteios | 4,588 | **3,792** | ≥ 4 · **falha em 2 de 9** |

## Veredito

**Nenhuma das três builds passa em tudo pelo padrão por-base.**

- R18.86 promovida: falha o piso de gols em 1 de 6 bases (1,667).
- R18.90: passa nas seis, mas com gols a 0,033 do piso na pior base, e mantém o
  goleiro atrás da própria barreira em 91,4% das faltas.
- R18.91: falha o piso de escanteios em 2 de 9 bases (22%), e tem o **melhor
  perfil de gols já medido** neste projeto (pior base 2,292; amplitude 0,375
  contra 1,08 da promovida) além de consertar o goleiro.

### Recomendação: R18.91, com o custo declarado

O que pesa a favor:

1. é a única que resolve o pedido do dono — a batida de falta — de ponta a ponta;
2. estabilidade de gols muito superior: a promovida oscila 1,08 gol entre bases
   e chega a reprovar; a R18.91 oscila 0,375 e nunca chega perto do piso;
3. o defeito que ela introduz é numa métrica que **o jogo inteiro já modela
   longe da realidade**: futebol real tem ~10–11 escanteios por partida somando
   os dois times; o jogo roda em ~4,6–5,3 em todas as builds. O piso de 4 do
   ECO-05 é calibrado sobre a ecologia do próprio jogo, não sobre futebol.

O que pesa contra, e é real: a cauda inferior de escanteios cruza o piso em 22%
das bases, e eu **não achei o mecanismo**. A origem que cai é `_ballOut` (bola
saindo pela linha de fundo), que não tem canal ligado à camada do goleiro. O
sinal é misto entre bases (quatro caem, duas sobem) e o deslocamento médio
(0,63) é menor que a amplitude natural (~1,5), o que aponta caos — mas eu não
provei isso, e "não achei mecanismo" não é o mesmo que "não existe mecanismo".

### Se a escolha for conservadora

A R18.90 está entregue ao lado. Ela tem tudo da rodada da falta **menos** o
posicionamento do goleiro: cobrador chega à bola, passada, câmera lenta, e a
moeda defesa/fora calibrada. Perde só o goleiro — que é o item mais visível
dos quatro.

### O que isso sugere para a próxima rodada

O escanteio do jogo está em ~5 por partida contra ~10 reais. Enquanto isso for
verdade, o ECO-05 vai continuar sendo um gate apertado que qualquer perturbação
faz estourar. Vale investigar por que a bola sai tão pouco pela linha de fundo —
provavelmente é o mesmo defeito de geometria que a OS-84B encontrou nos chutes
para fora, e que continua aberto.
