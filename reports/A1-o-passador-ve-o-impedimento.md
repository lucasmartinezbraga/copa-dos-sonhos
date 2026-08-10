# A1 · O passador enxerga a linha de impedimento

Primeiro item do `PLANO-v4-2026-08.md`. Uma linha de diagnóstico, um termo de
conserto, e um efeito colateral que revelou outra coisa.

## O defeito

Medido: **10,0 impedimentos por partida** contra 2,5–6 do futebol de elite.

Lendo o motor, a causa não era a marcação:

- `_pass:1746` marca o impedimento com probabilidade **travada em 0,97**;
- `_offsideLine()` existe e está correto;
- **`_bestPass`, que escolhe o passe com 25+ termos, nunca o consultava.**

`_offsideLine` só era lido pela **movimentação** — `_attackTarget:3466` e as
camadas 36, 43 e 60. O portador jogava a bola no companheiro impedido e o juiz
marcava depois. No futebol real o mecanismo dominante é o inverso: **o passe não
sai.**

## O conserto

Um termo em `_bestPass`, com a mesma geometria que `_pass` usa para marcar:

```js
const linhaImped = this._offsideLine(o.team);          // uma vez por decisão
const leituraLinha = clamp((vis*0.5 + getAttr(o,'decisao')*0.5)/100, 0.30, 1);
…
if (progressM > 2) {
  const margem = (dir > 0 ? m.x : FL - m.x) - linhaImped;
  if (margem > -1.2) penaImped = clamp(0.85 + margem*0.62, 0, 3.1)
                               * (0.55 + leituraLinha*0.85);
}
```

Ele **encarece**, não impede. Erro de leitura continua existindo e continua
sendo mais comum em quem lê pior o jogo — os mesmos atributos (visão, decisão)
que o resto de `_bestPass` já usa. A margem de −1,2 m inclui a zona de
quase-impedimento, onde o passador de verdade já hesita.

## Resultado — 300 partidas

| | antes | depois | faixa real |
|---|---|---|---|
| **Impedimentos** | 10,03 | **5,11** | 2,5–6 ✓ |
| Impedimento repetido (narração) | 3,0 | **2,0** | |
| Finalizações | 22,03 | 23,72 | 22–28 ✓ |
| Chutes no alvo | 7,22 | 7,63 | 7,5–9,5 ✓ |
| Escanteios | 10,08 | 11,10 | 9–12 ✓ |
| Goleadas | 0,200 | 0,177 | 0,10–0,18 ✓ |
| **Gols** | 2,833 | **3,27** | 2,5–3,0 ✗ |

**Placar de design: 11/13, igual a antes.** (O 9/13 que apareceu em 120
partidas era ruído em vermelhos e goleadas — some com n=300, como já tinha
acontecido duas vezes nesta sessão.)

**Futebol real: 12/21, igual a antes** — mas com composição melhor: entraram
impedimentos, chutes no alvo e goleadas; saíram gols e xG, que são o mesmo
efeito contado duas vezes.

## O efeito colateral, e a aritmética que o explica

Os gols subiram **+0,42**. A conta fecha sozinha:

```
4,9 impedimentos a menos por partida  ×  ~8,5% de conversão  =  +0,42 gol
```

**A1 removeu um freio escondido.** A conversão do motor estava calibrada contra
um jogo que matava 10 ataques por partida no apito. Metade deles voltou a
existir.

## O que a tentativa de compensar descobriu

Varri `CAL.shooting.conversionScale` de 2,25 para 2,05 (−9%): os gols caíram
apenas de 3,27 para **3,15**, e o xG caiu junto para 2,887.

Isso diz que **o knob está errado**, e o motivo aparece em duas métricas:

```
gols 3,15  com  xG 2,887      → o jogo marca MAIS do que o proprio xG
golPorChuteNoAlvo 0,428       → futebol real: 0,27 a 0,38
```

O problema não é quantos chutes saem nem de onde — é que **chute no alvo vira
gol com frequência alta demais**. Isso é o modelo de goleiro da camada 88
(`DEFESA_BASE 0,80`, `DEFESA_POR_METRO 0,30`), não a escala de conversão.
Reverti o `conversionScale` para 2,25 e **não** mexi no goleiro: é outro
conserto, com sua própria medição.

## Critério de aceite

1. `verify.py` e `browser_smoke.js` — passam;
2. métricas que se moveram 2 SE: **impedimentos** (declarada, −6,52),
   finalizações (+2,06) e escanteios (+2,32) — as duas últimas são consequência
   direta de menos jogadas mortas, e ambas seguem dentro da faixa;
3. narração: nenhuma suspeita piorou; impedimento repetido caiu de 3,0 para 2,0;
4. `pilha.js`: nenhuma sobrescrita morta nova.

## Próximo

O `golPorChuteNoAlvo` em 0,428 contra 0,27–0,38 do futebol real, agora com
causa localizada no modelo de goleiro. É o conserto que devolve os gols à faixa
sem tirar chute nenhum do jogo.
