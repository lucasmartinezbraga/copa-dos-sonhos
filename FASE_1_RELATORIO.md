# Fase 1 — Arquitetura modular concluída

- Baseline preservado e imutável.
- HTML convertido em template de build.
- CSS ativo separado em 15 módulos.
- JavaScript separado em 8 módulos de runtime, mais bootstrap.
- Versão dev usa arquivos externos.
- Versão final continua sendo um único HTML offline.
- Manifesto registra ordem, hashes e responsabilidades.
- Verificação compara SHA-256 e valida sintaxe.
- Smoke tests cobrem build final e versão modular.

## Decisão deliberada
A IA adversária permanece no módulo do MatchSim porque usa estado privado da IIFE. A separação física será feita após contratos públicos e testes específicos; fazê-la agora alteraria o runtime e violaria o objetivo desta fase.

## Garantia
O build final é byte a byte idêntico ao Baseline 4.0.

## Validação adicional
Todos os 9 arquivos JavaScript de origem passaram individualmente no `node --check`. O `index.dev.html` foi validado contra todas as 15 folhas CSS e todos os scripts externos. A sandbox bloqueia navegação localhost, então o smoke de navegador foi executado sobre o build final autocontido.
