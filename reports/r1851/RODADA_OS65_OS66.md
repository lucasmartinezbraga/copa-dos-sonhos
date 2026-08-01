# Rodada OS-65 / OS-66 — movimento dos jogadores, e a regressão gráfica da R18.81

## 0. O que veio do campo

Três observações, na ordem em que chegaram:

1. "FOCA NO MOVIMENTO DOS JOGADORES"
2. "ta bem esquisito o jogo" · "A bola também tinha ficado esquisita... a cadência"
3. "a 81 quebrou também, a parte gráfica ficou estranho"

A (3) é regressão minha e foi tratada primeiro.

---

## 1. A regressão gráfica da R18.81 — OS-63 saiu da cadeia

Comparei as bonecas **isoladas** das duas builds, desenhadas pelo mesmo
`CDS_F25D.body` num canvas próprio a `r = 46` (12 px vira 46 px, o defeito
aparece):

| | R18.80 | R18.81 |
|---|---|---|
| camisa | cor chapada com gradiente | padrão por cima |
| árbitro | não existe | vulto preto colado na bola |

O padrão de camisa da OS-63 era pintado com a **cor escura do próprio time a
55% de opacidade**, cobrindo metade da área do tronco (listra de `r*.15` a cada
`r*.30`). No tamanho real de jogo — tronco de ~20 px — isso não lê como listra:
lê como **sujeira**, e a cor da seleção fica encardida. A faixa diagonal fica
pior ainda, vira um borrão escuro atravessando o peito.

E o árbitro entrava desenhado a `r = 11*s`, **menor que os atletas**, todo
preto, perseguindo um ponto a 11 m da bola com suavização de 0,045 — ou seja,
um vulto escuro grudado na bola o tempo inteiro.

**Decisão: `patch_os63_ref_and_kits.js` saiu da cadeia de build.** O script
continua no repositório, comentado em `build_r1851.sh`, com o motivo escrito
ao lado. A OS-64 (matriz do overlay) foi mantida e re-ancorada em cima da
`41.html`.

---

## 2. Movimento — o censo

Antes de tocar em qualquer coisa, três medições, e duas delas eu tive de jogar
fora por estarem erradas.

### 2.1. Duas medições descartadas

**Descarte 1.** Meu primeiro censo classificou "quadro limpo" por igualdade
exata de posição e devolveu `limpos 0,77%`. Isso não queria dizer que 99% do
movimento é teletransporte: quer dizer que **escrita de posição fora do
`_integrate` é a norma**, e eu tratei 1 cm igual a 10 m. Amostra viciada — só
sobrava quem estava parado.

**Descarte 2.** Corrigido para medir a *magnitude*, o censo devolveu
`física 0,000 m/quadro` e `correção 100%`. Também falso. Pus um *setter* em
`p.x` de um jogador e capturei a pilha de quem escreve:

```
97,2%  commitMovement  <- P._resolveOverlaps  <- MatchSim._movePlayers
 2,6%  P._movePlayers (cds-os36-freekick-distance)
 0,2%  Q._movePlayers (physics-timeline-581)
```

O `_integrate` **não escreve `p.x`**. Ele planeja em `ctx.planned` (:16398) e o
`commitMovement` escreve uma vez por quadro, com clamp de passo. A arquitetura
está certa; meu gancho é que estava no lugar errado.

Isso também confirmou, de novo, a armadilha que já me pegou com `_assignDefRoles`,
`_defendTarget` e `_dribble`: **o `_integrate` do núcleo (:7713) está morto.** O
vivo é o transacional R12 (:16395), e é ele que tem o limitador de taxa angular
(§33) e o clamp de passo.

### 2.2. O que sobreviveu

Deslocamento total por quadro, 4 partidas, 4.097.164 quadros-jogador de linha:

| velocidade (% do tempo) | jogo | GPS de elite |
|---|---|---|
| < 2 m/s (andando) | 20,0% | ~57% |
| 2–4 (trote) | 34,4% | ~25% |
| 4–5,5 (corrida) | 23,6% | ~9% |
| 5,5–7 (forte) | 12,4% | ~4% |
| > 7 (sprint) | 9,6% | ~1% |
| **distância** | **21,17 km** | **~10,5 km** |

**Ninguém anda.** 22% do tempo acima de 5,5 m/s contra ~5% do futebol. Vinte e
dois atletas em deslocamento permanente é exatamente a leitura de "peça
deslizando num tabuleiro".

### 2.3. De onde vem

Em `_integrate` (:16399):

```js
if (duty || d > 16) effort = 1;
else { ... effort = clamp(.55 + f*.35 + b*.14, .5, 1); }
```

