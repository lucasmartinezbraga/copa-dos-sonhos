
/* R10.9 · avanço responsivo da Copa. A física e o passo 1/30 são os mesmos;
   apenas existe uma devolução ao event loop entre partidas automáticas. */
(function(root){'use strict';
 const C=root.CUP;if(!C||C.__r109AsyncCup)return;
 const yieldUI=()=>new Promise(resolve=>setTimeout(resolve,0));
 const addScorers=(cup,res)=>{for(const q of (res&&res.scorers)||[]){if(!q.p)continue;const k=q.sid+':'+q.p.n;(cup.scorers[k]=cup.scorers[k]||{n:q.p.n,sid:q.sid,gols:0}).gols++;}};
 C.playGroupRoundAsync=async function(cup,db,skipPlayerMatch,onProgress){
   const queue=[],round=cup.round;
   for(const g of cup.groups)for(const m of cup.results[g.name]){
     if(m.round!==round||m.g)continue;
     const isPlayers=m.h===cup.playerSid||m.a===cup.playerSid;
     if(isPlayers&&skipPlayerMatch)continue;
     queue.push({m,group:g.name});
   }
   const played=[];
   for(let i=0;i<queue.length;i++){
     const x=queue[i],res=C.simQuick(db,x.m.h,x.m.a,false,cup);
     x.m.g=res.g;addScorers(cup,res);played.push(Object.assign({},x.m,{group:x.group}));
     if(typeof onProgress==='function')try{onProgress(i+1,queue.length,x.m);}catch(_){}
     await yieldUI();
   }
   return played;
 };
 C.playKnockoutStageAsync=async function(cup,db,skipPlayerMatch,onProgress){
   const stage=cup.ko[cup.phase]||[],queue=[];
   for(const m of stage){if(m.g)continue;const isPlayers=m.h===cup.playerSid||m.a===cup.playerSid;if(isPlayers&&skipPlayerMatch)continue;queue.push(m);}
   const played=[];
   for(let i=0;i<queue.length;i++){
     const m=queue[i],res=C.simQuick(db,m.h,m.a,true,cup);m.g=res.g;m.pens=res.pens;addScorers(cup,res);played.push(m);
     if(typeof onProgress==='function')try{onProgress(i+1,queue.length,m);}catch(_){}
     await yieldUI();
   }
   return played;
 };
 Object.defineProperty(C,'__r109AsyncCup',{value:true});
 root.CDS_R109=Object.freeze({version:'5.8.17-R10.9',asyncCup:true,physicalBase:'5.8.16-R10.8'});
})(typeof window!=='undefined'?window:globalThis);
