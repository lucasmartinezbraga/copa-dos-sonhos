# HANDOFF — auditoria e reconstrução do motor

Contexto mínimo para uma sessão nova executar o plano de 32 seções sem
redescobrir o que já foi apurado.

---

## 0. Ambiente

```
REPO   C:\Users\lucmartinez\Downloads\COPA%20DOS%20SONHOS%20-%20FASE%201%20-%20PACOTE%20MODULAR (1)\COPA_DOS_SONHOS_FASE_1
NODE   %LOCALAPPDATA%\nodejs-portable\node-v24.18.0-win-x64\node.exe   (não está no PATH)
PYTHON 3.11 no PATH · Playwright + Chromium instalados
BRANCH claude/r14-motor-vivo-auditoria-800   (PR #12, não mergear em main)
```

Sempre `export PATH="$LOCALAPPDATA/nodejs-portable/node-v24.18.0-win-x64:$PATH"`
e `export PYTHONIOENCODING=utf-8` antes de rodar.

## 1. Arquitetura do build (essencial)

A R13.0 é **congelada e verificada por SHA**. Nada é editado nela diretamente.

```
src/r13/scripts/*.js      motor R13.0 — 14 módulos, CONGELADO (sha 363d9a91…)
src/r13/index.template.html   template de reconcatenação
src/r14/patches-engine.json   mudanças INTENCIONAIS de motor (from/to + rationale)
src/ux/patches.json           patches de apresentação
src/ux/patches-mobile.json    camada mobile/boot (fonte autoral)
src/ux/50-field25d.js         render 2.5D
src/ux/60-anim-state-machine.js + 61-anim-bridge.js   animação
tools/build_ux.py             build → HTML autocontido
tools/verify_r13.py           gate de identidade da R13.0
```

**Como mexer no motor:** adicionar entrada em `src/r14/patches-engine.json` com
`from` (âncora exata, ocorrência única) e `to`. O build falha alto se a âncora
não for única. NUNCA editar `src/r13/`.

**Armadilha crítica:** `_integrate` e vários outros do bundle base são **código
morto** — substituídos por `P._integrate=...` na camada
`29-r12-transactional-core.js`. Patchear o bundle base não tem efeito. Sempre
confirmar qual é a versão viva antes de ancorar.

## 2. Estado atual

