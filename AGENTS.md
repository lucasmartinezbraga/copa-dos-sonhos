# AGENTS.md — instruções para agentes neste repositório

Copa dos Sonhos é um simulador de futebol web. Este arquivo é o contrato de
trabalho. Se você é um agente, leia-o inteiro antes de tocar em qualquer coisa.

## Comece por aqui, sempre

```bash
bash tools/doutor.sh                  # o ambiente esta pronto?
cat reports/LEIA-PRIMEIRO.md          # 2 paginas — as 4 regras
python3 tools/defeito.py --proximo    # o que fazer agora
```

Existe uma investigação de 34 defeitos com endereço de código, evidência medida
e critério numérico de aceite. **Não leia o documento inteiro** (4.950 linhas):
use `python3 tools/defeito.py <ID>`, que devolve a ficha, o código como está
agora e só a seção relevante.

## As quatro regras que não se negociam

### 1. Descubra quem é o dono do método ANTES de editar

```bash
node tools/fisica/pilha.js dist/index.html 14
```

O projeto tem **362 sobrescritas de método** em 60 arquivos de camada,
empilhadas sobre `MatchSim.prototype`. Uma camada pode substituir um método
**sem chamar a versão de baixo** — nesse caso o código do motor não roda, e
editá-lo não faz nada.

**Isso já aconteceu cinco vezes**, cada uma custando uma rodada de medição:

| o que foi editado | quem interceptava |
|---|---|
| arrasto da R13 | consumidor no mesmo quadro |
| `if (p === presser)` em `_defendTarget` | camada 17 responde por todos os ramos |
| `b.z = 0.12` "decorativo" | virou física quando o integrador ligou |
| `_looseBall` | camada 08 converte em desvio e **não chama o motor** |
| `decideT` | camada 17 reescreve todo quadro |

Nas duas últimas a ferramenta já existia e não foi usada. Na **sexta** (D25) ela
foi usada, respondeu VIVA — e estava certa: o método era alcançado, mas a linha
editada não. **VIVA é propriedade do método, não de cada linha dele.** Quando o
alvo é uma linha, instrumente aquela linha (`tools/fisica/ramo-d25.js` é o
modelo).

### 2. Edite `src/`, nunca `dist/`

`dist/index.html` é gerado por `python3 tools/build.py`. Qualquer edição direta
é apagada no próximo build.

### 3. Meça antes e depois

```bash
bash tools/aceitar.sh --antes      # antes de editar
bash tools/aceitar.sh --depois     # build, testes, 300 partidas, 2 placares
bash tools/aceitar.sh --depois --identico   # p/ mudancas que NAO devem mudar nada
```

O critério: uma métrica **se moveu** quando |Δ| ≥ 2 × SE. E a regra que já
reprovou uma mudança: **mover 2 SE para pior uma métrica que você não declarou
que ia mexer reprova a mudança**, mesmo que o alvo declarado tenha melhorado.

### 4. A bateria não vê a tela

`tools/fisica/bateria.js` roda em `vm.runInThisContext` e não desenha nada. A
bola quicando 54 vezes por minuto de jogo atravessou uma versão inteira sem
aparecer em nenhuma das 14 métricas.

- mexeu em **trajetória** → `node tools/fisica/tela/pinga.js dist/index.html 60`
- mexeu em **movimentação** → `node tools/fisica/tela/forma.js dist/index.html 90`
- **sempre** → `node tests/browser_smoke.js` é o único teste que prova que o
  jogo sobe num navegador de verdade

## Armadilha de escopo

O core é uma IIFE. São globais e podem ser usados direto numa camada:

```
facet   chance   R   clamp   FL   FW   getAttr   lerp   D   srand
```

**`CAL` não é.** Numa camada, leia a calibração por `ENGINE_CALIBRATION`. Um
`CAL.` dentro de `src/scripts/layers/` pode passar pela bateria e quebrar só no
navegador.

## Convenção de confiança

Marque toda afirmação que você escrever:

- `[LIDO]` — li o código
- `[MEDIDO]` — rodei e contei
- `[HIPÓTESE]` — inferência, pode estar errada

Há **11 hipóteses abertas** na seção 8.5 da investigação. Não as cite como fato.

## Estrutura

```
src/scripts/          9 modulos do core, na ordem obrigatoria
src/scripts/layers/   82 camadas empilhadas (uma por bloco <script>)
src/styles/           CSS
tools/build.py        remonta dist/index.html a partir de src/
tools/verify.py       sintaxe dos 89 blocos + reprodutibilidade
tools/doutor.sh       o ambiente esta pronto?
tools/aceitar.sh      o unico comando que decide se uma mudanca entra
tools/defeito.py      carrega UM defeito (ficha + codigo atual + secao)
tools/defeitos.py     gera e VALIDA o indice; falha se um endereco envelhecer
tools/comparar.py     aplica o criterio de 2 SE
tools/fisica/         bateria, pilha, narrador, sondas, calibrador
tools/fisica/tela/    7 sondas em Chromium real
reports/              a investigacao, os laudos e as medicoes
```

## Ordem dos módulos do core (respeite no manifesto)

1. `00-head-bootstrap.js` · 2. `10-data.js` · 3. `20-core.js` (calibração) ·
4. `30-tactics.js` · 5. `40-match-engine-and-manager-ai.js` (motor, 5.251
linhas) · 6. `50-tournament.js` · 7. `60-ui-flow.js` ·
8. `70-game-runtime-and-rendering.js`

## Como adicionar uma camada nova

1. Crie o arquivo em `src/scripts/layers/`
2. Acrescente o marcador `/*__CDS_BLOCK_N__*/` em `src/index.template.html`
3. Registre o bloco em `manifests/build-manifest.json`
4. Build + verify

**A ordem importa:** camada de número maior roda **por fora**. Se a sua não
chamar a de baixo, tudo o que as anteriores escreveram naquele método deixa de
existir.

**Toda camada nova deve publicar contadores por ramo.** Uma camada sem contador
é invisível — foi assim que o defeito D09 ficou anos sem ser detectado, e foi o
contador da camada 45 que permitiu medi-lo em vinte minutos.

## Git

- Branch principal: `main`
- Commits descritivos, padrão convencional
- **Não faça commit se `aceitar.sh --depois` reprovar**

## O que este projeto aprendeu do jeito caro

**Número decorativo vira número físico quando o integrador liga.** `b.z = 0.12`
existiu por versões só para desenhar. No dia em que a integração numérica
entrou, virou altura inicial real e o passe rasteiro passou a quicar.

**Quando aumentar um recurso piora o resultado, o modelo está usando o recurso
do jeito errado.** Subir a envergadura do goleiro de 1,05 para 1,45 **piorou** o
jogo — e foi esse resultado invertido que revelou a causa real.

**Resultado negativo é resultado.** Duas das quatro tentativas da última série
foram revertidas e estão documentadas com o mesmo cuidado das que deram certo.
Uma taxa de acerto de 50% é saudável quando se mede; o perigo é a taxa de 100%
de quem não mede.

---

**Investigação completa:** `reports/INVESTIGACAO-COMPLETA-2026-08.md`
**Briefing de 2 páginas:** `reports/LEIA-PRIMEIRO.md`
**Prompts prontos:** `reports/PROMPT-PARA-IA.md`
**Índice legível por máquina:** `reports/defeitos.json`
