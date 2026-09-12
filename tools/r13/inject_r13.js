#!/usr/bin/env node
'use strict';
const fs=require('fs');
const htmlPath=process.argv[2];
const jsPath=process.argv[3];
const outPath=process.argv[4]||htmlPath;
if(!htmlPath||!jsPath)throw new Error('usage: inject_r13.js HTML JS');
let html=fs.readFileSync(htmlPath,'utf8');
const js=fs.readFileSync(jsPath,'utf8').trim();
html=html.replace(/\n?<script id="cds-r13-football-observer-cadence">[\s\S]*?<\/script>(?=<\/body><\/html>\s*$)/,'');
const rewrites=[
  ["{ k: '1X',    v: 0.6 }","{ k: '1X',    v: 1.0 }"],
  ["{ k: '2X',    v: 1.4 }","{ k: '2X',    v: 1.8 }"],
  ["{ k: '4X',    v: 3.2 }","{ k: '4X',    v: 3.6 }"],
  ["  speed: 1.4,\n  screen: 'home',","  speed: 1.0,\n  screen: 'home',"],
  ["rxRcv > offLine + 1.2 && chance(callP)","rxRcv > offLine + 0.45 && chance(clamp(callP + 0.05, 0.62, 0.97))"],
  ["(ADV4.crossing.aerialSetPieceBoost+p10SetPiece)*100","(ADV4.crossing.aerialSetPieceBoost+p10SetPiece)*90"],
  ["*(setPiece?.45:1),.012,setPiece?.09:.28)","*(setPiece?.62:1),setPiece?.012:.012,setPiece?.110:.28)"],
  ["const MINOR = new Set(['tackle','dribble','intercept','corner','cross'","const MINOR = new Set(['tackle','dribble','intercept','corner','throw_in','cross'"],
  ["['Finalizações',s[0].shots,s[1].shots],['No alvo',s[0].onTarget,s[1].onTarget],['xG',s[0].xg,s[1].xg,'decimal'],['Escanteios',s[0].corners,s[1].corners]",
   "['Finalizações',s[0].shots,s[1].shots],['No alvo',s[0].onTarget,s[1].onTarget],['xG',s[0].xg,s[1].xg,'decimal'],['Escanteios',s[0].corners,s[1].corners],['Laterais',s[0].throwIns||0,s[1].throwIns||0]"]
];
for(const [from,to] of rewrites)html=html.split(from).join(to);
if(!html.includes('throw_in:    e  =>')){
  html=html.replace(/(  corner:\s+e\s+=>[^\n]+\n)/,
    "$1  throw_in:    e  => '↗️ Lateral para '+(e.team===0?'o time da casa':'o visitante')+(e.by?' com <b>'+esc(e.by.ref.n)+'</b>':''),\n");
}
const end='</body></html>';
if(!html.includes(end))throw new Error('closing body/html not found');
html=html.replace(end,'<script id="cds-r13-football-observer-cadence">\n'+js+'\n</script></body></html>');
fs.writeFileSync(outPath,html);
