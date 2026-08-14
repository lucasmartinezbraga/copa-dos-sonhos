# D41 · A passada passa a ter unidade física

**Data:** 2026-08-14 · **Camada 21, construída, medida e ACEITA** ·
**Instrumento novo:** `tools/fisica/tela/passada.js` (lê a perna desenhada)

Origem: *"as vezes na foto não pega mas os jogadores ficam se mexendo mt rápido,
é estranho"*. A queixa é de tela, e nenhuma das três tabelas de mérito do
projeto — as 14 métricas, o placar de design, o do futebol real — pode vê-la:
`tools/fisica/bateria.js` carrega o bundle com `vm.runInThisContext` e não
desenha nada.

---

## Primeiro erro: a sonda que refazia a conta do alvo

A primeira versão de `passada.js` **reimplementava a fórmula da cadência** para
depois "verificar" a fórmula. Rodei antes e depois da mudança e o número saiu
idêntico — 1,98x nos dois — porque a sonda estava medindo a si mesma.

> **Regra que entrou em `ARMADILHAS.md`:** uma sonda que reimplementa a conta do
> alvo não mede o alvo. Ou lê o resultado, ou não é medição.

A versão que vale põe um `Proxy` no `ctx` durante a chamada real de
`CDS_F25D.body` e lê os **dois retângulos de perna** que o desenho pinta:

```
llY = r*.40 - max(0, sw)*r*.30        =>  sw = (rlY - llY) / (r*.30)
rlY = r*.40 - max(0,-sw)*r*.30
```

Como `sw = sin(fase)·amp`, contar as trocas de sinal de `sw` dá a **cadência em
passos por segundo** e o pico de `|sw|` dá a **amplitude de abertura**. Nenhum
dos dois passa por hipótese minha.

---

## Dois defeitos somados, não um

### [1] A cadência nunca teve unidade física

`sqrt(mv / (r*.16)) * .62` foi ajustada no olho, em pixels. Resultado a 1X:
**4,75 passos/s contra 2,54 do alvo biomecânico — 1,98x.** A passada implicada
era de 0,60 m; um atleta a 3,7 m/s dá passos de ~1,19 m. O jogador não corria,
miudava.

### [2] A velocidade de exibição entrava na conta

O runtime faz `acc += dt * G.speed` e roda N passos de simulação por quadro
desenhado. Em 3X o deslocamento de **tela** por quadro triplica — e a perna,
calculada a partir dele, triplicava junto: **9,90 passos/s.** É esta a
vibração da queixa.

Pior, a mesma `d.spd` de tela alimentava a **amplitude** e a **inclinação do
tronco**: a 1X o atleta corria com a perna 38% fechada (`amp` 0,62) e a 3X com
ela inteira (1,00). O botão de velocidade mudava a postura do jogador.

### O que eu suspeitava e a medição negou

Apostei no balanço anti-cardume (`_amp = sin(t·(14+…))·2,2`, em `70-…js:3332`),
que é oscilação de tempo real somada à posição de tela. Decomposto contra o
deslocamento físico: **responde por 2% de `mv`.** Não é a causa.

---

## A medição, mesma sonda nos dois bundles

| vel | ANTES passos/s | DEPOIS | alvo biomecânico | antes | depois |
|---|---|---|---|---|---|
| 1X | 4,75 | **2,38** | 2,5 | 1,98x | **0,93x** |
| 3X | 9,90 | **4,13** | 2,8 | 3,26x | **1,50x** |
| 6X | 9,77 | **4,63** | 3,0 | 4,09x | **1,56x** |

Amplitude a 1X: **0,62 → 1,00.** A perna abre igual em qualquer velocidade de
exibição.

Corredor real: 2,6 passos/s trotando até ~4,6 no máximo. O 3X ficar em 4,13 é
deliberado — ver abaixo.

---

## O desenho novo

A fase sai de onde tem que sair: **π de fase por PASSO**, e o passo tem
comprimento em metros que cresce com a velocidade.

```js
_pxM   = (fW / FL) * (r / 13);         // px lógicos por metro, com perspectiva
_dm    = mv / _pxM;                    // metros andados no quadro
_vms   = _dm * 60 / G.speed;           // velocidade FÍSICA, m/s
_passoM = 0.60 + 0.16 * d.vms;         // 1,19 m a 3,7 m/s; 1,88 m a 8 m/s
_dfase = PI * (_dm / _passoM) / sqrt(G.speed)
```

`_pxM` foi **conferido contra a medição**: a fórmula dá 7,98 px/m, o medido é
7,82 px/m. A razão `r/13` vale porque o canvas do jogo é lógico (1024×500), o
que torna a conta independente do viewport e do zoom do navegador.

`amp` e `_vig` passaram a sair de `d.vms` (m/s), não de `d.spd` (px de tela).

### Por que o 3X não fica em 1,00x

Em 3X a cadência **honesta** é 3x — é o que fast-forward de vídeo é, e é o único
valor em que o pé acompanha o chão. Mas 3x é exatamente a vibração de que o
jogador reclamou. A raiz de `G.speed` é o meio-termo: deixa 1,73x de cadência
com 3x de corpo, e o teto de `0,30 rad/quadro` garante que nem em 6X vire tremor
(por isso 6X ≈ 4,63 e não 6,5).

Patinação residual assumida: o pé escorrega √3 em 3X. Trocado de propósito pela
leitura.

---

## Portão

Camada 21 é só desenho e a bateria não desenha: **as 14 métricas não podem se
mover por construção.** `bash tools/testes.sh` → 8/8.

Tira de quadros consecutivos, mesma faixa de velocidade nos dois bundles
(6,2 m/s antes, 6,75 m/s depois, ambos a 3X): `tools/fisica/tela/tirinha.js`.

## O que fica reconstruível

- `tools/fisica/tela/passada.js` — cadência e amplitude lidas da perna pintada
- `tools/fisica/tela/tirinha.js` — quadros consecutivos de um atleta, ampliados
