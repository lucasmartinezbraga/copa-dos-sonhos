# OS-28 — constante vira função de atributo: **não promovida**

**Base:** R18.60 · 16 partidas, semente 4200000

Converti dois sítios que eu mesmo tinha deixado como constante:
- o `dtg > 23` da OS-27 → `16 + finalizacao/100*14`
- `crossP` (`:5154`), que não lia habilidade nenhuma → fator `.72 + low_cross/100*.56`

## MEDIÇÃO: razão chute/cruzamento por faixa de finalização

| finalização | R18.60 | R18.61 (OS-28) |
|---|---|---|
| baixa (<68) | 0,00 | 0,13 |
| média (68–81) | 0,69 | 0,75 |
| alta (≥82) | 0,99 | 1,01 |
| escanteios | **2,94** | 2,38 |
| xG | 2,08 | 1,85 |

## VEREDITO: NÃO PROMOVER

**O gradiente já existia.** Em R18.60, sem nenhum dos dois edits, o finalizador
ruim já cruzava sem chutar (0,00) e o bom já chutava tanto quanto cruzava
(0,99). A separação por habilidade estava lá, vinda dos caminhos que já leem
atributo (`:8084` decisionIQ, `:5199` cone, o escore de `context`).

O ganho do patch é marginal — 0,69→0,75 na faixa média — e vem com escanteio
caindo de 2,94 para 2,38 e xG de 2,08 para 1,85.

Eu propus estes dois sítios dizendo que "nenhum deles lê atributo hoje". Sobre
o comportamento observável isso estava **errado**: a constante não lia, mas a
decisão que chega até ela já vinha filtrada por atributo mais acima. Medir a
constante isolada não era o mesmo que medir se o jogador se diferencia.

## O QUE FICA PARA A PRÓXIMA

O método continua certo — converter constante em função de atributo, um sítio
por vez, cada um virando candidata medível. O que muda é o critério de escolha
do sítio: **medir primeiro se o gradiente já existe**. Sítio onde o craque já
se separa do mediano não precisa da conversão, e pagar escanteio por ela é
prejuízo.
