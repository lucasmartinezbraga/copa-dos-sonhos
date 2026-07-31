# RODADA OS-42 / OS-43 — o cruzamento vira jogada disputada

## Correção do relatório anterior

Registrei ontem que a OS-41 tinha um "custo real" em `coberturaEntreLinhas`
(0,731 → 0,670). **Estava errado.** Essa métrica conta quem tem **marcador
designado**, não quem está coberto. Medindo a liberdade de verdade:

```
                                    R18.66   R18.67
entreLinhas_cobertura (tem rotulo)   0,731    0,670
entreLinhas_livres6 (ninguem a 6 m)  0,2079   0,1977
```

Tirei o rótulo de propósito; quem recebe entre as linhas ficou **menos** livre,
não mais. O custo que registrei não existe.

---

## O censo que redirecionou a rodada

A hipótese de entrada era "faltam passes" (385 contra ~900 reais). O censo de
posse (10 partidas) desmontou isso:

```
cadeias de posse /partida   123,7
passes por cadeia            2,77    (real ~3 a 4)  <- saudavel
duracao media da cadeia      4,88 s
cadeias por chute            5,9     (real ~8 a 10) <- o desvio
passes : chutes             17:1     (real ~36:1)
```

A construção por posse está normal. O que está fora é a **frequência de
finalização**: o time chuta a cada 5,9 posses. E a origem é única:

```
cruzamentos /partida             17,20
cruzamento -> chute              68,6%   (real ~25%)
cruzamento -> corte de cabeca    12,2%   (real ~50%)
header_shot 7,50 + low_cross_shot 4,30 = 11,8 dos 20,9 chutes
```

Mais da metade das finalizações nasce de cruzamento, e quase todo cruzamento
vira finalização. Por quê:

```
defensor mais proximo do ALVO do cruzamento
  <= 2,5 m   18,6%      media 4,30 m
```

Não existe disputa na área.

---

## Dois erros meus antes de acertar

**1. A OS-42 v1 nunca disparou.** Exigi bola ALTA (`z > 0,55` ou `vz > 2`) e o
resultado foi 18,6% → 20,1% de disputa, com o corte piorando de 12,2% para 9,4%.

> **CORRIGIDO NA RODADA OS-44.** Eu atribuí isso a "o cruzamento aéreo não
> sobe", tendo lido `_startTravel(o, alvo, 'pass', ...)` sem ler o fim da
> chamada. Ela termina em `},null,'launch')`: o cruzamento **sobe** — `z = 0,3`,
> `vz = 7`, arco com pico de ~1,5 m. O gatilho falhou porque testava `z` no
> instante da chamada, quando a bola ainda está a 0,3 m, não porque a bola fosse
> rasteira. A conclusão prática (gatilho geométrico) continua valendo; a
> explicação estava errada.

**2. Aproximar o defensor não bastou.** Com o gatilho certo, a disputa a 2,5 m
subiu para 30,0% — e `cruzamento -> chute` ficou em 70,0%. Porque a chegada é uma
**corrida por bola solta** (R18.31: `owner=null`, quem alcançar a 1,7 m fica com
ela). `head_def` contra `head_atk` não é consultado em nenhum ponto do caminho do
cruzamento de jogo corrido. Ter o defensor a 2 m não muda nada se o critério é
quem chega primeiro.

---

## OS-43 — o duelo aéreo passa a existir

Mesmo padrão que resolveu a OS-39: envolver `_startTravel`. Para uma entrega que
vem de fora para dentro de 20 m do gol defendido, na chegada roda-se o duelo
antes do desfecho original:

```
p(defensor) = clamp(0,50 + (head_def - head_atk)/220 + vantagem de posicao, .20, .86)
```

Vencendo, ele corta — evento `header_clear`, bola para longe do gol, e a
ecologia R18.18.2/18.3 decide sozinha se vira escanteio. Perdendo, o desfecho
original acontece igual. Nenhum atributo novo: `head_def`/`head_atk` já existiam
e já eram usados em escanteio; faltava serem consultados no jogo corrido.

### Medido

```
                       R18.67   +OS-42/43
cruzamento -> chute     68,6%     52,7%    (real ~25%)
cruzamento -> corte     12,2%     32,7%    (real ~50%)
disputa a <= 2,5 m      18,6%     24,7%

40 partidas
goals                    2.50      1.90
xg                       2.74      2.45    <- ECO-02 (<=2,7) volta a caber
shots                   22.43     20.15
onTarget                 7.00      6.35
corners                  5.13      5.47    <- segue na faixa ECO-05
```

Todas as previsões registradas se cumpriram desta vez: corte sobe, chute por
cruzamento desce, chutes descem, gols e xG descem, escanteios não caem.

**O que fica em observação: gols em 1,90.** Vinha de 3,00 na R18.65 e de 3,3 na
R18.63. A média real de um jogo é ~2,7. Passei do ponto na outra direção. Não
vou calibrar conversão para acertar a média — a razão gol/xG está em 0,78 e o
caminho certo é olhar o que acontece com as 20,15 finalizações, não somar gol por
decreto.

### Estrutura

```
                          R18.67   R18.68
gate marking reprovado     7/12     6/12
gate lines reprovado       0/12     0/12
gate swarmRate reprovado   0/12     2/12
gate severeCollapse        2/12     3/12
colunaLongeDaBola         0.0261   0.0265
entreLinhas_livres6       0.1977   0.2120
```

`swarm` e `severeCollapse` pioram, e a causa é direta: dois defensores
convergindo no ponto de queda **são** um aglomerado para essas métricas. É a
jogada certa sendo contada como defeito, o mesmo padrão da barreira na OS-36.

Salto por quadro 0,521% → 0,653%, faixa acima de 18 m/s parada em 0,011%.
Navegador: sem `pageerror`, sem erro de console.

---

## Fica aberto

- **gols 1,90** — abaixo da média real; passei do ponto.
- `cruzamento -> chute` 52,7% ainda o dobro do real (~25%).
- ~~o cruzamento aéreo não é aéreo~~ — **afirmação errada, corrigida na OS-44**:
  ele usa `passKind='launch'` e sobe de verdade.
- salto por quadro fora de `_movePlayers`, herdado da base.
