# O que colar numa IA

Três prompts prontos. Copie o bloco inteiro, cole, e mande.

Eles funcionam em qualquer agente com acesso a terminal (Claude Code, Cursor,
Codex, agente próprio). Não dependem de o agente ter lido nada antes: os
próprios comandos entregam o contexto.

---

## 1 · Prompt geral — "pegue o próximo defeito e conserte"

> Você vai trabalhar no Copa dos Sonhos, um simulador de futebol. O projeto tem
> um catálogo de 34 defeitos investigados, com endereço de código, evidência
> medida e critério numérico de aceite.
>
> **Comece rodando exatamente estes três comandos, nesta ordem:**
>
> ```bash
> bash tools/doutor.sh                  # o ambiente esta pronto?
> cat reports/LEIA-PRIMEIRO.md          # 2 paginas — leia inteiro
> python3 tools/defeito.py --proximo    # o que fazer agora
> ```
>
> Depois carregue o defeito recomendado com `python3 tools/defeito.py <ID>` e
> trabalhe nele.
>
> **Quatro regras que não se negociam:**
>
> 1. **Antes de editar qualquer método, descubra quem é o dono.** Este projeto
>    tem 362 sobrescritas de método em 60 arquivos de camada empilhados sobre
>    `MatchSim.prototype`. Uma camada pode substituir um método e **não chamar a
>    versão de baixo** — nesse caso editar o motor não faz nada. Isso já
>    aconteceu **cinco vezes**. Rode `node tools/fisica/pilha.js dist/index.html 14`
>    e leia o campo `DONO` da ficha do defeito.
> 2. **Edite `src/`, nunca `dist/`.** `dist/index.html` é gerado.
> 3. **Meça antes e depois:** `bash tools/aceitar.sh --antes` antes de editar,
>    `bash tools/aceitar.sh --depois` depois. Para mudanças que não devem mudar
>    comportamento, use `--depois --identico`.
> 4. **A bateria não vê a tela.** Se mexeu em trajetória, rode também
>    `node tools/fisica/tela/pinga.js dist/index.html 60`; se mexeu em
>    movimentação, `node tools/fisica/tela/forma.js dist/index.html 90`.
>
> **Não faça commit se `aceitar.sh --depois` reprovar.** Se ele reprovar e o
> movimento da métrica era o objetivo declarado da sua mudança, diga isso
> explicitamente no relatório e no commit — mas não esconda.
>
> **Marque toda afirmação sua** com `[LIDO]`, `[MEDIDO]` ou `[HIPÓTESE]`. Há 11
> hipóteses abertas no documento; não as trate como fato.
>
> Ao terminar, me diga: o que mudou, quais métricas se moveram e quanto, e o
> que você **não** fez e por quê.

---

## 2 · Prompt dirigido — "conserte o defeito X"

Troque `D25` pelo ID que você quiser.

> Você vai consertar o defeito **D25** no Copa dos Sonhos.
>
> ```bash
> bash tools/doutor.sh
> cat reports/LEIA-PRIMEIRO.md
> python3 tools/defeito.py D25          # ficha, codigo atual e a secao do documento
> ```
>
> A ficha traz o **dono real** do método, as camadas que interceptam, a
> evidência medida, o critério numérico de aceite, as dependências e o risco.
> O código vem localizado por âncora de texto — se ele mudou desde que a
> investigação foi escrita, o comando te avisa.
>
> **Confirme o dono antes de editar:**
> `node tools/fisica/pilha.js dist/index.html 14`
>
> Ciclo obrigatório:
>
> ```bash
> bash tools/aceitar.sh --antes
> # ... edite src/, NUNCA dist/ ...
> bash tools/aceitar.sh --depois
> ```
>
> Só faça commit se o critério de aceite da ficha for atendido. Se a medição
> contrariar a hipótese do documento, **escreva isso** — resultado negativo é
> resultado, e o projeto tem quatro deles documentados no Volume VII.

---

## 3 · Prompt de investigação — "audite a área que ninguém leu"

A maior mancha cega do projeto. Use este quando quiser avançar o conhecimento
em vez de consertar algo já catalogado.

> Você vai auditar a **máquina de bola parada** do Copa dos Sonhos. Ela é a
> maior área não lida da investigação: `_freeKick`, `_penalty`, `_setCorner` no
> motor, mais de 1.000 linhas de camadas de reinício (33, 49, 63, 64, 65, 79), e
> nada disso foi lido.
>
> ```bash
> bash tools/doutor.sh
> cat reports/LEIA-PRIMEIRO.md
> sed -n '1,60p' reports/INVESTIGACAO-COMPLETA-2026-08.md   # o bloco para agentes
> ```
>
> Leia a **seção 1.6 a 1.11** do documento (os dez padrões de composição) antes
> de começar: são as formas recorrentes de defeito neste código, e a expectativa
> registrada é que a bola parada tenha mais instâncias dos mesmos dez, não uma
> categoria nova. **Isso é hipótese, não medição — teste, não confirme.**
>
> ```bash
> node tools/fisica/pilha.js dist/index.html 14    # quais sobrescritas de bola parada rodam
> node tools/fisica/narrar.js dist/index.html      # leia uma partida como futebol
> ```
>
> Entregue defeitos no mesmo formato do catálogo: endereço com **âncora de
> texto única**, código atual transcrito, evidência **medida**, mudança
> proposta, quem intercepta, risco e critério numérico de aceite. Acrescente-os
> a `tools/defeitos.py` e rode `python3 tools/defeitos.py` para validar.
>
> **Não proponha nada que você não mediu.** Marque `[LIDO]`, `[MEDIDO]` ou
> `[HIPÓTESE]`.

---

## O que a IA vai encontrar quando rodar os comandos

| comando | devolve | tamanho |
|---|---|---|
| `bash tools/doutor.sh` | 19 verificações de ambiente | ~40 linhas |
| `cat reports/LEIA-PRIMEIRO.md` | as 4 regras + o ciclo | ~230 linhas |
| `python3 tools/defeito.py --proximo` | o que fazer agora | ~15 linhas |
| `python3 tools/defeito.py D08` | ficha + código atual + seção | ~260 linhas |
| `bash tools/aceitar.sh --depois` | build, testes, 300 partidas, 2 placares | ~45 linhas |

O documento completo tem 4.950 linhas. **A IA não precisa dele para trabalhar** —
só para entender o raciocínio por trás de um defeito específico, e mesmo aí
`defeito.py` já extrai a seção certa.

## Uma advertência sobre o tamanho da amostra

`aceitar.sh` usa 300 partidas por padrão. Dá para acelerar com
`PARTIDAS=40 bash tools/aceitar.sh --antes`, mas **só para testar o encanamento**:
com n = 40 o placar de design oscila entre 11/13 e 12/13 por puro acaso
amostral, e o critério de 2 SE fica largo demais para detectar regressão.

**Aceitação de verdade é sempre com 300.**

## Se a IA disser que terminou

Peça três coisas antes de acreditar:

1. **A saída do `aceitar.sh --depois`**, colada, não resumida.
2. **Quais métricas se moveram e quanto**, em SE — não "melhorou".
3. **O que ela não fez e por quê.**

O projeto tem quatro tentativas revertidas documentadas (Volume VII). Duas
delas foram revertidas justamente porque a medição contrariou a expectativa. Uma
IA que reporta sucesso sem números está fazendo o que este projeto passou vinte
releases fazendo.