Candidata **R14.4**: `7fdf183581162115344e320d5bfbada3f02f6a47e30a01948f08eba816c8b071`
Cópias fáceis em `C:\Users\lucmartinez\Downloads\COPA-R14\`.

Patches de motor ativos (8):

| id | o que faz |
|---|---|
| `r14-buildup-decide-ceiling` | piso→teto no `decideT`; travas ≥10s de 400 → 0 |
| `r14-style-recalibration` | `cross` de wings/direct/park; ppgRange 0,821 → 0,464 |
| `r14-pressing-intent` + `-approach` | defensor deixa de frear na bola: 2,68 → 4,19 m/s |
| `r14-shadow-lane` | shadow fecha linha de passe em vez de correr na bola |
| `r14-skill-dribble-spread` | clamp do drible .20/.72 → .12/.86 |
| `r14-skill-tackle-spread` | divisores do desarme 180/260 → 120/170 |
| `r14-throwin-walk` | cobrador sprinta até a linha antes da reposição |
| `_exp-clock` | **EXPERIMENTO, não embarcar** — clockRate 0,24 → 0,20 |

**Remover `_exp-clock` antes de qualquer build oficial.**

## 3. Gates atuais (R14.4)

| gate | limite | valor | |
|---|---|---|---|
| `ppgRange` | ≤ 0,75 | 0,464 | PASS |
| `maxAbsGoalDiffPerMatch` | ≤ 0,65 | 0,250 | PASS |
| `parkIdentity`/`tikiIdentity`/`noDominantStyle` | true | PASS | |
| trava ≥10s | 0 | 0 | PASS |
| `CONSISTENT` | 100% | 200/200 | PASS |
| cenários dirigidos | 25/25 | 25/25 | PASS |
| smoke estático | 13/13 | 13/13 | PASS |
| R13.0 byte-idêntica | sim | `363d9a91…` | PASS |
| `marking` | cobertura ≥0,65, dist ≤8,5m | 0,697 / 8,26 | PASS (justo) |

## 4. Achados com causa-raiz confirmada

**P0 — `decideT` congelado (CORRIGIDO).** `clamp13(v,.10,.44)` na fase
`build_up` era piso onde as irmãs usam teto. `_decide` nunca era chamado; a bola
travava até 47,8s. Reprodução: seed 870000, 4-1-4-1 press × 4-3-1-2 park, 71'.

**P0 — buff de lenda viola §27 (NÃO CORRIGIDO).** `10-base-bundle.js` ~2745:
```js
if (diff > 0 || diff < -1) continue;          // só empatado ou perdendo por 1
const hero = ... p.ref.legend && traits.includes('CLUTCH_PLAYER')
hero._onFire = true;  hero.maxSpd *= 1.05;    // VELOCIDADE FÍSICA
```
Efeitos: `+7` no duelo de drible (3573), `×1,18` (3822), `+5` no core R12 (125).
Ativa aos 75'. É bônus por placar + buff de lenda + bônus por minuto: três
proibições do §27 numa estrutura só. **Primeiro alvo da reconstrução.**

**P0 — compressão de relógio.** `CAL.timing.clockRate = 0.24` → a partida de 90
min ocorre em ~400s de física (13,5×). Por segundo simulado o motor é 3–6× MAIS
denso que futebol real; por partida é menos. Reduzir para 0,20 dá gols 2,57
(real ~2,7) e impedimentos 4,00 (~4,2) — **mas derruba `marking` para 0,627 e
reprova 87/100 partidas**. Conclusão: a marcação não aguenta um jogo com tempo
real de bola rolando. Consertar marcação ANTES de mexer no relógio.

**P1 — marcação decorativa.** `_assignDefRoles` calcula `_r13MarkTarget` e esse
valor **nunca é lido** para mover o atleta (o destino vem de `_tx/_ty`). Ligá-lo
diretamente PIORA (testado: cobertura 0,697→0,683). A posição calculada está
errada, não só desconectada.

**P1 — três papéis convergem na bola por construção** em `_defendTarget`:
presser vai em `[b.x,b.y]`, `_cover` fica a 8,5m, `_shadow` ficava a 65% do
caminho até a bola (corrigido para 62% em direção ao atacante).

**P1 — escanteio do nada.** `29-r12-transactional-core.js:139`: qualquer
deflexão perto da linha de fundo vira escanteio com 72% (cruzamento) / 48%.

**P2 — fontes embutidas mortas (CORRIGIDO).** Os 14 `@font-face` estavam dentro
de um comentário HTML aberto na linha 57 e fechado na 86.

## 5. Tentativas que FALHARAM (não repetir)

Cinco tentativas de melhorar marcação, todas medidas em 200 seeds e revertidas:

| tentativa | cobertura | resultado |
|---|---:|---|
| rastreio do marcador (`_smx/_smy` fora de overload) | 0,703 | inerte |
| recomposição da linha 0,47→0,62 | 0,709 | espalhamento piorou |
| amortecimento da âncora `deepest` | 0,702 | gols −15% |
| intervalo de decisão +50% | 0,705 | passes não mudaram |
| ligar `_r13MarkTarget` em `_tx/_ty` | 0,683 | piorou |

**Padrão:** nenhuma variável defensiva move a cobertura. Ela travou em
0,68–0,71 sob toda intervenção. Isso sugere que o gargalo NÃO é ajuste de
parâmetro defensivo — é estrutural.

Também falhou: reduzir o basculamento do bloco (`_slideF` 0,12–0,26 → 0,06–0,14
e → 0,09–0,19). Ambos pioraram cobertura e distância do marcador.

## 6. Ferramentas prontas

```
tools/ux/probe_balllock.js        travas + observador de futebol + matriz de estilos
                                  flags: --styleMatrix=1 --repeats=N --trace=1
