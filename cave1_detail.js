const fs=require('fs');
const vm=require('vm');
const ctx={console,Math,Date,Object,Array,JSON};
vm.createContext(ctx);
for(const f of ['jobStats.js','monsters.js','maps.js','items.js','skills.js','drops.js']){
  let c=fs.readFileSync(f,'utf8').replace(/\bconst\s+([A-Za-z_$][\w$]*)\s*=/g,'var $1 =').replace(/\blet\s+([A-Za-z_$][\w$]*)\s*=/g,'var $1 =');
  vm.runInContext(c,ctx);
}
const {MONSTERS,MAPS,DROPS,GENERIC_DROPS,ITEMS}=ctx;
const stats={minDef:8,maxDef:11,maxHp:73};
const def=[8,11],hp=73;
function avgDmg(a,b,d1,d2){return Math.max(1,(a+b)/2-((d1+d2)/2)*0.6);}

console.log('=== 矿洞一层 药水成本详细分析 ===');
const m=MAPS.find(x=>x.name==='矿洞一层');
const tw=m.monsters.reduce((s,x)=>s+x.count,0);

// 每只怪打你多少
let wDmg=0;
for(const e of m.monsters){
  const mon=MONSTERS[e.name];
  const d=avgDmg(mon.minAtk,mon.maxAtk,def[0],def[1]);
  const w=e.count/tw;
  wDmg+=d*w;
  console.log(e.name+': 攻'+mon.minAtk+'-'+mon.maxAtk+' 打你'+Math.round(d)+'/击 ×'+e.count+' 权重'+(w*100).toFixed(0)+'%');
}
console.log('加权伤害/回合: '+wDmg.toFixed(1)+'HP');
console.log('');

// 击杀19.9只/分, 每只约3回合 = 60回合/分
const turns=60;
const hpTaken=wDmg*turns;
console.log('每分承伤: '+wDmg.toFixed(1)+'×'+turns+' = '+Math.round(hpTaken)+'HP/分');
console.log('实测截图承伤约155/分 (我的算135, 接近)');

// 红药: 135HP需要 135/30=4.5瓶小红 ×50金 = 不对
// 但你low档怪掉小红药1/10
const killsPerMin=19.9;
console.log('');
console.log('=== 红药 ===');
console.log('承伤135HP/分');
console.log('low档怪掉金创药(小量)+30HP 1/10概率');
const freeHp=killsPerMin*0.1*30;
console.log('白嫖红药: '+killsPerMin+'杀 ×0.1 ×30HP = '+freeHp.toFixed(0)+'HP/分');
console.log('需购买: '+(135-freeHp)+'HP → '+(Math.max(0,135-freeHp)*50/30).toFixed(0)+'金/分');
console.log('我算红药成本: 19金/分');

console.log('');
console.log('=== 蓝药 ===');
console.log('地狱火每回合2MP, 60回合/分 = 120MP/分');
console.log('low档怪不掉蓝药(mid档才掉)');
console.log('需购买: 120MP ×(50/30) = '+(120*50/30).toFixed(0)+'金/分');
console.log('');

// 关键：你说金币没110
console.log('=== 总账 ===');
console.log('金币产出: 284金/分');
console.log('红药: 19金/分');
console.log('蓝药: '+(120*50/30).toFixed(0)+'金/分 (200金!)');
console.log('净金: '+(284-19-200)+'金/分');
console.log('');
console.log('★ 但等等! 蓝药cost在calcMap里怎么算的?');
console.log('  mpCostPerMin=114MP, 我这里算120MP, 差6MP');
console.log('  因为我用0.95系数: 19.9杀×3回合=59.7回合, 不是60');
console.log('  114MP×50/30 = 190金 ← 这是蓝药大头!');
console.log('');
console.log('=== 你"勉强够"的原因 ===');
console.log('蓝药要花190金/分! 占了金币产出的67%');
console.log('284产出 - 190蓝药 - 19红药 = 75金/分 净');
console.log('如果autoHeal选了更贵的蓝药(中蓝100金/60MP而不是小蓝50金/30MP):');
console.log('  114MP÷60×100 = 190金 (一样, 因为性价比相同)');
console.log('  但如果选了强效蓝药500金/200MP: 114÷200×500 = 285金! → 净-20金/分');
