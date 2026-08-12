// 组装 farm-calculator.html：把数据文件嵌入 + 注入算法和UI
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const dataFiles = ['expTable.js', 'jobStats.js', 'monsters.js', 'maps.js', 'items.js', 'skills.js', 'drops.js'];

// 读取所有数据文件，原样作为脚本内容
const dataScripts = dataFiles.map(f => {
  const content = fs.readFileSync(path.join(DIR, f), 'utf8');
  return `<script>\n/* === ${f} === */\n${content}\n</script>`;
}).join('\n\n');

const appJs = fs.readFileSync(path.join(DIR, 'app.js'), 'utf8');

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>挂机传奇 · Farm效率计算器</title>
<style>
${fs.readFileSync(path.join(DIR, 'style.css'), 'utf8')}
</style>
</head>
<body>
${fs.readFileSync(path.join(DIR, 'ui.html'), 'utf8')}

<!-- === 游戏数据（内嵌）=== -->
${dataScripts}

<!-- === 应用逻辑 === -->
<script>
${appJs}
</script>
</body>
</html>`;

fs.writeFileSync(path.join(DIR, 'farm-calculator.html'), html, 'utf8');
console.log('生成 farm-calculator.html:', (html.length / 1024).toFixed(0) + ' KB');
