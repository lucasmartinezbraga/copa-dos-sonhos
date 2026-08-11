# Copa dos Sonhos — Diretivas para Claude Code

## Contexto do Projeto
- **Tipo**: Jogo web de simulação de futebol
- **Arquitetura**: Modular (scripts e CSS separados em desenvolvimento, bundled em produção)
- **Build**: Python (tools/build.py gera HTML único autocontido)
- **Status**: R19.08 importado para `src/` e reprodutível pelo build (OS-200)
- **Garantia**: `tools/build.py` remonta o bundle a partir de `src/` e
  `tools/verify.py` confere sintaxe de todos os 89 blocos

## Estrutura
```
src/
  scripts/          9 módulos do core, na ordem obrigatória
  scripts/layers/   as camadas empilhadas (uma por bloco <script>)
  styles/           módulos CSS do core
  styles/layers/    blocos <style> do bundle
  index.template.html  esqueleto com um marcador por bloco
tools/
  build.py          remonta dist/index.html a partir do manifesto
  split_build.py    divide um HTML monolítico em template + blocos
  import_build.py   importa um bundle novo para dentro de src/
  verify.py         presença, sintaxe e reprodutibilidade
  fisica/bateria.js    bateria paralela com sondas de física
  fisica/calibrar.py   varredura de calibração
  fisica/placar.py     pontua a medição contra calibration/targets.json
tests/
  fisica_balistica.js  teste de unidade da balística
  browser_smoke.js     sobe o bundle em Chromium de verdade
manifests/        ordem dos blocos e do core
reports/          medições e laudos
```

## Workflow de Desenvolvimento

### Para editar o jogo:
1. Edite **apenas** `src/` (scripts ou styles)
2. **Nunca** edite `dist/` diretamente
3. Rode `python3 tools/build.py` para gerar novo HTML
4. Rode `python3 tools/verify.py` para validar
5. Teste com `node tests/browser_smoke.js`
6. Commit no Git

### Se mexer no motor de partida ou na física
Rode a bateria antes e depois e **compare os números**, nunca só o "passou":

```bash
node tools/fisica/bateria.js --build=dist/index.html --matches=48 --workers=8 \
  --out=reports/minha-medicao.json
```

Ela é compatível em semente com `tools/r1840/bateria.js`, então os agregados
são comparáveis com as baterias históricas. Referência atual em
`reports/fisica-os200.json` e o laudo em `reports/OS-200-fisica-da-bola.md`.

Para varrer parâmetros sem reconstruir o bundle, use `CDS_OS200_TUNE` via
`tools/fisica/calibrar.py --grade '[...]'`.

### Versão de desenvolvimento (iteração rápida):
- Use `src/index.dev.html` com servidor local
- Arquivos CSS/JS são carregados externamente
- Sem necessidade de rebuild a cada mudança
- Roda testes com `python3 tests/dev_server_smoke.py`

## Regras Importantes

### ✅ Permitido
- Editar `src/scripts/` para lógica e dados
- Editar `src/styles/` para CSS
- Rodar tools/build.py e tools/verify.py
- Fazer commits e push
- Adicionar novos módulos mantendo a arquitetura
- Atualizar manifests/ se mudar estructura

### ❌ Proibido
- Editar `dist/` diretamente — será sobrescrito no próximo build
- Quebrar a estrutura modular — respeitar IIFEs e módulos
- Alterar ordem do manifesto sem validar
- Ignorar avisos de verify.py

## Como adicionar uma camada nova
1. Crie o arquivo em `src/scripts/layers/`
2. Acrescente o marcador `/*__CDS_BLOCK_N__*/` em `src/index.template.html`
3. Registre o bloco em `manifests/build-manifest.json`
4. Build + verify

**Cuidado com escopo:** o core é uma IIFE. `facet`, `chance`, `R`, `clamp`,
`FL`, `FW`, `getAttr` e `lerp` são globais e podem ser usados direto; `CAL`
**não é** — leia a calibração por `ENGINE_CALIBRATION`. As baterias carregam o
bundle com `vm.runInThisContext`, que não é como o navegador carrega: só
`tests/browser_smoke.js` prova que o jogo sobe de verdade.

## Decisões Arquiteturais

