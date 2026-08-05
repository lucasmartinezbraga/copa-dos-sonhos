# RODADA OS-107 — o time vai para o lance no escanteio e na falta

**Build de partida:** R18.96 · `a335bbba8aad76a40df4399bbc32ebf995116e46f0e73fcdf31b4a3fa14ca164`
**Item da fila:** `PROXIMA_RODADA.md` · PARTE A · A1 — o pedido mais antigo do dono ainda aberto.

> *"Quando acontecer o escanteio o time tem que ir pra área, mesma coisa a falta,
> isso você está pecando, o time não se move para a direção do lance igual em uma
> partida real."*

Nada tinha sido medido nesta frente. Esta rodada mediu, corrigiu, e **a correção
foi reprovada pela bateria**. O defeito está descrito com número; a correção
funciona e está no repositório **fora da cadeia**, com o número que a derrubou.

---

## 1. O censo, antes de escrever qualquer coisa

`tools/r1896/diag_os107_bloco_bola_parada.js`, 12 partidas, protocolo do espelho.
Não escreve posição, não consome RNG. Tudo ancorado **no gol do lance**, nunca no
alvo do jogador (HANDOFF §2.4).

Metade das chamadas de `_setCorner` é administrativa — as camadas R18.18.2/3
(`:22581`, `:22869`) devolvem cedo e a cerimônia nunca roda. Misturar as duas
populações dilui o número, então elas estão separadas.

### Escanteio com cerimônia — 64 lances, 5,33 por partida

| | medido |
|---|---:|
| postos de área por lance | 2,39 |
| **chegou** ao posto alguma vez | **146 de 146 — 100%** |
| **ainda estava na área no reinício** | **42 de 146 — 28,8%** |
| distância do posto ao gol no reinício | mediana **19,65 m** |
| atacantes na grande área no reinício | **0,656** |
| defensores na grande área no reinício | 5,078 |
| bloco atacante → gol que ataca | 40,45 m |
| teleporte no apito | 0 de 1279 |

**Na hora em que o escanteio é cobrado, o time que ataca tem menos de um jogador
dentro da área.** Não porque a coreografia falhe: ela acerta 100%. Ela é
**desfeita** nos ~3 s de bola morta que sobram depois da chegada.

### Falta cruzada — 42 lances, 3,50 por partida

| | medido |
|---|---:|
| postos de área por lance | 3 |
| **armados para caminhar** | **0 de 126 — 0%** |
| **teleporte no apito** | **247 de 840, máximo 70,40 m** |
| atacantes na área: apito → reinício → +1,0 s | 3,00 → 1,12 → **0,67** |
| **defensores dentro da própria área** | **0,095** no apito · 0,262 no reinício |
| bloco defensor → próprio gol no apito | 36,15 m |

**Na falta cruzada o time não vai para a área: ele aparece lá** — e um segundo
depois já saiu. E **o time que defende não vai para a área nunca**: zero vírgula
zero nove defensor dentro da própria grande área no instante do apito.

---

## 2. O mecanismo, com arquivo:linha

**D1 · `:18287`** (camada R15, *bola parada sem teleporte*)

```js
if (d <= max || d < 1e-6) { p.x = t.x; p.y = t.y; p.__spTarget = null; ... }
```

O posto é **abandonado na chegada**. Depois disso não há nada segurando o jogador,
e a IA tática normal o puxa de volta durante o resto da bola morta. É a armadilha
§2.4 do HANDOFF na forma mais pura: o agente é armado, chega, e vai embora.

A OS-100 já tinha resolvido exatamente isto — **para um jogador só**, o cobrador
do lateral, com "o pino" (`:21556`). Nunca foi generalizado para o time.

**D2 · `:6951`** (`_freeKick`, ramo `crossed`)

```js
aerial.slice(0,3).forEach((a,i)=>{ a.x = clamp(vg.x - tm.attackDir*(7+i*2.8),…); a.y = …; });
```

A R15 envolve `_setCorner`, `_goalKickOrRestart` e `_kickoff`. **Não envolve
`_freeKick`.** Os três alvos são escritos direto — 247 saltos acima de 3 m.

**D3 · `:6951`**, mesmo ramo: o time que defende não recebe posto nenhum. O
escanteio arma quatro marcadores em `:7160`; a falta cruzada não arma ninguém.

---

## 3. A correção — `tools/r1896/patch_os107_bloco_bola_parada.js`

Um mecanismo só: *a forma da bola parada é caminhada e **segura** até a cobrança,
dos dois lados.* Três edições separáveis por flag, para que a bateria consiga
atribuir efeito a cada uma.

- **E1 · o pino coletivo** (`--pino`) — enquanto a bola está morta, quem foi armado
  e chegou continua sendo puxado para o posto. Usa a máquina de caminhada que já
  existe; não escreve posição. O cobrador fica de fora (armadilha A3).
- **E2 · a falta cruzada caminha** (`--falta`) — mesmo desenho da R15 aplicado a
  `_freeKick`. Teto de `dead` 5,0 s, que é **o mesmo que `:21556` já usa** para o
  cobrador do escanteio chegar à bandeirinha. Nenhum número novo foi inventado.
- **E3 · a defesa vai para a área na falta cruzada** (`--defesa`) — cinco postos
  entre 5,0 e 11,4 m do próprio gol. Cinco porque é o que o escanteio já põe lá
  (5,078 medidos), e essa proporção já passou pelos gates.

### Previsão registrada ANTES de medir

