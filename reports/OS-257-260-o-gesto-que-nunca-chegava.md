# OS-257 a OS-260 — o gesto que nunca chegava a ser desenhado

**Data:** 2026-08-19
**Origem:** cobrança do dono, textual —

> *"Tudo que eu peço que você olhe é pra olhar o VISUAL... tem que ver o gif do
> lance... qual é a animação quando o jogador pega e dá um chute? Qual é a
> animação quando o jogador sai driblando? ... o pulo do goleiro pra defender, a
> força do chute, a trajetória do chute, a própria física do jogo em si.
> Acho que você vai estar ajustando, ajustando várias coisas, mas eu não sei se
> isso vai melhorar de fato o que precisa ser melhorado."*

Ele estava certo nas duas metades. Olhar o lance achou em uma tarde defeitos que
uma sessão inteira de bateria não achou — e "ajustar várias coisas" **não** ia
melhorar, porque as várias coisas tinham uma causa só.

---

## O que se via na folha de quadros

`tools/fisica/tela/lance-em-quadros.js --evento=shot_taken --passo=2 --zoom=5`,
16 quadros de 33 ms em volta do chute. Ampliado, o chutador é a **mesma
silhueta** de −200 ms a +301 ms. Braço, perna, tronco: idênticos. A bola sai e
o corpo não faz nada.

O goleiro, na mesma sonda: 24 quadros parado enquanto a bola entra.

---

## OS-257 — 27 gestos desenhavam a silhueta de correr

A tabela `POSE` do desenho é lida assim:

```js
const alvo = POSE[st] || POSE_NEUTRA;
```

Contagem dos estados declarados contra as chaves da tabela:

```
estados declarados: 64 | com pose própria: 31 | SEM pose: 33
```

Entre os 33 sem pose estavam **todos** os que o dono citou: `shot_contact`,
`power_shot`, `placed_shot`, `volley`, `header`, `standing_tackle`,
`slide_tackle`, `block`, `inside_cut`, `outside_cut`, `body_feint`,
`turn_dribble`, `burst_touch`, `gk_low_dive`, `gk_high_dive`, `gk_catch`,
`gk_punch` — e os sete de passe.

Caíam todos em `POSE_NEUTRA`, que é a silhueta de corrida. O carrinho e o bote
em pé desenhavam a mesma coisa; o mergulho do goleiro desenhava um homem em pé.

**Feito:** entrada de pose para os 27 gestos reais. Restaram sem pose apenas os
seis estados de locomoção (`idle walk jog run sprint carry`), que devem mesmo
usar a neutra.

---

## OS-258 — `esc` e `braco` eram multiplicados por zero justamente no gesto

A OS-257 sozinha mudou quase nada na tela. O motivo estava três linhas abaixo:

```js
const amp = (mergulho || kicking || tackling) ? 0 : clamp(d.vms/4.2, 0, 1) * …;
const sw  = Math.sin(d.gait) * amp;          // → 0
const swL = P ? sw * P.esc   : sw;           // → 0, diga o que disser esc
const swB = (P ? sw * P.braco : sw) * .62;   // → 0, diga o que disser braco
```

Zerar `amp` no chute e no bote faz sentido: a tesoura da **corrida** não pode
continuar rodando por baixo de um gesto discreto. Só que `esc` e `braco` são os
**únicos dois parâmetros da tabela POSE que movem os membros**. Com `amp = 0` a
pose só conseguia falar por `spr`, `inc`, `agacha` e `estica` — base e tronco.

Isso também explica por que a **OS-255** (escolher carrinho ou bote em pé pela
distância) não mudou nada na tela: os dois desenhavam a mesma silhueta.

**Feito:** o gesto passa a trazer a própria amplitude — envelope de ataque
rápido (90 ms) e queda longa (constante 0,30 s), com **relógio de cadeia** e não
de estado. O relógio de cadeia é necessário porque a cadeia de um chute é
`placed_shot` → `shot_contact` → `shot_followthrough` → `shot_recover`, e se o
envelope reiniciasse a cada estado a perna pedalaria quatro vezes.

---

## OS-259 — o corpo estava tapado pela própria identificação

Ampliando o mesmo quadro, o que se vê do atleta é: um número, duas pernas, e uma
placa de nome em cima das chuteiras. Quatro sobreposições, todas do mesmo tipo —
**interface desenhada DENTRO da transformação da câmera com medidas fixas em
pixel**, então o zoom (até 2,1) multiplicava tudo:

| o quê | era | virou |
|---|---|---|
| número da camisa | `min(12, 10·r/13)` px no **centro** do corpo — caixa do texto ≈ raio do atleta | ≈ 0,5 r, na altura do peito |
| placa de nome | `y + r + 2` — o pé do círculo, mas as pernas descem a 1,4 r | `y + 1,52 r`, depois da sombra |
| seta da trajetória | ponta de 9 px e traço de 2 px → 19 e 4,2 no zoom | dividido pelo zoom |
| efeitos (`vfx`) | 🧤 de 17 px, 🛡️ de 14 px, anéis de 10–18 px, cartões de 12×17 | contra-escala no laço inteiro |
| bandeira de cartão amarelo | 5×7 px fixos, ≈ meio raio de altura | proporcional ao porte, encostada no ombro |

O caso do goleiro é o mais ilustrativo: na folha de quadros da defesa aparecia um
**par de luvas gigantes flutuando acima dele**, do tamanho do tronco, por 300 ms
— exatamente por cima do mergulho que a OS-257 tinha acabado de fazer existir.
Parecia bug do desenho das mãos. Era o emoji do evento `save`.

A contra-escala foi posta em volta do laço inteiro de efeitos, e não número por
número, para que qualquer efeito novo já nasça com tamanho de tela.

