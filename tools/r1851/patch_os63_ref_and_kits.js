#!/usr/bin/env node
'use strict';
/*
 * OS-63 · O ARBITRO ENTRA EM CAMPO E CADA SELECAO GANHA CAMISA
 * -------------------------------------------------------------
 * Duas ausencias que a camera fechada tornou obvias.
 *
 * 1) NAO HA ARBITRO. Vinte e dois atletas e nenhum oficial. A palavra "arbitro"
 *    so aparece em COMENTARIOS do codigo (":23772", ":23804"), descrevendo o
 *    que ele faria — nunca em desenho. Num enquadramento de transmissao a
 *    ausencia salta.
 *
 * 2) AS CAMISAS SAO BLOCOS DE COR CHAPADA. `torsoGrad` (:19544) pinta o tronco
 *    com um gradiente da cor do time e nada mais. Belgica e Inglaterra sao
 *    "amarelo" e "vermelho" — sem listra, sem faixa, sem identidade.
 *
 * EDITS
 *
 * A) ARBITRO. Uma figura de preto desenhada pelo MESMO `CDS_F25D.body`, com
 *    posicao propria mantida na camada de apresentacao. Ele persegue um ponto a
 *    ${'${DIST}'} m da bola, deslocado para o lado de dentro do campo e um pouco
 *    atras da jogada — a diagonal que arbitro corre — com suavizacao de
 *    ${'${SUAVE}'} por quadro, e fica preso dentro das linhas. Nao entra na
 *    simulacao: nao ocupa espaco, nao intercepta, nao aparece em nenhuma
 *    estatistica. E cenario que corre.
 *
 * B) CAMISAS. O padrao sai de um hash da PROPRIA COR do time, entao todo atleta
 *    da mesma equipe recebe o mesmo desenho e a escolha e estavel entre
 *    partidas, sem depender de dado novo:
 *      0 · lisa (como hoje)      1 · listras verticais
 *      2 · argolas horizontais   3 · faixa diagonal
 *    O padrao e pintado por cima do gradiente, recortado no proprio tronco, com
 *    a cor escura do time — entao continua legivel a distancia e nunca briga
 *    com o numero.
 *
 * PREVISAO: numeros do motor IDENTICOS. Nada aqui existe para a simulacao.
 */
const fs=require('fs'),crypto=require('crypto'),path=require('path');
const arg=(n,d)=>{const h=process.argv.slice(2).find(x=>x.startsWith('--'+n+'='));return h?h.slice(n.length+3):d;};
const input=arg('in','dist/COPA DOS SONHOS - R18.80 - JOGO DE FUTEBOL.html');
const output=arg('out','dist/COPA DOS SONHOS - R18.81 - JOGO DE FUTEBOL.html');
const DIST=arg('dist','11'), SUAVE=arg('suave','.045');
let src=fs.readFileSync(input,'utf8');
const applied=[];
function edit(id,from,to){
  const c=src.split(from).length-1;
  if(c!==1){console.error('ABORTA ['+id+']: ancora '+c+'x');process.exit(1);}
  src=src.replace(from,to);applied.push(id);
}

/* A ── o arbitro ------------------------------------------------------------- */
edit('os63-referee',
`    window.CDS_F25D.ball(ctx, { gx: cx(b.x), gy: cy(b.y), z: b.z || 0, tv: _tv });`,
`    /* OS-63 · ARBITRO. Nao existia nenhum oficial em campo — a palavra so
       aparecia em comentarios. Ele corre a diagonal, a ${DIST} m da bola e um
       pouco atras da jogada, e e desenhado pelo mesmo body() dos atletas. Nao
       entra na simulacao. */
    try{
      if(!window.__cdsRef) window.__cdsRef = { x: b.x, y: b.y };
      const _rf = window.__cdsRef;
      /* o estado de render entrega x,y NORMALIZADOS (cx/cy recebem 0..1);
         usar metros aqui jogava o arbitro para fora do quadro. */
      const _lado = b.y < .5 ? 1 : -1;
      const _rtx = Math.max(.03, Math.min(.97, b.x - 4/105));
      const _rty = Math.max(.05, Math.min(.95, b.y + _lado * (${DIST}/68)));
      _rf.x += (_rtx - _rf.x) * ${SUAVE};
      _rf.y += (_rty - _rf.y) * ${SUAVE};
      let _rx2 = cx(_rf.x), _ry2 = cy(_rf.y), _rs = 1;
      if (window.CDS_F25D) { const _rp = window.CDS_F25D.project(_rx2, _ry2); _rx2 = _rp.x; _ry2 = _rp.y; _rs = _rp.s; }
      const _rr = 11 * _rs;
      ctx.save(); ctx.globalAlpha = .22;
      ctx.beginPath(); ctx.ellipse(_rx2, _ry2 + _rr*.98, _rr*.8, _rr*.32, 0, 0, Math.PI*2);
      ctx.fillStyle='#000'; ctx.fill(); ctx.restore();
      window.CDS_F25D.body(ctx, { x:_rx2, y:_ry2, r:_rr, pc:'#1b1f27', gkC:'#1b1f27',
        isGK:false, divePose:false, hasBall:false, key:'ARBITRO', act:'', pose:'', wave:0 });
      ctx.restore && 0;
    }catch(_){}
    window.CDS_F25D.ball(ctx, { gx: cx(b.x), gy: cy(b.y), z: b.z || 0, tv: _tv });`);

/* B ── camisa com padrao ------------------------------------------------------ */
edit('os63-kit-pattern',
`    ctx.fillStyle = torsoGrad(ctx, jersey, lite, dark, r);
    rr(ctx, -r * .56, -r * .52, r * 1.12, r * .92, r * .26); ctx.fill();`,
`    ctx.fillStyle = torsoGrad(ctx, jersey, lite, dark, r);
    rr(ctx, -r * .56, -r * .52, r * 1.12, r * .92, r * .26); ctx.fill();
    /* OS-63 · a camisa era um bloco de cor chapada para toda selecao. O padrao
       sai de um hash da PROPRIA COR do time, entao e igual para os onze e
       estavel entre partidas, sem depender de dado novo. */
    if (!o.isGK) {
      let _kh = 0; const _ks = String(jersey);
      for (let _i = 0; _i < _ks.length; _i++) _kh = (_kh * 31 + _ks.charCodeAt(_i)) | 0;
      const _kind = Math.abs(_kh) % 4;
      if (_kind) {
        ctx.save();
        rr(ctx, -r * .56, -r * .52, r * 1.12, r * .92, r * .26); ctx.clip();
        ctx.fillStyle = dark; ctx.globalAlpha = .55;
        if (_kind === 1) {                       // listras verticais
          for (let _v = -r * .56; _v < r * .56; _v += r * .30)
            ctx.fillRect(_v, -r * .52, r * .15, r * .92);
        } else if (_kind === 2) {                // argolas
          for (let _hh = -r * .52; _hh < r * .40; _hh += r * .30)
            ctx.fillRect(-r * .56, _hh, r * 1.12, r * .15);
        } else {                                 // faixa diagonal
          ctx.beginPath();
          ctx.moveTo(-r * .56, r * .40); ctx.lineTo(r * .10, -r * .52);
          ctx.lineTo(r * .40, -r * .52); ctx.lineTo(-r * .26, r * .40);
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      }
    }`);

fs.writeFileSync(output,src,'utf8');
console.log('patches:',applied.join(', '),'| dist='+DIST,'suave='+SUAVE);
console.log(path.basename(output),'| sha256',crypto.createHash('sha256').update(src).digest('hex'));
