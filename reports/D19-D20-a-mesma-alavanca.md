# D19 e D20 são a mesma alavanca — laudo de três tentativas reprovadas

**Data:** 2026-08-12 · **Baterias gastas:** 4 × 300 partidas · **Resultado: nenhuma
das três mudanças entrou.**

Este laudo existe porque resultado negativo é resultado, e porque a próxima
pessoa vai querer fazer exatamente o que eu fiz.

---

## O que os dois defeitos diziam, separados

**D19 — a partida murcha.** 20,0% dos gols até os 15 minutos e 14,7% depois dos
76. No futebol de elite é o inverso. O documento explicava por "fadiga uniforme
demais", citando **r = 0,814** entre stamina e taxa de chutes.

**D20 — o bloco não compacta.** Ao perder a bola o time encurtava 2,8 m. No
futebol de elite encurta 8 a 10.

Eles estão em seções diferentes do catálogo, com donos diferentes, e a regra do
projeto manda **não medi-los na mesma rodada** porque se contaminam.

Estavam certos sobre a contaminação e errados sobre a razão: não é que os
efeitos se misturam. **É que é o mesmo parâmetro visto de dois lados.**

---

## Primeiro: `r = 0,814` não era mecanismo

Stamina cai monotonicamente durante a partida. Qualquer coisa que caia junto
correlaciona alto com ela sem ser a causa. Aquele número era compatível com
quatro histórias que pedem consertos opostos.

`tools/fisica/ramo-d19.js` separou as quatro, em 48 partidas, por minuto de jogo
(razão 76+ / 0‑15):

| hipótese | razão | veredito |
|---|---|---|
| **H1 · cria menos chutes** | **0,685** | ✅ é esta |
| H2 · finaliza pior | 0,996 | descartada |
| H3 · bola para mais | 1,078 | descartada |
| H4 · relógio não uniforme | 0,928 | descartada |

> **Aviso que vale o laudo inteiro:** a mesma sonda com **8** partidas deu
> H2 = 0,504, que parecia um segundo mecanismo e era ruído. 131 gols em 48
> partidas dão SE ≈ 3,1 pontos percentuais por faixa. Com 8 partidas não se
> conclui nada.

Depois, `ramo-d19b.js` abriu o funil — 32 partidas, tudo por minuto de jogo:

| degrau | razão 76+/0‑15 | |
|---|---|---|
| posses por minuto | 0,940 | estável |
| decisões por minuto | 0,940 | estável |
| **em alcance de chute (10–27 m)** | **0,613** | ⬅ cai aqui |
| chutes por minuto | 0,611 | acompanha |
| avanço médio do portador | 0,981 | estável |
| velocidade média dos 22 | 0,913 | −8,7% |

O time faz as **mesmas** posses, toma as **mesmas** decisões e fica na **mesma**
distância média do gol. O que ele deixa de fazer é **entrar** na faixa de chute:
−39%. Uma perda de 8,7% de velocidade virou 39% de penetração, porque a jogada
tem orçamento de tempo antes de acabar.

E o auditor achou o complemento sozinho: os **passes sobem** monotonicamente ao
longo da partida (15,5 → 18,2 por minuto). O time cansado **roda a bola em vez
de penetrar.**

---

## As três tentativas

### 1 · Achatar a fadiga na velocidade (D19)

`staminaF` de `0,7 + stamina/100 × 0,3` para `0,75 + × 0,25`, na **camada 16** —
não no motor, cuja linha idêntica **não roda** (custou uma rodada inteira; virou
a armadilha A6).

| | resultado |
|---|---|
| 14 métricas em 2 SE | ✅ todas |
| placar de design | ✅ 12/13 |
| gols após 76' | 14,7% → **16,1%** |
| gols até 15' | 20,0% → **17,4%** |
| **encurtamento do bloco** | 2,8 m → **0,8 m** ❌ |

Passou nos dois portões **e não entrou**: os critérios declarados do D19 (0‑15'
≤ 15%, 76+ ≥ 20%) não foram atingidos, e o preço foi piorar um defeito conhecido
que nenhum portão vigia. Jogador cansado menos lento recompõe menos.

> Dose anterior (`0,80 + × 0,20`) foi **reprovada** pelo placar de design:
> `blowoutRate` 0,157 → 0,200. Time cansado mais rápido = quem já está por cima
> continua criando = margens abrem.

### 2 · Compactar o bloco (D20)

