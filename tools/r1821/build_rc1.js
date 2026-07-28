#!/usr/bin/env node
'use strict';
/* CONSTRUTOR DA R18.21-RC1
   -------------------------------------------------------------------------
   Regenera a candidata SEMPRE a partir da base R18.20 intocada:
     1. remove o bloco <script id="cds-r1819-tactical-authority">
     2. injeta as camadas aditivas listadas em LAYERS, na ordem
     3. carimba a identidade da RC1 por último
   A base nunca é editada. O resultado é reproduzível e hasheável. */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v == null ? true : v];
}));

const BASE = argv.base;
const OUT = argv.out;
const LAYER_DIR = argv.layers || __dirname;
if (!BASE || !OUT) { console.error('uso: --base="<html>" --out="<html>" [--layers=<dir>]'); process.exit(2); }

// Ordem importa: cada camada embrulha o que já está instalado abaixo dela.
/* A camada `layer_r1821_press_engagement.js` foi CONSTRUÍDA, MEDIDA e
   DESCARTADA — fica no diretório como registro do experimento, fora da build.
   Matriz 7×7, 49 partidas:
     MID+DEF: desarmes 4,59 -> 3,73, faltas 4,45 -> 4,14, laterais 4,53 -> 4,04,
              parkIdentity quebrou, spread de estilo 0,929 -> 1,286.
     só DEF:  desarmes 4,59 -> 5,00 e gols 2,41 -> 2,73, MAS faltas 4,45 -> 3,98
              e spread 0,929 -> 1,071.
   Nenhuma das duas é ganho líquido. O teto de 15,2 m da R18.5 no meio-campo é
   estrutural: soltá-lo tira o presser do bloco e ele passa a ser ultrapassado. */
/* `layer_r1821_lane_press.js` (segundo homem da pressão) também foi construída
   e MEDIDA, e está fora da build por enquanto. Matriz 7×7: escanteios
   0,98 -> 1,49 e gols 2,41 -> 2,55, MAS tentativas de desarme 9,22 -> 8,57,
   faltas 4,45 -> 3,94, laterais 4,53 -> 3,82 e spread de estilo
   0,929 -> 1,643. Diagnóstico correto (só um homem pressiona; a cobertura é
   quase sempre zagueiro; a sombra só age em campo próprio), execução ainda
   não aprovada. */
const LAYERS = [
  /* RESTAURA a lei do lateral (sem gol direto), que era da R18.18.3.1 mas
     morava dentro do bloco cds-r1819-tactical-authority e se perdeu quando
     removi aquela camada. Regressão detectada pelo usuário jogando. */
  { id: 'cds-r1821-throwin-law', file: 'layer_r1821_throwin_law.js' },
  { id: 'cds-r1821-post-recovery-decision', file: 'layer_r1821_post_recovery.js' },
  /* Aceita: escanteios 0,98 -> 1,41 na matriz 7×7. Escanteio é a métrica mais
     estável do probe (0,0% de deslocamento sozinha), logo o ganho é sinal.
     A queda de gols observada junto NÃO é critério: gols oscilam ~50% sozinhos
     nessa amostra. */
  { id: 'cds-r1821-shot-plausibility', file: 'layer_r1821_shot_plausibility.js' },
  /* Aceita com 147 partidas pareadas: tentativas de desarme 7,88 -> 12,93
     (+64%), desarmes 3,68 -> 6,22 (+69%), faltas 3,85 -> 5,36 (+39%), e os
     TRÊS gates de identidade de estilo passam (noDominantStyle vira PASS,
     ppgRange 1,262 -> 0,619). Custo: escanteios 1,44 -> 1,23, num gate que
     reprova de qualquer jeito. Integridade física MELHOR que a base: zero
     ticks acima de 11 m/s, pico 8,81 contra 10,25, saltos >1,5 m -29%. */
  { id: 'cds-r1821-press-anticipation', file: 'layer_r1821_press_anticipation.js' },
  /* Reparo de DADO, aprovado pelo usuário ("não faz sentido Pelé ter rating
     igual ao do Lukaku"). 76 jogadores dividiam FIN=99. Transformação monótona
     por posto com o overall como desempate; simulação deu ZERO inversões em
     177 afetados e 6.785 intocados. */
  { id: 'cds-r1821-respread-top', file: 'layer_r1821_respread_top.js' },
];

const BASE_SHA_ESPERADO = '11ab3fc32609f1a4cd87ea75437e27ce8ad491a4c8849c4c686f7c0a07314805';

const baseBytes = fs.readFileSync(BASE);
const baseSha = crypto.createHash('sha256').update(baseBytes).digest('hex');
if (baseSha !== BASE_SHA_ESPERADO) {
  console.error(`ABORTADO: a base nao e a R18.20 esperada.\n  esperado ${BASE_SHA_ESPERADO}\n  achado   ${baseSha}`);
  process.exit(3);
}

let html = baseBytes.toString('utf8');

// 1. remover a R18.19
const R1819 = '<script id="cds-r1819-tactical-authority">';
const R1820 = '<script id="cds-r1820-chance-intelligence">';
const i = html.indexOf(R1819), j = html.indexOf(R1820);
if (i < 0 || j < 0 || j <= i) { console.error('ABORTADO: marcadores r1819/r1820 nao localizados'); process.exit(4); }
const removidos = j - i;
html = html.slice(0, i) + html.slice(j);

