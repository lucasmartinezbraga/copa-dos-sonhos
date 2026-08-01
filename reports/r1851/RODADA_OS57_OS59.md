# RODADA OS-57 / OS-58 / OS-59 — foco em animação

## OS-57 · a câmera já existia (correção de uma afirmação minha)

Eu disse que animação legível exigiria "câmera que segue a bola, uma feature de
porte". **Errado duas vezes.** A câmera existe, está pronta, e é desligada numa
linha (`:13602`):

```js
const desktopFullField = window.matchMedia('(min-width: 900px)').matches;
```

O comentário do próprio código: *"o jogador NÃO vê o campo inteiro; vê a AÇÃO,
como uma transmissão de TV"*. Eu fotografei em 1400×900 — desktop — que é
exatamente o caso ignorado. Em 390×844 os bonecos sempre estiveram grandes.

Ligada no desktop com zoom 1,30. O atleta foi de ~20 px para ~35 px de altura, e
os 2,05 m de separação mínima — que valiam ~19 px, quase a largura do boneco —
passaram a valer bem mais. **Não precisei tocar na separação.**

## OS-58 · ciclo de corrida de verdade

Achado ampliando o boneco (zoom 3,2, densidade 3). Duas causas do "deslizar":

1. **Os braços eram fixos.** Dois retângulos arredondados em posição constante,
   sem nenhuma dependência da passada. Braço parado é o que mais denuncia boneco
   deslizando — no futebol o braço balança em contrafase com a perna.
2. **A perna só subia e descia**, por `r*.20` — com `r ≈ 30 px` são 6 px de
   diferença entre as duas pernas. Sem tesoura.

Agora o mesmo `sw = sin(gait) × amp` que já alternava as pernas move também as
pernas em X (tesoura), com amplitude vertical maior, e os braços em contrafase
em X e Y. A subida do corpo por passada foi de `r*.05` para `r*.09`.

Nada de estado novo, evento novo ou motor: é o relógio de passada que já
existia, aplicado onde faltava.

## OS-59 · o cabeceio parava de ser atropelado — e o culpado era eu

A revisão deixou "cabeceio em 50%" em aberto e eu disse que não resolveria por
palpite, porque havia duas causas opostas possíveis. O censo separou:

```
header_clear   12 eventos -> 100,0% com pose de cabeceio
header_shot    12 eventos ->   0,0%
   estado visto no lugar:  shot_prepare  em 12 de 12
```

Não era fiação faltando. Era **sobrescrita**, e o autor sou eu: na OS-46 pus
`if(kind==='shot') pede(o,'shot_prepare')` em `_startTravel` para o chute sempre
ter pose. **Cabeceio é um voo de chute** — o pedido chegava logo depois do
`header` e atropelava.

Agora quem cabeceou fica marcado por 0,6 s e o pedido de chute respeita a marca.

## Medido

```
cobertura por evento    R18.77   R18.78
chute                   100,0%   100,0%
defesa do goleiro       100,0%   100,0%
drible                  100,0%   100,0%
bloqueio                100,0%   100,0%
cabeceio                 50,0%   100,0%
```

Motor, 12 partidas, mesmas sementes: `goals 1.67 · xg 2.48 · shots 22.42 ·
corners 6.58 · passes 461.83` — **idênticos** em R18.76, R18.77 e R18.78. As três
rodadas são de desenho e câmera, não de simulação.

Navegador: sem `pageerror`, sem erro de console.

## Fica aberto

- **sobreposição**: medida na captura, a circunferência central dá 8,2 px/m e o
  boneco tem ~20 px de largura = **2,4 m**, contra ~0,6 m de um jogador real. O
  sprite é ~4× mais largo que a escala. Encolher resolve a sobreposição e destrói
  a legibilidade que a câmera acabou de ganhar — é escolha de estilo, não defeito.
- as poses de drible (`body_feint`, `burst_touch`, `inside_cut`) existem e são
  pedidas, mas desenham o mesmo corpo com base mais aberta; cada uma mereceria
  desenho próprio.
