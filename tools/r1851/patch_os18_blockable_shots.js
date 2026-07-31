#!/usr/bin/env node
'use strict';
/*
 * OS-18 · METADE DOS CHUTES ERA IMBLOQUEAVEL
 * ------------------------------------------
 * CANDIDATA COMPORTAMENTAL. NAO PROMOVIDA.
 *
 * A OS-05B reprovou a propria hipotese dela: a supressao geometrica de
 * escanteio soma 1,06/partida contra uma lacuna de 2,06 ate o piso do ECO-05.
 * Nao cobre. O censo mostrou onde esta o buraco — `causa clearance` 1,31 contra
 * `causa block` 0,25. No futebol real o chute bloqueado e a maior fonte de
 * escanteio; aqui ele quase nao existe.
 *
 * MEDIDO na R18.51: 14,38 chutes/partida, e apenas 0,13 evento `blocked`.
 * `CAL.shooting.blockedShare` (:2766) e 0,18, o que deveria alocar ~2,6.
 *
 * A causa e estrutural: a fatia de bloqueio esta ANINHADA dentro do ramo em
 * que o goleiro alcanca o chute. Em `:6139`, quando `_gkInterceptTarget`
 * devolve null, o codigo vai direto para gol / escanteio-ou-tiro-de-meta por
 * sorteio / erro — sem nenhuma chance de bloqueio. E `_gkInterceptTarget`
 * devolve null em 48,3% dos chutes (medido).
 *
 * Ou seja: quase metade dos chutes nao pode ser bloqueada por um defensor, e
 * o motivo e a posicao do GOLEIRO. Isso nao tem sentido futebolistico — o
 * bloqueio depende de haver um defensor na linha do chute, nao do alcance do
 * goleiro.
 *
 * Este patch da ao ramo `!saveReachable` a mesma tentativa de bloqueio FISICO
 * que o outro ramo ja tem: procura o defensor mais proximo da linha do chute e,
 * se ele estiver a 2,2 m ou menos, o bloqueio acontece de verdade — com
 * trajetoria, contato validado e desfecho pelo mesmo `CAL.restarts.
 * shotBlockCorner`. Sem defensor na linha, nada muda em relacao a hoje.
 *
 * O escanteio resultante nasce de bloqueio fisico REAL, entao passa pelas
 * camadas R18.18.2 (:21763) e R18.18.3 (:22050) como bloqueio provado, em vez
 * de ser recusado como `unprovenCornerCalls`.
 *
 * NAO ha bonus de xG, velocidade ou fisica. Consome uma rolagem nova de RNG
 * (`chance(blockedShare)`), entao a comparacao pareada diverge por caos.
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find(x => x.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const input = arg('in', 'dist/COPA DOS SONHOS - R18.50 - PRESERVAR ENERGIA.html');
const output = arg('out', 'dist/COPA DOS SONHOS - R18.50 - OS18 BLOQUEIO.html');
let src = fs.readFileSync(input, 'utf8');
const applied = [];

function edit(id, from, to) {
  const count = src.split(from).length - 1;
  if (count !== 1) {
    console.error('ABORTA [' + id + ']: ancora ' + count + 'x');
    process.exit(1);
  }
  src = src.replace(from, to);
  applied.push(id);
}

edit(
  'os18-block-when-keeper-unreachable',
  `      if(!saveReachable){
        const _edge=clamp((atk-gkF)/100,-.35,.55);`,
  `      if(!saveReachable){
        /* OS-18 · o bloqueio nao depende do alcance do goleiro. Mesma busca de
           defensor na linha do chute do ramo alcancavel (:6165), mesmo raio de
           2,2 m, mesmo desfecho por CAL.restarts.shotBlockCorner. Sem defensor
           na linha, nada muda. */
        if(chance(CAL.shooting.blockedShare)){
          const _os18Def=this.teams[1-o.team].players.filter(p=>!p.red&&!p.isGK);
          let _os18B=null,_os18L=99,_os18T=null;
          for(const d of _os18Def){
            const t=clamp(this._projT(o.x,o.y,g.x,g.y,d.x,d.y),0,1);
            if(t<.12||t>.88)continue;
            const px=lerp(o.x,g.x,t),py=lerp(o.y,g.y,t),ld=D(d.x,d.y,px,py);
            if(ld<_os18L){_os18L=ld;_os18B=d;_os18T={x:px,y:py};}
          }
          if(_os18B&&_os18L<=2.2){
            this._startTravel(o,_os18T,'shot',()=>{
              const _cv=this._physicalContactValid(_os18B,2.05,this.ball.z);
              if(!_cv.ok){
                if(this.visualIntegrity)this.visualIntegrity.failedContacts++;
                this._emit('visual_contact_failed',{kind:'block',by:_os18B,distance:_cv.horizontal});
                this._looseBall(this.ball.x,this.ball.y);
                return;
              }
              this._recordVisualContact('block',_os18B,this.ball.x,this.ball.y,{distance:_cv.horizontal,z:this.ball.z,maxZ:_cv.maxZ,surface:_cv.surface});
              this._emit('blocked',{by:_os18B,contact:{x:this.ball.x,y:this.ball.y,distance:_cv.horizontal}});
              if(chance(CAL.restarts.shotBlockCorner))this._setCorner(o.team);
              else this._looseBall(this.ball.x,this.ball.y);
            },null,'shot',{outcome:'block',actor:_os18B,contactRadius:2.05});
            o._throughReceiverUntil=0;
            return;
          }
        }
        const _edge=clamp((atk-gkF)/100,-.35,.55);`
);

fs.writeFileSync(output, src, 'utf8');
const sha = crypto.createHash('sha256').update(src).digest('hex');
console.log('patches:', applied.join(', '));
console.log(path.basename(output), '| sha256', sha);
