// Filesystem access for the agent. Reads are free; writes/deletes are flagged
// dangerous so the main process can confirm with the user first.
const fs = require('fs');
const os = require('os');
const path = require('path');

function expand(p) {
  if (!p) return p;
  if (p === '~') return os.homedir();
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return path.resolve(p);
}

function readFile(filePath) {
  try {
    const full = expand(filePath);
    const stat = fs.statSync(full);
    if (stat.size > 1024 * 1024) {
      return { success: false, error: 'File larger than 1MB — refine your request.' };
    }
    return { success: true, path: full, content: fs.readFileSync(full, 'utf8') };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function writeFile(filePath, content, { append } = {}) {
  try {
    const full = expand(filePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    if (append) fs.appendFileSync(full, content);
    else fs.writeFileSync(full, content);
    return { success: true, path: full, bytes: Buffer.byteLength(content) };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function listDir(dirPath) {
  try {
    const full = expand(dirPath || '.');
    const entries = fs.readdirSync(full, { withFileTypes: true }).map((e) => ({
      name: e.name,
      type: e.isDirectory() ? 'dir' : 'file',
    }));
    return { success: true, path: full, entries };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { readFile, writeFile, listDir, expand };