Este é o mesmo defeito da **OS-243** (placa de nome crescendo com a lente),
encontrado mais quatro vezes.

---

## OS-260 — a máquina de animação e a mistura viviam em relógios diferentes

Este é o defeito de raiz, e é o que explica "não dá pra sentir a fluidez".

A máquina de animação conta em segundos de **simulação** (`this.t += dt` no
Controller, com o dt do motor). A mistura de pose da OS-235 conta em segundos de
**parede**, de propósito e por escrito: *"quadro irregular e botão de velocidade
não mexem na duração da transição"*.

As duas decisões são defensáveis sozinhas e **incompatíveis juntas**. O botão de
velocidade encolhe o gesto e não encolhe a mistura.

Medido com `tools/fisica/tela/vida-do-gesto.js`, 22 atletas, ~70 s por lado:

| estado | declara | vive em 3X | vive em 1X |
|---|---|---|---|
| `turn` | 260 ms | **83 ms** | 267 ms |
| `decelerate` | 300 ms | **100 ms** | 300 ms |
| `accelerate` | 300 ms | **100 ms** | 300 ms |
| `pass_prepare` | 150 ms | **50 ms** | 167 ms |
| `pass_recover` | 120 ms | **50 ms** | 133 ms |
| `pass_followthrough` | 100 ms | **34 ms** | — |

Não é aproximado: é a divisão exata pelo multiplicador do botão. E **3X é o
padrão** (OS-202) — o jogo que o dono assiste é a coluna do meio.

```
entradas de estado que morreram antes da mistura de pose:  67,3%  (de 10.701)
```

Dois terços dos gestos nunca terminavam de ser desenhados. A silhueta era sempre
uma média entre o gesto anterior e o próximo.

**Feito:** a mistura passa a ter teto amarrado ao estado — no máximo 40% da vida
de **parede** que o estado ainda tem (`dur` de simulação ÷ velocidade de
exibição). Assim ela encolhe junto com o gesto em qualquer velocidade, e também
cobre o caso 1X de estados naturalmente curtos (`shot_contact` dura 80 ms e a
mistura pedia 110).

Para isso, duas coisas passaram a ser públicas: a velocidade de exibição
(`__CDS_VELVIS`) e a duração **efetiva** do estado, que vai no `snapshot()` —
`_enter` sobrescreve a declarada em vários caminhos, então a tabela `STATES` não
servia para quem desenha.

### A medição do resultado

A grandeza que faltava não era "quantas trocas" nem "quão suave": era **a
silhueta chegou a ser desenhada?**. Isso agora é auditado em
`CDS_ANIM_MIX.auditoria` (`chegou` / `cortou` / `somaK`) e medido por
`tools/fisica/tela/chegada-da-silhueta.js`, em janelas **pareadas na mesma
partida** alternando `CDS_MIX_TETO` — a mesma disciplina da OS-246.

```
=== A CHEGADA DA SILHUETA ===  4 pares de 10 s | velocidade de exibicao 3X

   B  sem teto (antes)     5466 trocas   chegou 35.4%   cortada parou em 67%   salto medio 0.0786
   A  com teto (OS-260)    5314 trocas   chegou 71.3%   cortada parou em 61%   salto medio 0.0878

   DIFERENCA: +36.0 pontos percentuais
   PISO DE RUIDO entre janelas do mesmo lado: 2.5 pp  ->  a diferenca SUPERA o ruido
```

**O preço, declarado:** o salto médio de silhueta por quadro subiu de 0,0786
para 0,0878 (+12%). É o esperado — mistura mais curta é degrau maior. A troca é
12% mais degrau por quadro em troca de dobrar a fração de gestos que chegam a
existir, e é uma troca que vale.

---

## O que NÃO foi resolvido, e é honesto dizer

**Em 3X nenhum gesto individual é legível, e nenhuma correção de desenho muda
isso.** Um `pass_contact` dura 23 ms de parede em 3X: um quadro e meio. A OS-260
faz a silhueta chegar; ela não faz 23 ms virarem tempo suficiente para o olho.

Quem quiser **ver** a animação tem de assistir em 1X ou 2X. Isso é decisão do
dono (a OS-202 pôs o padrão em 3X para a partida caber em ~7,6 min), e por isso
o padrão não foi mexido aqui — só ficou medido e escrito.

Outros itens em aberto, sem correção nesta rodada:

- A cadeia do chute começa **depois** de a bola sair: `placed_shot` é pedido em
  `_startTravel`. O que se vê é follow-through, não armação. Corrigir exige
  antecipação no motor, não no desenho.
- `turn`, `accelerate` e `decelerate` somam 3.971 entradas em 75 s (mais de um
  terço de tudo) e cedem sempre para estados de locomoção. O tremor de
  locomoção da OS-246 foi reduzido, não eliminado.
- A bola é desenhada por cima do corpo de quem está à frente dela — não há
  ordenação por profundidade entre bola e atleta.

---

## Ferramentas novas

| ferramenta | o que responde |
|---|---|
| `tools/fisica/tela/vida-do-gesto.js` | quanto tempo cada estado FICA na tela contra o que declara durar, e quem o substituiu |
| `tools/fisica/tela/chegada-da-silhueta.js` | A/B pareado do teto de mistura: a pose chegou a ser desenhada? |

Ambas reprovam por falta de amostra (OS-247: zero observação não é zero defeito).

## Ajustes de execução

| variável | padrão | para quê |
|---|---|---|
| `CDS_MIX_TETO` | 1 | 0 desliga o teto da OS-260 e devolve o comportamento anterior |
| `CDS_MIX_T` | 0,11 | duração base da mistura de pose |
