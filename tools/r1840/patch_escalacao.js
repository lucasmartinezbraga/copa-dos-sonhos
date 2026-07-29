/* ============================================================================
 * R18.40 · O CRAQUE DE SLOT RARO DEIXA DE MORAR NO BANCO  (OS-02)
 * ----------------------------------------------------------------------------
 * `strictAutoLineup` ordena os candidatos a cada vaga assim:
 *
 *     .sort((a,b)=>a.tier-b.tier || (b.p.starter-a.p.starter)*3
 *                                 + (b.fit-a.fit)*.18 + (b.p.r-a.p.r))
 *
 * `tier` e a PRIMEIRA chave de um comparador em cascata: e um portao absoluto,
 * sem peso. Quem tem a vaga como slot primario (tier 0) ganha SEMPRE de quem a
 * tem como secundario (tier 1) — qualquer que seja a diferenca de qualidade.
 * De Bruyne (91, CAM primario, CM elegivel) perde a vaga de CM para Fellaini
 * (72, CM primario). A qualidade so e consultada como criterio de desempate
 * DENTRO do mesmo tier, quando ja nao decide mais nada.
 *
 * MEDIDO na R18.35, sobre 369 elencos x 17 formacoes = 69 003 vagas:
 *     vagas com reserva ELEGIVEL 6+ melhor .... 2 397 (3,47%)
 *     diferenca media nessas vagas ............ 14,3 pontos
 *
 * A CORRECAO: o tier deixa de ser portao e vira PENALIDADE somada ao mesmo
 * score que ja existia. Um jogador claramente melhor pode tomar a vaga no seu
 * slot secundario; o improviso continua caro, e caro de forma crescente.
 *
 *     tier 0 primario ....  0    (nada muda para quem e da posicao)
 *     tier 1 secundario ...  8    (~9 pontos de diferenca viram a vaga)
 *     tier 2 emergencia ... 18
 *     tier 3 mesma linha .. 40    (praticamente so se nao houver ninguem)
 *     tier 5 outra linha .. 90
 *
 * POR QUE ISSO NAO SOLTA O JOGO. `forbidden()` continua intacto: goleiro nunca
 * vai para a linha, zagueiro nunca vira atacante. E `bestFormationFor` conta
 * como fora-de-posicao apenas o que NAO esta na lista de elegiveis
 * (`!(l.p.elig||[]).includes(l.pos)`) — logo promover um elegivel melhor nao
 * aumenta a penalidade de improviso dela, e a escolha de formacao nao e
 * empurrada para um canto. A Ordem de Servico pediu que isso fosse verificado;
 * `diag_escalacao.js` mede a diversidade de formacao antes e depois.
 * ==========================================================================*/
const fs = require('fs'), crypto = require('crypto'), path = require('path');
const a = (n, d) => { const h = process.argv.slice(2).find(x => x.startsWith('--' + n + '=')); return h ? h.slice(n.length + 3) : d; };
const T1 = Number(a('t1', 8)), T2 = Number(a('t2', 18)), T3 = Number(a('t3', 40)), T5 = Number(a('t5', 90));

let src = fs.readFileSync(a('in', 'r1835.html'), 'utf8');
const applied = [];
function edit(id, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) { console.error('ABORTA [' + id + ']: ancora ' + n + 'x'); process.exit(1); }
  src = src.replace(from, to); applied.push(id);
}

edit('r1840-escalacao',
`.sort((a,b)=>a.tier-b.tier||(b.p.starter-a.p.starter)*3+(b.fit-a.fit)*.18+(b.p.r-a.p.r));`,
`.sort((a,b)=>{
        /* §R18.40 · O tier deixa de ser portao absoluto e vira penalidade.
           Antes, a primeira chave do comparador era a.tier-b.tier: quem tinha
           a vaga como slot primario ganhava de qualquer elegivel melhor, e a
           qualidade so desempatava dentro do mesmo tier. Medido: 2 397 vagas
           (3,47% de 69 003) tinham no banco um elegivel 6+ melhor, com 14,3
           pontos de diferenca media. Agora o improviso custa pontos em vez de
           vencer de graca — e continua caro o bastante para segurar o resto:
           forbidden() ja impede goleiro na linha e zagueiro no ataque. */
        const _pen=t=>t===0?0:t===1?${T1}:t===2?${T2}:t===3?${T3}:${T5};
        return (_pen(a.tier)-_pen(b.tier))+(b.p.starter-a.p.starter)*3+(b.fit-a.fit)*.18+(b.p.r-a.p.r);
      });`);

const ID = `  root.CDS_BUILD_ID='R18.35'; root.CDS_VERSION='5.29.0-R18.35';`;
if (src.split(ID).length - 1 === 1) {
  src = src.replace(ID, `  root.CDS_R1840_ESCALACAO=Object.freeze({version:'R18.40',label:'O CRAQUE ELEGIVEL SAI DO BANCO',tiers:[0,${T1},${T2},${T3},${T5}],
    note:'strictAutoLineup usava a.tier-b.tier como primeira chave de um comparador em cascata — um portao absoluto. Quem tinha a vaga como slot primario ganhava de qualquer elegivel melhor: De Bruyne (91, CAM primario, CM elegivel) perdia o CM para Fellaini (72). Medido em 369 elencos x 17 formacoes: 2 397 vagas (3,47%) com reserva elegivel 6+ melhor, diferenca media 14,3. Agora o tier e penalidade somada ao score, nao portao.'});
  root.CDS_BUILD_ID='R18.40'; root.CDS_VERSION='5.30.0-R18.40';`);
  src = src.replace(`  if(root.document)root.document.title='Copa dos Sonhos — R18.35';`, `  if(root.document)root.document.title='Copa dos Sonhos — R18.40';`);
  src = src.replace(`<title>Copa dos Sonhos — R18.35</title>`, `<title>Copa dos Sonhos — R18.40</title>`);
}

fs.writeFileSync(a('out', 'r1840.html'), src, 'utf8');
console.log('patches:', applied.join(', '));
console.log(path.basename(a('out', 'r1840.html')), '| tiers', [0, T1, T2, T3, T5].join('/'), '|', crypto.createHash('sha256').update(fs.readFileSync(a('out', 'r1840.html'))).digest('hex').slice(0, 12));
