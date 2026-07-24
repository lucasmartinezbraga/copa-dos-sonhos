# Decisão do limitador angular (`r15-angular-rate-limit`)

Fecha o item A do plano: matriz concluída, limitador promovido ou rejeitado com
números. Escrito depois de rodar a terceira matriz de 294 partidas — a que
faltava para transformar extrapolação em medição.

---

## 1. O que o critério pré-registrado respondeu

Rodado sem alteração, como escrito:

| candidata | veredito mecânico | bloco que falhou |
|---|---|---|
| R16.0 | `AJUSTA_A_CURVA` | B (sub-gate `marking`) + E (balanced −0,512 ppg) |
| R16.2 | `AJUSTA_A_CURVA` | B (sub-gate `marking`) |

**O critério permanece intacto e seu veredito permanece válido.** Nada neste
arquivo edita `CRITERIO-R16.0-PRE-REGISTRADO.md` — fazê-lo invalidaria a
certificação, como o próprio critério determina.

O que segue é a apuração de **se a instrução `AJUSTA_A_CURVA` pode ser cumprida**.

## 2. Primeiro problema: o bloco B foi ancorado na build errada

O critério atribui à R15.9 três números que são, verbatim, os da **R15.4**
(`real-r154.json`) — a build que o próprio `CHANGELOG-R15.md` registra como
NÃO EMBARCAR:

| grandeza | critério diz (R15.9) | controle real (R15.8/R15.9) | erro |
|---|---:|---:|---|
| `threatCoverage` | 0,5430 | **0,5591** | limiar 0,530 ficou frouxo |
| `markerMeanDistance` | 8,8716 m | **8,4752 m** | limiar 8,90 ficou 0,40 m frouxo |
| sub-gate `marking` | 1/294 | **3/294** | piso declarado abaixo do real |

A tolerância pretendida ("controle + 0,03") seria **8,5052 m**. Aplicou-se 8,90.

*(O controle declarado, R15.9 `b3e10532`, nunca rodou matriz — usa-se
`real-r158.json`. Verifiquei: R15.8 → R15.9 são 48 linhas de CSS, zero de motor,
16 scripts idênticos. A substituição é legítima.)*

## 3. Segundo problema: o sub-gate que reprovou não distingue nada

O sub-gate é composto:

```js
marking: rates.threatCoverage >= .65 && rates.markerMeanDistance <= 8.5
```

Decomposto (`tools/r15/subgate_power.py`, novo):

| perna | R15.9 | R16.0 | R16.2 | p90 do controle | limiar |
|---|---:|---:|---:|---:|---:|
| `threatCoverage >= .65` | 3/294 | 0/294 | 0/294 | 0,6136 | 0,65 |
| `markerMeanDistance <= 8.5` | 171/294 | 148/294 | 153/294 | — | 8,5 |

A perna que decide é a **cobertura**, cujo limiar (0,65) está **acima do p90 de
todas as builds** e 0,10 acima da média. Ela passa em 1% das partidas no
controle e em 0% nas candidatas. Um deslocamento de média de −0,0074 empurrou
uma cauda de 3 partidas para baixo da linha.

**Reprovar uma promoção por 3/294 → 0/294 nesse regime é reprovar por ruído.**
O mesmo vale para `spatialOverload`: a média é idêntica (0,5397 → 0,5392,
t = −0,16), e mesmo assim o contador foi de 35 para 28 — cauda, não comportamento.

## 4. `AJUSTA_A_CURVA` é executável? Não.

O knob é o `bonus` do termo de alívio em baixa velocidade:

```
_max = turn * ( 14/(1.2+v) + bonus/(1+v²) ) * dt
```

Três pontos medidos, 294 partidas cada, mesmas seeds
(`tools/r15/curva_limitador.py` · `reports/r15/curva-limitador.json`):

| build | bonus | giros bruscos | dist. marcador | penalidade | cobertura | gols |
|---|---:|---:|---:|---:|---:|---:|
| R15.9 (controle) | — | 0,0119 | 8,4752 | +0,0000 | 0,5591 | 3,109 |
| R16.0 | 0 | 0,0013 | 8,6639 | +0,1887 | 0,5488 | 3,082 |
| R16.2 | 6 | 0,0022 | 8,6077 | +0,1325 | 0,5517 | 2,915 |
| R16.1 | 10 | **0,0042** | 8,5726 | +0,0974 | 0,5537 | 2,912 |

- bloco A (bruscos ≤ 0,004) **reprova a partir de bonus ≈ 9,6**
- bloco B (marcador ≤ 8,5052) **só aprovaria a partir de bonus ≈ 17,7**

O valor que B exige é **1,8× o valor em que A já reprova.** Mesmo na R16.1, que
já sacrifica o bloco A inteiro, a distância do marcador continua **+0,097 m**
acima do alvo corrigido.

> **Não existe constante deste knob que satisfaça A e B ao mesmo tempo.**
> O critério pré-registrado, ancorado no controle real, é insatisfazível por
> calibração. Insistir seria a sexta calibração de marcação a falhar.

### 4.1 Por que, mecanicamente

A marcação deste motor é **reativa**: `_assignDefRoles` recalcula a atribuição
por geometria instantânea (e, sob `overload`, joga fora até a referência
anterior — `30-r13-football-observer.js:478`). Um marcador reativo precisa
reorientar-se o tempo todo, e reorientação é exatamente o recurso que o
limitador corta. Fluidez e marcação disputam a mesma variável.

Com marcação **antecipatória** — referência persistente, alvo derivado de zona e
ameaça em vez da posição atual do atacante — o marcador deixa de depender de
giro brusco. É o §18. Ver `ESPEC-18-CONTRATO-DE-FUNCAO.md`.

