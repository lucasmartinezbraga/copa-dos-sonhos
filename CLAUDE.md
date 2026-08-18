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
  mesa.py           O RITUAL INTEIRO num comando, com veredito
  build.py          remonta dist/index.html a partir do manifesto
  split_build.py    divide um HTML monolítico em template + blocos
  import_build.py   importa um bundle novo para dentro de src/
  verify.py         presença, sintaxe e reprodutibilidade
  fisica/tela/      sondas que medem o que vai para a TELA
    arbitro.js         o lance é futebol? confronta camadas, dá veredito
    sanidade.js        o que nunca pode acontecer
    validar-lances.js  falta, desarme, lateral, escanteio, saída de bola
    fluidez.js         continuidade quadro a quadro
    permanencia-do-gesto.js  A/B em janelas pareadas do tremor de estado
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

Um comando só, e é ele que decide:

```bash
python3 tools/mesa.py            # build → verify → smoke → sanidade → árbitro → lances
python3 tools/mesa.py --rapido   # só build + verify + smoke, para iteração
```

Se a Mesa reprovar, **não faça commit**. Ela nomeia a etapa e o defeito.

**Por que a Mesa existe (OS-247).** Por uma rodada inteira a máquina de estados
de animação esteve *desligada* — um `ReferenceError` por quadro, engolido por um
`catch` mudo — e `verify.py`, `browser_smoke.js` e a bateria **passaram todos**.
Cada um media coisas que continuavam certas. As sondas que teriam pego o erro
existiam e não foram rodadas.

Duas regras que saíram disso:

* **Zero observação não é zero defeito.** Toda sonda tem de provar que estava
  olhando antes de dizer "nenhum problema". A seção 0 do Árbitro é isso, e
  "sem amostra" conta como reprovação.
* **`catch` mudo é bug invisível.** Se a apresentação não pode derrubar o
  motor, tudo bem engolir o erro — mas deixe rastro (`__CDS_ANIM_ERRO`) e
  reprove por ele.

O Árbitro (`tools/fisica/tela/arbitro.js`) é a sonda que julga se o lance é
futebol: confronta camadas que precisam concordar — evento do motor × gesto
publicado × cinemática do corpo × comportamento da bola — em vez de medir
média ou suavidade.

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
