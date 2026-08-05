# RODADA OS-92 / OS-93 · o chute que sai, e o lateral que não

## 1. OS-92 — o maior defeito medido do projeto, fechado

### O defeito

Medido desde o início desta sessão e **falsificado três vezes por mim**:

> 27 de 63 chutes "para fora" (42,9%) cruzavam a linha de fundo **entre as
> traves** e por baixo do travessão, penetrando até 3,39 m dentro do gol. Zero
> passavam por cima. O jogo narrava "manda pra fora" e a bola entrava.

### As três falsificações, e o que cada uma custou

| versão | onde | o que a medição mostrou |
|---|---|---|
| v1 | camada externa **antes** da original | alterou alvos que já saíam bem por fora; chegou a empurrar um bom para dentro (1,14 → −0,29) |
| v2 | dentro do **núcleo** de `_startTravel` | o núcleo É alcançado (49/49 chutes) e calculou correção para **30** — bateria saiu **byte a byte igual** à base |
| v3 | camada externa **depois** da original | corrigiu `ball.target` **30 vezes** e a bola foi ao alvo **antigo**: alvo 38,045 → 39,569, bola terminou em **38,05** |

### O que resolveu foi o método, não a insistência

Em vez de uma quarta correção por dedução, **setter em `ball.x`/`ball.y`
capturando a pilha** (HANDOFF §2A). 4 partidas, 4585 escritas durante voos de
chute:

```
99,8%  P._ballTravel @cds-physics-timeline-581.js:89
         <- p04BallTravel @cds-p04-physical-reception-584-r6.js:533
         <- P._ballTravel @cds-r12-transactional-core-r123.js:146
```

E **`ball.target` não é reescrito em voo** — só 18 vezes por `_deflectTo` e 6
por `_looseBall`, ambas deflexões legítimas.

Lendo `:15035`, a camada de física chama a original e então constrói um
**segmento próprio** a partir do argumento `target` que recebeu:

```js
b._physicsPlan = { segment: seg, elapsed: 0, actorPlan: ap };
```

e `:15042` voa esse segmento:

```js
const pt = segmentPoint(seg, plan.elapsed);
b.x = pt.x; b.y = pt.y; b.z = pt.z;
```

**ignorando `ball.target` e `ball.vx/vy`.** Por isso a v3 corrigiu o alvo e a
bola foi ao antigo: a fotografia já estava tirada. E `:19710` (R18.3) ainda
reescreve as amostras com **curva** (`bend = 4q(1−q)·amp`) — o voo não é reto,
então nenhuma conta de reta funcionaria nem no lugar certo.

### A correção

Não calcula: **mede**. Envolve `_planPhysicalSegment` — o gargalo único de
`_startTravel`, `_continueTravel` e `_deflectTo` — deixa o plano ser
construído, **lê as amostras realmente voadas**, acha onde a trajetória cruza
`x = g.x` e re-planeja se cair dentro. Duas iterações, porque re-planejar muda a
curva.

### Resultado

| | R18.91 | R18.92 |
|---|---:|---:|
| cruzaram entre os postes | **25 de 81 · 30,9%** | **0 de 52 · 0%** |
| penetração máxima no gol | −2,58 m | **0** |
| folga ao poste, **mínimo** | **−2,58 m** | **+0,29 m** |
| folga mediana | 0,51 m | 0,63 m |

As duas previsões registradas antes de medir se confirmaram: a fração cai a
zero, e **nenhum chute que já saía por fora é puxado para dentro** — a folga
mínima é positiva.

### Efeito colateral bem-vindo

A R18.91 furava o piso de escanteios em 2 de 9 bases — era o custo que eu tinha
declarado. Nas quatro primeiras bases da R18.92: **5,250 · 4,042 · 5,750 ·
5,125**, todas acima. Coerente: com os chutes saindo de fato pela linha de
fundo, a geometria de reinício volta ao normal.

---

## 2. OS-93 — o lateral: **medida boa, patch falsificado, fora da cadeia**

### O defeito, medido

Observação do dono: *"aconteceu também do Neymar ir bater o lateral e sair
driblando"*. Medido em 66 laterais, 8 partidas:

| grandeza | R18.92 |
|---|---:|
| laterais por partida | 8,25 |
| **salto do cobrador no quadro do reinício** | mediana **4,475 m** · p90 8,196 · máx **12,465 m** |
| **saltos acima de 1 m** | **39 de 66 · 59%** |
| cobrador → bola no reinício | 0,459 m *(isto já estava certo)* |
| espera até o reinício | 2,533 s *(isto já existia)* |

Um salto de 4,475 m em 1/30 s é **134 m/s**. `_ballOut` (`:7180`) escolhe o
jogador **no instante do reinício**, por proximidade em `y` apenas, e o **crava**
no ponto: `cand.x = clamp(b.x,...); cand.y = y`. Ninguém caminha.

### O patch, e por que ele não entra

Tentei reaproveitar a maquinaria de bola parada (`__spTarget` + `__cdsTakerWait`).
O teleporte morreu — mas **outro defeito nasceu**:

| | R18.92 | R18.93 (candidata) |
|---|---:|---:|
| salto do cobrador, mediana | 4,475 m | **0,021 m** |
| saltos acima de 1 m | 39 de 66 | **0 de 60** |
| **bola andou do ponto de saída** | 1,946 m | **4,603 m** (máx 13,285) |

A bola passou a reaparecer a 4,6 m de onde saiu. No reinício, `_giveBall` cola a
bola no cobrador; se ele não chegou ao ponto, **a bola vai até ele** em vez do
contrário. Troquei um teleporte de 4,5 m por um lateral cobrado no lugar errado.

`__spTarget` **é** consumido (`:18252`), com `dead` ativo, caminhando por passo e
fazendo snap na chegada — então a máquina existe e eu ainda **não sei** por que o
cobrador não chega. Três medições não fecharam o mecanismo.

**A OS-93 fica no repositório, fora da cadeia, com estes números no cabeçalho.**
Não entra na build.

### Para quem pegar depois

O caminho não é aumentar o teto de espera (custa tempo morto: 8,25 laterais por
partida). É descobrir por que o cobrador não chega — provavelmente medindo a
distância dele ao ponto **quadro a quadro** durante a bola morta, para separar
"não anda" de "anda devagar demais" de "o alvo é limpo antes da hora".
