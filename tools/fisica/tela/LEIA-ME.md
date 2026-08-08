# Sondas de tela

A bateria (`tools/fisica/bateria.js`) carrega o bundle com
`vm.runInThisContext` e **não desenha nada**. Ela mede o jogo; não mede o que
o jogador vê. Foi por isso que a bola pingando atravessou uma ordem de serviço
inteira sem aparecer em métrica nenhuma.

Estas sondas sobem o `dist/index.html` num Chromium de verdade, entram numa
partida por `window.__quickMatch(40, 120)` e instrumentam `MatchSim.prototype`
de dentro da página.

Todas aceitam o caminho do bundle como primeiro argumento.

| sonda | responde |
|---|---|
| `pinga.js` | quantas vezes por minuto a bola deixa o gramado, e a que altura |
| `rasteira.js` | de onde vem o ápice de um passe rasteiro (`z₀ + v_z²/2g`) |
| `salto.js` | descontinuidade: bola mudando de lugar mais do que a velocidade permite |
| `descida.js` | separa descida legítima em voo de teletransporte de altura |
| `forma.js` | forma de equipe: comprimento e largura do bloco, apoio ao portador |
| `caixa.js` | tarja preta: proporção do canvas contra a caixa, em 4 viewports |
| `olhar.js` | fotografa o campo, para olhar em vez de medir |

```bash
node tools/fisica/tela/pinga.js dist/index.html 70 3
node tools/fisica/tela/forma.js dist/index.html 60
node tools/fisica/tela/caixa.js dist/index.html
```

O Playwright vive fora do projeto neste ambiente; as sondas apontam direto para
`/opt/node22/lib/node_modules/playwright`. Se mudar de máquina, é essa linha do
`require` que precisa mudar.

Medições desta família estão em `reports/OS-203-a-bola-para-de-pingar.md`.
