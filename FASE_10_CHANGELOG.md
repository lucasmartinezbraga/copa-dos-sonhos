# Changelog — Fase 10 · Persistência da Copa · 5.3.0

## Persistência entre partidas

- condição física individual;
- fadiga acumulada e recuperação entre jogos;
- desgaste adicional por prorrogação;
- lesões com duração determinística em partidas;
- cartões amarelos acumulados, suspensão por dois amarelos e cartão vermelho;
- forma recente baseada nas últimas cinco atuações;
- confiança contextual separada para decisão, finalização e defesa;
- familiaridade com posição, função e foco;
- sequência de partidas marcando gols;
- contexto de pressão da fase eliminatória;
- registro de titularidade, banco, minutos e participações;
- recuperação maior para atletas pouco utilizados;
- substituição automática e explicável de titulares indisponíveis.

## Preparação entre jogos

Cinco decisões, todas com efeito limitado ao próximo jogo:

- Recuperação física;
- Treino tático;
- Bolas paradas;
- Finalização;
- Preparação defensiva.

Os efeitos são mostrados antes da escolha e entram apenas nos mecanismos correspondentes. Não alteram permanentemente os atributos do banco.

## Save V3

- migração encadeada de saves V1 e V2;
- persistência integral do estado da Copa e da Fase 10;
- registro da escolha de preparação;
- rejeição segura de save corrompido ou versão futura.

## Interface

- nova tela de preparação no hub da Copa;
- partida bloqueada até a decisão do usuário;
- condição, lesão, suspensão, forma e sequência de gols no elenco;
- layout validado em desktop, celular vertical e celular horizontal.

## Correções encontradas durante a validação

- lesões e suspensões de reservas agora descontam partidas normalmente;
- a pressão do mata-mata é aplicada à partida que será jogada;
- saves antigos recebem estado neutro, sem inventar progresso;
- efeitos de preparação não consomem nem substituem atributos permanentes.
