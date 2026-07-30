# ECO-03 — reespecificação proposta

**Estado atual na matriz:** chutes por partida, faixa 12–20, "piso estrito",
baseline `12,458 R18.35`, banda de ruído ~7%.

## O problema

O baseline registrado (12,458) é de **uma** base de semente: `4200000`. Medido em
três bases independentes, n=48 cada, com a build R18.35 **já promovida**:

| base | chutes (baseline R18.35) | piso 12 |
|---|---:|---|
| 4200000 | 12,458 | cumpre |
| 8400000 | 11,854 | **reprova** |
| 1260000 | 11,750 | **reprova** |
| **mediana** | **11,854** | **reprova** |

O gate é cumprido pela baseline em **1 de 3 bases**. Como consequência, ele não
discrimina candidatas: a diferença entre passar e reprovar (12,042 contra 11,958)
é de 0,35%, contra uma banda de ruído de 7%.

Isto já causou um erro real nesta rodada: a OS-09 foi excluída da R18.40A por
esse critério. Ver `reports/r1840/RELATORIO.md`, seções H2 e H2.1.

## Duas leituras possíveis

**(a) O gate descreve o jogo.** O piso está mal calibrado e deveria cair para
algo em torno de 11, que é o que o motor entrega. A OS-09 entraria.

**(b) O gate é meta de design.** O jogo *deveria* chutar mais, e 11,4–12,6 é
insuficiente. O piso fica onde está, passa a reprovar de propósito, e "poucos
chutes" torna-se defeito rastreado — como já acontece com `ECO-05` (escanteios
1,1 contra faixa 4–10).

## Proposta: (b), com o piso aplicado sobre a mediana de 3 bases

Manter **12** como alvo, porque a Ordem de Serviço classifica chute como
"Momento" — a camada que deve ficar em 0,7–1,0× do futebol real — e 11,4 por
partida está abaixo disso. Mas parar de aplicá-lo sobre uma base única, porque aí
a decisão é sorteio.

```
ECO-03  chutes/partida  >= 12  aplicado a MEDIANA de 3 bases de semente
        (4200000, 8400000, 1260000), n=48 cada
        status atual: REPROVA — inclusive a baseline (mediana 11,854)
        classificacao: defeito rastreado, nao bloqueio de promocao
```

Enquanto `ECO-03` estiver reprovando na baseline, ele **não pode bloquear
promoção** — um gate que a própria base não cumpre não separa candidata boa de
ruim. Ele passa a ser meta, e a promoção é decidida pelos gates válidos em 3/3
(`ECO-01`, `ECO-02`, `ECO-04`).

## Verificação de que esta proposta não é auto-servente

A preocupação legítima: reescrever um gate para fazer passar a candidata que eu
mesmo propus. Sob a mediana de 3 bases:

| build | s1 | s2 | s3 | mediana | piso 12 |
|---|---:|---:|---:|---:|---|
| R18.35 baseline | 12,458 | 11,854 | 11,750 | 11,854 | reprova |
| R18.40A `vel+goleiro` | 12,042 | 11,438 | 12,563 | 12,042 | cumpre |
| `sub_a` `+folego73` | 11,958 | 11,417 | 13,000 | 11,958 | **reprova** |

A OS-09 **continua fora** com a regra nova. A reespecificação não muda a decisão
da R18.40A e não beneficia a candidata excluída — o que era exatamente o teste
que essa proposta precisava passar.

## O que fazer com a OS-09

Fica **fora** da R18.40A, agora por um critério que se sustenta em três bases, e
não mais por 0,042 numa base. Ela permanece medida e arquivada
(`tools/r1840/patch_folego.js`, gatilho 73 = 3,56% das decisões, dentro de
INT-05). Volta a ser candidata quando o volume de chutes subir por mérito — o que
é a mesma agenda do gate.

Registro do sinal contrário, para não se perder: `sub_a` melhora **gols**
(+0,8% / +5,5% / +15,6%) e **chutes no alvo** (+0,5% / +5,3% / +17,7%) de forma
consistente nas três bases, com "no alvo" acima da banda de ruído. É o argumento
mais forte a favor da OS-09 e deve ser reavaliado assim que `ECO-03` deixar de
reprovar na baseline.
