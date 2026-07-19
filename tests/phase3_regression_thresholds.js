'use strict';
const assert=require('assert'),fs=require('fs');
const p=process.argv[2];if(!p)throw new Error('Informe o relatório JSON');
const r=JSON.parse(fs.readFileSync(p,'utf8')),o=r.overall;
const broad={goalsPerMatch:[2.1,3.5],shotsPerMatch:[18,33],xgPerMatch:[2.0,3.8],onTargetRate:[.30,.50],passCompletion:[.72,.91],foulsPerMatch:[13,30],yellowsPerMatch:[1.8,6.2],redsPerMatch:[0,.4],cornersPerMatch:[4,12],drawRate:[.15,.42],zeroZeroRate:[.02,.16],blowoutRate:[.01,.16],averageEndingStamina:[60,85]};
for(const [k,[lo,hi]] of Object.entries(broad)){assert(Number.isFinite(o[k]),`${k} inválido`);assert(o[k]>=lo&&o[k]<=hi,`${k}=${o[k]} fora de ${lo}-${hi}`);}
const sb=r.features&&r.features.sideBias;if(sb&&sb.decisiveGames>=40)assert(sb.sideAWinShare>=.40&&sb.sideAWinShare<=.60,`viés de lado ${sb.sideAWinShare}`);
assert.strictEqual(r.matches,214);
console.log(JSON.stringify({ok:true,score:r.calibration.score,matches:r.matches,sideBias:sb},null,2));
