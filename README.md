# Copa dos Sonhos — Fase 2

Camada canônica **Banco V3** aplicada sobre o banco legado, preservando a entrega final em um único HTML autocontido.

## O que mudou
- posição primária, posições secundárias e posições emergenciais explícitas;
- 45 atributos granulares persistentes usados pelo motor;
- ficha própria de goleiro;
- pé dominante, pé fraco e altura de simulação com proveniência;
- traits legados ampliados e traits comportamentais;
- funções naturais por jogador;
- validação automática do banco e de todas as formações;
- escalação automática que nunca mistura goleiro e jogador de linha.

## Proveniência
Dados não historicamente curados são marcados como estimativas de simulação. Nenhuma altura ou pé estimado deve ser apresentado ao usuário como fato biográfico.

## Estrutura
- `src/scripts/25-data-integrity-v3.js`: camada V3 e validador.
- `tools/phase2_audit.js`: auditoria completa do banco e das escalações.
- `tests/phase2_engine_smoke.js`: integração dos perfis V3 com o motor.
- `tests/browser_smoke.py`: abertura real no Chromium.
- `reports/phase2-audit.json`: resultado completo da auditoria.

## Uso
```bash
python3 tools/build.py
python3 tools/verify.py
python3 tests/browser_smoke.py
```

Edite apenas `src/`; o diretório `dist/` é gerado pelo build.
