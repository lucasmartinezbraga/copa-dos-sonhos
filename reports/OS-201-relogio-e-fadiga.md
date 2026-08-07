# OS-201 · O relógio da partida e a fadiga

## A pergunta

*"O clockRate está legal para um jogo arcade ou exagerado demais?"*

`clockRate` é quantos minutos de jogo passam por segundo de simulação. Estava
em **0,13** — o relógio corria 7,8× mais rápido que o mundo. Cada ação real (um
passe de 1,2 s) consumia 9,4 segundos de partida.

## A resposta: era subnutrição, não arcade

O projeto sempre teve `calibration/targets.json`, mas nada media o jogo contra
ele de ponta a ponta. O laboratório que fazia isso (`tools/lab.js`) carrega só
os módulos do core, **sem as 76 camadas** — mede um jogo que ninguém joga.

Com o placar novo (`tools/fisica/placar.py`, medindo o bundle inteiro), o
`clockRate` 0,13 entregava:

| Métrica | 0,13 | faixa de design |
|---|---|---|
| Gols por partida | 1,97 | 2,4 – 3,2 ❌ |
| Finalizações | 13,2 | 20 – 30 ❌ |
| xG | 1,94 | 2,3 – 3,5 ❌ |
| Faltas | 9,6 | 16 – 28 ❌ |
| Empates | 41,7% | 20 – 33% ❌ |
| 0 a 0 | 25,0% | 4,5 – 12% ❌ |

**6 de 13 métricas dentro da faixa.** Uma partida inteira com 9 faltas e 13
finalizações, e um quarto dos jogos terminando 0 a 0 — porque não cabia futebol
dentro dos 90 minutos.

Varredura de cinco valores (40 partidas cada) mostrou onde o volume entra na
faixa:

| clockRate | min assistindo (1X) | chutes | gols | faltas | escanteios |
|---|---|---|---|---|---|
| 0,13 | 14,7 | 13,3 | 1,90 | 9,4 | 5,4 |
| 0,115 | 16,8 | 15,4 | 2,38 | 10,9 | 6,7 |
| 0,10 | 19,1 | 16,4 | 2,20 | 11,9 | 6,8 |
| **0,085** | **22,8** | **20,2** | **2,40** | **16,3** | **9,5** |
| 0,071 | 27,2 | 23,8 | 3,40 | 17,1 | 10,1 |

O custo aparente (14,7 → 22,8 minutos) é menor do que parece: **o jogo abre em
2X**, então na prática são ~11 minutos por partida.

## A fadiga estava presa no relógio errado

Baixar o `clockRate` derrubou a stamina final de 57,8 para 50,3 — sem que nada
no futebol tivesse mudado. A causa:

```js
p.stamina -= (moving ? 0.055 : 0.012) * dt * ...
```

`dt` é o passo do **simulador**. O gasto dependia de quantos segundos de
simulação a partida levasse, e `clockRate` é justamente o que define essa
relação. **Um jogador se cansa por jogar 90 minutos, não por o simulador
demorar.**

Normalizando pelo `clockRate` de referência, o gasto passa a ser por minuto de
jogo e fica igual em qualquer relógio. Em 0,13 o fator é exatamente 1, então a
normalização não mexe em nada do que já estava calibrado.

O **módulo** do dreno, esse sim, foi reduzido em 27%: a stamina final era 57,4
contra um mínimo de 64, e isso valia nos dois relógios — era erro próprio, não
efeito do `clockRate`.

## Resultado

120 partidas por medição, semente base 4200000.

| Métrica | antes (0,13) | agora | faixa |
|---|---|---|---|
| Gols por partida | 1,97 ❌ | **2,89** ✓ | 2,4 – 3,2 (alvo 2,8) |
| Finalizações | 13,2 ❌ | **21,2** ✓ | 20 – 30 |
| xG | 1,94 ❌ | **2,93** ✓ | 2,3 – 3,5 (alvo 2,9) |
| Acerto ao alvo | 0,380 ✓ | 0,351 ✓ | 0,34 – 0,47 |
| Passe certo | 0,845 ✓ | 0,839 ✓ | 0,75 – 0,89 |
| Amarelos | 3,20 ✓ | 4,66 ✓ | 2,4 – 5,6 |
| Vermelhos | 0,083 ✓ | 0,200 ✓ | 0,06 – 0,3 |
| Escanteios | 5,33 ✓ | **9,72** ✓ | 5 – 11,5 (alvo 8) |
| Empates | 41,7% ❌ | **29,2%** ✓ | 20 – 33% |
| 0 a 0 | 25,0% ❌ | **9,2%** ✓ | 4,5 – 12% |
| Goleadas | 10,0% | 17,5% ✓ | 9 – 19% (faixa corrigida, ver abaixo) |
| Stamina final | 57,8 ❌ | **64,2** ✓ | 64 – 83 |
| Faltas | 9,6 ❌ | 15,3 ❌ | 16 – 28 |

