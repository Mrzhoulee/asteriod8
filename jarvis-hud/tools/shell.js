const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Patterns that are always blocked regardless of base command
const BLOCKED_PATTERNS = [
  /\brm\s/i,
  /\brm$/i,
  /\bsudo\b/i,
  /\bchmod\b/i,
  /\bchown\b/i,
  /\bmkfs\b/i,
  /\bdd\b.*\bof=/i,
  />\s*\/dev\//,
  /\bkill\b\s+-9/i,
  /\bpkill\b/i,
  /\bkillall\b/i,
  /\bformat\b/i,
  /\beval\b/i,
  /\bexec\b\s+/i,
  // pipe-to-shell attacks
  /\|\s*(?:ba)?sh\b/i,
  // command chaining with destructive ops
  /[;&|]\s*(?:sudo|rm|chmod|chown|kill)\b/i,
];

// Only these base commands are permitted
const ALLOWED_COMMANDS = new Set([
  'ls', 'pwd', 'echo', 'cat', 'head', 'tail', 'grep', 'find', 'which',
  'ps', 'whoami', 'date', 'uptime', 'df', 'du',
  'node', 'npm', 'npx', 'yarn', 'git',
  'python', 'python3', 'pip', 'pip3',
  'open', 'say', 'osascript', 'pbcopy', 'pbpaste',
  'curl', 'wget', 'ping',
  'mkdir', 'touch', 'cp', 'mv',
  'wc', 'sort', 'uniq', 'awk', 'sed', 'tr',
  'env', 'printenv', 'export',
  'brew', 'code',
]);

function isCommandSafe(command) {
  const trimmed = command.trim();

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) return false;
  }

  // Extract base command (handle env vars prefix and path prefixes)
  const baseCmd = trimmed
    .replace(/^(?:\w+=\S+\s+)*/, '') // strip VAR=val prefixes
    .split(/\s+/)[0]
    .split('/')
    .pop();

  return ALLOWED_COMMANDS.has(baseCmd);
}

async function runShell(command) {
  if (!isCommandSafe(command)) {
    return {
      success: false,
      error: `Blocked: "${command}" — only safe read/inspect commands are allowed. No rm, sudo, chmod, or pipe-to-shell.`,
    };
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: 15000,
      maxBuffer: 2 * 1024 * 1024,
    });
    return { success: true, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      stdout: err.stdout?.trim() || '',
      stderr: err.stderr?.trim() || '',
    };
  }
}

module.exports = { runShell, isCommandSafe };