### Física da bola (OS-200)
A trajetória vem de integração numérica real (gravidade, arrasto, quique) na
camada `88-os200-balistica-real.js`, que **substitui** `_planPhysicalSegment` e
`_trajectoryPoint` em vez de encadeá-los. O desfecho do chute vem da geometria
da meta, não de sorteio prévio — `pGoal` calibra a pontaria.

Não reintroduza teto de altura em `_physicalTargetZ`: era ele que impedia
qualquer chute de passar por cima do travessão. Detalhes e medições em
`reports/OS-200-fisica-da-bola.md`.

### O passe rasteiro não decola (OS-203)
O regime `rasteira` sai com `theta = 0` **e** achata a origem para `o.z = 0`.
Os dois juntos, senão a bola quica: com `z₀ = 0,12` (que o core escreve em
`b.z` logo antes de chamar a camada) o passe fazia um salto de 14 cm e dois
quiques, 54 vezes por minuto de jogo.

**Não conserte no core.** Aqueles 0,12 também são a origem do CHUTE, e a mira
está calibrada em cima deles. O achatamento é por regime, na camada 88.

Regra geral que já custou três rodadas de medição: **número decorativo vira
número físico quando o integrador liga.** Antes da OS-200 `z` só servia para
desenhar. Laudo em `reports/OS-203-a-bola-para-de-pingar.md`.

### Dois placares diferentes (OS-204)
`tools/fisica/placar.py` mede contra `calibration/targets.json` — as faixas do
próprio projeto, 13 métricas. **11/13.**

`tools/fisica/futebol_real.py` mede contra o futebol de elite — 21 métricas,
incluindo laterais, impedimentos e o minuto em que os gols saem. **10/21.**
Passar no primeiro não implica passar no segundo: a lista de design nunca
perguntou quantos laterais acontecem.

Maior desvio conhecido: **o jogo esvazia em vez de crescer.** 22% dos gols
saem antes dos 15 minutos e 12,5% depois dos 76 — no futebol real é o inverso.
Não é bug de relógio (o tempo simulado por faixa está medido e é uniforme): é
a fadiga, uniforme demais, com r = 0,814 entre stamina e taxa de chutes.
Laudo em `reports/OS-204-teste-do-futebol-real.md`.

### ANTES de editar qualquer método do core, rode isto

```bash
node tools/fisica/pilha.js dist/index.html 14
```

Ela põe um contador em cada uma das 323 sobrescritas e diz quais rodam. Das 81
camadas, **73% das sobrescritas estão vivas** — editar o core e não acontecer
nada é o modo de falha mais comum deste projeto. Já custou **cinco** rodadas de
medição:

| editei | quem interceptava |
|---|---|
| arrasto da R13 (OS-200) | consumidor no mesmo quadro |
| `if (p === presser)` em `_defendTarget` | R13 responde por todos os ramos |
| `b.z = 0.12` decorativo | virou física ao ligar o integrador |
| `_looseBall` (A4) | camada 08 converte em desvio e **não chama o core** |
| `decideT` (OS-206) | R13 reescreve todo quadro, só para baixo |

Nas duas últimas eu já tinha a `pilha.js` escrita e não a usei.

### Os quatro consertos de futebol (A1–A4)

**A1 · impedimento** — `_bestPass` tem 25+ termos e nenhum era a linha de
impedimento; `_offsideLine()` só era lido pela movimentação. O portador jogava
no impedido e o juiz marcava (probabilidade travada em 0,97). Um termo em
`_bestPass`: **10,0 → 5,11 por partida**. Efeito colateral quantificado: 4,9
impedimentos a menos × ~8,5% de conversão = +0,42 gol — a conversão estava
calibrada contra um jogo que matava 10 ataques por partida no apito.

**A2 · goleiro** — `_os200Defesa` parava no **primeiro** instante alcançável, que
tem folga ≈ 0 por construção. Todo chute era resolvido no pior ponto da defesa.
Guardar a **melhor** folga: `golPorChuteNoAlvo` **0,428 → 0,378**, gols
3,27 → 2,833, design 11/13 → **12/13**, futebol real 12/21 → **15/21**.
`XG_ESCALA` re-derivada para 0,651 porque o modelo de defesa mudou.

