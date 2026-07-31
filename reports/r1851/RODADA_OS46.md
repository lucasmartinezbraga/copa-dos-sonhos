# RODADA OS-46 — a animação recebe os eventos que já existiam

## Antes de mexer: o que existe

O jogo **já tem** um renderer de corpo procedural (`CDS_F25D.body`, `:19517`)
com pernas, passada, inclinação, e poses próprias de chute, carrinho, cabeceio,
drible e goleiro. E **já tem** um catálogo de 60 estados de animação
(`CDS_ANIM`, `:19809`), incluindo `gk_low_dive`, `gk_high_dive`, `gk_parry`,
`gk_smother`, `gk_foot_save`, `body_feint`, `inside_cut`, `outside_cut`,
`turn_dribble`, `burst_touch`, `header`, `block`, `intercept`, `volley`.

## Uma correção minha, no meio do caminho

Medi primeiro em Node e reportei que "a máquina de estados inteira está morta".
**Errado** — foi artefato do meu harness, que pula alguns blocos de script. No
navegador ela está viva: 22 controladores, `animOf()` respondendo.

## O censo real (3 partidas completas no navegador, 231.814 amostras)

```
run 42,69% | jog 31,82% | walk 11,24% | gk_ready 9,00% | idle 2,06% | sprint 1,12%
carry 0,61%      pass_* 1,22%      shot_* 0,02%
dribble_prepare, body_feint, inside_cut, outside_cut,
  turn_dribble, burst_touch, dribble_success, dribble_failure    0%   NUNCA
gk_low_dive, gk_high_dive, gk_parry, gk_smother, gk_foot_save    0%   NUNCA
header, block, intercept, slide_tackle, jockey                   0%   NUNCA
```

98% do tempo é locomoção. O desenhista sabe desenhar voo de goleiro e finta;
**ninguém nunca pede**.

## O mecanismo (`:20101`)

O único mapa de evento→estado da ponte R14 é:

```js
const map = { gk_save:'gk_parry', gk_claim:'gk_catch',
              gk_punch:'gk_punch', gk_claim_miss:'gk_ground_recover' };
```

O motor **não emite `gk_save`**. Ele emite **`save`** (`:6418`, `:6426`,
`:6433`). A chave nunca bate — por isso o goleiro nunca voa e passa 99% da
partida em `gk_ready`. O mesmo para `dribble`, `header_shot`, `header_clear`,
`blocked`, `intercept`, `gk_sweep`, `tackle_missed`.

## O edit

Uma camada que envolve `_emit` e `_startTravel` e pede o estado correspondente.
Nenhum desenho novo — cada pose já existe. Nenhuma física, RNG ou decisão.

Dois achados durante a calibração, ambos medidos:

1. **O voo tem de ser pedido na saída do chute, não na defesa.** No instante em
   que `save` é emitido o goleiro já foi levado ao ponto de interceptação, então
   o afastamento lateral é zero. Com o gatilho no evento, `gk_low_dive` ficou em
   0%. O gatilho mudou para `_startTravel` com `meta.outcome==='save'`.
2. **O corte de 1,1 m para decidir voo quase nunca disparava** — o goleiro da
   OS-19 fica bem posicionado. Baixado para 0,55 m: defesa com qualquer
   componente lateral é voo; palma seca só para bola em cima dele.

## Medido — cobertura POR EVENTO (o que o olho vê)

```
                      R18.70   R18.71
defesa do goleiro       0,0%    100,0%
bloqueio                0,0%    100,0%
cabeceio                0,0%     64,0%
chute                 100,0%    100,0%
drible                100,0%    100,0%
```

**Chute e drible já tinham pose própria em 100% dos eventos.** A fração baixa no
censo por quadro (`shot_* 0,02%`) era só a duração curta da ação, não ausência —
e isso corrige a minha própria leitura inicial. O que estava faltando de fato
era **goleiro, bloqueio e cabeceio**, e esses foram de zero a quase tudo.

## O gate desta rodada

A previsão registrada era que os números do motor ficassem **idênticos**. 12
partidas, mesmas sementes:

```
                R18.70    R18.71
goals            1.83      1.83
xg               2.32      2.32
shots           17.42     17.42
corners          4.42      4.42
passes         374.33    374.33
fouls            9.92      9.92
```

Idênticos até a última casa. A camada é provadamente só de apresentação.

Navegador: sem `pageerror`, sem erro de console.

## Fica aberto

- `cabeceio` em 64%: o cabeceio de cruzamento passa por caminhos que não emitem
  `header_shot`/`header_clear`.
- a QUALIDADE das poses de chute e drible — elas existem, mas quem julga se
  estão boas é o olho, não o censo.
