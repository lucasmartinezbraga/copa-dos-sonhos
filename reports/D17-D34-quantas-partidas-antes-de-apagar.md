# D17 / D34 · Quantas partidas antes de apagar — agora com número

**Data:** 2026-08-13 · **Resultado: NADA foi apagado da camada 07, e a razão
é mensurável.**

---

## O que foi feito, e o que ficou de fora

O D17 pede promover ao core os métodos cuja camada é TERMINAL. Metade entrou:
`_integrate` do motor era código morto (a camada 16 substitui sem capturar o
anterior) e saiu — 73 linhas, 14 métricas idênticas ao dígito.

A outra metade é o código morto da **camada 07** (`physics-timeline-581`), cujos
métodos de trajetória a camada 88 substitui. Ela **não** entrou, e não por
falta de tempo.

## O aviso do D34 deixou de ser aviso e virou número

O D34 diz: *"rodar `pilha.js` com 300 partidas ANTES de apagar qualquer coisa"*,
e nota que o número original de 81 sobrescritas mortas era **teto superior**,
não contagem. Medi o quanto isso importa nesta camada:

| partidas | sobrescritas mortas na camada 07 |
|---|---|
| **4** | **12** |
| 12 | 11 |
| 24 | 11 |

E o método que reviveu tem nome:

```
$ comm -23 mortos-n4 mortos-n24
_continueTravel
```

**`_continueTravel` aparece como MORTO com 4 partidas e está VIVO com 24.**
Quem apagasse a camada 07 com a evidência de uma rodada curta removeria um
método vivo do caminho da bola em voo.

## A lista estável, para quem for continuar

Com n ≥ 12 a contagem para de se mexer nestes cinco:

```
_physicalArc
_physicalTargetZ
_planPhysicalSegment
_trajectoryPoint
getPhysicalTimeline
```

São exatamente os que a correção v2 do D17 já nomeava: nascem na camada 07 e são
substituídos pela 88. **Estabilizar em n=24 não é o mesmo que provar em n=300** —
`_continueTravel` é a prova de que caminhos raros existem nesta camada, e não há
razão para achar que ele era o único.

**Portanto: não apagar sem a rodada de 300 partidas que o D34 exige.** O ganho é
higiene; o risco é remover um caminho que só aparece em 1 partida a cada 20.

---

## O que isto acrescenta ao catálogo

1. O D34 tinha um princípio; agora tem uma medição que o sustenta, com o nome do
   método que muda de lado.
2. O D17 fica **parcial** — `_integrate` feito, camada 07 aberta e com a barra
   explícita (300 partidas).
3. Vale como regra geral, e por isso está em `ARMADILHAS.md`: **"morto" é uma
   afirmação sobre a amostra, não sobre o código.** A `pilha.js` conta chamadas;
   zero chamadas em 4 partidas é zero chamadas em 4 partidas.

> É a **B7** aplicada à liveness em vez de a uma métrica de futebol. O erro-padrão
> não some porque o número que você está olhando é um contador de chamadas.
