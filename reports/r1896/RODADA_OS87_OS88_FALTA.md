# RODADA OS-87 / OS-88 · a batida de falta

> Pedido do dono: *"Preciso que melhore completamente a parte das faltas, se
> possível recrie completamente a batida de falta."*

Build entregue: **R18.89**, sha256
`a49741fdf007f16e22d36bd4a02119a49ab9b67e42b46da7b271858a3c1a09f7`.
Cadeia: R18.87 → `patch_os87_falta.js` → R18.88 → `patch_os88_momento_falta.js`
→ R18.89.

---

## 1. O que a falta era, medido

8 partidas, protocolo espelho, instrumentando `_awardFoul`, `_freeKick` e o
evento `freekick`:

| grandeza | R18.87 |
|---|---:|
| faltas por partida | 12,00 |
| viram cerimônia de cobrança | 6,50 |
| rotinas | 28 direta · 24 cruzada · **0 curta** |
| cena dedicada `fk_scene` emitida | **0** |
| **cobrador → bola no instante do chute** | **mediana 9,162 m** · p90 17,729 · máx 22,385 |
| espera do apito até o chute | **1,7 s — min = mediana = máx** |
| bola sai do ponto | 0,00 m em todas *(isto estava certo)* |
| adversário mais próximo | 9,04 a 9,51 m *(regra cumprida)* |
| barreira | 3 a 4 jogadores, armada em 50 de 52 |
| desfechos das diretas | 15 defesa · 6 barreira · 5 fora · 2 gol |

Duas coisas saltam.

**Metade das cobranças era chutada por ninguém.** A bola saía do ponto enquanto
o cobrador estava a 9 metros dela. É o padrão do HANDOFF §4 — o desfecho existe
na estatística e não tem consequência física.

**A espera era um cronômetro.** 1,7 s em 28 cobranças, sem um único desvio.

---

## 2. A causa, com `arquivo:linha`

Não faltava máquina. A camada R18.35 (`:21555`–`:21574`) **já** faz o cobrador
caminhar até a bola com `armTaker`, e funciona no lateral e no escanteio. O que
ela erra é **identificar** o cobrador:

```js
:21565  // batedor = jogador do time agora mais próximo do ponto
        //          (o núcleo o pôs lá)
:21567  for (...) { var dd = dist(p.x,p.y,spotX,spotY); if (dd<cd) {...} }
```

A premissa *"o núcleo o pôs lá"* só vale para o ramo `crossed`, que teleporta em
`:6922`. **O ramo `direct` não teleporta ninguém.** Então, na falta direta, a
camada elegia o jogador mais próximo do ponto — quase sempre a **vítima** da
falta — e fazia **ele** caminhar até a bola, enquanto `_os36Bater` (`:6946`)
chutava usando `taker`, o especialista de bola parada escolhido em `:6894`, que
nunca saía do lugar.

Um jogador caminhava até a bola e outro a chutava de longe.

O escanteio já resolvia isso do jeito certo: o núcleo marca o cobrador com
`_setPieceRole='taker'` (`:7107`) e a camada de caminhada procura a marca
(`:21584`). A direta passou a usar a mesma convenção.

---

## 3. OS-87 — o que mudou no motor

1. o ramo `direct` marca o cobrador com `_setPieceRole='taker'`;
2. a camada de caminhada **prefere a marca**; proximidade vira só desempate;
3. o cobrador caminha para um ponto de aproximação **1,4 m atrás da bola**, na
   linha bola→gol — quem bate falta chega por trás dela, olhando para a meta;
4. a marca morre com o lance, para não contaminar a próxima bola parada.

### Resultado

| grandeza | R18.87 | R18.89 |
|---|---:|---:|
| **cobrador → bola no chute** | mediana **9,162 m** · p90 17,7 · máx 22,4 | **1,400 m** — min = mediana = máx |
| espera do apito até o chute | 1,7 s constante | 1,7 → 4,1 s, mediana 2,5 |

Chega em **100%** das cobranças. Com os bonecos ocupando ~2,4 m de largura
(decisão deliberada, HANDOFF §8), 1,4 m põe a bola na borda do corpo dele.

---

## 4. Bateria de promoção — seis bases, 144 jogos por build

| | R18.86 | R18.89 | Δ |
|---|---:|---:|---:|
| **xG** | 2,1823 | **2,1795** | **−0,1%** |
| faltas | 14,118 | 14,236 | +0,8% |
| no alvo | 7,840 | 7,826 | −0,2% |
| passes | 463,64 | 463,72 | 0,0% |
| gols | 2,3403 | 2,2639 | −3,3% |
| chutes | 20,840 | 20,347 | −2,4% |
| escanteios | 4,922 | 5,486 | **+11,5%** |

