# OS-24 — censo de origem de gol: a "conversão acima do xG" não está provada

**Baseline:** R18.57 · **Natureza:** observacional · **Promoção:** não promovível

## O QUE EU FUI VERIFICAR

Eu vinha afirmando, desde a R18.51, que "a conversão está acima do xG" e tratei
isso como defeito a corrigir. A OS-23 mexeu num sítio real por causa disso.

## CENSO EXECUTADO (10 partidas, R18.57)

Envolvi `_goal` e classifiquei por sítio de chamada via pilha:

| gols | sítio | o que é |
|---|---|---|
| 15 | `:6134` | chute principal |
| 5 | `:5366` | cabeceio / aéreo |
| 3 | `:6184` | ramo do goleiro inalcançável |
| 2 | `:5424` | segundo sítio aéreo |

**Os quatro sítios são cobertos por um `xg +=`** (`:5360`, `:5418`, `:6122`,
`:6820`). E o principal, `:6134`, é disparado por `if(chance(pGoal))` em `:6128`
— exatamente o `pGoal` gravado como `xg` seis linhas antes, em `:6122`.

Não existe caminho de gol sem xG contabilizado. A construção está correta.

## A CONCLUSÃO, QUE CONTRARIA O QUE EU DISSE

Neste censo: **2,50 gols/partida** contra xG 2,26 — razão 1,11, não 1,24.

Com ~2,3 gols esperados por partida, o erro padrão da média sobre 16 partidas é
`sqrt(2,3/16) ≈ 0,38`. A diferença que eu vinha chamando de defeito (2,81 contra
2,26 = 0,55) é **cerca de 1,4 erro padrão**. Não é significativa.

**Eu persegui uma diferença que nunca foi estabelecida.** As amostras de 8 a 24
partidas que usei a sessão inteira não têm resolução para separar 1,0 de 1,25
nessa razão. O protocolo de três bases × 48 existe exatamente para isso.

## O QUE FICA

A OS-23 continua defensável por si: o ramo `:6140` de fato recalculava a
probabilidade de gol em vez de usar a que foi contabilizada, e alinhar os dois é
correto independentemente do tamanho do desvio. Mas a motivação que eu dei para
ela — "gols acima do xG" — não estava medida.

## ARMADILHA

Tratar a diferença entre uma média realizada e sua esperança como defeito, sem
calcular o erro padrão. Foi o mesmo erro de método que eu vinha cobrando nos
sítios: número que parece explicar o sintoma, aceito antes de medir se ele
existe.
