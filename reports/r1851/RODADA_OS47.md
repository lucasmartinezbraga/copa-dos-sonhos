# RODADA OS-47 — o giro de 360 existe, e agora o corpo gira

## O que já havia

`_pickMove` (`:5829`) tem seis dribles nomeados: **arrancada, elástico, caneta,
drible da vaca, meia-lua, corta pra dentro**. A meia-lua é exatamente a roleta
de 360. O catálogo de animação tem o estado `turn_dribble`.

Nada disso aparece em campo.

## Censo (6 partidas)

```
dribles                36,7 /partida
com efeito (flair)      8,8 /partida = 24,1%
campo `move` do evento  SEMPRE vazio
payload real            {by, on, ok, flair}    <- sem `move`
```

## Causa

`P._dribble` é **substituído por inteiro** pela camada R12.2 (`:16382`), que não
encadeia com o núcleo. O `_dribble` original (`:5840`) e o `_pickMove` que ele
chama são **código morto**.

É a terceira vez que esta armadilha aparece nesta linhagem, sempre igual: uma
camada posterior troca o método inteiro e deixa uma funcionalidade inteira sem
alcance. Já documentada para `_assignDefRoles` (OS-06) e `_defendTarget` (OS-40).

E mesmo com o nome chegando não haveria giro: `CDS_F25D.body` (`:19517`) só
rotaciona o corpo no mergulho do goleiro. Não existia pose de giro desenhada.

## Três edits

**1. O drible volta a ter nome — sem consumir RNG.** No emit vivo da R12.2,
`move` passa a sair dos **atributos** do atleta:

```
velocidade >= 88             -> arrancada
tecnica    >= 88             -> drible da vaca
drible >= 88 e tecnica >= 84 -> elástico
drible >= 86                 -> meia-lua
senão                        -> corta pra dentro
```

Havendo mais de um elegível, alterna por `t` e número da camisa. **Nenhum
sorteio novo** — e por isso os números da partida ficam idênticos. De quebra o
drible vira característica do jogador: quem tem técnica faz vaca, quem tem
drible faz meia-lua, quem tem perna faz arrancada.

**2. O corpo gira.** Em vista 2,5D o giro se lê pelo estreitamento: o corpo
afina até o perfil, passa de costas e volta — `ctx.scale(cos(θ), 1)` com θ indo
de 0 a 2π ao longo da fase, mais uma elevação pequena no meio. O fator é mantido
longe de zero porque `ctx.scale(0,1)` colapsa a matriz e o desenho sumiria.

**3. A fiação.** `meia-lua` e `drible da vaca` pedem `turn_dribble`.

## Medido

```
                        R18.71    R18.72
campo `move`             vazio     arrancada 2,17 | elástico 2,83
                                   drible da vaca 2,17 | meia-lua 1,67  (/partida)
turn_dribble (quadros)      0%     0,031%
giros por partida            0     ~3,8 (elenco médio)  ~5,3 (elenco de craques)
```

Com elenco mediano só sai `corta pra dentro` — meia-lua exige drible ≥ 86 e vaca
exige técnica ≥ 88. É o comportamento certo: roleta é drible de craque, não de
lateral. Quem quiser ver muito giro joga com Brasil 1970.

## O gate

A previsão registrada era **números idênticos**, já que nenhuma rolagem nova é
consumida. 12 partidas, mesmas sementes:

```
                R18.71    R18.72
goals            1.83      1.83
xg               2.32      2.32
shots           17.42     17.42
corners          4.42      4.42
passes         374.33    374.33
fouls            9.92      9.92
```

Idênticos. Salto por quadro 0,550%, faixa acima de 18 m/s em 0,011% — sem
mudança. Navegador: sem `pageerror`, sem erro de console.

## Fica aberto

- `caneta` está em `_pickMove` mas ficou de fora da seleção por atributo (era
  alternativa do elástico); pode voltar com pose própria.
- as outras poses de drible (`body_feint`, `burst_touch`, `inside_cut`) existem
  e agora aparecem, mas o desenho delas é o mesmo corpo com base mais aberta —
  cada uma mereceria pose própria.
