# R18.50 — PRESERVAR ENERGIA SAI DO CÓDIGO MORTO

**Build** `dist/COPA DOS SONHOS - R18.50 - PRESERVAR ENERGIA.html` · SHA `495a9d684104…`
**Baseline** R18.49 (`508dc42c2f63`) · **Patch** `tools/r1840/patch_folego.js --gatilho=76`

Promovida. Os seis gates cumprem em 3/3 bases. `INT-05` de 0,00% para 6,67%, e
`COE-01` **melhora** de 1,062 para 1,037.

---

## A. O que entrou

`_adaptivePlan` só escolhe o plano `save_energy` quando a estamina média do time
cai abaixo de um gatilho. O gatilho era **62** e o piso que o motor produz está
acima disso — o plano era aritmeticamente inalcançável. Gatilho **76**.

| | R18.49 | R18.50 |
|---|---:|---:|
| `INT-05` `save_energy` (% das decisões) | 0,00% | **6,67%** |
| `balance` (piso 40%) | — | 51,12% |

## B. Correção a um número da auditoria

A auditoria R18.49 registra, para reabrir OS-09: *"gatilho 73 = 3,56% das
decisões, dentro de INT-05"*. **Esse número é da era R18.40 e não vale nesta
build.** Medido aqui, sobre a R18.49:

| gatilho | `save_energy` |
|---:|---:|
| 73 | **2,41%** — abaixo do piso de 3% |
| 76 | **6,67%** — meio da faixa |
| 79 | 10,41% — perto do teto |

As rodadas de estrutura de bloco (R18.43 em diante) mudaram a dinâmica de
estamina. Promover com 73 teria reprovado `INT-05` por 0,6 ponto.

## C. Bateria pareada, 3 bases, mediana

| gate | faixa | R18.49 | R18.50 | amplitude | |
|---|---|---:|---:|---|---|
| ECO-01 gols | 2,4–3,2 | 2,583 | **2,500** | 2,50–2,67 | cumpre 3/3 |
| ECO-02 xG | 1,8–2,7 | 2,432 | **2,435** | 2,41–2,54 | cumpre 3/3 |
| ECO-03 chutes | 12–20 | 14,813 | **14,813** | 14,81–15,02 | cumpre 3/3 |
| ECO-04 no alvo | 4–7 | 4,792 | **4,813** | 4,75–5,06 | cumpre 3/3 |
| COE-01 gols/xG | 0,90–1,15 | 1,062 | **1,037** | 0,99–1,10 | cumpre 3/3 |
| CAU-03 % falha GK | < 8 | 1,724 | **2,344** | 0,83–2,50 | cumpre 3/3 |

Sementes `4200000 / 8400000 / 1260000`, n=48 cada. A build medida é a build
entregue: o patch de identidade é neutro e os agregados são idênticos antes e
depois dele.

**Sobre `COE-01`:** o §E do relatório da R18.49 declarou um drift de 1,019 para
1,062 e pediu vigilância. Esta rodada o traz para 1,037 sem ter sido desenhada
para isso — `save_energy` reduz pressão e ritmo, e menos gol fora do modelo de xG
é consequência plausível. Registro como observação, **não** como conserto: não
isolei o mecanismo.

**Sobre `CAU-03`:** sobe de 1,724 para 2,344. Está muito abaixo do alvo de 8 e a
amplitude entre bases (0,83–2,50) contém os dois valores, então não é efeito
mensurável.

## D. Integridade

| gate | resultado |
|---|---|
| TEC-04 determinismo | 8/8 e 8/8 em ordem inversa |
| TEC-05 carga do bundle | 50 ok / 1 erro, `motorVerificado: true` |
| escanteio íntegro | `corner` 16 = `corner_delivery` 16 |
| `_adaptivePlan`, ordem da cascata | não tocados fora do gatilho |

---

## E. OS-05 — mecanismo localizado, tentativa REJEITADA

Esta parte é registro de fracasso com o número que o motivou.

### O mecanismo, que é real

Ramo aéreo de `_cross`, quando o **zagueiro** ganha o primeiro contato
(`10-base-bundle.js:3255`):