`duty` inclui `_breaking`, que **três camadas posteriores ligam sozinhas**
(:17163, :20500, :20701) sempre que um marcador está a mais de 2,35–3,4 m do seu
homem — distância que um marcador ocupa quase o tempo inteiro.

Medido em 3.372.336 chamadas:

```
esforço 1 por dever de bola           26,7%
esforço 1 por alvo a mais de 16 m     13,3%
esforço 1 por marcação (> 2,55 m)     23,2%   (16,3% só por isto)
---- TOTAL                            52,5%

e desse total, distância até a BOLA:
  <10 m 21,1% | 10-20 m 27,2% | 20-30 m 23,8% | 30-45 m 21,3% | >45 m 6,7%
```

**Metade do esforço máximo do jogo acontece a mais de 20 m da bola.**

---

## 3. OS-65 · o esforço passa a cair com a distância até a bola

`patch_os65_effort_by_ball.js`. Um único edit, depois da linha do esforço.

- portador, recebedor, quem persegue a bola, quem está em arranque, e quem está
  a mais de 16 m do próprio alvo: **esforço 1, intocado**. Perto da bola o jogo
  continua idêntico.
- marcador em recuperação (`_breaking`): piso **0,62** — acompanhar o homem não
  vira caminhada.
- o resto: piso **0,42**.
- amortecimento contínuo: a 9 m da bola nada muda; a 32 m vale o piso.

Não toca em `maxSpd`, `acc`, `turn`, alvo de ninguém, nem em RNG.

### Previsão registrada antes de medir, e resultado

| previsão | resultado |
|---|---|
| tempo < 2 m/s **sobe** | 20,0% → **24,4%** ✔ |
| tempo > 7 m/s **desce** | 9,6% → **5,9%** ✔ |
| distância **desce** | 21,17 → **18,82 km** ✔ |
| marcação **não quebra** | `threatCoverage` 0,624 → 0,618 · `markerMeanDistance` 7,45 → **7,24** ✔ |
| escanteios 4–10 | 6,63 → 5,88 ✔ |

Bateria de 16 partidas, mesmas sementes:

| | R18.81 | R18.82 |
|---|---|---|
| goals | 1,94 | 1,81 |
| xg | 2,58 | 2,48 |
| shots | 22,31 | 21,81 |
| corners | 6,63 | 5,88 |
| passes | 457,75 | 451,25 |
| fouls | 14,63 | 13,13 |
| **carry** | 41,3 | **48,6** |
| swarm | 0,0324 | 0,0360 |
| severe | 0,0587 | 0,0565 |
| lines.meanRange | 6,05 | 6,08 |

`carry` subiu 18%: com menos gente varrendo o campo a 7 m/s, o portador tem mais
espaço para conduzir. É a direção certa.

**Custo:** gols 1,94 → 1,81. Registrado, não compensado com multiplicador.

**Correção de um erro meu:** `threatCoverage` já estava em 0,624 na R18.81,
abaixo do gate de 0,65. Isso é anterior à OS-65, não foi ela que derrubou.

---

## 4. OS-66 · a bola — diagnóstico, ainda sem patch

Censo de 4 partidas, 201.132 quadros:

```
bola em VOO       57,5%   (523 voos/partida, 0,92 s cada)   real ~28%
bola NO PÉ        28,5%                                      real ~60%
solta em jogo      4,2%
bola morta        11,1%
```

**A proporção está invertida.**

A raiz é a mesma do movimento. A partida tem só **838 s de bola rolando** para
90 minutos de relógio (`clockRate 0,13`). Para bater os totais reais — 451
passes, 22 chutes — ela precisa disparar eventos a **~0,6 passes por segundo de
ação**, contra ~0,28 do futebol de verdade. Com um passe a cada 1,7 s e cada voo
durando 0,92 s, a bola fica no ar mais da metade do tempo.

Isso explica as três observações de campo com **um** mecanismo: o jogo toca 90
minutos de futebol em ~14 minutos reais, e comprime a densidade de eventos para
compensar.

**Ainda não medi o mecanismo do desfecho** (onde a decisão de passar é tomada e
se existe tempo mínimo de domínio). Nada foi patchado aqui. A OS-48 já tinha
medido `tempo médio com a bola 0,45 s` contra 1,1–1,4 s reais e consertado só o
subconjunto que *congelava*; a média continua em ~0,46 s. É por aí que a próxima
rodada entra.

### Uma medição do navegador que descartei

`pctComDono: 0%` — erro meu de leitura: `getState()` expõe `hasBall` por
jogador, não `owner` na bola. Não há defeito aí.

---

## 4b. OS-67, OS-68, OS-69 — três hipóteses medidas e falsificadas

