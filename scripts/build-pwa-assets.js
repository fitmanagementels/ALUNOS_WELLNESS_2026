const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'node_modules', 'chart.js', 'dist', 'chart.umd.js');
const target = path.join(root, 'pwa', 'vendor', 'chart.umd.js');

if (!fs.existsSync(source)) throw new Error('Chart.js não está instalado. Execute npm install antes de gerar os assets do PWA.');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);
process.stdout.write('Asset local Chart.js atualizado.\n');
