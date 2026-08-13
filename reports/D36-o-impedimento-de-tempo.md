# D36 · O impedimento de tempo — o mecanismo funciona e mesmo assim não entra

**Data:** 2026-08-13 · **Medição:** `reports/d36-tentativa-reprovada.json`
(300 partidas pareadas) · **Estado: construído, medido, REVERTIDO.**

---

## O diagnóstico que faltava

Depois de quatro alavancas falharem no par do D35, fui ler como o impedimento é
de fato marcado. Ele é avaliado dentro de `_pass`:

```js
const rxRcv = dir > 0 ? m.x : FL - m.x;      // posição do receptor AGORA
...
if (rxRcv > offLine + 0.45 && chance(...)) this._emit('offside', ...);
```

`m.x` é **a mesma foto** que o `_bestPass` acabou de usar para escolher o
companheiro, onde o termo da A1 já desconta até −4,3 por estar perto da linha.

**Com a posição idêntica dos dois lados, o passador nunca erra.** Para ser
marcado, o receptor precisa já estar além da linha no instante da decisão — e
aí o passe simplesmente não sai. Daí os 0,91 impedimentos por partida, e daí o
fato de 32,94 arrancadas por partida não renderem quase nada.

**Isso explica as quatro alavancas anteriores de uma vez.** Eu tentava pôr mais
gente além da linha. O problema é que **quem está além da linha nunca recebe o
passe**, por construção.

---

## A mudança

No futebol o passador decide pela foto que vê, a bola sai algumas décimas
depois, e o corredor não parou. **O impedimento real é esse desencontro** — erro
de tempo do atacante, não de leitura do passador.

A posição do receptor passa a avançar com a velocidade dele durante o intervalo
de execução, enquanto o `_bestPass` continua decidindo pela posição atual:

```js
const _d36X = m.x + (Number.isFinite(m.vx) ? m.vx : 0) * _d36Atraso;
const rxRcv = dir > 0 ? _d36X : FL - _d36X;
```

A **assimetria entre as duas leituras é o erro de sincronia**. Igualar as duas
mata o impedimento de novo. Quem está parado não muda de lado; quem disparou
cedo demais atravessa a linha sozinho.

> **O 0,60 s é calibrado, não derivado.** O ancoradouro físico — decisão até o
> contato num passe conduzido — fica entre 0,3 e 0,5 s. O valor está acima disso
> porque absorve o que o motor não modela: a aceleração do corredor dentro do
> intervalo e a margem de julgamento do bandeira. Registrar isto importa: é um
> parâmetro ajustado para a métrica entrar na faixa, e chamá-lo de "atraso de
> execução" puro seria esticar o argumento.

---

## O mecanismo funciona

Varredura do conjunto completo (conserto do D35 + ombro + atraso), 64 partidas
pareadas por configuração:

| atraso | gols | chutes | noAlvo | **offside** | escanteios | laterais |
|---|---|---|---|---|---|---|
| 0 | 2,594 | 21,55 | 0,341 | 0,95 | 9,55 | 17,95 |
| 0,30 | 2,438 | 20,70 | 0,334 | 1,36 | 9,69 | 18,38 |
| 0,45 | 2,313 | 20,05 | 0,327 | 2,12 | 9,80 | 18,47 |
| **0,60** | 2,313 | 20,23 | 0,323 | **3,16** | 9,77 | 18,25 |
| 0,75 | 2,391 | 19,64 | 0,341 | 4,14 | 9,64 | 18,03 |

Monotônico, e em 0,60 s o impedimento entra na faixa **2,5–6,0** do futebol
real. **Confirmado em 300 partidas: 5,167 → 3,000.** O objetivo declarado foi
atingido.

---

## E mesmo assim reprova

| | base (com o bug) | conserto | +ombro | **+ombro+D36** |
|---|---|---|---|---|
| shots | 23,710 | 19,990 | 20,957 | **20,120** |
| goals | 2,877 | 2,380 | 2,407 | **2,323** ❌ |
| xg | 3,013 | 2,483 | 2,656 | 2,528 |
| corners | 11,337 | 9,287 | 9,660 | 9,530 |
| **offsides** | 5,167 | 1,043 | 0,910 | **3,000** ✅ |
| zeroZeroRate | 0,080 | 0,167 | 0,123 | **0,143** ❌ (3,13 SE) |
| throwIns | 15,787 | 17,570 | 17,167 | 17,030 |
| **placar de design** | **12/13** | 9/13 | **11/13** | **10/13** |

O D36 compra impedimento com gol: `goals` cai de 2,407 para 2,323 e sai da
faixa, e o `zeroZeroRate` sobe de 0,123 para 0,143. **Design 11/13 → 10/13** — o
conjunto com D36 é *pior* que o conjunto sem ele.

E isso é **intrínseco, não um defeito do desenho**: impedimento *é* ataque
perdido. Medido, ~0,64 chute por impedimento a mais. Um jogo que já está no piso
de volume não tem de onde pagar.

> A varredura de n=64 previu bem: ela dava gols 2,313 e chutes 20,23 em 0,60; as
> 300 partidas deram 2,323 e 20,120. A cautela da B7 valeu para os **níveis** da
> varredura anterior (n=48), não para esta.

---

## A conclusão de toda a linha D35/D36

Três rodadas, seis mecanismos testados, e o resultado converge:

**O volume ofensivo do jogo está calibrado em cima de um defeito.** A marca de
arrancada eterna dava a ~6 jogadores por partida isenção permanente do teto de
impedimento, e isso respondia por **~15% dos chutes** e **~19% dos gols**.

Nenhum destes recupera o volume:

| mecanismo | resultado |
|---|---|
| ombro do último defensor | +0,97 chute — o melhor de todos, e não basta |
| duração da arrancada | 0,94→1,71 de impedimento, custa pontaria |
| quais papéis jogam no ombro | alargar **piora** |
| custo do impedimento no `_bestPass` | troca gol por impedimento |
| **impedimento de tempo (D36)** | **resolve o impedimento**, custa gol |
| os cinco juntos | design 10/13, contra 12/13 do estado aceito |

**O que falta não é um mecanismo — é recalibração.** Removido o defeito, a
cadeia chute → xG → conversão precisa ser re-derivada para um jogo com ~4 chutes
a menos por partida, do mesmo jeito que a `XG_ESCALA` foi re-derivada quando o
modelo de defesa mudou na A2. Isso encosta no **D19** ("a partida murcha") e é
projeto, não conserto.

---

## O que fica reconstruível

- o desenho e a medição do D36 estão neste laudo; o da camada 91, em
  `reports/D35-a-marca-que-nunca-sai.md`
- `tools/fisica/bateria.js` mantém `--tuneD35` e `--tuneD36`
- `tools/fisica/ramo-d35.js` (invariantes do NaN) e `ramo-d35b.js` (por que a
  arrancada não dispara) continuam no lugar
- `reports/d35-tentativa-reprovada.json` e `reports/d36-tentativa-reprovada.json`
  guardam as duas medições de 300 partidas

**Ordem correta para quem retomar:** recalibrar o volume ofensivo primeiro
(D19), e só então D35 + D36 juntos. Na ordem inversa, os três reprovam — três
vezes, medido.
