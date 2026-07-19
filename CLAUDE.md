# Copa dos Sonhos — Diretivas para Claude Code

## Contexto do Projeto
- **Tipo**: Jogo web de simulação de futebol
- **Arquitetura**: Modular (scripts e CSS separados em desenvolvimento, bundled em produção)
- **Build**: Python (tools/build.py gera HTML único autocontido)
- **Status**: Fase 1 concluída — baseline 4.0 preservado byte a byte
- **Garantia**: O build final é idêntico ao reference/baseline

## Estrutura
```
src/
  scripts/        8 módulos JS + bootstrap
  styles/         15 módulos CSS
  index.dev.html  versão com arquivos externos (desenvolvimento)
  index.template.html template para build
tools/
  build.py        gera dist/index.html
  verify.py       valida hash e sintaxe
tests/
  browser_smoke.py    testa build final
  dev_server_smoke.py testa versão modular
manifests/        metadata, hashes, responsabilidades
reference/        baseline imutável (4.0)
```

## Workflow de Desenvolvimento

### Para editar o jogo:
1. Edite **apenas** `src/` (scripts ou styles)
2. **Nunca** edite `dist/` diretamente
3. Rode `python3 tools/build.py` para gerar novo HTML
4. Rode `python3 tools/verify.py` para validar
5. Teste com `python3 tests/browser_smoke.py`
6. Commit no Git

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

## Decisões Arquiteturais

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

**Última atualização**: 2026-07-18
