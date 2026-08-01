# RODADA OS-60 — cada drible com seu desenho, e o bloqueio que desenhava como corrida

## O instrumento (e o vício que ele tinha)

Para julgar pose sem depender do olho, desenhei o mesmo atleta em cada estado
num canvas isolado e comparei os pixels (`diag_os60_pose_signature.py`).

A primeira versão do teste deu **todas as poses diferentes** — inclusive na build
antiga, onde eu afirmava que eram iguais. O teste estava viciado: `dirCache` é
indexado por `o.key`, e eu usava a mesma chave para todos os estados, então a
**passada acumulava** de um estado para o outro e os pixels diferiam por isso,
não pela pose. Com chave própria por estado o teste ficou honesto.

## O que ele mostrou (R18.78, antes)

```
desenho IDENTICO:  [carry, body_feint, inside_cut, outside_cut, burst_touch]
                   [run, block]
nao variam com a fase: run, carry, body_feint, inside_cut, outside_cut,
                       burst_touch, block, gk_low_dive
```

Cinco estados de drible, **um desenho só** — a base 6% mais aberta e um leve
deslocamento do tronco. Quem faz elástico e quem arranca desenhavam igual. E
`block` desenhava **exatamente como correr**: o bloqueio tinha 100% de cobertura
de evento e nenhuma pose.

## Os edits

Todos dirigidos pela **fase** do controlador, que já existia:

- **`body_feint`** (elástico, caneta): o tronco joga para um lado e volta — meio
  período de seno com amplitude `0,34 r`, cabeça acompanhando, pernas plantadas.
  É o corpo enganando, que é o que a finta é.
- **`inside_cut`/`outside_cut`**: plantada e corte — inclinação de `0,30 rad` no
  pico contra o lado do corte, com a base abrindo `0,22 r`. O peso vai para fora
  e o jogador sai para dentro.
- **`burst_touch`** (arrancada): tronco projetado à frente `0,26 rad` e passada
  ampliada em 35%.
- **`block`**: base larga, corpo agachado `0,12 r` e perna estendida na linha da
  bola.

`turn_dribble` continua com o giro de 360 da OS-47.

## Depois

```
desenho IDENTICO:  [inside_cut, outside_cut]   <- de proposito, e o mesmo corte
passam a variar com a fase: body_feint, inside_cut, outside_cut, burst_touch,
                            block, header
```

Cobertura por evento segue em 100% nas cinco categorias.

## Gate

12 partidas, mesmas sementes: `goals 1.67 · xg 2.48 · shots 22.42 · corners 6.58
· passes 461.83` — idênticos à R18.78. Navegador sem `pageerror`.

## Fica aberto

- `gk_low_dive` não varia com a fase no teste isolado. O voo do goleiro em jogo
  usa outro caminho (`motion.type==='dive'`, que rotaciona o corpo 90°), então o
  teste pode não estar exercitando o caminho real — **não medi isso**, fica como
  dúvida, não como defeito.
- `run` e `carry` também não variam com a fase, e isso é correto: são cíclicos,
  dirigidos por `gait` (distância percorrida), não pela fase de ação.
