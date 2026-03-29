const fs = require('fs');
const path = require('path');

const EXCLUDE = new Set([
  'node_modules', 'ios', '.git', 'www', 'asteroid-app', 'asteroid67',
  'boostnotifier', 'asteroid', 'asteroid8', 'shannon', 'functions',
  'supabase', '.firebase', '.cursor', '.vscode', '.DS_Store', 'y',
  'Asteriod files'
]);

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    if (EXCLUDE.has(name)) continue;
    const srcPath = path.join(src, name);
    const destPath = path.join(dest, name);
    if (fs.statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const root = path.resolve(__dirname, '..');
const www = path.join(root, 'www');
if (fs.existsSync(www)) fs.rmSync(www, { recursive: true });
copyDir(root, www);
console.log('Copied web assets to www/');
