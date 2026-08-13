# D08 · A recontagem — a direção do desvio não é a alavanca

**Data:** 2026-08-13 · **Sonda:** `tools/fisica/ramo-d08.js` (24 partidas
pareadas) · **Resultado: a terceira premissa do D08 também cai.**

---

## O que a ficha mandava fazer

> "Recontar antes de atacar D08. Dos 5 pontos de chamada que este defeito
> listava, UM estava dentro do ramo morto de `_cross` e sumiu com a limpeza da
> D03. O clamp sobrevivente no motor é o do alívio na barreira; os demais estão
> nas camadas."
>
> Evidência antiga: *85,8% dos alvos a mais de 8 m da lateral; 16,8 alvos por
> partida mirados para fora ≈ 15,9 laterais medidos.*

A3 e A4 já haviam falhado. A hipótese sobrevivente era **a direção do desvio**:
corte, rebote e alívio seriam sempre mirados para dentro do campo.

---

## A recontagem

`ramo-d08.js` instrumenta o topo da pilha e lê a pilha de execução em cada
chamada, atribuindo o alvo ao **ponto de chamada real** — antes de qualquer
camada reescrevê-lo.

| ponto de chamada | /jogo | quota | dist. média até a lateral |
|---|---|---|---|
| `_deflectTo` → `onArrive` (cauda do próprio desvio) | 70,04 | 46,8% | 21,01 |
| `r12-transactional-core:186` (bote, fallback) | 27,75 | 18,5% | 24,98 |
| `s2:4765` (toque ruim, `looseTouches`) | 19,58 | 13,1% | 22,54 |
| `s2:3991` (OS-82, interceptação) | 12,13 | 8,1% | 20,68 |
| `os43-aerial-duel:50` | 6,13 | 4,1% | 21,20 |
| `r18182-duels:154` (duelo curto — **já mira para fora**) | 3,67 | 2,4% | **−0,20** |
| `r12-transactional-core:182` (duelo perdido) | 3,54 | 2,4% | 25,95 |
| `r1904-corte-que-sai:68` | 1,21 | 0,8% | 28,37 |
| os 10 restantes, somados | 1,74 | 1,2% | — |

**Duas correções à ficha.** O maior "ponto de chamada" (46,8%) não é um ponto de
chamada: é a cauda do próprio `_deflectTo`, que registra
`b.onArrive = () => this._looseBall(x,y)` com o mesmo alvo. E os pontos que
**já** miram para fora existem e funcionam — só respondem por 4,9 chamadas por
partida.

## O único mecanismo deliberado de "botar para fora"

`_r19ClearOut` (camada 86) é o que manda a bola para fora de propósito:

| tipo | tentativas (24 jogos) | sucessos |
|---|---|---|
| `poke` (bote) | 679 | **13** |
| `header` (corte de cabeça) | 40 | **16** |
| `clear` | **0** | 0 |

**1,21 saídas deliberadas por partida.** E 607 das 690 recusas — **88%** — são
geométricas: o portão `ALCANCE = 26` exige que o defensor esteja a menos de 26 m
da **própria linha de fundo**. O peso `clear` existe na tabela e **ninguém
chama** com ele.

---

## E aí a premissa cai

Se o problema fosse a direção, abrir o portão resolveria. Mas os alvos não estão
perto da linha porque **a bola não está perto da linha**:

| distância da bola até a lateral mais próxima | % do tempo de bola viva |
|---|---|
| 0–1 m | 1,3% |
| 1–3 m | 1,5% |
| 3–6 m | 2,0% |
| 6–10 m | 5,1% |
| 10–17 m | 16,3% |
| **17–34 m** | **73,8%** |

Média: **22,48 m**, contra 17,00 se a bola fosse uniforme na largura. A bola
vive **32% mais no miolo** do que o acaso.

E ela vive lá porque **os jogadores vivem lá**:

| | média até a lateral |
|---|---|
| jogadores de linha | **23,87 m** |
| o **mais aberto** dos 20 num quadro qualquer | **8,00 m** |
| alvo do passe | 21,53 m |

No futebol de elite há quase sempre alguém colado na linha. Aqui, o jogador mais
aberto de **todo o campo** está a 8 m dela.

> **Aritmética que fecha o caso.** A bola encosta a ≤1,5 m da lateral 30,7 vezes
> por partida: 15,6 voltam e **15,1 saem** — quase 50% de conversão. Não há um
> problema de conversão para consertar. Para chegar a 33–48 laterais é preciso
> **dobrar o tráfego perto da linha**, e nenhuma mudança na direção do desvio faz
> isso: o desvio só pode mandar para fora o que já está perto.

---

## Onde a largura se perde

A formação **não** é estreita. Medido por papel, distância da casa até a lateral:

| pos | casa DEF | casa ATQ | casa viva | ao vivo | com bola | sem bola |
|---|---|---|---|---|---|---|
| LWB/RWB | 12,9 | **5,3** | 10,1 | 13,3 | 11,9 | 14,8 |
| LB/RB | 15,7 | **6,9** | 10,5 | 14,9 | 14,2 | 15,5 |
| LW/RW | 16,5 | **6,9** | 16,4 | 20,8 | **18,5** | 23,2 |
| LM/RM | 17,1 | **7,6** | 13,3 | 17,6 | 14,8 | 20,2 |
| CB | 27,8 | 27,0 | 27,2 | 27,9 | 27,6 | 28,1 |

A casa ofensiva do ponta diz **6,9 m**. A camada 17 ainda o puxa para 6,5 m com
peso 0,76 fora do terço final. O `_attackTarget` **pede 10,13 m**. E ele joga a
**18,5 m com a bola no pé do time**.

A perda tem três parcelas, e nenhuma é a direção do desvio:

1. **A mistura.** `p.hy = lerp(p.dhy, p.ahy, tm.phase)` com `phase` média 0,484 —
   metade do tempo vale a casa defensiva, que é estreita de propósito. Legítimo.
2. **O alvo.** O `_attackTarget` pede 10,13 m, não 6,9: os `lerp(p.hy, FW/2, …)`
   de 0,10 a 0,55 comem a diferença.
3. **A chegada.** `|alvo − posição| = 4,11 m` em média. O jogador **nunca chega**
   ao alvo que ele mesmo pediu.

E a parcela 3 tinha um motivo que não era lentidão: **18,6% dos alvos de flanco
voltavam com `ty` NaN**. Isso virou o **D35**, medido e consertado em
`reports/D35-a-marca-que-nunca-sai.md`.

---

## O que fica decidido

**A direção do desvio está encerrada como hipótese do D08** — é a terceira, depois
de A3 (o arremesso) e A4 (o resgate da bola fora). Os três laudos concordam num
ponto: o que falta não é um ramo mal escrito, é **tráfego na linha lateral**.

**D08 continua aberto, com um enunciado novo e mensurável:**

> Os jogadores de flanco não ocupam a linha. O ponta joga a 18,5 m dela com a
> bola no pé do time, quando a própria casa ofensiva dele diz 6,9 m e o alvo
> pedido diz 10,13 m.

Isso é decisão de modelo — mexe em como o time ocupa a largura, não numa linha
de desvio — e deve ser medida **depois** do D35, porque o D35 mexe justamente na
parcela 3.

**Tetos que continuam valendo:** `throwIns <= 48`; `corners >= 10,68`;
`passes >= 379,7`; `goals ± 0,20`.
