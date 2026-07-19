# Fase 9 — Changelog 5.2.1

## Adicionado

- plano pré-jogo com jogadores-chave, funções prováveis, goleiro com a bola e contexto público da Copa;
- diagnósticos de ponta desconectado, zona vazia, função incompatível e amarelado atacado;
- exploração de adversário amarelado;
- mudança de função e dever individual;
- pressão orientada e foco por setor;
- adaptação do tipo de cruzamento;
- registro de jogadores, setores, intensidade e configuração antes/depois;
- motivos para não agir;
- exportação e importação completa da memória do treinador.

## Ajustado

- intervalo de análise e cooldown;
- limite de cinco mudanças normais e seis em emergência;
- restauração segura de alterações ruins;
- compatibilidade com jogadores substituídos sem `phaseRole` inicial.

## Validado

- testes dirigidos;
- partida completa;
- regressão pareada de oito partidas;
- desktop e mobile;
- determinismo e integridade do banco.

## 5.2.2 � Correcoes da Auditoria de Conformidade (Fases 0-9)
- Zero Math.random() no codigo-fonte: RNG visual deterministico proprio (vrand) em 60-ui-flow e 70-game-runtime.
- Fase 4 (bloqueador): selecao probabilistica ponderada por softmax seedado (T=0.06); metrica decisionNonBest; regressao 100 partidas dt=1/60 com nota 91.4/100.
- Contrato de save versionado (48-save-contract.js): SAVE_VERSION=2, migracao v1->v2, rejeicao segura de corrompidos/versoes futuras, engineVersion e campos das Fases 6/9 no save.
- Detalhes: AUDITORIA_CORRECOES_V5.2.2.md
