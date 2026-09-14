# R14 — Diagnóstico inicial

Data: 2026-07-22 · Auditoria `R14-800-v1.0` · Pacote `PACOTE-AUDITORIA-MESTRA-R14-800-ITENS.zip`

## 1. Identidade

| item | valor |
|---|---|
| candidata recebida | `COPA DOS SONHOS - RC-UX - MOBILE BUTTON FIX.html` |
| bytes | 1.720.780 |
| SHA-256 | `08716e3df6f7a08a052090343ef79d13551aea3fee7d4f2669788f51546b492f` |
| conferência | **BATE** com `00-LEIA-ME.md` e com `evidence/candidate-manifest.json` |
| classificação | PONTO DE PARTIDA NÃO APROVADO |
| baseline R13.0 | `dist/COPA DOS SONHOS - V5.9.3-R13.0 - FUTEBOL OBSERVAVEL E CADENCIADO.html` |
| SHA-256 baseline | `363d9a915a732ae99a889dab05e7f01485d58b140d64e4778ad8d5825f9818a8` (bate com o manifesto) |

O ZIP foi extraído íntegro em `audit-r14/`. O HTML enviado separadamente pelo
usuário (`COPA%20DOS%20SONHOS%20-%20RC-UX%20-%20MOBILE%20BUTTON%20FIX.html`)
tem o **mesmo SHA-256** — é o mesmo arquivo, outro nome.

## 2. Branch-base

O clone local estava **desatualizado** (último fetch 2026-07-19) e não continha
nenhuma das branches R13/R14. Após `git fetch --all`:

| branch | tip | contém |
|---|---|---|
| `origin/main` | `f093767` | sem `src/r13`, sem `tools/ux` |
| `origin/codex/r13-futebol-cadenciado` | `9600d71` | sem `src/r13` |
| `origin/agent/fechar-auditoria-650-2_5d` | `3210413` | tem `src/r13`, **não-ancestral** |
| **`origin/claude/copa-dos-sonhos-continuidade-gqpe70`** | **`2d89919`** | **superset — escolhida** |

`gqpe70` tem `origin/main` **e** `origin/codex/r13-futebol-cadenciado` como
ancestrais, e é a única com `tools/ux/probe_balllock.js`, `tools/r13/`,
`src/r13/`, `src/2_5d/` e `src/ux/` ao mesmo tempo. Branch de trabalho criada a
partir dela: **`claude/r14-motor-vivo-auditoria-800`**.

## 3. Localização real das fontes

```
src/r13/scripts/*.js + styles/*.css   motor R13.0 (14 módulos, congelado por SHA)
src/r13/index.template.html           template de reconcatenação
src/ux/*.css, *.js, patches.json      camada de apresentação (aditiva)
src/r14/patches-engine.json           mudanças INTENCIONAIS de motor da R14
src/2_5d/scene-2_5d.js                palco 2.5D
tools/build_r13.py / build_ux.py      build
tools/verify_r13.py                   gate de identidade
tools/ux/probe_balllock.js            sonda de trava
tools/r13/*.js                        smoke estático + 25 cenários dirigidos
```

Comando de build: `python tools/build_ux.py --out "dist/<nome>.html"`
Comando de regressão: `python tools/verify_r13.py`
Sonda: `node tools/ux/probe_balllock.js --build=<html> --csv=tools/r13/COPA_DOS_SONHOS_P0-6_R12.3_PARTIDAS.csv --start=0 --end=200 --out=<json>`

## 4. Estado dos scripts do pacote

| script | estado |
|---|---|
| `collect_manifest.py`, `static_audit.py`, `init_evidence.py`, `browser_smoke.py` | rodaram no ambiente do autor (Linux); resultados no ZIP |
| `release_gate.py` | roda; veredito inicial **BLOQUEADO** |
| `run_balllock_probe.py` | só monta o comando; depende de `tools/ux/probe_balllock.js` **do repositório** |
| `repo_regression.py` | depende de `tools/verify_r13.py` + harness `tools/r13/` |
| `browser_smoke.py` | **não executado aqui** — Playwright não instalado nesta máquina |

Nenhuma ferramenta do ZIP foi reescrita.

## 5. Estado inicial da matriz

800 controles: **P0 464 · P1 309 · P2 27**, todos `BLOCKED`.
Veredito inicial registrado pelo autor: **BLOQUEADO** (P0 não 100%, P1 0%,
P2 0%, faltando `balllock-result.json` e `repo-regression.json`).

## 6. Problemas encontrados e corrigidos na Fase 0

### 6.1 Build não era reprodutível (bloqueador)

`src/r13/index.template.html` **nunca foi versionado**: a regra `*.html` do
`.gitignore` o capturava e as exceções não o cobriam. Em qualquer clone limpo,
`build_r13.py` e `build_ux.py` falham com `FileNotFoundError`, e
`verify_r13.py` mascara isso com o erro genérico "divergiu do alvo
autoritativo".

`extract_r13.py` gravava com `write_text()`, que traduz `\n` em `\r\n` no
Windows, enquanto o manifesto registra `bytes`/`sha256` do conteúdo em memória
(LF). Rodar o extrator no Windows corrompia os 14 módulos byte a byte com o
conteúdo permanecendo idêntico.