| | direção |
|---|---|
| P1 teleporte no apito da falta cruzada | desce a zero |
| P2 defensores dentro da própria área na falta | sobe |
| P3 postos ainda ocupados no reinício do escanteio | sobe |
| P4 atacantes na grande área no reinício do escanteio | sobe |
| P5 bloco atacante → gol no escanteio | desce |
| P6 escanteios | **sobe** |
| P7 xG | **sobe** |
| P8 gols | **desce** — o risco da rodada, escrito de propósito |

---

## 4. O mecanismo funciona — censo depois

| | R18.96 | com OS-107 |
|---|---:|---:|
| **escanteio** | | |
| postos ainda na área no reinício | 28,8% | **93,6%** |
| atacantes na grande área no reinício | 0,656 | **2,180** |
| atacantes na grande área em +1,0 s | 0,794 | **2,567** |
| distância do posto ao gol no reinício | 19,65 m | **9,35 m** |
| bloco atacante → gol | 40,45 m | **37,46 m** |
| defensores na grande área no reinício | 5,078 | 5,279 |
| **falta cruzada** | | |
| teleporte no apito | 247 de 840 | **0 de 920** |
| maior salto de um atacante | 70,40 m | **0,00 m** |
| armados para caminhar | 0% | **100%** |
| atacantes na área no reinício | 1,12 | **3,00** |
| defensores na própria área no reinício | 0,262 | **4,500** |
| defensores na própria área em +1,0 s | 0,952 | **4,783** |
| bloco defensor → próprio gol no reinício | 32,47 m | **24,84 m** |
| janela de bola morta | 1,73 s | 5,07 s |

**P1 a P5 confirmadas.** O defeito descrito no censo deixa de existir: o time
caminha até a área, dos dois lados, e ainda está lá quando a bola é cobrada.

---

## 5. A bateria decide — e reprova

Protocolo `espelho_30`, 24 partidas × 6 bases = 144 partidas por build.
A base reproduz o relatório da R18.96 número a número, o que valida o arranjo:
gols 2,1805 (documentado 2,181), xG 2,1930 (2,193), escanteios 4,785 (4,785),
chutes 19,21 (19,21), passes 442,0 (442,0).

| build | gols | pior base | xG (máx) | escanteios (pior) | chutes | veredito |
|---|---:|---:|---:|---:|---:|---|
| **R18.96** | 2,1805 | 1,8750 | 2,193 (2,289) | 4,785 (4,000) | 19,21 | passa 6/6 |
| E1 só (pino no escanteio) | 2,0972 | **1,7500** ✗ | 2,162 (2,331) | 4,028 (**3,458**) ✗ | 18,44 | **reprova 2 gates** |
| E1+E2+E3 (completo) | 1,9722 | **1,5417** ✗ | 2,140 (2,389) | 4,806 (4,208) | 17,71 | **reprova gols** |

Por base, gols:

| semente | R18.96 | E1 só | completo |
|---:|---:|---:|---:|
| 4200000 | 2,4583 | 2,6250 | 2,1667 |
| 8400000 | 2,0833 | 2,0417 | 2,4583 |
| 1260000 | 2,0417 | **1,7500** | **1,5833** |
| 2100000 | 2,0833 | 1,9583 | **1,5417** |
| 6300000 | 1,8750 | 1,9583 | 2,0833 |
| 3150000 | 2,5417 | 2,2500 | 2,0000 |

**P8 estava certa: gols descem.** Desceram além do piso.

**P6 estava errada, e foi falsificada pela própria medição:** eu previ que
escanteios subiriam com mais corpos na área. Com E1 sozinho eles **caíram** de
4,785 para 4,028 (pior base 3,458, abaixo do piso do ECO-05). Com E2+E3 juntos
eles voltaram para 4,806 — ou seja, o efeito sobre escanteio não vem de "mais
gente na área", vem de outra coisa que esta rodada não isolou.

**P7 também estava errada:** xG não subiu, caiu de 2,193 para 2,140.

### O canal, honestamente: não foi isolado

`chutes` caem em **todas** as variantes — 19,21 → 18,44 → 17,71. Isso é ~1,5
finalização por partida, mais do que a fatia de bola parada do jogo inteiro.
Não é só conversão de escanteio piorando: **o volume de finalização do jogo
corrido cai junto**, e esta rodada não descobriu por quê. Registrar isso é mais
útil do que inventar uma explicação.

Duas suspeitas, **nenhuma medida**, para quem pegar a próxima:

1. o pino congela a forma dos dois times por ~5 s; no reinício, o time que ataca
   tem 2-3 jogadores dentro da área e o resto fora de posição para o jogo corrido
   que vem logo depois;
2. `dead` é tempo de física (armadilha A1) — mas isso não explica o E1 sozinho,
   que **não** alonga `dead` nenhum e mesmo assim perde 0,77 chute por partida.

---

## 6. Veredito

**Não promovido.** A R18.96 continua sendo a build promovida, byte a byte.

O patch fica no repositório, fora da cadeia, com estes números no cabeçalho —
mesmo tratamento da OS-104 e da OS-105 na PARTE C da fila.

O que esta rodada entrega, e que não existia antes:

- **o defeito está medido**, dos dois lados e nos dois lances, com instrumento
  reprodutível (`diag_os107`);
- **a causa está localizada com arquivo:linha** — `:18287` abandona o posto na
  chegada, `:6951` teleporta e não arma defesa nenhuma;
- **existe uma correção que resolve o defeito** — 28,8% → 93,6% de postos
  ocupados, 0,26 → 4,50 defensor na própria área, teleporte de 70 m → zero;
- **e existe o preço medido dela**: −0,21 gol e −1,5 chute por partida.

O que ficou aberto está na `PROXIMA_RODADA.md`.
