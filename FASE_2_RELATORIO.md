# Copa dos Sonhos — Fase 2 concluída

## Objetivo

Criar uma camada de dados canônica e validável para posições, atributos, goleiros, perfis e traits, sem misturar essa lógica com a interface e sem abandonar o HTML autocontido.

## Entregas

### Banco V3

Todos os **7.739 jogadores** agora recebem:

- posição primária;
- posições secundárias;
- improvisações emergenciais controladas;
- ficha persistente de 45 atributos;
- perfil específico de goleiro quando aplicável;
- pé dominante e pé fraco;
- altura e perfil corporal de simulação;
- traits comportamentais;
- funções naturais;
- proveniência e avisos de qualidade.

### Correções estruturais

Foram aplicadas **245 correções de posição** com origem registrada. A camada também corrige lotes estruturalmente deslocados e impede que um goleiro seja usado na linha ou que um jogador de linha ocupe o gol.

### Traits

- jogadores com traits legados ou ampliados: **83,33%**;
- jogadores com traits comportamentais: **86,06%**.

### Auditoria completa de escalações

Foram testadas **13.284 escalações**, cobrindo todas as seleções, formações e variações, num total de **146.124 vagas**.

| Classificação | Quantidade | Percentual |
|---|---:|---:|
| Posição exata | 89.217 | 61,06% |
| Posição secundária | 24.660 | 16,88% |
| Emergencial declarada | 22.984 | 15,73% |
| Mesma linha | 7.660 | 5,24% |
| Ponte entre linhas adjacentes | 1.603 | 1,10% |
| Cruzamento absurdo DEF ↔ ATA | 0 | 0,00% |

Resultados obrigatórios:

- erros do banco: **0**;
- elencos sem goleiro: **0**;
- escalações com quantidade inválida de goleiros: **0**;
- jogadores ausentes no onze: **0**;
- cruzamentos absurdos entre defesa e ataque: **0**.

## Integração com o motor

`getAttr`, `attr8` e `autoLineup` agora utilizam a camada V3. Um smoke test executou aproximadamente 42 minutos simulados com 22 jogadores, sem coordenadas inválidas, atributos ausentes ou goleiros incorretos.

## Transparência dos dados

A fase resolve a estrutura técnica; ela não transforma inferência em fato histórico. Pé e altura não curados são marcados como estimativas de simulação. O campo `historicallyVerified` permanece falso até uma futura curadoria individual baseada em fontes.

Os atributos V3 partem dos oito fundamentos do banco legado, mas são persistidos e diferenciados por atributo e jogador. Isso reduz clones matemáticos e permite que o motor use concentração, compostura, antecipação, primeiro toque, equilíbrio, decisões e atributos de goleiro separadamente.

## Critérios de conclusão

- schema V3 aplicado a 100% dos jogadores;
- 100% dos jogadores com posição primária e perfil;
- 100% dos goleiros com ficha própria;
- 13.284 escalações validadas;
- 0 erro estrutural;
- integração do motor aprovada;
- abertura no Chromium aprovada;
- build final autocontido.

## Próxima fase

A Fase 3 é o laboratório de simulação e calibração em massa: distribuição de placares, gols, xG, chutes, estilos, formações, bolas paradas, fadiga e regressão entre versões.