Corrigido: escrita/leitura em bytes, `.gitattributes` marcando as árvores
validadas por SHA como `-text`, exceção no `.gitignore`, template versionado.
**Prova:** `verify_r13.py` OK — rebuild byte-idêntico `363d9a91…`, smoke
estático 13/13, cenários dirigidos 25/25.

### 6.2 A candidata não era derivável das fontes (bloqueador)

O build das fontes produzia `ba7be881…` (1.718.372 B) contra a candidata
`08716e3d…` (1.720.780 B): **+2.408 bytes** aplicados direto no HTML de 1,7 MB.
Qualquer rebuild descartaria a correção em silêncio.

Os 10 hunks foram extraídos e versionados em `src/ux/patches-mobile.json`.
Um deles não é mobile: o bloco de **FONTES EMBUTIDAS** (14 `@font-face` com
woff2 em base64) estava **dentro de um comentário HTML** aberto na linha 57 e
fechado só na 86 — as fontes nunca foram aplicadas na R13/RC-UX.

**Prova:** `build_ux.py` reproduz a candidata **byte a byte** (`08716e3d…`).

## 7. Fase 1 — P0: trava da bola

### Causa raiz (determinística, de motor)

O portão de decisão do portador é:

```js
this.decideT -= dt;
if (!this.ball.traveling && this.ball.owner && this.ball.owner.settle <= 0 && this.decideT <= 0)
  this._decide(this.ball.owner);
```

A atualização de fase da R13 reescreve `decideT` **a cada tick**:

```js
if(attacking==='transition_attack') sim.decideT=Math.min(finite13(sim.decideT,.2),.20);   // teto
else if(attacking==='final_third')  sim.decideT=Math.min(finite13(sim.decideT,.3),.31);   // teto
else if(attacking==='build_up')     sim.decideT=clamp13(finite13(sim.decideT,.25),.10,.44); // PISO
```

`clamp13=(v,a,b)=>Math.max(a,Math.min(b,v))` impõe um **piso de 0,10**. O
contador decresce `1/30≈0,033` por tick e é devolvido a 0,10 no mesmo tick:
`decideT<=0` **nunca ocorre**. Na fase `build_up` o portador **nunca decide** —
a posse só termina quando a defesa vence um desarme, dezenas de segundos depois.

### Reprodução

Seed **870000**, `4-1-4-1 press` × `4-3-1-2 park`, aos **71.13'**: dono único
por **23,2 s**, `settle<=0`, `traveling=false`, `decideT` fixo em `0.10`, **zero**
chamadas a `_decide`. Evidência: `reports/r14/ball-lock/trace-seed0.json`.

### Correção

Piso → teto, restaurando a escada de cadência que os dois irmãos já seguiam
(`transition_attack .20 < final_third .31 < build_up .44`). Não teleporta a
bola, não força passe, não escolhe desfecho: devolve ao motor o direito de
decidir. Entra como patch de **motor R14** em `src/r14/patches-engine.json`,
aplicado sobre a base R13 intacta — a R13.0 permanece congelada e verificável.

### Medição (4 seeds reproduzidas)

| | candidata | R14 |
|---|---:|---:|
| travas totais | 30 | 6 |
| travas de 2 jogadores | 23 | **0** |
| pior trava | 24,3 s | 3,9 s |
| seed 870000 | 10 travas / 24,3 s | **0 travas** |

As 6 restantes são de dono único, 3,4–3,9 s — logo acima do limiar de 3,0 s.

## 8. Nota sobre a decisão anterior

`tools/ux/make_patches.py` registra que a trava foi investigada antes, medida
(207/284 travas de 2 jogadores, até 45 s) e considerada **insolúvel sem quebrar
o balanço**, após duas tentativas reprovarem nos gates da R13 (afastar a bola
para a frente; saída segura). A conclusão registrada foi congelar o motor e
tratar a percepção na camada visual.

As duas tentativas anteriores agiam sobre a **posição da bola** e o **desfecho**
da posse — por isso mudavam a distribuição de resultados. A causa real não era
essa: era o contador de decisão travado. O conserto atual não escolhe desfecho
nenhum; apenas deixa a decisão acontecer.

## 9. Riscos e limitações

- A correção **muda estatísticas de propósito** (mais ações por minuto). Isso é
  permitido pela missão desde que documentado; a quantificação contra o golden
  R13 está em andamento (200 seeds antes/depois).
- `browser_smoke.py` não roda aqui: **Playwright ausente**. Todos os controles
  de navegador/mobile automatizado seguem `PENDENTE`.
- Controles físicos (Android/iOS reais) e humanos (3 observadores) **não podem**
  ser executados por mim — permanecem `PENDENTE` por definição.
- O clone local fica em `Downloads\…`, caminho com `%20` literais e parênteses.
  Funciona, mas é frágil.

## 10. Ordem de execução proposta

1. **Fase 0** — identidade, reprodutibilidade, R13 congelada. *(concluída)*
2. **Fase 1** — trava da bola: causa, correção, 200 seeds antes/depois. *(em curso)*
3. **Fase 4 parcial** — quantificar a diferença R13→R14 e defendê-la.
4. **Fase 2** — contrato de ação motor↔render.
5. **Fase 3** — máquina de estados de animação.
6. **Fase 5** — projeção e apresentação 2.5D.
7. **Fase 6** — UX/mobile/desempenho (exige Playwright).
8. **Fase 7** — auditoria dos 800 controles e gate de release.
