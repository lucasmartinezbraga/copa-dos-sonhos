# R14 — relatório final e veredito

**Candidata:** `205170caa29271f5b550818991102937c45394c98f960a54ee65e113528eb80f`
(1.746.638 B) · branch `claude/r14-motor-vivo-auditoria-800` · [PR #12](https://github.com/lucasmartinezbraga/copa-dos-sonhos/pull/12)

## VEREDITO: **BLOQUEADO**

Não é `APROVADO` e não pode ser. **86,1% dos 800 controles dependem de
observação humana ou aparelho físico**, que eu não posso executar. O gate
oficial recusa, corretamente, por `P0 não está 100% PASS`.

O que está provado está provado com evidência vinculada ao SHA. O que não está,
está marcado `PENDENTE` — nenhum item foi convertido em `PASS` por conveniência.

---

## Revisão fase a fase (re-executada do zero contra a candidata final)

### Fase 0 — identidade e reprodutibilidade · **PASS**

| verificação | resultado |
|---|---|
| SHA da candidata recebida | `08716e3d…b492f` **confere** |
| R13.0 rebuild byte-idêntico | `363d9a91…` **OK** |
| build reproduz a candidata recebida | **byte a byte**, verificado em worktree limpo em `e5ebb08` |
| rebuild da candidata final | determinístico, `205170ca…` |

Dois bloqueadores reais corrigidos: `src/r13/index.template.html` nunca fora
versionado (`*.html` no `.gitignore`), e `extract_r13.py` corrompia os 14
módulos no Windows por tradução LF→CRLF. **O build não era reprodutível em
clone limpo** — e `verify_r13.py` mascarava a causa com erro genérico.

Achado colateral: as **fontes embutidas nunca funcionaram**. Os 14 `@font-face`
estavam dentro de um comentário HTML aberto na linha 57 e fechado na 86.

### Fase 1 — trava da bola · **PASS**

Causa raiz: `clamp13(decideT, .10, .44)` na fase `build_up` — um **piso** onde
as fases irmãs usam teto, reaplicado a cada tick. `decideT` nunca chegava a
zero e **`_decide` jamais era chamado**: o portador não podia decidir.

| 200 seeds | candidata | R14 final |
|---|---:|---:|
| travas totais | 1.415 | 237 |
| travas de 2 jogadores | 1.048 | 61 |
| pior trava | 47,8 s | **6,6 s** |
| travas ≥10 s | 400 | **0** |
| `dwellMax` médio | 8,12 s | **2,58 s** |

### Fase 2 — contrato de ação · **PASS**

`_startTravel` soltava a bola no mesmo tick da decisão — nenhuma pose podia
tocá-la. Agora a ação tem `preparação → contato → continuidade → recuperação` e
a bola só sai no **contato**. 199 preparadas/partida, 198 com contato, 1
interrompida, **0 forçadas**. Conforme `action-contract.schema.json`.

### Fase 3 — máquina de estados de animação · **PASS (automatizável)**

63 estados em 5 tiers, um controlador por atleta, fases ancoradas no contrato.
**29/29 cenários**, validados por **mutação** (3 mutantes, 3 detectados).
No navegador: 22 atletas, 20 estados, 4 fases visitadas.

### Fase 4 — recalibração de estilos · **PASS**

O conserto da Fase 1 reprovou o balanço (`ppgRange` 0,571 → 0,821). Resolvido
por **recalibração sobre o motor consertado**, não por afrouxamento do limite —
o golden R13 fora calibrado *com* o defeito presente.

| gate | limite | golden R13 | R14 |
|---|---:|---:|---:|
| `ppgRange` | ≤ 0,75 | 0,571 | **0,500** |
| `maxAbsGoalDiff` | ≤ 0,65 | 0,464 | **0,500** |
| `parkIdentity` / `tikiIdentity` | true | PASS | **PASS** |

### Fase 5 — projeção 2.5D · **PARCIAL**

Corpo passou a ser dirigido pela máquina de estados (antes a Fase 3 não chegava
à tela). **9/9 invariantes de projeção** sobre malha de 21×21.

**Não feito:** bolas paradas com preparação visual, câmera, oclusão, replay,
nomes/números em profundidade, estádio.

### Fase 6 — UX, mobile e desempenho · **6/6 PASS TÉCNICO**

frame time p95 **16,7 ms** (limite 33) · FPS mediano **59,9** (limite 45) ·
**0 long tasks** · 3 partidas consecutivas concluem · heap **78,4 → 71,2 MB
(−9,2%)**, sem vazamento · toque/rolagem/multitoque/rotação em 4 viewports.

Emulação **não** substitui aparelho físico: `PASS TÉCNICO` apenas.

### Fase 7 — auditoria dos 800 controles · **BLOQUEADO**

| status | itens | % |
|---|---:|---:|
| PASS | 152 | 19,0% |
| PENDENTE | 648 | 81,0% |

P0 130/464 (28,0%) · P1 21/309 · P2 1/27.
Dos 648 pendentes: **586 exigem humano/físico**, 35 sem cobertura automatizada.

12 controles foram fechados item a item por `eval_controls.py`, cada um com o
critério numérico da matriz confrontado à métrica medida — laterais 9,89/jogo
(exige 5–16), escanteios 3,85% (exige 2–18%), tiros de meta 7,33 (referência
7,71), impedimentos 1,02 (exige 0,5–4), distância do marcador 8,22 m (exige
≤8,5), cobertura pelo lado do gol 70,4% (exige ≥70%), zero ação sem trajetória
válida, desconexão de linha zero, e heap −9,2% em 3 partidas.

**`REL-007` — determinismo** foi provado agora: a mesma seed rodada duas vezes
produz resultado idêntico em 8 partidas (placar, travas e estatísticas).

`repo_regression` **3/3 PASS** após corrigir dois defeitos de integração do
pacote (harnesses de node chamados sem argumentos e com `cwd` errado).

---

## O que impede o `APROVADO`

1. **582 controles exigem olho humano ou aparelho físico.** Painel de 3
   observadores e testes em Android/iOS reais não são executáveis por mim.
2. **107 controles sem cobertura automatizada** — sobretudo IA tática (80),
   regras/goleiros, bolas paradas e VFX.
3. **Fase 5 incompleta**: bolas paradas, câmera, oclusão e replay.

## `IA-REG-001` — investigada até o fim: **não é regressão de defesa**

A marcação parecia ter piorado (sub-gate `marking` reprovado 99 → 124 em 200).
Investiguei com **quatro intervenções independentes**, 200 seeds cada:

| intervenção | cobertura | gols |
|---|---:|---:|
| — R14 como está | 0,704 | 1,820 |
| 1 · rastreio do marcador | 0,703 | 1,750 |
| 2 · recomposição da linha | 0,709 | 1,730 |
| 3 · amortecimento da âncora | 0,702 | 1,555 |
| 4 · intervalo de decisão +50% | 0,705 | 1,665 |

**Nenhuma variável defensiva move a cobertura.** Todas custam gols. Todas foram
revertidas.

O experimento 4 é o que fecha a questão: desacelerar a decisão em 50% **não
reduziu os passes** (188,3 → 187,9). O salto de 127,6 para 188,3 veio de as
decisões passarem a *existir*, não da frequência delas.

A explicação consistente com todos os dados: os **0,753 da candidata não medem
defesa boa, medem bola parada**. Com o portador congelado por até 47,8 s, a
defesa tinha tempo ilimitado para se posicionar e os atacantes ficavam
estáticos — "cobertura perfeita" de um jogo que não acontecia. É a mesma
impressão digital do defeito que inflava o `ppgRange` em 0,571.

**O limiar do gate `marking` foi derivado sobre o jogo congelado.** Não é a
defesa da R14 que piorou; é a medição original que estava inflada.

Isso é decisão de **produto**, não de engenharia, e por isso não a tomo sozinho:
re-derivar o limiar sobre o motor que joga, ou aceitar 0,70 como nova
referência e documentar. O que não se deve fazer é seguir mexendo na defesa.

## Riscos conhecidos

- O contrato de ação **aumentou a contagem de travas** (168 → 237) por segurar
  a bola ~0,2 s a mais. A patologia caiu (`dwellMax` 2,91 → 2,58 s) e não há
  travas ≥10 s, mas é uma troca real, registrada em `SYN-001`.
- `maxAbsGoalDiff` subiu de 0,429 para 0,500 com o contrato — dentro do limite
  0,65, mas com menos folga.
- A recalibração foi derivada em 98 partidas e confirmada em 196. `ppgRange` é
  o range de 7 médias ruidosas; a margem existe, mas não é enorme.

## Como reproduzir

```bash
python tools/verify_r13.py
python tools/build_ux.py --out "dist/COPA DOS SONHOS - R14 - MOTOR VIVO.html"
node tools/ux/probe_balllock.js --build="dist/COPA DOS SONHOS - R14 - MOTOR VIVO.html" \
  --csv=tools/r13/COPA_DOS_SONHOS_P0-6_R12.3_PARTIDAS.csv --start=0 --end=200 --out=out.json
node tools/r14/test_anim_states.js
python tools/r14/browser_anim_probe.py "dist/COPA DOS SONHOS - R14 - MOTOR VIVO.html"
python tools/r14/browser_projection_probe.py "dist/COPA DOS SONHOS - R14 - MOTOR VIVO.html"
python tools/r14/browser_ux_perf_probe.py "dist/COPA DOS SONHOS - R14 - MOTOR VIVO.html"
python tools/r14/reconcile_matrix.py --write
cd audit-r14 && python scripts/release_gate.py
```