Primeiro achei que faltava um **teto** para o atacante na camada 23 — DEF e MID
têm trilho, FWD não tinha. Pus o teto. Com `linha+18`, `ramo-d20.js` mediu
**22,9% dos alvos de FWD ainda voltando acima de `linha+30`.** Ramo morto: a
camada 60 roda depois e aplica um **piso**.

A causa real são **duas constantes quase iguais**, soltas dentro da camada 60:
piso de **32 m** defendendo e **33 m** atacando. O encurtamento do bloco *é*
essa diferença de 1 m. Não faltava mecanismo — faltava alguém pôr os dois
números lado a lado, e eles moravam onde ninguém compara.

Piso defensivo 32 → 24:

| | resultado |
|---|---|
| comprimento com bola | 41,0 → **36,7 m** (real 30–40) ✅ |
| comprimento sem bola | 38,2 → **33,3 m** (real 25–35) ✅ |
| encurtamento | 2,8 → 3,4 m |
| **chutes** | **−2,18** (2 SE = 1,17) ❌ |
| **gols** | **−0,374** ❌ |
| escanteios | −1,29 ❌ |
| `zeroZeroRate` | 0,080 → **0,127**, fora da faixa ❌ |

Os dois comprimentos entraram nas faixas reais **pela primeira vez** e o jogo
piorou. Bloco compacto o tempo todo mata o ataque: o atacante recuado tem chão
demais para percorrer na transição.

### 3 · O piso que envelhece (D19 + D20 como um mecanismo só)

A tese: no futebol real a fadiga **não é simétrica**. Ela não deixa todo mundo
mais lento em bloco — ela **desorganiza quem defende**, e é por isso que o fim de
jogo tem mais gols. No motor a fadiga só subtraía velocidade de todos, então só
podia subtrair futebol.

Piso defensivo interpolado pela stamina média do time: 24 m inteiro → 33 m
exausto.

| | resultado |
|---|---|
| gols | −0,070 (era −0,374) ✅ quase recuperado |
| `blowoutRate` | 0,140 ✅ |
| `zeroZeroRate` | 0,103 ✅ |
| **chutes** | **−1,28** (2 SE = 1,18) ❌ |
| cartões vermelhos | 0,250 → 0,310, fora por 0,01 ❌ |
| **gols após 76'** | **14,7%** — não mexeu ❌ |

O mecanismo devolveu os gols mas **não moveu a distribuição**, que era o alvo.
Provável razão: o bloco só afrouxa quando o time está exausto — e nessa altura o
**atacante também está**, então os dois efeitos se cancelam.

---

## O que fica provado

1. **`r = 0,814` era correlação.** O mecanismo é penetração na faixa de chute,
   não pontaria, não relógio, não posse.
2. **Forma e volume de chances são a mesma alavanca em sentidos opostos.**
   Compactar tira gols; afrouxar devolve gols e desfaz a forma. Três doses
   diferentes, três pontos da mesma curva.
3. **Nenhum parâmetro isolado paga as duas pontas.** Não é falta de calibração:
   é que o modelo não tem o que o futebol tem.

## O que falta, e não é calibração

O motor não tem **fase de transição**. Quando o time perde a bola, ele troca de
alvo — não *recompõe*. No futebol real existe um intervalo de 3 a 6 segundos em
que o time corre para trás em bloco, e é isso que produz ao mesmo tempo:

- bloco curto **depois** de recomposto (o que o D20 quer), e
- espaço aberto **durante** a recomposição (o que o D19 quer),

com a fadiga decidindo **quanto tempo** a recomposição leva. Uma fase, dois
efeitos, um mecanismo — em vez de um piso que tenta ser as duas coisas ao mesmo
tempo e não consegue ser nenhuma.

Isso é trabalho de modelo, não de constante. É a próxima OS.

---

## Ferramentas que ficaram

| arquivo | o que faz |
|---|---|
| `tools/fisica/ramo-d19.js` | separa as 4 hipóteses do D19 por minuto de jogo |
| `tools/fisica/ramo-d19b.js` | o funil: posses → alcance → decisões → chutes |
| `tools/fisica/ramo-d20.js` | quem posiciona o atacante sem a bola |
| `tools/auditor.py` | acha sozinho as 4 formas de defeito deste projeto |
| `tools/regressao_design.py` | o portão que pegou duas destas três reprovações |

E três armadilhas novas em `reports/ARMADILHAS.md`: **A6** (a camada repete a
constante do core e só ela roda), **B8** (detector sem teste contra positivo
conhecido é detector calado) e **C4b** (esperar por processo corre contra a
largada).
