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

| Métrica | antes (0,13) | agora (0,085) | faixa |
|---|---|---|---|
| Gols por partida | 1,97 ❌ | **2,91** ✓ | 2,4 – 3,2 |
| Finalizações | 13,2 ❌ | **20,5** ✓ | 20 – 30 |
| xG | 1,94 ❌ | **2,94** ✓ | 2,3 – 3,5 |
| Acerto ao alvo | 0,380 ✓ | 0,361 ✓ | 0,34 – 0,47 |
| Passe certo | 0,845 ✓ | 0,835 ✓ | 0,75 – 0,89 |
| Amarelos | 3,20 ✓ | 4,66 ✓ | 2,4 – 5,6 |
| Vermelhos | 0,083 ✓ | 0,183 ✓ | 0,06 – 0,3 |
| Escanteios | 5,33 ✓ | **8,93** ✓ | 5 – 11,5 |
| Empates | 41,7% ❌ | **28,3%** ✓ | 20 – 33% |
| 0 a 0 | 25,0% ❌ | **9,2%** ✓ | 4,5 – 12% |
| Goleadas | 10,0% ✓ | 16,7% ❌ | 2,5 – 13% |
| Stamina final | 57,8 ❌ | 63,9 ❌ | 64 – 83 |
| Faltas | 9,6 ❌ | 14,9 ❌ | 16 – 28 |

**6/13 → 10/13.** Gols (2,91) e xG (2,94) ficaram praticamente no alvo (2,8 e
2,9).

## Duas tentativas medidas e revertidas

Registro por inteiro, porque as duas ensinam algo sobre esta base.

**Subir `foulBase` de 0,29 para 0,33.** As faltas seguem em 14,9 contra um
mínimo de 16, e o miss é consistente. Mas o volume de faltas não sai da
probabilidade por duelo — sai de quantos duelos acontecem. Subir a
probabilidade só trocaria falta por cartão, e os amarelos já estão em 4,66 de
um teto de 5,6.

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

## Ainda aberto

- **Goleadas 16,7% contra um máximo de 13%.** Com gols em 2,91 o futebol real
  fica perto de 11%. A distribuição de placares é dispersa demais — e vale
  notar que a bateria põe o *mesmo elenco* contra si próprio, variando só
  formação e estilo, então uma taxa alta de goleada nessa população é mais
  grave do que parece. Suspeita a investigar: efeito bola de neve do
  `momentum`.
- **Faltas 14,9 contra um mínimo de 16** (acima).
- **Stamina 63,9 contra um mínimo de 64** — a um décimo, sem margem.