tools/r14/probe_movement.js       bote, corridas, forma do time, velocidade
tools/r14/calibrate_styles.py     recalibração de estilos (--set wings.cross=1.85)
tools/r14/eval_controls.py        avalia controles com critério numérico
tools/r14/reconcile_matrix.py     reconcilia os 800 controles
tools/r14/browser_anim_probe.py   máquina de estados no navegador
tools/r14/browser_projection_probe.py   9 invariantes de projeção
tools/r14/browser_ux_perf_probe.py      FPS, frame time, heap, toque
tools/r14/relatorio_1000.py       relatório de 1000 partidas
tools/r14/make_human_kit.py       gera/lê folhas de observação humana
```

Receita para chegar à partida no navegador (verificada):
```js
const sq=G.db.squads[0], lu=autoLineup(sq,'4-3-3',0);
const picks=lu.lineup.map(s=>({p:s.p,from:sq.c}));
const me=CUP.registerPlayerTeam(G.db,picks,(lu.bench||[]).map(p=>({p,from:sq.c})));
G.lineup=lu.lineup.map((s,i)=>({p:me.pl[i],x:s.x,y:s.y,pos:s.pos,from:sq.c}));
G.bench=me.pl.slice(11); G.formKey='4-3-3'; G.style='balanced';
G.cup=CUP.createCup(G.db,'ME'); UI.go('cup');
```
Falta achar o controle que inicia a partida (ver `SCREENS.cup`, ~linha 7961).

## 7. O que NÃO existe e o plano exige

- **Habilidade × sucesso** (97/90/80/70): nenhuma métrica. É o §3 e o §20.
- Acerto de passe, chute no alvo, faltas, cartões: nunca medidos.
- Disciplina de corredor, colisões entre companheiros, movimentos inúteis
  em direção ao portador: §22 pede, não existe.
- Logs de decisão explicáveis (§31): não existe.
- Agregador único de release (§26): não existe — e há evidência do problema que
  ele descreve (ver abaixo).

## 8. §26 — evidência do status herdado

`canonicalStatus` (camada R12, transacional) dá **200/200 CONSISTENT** enquanto
`observedFootball.status` (camada R13, futebol) dá **70/200 PASS** e o sub-gate
`marking` reprova em 124/200. São camadas ortogonais e meus próprios relatórios
misturaram as duas. O agregador do §26 precisa tratá-las como conjuntos
distintos e reprovar a release se qualquer P0 de qualquer camada falhar.

## 9. Documentos de referência

```
reports/r14/GATES-REALISMO.md            tabela de gates proposta (7 blocos)
reports/r14/RELATORIO-FINAL-R14.md       revisão fase a fase
reports/r14/COMO-ME-AJUDAR-A-DIAGNOSTICAR.md
reports/r14/PROXIMO-PASSO-CANVAS.md      bloqueio do bloco visual
reports/r14/DIAGNOSTICO-INICIAL.md
evidence/vivacidade/IA-REG-001/          histórico das 4 tentativas de marcação
audit-r14/                               pacote de auditoria, matriz 800, evidências
```

## 10. Ordem sugerida

1. **§27** — remover buff de lenda / `_onFire` / bônus por placar. É P0 e está
   localizado. Medir impacto nos gates depois.
2. **§26** — agregador único de release.
3. **§3** — teste 97/90/80/70. Sem ele, "habilidade importa" é hipótese.
4. **Marcação estrutural** — as 5 tentativas de parâmetro falharam; o caminho
   é redesenhar como a posição de marcação é calculada.
5. **Relógio** — só depois que a marcação aguentar tempo real de jogo.

## 11. Regras de trabalho que funcionaram

- Medir ANTES de mexer. Toda mudança com número antes/depois em 200 seeds.
- Reverter o que não move a métrica-alvo, mesmo que "faça sentido".
- Validar teste por mutação: quebrar o código de propósito e conferir se acusa.
- Nunca marcar PASS sem artefato concreto vinculado ao SHA.
- Quando métrica e olho humano discordam, registrar os dois — o olho do usuário
  acertou em todas as vezes nesta sessão.
