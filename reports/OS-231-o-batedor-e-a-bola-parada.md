# OS-231 · O batedor não salta para a bola

**Relato do dono, desde a primeira mensagem da sessão:**
*"queria saber a bugadinha que dá na animação na hora que o jogador vai bater
falta, escanteio"* — e, muito depois, já com a OS-207 e a OS-229 entregues:
*"na hora da falta continua dando uma bugada máxima"*.

Este laudo registra três diagnósticos errados antes do certo. Os três eram
plausíveis, os três tinham código que os sustentava, e os três foram desmentidos
por medição. Ficam escritos porque o erro é a parte reaproveitável.

---

## 1. O que o dono via

No quadro em que a bola parada sai, o corpo do batedor aparece noutro lugar.
O motor faz isso de propósito — `snapTakerBeforeRestart` (`33-…:175`) crava
`taker.x = spotX` para a cobrança sair do ponto certo — e a apresentação, que
não pode piscar um corpo, **persegue** a posição nova com teto de passo
(`70-…:3601`, 15 m/s, o dobro do sprint). Um salto de 23,5 m vira **1,5 segundo
de um jogador patinando pelo gramado** enquanto a cobrança já aconteceu.

---

## 2. Três leituras erradas

### Erro 1 — "a culpa é do snap"

Camada que **desfazia** o snap e devolvia passos de caminhada.

| | controle | desfazendo o snap |
|---|---|---|
| pior salto na tela | 14,36 m | **0,35 m** |
| bateria (96) | 11/13 | **9/13** |
| `redsPerMatch` | 0,219 | 0,354 |
| `averageEndingStamina` | 64,59 | 63,80 |

Funcionou na tela e reprovou na bateria. E é tratamento de sintoma: o batedor
passa a chutar de longe da bola e o motor segue com ele fora de posição.
**Descartada.**

### Erro 2 — "o orçamento da caminhada é curto"

`armTaker(this, cand, sx, sy, 0.5, 1.8, true)` (`33-…:114`) parece dizer que a
falta só paga 8,45 m de caminhada. Estiquei o teto para 3,0 s.

A auditoria devolveu **`esticados: 0`**. O `1,8` não vale:

* a **OS-77** (bloco 63) já reorça a falta para `clamp(0,82 + d/6,5 , 0,82 , 4,2)`;
* `armTaker` tem **quatro** chamadas com tetos diferentes — falta `1,8`,
  lateral `3,2`, falta direta `4,0`, **escanteio `5,0`**.

Ler uma delas e generalizar foi o erro. É a quinta vez nesta base que aparece
o mesmo padrão: *um conceito é escrito, é lido, e não pode acontecer*.

### Erro 3 — "então estica a janela"

Teto de 10 s para todas as rotas:

| | controle (96) | janela de 10 s (96) |
|---|---|---|
| `goalsPerMatch` | 2,917 | **3,31** (faixa 2,4–3,2) |
| `blowoutRate` | 0,156 | 0,219 |
| bateria | 11/13 | **9/13** |

Faz sentido: quatro segundos a mais de bola morta são quatro segundos em que o
time inteiro termina de se armar na área. Isso é **rebalancear o jogo**, não
consertar defeito. **Descartada.**

---

## 3. A medição que resolveu

`scratchpad/aproximacao.js` — para cada espera: quanto o batedor tinha de andar,
quanto andou, quanto sobrou para o snap, e **qual era a janela**.

```
precisava  andou  snap   janela   quadros parado
   33,5     26,8   7,2    5,00        0%
   29,0     27,6   1,3    5,00        3%
   34,4     32,3   2,3    5,00        0%
   50,1     32,3  17,9    5,00        0%
   32,9     31,4   2,1    5,00        0%
   54,6     31,6  23,5    5,00        0%

8 de 48 lances com snap > 1 m — e os OITO com janela de 5,00 s.
média: precisava 41,4 m · andou 30,5 m · usou 5,03 s · 0% de quadros parado
velocidade efetiva 6,05 m/s
```

Janela de 5,00 s é a assinatura de **uma** chamada: `armTaker(..., 0.8, 5.0)` em
`33-…:237` — **o escanteio**. O batedor não está preso nem disputado: anda a
passo cheio o tempo inteiro e a janela acaba.

**E a falta nunca foi o problema.** O `F6` da sonda lia `__cdsTakerWait` sem
perguntar de que lance ela era, então o salto do escanteio era contado contra a
falta aberta pouco antes. Com o instrumento corrigido, o controle mede:

```
FALTA      F6 batedor não salta   12/13  92,3%   pior 0,39 m   <- sempre esteve bem
ESCANTEIO  E2 batedor não salta    4/13  30,8%   pior 15,63 m  <- o defeito
```

Quase 7 de cada 10 escanteios. Com 12,8 escanteios por partida, é o defeito que
**se repete por partida** — o que o dono pediu para caçar.

---

## 4. A correção

Se o tempo não pode crescer, a velocidade pode — e era ela que estava errada.
Toda a máquina de bola parada move o atleta a `maxSpd * 0,92`: um passo de
**reposicionamento**. Mas quem vai *bater* um escanteio não se reposiciona, ele
corre. A única razão de ele andar era não existir distinção entre "voltar para o
posto" e "ir buscar a bola".

Enquanto a bola está morta e **só para o batedor**, `maxSpd` é elevado pelo fator
que falta para ele chegar, restaurado no mesmo passo num `finally`.