Gates, nas seis bases: `ECO-02 xG ≤ 2,7` passa (máx 2,234); `ECO-05` escanteios
4–10 passa; gols 1,8–3,0 passa em **todas** — inclusive na base 6300000, onde a
R18.86 promovida **reprova** com 1,667 e a R18.89 dá 2,083.

**Correção de leitura importante:** a amostra de 8 partidas acusou faltas indo de
12,00 para 15,38 (+28%). Em 144 jogos são **+0,8%**. Era ruído — o mesmo erro
que a memória do projeto já registrava sobre julgar candidata por uma base.

O maior desvio real é **escanteios, +11,5%**. Fica registrado, dentro do gate.

---

## 5. OS-88 — o momento, e o que NÃO foi refeito

A cobrança resolvia e a bola voava em 0,217 s de simulação — **0,12 s de relógio
de parede no 2X**, exatamente o número que tornava o chute para fora ilegível
antes da OS-84. A pose de chute (`motionAt(e.by,'kick')`, `:12455`) já existia e
ninguém a via.

OS-88 arma `slowmo` de 700 ms a 0,35 no evento `freekick`, **só na direta** —
mesma alavanca de `:12507`, que reduz o passo da apresentação e não o da
simulação. **Impressão jogo a jogo idêntica à R18.88** (`12ad3a8023249f1a`):
apresentação pura, não vazou.

### O que já existia e eu deliberadamente não refiz

Verificado, não suposto: círculo de 9,15 m tracejado, marca ao pé de cada
jogador da barreira e anel do cobrador já são desenhados pela camada OS-20/OS-50
em canvas próprio (`:24730`–`:24771`). O desfecho da bola já é coberto pela
OS-84, porque a direta emite `miss` no ramo de fora e chama `_goal` no de gol.

### A barreira: medi e decidi NÃO mexer

O contador `quadrosDeInvasaoContida` subiu de 5753 para 8967 (111 → 149 por
falta) e eu suspeitei de tremor. Medi o deslocamento por quadro:

| grandeza | valor |
|---|---:|
| passo por quadro, mediana | **0,0644 m** |
| p99 | 0,239 m |
| máximo | 0,3275 m |
| teto físico (7 m/s × dt) | 0,2333 m |
| passos acima do teto | 770 de 67 748 = **1,14%** |
| inversões de direção > 135° | **5,75%** |

O contador é sobretudo contabilidade: jogadores encostados no círculo sendo
segurados lá, que na tela é gente parada na borda. **Não gastei rodada
consertando um contador.** O que fica aberto e é real: 1,14% dos passos passam
do teto físico, com máximo de 0,33 m num quadro.

### A cena dedicada — e por que não a liguei

`fk_scene` é consumida em `:12546` e **nunca emitida** pelo motor: existe uma
cena cinematográfica de falta completa, morta em partida. Antes de ligá-la, li
`:12564`:

> *OS-55 · a cutscene de penálti do JOGO foi removida: ela apagava o campo
> inteiro por 3,9 s e pausava o simulador, que é exatamente o mini game que já
> tinha sido tirado da falta.*

A cena não está morta por esquecimento — foi **morta por decisão**, e o pênalti
está desligado com `if (false && ...)` pelo mesmo motivo. Ligá-la seria desfazer
a OS-55 sem medir. O peso do lance foi dado no gramado, com câmera lenta.

---

## 6. O que continua aberto na falta

| item | estado |
|---|---|
| rotina **curta** | **0 de 60** cobranças. Nunca acontece. Não investiguei o porquê. |
| desfechos | 22 defesa · 8 fora · 5 barreira · **0 gol** em 35 diretas (eram 2 em 28). n pequeno, e `resolveFreeKickPhysics` não foi tocada — mas 54% de defesa é alto para futebol real. |
| espera | subiu para mediana 2,5 s, p90 4,1 s. É tempo morto: ~7,5 cobranças × ~1 s extra por partida, contra os 35,7% de andamento que a OS-78 comprou. |
| corrida de aproximação | o cobrador **chega** e espera parado. Não há passada final para dentro da bola. |
| goleiro | não se reposiciona de forma legível para a barreira/ângulo. |
| passo acima do teto | 1,14% dos quadros na janela de barreira. |

---

## 7. Artefatos

- build: `Downloads/COPA DOS SONHOS - R18.89 - FALTA.html`
- patches: `patch_os87_falta.js`, `patch_os88_momento_falta.js`
- diagnósticos: `diag_os87_falta.js` (censo completo da falta),
  `diag_os88_barreira.js` (tremor da barreira)
- bateria: `bateria_espelho30.js`, seis bases
