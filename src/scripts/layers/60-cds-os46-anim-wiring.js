
(function(root){
'use strict';
var M=root.MatchSim;if(!M||!M.prototype||M.prototype.__CDS_OS46__)return;
var A=root.CDS_ANIM;if(!A||typeof A.create!=='function')return;
var P=M.prototype;try{Object.defineProperty(P,'__CDS_OS46__',{value:true});}catch(_){P.__CDS_OS46__=true;}

/* mesma identidade da ponte R14 (:20077): time + referencia */
function idOf(p){return p?((p.team!=null?p.team:'?')+':'+((p.ref&&(p.ref.id||p.ref.n))||p.id||p.idx)):null;}

var MOVE={
  'arrancada':'burst_touch',
  'elástico':'body_feint',
  'elastico':'body_feint',
  'caneta':'body_feint',
  'drible da vaca':'turn_dribble',
  'meia-lua':'turn_dribble',      /* OS-47 · a meia-lua E a roleta de 360 */
  'corta pra dentro':'inside_cut'
};

/* §OS-210 · janela do passe de primeira, em segundos de simulacao. Medida, nao
   escolhida: p10 do tempo entre ganhar a bola e solta-la e 0,433 s e p25 e
   0,467 s, porque `settle` gateia a decisao. 0,47 s pega o decil mais rapido
   sem chamar de "de primeira" um passe que teve dominio. */
var TOQUE_UNICO=0.47;

var dbg={pedidos:0,porEstado:Object.create(null)};

function pede(sim,p,estado,entao){
  try{
    if(!p||!estado)return;
    if(!sim.__anim)sim.__anim=A.create();
    var c=sim.__anim.of(idOf(p));
    if(!c||typeof c.request!=='function')return;
    c.request(estado,Number(sim.t)||0,{force:true,entao:entao||null});
    dbg.pedidos++;dbg.porEstado[estado]=(dbg.porEstado[estado]||0)+1;
    if(entao)dbg.porEstado[entao]=(dbg.porEstado[entao]||0)+1;
  }catch(_){}
}

/* §OS-213 · pedir SEM atropelar um gesto que ainda corre.
   `pede` usa `force: true`, que passa por cima da regra de compromisso. Isso e
   certo para uma defesa (ela interrompe tudo), mas errado para a reposicao do
   goleiro: ela nasce logo depois do bloqueio de pe e apagava o `gk_smother`
   antes de ele virar quadro. Aqui o gesto em curso termina primeiro. */
function pedeSeLivre(sim,p,estado,entao){
  try{
    if(!p||!estado)return;
    if(!sim.__anim)sim.__anim=A.create();
    var c=sim.__anim.of(idOf(p));
    if(!c||typeof c.request!=='function')return;
    if(c.dur>0&&c.t<c.dur)return;      // ainda gesticulando: nao interrompe
    pede(sim,p,estado,entao);
  }catch(_){}
}

/* §D43 · CORTE PARA DENTRO OU PARA FORA — decidido pela geometria.
   `outside_cut` estava declarado, desenhado e sem nenhum mapeamento: a tabela
   MOVE so tinha 'corta pra dentro'. Os dois cortes nao precisam de nome novo do
   motor — o duelo ja escreveu `_tx/_ty` no driblador ANTES de emitir, entao da
   para ler para onde ele saiu. Sair na direcao do meio do campo e por dentro;
   sair na direcao da linha de fundo lateral e por fora. */
function corteDe(p){
  try{
    var ty=Number(p&&p._ty);if(!isFinite(ty))return 'inside_cut';
    var meio=(typeof FW==='number'?FW:68)/2;
    var y=Number(p.y)||0;
    /* movimento em y contra a posicao dele em relacao ao meio */
    var paraMeio=(meio-y)*(ty-y)>0;
    return paraMeio?'inside_cut':'outside_cut';
  }catch(_){return 'inside_cut';}
}

/* A DEFESA e escolhida pela geometria, nao por sorteio: quanto o goleiro teve
   de se deslocar em y e a que altura a bola estava. */
function defesa(sim,gk,data){
  try{
    var b=sim.ball;
    var z=Number(b&&b.z)||0;
    var dy=Math.abs((Number(gk.y)||0)-(Number(b&&b.y)||0));
    var k=(data&&data.kind)||'';
    if(k==='catch'||k==='double_catch'){ return dy>1.9?(z>1.25?'gk_high_dive':'gk_low_dive'):'gk_catch'; }
    if(dy>1.9) return z>1.25?'gk_high_dive':'gk_low_dive';
    if(z<0.45) return 'gk_foot_save';
    return 'gk_parry';
  }catch(_){return 'gk_parry';}
}

/* O VOO tem de ser pedido quando o chute COMECA a viajar. No instante em que
   o evento save e emitido, o goleiro ja foi levado ao ponto de interceptacao,
   entao o afastamento lateral e zero e nenhum mergulho e escolhido — medido:
   com o gatilho no evento save, gk_low_dive e gk_high_dive ficaram em 0%. O
   voo sai agora de _startTravel com meta.outcome==='save', que carrega o alvo
   de interceptacao e acontece com o goleiro ainda parado. */
var oldST=P._startTravel;
if(typeof oldST==='function'){
  P._startTravel=function(o,target,kind,cb,receiver,style,meta){
    try{
      if(meta&&target){
        var ator=meta.actor;
        if(meta.outcome==='save'&&ator&&ator.isGK){
          var dy=Math.abs((Number(ator.y)||0)-(Number(target.y)||0));
          var tz=Number(target.z);if(!isFinite(tz))tz=Number(this.ball&&this.ball.z)||0;
          /* MEDIDO: com o corte em 1,1 m o voo saiu em 0,01% — o goleiro da
             OS-19 fica bem posicionado e quase nunca precisa de mais de 1 m.
             Defesa com QUALQUER componente lateral e voo; palma seca fica so
             para bola em cima dele. */
          var est = dy>0.55 ? (tz>1.15?'gk_high_dive':'gk_low_dive')
                  : (tz<0.5?'gk_foot_save':'gk_parry');
          /* §D45 · quem mergulha cai. `gk_ground_recover` existia so para o
             encaixe perdido; agora e o desfecho de todo voo, que e quando ele
             de fato acontece — o goleiro nao levanta instantaneamente. */
          pede(this,ator,est,/dive$/.test(est)?'gk_ground_recover':null);
        } else if(meta.outcome==='block'&&ator){ pede(this,ator,'block'); }
      }
      /* §D45 · A DISTRIBUICAO DO GOLEIRO NAO TINHA GESTO NENHUM.
         `gk_throw` e `gk_kick` estao declarados desde a R14 e nenhum evento
         mapeava para eles — o goleiro soltava a bola sem mover um musculo, em
         todo tiro de meta e em toda reposicao. Nao falta evento: a bola parte
         por `_startTravel`, com o goleiro como origem. O alcance decide qual
         dos dois e — reposicao curta e de mao, saida longa e de pe. */
      if(o&&o.isGK&&target){
        var _dx=(Number(target.x)||0)-(Number(o.x)||0);
        var _dy2=(Number(target.y)||0)-(Number(o.y)||0);
        pedeSeLivre(this,o,Math.sqrt(_dx*_dx+_dy2*_dy2)>32?'gk_kick':'gk_throw');
      }
      /* CHUTE: o contrato de acao da R14 cobre pouco (shot_ em 0,02% do
         tempo contra 18 chutes por partida). Todo voo de chute pede a pose. */
      /* §D48 · e agora a pose diz QUE chute foi. `power_shot`, `placed_shot` e
         `volley` estavam declarados e desenhados e nenhum evento mapeava para
         eles — todo chute virava `shot_prepare`. O motor nao classifica a
         acao, mas nao precisa: a altura da bola no momento da batida separa o
         voleio, e a distancia ate o alvo separa forca de colocacao. */
      if(kind==='shot'&&o&&!(meta&&meta.actor===o)
         && !(o.__os59Head && (Number(this.t)||0) < o.__os59Head)){
        var _z=Number(this.ball&&this.ball.z)||0;
        var _ddx=(Number(target&&target.x)||0)-(Number(o.x)||0);
        var _ddy=(Number(target&&target.y)||0)-(Number(o.y)||0);
        var _d=Math.sqrt(_ddx*_ddx+_ddy*_ddy);
        pede(this,o,_z>0.55?'volley':_d>20?'power_shot':'placed_shot','shot_followthrough');
      }
      /* §D48 · `long_pass` idem: o lancamento ja se distingue do toque curto
         pela distancia, e o motor ate marca `passKind === 'launch'`. */
      /* §OS-210 · O GOLEIRO NAO ENTRA AQUI, E ERA POR ISSO QUE ELE NAO TINHA
         GESTO DE REPOSICAO.
         Vinte linhas acima esta camada pede `gk_kick`/`gk_throw` para o
         goleiro. Esta linha pedia `long_pass` para o MESMO ator, no MESMO
         quadro, logo em seguida — e o segundo pedido vence.
         Nao e sutil: `gk_kick` sai acima de 32 m e `long_pass` acima de 28,
         entao TODA saida de pe do goleiro era sobrescrita, por construcao.
         Medido em partida real: das distribuicoes do goleiro, 5 de 7 passam de
         32 m; e `gk_kick`/`gk_throw` entram na maquina 4 e 5 vezes e chegam a
         ZERO quadro desenhado (tools/fisica/tela/gesto-perdido.js).
         O gesto do goleiro e o ESPECIFICO — ele repoe com a mao ou com o pe, e
         isso ja diz que e um lancamento. O generico sai da frente. */
      if(kind==='pass'&&o&&!o.isGK&&target){
        var _px=(Number(target.x)||0)-(Number(o.x)||0);
        var _py=(Number(target.y)||0)-(Number(o.y)||0);
        if(style==='launch'||Math.sqrt(_px*_px+_py*_py)>28) pede(this,o,'long_pass');
        /* §OS-210 · O PASSE DE PRIMEIRA existia desenhado e ninguem o pedia.
           Nao falta evento — falta a unica informacao que o distingue: ha
           quanto tempo aquele pe esta com a bola. O motor nao publica isso,
           mas publica a troca de dono, e dai sai um carimbo (ver o passo, no
           fim desta camada).
           A DOSE VEIO DA MEDIDA, nao do gosto. Em partida real, o tempo entre
           ganhar a bola e solta-la tem p10 = 0,433 s e p25 = 0,467 s; abaixo
           de 0,35 s ficam 2 passes em 161. Nao e ruido de amostragem: o motor
           poe `settle` no receptor e so decide quando ele expira, entao o
           passe mais rapido que este jogo consegue dar E o que sai logo depois
           do dominio. `first_touch_pass` passa a ser exatamente esse — o mais
           rapido que o modelo permite — e nao um toque instantaneo que o motor
           nunca produziria.
           Nao substitui `long_pass`: um lancamento de primeira e as duas
           coisas, e o lancamento e o gesto maior. */
        else if(o.__os210Posse!=null&&(Number(this.t)||0)-o.__os210Posse<TOQUE_UNICO){
          pede(this,o,'first_touch_pass');
        }
      }
    }catch(_){}
    return oldST.apply(this,arguments);
  };
}

var oldEmit=P._emit;
P._emit=function(type,data){
  var r=oldEmit.apply(this,arguments);
  try{
    if(data){
      if(type==='save'&&data.gk){ pede(this,data.gk,defesa(this,data.gk,data)); }
      /* §OS-213 · o bloqueio de pe do goleiro TERMINA em recomposicao, e o
         encadeamento e o que o protege: sem `entao`, a reposicao que vem logo
         depois (gk_throw/gk_kick, mesmo tier, com force) apagava o gesto antes
         de ele virar quadro. Medido: entrava 3 a 5 vezes e era desenhado zero,
         em tres rodadas seguidas. */
      else if(type==='gk_sweep'&&data.gk){ pede(this,data.gk,'gk_smother','gk_ground_recover'); }
      else if(type==='dribble'&&data.by){
        /* §D43 · o corte agora vem da geometria, nao so do nome do move; e o
           drible bem-sucedido termina em `dribble_success`, que existia sem
           nunca ter sido pedido por ninguem. */
        var _mv=data.move&&MOVE[String(data.move).toLowerCase()];
        if(!_mv||_mv==='inside_cut')_mv=corteDe(data.by);
        pede(this,data.by,_mv,'dribble_success');
        /* o defensor passado se recompoe */
        if(data.on)pede(this,data.on,'recover');
      }
      /* §D43 · O DRIBLADOR QUE FALHA NAO TINHA GESTO — e nao por falta de
         evento, por falta de LEITURA. Toda a fiacao aqui le `data.by`, e nos
         desfechos defensivos o `by` e o DEFENSOR: quem perdeu a bola esta em
         `data.on` e nunca era consultado. */
      else if(type==='loose_duel'){
        if(data.by)pede(this,data.by,'body_duel');
        if(data.on)pede(this,data.on,'dribble_failure');
      }
      else if(type==='containment'&&data.on){
        /* recusar o duelo e o proprio gesto de preparo abortado; o drible que
           falhou e desfecho */
        pede(this,data.on,data.source==='dribble_declined'?'dribble_prepare'
                        :data.source==='failed_dribble'?'dribble_failure'
                        :'body_duel');
      }
      /* a tentativa de bote e 23x mais frequente que o drible e nao tinha pose:
         so `tackle` e `tackle_missed` estavam fiados */
      else if(type==='tackle_attempt'&&data.by){ pede(this,data.by,'standing_tackle'); }
      /* §OS-207 · A FALTA ERA O EVENTO MAIS FREQUENTE SEM GESTO NENHUM.
         ~15 por partida, e a fiacao inteira aqui ignorava `foul`. Quem sofria
         seguia trotando enquanto o juiz apitava; quem cometia tambem nao
         mostrava nada, porque `tackle_attempt` so nasce no ramo do bote e a
         maior parte das faltas vem de outros ramos (:17240 do bundle, duelo de
         drible, e o contato aereo da OS-201).
         Nao ha informacao nova pedida ao motor: `by` e `on` ja vinham no
         evento e ninguem os lia. */
      else if(type==='foul'){
        if(data.on)pede(this,data.on,'fouled','get_up');
        if(data.by)pede(this,data.by,'standing_tackle','recover');
      }
      else if((type==='header_shot'||type==='header_clear')&&data.by){
        pede(this,data.by,'header');
        /* OS-59 · marca quem cabeceou: o voo de chute que vem logo a seguir
           pediria shot_prepare e atropelaria esta pose. Medido: header_shot
           ficava em 0% de cobertura, com shot_prepare no lugar em 12 de 12. */
        try{ data.by.__os59Head=(Number(this.t)||0)+0.6; }catch(_){}
      }
      else if(type==='blocked'&&data.by){ pede(this,data.by,'block'); }
      else if(type==='intercept'&&data.by){ pede(this,data.by,'intercept'); }
      else if(type==='tackle_missed'&&data.by){
        /* o motor ja marca `_beatenUntil` no defensor: o `recover` e a versao
           visivel do atraso que a fisica dele ja paga */
        pede(this,data.by,'slide_tackle','recover');
      }
      /* §OS-213 · QUEM PERDE A BOLA PERDE EM QUALQUER RAMO.
         O filtro exigia `source === 'dribble'`, e o desarme nasce em tres
         ramos: `dribble`, `press_contact` e `press_poke`. Nos dois de pressao
         o jogador era desarmado e continuava correndo como se nada tivesse
         acontecido. Medido com validar-lances.js: 36 de 46 desarmados ganhavam
         gesto de perda -- 24% saiam sem reacao nenhuma. */
      else if(type==='tackle'&&data.on){
        pede(this,data.on,'dribble_failure');
      }
      else if(type==='bad_pass'&&data.by){ pede(this,data.by,'lose_control'); }
      else if(type==='miscontrol_out'&&data.by){ pede(this,data.by,'heavy_touch'); }
    }
  }catch(_){}
  return r;
};

/* §OS-210 · O CARIMBO DA POSSE.
   A troca de dono nao e evento: nenhuma das duas pontes desta camada (`_emit`
   e `_startTravel`) consegue ve-la. Um passo curto observa `ball.owner` e
   anota QUANDO ele mudou. E o unico dado que faltava para distinguir o passe
   de primeira do passe apos dominio.
   Escreve um campo que o motor nao le, como `__os59Head` logo acima ja faz:
   nenhum sorteio, nenhuma decisao, nenhum xG. */
var oldStepOS210=P.step;
P.step=function(dt){
  var r=oldStepOS210.apply(this,arguments);
  try{
    var o=this.ball&&this.ball.owner;
    if(o){ if(this.__os210Ult!==o){ this.__os210Ult=o; o.__os210Posse=Number(this.t)||0; } }
    else this.__os210Ult=null;
  }catch(_){}
  return r;
};

P.getOS46Audit=function(){
  return {pedidos:dbg.pedidos,porEstado:JSON.parse(JSON.stringify(dbg.porEstado))};
};
root.CDS_OS46=Object.freeze({version:'OS-46',feature:'ANIM_EVENT_WIRING',
  presentationOnly:true,engineMutation:false,rngConsumption:false});
})(typeof window!=='undefined'?window:globalThis);