O teto do fator não é questão de gosto: o orçamento da R18.99 satura a
velocidade em `maxSpd * 1,05` lendo o valor já reforçado, e a varredura de
sanidade vigia `maxSpd * 1,6`. Qualquer fator abaixo de `1,6/1,05 = 1,523` passa
para **qualquer** atleta. Com 1,55 a sanidade acusou 21 quadros de
`jogador_rapido_demais` (11,5 m/s); **1,50** é o maior valor redondo seguro.

**O tempo de bola morta não muda: mesma janela, mesma organização na área,
mesmo futebol. Muda só quem chega.**

### O resto do escanteio

A corrida paga 48,8 m na janela de 5 s. O que sobra é escanteio, e por um motivo
que não está na bola parada: o batedor é escolhido em `40-…:2731` por
`facet(p,'setpiece')` — **o melhor cobrador do time, onde quer que ele esteja**.
A distância não entra na conta, e já o vi ser chamado de 63,5 m.

Trocar o escolhido resolveria a distância e quebraria a medição: a rotina lê
`facet(taker,'setpiece') > 72 && chance(.38)`, então outro batedor muda **o
consumo do gerador seedado** e a bateria pareada passa a medir caos em vez de
efeito — exatamente o que o §OS-74 documenta em `40-…:2748`.

Então o tempo cede, e **só no escanteio**: 12,8 por partida contra 22 faltas, e
apenas ~1 em 4 precisa. Janela até 7,5 s.

---

## 5. Uma lição sobre o próprio instrumento de bateria

Ao comparar 1,55 contra 1,45 a 96 partidas, o placar foi 11/13 contra 8/13 — e a
velocidade de trote de um jogador não pode mexer nisso. A verificação:

**o controle, sem nenhuma alteração, mede 11/13 a 96 partidas e 10/13 a 288.**

`blowoutRate`, `redsPerMatch` e `goalsPerMatch` são métricas de contagem baixa e
ficam na borda da faixa; a 96 partidas o placar é ruído na casa do 1–3 pontos.
**Comparação de dose só vale a 288 partidas ou mais** — anotado como armadilha
nº 9 do briefing.

---

## 6. Estado medido

### Bateria pareada, 288 partidas

| métrica | controle | OS-231 |
|---|---|---|
| `goalsPerMatch` | 2,979 | 2,979 |
| `shotsPerMatch` | 24,55 | 25,22 |
| `xgPerMatch` | 3,05 | 3,10 |
| `passCompletion` | 0,822 | 0,823 |
| `foulsPerMatch` | 22,07 | 22,20 |
| `zeroZeroRate` | 0,087 | 0,066 |
| `blowoutRate` | 0,198 | 0,184 |
| `averageEndingStamina` | 64,59 | 64,12 |
| **placar** | **10/13** | **11/13** |

`onTargetRate` (0,31) e `cornersPerMatch` (12,8) seguem fora da faixa nos dois —
são o custo declarado da OS-212 e um item aberto anterior, não desta ordem.

### Tela — mesma sonda corrigida, 780 s em cada bundle

| invariante | controle | OS-231 |
|---|---|---|
| FALTA `F6` pior salto | 12,91 m | **0,54 m** |
| FALTA `F2` pior erro da bola | 22,04 m | 4,01 m |
| FALTA `F3` pior distância à bola | 18,54 m | 4,83 m |
| ESCANTEIO `E2` pior salto | **31,29 m** | **0,38 m** |
| ESCANTEIO `E4` sem salto visível | 9/14 · 64,3% | **9/9 · 100%** |
| LATERAL `L5` pior salto | 0,05 m | 0,06 m |

Todo "pior salto" caiu para **abaixo de um passo humano**. A corrida também
resolveu a falta direta (rota `_freeKick`, janela 4,0 s), que tinha o mesmo
snap e o mesmo aperto de janela — 12,91 m viraram 0,54 m.

O resíduo de `F2`/`F3` em ~4 m é da própria sonda: `_freeKick` também é chamado
fora da cadeia de `_awardFoul` e ali a amarra cai numa falta antiga. É uma ordem
de grandeza menor que os 22 m do controle e não é defeito do motor.

---

## 7. O instrumento também estava errado — duas vezes

1. **Sem separar a rota**, o salto do escanteio era cobrado da falta. Corrigido
   com etiqueta de rota cravada *dentro* da chamada que cria a espera (ler uma
   variável "rota atual" depois do passo devolve sempre `null`, porque o
   `finally` já a restaurou — a mesma armadilha nº 4 do briefing, de novo).
2. **Falta que não vira reinício não morria.** Com a rota separada, uma falta em
   que o juiz deu vantagem sobrevivia e era casada com o reinício da falta
   *seguinte*, medindo a bola nova contra o ponto velho: `F2` acusou 14,45 m e
   `F3` 15,49 m de defeito inexistente. Agora expira por rota e por tempo (30 s).

Seção `ESCANTEIO` nova, com `E4` medindo o que o dono vê (salto ≤ 2 m) em vez de
só o passo físico (≤ 0,4 m).

---

## 8. Itens abertos

* `cornersPerMatch` 12,8 contra teto de 11,5 — anterior a esta ordem.
* `onTargetRate` 0,31 contra piso de 0,34 — custo declarado da OS-212.
* `bola_parada_fora_do_campo`, 96 quadros por partida, **idêntico no controle** —
  bola parada logo atrás da linha de fundo durante um reinício. Pré-existente.
* Saída de bola após gol: `G1`/`G2` seguem 0/N. Item aberto anterior.
* O batedor de escanteio escolhido sem olhar distância (`40-…:2731`) continua
  sendo a causa de raiz da caminhada longa. Trocar o critério exige rodada de
  calibração própria, porque muda o consumo do gerador.
