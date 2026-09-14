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

---

## FASE 2 — contrato de ação (sincronização motor↔render) — **CONCLUÍDA**

**problema** · `_startTravel` fazia `b.owner=null; b.traveling=true` no **mesmo
tick da decisão**. A bola partia no instante da escolha; não havia preparação,
então nenhuma pose podia tocá-la — quando o evento chegava ao render, a bola já
tinha saído.

**correção** · `src/r14/10-action-contract.js` separa **decidir** de
**executar**. `_pass`/`_cross`/`_shoot` agendam um contrato
(`preparação → contato → continuidade → recuperação`) e a bola só sai no
**contato**. Durante o preparo o portador mantém a bola e pode ser desarmado,
produzindo `interrupted` em vez de ação fantasma. Cobranças e reinícios saem na
hora, para não reintroduzir estado preso.

**arquivos** · `src/r14/10-action-contract.js` (novo), `tools/build_ux.py`
(nova camada de motor `src/r14/*.js`), `tools/ux/probe_balllock.js`

**resultado (1 partida)** · 199 preparadas · 198 com contato · 1 interrompida ·
**0 forçadas** · conforme `action-contract.schema.json`

| gate | resultado |
|---|---|
| cenários dirigidos | 25/25 |
| smoke estático | 13/13 |
| `ppgRange` | 0,500 PASS |
| `maxAbsGoalDiff` | 0,500 PASS |
| `parkIdentity` / `tikiIdentity` | PASS |
| R13.0 byte-idêntica | OK |

**troca medida (`SYN-001`)** · travas 168 → 237 em 200 seeds: o preparo segura a
bola ~0,2 s a mais por ação e infla o tempo dentro do raio de 4 m. A patologia,
porém, **cai**: `dwellMax` médio 2,91 → 2,58 s e a composição migra de `dwell`
puro para `misto`/`pingpong` — a bola troca de pé dentro da janela em vez de
congelar. Zero travas ≥10 s antes e depois.

**candidata** · `7dc258d5e030d59d908b20ec00e445fdd721b9981bb02f17febd44d66d6b3904`

**próxima fase** · Fase 3 — máquina de estados de animação, que agora tem
`prepareDuration`, `contactTime`, `followThroughDuration` e `recoveryDuration`
reais para consumir.

---

## FASE 3 — máquina de estados de animação — **CONCLUÍDA (parte automatizável)**

**problema** · `motionAt()` empurrava poses numa lista **global de no máximo 10
entradas**, com janela em `performance.now()` e uma única rampa 0..1. Sem
locomoção, sem prioridade, sem interrupção e sem vínculo com as fases da ação —
a pose de um atleta podia ser truncada por outro entrar na lista.

**correção** · `src/ux/60-anim-state-machine.js` dá um controlador a **cada**
atleta: 63 estados em 5 tiers (locomoção < com bola < defesa < ação
comprometida < goleiro). Um estado só cede a tier igual ou maior, ou a
interrupção explícita. Os estados de ação são dirigidos pelo **contrato da
Fase 2**, então o quadro de contato coincide com a saída da bola por
construção. `src/ux/61-anim-bridge.js` liga os eventos do motor ao controlador.

**arquivos** · `src/ux/60-anim-state-machine.js`, `src/ux/61-anim-bridge.js`,
`tools/r14/test_anim_states.js`, `tools/r14/browser_anim_probe.py`

**cenários dirigidos** · **29/29** — locomoção, ancoragem no contrato,
prioridade, interrupção, goleiro, posse, cobertura dos 63 estados,
independência entre 22 atletas.

**validação por mutação** (para os cenários não passarem por inércia)

| mutante | resultado |
|---|---|
| remove a regra de prioridade por tier | 27/29 **FALHA** |
| `interrupt()` vira no-op | 25/29 **FALHA** |
| preparo ignora a duração do contrato | 25/29 **FALHA** |

**prova no navegador** · 22 atletas com estado, 20 estados distintos em 12.029
ticks, quatro fases da ação visitadas
(`pass_prepare → pass_contact → pass_followthrough → pass_recover`).

**dois defeitos encontrados pelo próprio teste** · o controlador só nascia por
evento (quem apenas corria ficava sem estado); e `idOf` sem o time colidia entre
as equipes, porque `p.idx` é numerado por time — 22 atletas viravam 17 estados.

**candidata** · `2191fbfa5721b9874fbf14e4d7e2a77935f141e1199152de37cad01d87524b79`

**pendente** · legibilidade **visual** de cada estado exige olho humano —
`PENDENTE` por definição (3 observadores).

---

## FASE 5 — projeção e apresentação 2.5D — **PARCIAL**

### 5a · corpo dirigido pela máquina de estados — **CONCLUÍDA**

**problema** · A máquina da Fase 3 rodava, mas `CDS_F25D.body` ainda derivava a
pose de `o.pose`/`o.act`/`o.wave` — o sistema antigo. A Fase 3 era
instrumentação **sem efeito visual**.

**correção** · A ponte publica o estado em `__CDS_ANIM_BY_KEY` com a mesma chave
de desenho que `body()` e o `dirCache` já usam; `body()` deriva
`kicking`/`tackling`/`heading`/`dribbling` do estado. `animWave()` dá o envelope
por **fase**: preparação sobe até o pico, **contato é o pico** (tick em que a
bola sai), continuidade desce, recuperação zera.

### 5b · invariantes de projeção — **9/9**

Malha de 21×21 pontos do campo inteiro, no navegador:
finitude · escala decrescente com a profundidade · ordenação monotônica ·
eixo de fuga · convergência trapezoidal · razão de perspectiva ·
continuidade · API completa · imutabilidade.

**nota** · A primeira versão reprovou o eixo por 2,81 px. A álgebra é
`x(fx,v) = C + (fx−C)·s(v)`, logo existe **exatamente um** `fx` invariante; o
teste assumia canvas de 1000 px e amostrava colunas não simétricas. Resolvendo
`C` numericamente: desvio **zero**, eixo em x=512 (canvas de 1024). **O defeito
era do teste** — a projeção estava correta. Registrado em `PRO-001`.

**arquivos** · `src/ux/50-field25d.js`, `src/ux/61-anim-bridge.js`,
`tools/r14/browser_projection_probe.py`

**candidata** · `205170caa29271f5b550818991102937c45394c98f960a54ee65e113528eb80f`

| gate | resultado |
|---|---|
| cenários de animação | 29/29 |
| cenários dirigidos R13 | 25/25 |
| smoke estático | 13/13 |
| invariantes de projeção | 9/9 |
| browser smoke | 4/4, 0 erros |
| R13.0 byte-idêntica | OK |

### NÃO feito nesta fase

Bolas paradas com preparação visual convincente (barreira, cobrança, pênalti),
câmera, oclusão, replay, nomes/números em profundidade e estádio **não foram
tratados**. Legibilidade visual de cada estado segue `PENDENTE` (olho humano).
