# OS-29 — varredura do limiar de corte pra dentro

**Base:** R18.59 · 16 partidas, semente 4200000

O `dtgMin` da OS-27 foi escolhido em 23 sem varredura. Varri.

| `dtgMin` | escanteios | gols | xG | chutes |
|---|---|---|---|---|
| **23 (R18.60)** | **2,94** | 2,44 | 2,08 | 16,81 |
| 30 | 2,25 | 2,06 | 1,95 | 16,31 |
| 38 | 2,06 | 2,00 | 2,20 | 17,38 |

**23 é o melhor ponto dos três, e por margem clara.** Empurrar o limiar para
cima piora escanteio *e* gols: o ponta deixa de cruzar mas também não chega a
finalizar de longe, e a jogada morre antes de gerar bloqueio ou espalmada.

Isso confirma a R18.60 por medição, não por sorte na escolha. E fecha o eixo:
não há mais ganho de escanteio neste sítio.

## ESTADO DO ESCANTEIO APÓS TODA A LINHAGEM

`1,19` (R18.50) → `2,94` (R18.60). Contra a faixa 4–10 do ECO-05, ainda falta.

O que **não** explicou o déficit, cada um medido e descartado:
- supressão geométrica de `_setCorner` (OS-05B: supressão 1,06 contra lacuna 2,06)
- escala de tempo (OS-22: escanteio não acompanhou em nenhum dos 4 pontos)
- orçamento de raio das camadas (OS-23: +0,38)
- alcance de marcação (OS-25: piorou, 2,56 → 1,79)
- limiar de corte pra dentro (esta rodada: 23 já é o ótimo)

O que **explicou**, e é onde o ganho veio:
- posicionamento do goleiro (OS-19: 1,56 → 2,31)
- cruzamento exigindo alvo + corte pra dentro (OS-12/OS-27: 1,63 → 2,94)

Os dois ganhos vieram de sítios que eu tinha catalogado como "problema de
goleiro" e "problema de cruzamento". Nenhum veio da linhagem de escanteio.
