// Native macOS control — AppleScript, screenshots, clipboard, notifications,
// app launching, system settings. This is the "do anything on the Mac" layer.
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const os = require('os');
const path = require('path');

const execAsync = promisify(exec);
const isMac = process.platform === 'darwin';

/**
 * Run an arbitrary AppleScript. Written to a temp file to avoid quoting hell.
 * AppleScript can drive Calendar, Messages, Mail, Music, Finder, System Events,
 * Safari/Chrome, Keynote, etc. — effectively any scriptable Mac app.
 */
async function runAppleScript(script) {
  if (!isMac) return { success: false, error: 'AppleScript is macOS-only.' };
  const tmp = path.join(os.tmpdir(), `jarvis-as-${Date.now()}.applescript`);
  try {
    fs.writeFileSync(tmp, script, 'utf8');
    const { stdout, stderr } = await execAsync(`osascript "${tmp}"`, {
      timeout: 30000,
      maxBuffer: 4 * 1024 * 1024,
    });
    return { success: true, output: stdout.trim(), stderr: stderr.trim() };
  } catch (err) {
    return { success: false, error: err.message, stderr: err.stderr?.trim() || '' };
  } finally {
    fs.unlink(tmp, () => {});
  }
}

/** Does an AppleScript escalate to the shell? Those get treated as dangerous. */
function appleScriptIsDangerous(script) {
  return /do shell script|administrator privileges|delete|erase|trash/i.test(script);
}

/** Capture the screen (or a region) to a PNG and return the path. */
async function takeScreenshot({ region, interactive } = {}) {
  if (!isMac) return { success: false, error: 'Screenshot is macOS-only.' };
  const out = path.join(os.tmpdir(), `jarvis-shot-${Date.now()}.png`);
  let flags = '-x'; // no sound
  if (interactive) flags = '-i'; // user selects region
  else if (region) flags = `-x -R${region}`; // x,y,w,h
  try {
    await execAsync(`screencapture ${flags} "${out}"`, { timeout: 60000 });
    if (!fs.existsSync(out)) return { success: false, error: 'No screenshot captured.' };
    return { success: true, path: out };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function readClipboard() {
  return new Promise((resolve) => {
    if (!isMac) return resolve({ success: false, error: 'Clipboard is macOS-only.' });
    exec('pbpaste', { maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
      if (err) resolve({ success: false, error: err.message });
      else resolve({ success: true, text: stdout });
    });
  });
}

function writeClipboard(text) {
  return new Promise((resolve) => {
    if (!isMac) return resolve({ success: false, error: 'Clipboard is macOS-only.' });
    const p = spawn('pbcopy');
    p.on('close', () => resolve({ success: true }));
    p.on('error', (e) => resolve({ success: false, error: e.message }));
    p.stdin.write(text);
    p.stdin.end();
  });
}

/** Native notification banner. */
async function notify({ title, message, subtitle, sound }) {
  if (!isMac) return { success: false, error: 'Notifications via macOS only here.' };
  const esc = (s) => String(s || '').replace(/"/g, '\\"');
  let script = `display notification "${esc(message)}" with title "${esc(title || 'JARVIS')}"`;
  if (subtitle) script += ` subtitle "${esc(subtitle)}"`;
  if (sound) script += ` sound name "${esc(sound)}"`;
  return runAppleScript(script);
}

/** Open / focus an application. */
async function openApp(appName) {
  if (!isMac) return { success: false, error: 'openApp is macOS-only.' };
  try {
    await execAsync(`open -a "${appName.replace(/"/g, '')}"`, { timeout: 10000 });
    return { success: true, app: appName };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/** Set output volume 0–100. */
async function setVolume(level) {
  const v = Math.max(0, Math.min(100, parseInt(level, 10) || 0));
  return runAppleScript(`set volume output volume ${v}`);
}

module.exports = {
  runAppleScript,
  appleScriptIsDangerous,
  takeScreenshot,
  readClipboard,
  writeClipboard,
  notify,
  openApp,
  setVolume,
};