Nenhuma foi promovida. Ficam no repositório, fora da cadeia, com o número que
as derrubou.

### OS-67 · acoplar `decisionInterval` e `clockRate`

Hipótese: `clockRate` é o botão de volume (todo total ∝ 1/clockRate) e
`decisionInterval` o de cadência; escalar um por *k* e o outro por 1/*k* manteria
os totais e baixaria a densidade por segundo.

**Previsão registrada:** totais aproximadamente constantes.

**Medido (8 partidas):**

| | R18.82 | k=1,6 | k=2,4 |
|---|---|---|---|
| passes | 451 | 758 | 1165 |
| gols | 1,81 | 4,38 | 8,38 |
| chutes | 21,8 | 39,1 | 57,4 |

O produto não é constante. **Falsificada.**

### OS-68 · subir os tetos de `decideT`

A OS-67 falhou porque `decisionInterval` não muda nada — levado de 0,28 a 0,90 e
a 1,60 (5,7×), o domínio ficou em **0,45 s / 0,45 s / 0,45 s**, mediana 0,37 e
p90 0,62 nos três pontos.

Então o alvo passou a ser os cinco tetos que rebaixam `decideT` depois:

```
:6726   Math.min(this.decideT, .10)          <- na recepção
:5076   Math.min(this.decideT, 0.20)         <- sob pressão
:17289-91  fases R13: 0.20 / 0.31 / 0.44
```

Multiplicados por 1,8 e 2,6, com `clockRate` compensando:

| | R18.82 | m=1,8 | m=2,6 |
|---|---|---|---|
| domínio médio | 0,45 | **0,45** | **0,45** |
| mediana | 0,37 | 0,37 | 0,38 |
| posses/partida | 529 | 967 | 1398 |

**Falsificada.**

**Por quê.** `decideT` corre livre (`this.decideT -= dt` todo quadro) mas só é
consumido quando há dono, a bola não viaja e o `settle` acabou. Durante os 0,92 s
de voo o contador continua descendo e chega fundo no negativo — quando a bola
pousa ele já está vencido e o receptor decide no mesmo quadro. **O intervalo
nunca vincula.**

### O que o domínio realmente é

```
settle  0,10 a 0,34    (primeiro toque, :2729)
prep    pass [0.10, 0.19] · cross [0.15, 0.26] · shot [0.17, 0.30]   (:17477)
------------------------------------------------------------------
~0,20 + ~0,15 = 0,35            mediana medida: 0,37
```

E esses números estão **certos**: um passe de primeira leva mesmo 0,3–0,5 s.
Esticar o `prep` viraria um windup que não existe no futebol. O 1,1 s real é uma
*média* que inclui os lances de recebe-conduz-passa — e é a condução que falta,
não a lentidão.

### OS-69 · abrir a janela de condução — e a quinta camada morta

Mecanismo aparente (:5209):

```js
const _cnTeto = ((drible + aceleracao)/2 >= 55) ? 2 : 0;
if (cone <= _cnTeto && dtg > 6) { this._carry(o, g); return; }
```

Aberto para teto 3/limiar 48 e teto 5/limiar 40. Resultado, **idêntico byte a
byte** à base nas duas variantes: voo 57,1%, no pé 28,0%, domínio 0,45,
posses 529, `carry` 46,3, `goals` 1,83.

**O `_decide` do núcleo (:5068) está morto**, e com ele o portão de condução.
A camada P47 (:8211) **não encadeia**: monta `q.candidates`, ordena por score e
despacha sozinha.

É a **quinta** confirmação do mesmo padrão estrutural nesta linhagem, depois de
`_assignDefRoles` (:16736), `_defendTarget` (:20218), `_dribble` (:16382) e o
`_integrate` do núcleo (:7713).

### Onde a próxima rodada entra

O portão vivo da condução está em :8206:

```js
add('carry', drib, ins.inPossession.progression.carryMore ? .72 : .4,
              nd > 5 ? .4 : .1, .35)
// score = ajuste + habilidade + espaço − pressão − fadiga − risco
```

Condução carrega risco fixo **0,35** e ajuste base **0,4**. É esse o número a
mexer, com previsão registrada antes.

---

## 5. Estado

Promovida: **R18.82** = R18.81 − OS-63 + OS-65.

Não promovidas, medidas e falsificadas: OS-67, OS-68, OS-69.

Aberto, com número medido e sem correção:
- bola no ar 57,5% contra ~28% reais;
- domínio médio 0,46 s contra 1,1–1,4 s;
- `threatCoverage` 0,618 contra gate 0,65 (anterior a esta rodada);
- distância 18,82 km contra ~10,5 — melhorou, não chegou;
- partida de 90 min leva ~14 min reais no 1x.
