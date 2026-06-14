require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  dialog,
  shell,
  Tray,
  Menu,
  nativeImage,
} = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec, execFile } = require('child_process');

// Writable data dir (memory, an optional .env) — must be set before requiring memory.
const DATA_DIR = app.getPath('userData');
fs.mkdirSync(DATA_DIR, { recursive: true });
process.env.JARVIS_DATA_DIR = DATA_DIR;

// Also load a .env placed next to the installed app's data dir, for packaged use.
const userEnv = path.join(DATA_DIR, '.env');
if (fs.existsSync(userEnv)) require('dotenv').config({ path: userEnv, override: false });

const { runJarvis, runSubAgent } = require('./agents/index');
const personaStore = require('./agents/personas');
const { sendEmail, listAccounts, verifyAccounts, readEmails } = require('./tools/email');
const { runShell, classifyCommand } = require('./tools/shell');
const { loadMemory, saveMemory, clearMemory, buildClaudeHistory } = require('./tools/memory');
const mac = require('./tools/mac');
const { postSocial } = require('./tools/social');
const { postTikTokVideo, postTikTokPhotos, getTikTokAnalytics } = require('./tools/tiktok');
const { postInstagramPhoto, postInstagramReel, postInstagramCarousel, getInstagramInsights, getInstagramMedia } = require('./tools/instagram');
const { fetchGA4Report, fetchAppStoreSales, fetchAppStoreApps, fetchAppStoreReviews, verifyGA4 } = require('./tools/analytics');
const appfigures = require('./tools/appfigures');
const mailchimp = require('./tools/mailchimp');
const { scheduleEvent } = require('./tools/calendar');
const { webRequest } = require('./tools/web');
const files = require('./tools/files');

let mainWindow;
let tray;

app.setName('JARVIS');

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
    title: 'JARVIS',
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
  mainWindow.on('closed', () => { mainWindow = null; });
}

function iconImage() {
  const png = path.join(__dirname, 'build', 'icon.png');
  if (fs.existsSync(png)) return nativeImage.createFromPath(png);
  return null;
}

function setupDockAndTray() {
  const img = iconImage();

  // Dock icon
  if (process.platform === 'darwin' && app.dock && img) {
    app.dock.setIcon(img);
  }

  // Menubar tray for quick access
  try {
    const trayImg = img ? img.resize({ width: 18, height: 18 }) : nativeImage.createEmpty();
    if (img) trayImg.setTemplateImage(false);
    tray = new Tray(trayImg);
    tray.setToolTip('JARVIS');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Show / Hide  (⌘⇧J)', click: toggleWindow },
      { type: 'separator' },
      { label: 'Quit JARVIS', click: () => app.quit() },
    ]));
    tray.on('click', toggleWindow);
  } catch { /* tray optional */ }
}

function toggleWindow() {
  if (!mainWindow) return createWindow();
  if (mainWindow.isVisible()) mainWindow.hide();
  else { mainWindow.show(); mainWindow.focus(); }
}

app.whenReady().then(() => {
  createWindow();
  setupDockAndTray();
  globalShortcut.register('CommandOrControl+Shift+J', toggleWindow);
});

app.on('window-all-closed', () => {
  // Stay alive in the dock/tray like a real assistant; quit only on non-mac.
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  else mainWindow?.show();
});

app.on('will-quit', () => globalShortcut.unregisterAll());

// ─── Confirmation helper ──────────────────────────────────────

async function confirm({ title, message, detail, danger }) {
  if (!mainWindow) return true;
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: danger ? 'warning' : 'question',
    buttons: danger ? ['Cancel', 'Yes, proceed'] : ['Proceed', 'Cancel'],
    defaultId: danger ? 0 : 0,
    cancelId: danger ? 0 : 1,
    title,
    message,
    detail,
  });
  // For danger dialogs, index 1 = proceed; otherwise index 0 = proceed.
  return danger ? response === 1 : response === 0;
}

// ─── Window / memory / voice / TTS IPC ────────────────────────

