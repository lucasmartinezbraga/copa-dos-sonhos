/* ============================================================================
 * R18.50 · O CORTE DE CABECA DEIXA DE SER POSSE LIMPA  (OS-05)
 * ----------------------------------------------------------------------------
 * O sitio, no ramo aereo de `_cross`, quando o ZAGUEIRO ganha o primeiro
 * contato (10-base-bundle.js:3255 no fonte):
 *
 *     if(def){ def.rating+=.08; this._emit('header_clear',{by:def});
 *              this._turnover(def); }
 *
 * `_turnover(def)` entrega a bola ao zagueiro instantaneamente. Cabecear um
 * cruzamento para longe vira posse controlada no mesmo quadro: a bola nao
 * viaja, ninguem disputa a segunda bola, e — o que importa para OS-05 — ela
 * nunca pode cruzar a propria linha de fundo. E a mesma familia de defeito que
 * a R18.31 corrigiu no ramo `!atk` (desfecho sorteado sem ninguem tocar a bola)
 * e que a R18.35 corrigiu na falta (bola nunca colocada no local).
 *
 * MEDIDO na R18.49, 18 partidas: 5,67 cruzamentos de linha por partida, dos
 * quais so 1,39 tem ultimo toque da DEFESA — e o toque defensivo que cruza a
 * linha e a UNICA fonte de escanteio por geometria (`_ballOut`). Escanteios:
 * 1,125 na bateria de 3 bases, contra faixa 4-10 de ECO-05.
 *
 * O CONSERTO. O corte de cabeca passa a mandar a bola para algum lugar, e o
 * lance segue. A direcao sai do proprio lance: o zagueiro afasta na diagonal
 * para longe da propria meta. Uma fracao dos cortes e MAL DADA — cabeceio sob
 * pressao, contra a inercia do cruzamento — e sai fraca ou desviada para tras;
 * essa e a que pode cruzar a linha de fundo e virar escanteio, derivado por
 * `_ballOut` do ultimo toque real, sem nenhum sorteio de escanteio.
 *
 * A probabilidade de corte mal dado desce com a qualidade aerea do zagueiro
 * (`head_def`) e sobe com a pressao do atacante mais proximo. Nao ha `chance()`
 * decidindo ESCANTEIO: o dado decide a QUALIDADE DO CABECEIO, que e coisa que
 * um zagueiro de verdade erra. Onde a bola morre e geometria.
 *
 * ARMADILHA EVITADA, herdada da R18.22 pela R18.31: `_looseBall(x,y)` NAO deixa
 * a bola solta — zera a velocidade e chama `_contestLoose()`, que entrega ao
 * mais proximo SEM limite de distancia. Foi assim que a R18.22 inflou o xG em
 * 30%. Aqui a bola e posta em movimento e segue viva (`__p04Live`), o mesmo
 * caminho que a R18.31 usou.
 *
 * ORCAMENTO DE xG. A auditoria R18.49 avisa que levar escanteios a faixa
 * adiciona +0,1 a +0,26 de xG e a folga ate o teto de ECO-02 e 0,268. Por isso
 * os parametros sao conservadores e ficam expostos: o alvo e o PISO de ECO-05
 * (4), nao o teto (10).
 * ==========================================================================*/
const fs = require('fs'), crypto = require('crypto'), path = require('path');
const a = (n, d) => { const h = process.argv.slice(2).find(x => x.startsWith('--' + n + '=')); return h ? h.slice(n.length + 3) : d; };
/* fracao base de cortes mal dados, antes de qualidade e pressao */
const RUIM = Number(a('ruim', 0.34));
/* velocidade do corte bem dado e do corte mal dado, em m/s */
const VBOM = Number(a('vbom', 14)), VRUIM = Number(a('vruim', 8));
/* componente para-a-frente do corte MAL dado. Negativo = para tras, na direcao
   da propria linha de fundo. A primeira variante usou [-0.55, 0.35] e o corte
   mal dado quase nunca chegava a linha: virava segunda bola para o ataque
   dentro da area, o que subiu xG e DERRUBOU escanteio. Exposto para medir. */
const MALMIN = Number(a('malmin', -0.55)), MALMAX = Number(a('malmax', 0.35));

let src = fs.readFileSync(a('in', 'r1849.html'), 'utf8');
const applied = [];
function edit(id, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) { console.error('ABORTA [' + id + ']: ancora ' + n + 'x'); process.exit(1); }
  src = src.replace(from, to); applied.push(id);
}

