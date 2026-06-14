const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jarvis', {
  // ── Agent ──────────────────────────────────────────────────
  runAgent: (requestId, message, skipConfirm = false) => {
    ipcRenderer.send('agent:run', { requestId, message, skipConfirm });
  },

  onToken: (cb) => ipcRenderer.on('agent:token', (_, d) => cb(d)),
  onDone: (cb) => ipcRenderer.on('agent:done', (_, d) => cb(d)),
  onError: (cb) => ipcRenderer.on('agent:error', (_, d) => cb(d)),
  onDelegateStart: (cb) => ipcRenderer.on('agent:delegate_start', (_, d) => cb(d)),
  onDelegateEnd: (cb) => ipcRenderer.on('agent:delegate_end', (_, d) => cb(d)),
  onToolResult: (cb) => ipcRenderer.on('agent:tool_result', (_, d) => cb(d)),

  removeAllListeners: () => {
    [
      'agent:token', 'agent:done', 'agent:error',
      'agent:delegate_start', 'agent:delegate_end', 'agent:tool_result',
    ].forEach((ch) => ipcRenderer.removeAllListeners(ch));
  },

  // ── Email accounts ──────────────────────────────────────────
  listEmailAccounts: () => ipcRenderer.invoke('email:list_accounts'),
  verifyEmail: () => ipcRenderer.invoke('email:verify'),

  // ── Integrations status (for onboarding checklist) ──────────
  getIntegrations: () => ipcRenderer.invoke('integrations:status'),

  // ── Memory ──────────────────────────────────────────────────
  loadMemory: () => ipcRenderer.invoke('memory:load'),
  saveMemory: (entry) => ipcRenderer.invoke('memory:save', entry),
  clearMemory: () => ipcRenderer.invoke('memory:clear'),

  // ── Voice ───────────────────────────────────────────────────
  transcribeAudio: (audioBuffer) => ipcRenderer.invoke('voice:transcribe', audioBuffer),

  // ── TTS ─────────────────────────────────────────────────────
  speak: (textOrOpts) => ipcRenderer.invoke('tts:speak', textOrOpts),
  listVoices: () => ipcRenderer.invoke('tts:voices'),

  // ── Shell ───────────────────────────────────────────────────
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),

  // ── Window ──────────────────────────────────────────────────
  hideWindow: () => ipcRenderer.invoke('window:hide'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
});