## 5. Qual é, de fato, o custo do limitador

Teste pareado por seed, n = 294 (`tools/r15/paired_effect.py`, novo).
R16.2 contra o controle:

| grandeza | Δ | erro-padrão | t | veredito |
|---|---:|---:|---:|---|
| `threatCoverage` | −0,0074 | 0,0024 | −3,14 | **real** (−1,3%) |
| `markerMeanDistance` | +0,1325 m | 0,0388 | +3,42 | **real** (+1,6%) |
| gols/partida | −0,1939 | 0,1305 | −1,49 | ruído |
| `spatialOverloadCoverage` | −0,0005 | 0,0032 | −0,16 | ruído |
| `defensiveLineMeanRange` | +0,0519 | 0,0444 | +1,17 | ruído |
| `disconnectedLineRate` | +0,0034 | 0,0045 | +0,75 | ruído |

**Correção de registro:** o handoff anterior descreve a R16.2 como tendo "os gols
caem 6,2%". A queda existe na média (3,109 → 2,915) mas **não se distingue de
ruído** com n = 294 (t = −1,49). Também dizia que "a distância do marcador piora
0,13 m" — isso está certo, e é o único custo material junto com a cobertura.

Do lado do ganho (jitter probe, 1,4 milhão de amostras):

| | R15.9 | R16.2 | Δ |
|---|---:|---:|---:|
| giros bruscos (>25°/quadro) | 0,0119 | 0,0022 | **−81%** |
| bruscos perto da bola | 0,0281 | 0,0079 | **−72%** |
| giro médio (não engessou) | 2,50 | 2,43 | −3% |

E o equilíbrio de estilos **melhora**: `ppgRange` 0,500 → 0,369; pior perda por
estilo 0,512 → 0,226 ppg (a R16.0 reprovava o bloco E aqui; a R16.2 passa).

### 5.1 Os gates novos de fluidez

`jitter_probe` virou gate permanente nesta sessão (3 gates em
`manifests/r15-release-gates.json`, agora com 63):

| gate | R15.9 | R16.0 | R16.1 | R16.2 |
|---|---|---|---|---|
| `no_instant_turn` (P0) ≤ 0,004 | **FALHA** 0,0119 | passa | **FALHA** 0,0042 | passa 0,0022 |
| `no_instant_turn_near_ball` ≤ 0,012 | **FALHA** 0,0281 | passa | passa | passa 0,0079 |
| `turn_not_frozen` ≥ 1,9 | passa | passa | passa | passa |

**A build que está de pé hoje viola o §33.** Isso não era visível antes porque o
gate não existia.

---

## 6. Recomendação

**PROMOVER a R16.2** `b168fd1a8bbbaa2e31d54269f12d9eb01b81659ca78c27d5ec2fd266626a3b47`
como candidata corrente, preservando a R15.9 como fallback.

Razões, em ordem de peso:

1. O que o patch prometeu, entregou: −81% de giro impossível, sobre 1,4 M de
   amostras. É correção de uma proibição literal do §33.
2. O custo real é pequeno e está medido: −1,3% de cobertura e +1,6% de distância
   do marcador. Tudo o mais é ruído.
3. As duas reprovações do bloco B são (a) um sub-gate sem poder discriminante e
   (b) uma distância que **nenhuma calibração deste knob alcança** — está provado
   com três matrizes, não estimado.
4. A R16.2 **melhora** o bloco E, que a R16.0 reprovava.
5. A alternativa — continuar na R15.9 — mantém de pé uma build que reprova dois
   gates P0/P1 de física recém-tornados permanentes.

**Por que a R16.2 e não as irmãs:** a R16.1 reprova o bloco A (0,0042 > 0,004);
a R16.0 reprova o bloco E (balanced −0,512 ppg contra limite de 0,45).

### 6.1 O que promover exige, e que não é decisão minha

Promover contraria o veredito mecânico `AJUSTA_A_CURVA`. O caminho limpo — que
**não** invalida a certificação — é:

- **não editar** `CRITERIO-R16.0-PRE-REGISTRADO.md`; ele fica como está, com seu
  veredito;
- registrar esta decisão como **substituição documentada**, com o motivo
  (instrução insatisfazível + sub-gate sem poder) e os números;
- **pré-registrar um critério novo** para a reavaliação pós-§18, corrigindo as
  duas falhas de construção: baseline ancorada no controle real, e sub-gates com
  poder discriminante verificado por `subgate_power.py` antes de virarem
  bloqueio.

Aceitar essa substituição é decisão de produto, não técnica. **Não promovi nada:
a árvore continua reproduzindo a R16.2, a R15.9 continua íntegra, e nenhuma
build foi marcada como oficial.**

### 6.2 Dívida registrada

A promoção carrega uma dívida explícita: **−0,0074 de cobertura de ameaça e
+0,133 m de distância do marcador.** O §18 tem de pagá-la. O critério do §18 deve
exigir, no mínimo, retorno ao patamar do controle (0,5591 / 8,4752) **além** do
ganho que o contrato de função pretende trazer.

---

## 7. Artefatos desta decisão

```
reports/r15/curva-limitador.json        3 pontos da curva de troca
reports/r15/real-r161.json              matriz 294 da R16.1 (nova)
reports/r15/efeito-pareado-r162.json    teste pareado por seed
reports/r15/poder-dos-subgates.json     poder discriminante dos sub-gates
reports/r15/certificacao-r162.json      certificação atual da candidata
manifests/r162-release-gates.json       63 gates remapeados para a R16.2
tools/r15/curva_limitador.py            (novo)
tools/r15/paired_effect.py              (novo)
tools/r15/subgate_power.py              (novo)
```
