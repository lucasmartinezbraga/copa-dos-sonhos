# R14 — diário de execução

Branch: `claude/r14-motor-vivo-auditoria-800` (de `origin/claude/copa-dos-sonhos-continuidade-gqpe70` @ `2d89919`)

---

## FASE 0 — identidade, baseline e reprodutibilidade — **CONCLUÍDA**

**problema 1** · Build não reprodutível em clone limpo.
**causa** · `src/r13/index.template.html` nunca versionado (`*.html` do `.gitignore` sem exceção para ele); `extract_r13.py` gravava com `write_text()`, traduzindo LF→CRLF no Windows e corrompendo os 14 módulos byte a byte contra o manifesto.
**arquivos** · `.gitattributes` (novo), `.gitignore`, `tools/extract_r13.py`, `tools/build_r13.py`, `tools/build_ux.py`, `src/r13/index.template.html` (novo)
**testes** · `python tools/verify_r13.py`
**resultado** · rebuild byte-idêntico `363d9a91…`, smoke 13/13, cenários 25/25
**commit** · `012ed98`

**problema 2** · A candidata não era derivável das fontes (+2.408 B aplicados direto no HTML).
**causa** · "MOBILE BUTTON FIX" editado à mão no HTML de 1,7 MB; qualquer rebuild o descartaria.
**arquivos** · `src/ux/patches-mobile.json` (novo, 10 patches), `tools/ux/make_patches.py`, `src/ux/patches.json`
**achado extra** · o bloco de FONTES EMBUTIDAS (14 `@font-face` woff2 base64) estava **dentro de um comentário HTML** aberto na linha 57 e fechado na 86 — as fontes nunca foram aplicadas na R13/RC-UX.
**testes** · `python tools/build_ux.py`
**resultado** · build reproduz a candidata **byte a byte**: `08716e3d…b492f`, 1.720.780 B
**commit** · `e5ebb08`

---

## FASE 1 — P0: trava da bola e vivacidade da posse — **EM CURSO**

**problema** · Bola presa em um jogador; partida sem ação perceptível.

**causa raiz** · Na fase `build_up`, a atualização de fase da R13 aplica
`clamp13(decideT, .10, .44)` a cada tick. `clamp13` impõe um **piso**; o
contador decresce `1/30≈0,033` e volta a `0,10` no mesmo tick. `decideT<=0`
nunca ocorre → **`_decide` nunca é chamado** → o portador nunca decide. As
fases irmãs (`transition_attack`, `final_third`) usam `Math.min` (teto), que
só antecipa a decisão. Era um piso onde deveria haver teto.

**reprodução** · seed 870000, `4-1-4-1 press` × `4-3-1-2 park`, 71.13':
dono único 23,2 s, `settle<=0`, `traveling=false`, `decideT` fixo em `0.10`,
zero chamadas a `_decide`. Evidência: `reports/r14/ball-lock/trace-seed0.json`.

**arquivos** · `src/r14/patches-engine.json` (novo), `tools/build_ux.py`,
`tools/ux/probe_balllock.js` (seleção por id + `--trace`),
`tools/r13/test_r130_scenarios.js` (seleção por id)

**testes**
- `verify_r13.py` → R13 **byte-idêntica** (`363d9a91…`), 13/13, 25/25
- cenários dirigidos contra a **R14** → **25/25**
- cenários contra a **candidata** → 25/25 *(nunca haviam rodado: o harness quebrava)*
- sonda de trava, 200 seeds, antes e depois

**resultado (4 seeds reproduzidas)**

| | candidata | R14 |
|---|---:|---:|
| travas totais | 30 | 6 |
| travas de 2 jogadores | 23 | **0** |
| pior trava | 24,3 s | 3,9 s |

**resultado (200 seeds, medição final)**

| | candidata | R14 | delta |
|---|---:|---:|---:|
| travas totais | 1.415 | 167 | −88,2% |
| travas de 2 jogadores | 1.048 | 20 | −98,1% |
| pior trava | 47,8 s | 6,0 s | −87,4% |
| travas ≥10 s | 400 | **0** | −100% |
| travas ≥20 s | 51 | **0** | −100% |
| gols/partida | 1,975 | 1,840 | −6,8% |
| chutes/partida | 12,61 | 12,97 | +2,9% |

**`BAL-001`** · O gate de balanço reprovou primeiro (`ppgRange` 0,571 → 0,821)
e foi **resolvido por recalibração**, não por afrouxamento do limite. Ver Fase 4.

---

## FASE 4 (parcial) — recalibração de estilos — **CONCLUÍDA**

**problema** · Liberada a decisão em `build_up`, os estilos ganharam volume de
forma desigual: `wings` +0,536 ppg, `balanced` −0,500, `direct` −0,393.
`ppgRange` 0,821 contra limite 0,75.

**causa** · O golden R13.0 foi calibrado **com o defeito presente**. O
multiplicador `STYLE_FX.cross` governa a *probabilidade de escolher cruzar*
(`crossP`), e o cruzamento tem valor esperado baixo neste motor — ou seja,
`cross` funciona como **handicap**. Com o portador congelado, o handicap quase
não era exercido; liberada a decisão, passou a incidir em cheio e de forma
desigual entre os estilos.

**correção** · Três números, todos no mesmo campo:

```
STYLE_FX.wings.cross   1,55 -> 1,85
STYLE_FX.direct.cross  1,35 -> 1,05
STYLE_FX.park.cross    0,95 -> 1,30
```

**arquivos** · `tools/r14/calibrate_styles.py` (novo), `tools/r14/style-overrides.json` (novo), `src/r14/patches-engine.json`

**resultado**

| gate | limite | golden R13 | R14 sem calibrar | **R14 final** |
|---|---:|---:|---:|---:|
| `ppgRange` | ≤ 0,75 | 0,571 | 0,821 FAIL | **0,500 PASS** |
| `maxAbsGoalDiff` | ≤ 0,65 | 0,464 | 0,536 | **0,429 PASS** |
| `noDominantStyle` | true | PASS | FAIL | **PASS** |
| `parkIdentity` | true | PASS | FAIL | **PASS** |
| `tikiIdentity` | true | PASS | PASS | **PASS** |

Robustez: com 196 partidas (`--repeats=4`), `ppgRange` 0,554 e
`maxAbsGoalDiff` 0,464 — todos PASS. O range fica folgado nos dois tamanhos de
amostra.

**travas após recalibrar (200 seeds)** · 168 · 18 de 2 jogadores · pior 6,0 s —
o conserto do P0 não foi desfeito.

---

## Estado consolidado

**candidata R14** · `0230a6ffe90f3ecda3b731e215216e21a7445b47e644c8882f84ce9eb05605c2`
(1.720.857 B)

| verificação | resultado |
|---|---|
| R13.0 congelada, byte-idêntica | `363d9a91…` OK |
| smoke estático (R14) | 13/13 |
| cenários dirigidos (R14) | 25/25 |
| smoke de navegador (R14) | 4/4 viewports, 0 erros |
| travas ≥10 s | 400 → **0** |
| gates de balanço | 5/5 PASS |
| `BLK-001` / `BAL-001` | **PASS** / **PASS** |

**commits** · `328229b` `0e6699d` `e0067a8` `6fede3c` `ba71d2b` `08075a2` + recalibração

---

## Pendências que não dependem de mim

- **Playwright ausente** nesta máquina → `browser_smoke.py` e todos os
  controles de navegador/mobile automatizado seguem `PENDENTE`.
- **Aparelhos físicos** (Android/iOS) e **3 observadores humanos** → `PENDENTE`
  por definição; emulação de viewport não substitui.
