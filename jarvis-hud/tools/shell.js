// Shell execution with a tiered safety model so the agent can do *anything* the
// user can, while a human stays in the loop for destructive actions. The agent
// reads untrusted content (emails, web pages), so unconfirmed destructive
// commands are the real risk — confirmation defeats both agent mistakes and
// prompt-injection because the user sees the literal command before it runs.
//
//   safe         -> runs automatically
//   dangerous    -> main process shows a confirm dialog (default: Cancel)
//   catastrophic -> confirm dialog with a stern warning (default: Cancel)
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Almost never intentional; a single misfire is unrecoverable.
const CATASTROPHIC = [
  /\brm\s+-[rf]*\s+[/~]\s*$/i,        // rm -rf / or ~
  /\brm\s+-[rf]*\s+\/\s/i,            // rm -rf / something
  /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/, // fork bomb
  /\bmkfs\b/i,                        // format filesystem
  /\bdd\b[^|]*\bof=\/dev\/(?:disk|sd|hd|nvme|rdisk)/i, // overwrite a disk
  />\s*\/dev\/(?:disk|sd|hd|nvme|rdisk)/i,
  /\bdiskutil\s+(?:erase|reformat|partitionDisk)/i,
  /\bgit\s+push\b.*--force/i,         // force-push (history loss)
];

// Powerful / destructive but routinely legitimate — confirm, don't block.
const DANGEROUS = [
  /\brm\b/i, /\bsudo\b/i, /\bchmod\b/i, /\bchown\b/i, /\bkill(?:all)?\b/i,
  /\bpkill\b/i, /\bshutdown\b/i, /\breboot\b/i, /\bhalt\b/i,
  /\bmv\b/i, /\bdd\b/i, /\bdiskutil\b/i, /\blaunchctl\b/i,
  /\bdefaults\s+write\b/i, /\bnpm\s+publish\b/i, /\bgit\s+push\b/i,
  /\bgit\s+reset\s+--hard\b/i, /\bgit\s+clean\b/i,
  /\bcurl\b[^|]*\|\s*(?:ba)?sh\b/i,   // pipe-to-shell
  /\bbrew\s+(?:uninstall|remove)\b/i,
  />\s*\/etc\//i, />\s*\/usr\//i, />\s*\/System\//i,
];

function classifyCommand(command) {
  const cmd = (command || '').trim();
  if (!cmd) return { tier: 'safe', reason: '' };

  for (const p of CATASTROPHIC) {
    if (p.test(cmd)) return { tier: 'catastrophic', reason: 'Irreversible system damage possible.' };
  }
  for (const p of DANGEROUS) {
    if (p.test(cmd)) return { tier: 'dangerous', reason: 'Modifies the system or data.' };
  }
  return { tier: 'safe', reason: '' };
}

async function runShell(command, { cwd } = {}) {
  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: 60000,
      maxBuffer: 8 * 1024 * 1024,
      cwd: cwd || undefined,
      shell: '/bin/bash',
    });
    return { success: true, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      stdout: err.stdout?.trim() || '',
      stderr: err.stderr?.trim() || '',
      code: err.code,
    };
  }
}

module.exports = { runShell, classifyCommand };