```js
if(def){ def.rating+=.08; this._emit('header_clear',{by:def}); this._turnover(def); }
```

`_turnover(def)` entrega a bola ao zagueiro no mesmo quadro. Cabecear um
cruzamento vira posse controlada: a bola não viaja, não existe segunda bola, e —
o que importa para OS-05 — ela nunca pode cruzar a própria linha de fundo.

Medido na R18.49, 18 partidas:

| | valor |
|---|---:|
| cruzamentos da linha de fundo por partida | 5,67 |
| **com último toque da DEFESA** | **1,39** |
| escanteios por partida (`setCorner`) | 2,39 |
| escanteios por partida (evento `corner`) | 1,33 |
| faixa `ECO-05` | 4–10 |

O toque defensivo que cruza a linha é a **única** fonte de escanteio por
geometria (`_ballOut`). Cardápio defensivo por partida: `intercept` 11,44 ·
`tackle` 7,33 · `gk_claim` 2,83 · `save` 1,89 · `header_clear` 1,00 ·
`gk_punch` 0,56 · `_clearBall` 0,17.

### Por que a tentativa foi rejeitada

`tools/r1850/patch_cortecabeca.js` faz a bola seguir viva depois do corte, no
padrão de inversão de causalidade da R18.31. O patch **executa** (`corte_livre`
dispara 11 vezes contra 12 de `header_clear`), e mesmo assim:

| | R18.49 | corte A | corte B |
|---|---:|---:|---:|
| escanteios `setCorner`/partida | 2,39 | 1,56 | 1,56 |
| **evento `corner`/partida** | **1,33** | **0,00** | **0,00** |
| toque DEFESA na linha/partida | 1,39 | 0,50 | 0,50 |
| pct defensivo | 24,5% | 12,2% | 12,2% |

**O evento `corner` foi a zero** enquanto `_setCorner` continuava sendo chamado:
o escanteio é armado e nunca entregue.

E as variantes A e B — com o cabeceio mal dado indo para frente (`[-0,55; 0,35]`)
contra indo decididamente para trás (`[-1,0; -0,45]`), velocidades diferentes,
**shas diferentes** — produzem partidas **idênticas em todos os 62 eventos**,
inclusive `pass` 3691. Duas builds distintas replicando bit a bit.

Isso não é calibração ruim, é defeito estrutural do meu patch: **este mesmo ramo
aéreo também processa a cobrança de escanteio**, e deixar a bola viva ali
interfere na máquina de bola parada. Eu não distingui cruzamento de jogada
corrida de cobrança de bola parada, e era exatamente a distinção que o sítio
exigia.

Fica arquivado e não promovido. O mecanismo continua válido e merece rodada
própria com essa separação feita.

## F. Arquivos

```
dist/COPA DOS SONHOS - R18.50 - PRESERVAR ENERGIA.html      495a9d684104
tools/r1850/patch_identidade50.js
tools/r1850/diag_fonte_canto.js        cardapio de fontes de escanteio
tools/r1850/patch_cortecabeca.js       MEDIDO E REJEITADO (§E)
reports/r1850/final_{bat,xg}_s*.json   build promovida, 3 bases
reports/r1850/f76_{bat,xg}_s*.json     gatilho 76 pre-identidade
reports/r1850/folego_s*.json           gatilho 73, abaixo de INT-05
reports/r1850/fonte_canto_{r1849,corte,corteB}.json
reports/r1850/determinismo.json  reports/r1850/treinador_folego.json
```

## G. Próximo

1. **OS-05 com a separação feita**: tratar o corte de cabeça só quando o
   cruzamento vem de jogada corrida, deixando a cobrança de escanteio intocada.
   O cardápio da §E diz onde há volume.
2. **`ECO-05` continua o defeito mais visível**: 1,1 escanteio por partida contra
   faixa 4–10. Orçamento de xG apertado — a folga até o teto de `ECO-02` é 0,265
   (2,435 contra 2,7), e a auditoria estima +0,1 a +0,26 para chegar à faixa.
3. **OS-02 segue bloqueada** pela mesma razão da auditoria R18.49: o teto de xG
   está certo contra futebol real, e o resto do motor é generoso demais para
   suportar um ataque bem escalado.
