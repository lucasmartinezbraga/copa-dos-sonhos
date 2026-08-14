# D43 · A família do drible, e o braço que abanava

**Data:** 2026-08-14 · **Camadas 21 e 69, construídas, medidas e ACEITAS** ·
**Instrumento novo:** `tools/fisica/tela/drible.js`

---

## Primeiro: quantos dribles acontecem — e a minha conta errada

> ### ⚠ CORREÇÃO (2026-08-14, mesmo dia)
>
> A primeira versão desta seção dizia **"o duelo de drible acontece ~4 vezes
> por partida"**, a partir de uma amostra de 75 s no navegador que contou 3
> dribles. **Está errado.** Três medições independentes dizem outra coisa:
>
> | fonte | dribles por partida |
> |---|---|
> | bateria, 24 partidas (`eventosPorPartida`) | **32,3** |
> | sonda headless, 14 partidas completas | **30,7** |
> | navegador, razão drible/pressão × taxa da bateria | **~32** |
>
> O drible **não é raro** — é um dos duelos mais frequentes do jogo, atrás só
> de pressão e contenção. As poses fiadas aqui valem muito mais do que eu
> disse.
>
> Testei a hipótese óbvia para a discrepância — que a bateria usa Brasil 1970
> dos dois lados e o navegador usa esquadras arbitrárias — e ela **caiu**: a
> razão drible/pressão é 0,0688 (Bélgica 2022 × Inglaterra 1998), 0,0687
> (Brasil 1970 × Brasil 1970) e 0,0661 (bateria). O motor se comporta igual nas
> três. A contagem baixa daquela amostra específica ficou sem explicação, e é
> por isso que ela não pode ser a base de nada.

Contagem correta, por partida (bateria, 24 partidas):

| evento | por partida |
|---|---|
| pressure | 488,3 |
| containment | 201,0 |
| tackle_attempt | 78,6 |
| tackle | 47,1 |
| **dribble** | **32,3** |
| shot_taken | 15,7 |
| loose_duel | 3,0 |

Os vizinhos de alta frequência que fiei junto (`tackle_attempt`, `containment`)
seguem valendo — mas não porque o drible seja pequeno, e sim porque eles também
não tinham pose.

---

## O defeito: a fiação lê sempre `data.by`

Toda a OS-46 lê `data.by`. Nos desfechos **defensivos** o `by` é o **defensor** —
quem perdeu a bola está em `data.on`, e nunca era consultado.

```
tackle (source: dribble)     by = defensor    on = driblador   ← nunca lido
loose_duel                   by = defensor    on = driblador   ← nunca lido
containment (failed_dribble) by = defensor    on = driblador   ← nunca lido
```

Por isso `dribble_failure` estava declarado, desenhado e **nunca pedido**: não
faltava evento, faltava ler o outro lado do evento.

Os demais buracos:

| estado | por que nunca disparava |
|---|---|
| `dribble_success` | nenhum evento mapeava para ele — falta o *depois* do gesto |
| `outside_cut` | a tabela `MOVE` só tinha `'corta pra dentro'` |
| `dribble_prepare` | era o *fallback* de `move` nulo, e `move` nunca é nulo |
| `burst_touch`, `protect_turn` | só vinham de um drible **de elite** (`vel≥88`, `dri≥88`), e nunca do portador comum |

E os dois cortes, quando disparavam, **desenhavam idênticos**: `cutting` não
olhava para qual dos dois era.

---

## O conserto

**1. Ler `data.on`.** `dribble_failure` nos três desfechos; `body_duel` para o
defensor no `loose_duel`; `dribble_prepare` quando o duelo é recusado — que é
literalmente o preparo abortado.

**2. Encadeamento de um passo.** `request(estado, now, {entao: 'x'})`: quando o
gesto termina, entra o desfecho. É o que faltava para `dribble_success` e
`recover` existirem — os dois só fazem sentido *depois* de outra coisa.

