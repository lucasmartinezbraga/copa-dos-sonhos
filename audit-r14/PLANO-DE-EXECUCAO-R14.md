# Plano de execução do Motor Vivo 2.5D

A auditoria não é apenas um checklist final. Ela dirige a implementação na ordem correta.

## Trilha A — P0: bola travada e vivacidade

1. Rodar a sonda nas 200 seeds diversas.
2. Ordenar por `lockMaxSec`, `lockCount` e repetição por formação/estilo.
3. Reproduzir os 10 piores casos em 1X e 0.5X.
4. Classificar a causa: decisão, recepção, disputa, reinício, visual ou combinação.
5. Corrigir sem teleporte e sem passe forçado ao atleta mais próximo.
6. Reexecutar seed, matriz de 17 formações, 7 estilos e lote de 876.

IDs principais: BLK-001…040, SYN-004…015.

## Trilha B — P0: máquina de animação

Implementar controlador por atleta com as fases:

`entrada → preparação → contato → continuidade → recuperação → locomoção`

O motor emite o contrato da ação; o render interpola sem inventar resultado.

IDs principais: ANM-001…045.

## Trilha C — P0: sincronização motor-render

Criar um contrato com:

- ator;
- ação;
- alvo;
- pé utilizado;
- início;
- contato;
- encerramento;
- resultado;
- ponto físico de contato.

A bola só pode sair no contato. Replay, evento, estatística e narração precisam usar o mesmo lance.

IDs principais: SYN-001…035.

## Trilha D — futebol observado

Depois de eliminar travas e sincronizar ações, reavaliar:

- cadência 1X;
- progressão contra bloco baixo;
- saída contra pressão alta;
- resposta defensiva ao 4-2-4;
- apoio, ultrapassagem e desmarque;
- marcação e recomposição;
- escolha passe/drible/chute.

Alterações lógicas intencionais recebem entrada no `delta-manifest.template.json` e novo golden R14.

## Trilha E — liberação

1. 800 controles executados.
2. Todos os P0 PASS.
3. P1 >=98%; P2 >=95%.
4. 876 + 25 + 13 e determinismo R14.
5. Android/iOS físicos.
6. Três observadores independentes.
7. ZIP final, SHA256SUMS e veredito assinado.
