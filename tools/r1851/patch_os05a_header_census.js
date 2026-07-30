#!/usr/bin/env node
'use strict';
/*
 * OS-05A · CENSO DO CORTE AEREO EFETIVO
 * ---------------------------------------
 * Instrumentacao observacional sobre a R18.50. Nao muda RNG, posse,
 * trajetoria, estatistica ou identidade promovida.
 *
 * O sitio base (build R18.50:5450) emite `header_clear` e chama `_turnover`.
 * A chamada, porem, atravessa as camadas efetivas de R18.18.2 e R18.18.3
 * (build R18.50:21771 e 22073), que podem fisicalizar o corte. Este patch
 * marca apenas o primeiro contato defensivo do cruzamento aereo e observa o
 * estado da bola depois da ultima camada de `_turnover`.
 *
 * A camada de censo entra imediatamente antes de </body>, portanto depois de
 * todas as sobrescritas funcionais presentes na R18.50. A identidade continua
 * R18.50: esta candidata nao e promovivel.
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find(x => x.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const input = arg('in', 'dist/COPA DOS SONHOS - R18.50 - PRESERVAR ENERGIA.html');
const output = arg('out', 'dist/COPA DOS SONHOS - R18.50 - OS05A CENSO.html');
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
  'os05a-tag-aerial-cross-first-contact',
  `this._emit('header_clear',{by:def});this._turnover(def);`,
  `this._emit('header_clear',{by:def,setPiece,os05Origin:'aerial_cross_first_contact'});this._turnover(def);`
);

edit(
  'os05a-final-effective-census',
  `</body></html>`,
  `<script id="cds-r1851-os05a-header-census">
(function(root){
  'use strict';
  const P=root.MatchSim&&root.MatchSim.prototype;
  if(!P||typeof P._emit!=='function'||typeof P._turnover!=='function')return;
  const ORIGIN='aerial_cross_first_contact';
  const finite=(v,d=0)=>Number.isFinite(v)?v:d;
  const fresh=()=>({
    open_seen:0,open_clean:0,open_endline:0,open_touchline:0,open_live:0,open_other:0,
    open_return_true:0,open_return_false:0,
    setpiece_seen:0,setpiece_clean:0,setpiece_endline:0,setpiece_touchline:0,
    setpiece_live:0,setpiece_other:0,setpiece_return_true:0,setpiece_return_false:0
  });
  const state=sim=>sim.__os05aHeaderCensus||(sim.__os05aHeaderCensus=fresh());
  const classify=(sim,p)=>{
    const b=sim.ball||{},t=b.target||{};
    const x=finite(b.x,NaN),y=finite(b.y,NaN);
    const tx=finite(t.x,NaN),ty=finite(t.y,NaN);
    if(x<0||x>FL||tx<0||tx>FL)return'endline';
    if(y<0||y>FW||ty<0||ty>FW)return'touchline';
    if(b.owner===p)return'clean';
    if(b.traveling||b.__p04Live||!b.owner)return'live';
    return'other';
  };

  const oldReset=P.reset;
  if(typeof oldReset==='function')P.reset=function(){
    const result=oldReset.apply(this,arguments);
    this.__os05aHeaderCensus=fresh();
    this.__os05aHeaderPending=null;
    return result;
  };

  const oldEmit=P._emit;
  P._emit=function(type,data){
    if(type==='header_clear'&&data&&data.os05Origin===ORIGIN){
      const prefix=data.setPiece?'setpiece_':'open_';
      state(this)[prefix+'seen']++;
      this.__os05aHeaderPending={
        by:data.by||null,
        setPiece:!!data.setPiece,
        at:finite(this.t)
      };
    }
    return oldEmit.apply(this,arguments);
  };

  const oldTurn=P._turnover;
  P._turnover=function(p){
    const q=this.__os05aHeaderPending;
    const now=finite(this.t);
    const active=!!(q&&p&&p===q.by&&now-q.at>=0&&now-q.at<=0.12);
    const result=oldTurn.apply(this,arguments);
    if(active){
      const s=state(this),prefix=q.setPiece?'setpiece_':'open_';
      s[prefix+classify(this,p)]++;
      s[prefix+(result===false?'return_false':'return_true')]++;
      this.__os05aHeaderPending=null;
    }else if(q&&now-q.at>0.12){
      this.__os05aHeaderPending=null;
    }
    return result;
  };

  P.getOS05AHeaderCensus=function(){
    return Object.assign({},state(this));
  };
  root.CDS_OS05A_CENSUS=Object.freeze({
    version:'OS-05A-R18.50',
    baseline:'R18.50',
    observational:true,
    promoted:false,
    origin:ORIGIN,
    note:'Classifica o estado da bola depois da camada efetiva de _turnover, separado entre jogada corrida e bola parada. Nao usa RNG nem altera o desfecho.'
  });
})(typeof window!=='undefined'?window:globalThis);
</script>
</body></html>`
);

fs.writeFileSync(output, src, 'utf8');
const sha = crypto.createHash('sha256').update(src).digest('hex');
console.log('patches:', applied.join(', '));
console.log(path.basename(output), '| sha256', sha);

