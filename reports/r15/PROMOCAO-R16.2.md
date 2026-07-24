# Promoção da R16.2 — registro de substituição

Decisão tomada em 2026-07-23 pelo responsável do produto, com os números de
`DECISAO-R16.md` à vista.

---

## 1. O que foi promovido

| | |
|---|---|
| candidata corrente | **R16.2** `b168fd1a8bbbaa2e31d54269f12d9eb01b81659ca78c27d5ec2fd266626a3b47` |
| fallback preservado | R15.9 `b3e105327e08296ba6c1d896dd5f6e2c1405bbf66b26ea54b8ae3f9c74c7a0a1` |
| fallback anterior | R14.4 `7fdf183581162115344e320d5bfbada3f02f6a47e30a01948f08eba816c8b071` |
| base congelada | R13.0 `363d9a915a732ae99a889dab05e7f01485d58b140d64e4778ad8d5825f9818a8` |

Reprodução a partir da fonte, conferida:

```bash
python tools/build_ux.py --out "dist/COPA DOS SONHOS - R16.2.html"
# -> b168fd1a8bbbaa2e31d54269f12d9eb01b81659ca78c27d5ec2fd266626a3b47

python tools/build_ux.py --out "dist/COPA DOS SONHOS - R15.9.html" --without r15-angular-rate-limit
# -> b3e105327e08296ba6c1d896dd5f6e2c1405bbf66b26ea54b8ae3f9c74c7a0a1
```

## 2. Isto substitui um veredito pré-registrado. Como e por quê.

O critério `CRITERIO-R16.0-PRE-REGISTRADO.md` emitiu `AJUSTA_A_CURVA` para a
R16.2. **Esse arquivo não foi editado e seu veredito continua de pé** — editá-lo
invalidaria a certificação, como ele mesmo determina.

A promoção o substitui por dois motivos documentados, ambos posteriores à
leitura dos resultados e ambos sobre a **construção** do critério, não sobre o
resultado que ele produziu:

**(a) A instrução emitida é insatisfazível.** `AJUSTA_A_CURVA` manda ajustar a
curva. Três matrizes de 294 partidas mostram que o bloco A reprova a partir de
`bonus ≈ 9,6` e o bloco B só aprovaria a partir de `bonus ≈ 17,7`. Não existe
constante que satisfaça os dois. Um critério não pode exigir uma ação impossível
e tratar a impossibilidade como reprovação da candidata.

**(b) O bloco B foi ancorado na build errada.** Os três números que ele atribui
à R15.9 são verbatim da R15.4 (`real-r154.json`), a build que o `CHANGELOG-R15.md`
registra como NÃO EMBARCAR. Além disso, o sub-gate que reprovou exige
`threatCoverage >= 0,65`, acima do p90 de todas as builds medidas — passa em
3/294 no controle e 0/294 nas candidatas. É cauda estatística, não comportamento.

## 3. O que está sendo aceito junto

A promoção carrega uma **dívida medida e nomeada**, pareada por seed, n = 294:

| | Δ contra o controle | t | leitura |
|---|---:|---:|---|
| `threatCoverage` | −0,0074 | −3,14 | real, −1,3% |
| `markerMeanDistance` | +0,1325 m | +3,42 | real, +1,6% |

Nada mais se distingue de ruído — inclusive gols (t = −1,49).

Em troca:

| | R15.9 | R16.2 |
|---|---:|---:|
| giros bruscos (>25°/quadro) | 0,0119 | **0,0022** (−81%) |
| bruscos perto da bola | 0,0281 | **0,0079** (−72%) |
| `ppgRange` entre estilos | 0,500 | **0,369** |
| pior perda por estilo | 0,512 ppg | **0,226 ppg** |
| gates `no_instant_turn*` | **2 REPROVAM** | passam |

## 4. Condição da promoção

A dívida do item 3 **tem de ser paga pelo §18**. O critério da próxima avaliação
está pré-registrado em `CRITERIO-POS-18-PRE-REGISTRADO.md`, escrito **antes** de
qualquer linha do Contrato de Função — e exige retorno ao patamar do controle,
não apenas "não piorar mais".

## 5. Estado da certificação

`certificacao-r162.json`: **REPROVADA** — 25 PASS · 12 FAIL · 8 INCONCLUSIVE ·
18 NOT_EXECUTED, sobre 63 gates.

Promover a R16.2 **não** a torna certificada. Ela é a melhor candidata medida,
não uma build aprovada. A distinção está no topo do relatório de propósito.
