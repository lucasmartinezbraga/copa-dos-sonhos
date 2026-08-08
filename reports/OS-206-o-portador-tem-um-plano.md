# OS-206 · O portador passa a ter um plano

Conserta os defeitos que a leitura da partida (OS-205) encontrou e que nenhuma
métrica via.

## O que mudou

| | antes | depois | referência |
|---|---|---|---|
| Mediana de posse individual | 0,43 s | **1,03 s** | ~1,1 s no futebol real |
| Posses abaixo de 0,5 s | 73% | **30%** | |
| Posse relâmpago por partida | 650 | **216** | |
| **Drible parado** (3+ no mesmo lugar) | 6,8 | **0** | |
| Impedimento repetido | 4,0 | **3,0** | |

A curva de sobrevivência da posse era um precipício e virou uma rampa:

```
                      antes    depois
com a bola ha 0,28s    26%      88%      <- o precipicio sumiu
com a bola ha 0,84s    67%      72%
com a bola ha 1,68s    82%      66%
```

Existe agora o regime do meio — recebe, dá um toque, espera o apoio, passa —
que era o que faltava.

## Onde a correção mora, e por que não no lugar óbvio

O portão da decisão do core tem duas travas:

```js
if (!ball.traveling && ball.owner && ball.owner.settle <= 0 && this.decideT <= 0)
```

**`decideT` não serve.** A camada R13 reescreve ele todo quadro por fase de
jogo (`Math.min(sim.decideT, .20/.31/.44)`) e só o abaixa. Qualquer valor que
eu escrevesse ali seria derrubado — seria a quarta edição silenciosamente morta
deste projeto.

`settle` ninguém toca depois da recepção, e diz exatamente o que se quer dizer:
"este jogador ainda está resolvendo o que fazer". Ele continua correndo e a bola
continua colada nele, então o que se vê é condução.

**Cuidado registrado:** `settle > 0 && settle < 0,45` é lido em dois pontos do
core como "finalização de primeira". O plano nunca escreve dentro dessa janela
— usa 0,60 — senão um passe normal viraria voleio.

## O achado que a tentativa produziu

Segurar a bola **em todo o campo** derrubou o jogo de 11/13 para **6/13**:
chutes 21,2 → 16,4, gols 2,81 → 2,24. E a varredura de duração não recuperou —
mesmo com plano curto, os chutes ficaram em 18,2.

Isso é diagnóstico, não fracasso:

> **Este motor só gera chance com circulação rápida.** Ele não tem construção de
> jogada com posse. Tirar velocidade de circulação no último terço desmonta o
> ataque inteiro.

Por isso o plano vale só até a **metade do campo** (`limiteAvanco: 0.50`) —
onde conserta a aparência sem tocar na máquina de criar chance. Varrido em 120
partidas: até 62% do campo os chutes ficam em 19,5 (abaixo do mínimo); até 50%
sobem para 22,0.

## O cartão por falta estava compensando um bug

Com mais posse vieram mais duelos e as faltas subiram de 15,5 para 22,3 —
**dentro da faixa real de 19–26 pela primeira vez.** Aí os cartões estouraram:
6,2 amarelos e 0,48 vermelhos.

A causa não era a mudança. Era que a taxa de cartão por falta estava em
**0,279** contra **0,177** do futebol real, e isso ficava invisível enquanto o
jogo tinha poucas faltas: dois erros se cancelavam. `yellowFirst` foi de 0,18
para 0,125 e os cartões voltaram (4,67 e 0,275).

Isto também explica a OS-202 em retrospecto: as faltas nunca saíram de 15,3
porque o problema não era a probabilidade por duelo nem o número de duelos —
era **quanto tempo a bola fica num pé**.

## Placares

**Alvos de design: 11/13** (igual à referência, mas com faltas dentro da faixa
em vez de stamina).

**Futebol real: 12/21** (era 10/21).

| ganhou | | perdeu | |
|---|---|---|---|
| Faltas | 15,48 → **22,33** ✓ | Passes | 587 → **394** |
| Finalizações | 21,20 → **22,03** ✓ | Goleadas | 0,143 → 0,200 |
| Escanteios | 9,44 → **10,08** ✓ | Chutes no alvo | 7,27 → 7,22 |
| Gols tardios | 0,125 → 0,150 | | |

## O custo, e a tensão estrutural que ele revela

**Passes caíram de 587 para 394**, contra 750–1000 do futebol real. É a
consequência direta e esperada: se cada jogador segura a bola o dobro do tempo,
cabem menos passes.

E as duas coisas não podem estar certas ao mesmo tempo neste motor. A conta:

```
o jogo simula ~23 minutos de fisica para uma partida de 90 minutos
ciclo de posse atual = 1,0 s no pe + 1,1 s de voo = ~2,1 s
1.200 s de bola viva / 2,1 s = ~570 ciclos
```

Para chegar aos ~900 passes do futebol real seria preciso um ciclo de ~1,3 s, o
que significa 0,4 s de posse — a batata quente de volta. **Ou se tem posse
realista, ou se tem contagem de passes realista, não as duas** — enquanto
`clockRate` comprimir 90 minutos de futebol em 23 de simulação.

Destravar isso é baixar o `clockRate` (mais simulação por minuto de jogo) e
compensar na velocidade de tela. Custa tempo de partida e é decisão de produto,
não de física — fica registrado, não mexido.

## Ainda aberto

- **Passes 394** contra 750–1000 (acima).
- **Impedimentos 10,0** contra 2,5–6 — melhorou pouco.
- **Laterais 16,5** contra 33–48 — a bola quase não sai pelas linhas.
- **Gols no 2º tempo 42,9%** contra 50–60% — a fadiga uniforme da OS-204 segue
  de pé; a partida ainda murcha em vez de crescer.
