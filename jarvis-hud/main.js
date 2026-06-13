require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  dialog,
  shell,
} = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');

const { runJarvis, runSubAgent } = require('./agents/index');
const { sendEmail } = require('./tools/email');
const { runShell } = require('./tools/shell');
const { loadMemory, saveMemory, buildClaudeHistory } = require('./tools/memory');

let mainWindow;

// ─── Window ───────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1140,
    height: 700,
    minWidth: 900,
    minHeight: 500,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.platform === 'darwin') {
    mainWindow.setAlwaysOnTop(true, 'floating');
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  mainWindow.loadFile('renderer/index.html');
}

app.whenReady().then(() => {
  createWindow();

  globalShortcut.register('CommandOrControl+Shift+J', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// ─── Window control IPC ───────────────────────────────────────

ipcMain.handle('window:hide', () => mainWindow?.hide());
ipcMain.handle('window:close', () => app.quit());
ipcMain.handle('window:minimize', () => mainWindow?.minimize());

// ─── Memory IPC ───────────────────────────────────────────────

ipcMain.handle('memory:load', () => loadMemory());
ipcMain.handle('memory:save', (_, entry) => saveMemory(entry));

// ─── Voice transcription (Groq Whisper) ───────────────────────

ipcMain.handle('voice:transcribe', async (_, audioBuffer) => {
  try {
    const Groq = require('groq-sdk');
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const tmpPath = path.join(os.tmpdir(), `jarvis-audio-${Date.now()}.webm`);
    fs.writeFileSync(tmpPath, Buffer.from(audioBuffer));

    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(tmpPath),
      model: 'whisper-large-v3-turbo',
    });

    fs.unlink(tmpPath, () => {});
    return { success: true, text: transcription.text };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ─── TTS (macOS `say`) ────────────────────────────────────────

ipcMain.handle('tts:speak', (_, text) => {
  if (process.platform !== 'darwin') return { success: false, error: 'TTS only on macOS' };
  const safe = text.replace(/"/g, '\\"').substring(0, 500);
  exec(`say "${safe}"`);
  return { success: true };
});

// ─── Agent runner ─────────────────────────────────────────────

ipcMain.on('agent:run', async (event, { requestId, message, skipConfirm }) => {
  const send = (channel, data) => {
    if (!event.sender.isDestroyed()) {
      event.sender.send(channel, { requestId, ...data });
    }
  };

  const memory = loadMemory();
  const claudeHistory = buildClaudeHistory(memory);

  // ── Tool handler ──
  const onToolCall = async (toolName, toolInput) => {
    if (toolName === 'delegate_to_agent') {
      const { agent: subAgent, task } = toolInput;
      send('agent:delegate_start', { subAgent, task });

      const result = await runSubAgent(subAgent, task, (token) => {
        send('agent:token', { agent: subAgent, token });
      });

      send('agent:delegate_end', { subAgent });
      saveMemory({ role: 'assistant', agent: subAgent, content: result });
      return result;
    }

    if (toolName === 'send_email') {
      if (!skipConfirm) {
        const preview = toolInput.body.substring(0, 300);
        const { response } = await dialog.showMessageBox(mainWindow, {
          type: 'question',
          buttons: ['Send', 'Cancel'],
          defaultId: 0,
          title: 'Confirm Email',
          message: `Send email to ${toolInput.to}?`,
          detail: `Subject: ${toolInput.subject}\n\n${preview}${toolInput.body.length > 300 ? '…' : ''}`,
        });
        if (response !== 0) {
          return JSON.stringify({ cancelled: true, message: 'User cancelled.' });
        }
      }

      const result = await sendEmail(toolInput);
      send('agent:tool_result', { tool: 'send_email', result });
      return JSON.stringify(result);
    }

    if (toolName === 'run_shell_command') {
      const result = await runShell(toolInput.command);
      send('agent:tool_result', { tool: 'run_shell_command', result });
      return JSON.stringify(result);
    }

    if (toolName === 'open_url') {
      await shell.openExternal(toolInput.url);
      const result = { success: true, url: toolInput.url };
      send('agent:tool_result', { tool: 'open_url', result });
      return JSON.stringify(result);
    }

    return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  };

  // ── JARVIS streaming run ──
  try {
    send('agent:token', { agent: 'jarvis', token: '' }); // signals "started"

    await runJarvis(message, claudeHistory, {
      onToken: (token) => send('agent:token', { agent: 'jarvis', token }),
      onToolCall,
    });

    send('agent:done', { agent: 'jarvis' });
    saveMemory({ role: 'assistant', agent: 'jarvis', content: message });
  } catch (err) {
    send('agent:error', { agent: 'jarvis', error: err.message });
  }
});