> **Sinal barato:** subir a envergadura do goleiro de 1,05 para 1,45 **piorou** o
> jogo. Quando aumentar um recurso piora o resultado, o modelo está usando o
> recurso do jeito errado.

**A3 e A4 · laterais — dois fracassos, e o que sobra.** 15,9 contra 33–48 do
real. Não é o arremesso (A3: `throwIns` conta a SAÍDA, não o arremesso; e a
tentativa moveu a métrica 2 SE **para pior**). Não é resgate de bola fora (A4:
a bola sai mesmo; o ramo editado nem roda). **O que sobra é a direção** — corte,
rebote e alívio são quase sempre mirados num ponto *dentro* do campo
(`_deflectTo` com `clamp(..., 2, FL-2)` em quase todo ponto de chamada). É
decisão de modelo, não conserto de uma linha. Laudos em `reports/A3-` e `A4-`.

### A bateria não vê a tela
`tools/fisica/bateria.js` roda com `vm.runInThisContext` e não desenha nada —
a bola pingando atravessou uma OS inteira sem aparecer em métrica alguma. Para
o que o jogador vê, use `tools/fisica/tela/` (Chromium de verdade). Se mexeu em
trajetória, rode `pinga.js` junto com a bateria.

### Relógio e fadiga (OS-201)
`ENGINE_CALIBRATION.timing.clockRate` é minutos de jogo por segundo de
simulação. Está em **0,085**: em 0,13 o jogo não batia nenhum dos próprios
mínimos de volume em `calibration/targets.json`.

A fadiga é normalizada por `ADV4.context.clockRateRef` — ela mede **minuto de
jogo**, não segundo de simulação. Se mexer no `clockRate`, não mexa no dreno
junto: ele já é invariante.

Meça com `tools/fisica/placar.py`, que pontua uma medição da bateria contra
`calibration/targets.json`. Estado atual: 10/13. Laudo em
`reports/OS-201-relogio-e-fadiga.md`.

### Perseguição e ritmo (OS-202)
O marcador antecipa o portador em vez de correr atrás — `_defendTarget` na
camada `89-os202-perseguicao-do-marcador.js`.

**Cuidado:** o ramo `if (p === presser)` do core **não roda** — a camada R13 o
intercepta antes. Já perdi uma rodada de medição editando lá.

Os botões de velocidade agora dizem a verdade (o rótulo é o multiplicador) e o
padrão é 3X, ~7,6 min por partida. Tempo de tela se resolve na velocidade, não
no `clockRate`: este decide quanto futebol acontece, aquela decide quão rápido
você assiste. Laudo em `reports/OS-202-perseguicao-e-ritmo.md`.

### IA Adversária (Match Sim)
Permanece no módulo MatchSim por enquanto porque usa estado privado (IIFE).
- Será separada após contratos públicos e testes específicos
- Não fazer separação agora — violaria objetivo da Fase 1

### Módulos de Script (ordem)
1. `00-head-bootstrap.js` — inicialização
2. `10-data.js` — dados (jogadores, times, etc)
3. `20-core.js` — lógica central
4. `30-tactics.js` — sistemas tático
5. `40-match-engine-and-manager-ai.js` — simulação + IA
6. `50-tournament.js` — Copa
7. `60-ui-flow.js` — interface
8. `70-game-runtime-and-rendering.js` — runtime + render

**Respeite esta ordem no manifesto e nas inclusões.**

## Validação

Cada commit deve passar:
```bash
python3 tools/verify.py
python3 tests/browser_smoke.py
```

Se falhar, não faça commit.

## Como eu (Claude) trabalho aqui

1. Leio o código e CLAUDE.md para entender limites
2. Edito `src/` conforme solicitado
3. Rodo build + verify + tests automaticamente
4. Reporto status
5. Só faço commit se tudo passar

## Git

- Main branch: `main` (produção, sempre estável)
- Branches de feature: `feat/nome-feature`
- Merge para main apenas com tudo testado
- Commits descritivos seguindo padrão Convencional

## Próximas Fases Esperadas
- **Fase 2**: Separação da IA adversária em módulo público
- **Fase 3+**: Novas features (multiplayer, mais modos, etc)

---

**Última atualização**: 2026-08-06
