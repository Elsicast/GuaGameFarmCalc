# 🐉 挂机传奇 Farm 效率计算器

基于 [guagame.com](http://guagame.com/)（GeeM2 1.76 服务端）的挂机传奇游戏源码数据，计算每张地图的 farm 效率。

## 📐 功能

粘贴角色 JSON，自动计算每张地图的：

- **每分钟经验** — 逐怪扣防后按官方公式算击杀速度
- **每分钟金币** — 含专属掉落 + 通用掉落表
- **净金币/分** — 扣除红药 + 蓝药成本（按 autoHeal 真实选药逻辑）
- **安全度** — 按怪物实际伤害判断能否扛住
- **掉落明细** — 装备/技能书/特殊物品，带概率和来源怪物

## 🚀 使用

直接打开 `farm-calculator.html`（单文件自包含，双击即可），点「加载示例」看法师演示。

## 🔧 构建

`farm-calculator.html` 由构建脚本生成：

```bash
node build.js
```

源码文件：
- `app.js` — 核心算法（getStats / getDPS / calcMap）
- `style.css` — 样式
- `ui.html` — 页面结构
- `build.js` — 组装脚本

游戏数据（来自 guagame.com 源码）：
- `expTable.js` / `jobStats.js` — 经验表、职业成长
- `monsters.js` / `maps.js` — 怪物、地图
- `items.js` / `skills.js` — 装备、技能
- `drops.js` — 掉落表（专属 + 通用 GENERIC_DROPS）

## 📊 算法说明

- **击杀速度**：`60 ÷ (加权HP ÷ DPS)`，损耗系数 0.95（波次切换/save 开销，实测校准）
- **DPS**：复刻 game.js `getDamageBreakdown`，物攻段 + 魔法段 + AOE 溅射
- **逐怪扣防**：每只怪单独扣自身物防/魔防，避免加权平均失真
- **蓝药**：每个无冷却单体攻击技能耗 2MP/回合，地图掉落药水折算抵扣
- **红药**：按怪物实际伤害 × 回合数计算承受伤害

## 📝 校准

用法师 Lv18 在尸王殿实测校准：
- 击杀/分：计算 8.2 vs 实测 8.2（误差 0%）
- 金币/分：计算 342 vs 实测 362（误差 -5.5%）