**3. O corte sai da geometria.** O duelo escreve `_tx/_ty` no driblador **antes**
de emitir, então dá para ler para onde ele saiu: em direção ao meio é por
dentro, em direção à linha lateral é por fora. Sem nome novo do motor.

**4. `burst_touch` e `protect_turn` saem da cinemática, não do duelo.** Arrancar
com a bola e girar protegendo-a são coisas que o portador faz o tempo todo. O
piso dele era `speed > 0.3 ? 'carry' : 'protect'` — duas posturas para tudo.
Agora aceleração forte com bola vira arrancada, e giro sob marcação (adversário
a menos de 3 m) vira giro de proteção.

**5. Os vizinhos.** `tackle_attempt` (78,6 por partida) não tinha pose nenhuma — só `tackle` e
`tackle_missed` estavam fiados. E o bote perdido agora encadeia `recover`, que é
a versão visível do `_beatenUntil` que a física do defensor já paga.

---

## §D44 · O braço estava balançando no eixo errado

> *"os braços mexendo na hora da corrida é meio sei lá zoado, parece um
> joguinho bosta"*

```js
const abY = -sw * r * .26,  abX = -sw * r * .10 * face;   // antes
```

O componente **grande** era o vertical. Braço humano não sobe e desce ao correr
— ele vai e volta ao longo do corpo, e o pouco de vertical que aparece é
consequência. Com o peso invertido o boneco abanava, e abanava em contrafase com
a perna.

```js
const abY = -swB * r * .08, abX = swB * r * .17 * face;   // agora
```

Curso principal no eixo do deslocamento, um terço do vertical de antes.

---

## A medição

| | antes da §D42 | depois da §D42 | agora |
|---|---|---|---|
| estados **nunca desenhados** | 35/62 | 27/62 | **15/62** |
| estados iguais à corrida | 4 | 0 | **0** |

Passaram a aparecer: `burst_touch` 24 · `inside_cut` 15 · `dribble_prepare` 9 ·
`dribble_failure` 8 · `turn_dribble` 8 · `protect_turn` 7 · `outside_cut` 7 ·
`dribble_success`.

---

## Portão — e uma correção minha no meio dele

A camada 69 termina em `(typeof window!=='undefined'?window:globalThis)`: ao
contrário da ponte da §D42, **ela carrega no headless**. O argumento "as
métricas não podem se mover por construção" não valia aqui, então medi.

Bateria pareada, 24 partidas, semente 4200000:

- **`agregado`: 14 chaves, 0 diferenças** — idêntico ao dígito
- **`eventosPorPartida`: 73 chaves, 0 diferenças**
- `fisica`: 1 diferença, `ramos.defSomaP` `…855994` → `…855996`

Concluí que aquela diferença de 2·10⁻¹⁴ era minha, porque rodar o build novo
duas vezes deu resultado bit-idêntico. **Estava errado — o teste tinha n=1.**
Rodando o build *antigo* uma segunda vez ele produziu os dois valores:

```
antes  run1: 91.31169766855994      depois run1: 91.31169766855996
antes  run2: 91.31169766855996      depois run2: 91.31169766855996
```

É oscilação de último bit na ordem de soma entre partidas, presente no build não
modificado. Não é da mudança.

> **Regra:** "rodei de novo e deu igual" com n=1 não estabelece determinismo.
> Para atribuir uma diferença a uma mudança, o **controle** também tem que ser
> repetido.

`bash tools/testes.sh` → 8/8.

---

## O que sobra: 15 estados

- **`body_feint`** — mapeado, desenhado, e travado atrás de `dri≥88 && tec≥84`.
  19,2% dos atletas em campo passam nesse corte (medido), então ele acontece —
  só não caiu na amostra. É decisão de design do motor; não mexi.
- **`long_pass`, `placed_shot`, `power_shot`, `volley`** e os estados de goleiro:
  tratados na **§D45–§D48**, no laudo `D45-o-goleiro-e-a-tela.md`.
