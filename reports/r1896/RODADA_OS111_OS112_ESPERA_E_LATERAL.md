# RODADA OS-111 / OS-112 — a espera, e o lateral

**Build de partida:** R18.97 · `df4d9f28…`
**Origem:** três observações do dono, jogando a build promovida.

> *"Um problema que eu achei foi a maneira que os jogadores ficam esperando o
> escanteio e a falta."*
> *"Mostre a bola realmente saindo pra fora no lateral."*
> *"Os jogadores não se aproximam pra receber o lateral, falta isso também."*

As três estavam certas, e a primeira era **defeito meu** — introduzido pela
OS-107 na rodada anterior.

---

## 1. A espera (OS-111) — eu tinha feito eles correrem no lugar

`diag_os110_como_eles_esperam.js`, 8 partidas.

O pino da OS-107 re-armava `__spTarget` sempre que o jogador se afastava mais de
0,45 m do posto. Quem executa o retorno é a camada R15 (`:18270`), e ela caminha
a `maxSpd * 0,92` — **~6 m/s, que é velocidade de corrida**. Resultado: para
cobrir 45 cm, o jogador arrancava.

| escanteio | R18.96 (sem pino) | R18.97 | **R18.98** |
|---|---:|---:|---:|
| **re-armes do alvo por jogador** | 0 | **5,385** (p90 14, máx **24**) | **0** |
| quadros acima de 4 m/s | 26,1% | **34,8%** | **19,3%** |
| quadros acima de 2 m/s | 54,2% | 54,8% | **30,9%** |
| velocidade de quem já chegou (mediana) | 3,558 | 4,141 | **1,200** |

Vinte e quatro repuxões numa única bola morta de ~5 s é um repuxão a cada 0,2 s.
Era tremor, e o dono viu antes de qualquer instrumento.

**A correção troca corrida por contenção.** Perto do posto o jogador não corre de
volta: ele apenas não consegue escapar de uma folga de 0,9 m, e a velocidade
exibida é limitada a 1,2 m/s — **abaixo do limiar de `moving` (2 m/s, `:4910`)**,
então ele lê como parado. Só quem for deslocado além de 3,0 m volta caminhando,
com a máquina da R15.

Na falta cruzada o mesmo: re-armes 3,61 → **0**, quadros acima de 4 m/s 32,4% →
23,6%.

---

## 2. A bola sai de fato (OS-112 · E1) — e é apresentação pura, provada

`diag_os112_lateral_saida_e_apoio.js`, 68 laterais.

| | R18.97 | **R18.98** |
|---|---:|---:|
| **quadros com a bola FORA do campo** | **0** (min, mediana e máx) | **91** (mediana) |
| quanto ela passa da linha | 0,92 m no apito, e volta | **1,957 m** (máx 3,12) |
| do cruzamento ao ponto de reinício | 1,983 m | 1,976 m |

`:17145` e `:16691` chamam `_ballOut` no instante exato em que `b.y` cruza a
linha, e alguma camada já a traz para dentro dentro da própria chamada. A bola
cruzava a linha e **no mesmo quadro já estava de volta**.

### A previsão P2 foi falsificada, e o erro valeu a pena

Eu registrei antes de medir: *"a `impressaoPorJogo` com `--apoio=0` vai ser
idêntica à da R18.97"* — ou seja, levar a bola para fora seria apresentação pura.

**Medi e não era.** Primeira tentativa: impressão `1f7e53fc…` contra `e306d450…`.
O motivo: `_movePlayers` roda durante a bola morta (`:4850`) e lê a posição da
bola, então a bola passeando movia os jogadores.

Segunda tentativa, devolvendo a bola no início de cada quadro: **ainda
diferente**. O motivo do segundo erro foi meu: eu devolvia a bola ao ponto do
**cruzamento**, que é fora do campo — e a medição já tinha dito que o motor nunca
vê a bola fora (`quadros fora = 0`). Eu estava devolvendo a bola para um estado
que a simulação nunca conhece.

Terceira: guardar o estado completo da bola **logo após** `_ballOut` e devolver
exatamente esse estado no início de cada quadro, escrevendo a posição de exibição
só depois que o núcleo terminou.

```
R18.97          impressaoPorJogo  e306d450d5ecdfb7
só a saída (v3) impressaoPorJogo  e306d450d5ecdfb7   ← idêntica
médias divergentes: nenhuma
```

**Idêntica, e as nove médias batem uma a uma.** Pelo critério do próprio projeto
(HANDOFF §3.1), isto prova que a saída da bola não tocou a simulação.

---

## 3. Alguém se oferece (OS-112 · E2)

| por lateral | R18.97 | **R18.98** |
|---|---:|---:|
| **companheiros a menos de 8 m do ponto** | **0,088** | **0,980** |
| companheiros a menos de 12 m | 0,162 | **2,796** |
| adversários a menos de 8 m | 0,838 | 1,857 |
| janela de bola morta (mediana) | 2,467 s | 3,067 s |

Em ~91% dos laterais **não havia um único companheiro a menos de 8 m**, e havia
mais adversário perto do que companheiro. O cobrador não tinha para quem jogar.
Não existia coreografia de lateral em lugar nenhum: a OS-100 (`:21556`) trata o
cobrador e mais ninguém.

Três companheiros passam a receber posto — curto à frente, apoio atrás,
profundidade pela linha — e **dois adversários marcam os dois primeiros**. Os
marcadores não são enfeite: sem eles o lateral vira passe livre e a posse do jogo
inteiro muda de patamar.

Ninguém é teleportado: os postos viram `__spTarget` e a caminhada é a mesma
máquina da R15, segurada pelo pino já corrigido da OS-111.

---

## 4. O escanteio e a falta continuam certos

A OS-111 mexe no pino, então era obrigatório reconferir que ela não desfez a
OS-107. Não desfez — melhorou:

| | R18.97 | R18.98 |
|---|---:|---:|
| postos ocupados no reinício, escanteio | 94,3% | **97,2%** |
| atacantes na área no reinício, escanteio | 2,233 | **2,476** |
| postos ocupados no reinício, falta cruzada | 97,9% | **100,0%** |
| atacantes na área no reinício, falta | 2,957 | **3,000** |

Faz sentido: contenção segura melhor que corrida, porque a corrida ultrapassava o
posto e voltava.
