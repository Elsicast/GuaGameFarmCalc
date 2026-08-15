const fs=require('fs');
const vm=require('vm');
const ctx={console,Math,Date,Object,Array,JSON,document:{getElementById:()=>({style:{},innerHTML:''})}};
vm.createContext(ctx);
for(const f of ['expTable.js','jobStats.js','monsters.js','maps.js','items.js','skills.js','drops.js']){
  let c=fs.readFileSync(f,'utf8').replace(/\bconst\s+([A-Za-z_$][\w$]*)\s*=/g,'var $1 =').replace(/\blet\s+([A-Za-z_$][\w$]*)\s*=/g,'var $1 =');
  vm.runInContext(c,ctx);
}
vm.runInContext(fs.readFileSync('app.js','utf8'),ctx);
// 新数据: 18级, 装了地狱火(不是火球术!)
const player={job:'mage',level:18,
  equipment:{weapon:{name:'半月',bonus:{mc:1}},armor:{name:'布衣',bonus:{def:3}},
    necklace:{name:'金项链',bonus:{magDef:3}},bracelet1:{name:'钢手镯',bonus:{magDef:1}},
    bracelet2:{name:'铁手镯',bonus:{def:3}},ring1:{name:'六角戒指',bonus:{mc:2}},
    ring2:{name:'古铜戒指',bonus:{atk:3}}},
  equippedSkills:['地狱火']};  // ← 关键变化
const stats=ctx.getStats(player);
const parts=ctx.getDamageParts(player,stats,10);
const mp=ctx.getMpCostPerTurn(player);
const dps=ctx.getDPS(player,stats,10);
console.log('=== 18级法师(地狱火) ===');
console.log('属性: 攻'+stats.minAtk+'-'+stats.maxAtk+' MC'+stats.minMc+'-'+stats.maxMc+' HP'+stats.maxHp);
console.log('DPS(0防): '+dps);
console.log('蓝耗/回合: '+mp.perTurn+'MP ('+mp.singleAtkSkills+'单体技能)');
console.log('物攻段:'+parts.physBase.toFixed(1)+' 魔法段:'+parts.magicBase.toFixed(1));
console.log('(地狱火damageBonus=0.35, 比火球术0.10高)');
console.log('');
const m=ctx.MAPS.find(x=>x.name==='矿洞一层');
const r=ctx.calcMap(m,player,stats,dps,mp.perTurn,parts);
console.log('=== 矿洞一层 ===');
console.log('击杀/分:'+r.killsPerMin+' 经验/分:'+r.expPerMin+' 金币/分:'+r.goldPerMin);
console.log('净金/分:'+r.netGold+' 承伤/分:'+r.hpTakenPerMin+' 红药:'+r.hpCost+'金 蓝耗:'+r.mpCostPerMin+'MP');
console.log('');
// 逐怪看
console.log('=== 逐怪明细 ===');
const tw=m.monsters.reduce((s,x)=>s+x.count,0);
for(const e of m.monsters){
  const mon=ctx.MONSTERS[e.name];
  const dmg=ctx.dmgToMonster(parts,mon);
  const turns=Math.ceil(mon.hp/dmg);
  console.log(e.name+'(L'+mon.level+',HP'+mon.hp+',物防'+(mon.minDef||0)+',魔防'+(mon.minMagDef||0)+')×'+e.count+': 你打'+dmg+'/回合→'+turns+'回合 经验'+mon.exp);
}