edit('r1850-corte-cabeca',
`this._emit('header_clear',{by:def});this._turnover(def);`,
`this._emit('header_clear',{by:def});
        /* §R18.50 · O corte de cabeca deixa de ser posse limpa. Antes:
           _turnover(def) entregava a bola ao zagueiro no mesmo quadro. Cabecear
           um cruzamento nao devolve posse controlada, e enquanto devolvia a bola
           nunca podia cruzar a propria linha — o que deixava o escanteio sem
           fonte por geometria (1,39 toque defensivo na linha por partida, contra
           5,67 cruzamentos). Agora a bola SEGUE, e onde ela morre e geometria:
           quem alcancar fica com ela, e se cruzar a linha o reinicio nasce de
           _ballOut a partir do ultimo toque real. Nada de _looseBall aqui: ele
           entrega ao mais proximo sem limite de distancia e foi o que inflou o
           xG em 30% na R18.22. */
        (() => {
          const _b=this.ball, _tmD=this.teams[def.team], _gD=_tmD.goal;
          const _q=facet(def,'head_def')/100;
          let _pr=1e9; for(const _p of this.teams[1-def.team].players){ if(_p.red) continue;
            const _d=D(_p.x,_p.y,def.x,def.y); if(_d<_pr)_pr=_d; }
          /* pressao: colado (<2 m) pesa; livre (>6 m) nao pesa */
          const _pres=clamp((6-_pr)/4,0,1);
          const _pRuim=clamp(${RUIM}*(1.25-_q*0.75)*(0.55+_pres*0.9),0.05,0.72);
          const _mal=chance(_pRuim);
          /* direcao: afastar da propria meta, com abertura. No corte mal dado a
             componente para longe encolhe e pode inverter — e assim que a bola
             vai parar atras da linha. */
          const _dirFora=Math.sign(def.x-_gD.x)||1;
          const _lat=(chance(.5)?-1:1)*R(0.35,1.0);
          const _fwd=_mal?R(${MALMIN},${MALMAX}):R(0.75,1.0);
          const _L=Math.max(.001,Math.hypot(_fwd,_lat));
          const _v=_mal?${VRUIM}+R(0,3):${VBOM}+R(0,6);
          _b.owner=null; _b.traveling=false; _b.meta=null; _b.receiver=null; _b.onArrive=null;
          _b.lastTouch=def;
          _b.vx=(_dirFora*_fwd/_L)*_v; _b.vy=(_lat/_L)*_v;
          _b.vz=_mal?R(1.2,3.0):R(2.0,4.5);
          _b._looseT=0; _b.__p04Live=true;
          this._emit('corte_livre',{by:def,mal:_mal,pressao:+_pres.toFixed(2)});
        })();`);

const ID = `  root.CDS_BUILD_ID='R18.49'; root.CDS_VERSION='5.49.0-R18.49';`;
if (src.split(ID).length - 1 === 1) {
  src = src.replace(ID, `  root.CDS_R1850_CORTE=Object.freeze({version:'R18.50',label:'O CORTE DE CABECA DEIXA DE SER POSSE LIMPA',ruim:${RUIM},vbom:${VBOM},vruim:${VRUIM},
    note:'No ramo aereo de _cross o zagueiro que ganhava o primeiro contato recebia a bola por _turnover no mesmo quadro. Cabecear um cruzamento virava posse controlada, a segunda bola nao existia e a bola nunca podia cruzar a propria linha — deixando o escanteio sem fonte por geometria. Agora a bola segue e onde ela morre e geometria, derivada por _ballOut do ultimo toque real. O dado decide a QUALIDADE DO CABECEIO, nao o escanteio.'});
  root.CDS_BUILD_ID='R18.50'; root.CDS_VERSION='5.50.0-R18.50';`);
  src = src.replace(`  if(root.document)root.document.title='Copa dos Sonhos — R18.49';`, `  if(root.document)root.document.title='Copa dos Sonhos — R18.50';`);
  src = src.replace(`<title>Copa dos Sonhos — R18.49</title>`, `<title>Copa dos Sonhos — R18.50</title>`);
}

fs.writeFileSync(a('out', 'r1850.html'), src, 'utf8');
console.log('patches:', applied.join(', '));
console.log(path.basename(a('out', 'r1850.html')), '| ruim', RUIM, 'vbom', VBOM, 'vruim', VRUIM, '|', crypto.createHash('sha256').update(fs.readFileSync(a('out', 'r1850.html'))).digest('hex').slice(0, 12));
