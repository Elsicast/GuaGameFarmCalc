// 地图与怪物投放数据 - 严格来自 mongen.txt 和 mapinfo.txt
const MAPS = [
  {
    id: 'newbie', name: '比奇新手村', levelReq: 1,
    monsters: [
      { name: '鸡', count: 60 }, { name: '鹿', count: 40 }
    ]
  },
  {
    id: '0', name: '比奇省', levelReq: 1,
    monsters: [
      { name: '鸡', count: 40 }, { name: '鹿', count: 40 },
      { name: '蛤蟆', count: 15 }, { name: '稻草人', count: 40 },
      { name: '多钩猫', count: 40 }, { name: '钉耙猫', count: 40 },
      { name: '毒蜘蛛', count: 30 }, { name: '食人花', count: 40 },
      { name: '半兽人', count: 50 }, { name: '森林雪人', count: 30 }
    ]
  },
  {
    id: '1', name: '沃玛森林', levelReq: 5,
    monsters: [
      { name: '森林雪人', count: 35 }, { name: '半兽人', count: 200 },
      { name: '半兽战士', count: 40 }, { name: '半兽勇士', count: 2 },
      { name: '毒蜘蛛', count: 50 }, { name: '食人花', count: 100 },
      { name: '钉耙猫', count: 40 }, { name: '多钩猫', count: 40 }
    ]
  },
  {
    id: '2', name: '盟重省', levelReq: 5,
    monsters: [
      { name: '红蛇', count: 300 }, { name: '虎蛇', count: 80 },
      { name: '毒蜘蛛', count: 40 }, { name: '半兽人', count: 90 },
      { name: '多钩猫', count: 50 }, { name: '钉耙猫', count: 50 },
      { name: '食人花', count: 40 }
    ]
  },
  {
    id: '3', name: '盟重荒野', levelReq: 6,
    monsters: [
      { name: '羊', count: 100 }, { name: '猎鹰', count: 30 },
      { name: '盔甲虫', count: 150 }, { name: '沙虫', count: 40 },
      { name: '多角虫', count: 100 }, { name: '巨型多角虫', count: 1 },
      { name: '狼', count: 100 }, { name: '虎蛇', count: 80 }
    ]
  },
  {
    id: '5', name: '盟重荒野(深处)', levelReq: 10,
    monsters: [
      { name: '盔甲虫', count: 80 }, { name: '多角虫', count: 80 },
      { name: '狼', count: 60 }, { name: '巨型多角虫', count: 2 },
      { name: '幻影寒虎', count: 1 }
    ]
  },
  {
    id: 'D001', name: '矿洞一层', levelReq: 8,
    monsters: [
      { name: '蝎子', count: 100 }, { name: '骷髅', count: 160 },
      { name: '骷髅战士', count: 120 }, { name: '洞蛆', count: 70 },
      { name: '山洞蝙蝠', count: 45 }
    ]
  },
  {
    id: 'D002', name: '矿洞二层', levelReq: 9,
    monsters: [
      { name: '洞蛆', count: 80 }, { name: '骷髅战士', count: 140 },
      { name: '掷斧骷髅', count: 80 }, { name: '骷髅战将', count: 100 },
      { name: '骷髅', count: 80 }, { name: '山洞蝙蝠', count: 40 },
      { name: '骷髅精灵', count: 1 }
    ]
  },
  {
    id: 'D003', name: '矿洞三层', levelReq: 10,
    monsters: [
      { name: '洞蛆', count: 80 }, { name: '骷髅战士', count: 120 },
      { name: '掷斧骷髅', count: 80 }, { name: '骷髅战将', count: 120 },
      { name: '骷髅', count: 100 }, { name: '山洞蝙蝠', count: 40 },
      { name: '骷髅精灵', count: 2 }
    ]
  },
  {
    id: 'D401', name: '僵尸洞一层', levelReq: 9,
    monsters: [
      { name: '僵尸2', count: 75 }, { name: '僵尸3', count: 75 },
      { name: '洞蛆', count: 45 }
    ]
  },
  {
    id: 'D402', name: '僵尸洞二层', levelReq: 10,
    monsters: [
      { name: '僵尸2', count: 75 }, { name: '僵尸3', count: 75 },
      { name: '洞蛆', count: 45 }
    ]
  },
  {
    id: 'D404', name: '尸王殿', levelReq: 12,
    monsters: [
      { name: '僵尸1', count: 30 }, { name: '僵尸3', count: 75 },
      { name: '僵尸4', count: 75 }, { name: '尸王', count: 1 }
    ]
  },
  {
    id: 'D022', name: '沃玛神殿一层', levelReq: 12,
    monsters: [
      { name: '粪虫', count: 120 }, { name: '沃玛战士', count: 140 },
      { name: '沃玛勇士', count: 90 }, { name: '沃玛战将', count: 90 },
      { name: '火焰沃玛', count: 60 }, { name: '沃玛卫士', count: 2 }
    ]
  },
  {
    id: 'D023', name: '沃玛神殿二层', levelReq: 14,
    monsters: [
      { name: '暗黑战士', count: 100 }, { name: '粪虫', count: 60 },
      { name: '沃玛战士', count: 80 }, { name: '沃玛勇士', count: 120 },
      { name: '沃玛战将', count: 120 }, { name: '火焰沃玛', count: 80 },
      { name: '沃玛卫士', count: 2 }
    ]
  },
  {
    id: 'D024', name: '沃玛教主大厅', levelReq: 18,
    monsters: [
      { name: '沃玛教主', count: 1 }, { name: '沃玛卫士', count: 1 },
      { name: '沃玛勇士', count: 7 }, { name: '沃玛战将', count: 7 },
      { name: '火焰沃玛', count: 7 }, { name: '暗黑战士', count: 8 }
    ]
  },
  {
    id: '12', name: '森林迷宫', levelReq: 13,
    monsters: [
      { name: '天狼蜘蛛', count: 80 }, { name: '暴牙蜘蛛', count: 50 },
      { name: '花吻蜘蛛', count: 20 }, { name: '幻影蜘蛛', count: 20 },
      { name: '神石毒魔蛛', count: 1 }
    ]
  },
  {
    id: 'D501', name: '祖玛寺庙一层', levelReq: 14,
    monsters: [
      { name: '楔蛾', count: 20 }, { name: '角蝇', count: 3 },
      { name: '大老鼠', count: 20 }
    ]
  },
  {
    id: 'D503', name: '祖玛寺庙三层', levelReq: 16,
    monsters: [
      { name: '祖玛弓箭手', count: 16 }, { name: '祖玛雕像', count: 16 },
      { name: '祖玛卫士', count: 16 }, { name: '楔蛾', count: 16 },
      { name: '角蝇', count: 3 }, { name: '大老鼠', count: 80 }
    ]
  },
  {
    id: 'D504', name: '祖玛寺庙四层', levelReq: 17,
    monsters: [
      { name: '祖玛弓箭手', count: 100 }, { name: '祖玛雕像', count: 100 },
      { name: '祖玛卫士', count: 100 }, { name: '楔蛾', count: 100 },
      { name: '角蝇', count: 3 }, { name: '大老鼠', count: 100 },
      { name: '祖玛击雷将', count: 1 }
    ]
  },
  {
    id: 'D505', name: '祖玛教主大厅', levelReq: 20,
    monsters: [
      { name: '祖玛教主', count: 1 },
      { name: '祖玛弓箭手', count: 100 }, { name: '祖玛雕像', count: 100 },
      { name: '祖玛卫士', count: 100 }, { name: '楔蛾', count: 100 }
    ]
  },
  // === 死亡棺材(蜈蚣洞) ===
  {
    id: 'D601', name: '死亡棺材一层', levelReq: 15,
    monsters: [
      { name: '蜈蚣', count: 80 }, { name: '跳跳蜂', count: 60 },
      { name: '巨型蠕虫', count: 40 }, { name: '黑色恶蛆', count: 30 }
    ]
  },
  {
    id: 'D602', name: '死亡棺材二层', levelReq: 16,
    monsters: [
      { name: '蜈蚣', count: 60 }, { name: '钳虫', count: 80 },
      { name: '黑色恶蛆', count: 50 }, { name: '巨型蠕虫', count: 40 }
    ]
  },
  {
    id: 'D603', name: '死亡棺材三层', levelReq: 18,
    monsters: [
      { name: '钳虫', count: 100 }, { name: '黑色恶蛆', count: 80 },
      { name: '巨型蠕虫', count: 60 }, { name: '邪恶钳虫', count: 1 }
    ]
  },
  {
    id: 'D606', name: '触龙神巢穴', levelReq: 25,
    monsters: [
      { name: '触龙神', count: 1 },
      { name: '钳虫', count: 40 }, { name: '黑色恶蛆', count: 30 }
    ]
  },
  // === 石墓阵(野猪洞) ===
  {
    id: 'D711', name: '石墓阵一层', levelReq: 16,
    monsters: [
      { name: '红野猪', count: 80 }, { name: '黑野猪', count: 40 },
      { name: '蝎蛇', count: 30 }
    ]
  },
  {
    id: 'D713', name: '石墓阵三层', levelReq: 18,
    monsters: [
      { name: '红野猪', count: 60 }, { name: '黑野猪', count: 80 },
      { name: '蝎蛇', count: 60 }, { name: '白野猪', count: 1 }
    ]
  },
  {
    id: 'D715', name: '石墓阵五层', levelReq: 20,
    monsters: [
      { name: '黑野猪', count: 100 }, { name: '蝎蛇', count: 80 },
      { name: '红野猪', count: 60 }, { name: '白野猪', count: 2 },
      { name: '邪恶毒蛇', count: 1 }
    ]
  },
  {
    id: 'D717', name: '石墓阵七层', levelReq: 22,
    monsters: [
      { name: '黑野猪', count: 80 }, { name: '蝎蛇', count: 100 },
      { name: '白野猪', count: 3 }, { name: '邪恶毒蛇', count: 2 }
    ]
  },
  // === 赤月蜘蛛洞 ===
  {
    id: 'D10011', name: '赤月峡谷入口', levelReq: 18,
    monsters: [
      { name: '月魔蜘蛛', count: 60 }, { name: '天狼蜘蛛', count: 60 },
      { name: '钢牙蜘蛛', count: 40 }, { name: '花吻蜘蛛', count: 40 }
    ]
  },
  {
    id: 'D10031', name: '赤月峡谷深处', levelReq: 20,
    monsters: [
      { name: '月魔蜘蛛', count: 80 }, { name: '黑锷蜘蛛', count: 60 },
      { name: '钢牙蜘蛛', count: 50 }, { name: '幻影蜘蛛', count: 20 },
      { name: '血僵尸', count: 30 }
    ]
  },
  {
    id: 'D10051', name: '赤月魔穴', levelReq: 25,
    monsters: [
      { name: '血僵尸', count: 80 }, { name: '血巨人', count: 20 },
      { name: '幻影蜘蛛', count: 30 }, { name: '黑锷蜘蛛', count: 60 },
      { name: '神石毒魔蛛', count: 1 }
    ]
  },
  {
    id: 'D10062', name: '赤月恶魔巢穴', levelReq: 30,
    monsters: [
      { name: '赤月恶魔', count: 1 },
      { name: '血巨人', count: 10 }, { name: '血僵尸', count: 40 }
    ]
  },
  // === 封魔谷 ===
  {
    id: 'D2001', name: '封魔谷外围', levelReq: 20,
    monsters: [
      { name: '封魔弓箭手', count: 60 }, { name: '封魔雕像', count: 40 },
      { name: '封魔卫士', count: 30 }
    ]
  },
  {
    id: 'D2005', name: '封魔谷矿区', levelReq: 22,
    monsters: [
      { name: '封魔卫士', count: 60 }, { name: '封魔护卫', count: 40 },
      { name: '封魔尸王', count: 1 }, { name: '封魔弓箭手', count: 40 }
    ]
  },
  {
    id: 'D2009', name: '封魔谷深处', levelReq: 24,
    monsters: [
      { name: '封魔护卫', count: 60 }, { name: '虹魔蝎卫', count: 40 },
      { name: '虹魔猪卫', count: 30 }, { name: '封魔白野猪', count: 1 }
    ]
  },
  {
    id: 'D2011', name: '封魔殿', levelReq: 26,
    monsters: [
      { name: '虹魔蝎卫', count: 60 }, { name: '虹魔猪卫', count: 60 },
      { name: '虹魔教主', count: 1 }, { name: '封魔白野猪', count: 2 }
    ]
  },
  {
    id: 'D2012', name: '封魔沃玛神殿', levelReq: 22,
    monsters: [
      { name: '封魔沃玛教主', count: 1 },
      { name: '封魔卫士', count: 40 }, { name: '封魔护卫', count: 30 }
    ]
  },
  {
    id: 'D2013', name: '封魔祖玛神殿', levelReq: 25,
    monsters: [
      { name: '封魔祖玛教主', count: 1 },
      { name: '封魔雕像', count: 40 }, { name: '封魔卫士', count: 40 }
    ]
  },
  // === 恶灵洞穴 ===
  {
    id: 'D2051', name: '恶灵洞穴一层', levelReq: 18,
    monsters: [
      { name: '恶灵僵尸', count: 80 }, { name: '僵尸4', count: 40 },
      { name: '僵尸5', count: 30 }
    ]
  },
  {
    id: 'D2053', name: '恶灵洞穴深处', levelReq: 22,
    monsters: [
      { name: '恶灵僵尸', count: 100 }, { name: '恶灵尸王', count: 2 }
    ]
  },
  // === 骷髅神殿 ===
  {
    id: 'D2061', name: '骷髅神殿一层', levelReq: 20,
    monsters: [
      { name: '骷髅长枪兵', count: 60 }, { name: '骷髅刀斧手', count: 50 },
      { name: '骷髅弓箭手', count: 40 }
    ]
  },
  {
    id: 'D2063', name: '骷髅神殿三层', levelReq: 23,
    monsters: [
      { name: '骷髅刀斧手', count: 60 }, { name: '骷髅锤兵', count: 50 },
      { name: '骷髅长枪兵', count: 40 }, { name: '骷髅弓箭手', count: 30 }
    ]
  },
  {
    id: 'D2067', name: '黄泉教主大厅', levelReq: 28,
    monsters: [
      { name: '黄泉教主', count: 1 },
      { name: '骷髅锤兵', count: 30 }, { name: '骷髅刀斧手', count: 30 }
    ]
  },
  // === 牛魔寺庙 ===
  {
    id: 'D2071', name: '牛魔寺庙一层', levelReq: 20,
    monsters: [
      { name: '牛头魔', count: 60 }, { name: '牛魔战士', count: 50 },
      { name: '牛魔斗士', count: 30 }
    ]
  },
  {
    id: 'D2075', name: '牛魔寺庙五层', levelReq: 24,
    monsters: [
      { name: '牛魔战士', count: 60 }, { name: '牛魔斗士', count: 50 },
      { name: '牛魔法师', count: 40 }, { name: '牛魔侍卫', count: 20 },
      { name: '牛魔将军', count: 2 }
    ]
  },
  {
    id: 'D2079', name: '牛魔王大厅', levelReq: 28,
    monsters: [
      { name: '牛魔王', count: 1 },
      { name: '牛魔将军', count: 4 }, { name: '牛魔祭司', count: 6 },
      { name: '牛魔侍卫', count: 10 }
    ]
  },
  // === 魔龙城 ===
  {
    id: '6', name: '魔龙城', levelReq: 25,
    monsters: [
      { name: '魔龙刀兵', count: 80 }, { name: '魔龙射手', count: 60 },
      { name: '魔龙破甲兵', count: 50 }, { name: '魔龙石碑', count: 30 }
    ]
  },
  {
    id: '63', name: '魔龙西关', levelReq: 27,
    monsters: [
      { name: '魔龙力士', count: 60 }, { name: '魔龙破甲兵', count: 50 },
      { name: '魔龙射手', count: 40 }, { name: '魔龙战将', count: 2 }
    ]
  },
  {
    id: '65', name: '魔龙北关', levelReq: 29,
    monsters: [
      { name: '魔龙力士', count: 80 }, { name: '魔龙战将', count: 10 },
      { name: '魔龙巨蛾', count: 5 }, { name: '魔龙石碑', count: 30 }
    ]
  },
  {
    id: '66', name: '魔龙血域', levelReq: 35,
    monsters: [
      { name: '魔龙教主', count: 1 },
      { name: '魔龙战将', count: 20 }, { name: '魔龙巨蛾', count: 10 },
      { name: '魔龙力士', count: 30 }
    ]
  },
  // === 雷炎洞穴/火龙殿 ===
  {
    id: 'D2081', name: '雷炎洞穴一层', levelReq: 30,
    monsters: [
      { name: '魔龙力士', count: 60 }, { name: '魔龙战将', count: 20 },
      { name: '魔龙巨蛾', count: 10 }
    ]
  },
  {
    id: 'D2083', name: '火龙殿', levelReq: 38,
    monsters: [
      { name: '火龙教主', count: 1 },
      { name: '魔龙战将', count: 15 }, { name: '魔龙巨蛾', count: 8 }
    ]
  },
  // === 狐月山 ===
  {
    id: 'fox01', name: '狐月山外围', levelReq: 22,
    monsters: [
      { name: '狐月角虫', count: 60 }, { name: '狐月虎虫', count: 50 },
      { name: '狐月之眼', count: 30 }
    ]
  },
  {
    id: 'fox02', name: '狐月山深处', levelReq: 25,
    monsters: [
      { name: '狐月黑狐', count: 50 }, { name: '狐月赤狐', count: 40 },
      { name: '狐月素狐', count: 30 }, { name: '狐月魔眼', count: 20 },
      { name: '狐月天珠', count: 1 }
    ]
  },
  {
    id: 'fox03', name: '狐月山禁地', levelReq: 28,
    monsters: [
      { name: '狐月素狐', count: 50 }, { name: '狐月魔眼', count: 30 },
      { name: '狐月天珠', count: 2 }, { name: '狐月魂石', count: 1 }
    ]
  },
  // === 血红洞窟 ===
  {
    id: 'hsdk1', name: '血红洞窟一层', levelReq: 22,
    monsters: [
      { name: '红洞僵尸', count: 60 }, { name: '红洞青尸', count: 50 },
      { name: '红洞鼠怪', count: 40 }
    ]
  },
  {
    id: 'hsdk2', name: '血红洞窟二层', levelReq: 25,
    monsters: [
      { name: '红洞狂鼠怪', count: 60 }, { name: '红洞噬魂怪', count: 40 },
      { name: '红洞青尸', count: 40 }, { name: '红洞束魂怪', count: 20 }
    ]
  },
  {
    id: 'hsdk3', name: '血红洞窟深处', levelReq: 28,
    monsters: [
      { name: '红洞束魂怪', count: 60 }, { name: '红洞噬魂怪', count: 40 },
      { name: '红洞怨恶', count: 2 }
    ]
  },
  // === 南蛮 ===
  {
    id: 'ygfx1', name: '南蛮荒原', levelReq: 28,
    monsters: [
      { name: '南蛮寒狼', count: 60 }, { name: '南蛮狂狼', count: 40 },
      { name: '南蛮黑猩猩', count: 30 }, { name: '南蛮黑虎', count: 20 }
    ]
  },
  {
    id: 'ygfx2', name: '南蛮深处', levelReq: 32,
    monsters: [
      { name: '南蛮白虎', count: 40 }, { name: '南蛮白象', count: 30 },
      { name: '南蛮犀牛', count: 30 }, { name: '南蛮逆天鬼', count: 20 },
      { name: '南蛮灭鬼', count: 15 }
    ]
  },
  {
    id: 'ygfx3', name: '南蛮禁地', levelReq: 36,
    monsters: [
      { name: '南蛮黑天鬼', count: 40 }, { name: '南蛮寒天鬼', count: 30 },
      { name: '南蛮丹墨', count: 2 }, { name: '南蛮野兽王', count: 1 }
    ]
  },

  // ==================== 二大陆（遮天篇，continent: 2） ====================
  // 进入门槛：通天塔通关30层 + 缴纳1000万金币（见 game.js changeMap）
  // R1 桃源过渡
  {
    id: 'R001', name: '桃源之门', levelReq: 40, continent: 2,
    monsters: [
      { name: '桃源刀兵', count: 40 }, { name: '桃源锤兵', count: 30 },
      { name: '桃源枪兵', count: 20 }, { name: '桃源恶尸', count: 20 },
      { name: '桃源领主', count: 1 }
    ]
  },
  // R2 石墓
  {
    id: 'C2D715', name: '遮天石墓五层', levelReq: 42, continent: 2,
    monsters: [
      { name: '遮天红野猪', count: 40 }, { name: '遮天黑野猪', count: 40 },
      { name: '遮天蝎蛇', count: 30 }
    ]
  },
  {
    id: 'D716', name: '遮天石墓六层', levelReq: 44, continent: 2,
    monsters: [
      { name: '遮天红野猪', count: 30 }, { name: '遮天黑野猪', count: 30 },
      { name: '遮天蝎蛇', count: 30 }, { name: '遮天楔蛾', count: 20 },
      { name: '遮天黑色恶蛆', count: 20 }
    ]
  },
  {
    id: 'D71601', name: '遮天石墓阵', levelReq: 45, continent: 2,
    monsters: [
      { name: '遮天黑色恶蛆', count: 40 }, { name: '遮天楔蛾', count: 30 },
      { name: '遮天蝎蛇', count: 30 }, { name: '遮天红野猪', count: 20 }
    ]
  },
  {
    id: 'C2D717', name: '遮天石墓七层', levelReq: 47, continent: 2,
    monsters: [
      { name: '遮天白野猪', count: 30 }, { name: '遮天楔蛾', count: 30 },
      { name: '遮天黑色恶蛆', count: 20 }, { name: '遮天蝎蛇', count: 20 }
    ]
  },
  {
    id: 'D717B', name: '遮天石墓王殿', levelReq: 49, continent: 2,
    monsters: [
      { name: '遮天石墓尸王', count: 1 }, { name: '遮天沃玛教主', count: 1 },
      { name: '遮天楔蛾', count: 15 }
    ]
  },
  // R3 祖玛
  {
    id: 'D5072', name: '遮天祖玛七层一', levelReq: 48, continent: 2,
    monsters: [
      { name: '遮天祖玛雕像', count: 40 }, { name: '遮天祖玛弓箭手', count: 40 },
      { name: '遮天祖玛卫士', count: 30 }, { name: '遮天楔蛾', count: 10 }
    ]
  },
  {
    id: 'D5073', name: '遮天祖玛七层二', levelReq: 50, continent: 2,
    monsters: [
      { name: '遮天祖玛卫士', count: 40 }, { name: '遮天祖玛雕像', count: 30 },
      { name: '遮天祖玛弓箭手', count: 30 }
    ]
  },
  {
    id: 'D5074', name: '遮天祖玛七层三', levelReq: 52, continent: 2,
    monsters: [
      { name: '遮天祖玛卫士', count: 40 }, { name: '遮天祖玛雕像', count: 30 },
      { name: '遮天祖玛弓箭手', count: 30 }
    ]
  },
  {
    id: 'D515', name: '遮天祖玛教主之家', levelReq: 54, continent: 2,
    monsters: [
      { name: '遮天沃玛卫士', count: 20 }, { name: '遮天楔蛾', count: 10 },
      { name: '遮天祖玛教主', count: 1 }, { name: '遮天祖玛教皇', count: 1 }
    ]
  },
  // R4 迷幻蚁国
  {
    id: 'E601', name: '迷幻蚁国外围', levelReq: 46, continent: 2,
    monsters: [
      { name: '工蚁', count: 50 }, { name: '兵蚁', count: 40 },
      { name: '毒蚁', count: 30 }
    ]
  },
  {
    id: 'E603', name: '迷幻蚁国深处', levelReq: 48, continent: 2,
    monsters: [
      { name: '兵蚁', count: 40 }, { name: '火蚁', count: 40 },
      { name: '毒蚁', count: 30 }, { name: '工蚁', count: 20 }
    ]
  },
  {
    id: 'E605', name: '蚁后巢穴', levelReq: 52, continent: 2,
    monsters: [
      { name: '蚁后', count: 1 }, { name: '兵蚁', count: 30 },
      { name: '火蚁', count: 25 }, { name: '毒蚁', count: 25 }
    ]
  },
  // R5 诺玛神殿
  {
    id: 'E701', name: '诺玛神殿一层', levelReq: 50, continent: 2,
    monsters: [
      { name: '诺玛战士', count: 40 }, { name: '诺玛法师', count: 35 },
      { name: '诺玛道士', count: 35 }
    ]
  },
  {
    id: 'E702', name: '诺玛神殿二层', levelReq: 53, continent: 2,
    monsters: [
      { name: '诺玛战神', count: 30 }, { name: '诺玛法神', count: 30 },
      { name: '诺玛道神', count: 30 }, { name: '诺玛战士', count: 20 }
    ]
  },
  {
    id: 'E703', name: '诺玛众神大殿', levelReq: 56, continent: 2,
    monsters: [
      { name: '诺玛战王', count: 1 }, { name: '诺玛法王', count: 1 },
      { name: '诺玛道王', count: 1 }, { name: '诺玛战神', count: 25 },
      { name: '诺玛法神', count: 25 }, { name: '诺玛道神', count: 25 }
    ]
  },
  // R6 毒蟾谷
  {
    id: '111', name: '毒蟾谷', levelReq: 50, continent: 2,
    monsters: [
      { name: '炽热之眼', count: 40 }, { name: '大地之眼', count: 30 },
      { name: '寒冰之眼', count: 30 }, { name: '沼泽之眼', count: 20 }
    ]
  },
  {
    id: '112', name: '毒蟾森林', levelReq: 54, continent: 2,
    monsters: [
      { name: '毒蟾教主', count: 1 }, { name: '巨毒蛇蝎', count: 30 },
      { name: '巨毒野猪', count: 30 }, { name: '镇谷魔兽', count: 20 },
      { name: '炽热之眼', count: 20 }
    ]
  },
  // R7 黑暗神殿
  {
    id: 'SW1', name: '黑暗神殿一层', levelReq: 52, continent: 2,
    monsters: [
      { name: '黑暗战士', count: 40 }, { name: '黑暗刀兵', count: 30 },
      { name: '黑暗锥兵', count: 30 }
    ]
  },
  {
    id: 'SW2', name: '黑暗神殿二层', levelReq: 54, continent: 2,
    monsters: [
      { name: '黑暗刀兵', count: 40 }, { name: '黑暗斧兵', count: 40 },
      { name: '黑暗战士', count: 30 }
    ]
  },
  {
    id: 'SW4', name: '黑暗神殿四层', levelReq: 57, continent: 2,
    monsters: [
      { name: '黑暗火投手', count: 40 }, { name: '舔血精兽', count: 35 },
      { name: '半月经轮', count: 25 }
    ]
  },
  {
    id: 'SW6', name: '黑暗神殿大厅', levelReq: 60, continent: 2,
    monsters: [
      { name: '蛇妖王', count: 1 }, { name: '黑暗教主', count: 1 },
      { name: '黑暗妖女', count: 15 }, { name: '黑暗刺魔', count: 25 },
      { name: '黑暗鬼魔', count: 25 }
    ]
  },
  // R8 天晶古墓
  {
    id: 'T_03', name: '天晶古墓一层', levelReq: 55, continent: 2,
    monsters: [
      { name: '古墓虎卫', count: 40 }, { name: '古墓亡魂', count: 35 },
      { name: '古墓鹰卫', count: 35 }
    ]
  },
  {
    id: 'T_04', name: '天晶古墓二层', levelReq: 57, continent: 2,
    monsters: [
      { name: '古墓巨斧怪', count: 35 }, { name: '古墓巨剑怪', count: 35 },
      { name: '古墓连弩怪', count: 30 }, { name: '古墓镰刀怪', count: 30 }
    ]
  },
  {
    id: 'T_06', name: '天晶古墓四层', levelReq: 60, continent: 2,
    monsters: [
      { name: '天晶左护法', count: 1 }, { name: '天晶右护法', count: 1 },
      { name: '古墓巨斧怪', count: 30 }, { name: '古墓连弩怪', count: 30 },
      { name: '古墓巨剑怪', count: 25 }
    ]
  },
  {
    id: 'T_07', name: '天晶古墓顶层', levelReq: 64, continent: 2,
    monsters: [
      { name: '铁血魔王', count: 1 }, { name: '白骨坟守', count: 1 },
      { name: '天晶聚魂石', count: 1 }, { name: '古墓石像', count: 15 },
      { name: '天晶翼魔', count: 10 }
    ]
  },
  // R9 地下宫殿
  {
    id: 'F011', name: '地下宫殿', levelReq: 62, continent: 2,
    monsters: [
      { name: '冥王', count: 1 }, { name: '宫殿神像', count: 1 },
      { name: '骷髅领主', count: 40 }, { name: '蝎蛇领主', count: 30 },
      { name: '沃玛领主', count: 30 }, { name: '野猪领主', count: 30 }
    ]
  },
  // R10 魔兽部落
  {
    id: 'DH01', name: '魔兽平原', levelReq: 60, continent: 2,
    monsters: [
      { name: '魔兽刀兵', count: 40 }, { name: '魔兽锤兵', count: 30 },
      { name: '魔兽射手', count: 30 }
    ]
  },
  {
    id: 'DH02', name: '魔兽峡谷', levelReq: 62, continent: 2,
    monsters: [
      { name: '魔兽锤兵', count: 35 }, { name: '魔兽破甲兵', count: 35 },
      { name: '魔兽巨蛾', count: 25 }
    ]
  },
  {
    id: 'DH03', name: '祭祀之地', levelReq: 65, continent: 2,
    monsters: [
      { name: '魔兽左护法', count: 1 }, { name: '魔兽右护法', count: 1 },
      { name: '魔兽刀兵', count: 30 }, { name: '魔兽破甲兵', count: 30 },
      { name: '魔兽巨蛾', count: 20 }
    ]
  },
  {
    id: 'DH04', name: '地之裂痕', levelReq: 68, continent: 2,
    monsters: [
      { name: '魔兽之主', count: 1 }, { name: '魔兽巨蛾', count: 20 },
      { name: '魔兽破甲兵', count: 20 }
    ]
  },
  // R11 潘夜神殿
  {
    id: 'C2D2075', name: '潘夜神殿一层', levelReq: 56, continent: 2,
    monsters: [
      { name: '潘夜斗士', count: 40 }, { name: '潘夜侍卫', count: 35 },
      { name: '潘夜战士', count: 35 }
    ]
  },
  {
    id: 'D2076', name: '潘夜神殿二层', levelReq: 58, continent: 2,
    monsters: [
      { name: '潘夜斗士', count: 35 }, { name: '潘夜将军', count: 30 },
      { name: '潘夜祭祀', count: 25 }
    ]
  },
  {
    id: 'D2078', name: '潘夜神殿三层', levelReq: 60, continent: 2,
    monsters: [
      { name: '潘夜将军', count: 30 }, { name: '潘夜祭司', count: 30 },
      { name: '潘夜斗士', count: 20 }
    ]
  },
  {
    id: 'C2D2079', name: '潘夜神殿底层', levelReq: 63, continent: 2,
    monsters: [
      { name: '黄泉教主', count: 1 }, { name: '牛魔教主', count: 1 },
      { name: '暗之牛魔教主', count: 1 }, { name: '潘夜将军', count: 25 },
      { name: '潘夜祭司', count: 25 }
    ]
  },
  // R12 血魔洞窟
  {
    id: 'D2004', name: '血魔前厅', levelReq: 58, continent: 2,
    monsters: [
      { name: '血魔骑士', count: 35 }, { name: '血魔卫士', count: 35 }
    ]
  },
  {
    id: 'D2006', name: '血魔大厅', levelReq: 60, continent: 2,
    monsters: [
      { name: '血魔骑士', count: 30 }, { name: '血魔卫士', count: 30 },
      { name: '血魔蝙蝠', count: 20 }
    ]
  },
  {
    id: 'D2010', name: '血魔长廊', levelReq: 62, continent: 2,
    monsters: [
      { name: '血魔箭兵', count: 40 }, { name: '血魔恶龙', count: 30 },
      { name: '血魔蝙蝠', count: 20 }
    ]
  },
  {
    id: 'C2D2012', name: '血魔正殿', levelReq: 64, continent: 2,
    monsters: [
      { name: '血魔教主', count: 1 }, { name: '血魔将军', count: 25 },
      { name: '血魔骑士', count: 20 }
    ]
  },
  {
    id: 'T218', name: '血魔密室', levelReq: 66, continent: 2,
    monsters: [
      { name: '天下恶魔', count: 1 }, { name: '千手观音', count: 1 },
      { name: '地狱修罗', count: 1 }, { name: '血魔将军', count: 10 },
      { name: '血魔蝙蝠', count: 10 }
    ]
  },
  // R13 鬼域
  {
    id: 'D1004', name: '鬼域之地', levelReq: 62, continent: 2,
    monsters: [
      { name: '鬼域僵尸', count: 40 }, { name: '鬼域枪兵', count: 25 },
      { name: '鬼域卫士', count: 25 }, { name: '鬼域蜘蛛', count: 20 }
    ]
  },
  {
    id: 'C2D10051', name: '鬼域秘道', levelReq: 64, continent: 2,
    monsters: [
      { name: '鬼域祭祀', count: 30 }, { name: '鬼域将军', count: 30 },
      { name: '鬼域僵尸', count: 20 }
    ]
  },
  {
    id: 'D10061', name: '鬼域祭坛', levelReq: 66, continent: 2,
    monsters: [
      { name: '鬼域金刚', count: 1 }, { name: '鬼域祭祀', count: 20 },
      { name: '鬼域将军', count: 20 }, { name: '鬼域蜘蛛', count: 15 }
    ]
  },
  {
    id: 'C2D10062', name: '鬼域魔穴', levelReq: 68, continent: 2,
    monsters: [
      { name: '鬼域血魔', count: 1 }, { name: '万恶之魔', count: 1 },
      { name: '鬼域法老', count: 20 }, { name: '鬼域将军', count: 15 }
    ]
  },
  // R14 葬神殿
  {
    id: 'HDG1', name: '葬神殿一层', levelReq: 72, continent: 2,
    monsters: [
      { name: '葬神判官', count: 30 }, { name: '葬神修罗', count: 30 },
      { name: '葬神爪牙', count: 30 }
    ]
  },
  {
    id: 'HDG2', name: '葬神殿二层', levelReq: 74, continent: 2,
    monsters: [
      { name: '葬神判官', count: 30 }, { name: '葬神修罗', count: 30 },
      { name: '葬神爪牙', count: 30 }
    ]
  },
  {
    id: 'HDG3', name: '葬神殿三层', levelReq: 76, continent: 2,
    monsters: [
      { name: '葬神恶龙', count: 25 }, { name: '葬神判官', count: 25 },
      { name: '葬神修罗', count: 25 }
    ]
  },
  {
    id: 'HDG4', name: '葬神王座', levelReq: 80, continent: 2,
    monsters: [
      { name: '鸠罗恶相', count: 1 }, { name: '葬神霸主', count: 1 },
      { name: '葬神恶龙', count: 20 }
    ]
  },
  // R15 冰原
  {
    id: 'XY1', name: '冰原地下一层', levelReq: 74, continent: 2,
    monsters: [
      { name: '冰美', count: 40 }, { name: '冰妖', count: 40 }
    ]
  },
  {
    id: 'XY3', name: '冰原地下三层', levelReq: 76, continent: 2,
    monsters: [
      { name: '冰原枪兵', count: 35 }, { name: '冰原战士', count: 35 },
      { name: '冰原寒冰魔', count: 20 }
    ]
  },
  {
    id: 'XY5', name: '冰原宫殿', levelReq: 80, continent: 2,
    monsters: [
      { name: '冰原魔王', count: 1 }, { name: '冰原战将', count: 30 },
      { name: '冰原寒冰魔', count: 20 }
    ]
  },
  {
    id: 'XY6', name: '冰原星空', levelReq: 82, continent: 2,
    monsters: [
      { name: '冰原魔王', count: 1 }, { name: '冰原战将', count: 25 },
      { name: '冰原五毒魔', count: 20 }
    ]
  },
  // R16 兽人迷阵
  {
    id: 'L01', name: '兽人迷阵·外环', levelReq: 76, continent: 2,
    monsters: [
      { name: '白发魔兽', count: 30 }, { name: '金甲骑士', count: 30 },
      { name: '死亡收割', count: 30 }
    ]
  },
  {
    id: 'L15', name: '兽人迷阵·中环', levelReq: 78, continent: 2,
    monsters: [
      { name: '蚩尤魔兽', count: 1 }, { name: '白发魔兽', count: 25 },
      { name: '金甲骑士', count: 25 }, { name: '死亡收割', count: 25 }
    ]
  },
  {
    id: 'L30', name: '兽人迷阵·核心', levelReq: 80, continent: 2,
    monsters: [
      { name: '蚩尤魔兽', count: 2 }, { name: '金甲骑士', count: 20 },
      { name: '死亡收割', count: 20 }
    ]
  },
  // R17 龙皇禁地
  {
    id: 'N1', name: '龙皇森林', levelReq: 82, continent: 2,
    monsters: [
      { name: '龙皇赤凰', count: 30 }, { name: '龙皇火法', count: 30 }
    ]
  },
  {
    id: 'N2', name: '龙皇古墓', levelReq: 84, continent: 2,
    monsters: [
      { name: '龙皇龙邪', count: 1 }, { name: '龙皇赤凰', count: 25 },
      { name: '龙皇火法', count: 25 }
    ]
  },
  {
    id: 'N3', name: '埋骨之地', levelReq: 86, continent: 2,
    monsters: [
      { name: '死亡毒寡', count: 1 }, { name: '死亡法神', count: 30 },
      { name: '死亡悍将', count: 30 }
    ]
  },
  {
    id: 'N4', name: '死亡禁地', levelReq: 90, continent: 2,
    monsters: [
      { name: '死亡魁拔', count: 1 }, { name: '死亡法神', count: 20 },
      { name: '死亡悍将', count: 20 }
    ]
  },
  // R18 地魔心脏
  {
    id: 'X_04', name: '地魔心脏', levelReq: 85, continent: 2,
    monsters: [
      { name: '地魔之核', count: 1 }, { name: '凶冥教主', count: 1 },
      { name: '炎魔领主', count: 1 }, { name: '幻海之灵', count: 1 },
      { name: '幻海守护者', count: 25 }, { name: '凶冥守护者', count: 25 },
      { name: '炎魔守护者', count: 25 }
    ]
  },
  // R19 火龙神殿（终局）
  {
    id: 'D2083B', name: '火龙神殿', levelReq: 88, continent: 2,
    monsters: [
      { name: '火龙神', count: 1 }
    ]
  }
];