ipcMain.handle('app:open-external', (_, url) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) shell.openExternal(url);
});
ipcMain.handle('window:hide', () => mainWindow?.hide());
ipcMain.handle('window:close', () => app.quit());
ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('memory:load', () => loadMemory());
ipcMain.handle('email:list_accounts', () => listAccounts());
ipcMain.handle('email:verify', () => verifyAccounts());
ipcMain.handle('analytics:verify_ga4', () => verifyGA4());
ipcMain.handle('memory:save', (_, entry) => saveMemory(entry));
ipcMain.handle('memory:clear', () => clearMemory());

// Report which integrations are configured — booleans only, NEVER the secrets.
// Powers the onboarding checklist so users can see what's left to connect.
ipcMain.handle('integrations:status', () => {
  const has = (...keys) => keys.some((k) => !!process.env[k]);
  return {
    llm:        has('ANTHROPIC_API_KEY'),
    voice:      has('GROQ_API_KEY'),
    email:      has('GMAIL_ACCOUNT_1_USER', 'GMAIL_USER'),
    social:     has('LATE_API_KEY', 'SOCIAL_WEBHOOK_URL', 'BUFFER_ACCESS_TOKEN', 'X_BEARER_TOKEN'),
    tiktok:     has('TIKTOK_ACCESS_TOKEN', 'LATE_API_KEY', 'SOCIAL_WEBHOOK_URL'),
    instagram:  has('INSTAGRAM_ACCESS_TOKEN', 'LATE_API_KEY', 'SOCIAL_WEBHOOK_URL'),
    analytics:  has('GOOGLE_ANALYTICS_TOKEN', 'GOOGLE_SERVICE_ACCOUNT_JSON'),
    appstore:   has('APP_STORE_CONNECT_KEY_ID'),
    appfigures: has('APPFIGURES_TOKEN'),
    mailchimp:  has('MAILCHIMP_API_KEY'),
    model:      personaStore.getModel(),
  };
});

// ─── Team / jobs customization ────────────────────────────────
// The user can rename teammates, rewrite each job's system prompt, and pick the
// Claude model from the Customize panel. Edits persist to personas.json and take
// effect on the next message — no restart.
ipcMain.handle('personas:get', () => ({
  model: personaStore.getModel(),
  models: personaStore.MODELS,
  personas: personaStore.loadPersonas(),
  defaults: personaStore.DEFAULT_PERSONAS,
  subagents: personaStore.SUBAGENTS,
  editable: personaStore.EDITABLE_FIELDS,
}));

ipcMain.handle('personas:save', (_, config) => {
  personaStore.saveConfig(config || {});
  return {
    model: personaStore.getModel(),
    personas: personaStore.loadPersonas(),
  };
});

ipcMain.handle('personas:reset', () => {
  personaStore.resetConfig();
  return {
    model: personaStore.getModel(),
    personas: personaStore.loadPersonas(),
  };
});

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

ipcMain.handle('tts:speak', (_, payload) => {
  if (process.platform !== 'darwin') return { success: false, error: 'TTS only on macOS' };
  const opts = typeof payload === 'string' ? { text: payload } : (payload || {});
  const text = String(opts.text || '').substring(0, 500);
  if (!text) return { success: false, error: 'No text to speak' };
  const args = [];
  if (opts.voice) args.push('-v', String(opts.voice));
  if (opts.rate) args.push('-r', String(parseInt(opts.rate, 10) || 175));
  args.push(text);
  // execFile (no shell) — voice names with spaces/parentheses and arbitrary
  // reply text are passed as literal args, so nothing can break or inject.
  execFile('say', args);
  return { success: true };
});