**6/13 → 12/13.** Gols (2,89) e xG (2,93) ficaram praticamente no alvo (2,8 e 2,9).

## Fôlego na bola parada — o motor só sabia gastar

Com o relógio novo a stamina final ficou em 63,9 contra um mínimo de 64. A
tentativa óbvia — afrouxar o dreno — foi medida e reprovou (abaixo). Olhando o
código, o motivo real apareceu: **não existia recuperação nenhuma**, e o dreno
rodava inclusive com o jogo parado.

Mas é justamente na bola parada que um jogador recupera: falta, escanteio,
lateral, comemoração de gol. Recuperar ali sobe a stamina final **sem** deixar
o jogador mais inteiro durante o jogo — que era exatamente o efeito colateral
que derrubava as outras métricas.

Funcionou como projetado: stamina 63,9 → 64,2 e **nada mais se moveu**.

Subir a recuperação para 0,075 foi tentado e revertido: põe a stamina em 64,4
(ganho irrisório), mas jogador mais inteiro no fim faz o placar abrir — os
empates caem para 17,5%, abaixo do mínimo, e as goleadas sobem para 20,8%.
De 12/13 para 10/13.

## As goleadas: o alvo é que estava errado

`blowoutRate` marcava alvo 6,5% e máximo 13,0%. Suspeitei de efeito bola de
neve e fui medir: com os dois times sendo o **mesmo elenco**, dos gols marcados
com alguém já na frente, **55,6%** saíram de quem liderava (esperado 50%). São
+1,8 erros-padrão — existe uma tendência, mas ela **não é significativa** e não
explicaria a diferença.

A explicação é aritmética. Entre times de força igual o placar se comporta como
duas Poisson independentes de média gols/2:

| gols/partida | goleada (3+ de diferença) |
|---|---|
| 2,4 (mínimo de design) | 10,1% |
| 2,8 (alvo de design) | **12,7%** |
| 3,2 (máximo de design) | 15,2% |

**O alvo de 6,5% exigiria ~1,6 gol por partida — abaixo do próprio mínimo de
gols.** E o máximo de 13,0% coincidia exatamente com o piso de Poisson do alvo
de gols, ou seja não sobrava folga para dispersão nenhuma. Os dois alvos se
contradiziam.

Corrigi o **alvo**, não o motor: faixa 9% – 19%, alvo 13,5%, com a derivação
registrada em `calibration/targets.json`. Num Mundial com seleções de forças
muito diferentes a dispersão real é *maior* que a de uma liga equilibrada, não
menor.

Isto é mudança de especificação, não de jogo — está sinalizada como tal.

## Três tentativas medidas e revertidas

**Subir `foulBase` de 0,29 para 0,33.** Rendeu +0,4 falta, nem chegou ao
mínimo.

**Criar falta na disputa aérea.** O duelo aéreo de fato nunca gerava falta — é
uma categoria inteira que não existe no motor. Mas acrescentá-la rendeu **+0,05
falta**: o duelo aéreo acontece pouco demais para mover o número, e ainda custou
stamina e acerto ao alvo. De 12/13 para 11/13.

Somadas, as duas medem a mesma conclusão: **o volume de faltas não sai da
probabilidade por duelo, sai de quantos duelos acontecem por partida.**
Consertar de verdade exige mexer na densidade de disputa, não numa constante.

**Afrouxar mais o dreno de stamina (0,040 → 0,0375).** Põe a stamina em 65,1,
dentro da faixa. Mas jogador mais inteiro muda o jogo inteiro: o acerto ao alvo
cai de 0,361 para 0,337 (mínimo 0,34) e o 0 a 0 sobe de 0,092 para 0,125
(máximo 0,12). Placar geral de 10/13 para 9/13.

Ficar a **um décimo** do mínimo numa métrica custa menos do que derrubar duas
outras. Revertido.

Houve ainda um erro meu no meio do caminho: atribuí essa segunda regressão ao
`foulBase`, e só percebi ao ver os números reproduzirem **idênticos** com o
`foulBase` já revertido. A causa era a stamina. O comentário no código foi
corrigido.

## Placar final: 6/13 → 12/13

A única métrica fora é **faltas, 15,3 contra um mínimo de 16** — e a causa está
caracterizada acima: densidade de duelos, não probabilidade por duelo.

## Uma nota sobre o `momentum`

Enquanto investigava a bola de neve, descobri que `this.momentum` é **escrito**
(no chute, no gol), **decaído** a cada quadro — e lido **num único lugar**: a
exportação de estado para a interface. Ele não afeta o jogo. O painel
"MOMENTUM 50%" da tela é a única coisa que existe dele.

Não mexi: não é defeito, é um indicador. Mas vale saber que ele não é uma
alavanca de jogo, caso alguém tente usá-lo como uma.
