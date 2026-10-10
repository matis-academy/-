// Сборка: склеивает исходники в один файл ml-studio.js и готовый блок для Bricks.
const fs = require('fs'), path = require('path');
const src = ['core.js', 'w-pose.js', 'w-compose.js', 'w-move.js', 'w-sun.js', 'w-shots.js']
  .filter(f => fs.existsSync(path.join(__dirname, 'src', f)));
let out = src.map(f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8')).join('\n');
out += "\n(function(){ if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', window.MLStudio.init); else window.MLStudio.init(); })();\n";
fs.writeFileSync(path.join(__dirname, 'ml-studio.js'), out);
fs.writeFileSync(path.join(__dirname, 'bricks-code.html'), '<script>\n' + out + '</script>\n');
console.log('built', src.join(', '), (out.length / 1024).toFixed(1) + ' KB');
