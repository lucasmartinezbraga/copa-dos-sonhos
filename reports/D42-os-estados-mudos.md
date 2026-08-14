# D42 · A máquina tinha 62 estados e o jogo usava 27

**Data:** 2026-08-14 · **Camada 21, construída, medida e ACEITA** ·
**Instrumento novo:** `tools/fisica/tela/gestos.js`

---

## O instrumento

Para cada chamada real de `CDS_F25D.body`, um `Proxy` no `ctx` grava a
**sequência de operações de desenho** — método e argumentos, normalizados por
`r` e quantizados a 1/8 de raio. Duas poses diferentes produzem strings
diferentes; duas poses iguais produzem a mesma string. Cruzando com o estado
que a máquina da R14 publica, sai:

- quantas vezes cada estado foi **desenhado**
- quantas **silhuetas distintas** ele produziu
- quantas delas **não aparecem** na nuvem da corrida simples

## Dois erros do instrumento, corrigidos antes de qualquer conclusão

**[1] Metade do corpo estava fora da assinatura.** O tronco e os dois braços são
desenhados por `rr()`, que chama `ctx.roundRect` — método que eu não havia
gravado. A modulação de braço ficava invisível para a própria sonda que deveria
medi-la.

**[2] A linha de base absorvia o que ia ser testado.** Eu tinha posto
`accelerate/decelerate/turn/strafe/backpedal` na lista de "locomoção comum" —
justamente os estados sob teste, que assim passavam por construção. Pior: como
`strafe` e `protect` compartilhavam o mesmo afastamento de pés, `protect` foi
declarado **"sem gesto próprio"** por contaminação da base. Era falso.

> Mesma família da armadilha **D7**: o instrumento concordando consigo mesmo.
> Base de comparação é parte do instrumento.

---

## O diagnóstico

O contexto que a ponte entregava aos controladores tinha **três campos**:

```js
{ speed, hasBall, isGK }
```

e `locoFor` só sabe devolver `idle/walk/jog/run/sprint` a partir do **módulo**
da velocidade. Famílias inteiras eram inalcançáveis por construção — não por
falta de desenho, por falta de pergunta:

| família | por que nunca disparava |
|---|---|
| accelerate, decelerate, turn, strafe, backpedal | ninguém calculava derivada da velocidade nem giro |
| press, jockey, body_duel, recover | ninguém media distância ao portador |
| receive_prepare / contact / control | ninguém olhava `ball.receiver` |

**Nada disso exige informação nova do motor.** Tudo sai da velocidade, da sua
derivada e da relação geométrica com a bola — que a ponte já podia calcular e
não calculava. Continua sendo observação pura.

E cinco estados que *disparavam* pintavam a silhueta da corrida, idêntica:
`protect`, `shot_recover`, `intercept`, `lose_control`, `heavy_touch`.

> Sobre o `intercept`: a **§D39** deu a ele uma onda e um `bob`, e eu dei o caso
> por resolvido. A sonda mostra que o gesto inteiro era um deslocamento
> **vertical** do corpo de 0,07·r — os membros não se moviam. Um gesto que só
> translada o boneco não é um gesto. Segunda vez nesta investigação que uma
> correção minha só parecia pronta.

---

## O desenho novo

Em vez de mais um `else if` por estado, uma **tabela de postura** modula o
desenho de corrida que já existe:

```
esc     escala da tesoura das pernas        braco   escala do balanço dos braços
spr     afastamento lateral dos pés         estica  perna estendida à frente
inc     inclinação extra do tronco          agacha  quanto o corpo baixa
```

17 estados preenchidos. `estica` é o que separa **alcançar** de **correr** —
interceptar, dominar e tocar longo são gestos de alcance.

Dois portões tiveram de abrir junto:

- a inclinação só era aplicada com `_vig > .02` (velocidade de tela). Postura
  parada — `jockey`, `protect`, `receive_*` — acontece justamente com pouca
  velocidade e nunca chegava a ser desenhada.
- no piso do controlador, `this.tier = …` vinha **antes** de `_enter`, que
  sobrescreve `this.tier` com o tier declarado. Era código morto. Como
  `jockey`/`press` são `T_DEF`, um tier acima de `T_BALL` travava o ramo cíclico
  e o atleta ficaria preso na postura para sempre.

---

## A medição, mesma sonda nos dois bundles, 60 s a 6X

| | antes | depois |
|---|---|---|
| estados **nunca desenhados** | 35 de 62 | **27 de 62** |
| estados que desenham a corrida idêntica | 4 | **0** |

Estados que passaram a aparecer, com quadros na amostra:

```
backpedal 9341 · strafe 8582 · decelerate 8465 · accelerate 7177 · turn 4603
press 1348 · receive_prepare 560 · receive_control 243 · receive_contact 144
jockey 16
```

`backpedal`, `strafe`, `decelerate` e `accelerate` sozinhos respondem por mais
quadros que `jog` e `run` somados: são os quatro gestos mais comuns de uma
partida, e nenhum deles existia na tela.

Cadência da passada (D41) não regrediu: **0,92x a 1X, 1,40x a 3X.**

---

## Portão

A ponte instala com `(typeof window !== 'undefined' ? window : null)` e sai na
primeira linha quando `root` é nulo — **no headless o `step` nunca é
envolvido**, então as 14 métricas não podem se mover. Conferido lendo a guarda,
não assumido. `bash tools/testes.sh` → 8/8.

## O que sobra

27 estados seguem sem disparar. Dois grupos:

- **família do drible** (`body_feint`, `outside_cut`, `burst_touch`,
  `protect_turn`, `dribble_success/failure`) — o desenho **já existe** em
  `body()` para quatro deles e nunca roda. Falta o motor distinguir os
  sub-eventos do drible.
- **10 dos 13 estados de goleiro** e as variantes de chute/passe
  (`power_shot`, `volley`, `long_pass`, `placed_shot`) — dependem de o motor
  classificar a ação, que hoje só emite `pass`/`cross`/`shot`.
