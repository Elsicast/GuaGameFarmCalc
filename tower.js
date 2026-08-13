// 通天塔副本数据 - 基于 mirror-master/documents/通天塔.xlsx
// 每层3个怪物依次击杀，每天每层只能挑战一次
// monsters中: ref引用MONSTERS已有怪物, 自定义怪物直接写属性
const TOWER_FLOORS = [
  { floor: 1, cost: 200, monsters: [
    { ref: '半兽战士' }, { ref: '半兽战士' }, { ref: '半兽勇士' },
  ]},
  { floor: 2, cost: 500, monsters: [
    { ref: '红蛇' }, { ref: '虎蛇' }, { ref: '巨型多角虫' },
  ]},
  { floor: 3, cost: 800, monsters: [
    { ref: '骷髅战将' }, { ref: '骷髅战将' }, { ref: '骷髅精灵' },
  ]},
  { floor: 4, cost: 1200, monsters: [
    { name: '电僵尸', hp: 200, minAtk: 10, maxAtk: 20, minDef: 2, minMagDef: 2, exp: 300, level: 25, type: 'normal', skills: [{name:'雷电',type:'magic',chance:0.25,power:0.8}] },
    { name: '电僵尸', hp: 200, minAtk: 10, maxAtk: 20, minDef: 2, minMagDef: 2, exp: 300, level: 25, type: 'normal', skills: [{name:'雷电',type:'magic',chance:0.25,power:0.8}] },
    { ref: '尸王' },
  ]},
  { floor: 5, cost: 2000, monsters: [
    { ref: '沃玛卫士' }, { ref: '沃玛卫士' }, { ref: '沃玛教主' },
  ]},
  { floor: 6, cost: 3000, monsters: [
    { ref: '钳虫' }, { ref: '钳虫' }, { ref: '邪恶钳虫' },
  ]},
  { floor: 7, cost: 4000, monsters: [
    { ref: '黑野猪' }, { ref: '红野猪' }, { ref: '白野猪' },
  ]},
  { floor: 8, cost: 5000, monsters: [
    { ref: '祖玛雕像' }, { ref: '祖玛卫士' }, { ref: '祖玛教主' },
  ]},
  { floor: 9, cost: 7000, monsters: [
    { name: '双头金钢', hp: 3000, minAtk: 30, maxAtk: 60, minDef: 15, minMagDef: 15, exp: 5000, level: 55, type: 'elite' },
    { name: '双头血魔', hp: 3500, minAtk: 35, maxAtk: 65, minDef: 18, minMagDef: 18, exp: 5500, level: 55, type: 'elite', skills: [{name:'吸血',type:'lifesteal',chance:0.25,power:0.5}] },
    { ref: '赤月恶魔' },
  ]},
  { floor: 10, cost: 10000, monsters: [
    { ref: '虹魔教主' }, { ref: '虹魔猪卫' }, { ref: '虹魔猪卫' },
  ]},
  { floor: 11, cost: 12000, monsters: [
    { ref: '黄泉教主' },
    { name: '恶灵教主', hp: 8000, minAtk: 40, maxAtk: 75, minDef: 25, minMagDef: 25, exp: 9000, level: 60, type: 'boss', skills: [{name:'恶灵诅咒',type:'magic',chance:0.3,power:1.4},{name:'召唤恶灵',type:'summon',chance:0.2,power:0.6}] },
    { ref: '牛魔王' },
  ]},
  { floor: 12, cost: 15000, monsters: [
    { ref: '魔龙战将' }, { ref: '魔龙战将' }, { ref: '魔龙教主' },
  ]},
  { floor: 13, cost: 18000, monsters: [
    { name: '金仗蜘蛛', hp: 2000, minAtk: 45, maxAtk: 70, minDef: 20, minMagDef: 20, exp: 6000, level: 58, type: 'normal' },
    { name: '绿魔蜘蛛', hp: 2200, minAtk: 48, maxAtk: 75, minDef: 22, minMagDef: 22, exp: 6500, level: 58, type: 'normal', skills: [{name:'毒丝',type:'poison',chance:0.3,power:0.6}] },
    { name: '雷炎蛛王', hp: 20000, minAtk: 55, maxAtk: 100, minDef: 35, minMagDef: 35, exp: 25000, level: 60, type: 'boss', skills: [{name:'雷炎',type:'magic',chance:0.35,power:1.5},{name:'蛛网',type:'paralysis',chance:0.12,power:0}] },
  ]},
  { floor: 14, cost: 20000, monsters: [
    { name: '圣殿黄龙', hp: 2500, minAtk: 50, maxAtk: 80, minDef: 25, minMagDef: 25, exp: 7000, level: 58, type: 'elite' },
    { name: '圣殿黄龙', hp: 2500, minAtk: 50, maxAtk: 80, minDef: 25, minMagDef: 25, exp: 7000, level: 58, type: 'elite' },
    { name: '骷髅统领', hp: 22000, minAtk: 55, maxAtk: 105, minDef: 35, minMagDef: 35, exp: 28000, level: 60, type: 'boss', skills: [{name:'统领一击',type:'magic',chance:0.3,power:1.5},{name:'召唤骷髅',type:'summon',chance:0.2,power:0.7}] },
  ]},
  { floor: 15, cost: 22000, monsters: [
    { name: '狐月弓箭手', hp: 2000, minAtk: 45, maxAtk: 75, minDef: 20, minMagDef: 20, exp: 6000, level: 55, type: 'normal' },
    { name: '狐月弓箭手', hp: 2000, minAtk: 45, maxAtk: 75, minDef: 20, minMagDef: 20, exp: 6000, level: 55, type: 'normal' },
    { ref: '狐月天珠' },
  ]},
  { floor: 16, cost: 25000, monsters: [
    { name: '雪域天将', hp: 3000, minAtk: 55, maxAtk: 90, minDef: 28, minMagDef: 28, exp: 8000, level: 60, type: 'elite' },
    { name: '雪域天将', hp: 3000, minAtk: 55, maxAtk: 90, minDef: 28, minMagDef: 28, exp: 8000, level: 60, type: 'elite' },
    { name: '雪域魔王', hp: 28000, minAtk: 65, maxAtk: 120, minDef: 40, minMagDef: 40, exp: 35000, level: 60, type: 'boss', skills: [{name:'冰封万里',type:'freeze',chance:0.15,power:0},{name:'雪暴',type:'magic',chance:0.35,power:1.6}] },
  ]},
  { floor: 17, cost: 28000, monsters: [
    { name: '火龙将军', hp: 3500, minAtk: 58, maxAtk: 95, minDef: 30, minMagDef: 30, exp: 9000, level: 60, type: 'elite' },
    { name: '火龙将军', hp: 3500, minAtk: 58, maxAtk: 95, minDef: 30, minMagDef: 30, exp: 9000, level: 60, type: 'elite' },
    { ref: '火龙教主' },
  ]},
  { floor: 18, cost: 30000, monsters: [
    { name: '静之火灵', hp: 2500, minAtk: 50, maxAtk: 85, minDef: 25, minMagDef: 25, exp: 7000, level: 60, type: 'elite' },
    { name: '怒之火灵', hp: 2800, minAtk: 55, maxAtk: 90, minDef: 28, minMagDef: 28, exp: 7500, level: 60, type: 'elite', skills: [{name:'怒火',type:'magic',chance:0.3,power:1.3}] },
    { name: '火龙', hp: 25000, minAtk: 60, maxAtk: 110, minDef: 38, minMagDef: 38, exp: 30000, level: 60, type: 'boss', skills: [{name:'龙息',type:'magic',chance:0.35,power:1.6},{name:'灼烧',type:'poison',chance:0.2,power:0.6}] },
  ]},
  { floor: 19, cost: 32000, monsters: [
    { name: '黑暗女妖', hp: 3000, minAtk: 55, maxAtk: 90, minDef: 28, minMagDef: 28, exp: 8000, level: 60, type: 'elite', skills: [{name:'妖术',type:'magic',chance:0.3,power:1.3}] },
    { name: '黑暗女妖', hp: 3000, minAtk: 55, maxAtk: 90, minDef: 28, minMagDef: 28, exp: 8000, level: 60, type: 'elite', skills: [{name:'妖术',type:'magic',chance:0.3,power:1.3}] },
  ]},
  { floor: 20, cost: 35000, monsters: [
    { name: '嗜魂者', hp: 3500, minAtk: 60, maxAtk: 95, minDef: 30, minMagDef: 30, exp: 9000, level: 60, type: 'elite', skills: [{name:'嗜魂',type:'lifesteal',chance:0.25,power:0.5}] },
    { name: '嗜血者', hp: 3500, minAtk: 60, maxAtk: 100, minDef: 30, minMagDef: 30, exp: 9500, level: 60, type: 'elite', skills: [{name:'嗜血',type:'lifesteal',chance:0.3,power:0.5}] },
  ]},
  { floor: 21, cost: 38000, monsters: [
    { name: '泯灭战士', hp: 3500, minAtk: 60, maxAtk: 100, minDef: 30, minMagDef: 30, exp: 9000, level: 60, type: 'elite' },
    { name: '泯灭斗士', hp: 3800, minAtk: 62, maxAtk: 105, minDef: 32, minMagDef: 32, exp: 9500, level: 60, type: 'elite' },
    { name: '泯灭脑魔', hp: 30000, minAtk: 65, maxAtk: 125, minDef: 40, minMagDef: 40, exp: 38000, level: 60, type: 'boss', skills: [{name:'精神崩溃',type:'magic',chance:0.35,power:1.6},{name:'恐惧',type:'paralysis',chance:0.12,power:0}] },
  ]},
  { floor: 22, cost: 40000, monsters: [
    { name: '地之护法', hp: 4000, minAtk: 65, maxAtk: 105, minDef: 33, minMagDef: 33, exp: 10000, level: 60, type: 'elite' },
    { name: '地之护法', hp: 4000, minAtk: 65, maxAtk: 105, minDef: 33, minMagDef: 33, exp: 10000, level: 60, type: 'elite' },
    { name: '不屈英灵', hp: 32000, minAtk: 70, maxAtk: 130, minDef: 42, minMagDef: 42, exp: 40000, level: 60, type: 'boss', skills: [{name:'英灵之怒',type:'magic',chance:0.35,power:1.7},{name:'震地',type:'paralysis',chance:0.12,power:0}] },
  ]},
  { floor: 23, cost: 42000, monsters: [
    { name: '幽灵捍卫者', hp: 4000, minAtk: 65, maxAtk: 110, minDef: 33, minMagDef: 33, exp: 10000, level: 60, type: 'elite' },
    { name: '幽灵捍卫者', hp: 4000, minAtk: 65, maxAtk: 110, minDef: 33, minMagDef: 33, exp: 10000, level: 60, type: 'elite' },
    { name: '幽灵教主', hp: 35000, minAtk: 70, maxAtk: 135, minDef: 42, minMagDef: 42, exp: 42000, level: 60, type: 'boss', skills: [{name:'幽灵诅咒',type:'magic',chance:0.35,power:1.7},{name:'召唤幽灵',type:'summon',chance:0.2,power:0.7}] },
  ]},
  { floor: 24, cost: 45000, monsters: [
    { name: '破碎斗魂', hp: 4500, minAtk: 70, maxAtk: 115, minDef: 35, minMagDef: 35, exp: 11000, level: 60, type: 'elite' },
    { name: '破碎幽魂', hp: 4500, minAtk: 70, maxAtk: 115, minDef: 35, minMagDef: 35, exp: 11000, level: 60, type: 'elite', skills: [{name:'幽魂缠绕',type:'poison',chance:0.3,power:0.6}] },
    { name: '太阴玉兔', hp: 35000, minAtk: 72, maxAtk: 135, minDef: 43, minMagDef: 43, exp: 45000, level: 60, type: 'boss', skills: [{name:'月华',type:'magic',chance:0.35,power:1.7},{name:'冰冻',type:'freeze',chance:0.12,power:0}] },
  ]},
  { floor: 25, cost: 48000, monsters: [
    { name: '狂暴', hp: 5000, minAtk: 75, maxAtk: 120, minDef: 35, minMagDef: 35, exp: 12000, level: 60, type: 'elite', skills: [{name:'狂暴一击',type:'magic',chance:0.3,power:1.4}] },
    { name: '嗜血', hp: 5000, minAtk: 75, maxAtk: 120, minDef: 35, minMagDef: 35, exp: 12000, level: 60, type: 'elite', skills: [{name:'嗜血',type:'lifesteal',chance:0.3,power:0.5}] },
  ]},
  { floor: 26, cost: 50000, monsters: [
    { name: '月灵之神', hp: 5000, minAtk: 78, maxAtk: 125, minDef: 38, minMagDef: 38, exp: 13000, level: 60, type: 'elite', skills: [{name:'月灵术',type:'magic',chance:0.3,power:1.5}] },
    { name: '迷惑之神', hp: 5000, minAtk: 78, maxAtk: 125, minDef: 38, minMagDef: 38, exp: 13000, level: 60, type: 'elite', skills: [{name:'迷惑',type:'paralysis',chance:0.15,power:0}] },
    { name: '洪荒之神', hp: 40000, minAtk: 80, maxAtk: 145, minDef: 45, minMagDef: 45, exp: 50000, level: 60, type: 'boss', skills: [{name:'洪荒之力',type:'magic',chance:0.4,power:1.8},{name:'震地',type:'paralysis',chance:0.12,power:0}] },
  ]},
  { floor: 27, cost: 55000, monsters: [
    { name: '封印之神', hp: 5500, minAtk: 80, maxAtk: 130, minDef: 40, minMagDef: 40, exp: 14000, level: 60, type: 'elite' },
    { name: '封印之神', hp: 5500, minAtk: 80, maxAtk: 130, minDef: 40, minMagDef: 40, exp: 14000, level: 60, type: 'elite' },
    { name: '失落魔王', hp: 42000, minAtk: 82, maxAtk: 150, minDef: 46, minMagDef: 46, exp: 55000, level: 60, type: 'boss', skills: [{name:'魔王之怒',type:'magic',chance:0.4,power:1.8},{name:'召唤魔物',type:'summon',chance:0.2,power:0.8}] },
  ]},
  { floor: 28, cost: 60000, monsters: [
    { name: '藏月妖魅', hp: 5500, minAtk: 82, maxAtk: 135, minDef: 40, minMagDef: 40, exp: 14000, level: 60, type: 'elite', skills: [{name:'妖魅术',type:'magic',chance:0.3,power:1.5}] },
    { name: '藏月妖魅', hp: 5500, minAtk: 82, maxAtk: 135, minDef: 40, minMagDef: 40, exp: 14000, level: 60, type: 'elite', skills: [{name:'妖魅术',type:'magic',chance:0.3,power:1.5}] },
    { name: '邀月', hp: 45000, minAtk: 85, maxAtk: 155, minDef: 48, minMagDef: 48, exp: 58000, level: 60, type: 'boss', skills: [{name:'邀月斩',type:'magic',chance:0.4,power:1.9},{name:'月华冰冻',type:'freeze',chance:0.15,power:0}] },
  ]},
  { floor: 29, cost: 65000, monsters: [
    { name: '邪魔', hp: 6000, minAtk: 85, maxAtk: 140, minDef: 42, minMagDef: 42, exp: 15000, level: 60, type: 'elite', skills: [{name:'邪术',type:'magic',chance:0.3,power:1.5}] },
    { name: '邪魔', hp: 6000, minAtk: 85, maxAtk: 140, minDef: 42, minMagDef: 42, exp: 15000, level: 60, type: 'elite', skills: [{name:'邪术',type:'magic',chance:0.3,power:1.5}] },
    { name: '深渊', hp: 48000, minAtk: 88, maxAtk: 160, minDef: 50, minMagDef: 50, exp: 60000, level: 60, type: 'boss', skills: [{name:'深渊吞噬',type:'magic',chance:0.4,power:1.9},{name:'恐惧',type:'paralysis',chance:0.15,power:0},{name:'召唤深渊',type:'summon',chance:0.15,power:0.8}] },
  ]},
  { floor: 30, cost: 70000, monsters: [
    { name: '祭血亡灵', hp: 6500, minAtk: 88, maxAtk: 145, minDef: 45, minMagDef: 45, exp: 16000, level: 60, type: 'elite', skills: [{name:'亡灵诅咒',type:'poison',chance:0.3,power:0.7}] },
    { name: '祭血亡灵', hp: 6500, minAtk: 88, maxAtk: 145, minDef: 45, minMagDef: 45, exp: 16000, level: 60, type: 'elite', skills: [{name:'亡灵诅咒',type:'poison',chance:0.3,power:0.7}] },
    { name: '祭血心魔', hp: 50000, minAtk: 90, maxAtk: 170, minDef: 50, minMagDef: 50, exp: 65000, level: 60, type: 'boss', skills: [{name:'心魔噬魂',type:'magic',chance:0.4,power:2.0},{name:'恐惧',type:'paralysis',chance:0.15,power:0},{name:'吸血',type:'lifesteal',chance:0.25,power:0.6}] },
  ]},
];
