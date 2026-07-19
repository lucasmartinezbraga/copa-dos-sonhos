# Copa dos Sonhos — Fase 1

Projeto modular de desenvolvimento com entrega final em um único HTML autocontido.

O build de produção é byte a byte idêntico ao Baseline 4.0: nenhuma regra, tela ou dado mudou nesta fase.

## Estrutura
- `src/scripts/`: dados, núcleo, tática, motor, Copa e interface.
- `src/styles/`: 15 módulos CSS na ordem original da cascata.
- `src/index.template.html`: template de produção.
- `src/index.dev.html`: versão com arquivos externos para desenvolvimento.
- `tools/build.py`: gera o HTML final.
- `tools/verify.py`: verifica hash e sintaxe.
- `tests/browser_smoke.py`: smoke do HTML final.
- `tests/dev_server_smoke.py`: smoke do projeto modular via servidor local.
- `reference/`: baseline imutável.

## Uso
```bash
python3 tools/build.py
python3 tools/verify.py
python3 tests/browser_smoke.py
python3 tests/dev_graph_check.py
```

Edite somente `src/`; nunca edite `dist/` diretamente.
