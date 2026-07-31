# RODADA OS-48 — quem tem a bola não fica parado esperando

Observação de campo: *"os jogadores dominam a bola e param pra pensar, acho que
tinha que ser fluido"*.

## Censo (8 partidas, 3.385 posses individuais)

```
tempo medio com a bola      0,45 s   (real ~1,1 a 1,4 s)
distancia media com a bola  1,42 m
fracao do tempo PARADO      27,2%

quanto do dominio e parado
  < 15%   63,8%     <- fluido
  > 85%   23,2%     <- congela
```

Não é lentidão geral — o jogo é até **mais rápido** que o futebol real na média.
É **bimodal**: quase uma em cada quatro posses o jogador para por completo.

## O que separa as duas populações

6 partidas, 569 congeladas contra 1.812 fluidas:

```
quadros SEM alvo de movimento definido
  congelada  96,3%        fluida  0,2%
distancia ate o proprio alvo
  congelada  0,02 m       fluida  23,82 m
```

Uma variável, e só ela.

## Mecanismo (`:7211`)

```js
tx = p._tx !== undefined ? p._tx : p.x;
ty = p._ty !== undefined ? p._ty : p.y;
```

**Sem `_tx`/`_ty`, o alvo do jogador é ele mesmo.** Enquanto a ação escolhida não
executa, o portador não recebe destino nenhum e planta o pé no chão. Não é
"pensando" — é ausência de destino.

## Edit

Uma camada antes do movimento: portador sem alvo **conduz**. O destino é um
toque de 2,6 m na direção do gol, desviando para o lado contrário ao do marcador
mais próximo — o que um jogador faz enquanto procura o passe. O alvo é renovado
quando ele chega e **apagado no instante em que a bola muda de dono**, para não
sobrar destino velho (é a armadilha que a marca `__os48Meu` existe para evitar).

Não mexe em decisão, duelo, passe nem RNG. Só preenche um destino que estava
vazio — mas as posições mudam, então a partida diverge por caos.

## Medido

```
                            R18.72   R18.73
fracao do tempo PARADO       27,2%     7,8%
posses > 85% paradas         23,2%     1,3%
posses fluidas (< 15%)       63,8%    87,5%
resolvidas em movimento      70,7%    95,2%
distancia com a bola         1,42 m   1,87 m

40 partidas
goals                         2.35     2.35
xg                            2.29     2.05
shots                        18.02    18.00
onTarget                      6.30     6.55
corners                       5.08     4.47   <- segue na faixa, mas caiu
passes                      368.55   371.27
fouls                        10.95    11.78
carry (acoes)                 33.6     37.3
```

A previsão principal se cumpriu com folga: previ que as posses congeladas
cairiam abaixo de 8% e elas foram para **1,3%**.

## O que eu previ errado

**"O salto por quadro não pode subir."** Subiu: 0,550% → 0,691%. Fui atrás da
atribuição antes de aceitar:

```
saltos > 12 m/s que sao do PORTADOR da bola:  0,0%  (4 de 22.020)
```

Não é o condutor. É de segunda ordem — com o jogo mais fluido há mais ações,
mais reinícios e mais recolocação fora de `_movePlayers`, que é a fonte herdada
da base já documentada na OS-37. Registro como custo, não como explicação
confortável: a previsão falhou.

Custo real também nos **escanteios**: 5,08 → 4,47. Segue dentro do ECO-05 (4–10),
mas encostou no piso.

Navegador: sem `pageerror`, sem erro de console.

## Fica aberto

- escanteios em 4,47, perto do piso da faixa.
- salto por quadro em 0,691% contra 0,332% da R18.50 — nenhuma parte disso é
  regressão de mecanismo desta rodada, mas o número acumulou.