// List installed macOS voices for the Settings voice picker.
ipcMain.handle('tts:voices', () => new Promise((resolve) => {
  if (process.platform !== 'darwin') return resolve([]);
  execFile('say', ['-v', '?'], { maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
    if (err || !stdout) return resolve([]);
    const voices = [];
    for (const line of stdout.split('\n')) {
      const m = line.match(/^(.+?)\s+([a-zA-Z]{2}[-_][a-zA-Z]{2,3})\s+#\s?(.*)$/);
      if (m) voices.push({ name: m[1].trim(), locale: m[2], sample: m[3].trim() });
    }
    resolve(voices);
  });
}));

// ─── Tool dispatch ────────────────────────────────────────────

function buildToolHandler(send, skipConfirm) {
  return async function onToolCall(toolName, input) {
    switch (toolName) {
      // ── Delegation ──────────────────────────────────────────
      case 'delegate_to_agent': {
        const { agent: subAgent, task } = input;
        send('agent:delegate_start', { subAgent, task });
        const result = await runSubAgent(subAgent, task, (token) =>
          send('agent:token', { agent: subAgent, token }));
        send('agent:delegate_end', { subAgent });
        saveMemory({ role: 'assistant', agent: subAgent, content: result });
        return result;
      }

      // ── Shell (tiered) ──────────────────────────────────────
      case 'run_command': {
        const { tier, reason } = classifyCommand(input.command);
        if (tier !== 'safe' && !skipConfirm) {
          const ok = await confirm({
            danger: tier === 'catastrophic',
            title: tier === 'catastrophic' ? '⚠️ Dangerous command' : 'Confirm command',
            message: `JARVIS wants to run:\n\n${input.command}`,
            detail: `${reason}${tier === 'catastrophic' ? '\n\nThis could be IRREVERSIBLE. Only proceed if you are certain.' : ''}`,
          });
          if (!ok) return JSON.stringify({ cancelled: true, message: 'User declined the command.' });
        }
        const result = await runShell(input.command, { cwd: input.cwd });
        send('agent:tool_result', { tool: 'run_command', result });
        return JSON.stringify(result);
      }

      // ── AppleScript ─────────────────────────────────────────
      case 'run_applescript': {
        if (mac.appleScriptIsDangerous(input.script) && !skipConfirm) {
          const ok = await confirm({
            danger: true,
            title: 'Confirm AppleScript',
            message: input.purpose || 'JARVIS wants to run an AppleScript that may change your system.',
            detail: input.script.slice(0, 500),
          });
          if (!ok) return JSON.stringify({ cancelled: true });
        }
        const result = await mac.runAppleScript(input.script);
        send('agent:tool_result', { tool: 'run_applescript', result });
        return JSON.stringify(result);
      }

      // ── Mac quick actions ───────────────────────────────────
      case 'control_mac': {
        let result;
        switch (input.action) {
          case 'screenshot':       result = await mac.takeScreenshot({ interactive: input.interactive }); break;
          case 'notify':           result = await mac.notify({ title: input.title, message: input.message }); break;
          case 'open_app':         result = await mac.openApp(input.app); break;
          case 'set_volume':       result = await mac.setVolume(input.level); break;
          case 'clipboard_read':   result = await mac.readClipboard(); break;
          case 'clipboard_write':  result = await mac.writeClipboard(input.text); break;
          default:                 result = { success: false, error: `Unknown action: ${input.action}` };
        }
        send('agent:tool_result', { tool: 'control_mac', result, action: input.action });
        return JSON.stringify(result);
      }

      // ── Email ───────────────────────────────────────────────
      case 'read_emails': {
        const result = await readEmails(input);
        send('agent:tool_result', { tool: 'read_emails', result });
        return JSON.stringify(result);
      }

      case 'send_email': {
        if (!skipConfirm) {
          // Resolve which account will send so the user can see it in the dialog
          const accounts = listAccounts();
          const fromLabel = input.fromAccount
            ? accounts.find((a) => a.label.toLowerCase().includes(input.fromAccount.toLowerCase()) || a.user === input.fromAccount)?.user || input.fromAccount
            : (accounts[0]?.user || '');
          const ok = await confirm({
            title: 'Confirm Email',
            message: `Send email to ${input.to}?`,
            detail: `From: ${fromLabel}\nSubject: ${input.subject}\n\n${input.body.substring(0, 300)}${input.body.length > 300 ? '…' : ''}`,
          });
          if (!ok) return JSON.stringify({ cancelled: true, message: 'User cancelled.' });
        }
        const result = await sendEmail(input);
        send('agent:tool_result', { tool: 'send_email', result: { ...result, to: input.to } });
        return JSON.stringify(result);
      }

      // ── Open URL ────────────────────────────────────────────
      case 'open_url': {
        await shell.openExternal(input.url);
        const result = { success: true, url: input.url };
        send('agent:tool_result', { tool: 'open_url', result });
        return JSON.stringify(result);
      }

      // ── Social ──────────────────────────────────────────────
      case 'post_social': {
        const plat = (input.platform || '').toLowerCase();
        let result;

        // If an aggregator is configured (Late / webhook / Buffer), route EVERY
        // platform — TikTok & Instagram included — through it, so the user never
        // needs their own TikTok/Instagram developer apps. Direct platform APIs are
        // only used as a fallback when no aggregator is set.
        const hasAggregator = process.env.LATE_API_KEY || process.env.SOCIAL_WEBHOOK_URL || process.env.BUFFER_ACCESS_TOKEN;

        if (plat === 'tiktok' && !hasAggregator) {
          // Direct TikTok API: video or photo carousel
          if (input.mediaUrls?.length) {
            result = await postTikTokPhotos({ photoUrls: input.mediaUrls, caption: input.text });
          } else if (input.mediaUrl) {
            result = await postTikTokVideo({ videoUrl: input.mediaUrl, caption: input.text });
          } else {
            result = { success: false, error: 'TikTok requires mediaUrl (video) or mediaUrls (photos).' };
          }
        } else if (plat === 'instagram' && !hasAggregator) {
          // Direct Instagram API: reel, carousel, or photo
          if (input.mediaUrls?.length > 1) {
            result = await postInstagramCarousel({ mediaUrls: input.mediaUrls, caption: input.text, hashtags: input.hashtags });
          } else if (input.mediaUrl?.match(/\.(mp4|mov|avi)$/i)) {
            result = await postInstagramReel({ videoUrl: input.mediaUrl, caption: input.text, hashtags: input.hashtags });
          } else if (input.mediaUrl) {
            result = await postInstagramPhoto({ imageUrl: input.mediaUrl, caption: input.text, hashtags: input.hashtags });
          } else {
            result = { success: false, error: 'Instagram requires mediaUrl (photo/video) or mediaUrls (carousel).' };
          }
        } else {
          // Aggregator path (Late/webhook/Buffer) for any platform, plus the
          // browser-compose fallback for X, LinkedIn, Facebook, Threads, Reddit.
          result = await postSocial(input);
          if (result.needsBrowser && result.url) await shell.openExternal(result.url);
        }

        send('agent:tool_result', { tool: 'post_social', result });
        return JSON.stringify(result);
      }

      // ── Analytics ────────────────────────────────────────────
      case 'get_analytics': {
        let result;
        switch (input.source) {
          case 'ga4':
            result = await fetchGA4Report(input);
            break;
          case 'appstore':
            result = await fetchAppStoreSales({ frequency: input.frequency, reportDate: input.startDate });
            break;
          case 'appstore_apps':
            result = await fetchAppStoreApps();
            break;
          case 'appstore_reviews':
            result = await fetchAppStoreReviews({ appId: input.appId });
            break;
          case 'appfigures_sales':
            result = await appfigures.fetchSales({ startDate: input.startDate, endDate: input.endDate, groupBy: input.groupBy });
            break;
          case 'appfigures_reviews':
            result = await appfigures.fetchReviews({});
            break;
          case 'appfigures_ratings':
            result = await appfigures.fetchRatings();
            break;
          case 'appfigures_products':
            result = await appfigures.fetchProducts();
            break;
          default:
            result = { success: false, error: `Unknown analytics source: "${input.source}".` };
        }
        send('agent:tool_result', { tool: 'get_analytics', result });
        return JSON.stringify(result);
      }

      // ── Mailchimp ────────────────────────────────────────────
      case 'mailchimp': {
        let result;
        switch (input.action) {
          case 'list_audiences':
            result = await mailchimp.listAudiences();
            break;
          case 'audience_stats':
            result = await mailchimp.audienceStats(input.listId);
            break;
          case 'add_subscriber':
            result = await mailchimp.addSubscriber(input);
            break;
          case 'list_campaigns':
            result = await mailchimp.listCampaigns({});
            break;
          case 'create_campaign': {
            // Sending a campaign blasts real subscribers — confirm first.
            if (input.send && !skipConfirm) {
              const audience = await mailchimp.audienceStats(input.listId);
              const count = audience.success ? audience.members : '?';
              const ok = await confirm({
                danger: true,
                title: 'Send Mailchimp campaign',
                message: `Send "${input.subject}" to ${count} subscribers?`,
                detail: `From: ${input.fromName} <${input.replyTo}>\n\nThis emails your entire audience and cannot be undone.`,
              });
              if (!ok) {
                result = await mailchimp.createCampaign({ ...input, send: false });
                result.note = 'User declined to send — saved as a draft instead.';
                send('agent:tool_result', { tool: 'mailchimp', result, action: input.action });
                return JSON.stringify(result);
              }
            }
            result = await mailchimp.createCampaign(input);
            break;
          }
          case 'campaign_report':
            result = await mailchimp.campaignReport(input.campaignId);
            break;
          default:
            result = { success: false, error: `Unknown mailchimp action: "${input.action}".` };
        }
        send('agent:tool_result', { tool: 'mailchimp', result, action: input.action });
        return JSON.stringify(result);
      }

      // ── Scheduling ──────────────────────────────────────────
      case 'schedule_event': {
        const result = await scheduleEvent(input);
        send('agent:tool_result', { tool: 'schedule_event', result });
        return JSON.stringify(result);
      }

      // ── Web / analytics ─────────────────────────────────────
      case 'web_request': {
        const result = await webRequest(input);
        send('agent:tool_result', { tool: 'web_request', result });
        return JSON.stringify(result);
      }

      // ── Files ───────────────────────────────────────────────
      case 'read_file': {
        const result = files.readFile(input.path);
        return JSON.stringify(result);
      }
      case 'list_directory': {
        const result = files.listDir(input.path);
        return JSON.stringify(result);
      }
      case 'write_file': {
        if (!skipConfirm) {
          const ok = await confirm({
            danger: true,
            title: 'Confirm file write',
            message: `${input.append ? 'Append to' : 'Write'} ${input.path}?`,
            detail: input.content.substring(0, 300),
          });
          if (!ok) return JSON.stringify({ cancelled: true });
        }
        const result = files.writeFile(input.path, input.content, { append: input.append });
        send('agent:tool_result', { tool: 'write_file', result });
        return JSON.stringify(result);
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  };
}

// ─── Agent runner ─────────────────────────────────────────────

// Translate raw Anthropic API errors into plain, actionable guidance so the HUD
// shows something useful instead of a cryptic provider string.
function friendlyAgentError(err) {
  const raw = err?.message || String(err);
  const status = err?.status;
  const lower = raw.toLowerCase();

  if (lower.includes('credit balance') || lower.includes('billing') ||
      (status === 400 && lower.includes('too low'))) {
    return 'Anthropic API credit is empty. A Claude Pro/Max subscription does NOT include API access — the API is billed separately. Add credits at console.anthropic.com → Settings → Billing → "Buy credits", then try again.';
  }
  if (status === 401 || lower.includes('invalid x-api-key') || lower.includes('authentication_error')) {
    return 'Anthropic rejected the API key. Check ANTHROPIC_API_KEY in your .env — grab a fresh one at console.anthropic.com → Settings → API keys (starts with sk-ant-).';
  }
  if (status === 429 || lower.includes('rate_limit') || lower.includes('rate limit')) {
    return 'Hit Anthropic\'s rate limit. Wait a few seconds and try again, or raise your limits in the console.';
  }
  if (status === 404 && lower.includes('model')) {
    return `That Claude model isn't available on your account: ${raw}`;
  }
  if (status === 529 || lower.includes('overloaded')) {
    return 'Anthropic is temporarily overloaded. Try again in a moment.';
  }
  return raw;
}

ipcMain.on('agent:run', async (event, { requestId, message, skipConfirm }) => {
  const send = (channel, data) => {
    if (!event.sender.isDestroyed()) event.sender.send(channel, { requestId, ...data });
  };

  // Build history from prior memory BEFORE recording this turn, so the new user
  // message isn't duplicated (it's passed to runJarvis directly).
  const claudeHistory = buildClaudeHistory(loadMemory());
  saveMemory({ role: 'user', agent: 'user', content: message });

  const onToolCall = buildToolHandler(send, skipConfirm);

  try {
    send('agent:token', { agent: 'jarvis', token: '' });
    const finalText = await runJarvis(message, claudeHistory, {
      onToken: (token) => send('agent:token', { agent: 'jarvis', token }),
      onToolCall,
    });
    if (finalText) saveMemory({ role: 'assistant', agent: 'jarvis', content: finalText });
    send('agent:done', { agent: 'jarvis' });
  } catch (err) {
    send('agent:error', { agent: 'jarvis', error: friendlyAgentError(err) });
  }
});