/* 1b. PATCH CIRÚRGICO NA ISENÇÃO DE SEPARAÇÃO
   O motor empurra todo jogador para longe de companheiros a 5,5 m e
   adversários a 3,2 m (`tx += sepx*1.5`), e isenta apenas quem tem dever de
   bola. Como a grande área é o ponto mais lotado do campo, essa força expulsa
   atacantes justamente de onde o cruzamento vai cair — medido: 74,3% dos
   cruzamentos com a área vazia.
   O motor JÁ isenta o recebedor de uma bola em voo; esta linha estende a mesma
   isenção a quem está numa corrida de área assumida. Atacar cruzamento é ir
   para dentro do amontoado. `_resolveOverlaps` continua impedindo sobreposição
   física, então ninguém ocupa o mesmo espaço.
   É a alternativa honesta à pré-compensação, que era remendo aritmético. */
const ALVO_SEP = "(this.ball.traveling && this.ball.receiver === p);";
const NOVO_SEP = "(this.ball.traveling && this.ball.receiver === p) ||\n                         !!(p.__r1821BoxRun && p.__r1821BoxRun.ate > this.t);";
let patchesAplicados = 0;
if (html.indexOf(ALVO_SEP) >= 0) {
  html = html.replace(ALVO_SEP, NOVO_SEP);
  patchesAplicados++;
} else {
  console.error('AVISO: ancora da isencao de separacao nao encontrada — patch NAO aplicado');
}

/* 1b. PATCH CIRÚRGICO — alcance do goleiro em jogo aberto
   O motor usa contactRadius 3,0 no chute normal (linha 6114) mas 1,95 no chute
   de cruzamento rasteiro (5365) e no cabeceio (5401). Não há razão física: o
   braço do goleiro não encolhe porque a finalização veio de cabeça. O registro
   do projeto mostra que o alcance foi subido de 1,90 para 3,0 numa correção
   anterior e ela nunca propagou para essas duas rotas de jogo aberto.

   A consequência é grave e medida: quando o goleiro não alcança, o chute
   rasteiro NÃO tem caminho para gol nem para defesa — vai para fora, garantido.
   E é justamente essa rota que teria `lowCrossSaveCorner: 0.55`, ou seja, mais
   de metade das defesas viraria escanteio.

   As duas linhas têm texto idêntico, então o replace pega exatamente elas.
   Bola parada (falta 6752, pênalti 6824) fica em 1,95 de propósito: ali o
   goleiro está posicionado e a cobrança é desenhada para batê-lo. */
const ALVO_GK = "const st=this._gkInterceptTarget(gk,atk.x,atk.y,goalAim,shotSpeed,1.95);";
const NOVO_GK = "const st=this._gkInterceptTarget(gk,atk.x,atk.y,goalAim,shotSpeed,3.0);";
let patchesGk = 0;
while (html.indexOf(ALVO_GK) >= 0) { html = html.replace(ALVO_GK, NOVO_GK); patchesGk++; }
if (patchesGk !== 2) {
  console.error(`AVISO: esperava 2 patches de alcance do goleiro, apliquei ${patchesGk}`);
}

// 2. injetar camadas antes do fecho do body
const CLOSE = '</body></html>';
const closeAt = html.lastIndexOf(CLOSE);
if (closeAt < 0) { console.error('ABORTADO: </body></html> nao encontrado'); process.exit(5); }

let injecao = '';
const aplicadas = [];
for (const layer of LAYERS) {
  const p = path.join(LAYER_DIR, layer.file);
  const code = fs.readFileSync(p, 'utf8');
  injecao += `<script id="${layer.id}">\n${code}</script>\n`;
  aplicadas.push({ id: layer.id, file: layer.file, sha256: crypto.createHash('sha256').update(code).digest('hex') });
}

// 3. identidade por ultimo
const identidade = `<script id="cds-r1821rc1-build-meta">
(function(root){'use strict';
try{
  root.CDS_R1821RC1_BUILD=Object.freeze({
    version:'R18.21-RC1', baseline:'R18.20', label:'DEFESA, PRESSAO E ECOLOGIA',
    removed:Object.freeze(['cds-r1819-tactical-authority']),
    layers:Object.freeze(${JSON.stringify(LAYERS.map(l => l.id))}),
    note:'R18.19 removida por ablacao medida (n=49): -20% chutes, -26% tentativas de desarme, -36% faltas, e reprovacao dos 3 gates de identidade de estilo.'
  });
  root.CDS_BUILD_ID='R18.21-RC1'; root.CDS_VERSION='5.15.0-R18.21-RC1';
  if(root.document)root.document.title='Copa dos Sonhos — R18.21-RC1';
}catch(_){}
})(typeof window!=='undefined'?window:globalThis);
</script>
`;

html = html.slice(0, closeAt) + injecao + identidade + CLOSE + '\n';

fs.writeFileSync(OUT, Buffer.from(html, 'utf8'));
const outSha = crypto.createHash('sha256').update(Buffer.from(html, 'utf8')).digest('hex');

console.log(JSON.stringify({
  base: path.basename(BASE), baseSha256: baseSha,
  r1819RemovidaChars: removidos,
  patchesAlcanceGoleiro: patchesGk,
  patchesCirurgicos: patchesAplicados,
  camadas: aplicadas,
  saida: path.basename(OUT), saidaSha256: outSha,
  bytes: Buffer.byteLength(html, 'utf8')
}, null, 2));
