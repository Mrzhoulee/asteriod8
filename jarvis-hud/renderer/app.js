'use strict';

// ─── Config ──────────────────────────────────────────────────────────────────
const AGENT_COLORS = {
  jarvis: 'var(--jarvis)',
  hannah: 'var(--hannah)',
  marcus: 'var(--marcus)',
  rob:    'var(--rob)',
};

// ─── State ───────────────────────────────────────────────────────────────────
const state = {
  activeRequestId:  null,
  ttsEnabled:       true,
  isRecording:      false,
  mediaRecorder:    null,
  audioChunks:      [],
  // Per-agent streaming buffers
  buffers: { jarvis: '', hannah: '', marcus: '', rob: '' },
  // Per-agent current streaming element id
  currentMsgId: { jarvis: null, hannah: null, marcus: null, rob: null },
};

// ─── DOM helpers ─────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

function setStatus(agent, text) {
  const el = $(`${agent}-status`);
  if (el) el.textContent = text;
}

function setDot(agent, active) {
  const dot = $(`${agent}-dot`);
  if (!dot) return;
  if (active) dot.classList.add('active');
  else dot.classList.remove('active');
}

function setHeaderStatus(text) {
  const el = $('header-status');
  if (el) el.textContent = text;
}

function scrollToBottom(messagesEl) {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ─── Message rendering ───────────────────────────────────────────────────────

function removeHint(agent) {
  const hint = $(`${agent === 'jarvis' ? 'jarvis' : agent}-messages`)
    ?.querySelector('.empty-hint');
  if (hint) hint.remove();
}

/** Create a new message bubble and return its body element. */
function createMessageEl(messagesEl, role, agentName) {
  const wrap = document.createElement('div');
  wrap.className = `msg ${role}`;
  if (agentName) wrap.dataset.agent = agentName;

  const roleLabel = document.createElement('div');
  roleLabel.className = 'msg-role';
  roleLabel.textContent = role === 'user' ? 'YOU' : agentName?.toUpperCase() || 'AGENT';

  const body = document.createElement('div');
  body.className = 'msg-body';
  body.id = `stream-${crypto.randomUUID()}`;

  wrap.appendChild(roleLabel);
  wrap.appendChild(body);
  messagesEl.appendChild(wrap);
  scrollToBottom(messagesEl);
  return body;
}

/** Append a user message to JARVIS panel. */
function renderUserMessage(text) {
  removeHint('jarvis');
  const el = createMessageEl($('jarvis-messages'), 'user', null);
  el.textContent = text;
}

/** Begin a streaming agent bubble. Returns the body element id. */
function startAgentBubble(agent) {
  const panelId = agent === 'jarvis' ? 'jarvis-messages' : `${agent}-messages`;
  const messagesEl = $(panelId);
  if (!messagesEl) return null;

  removeHint(agent);

  const body = createMessageEl(messagesEl, agent, agent);
  body.classList.add('typing-cursor');
  state.buffers[agent] = '';
  state.currentMsgId[agent] = body.id;
  return body.id;
}

/** Append streamed token to the current bubble for an agent. */
function appendToken(agent, token) {
  if (!token) return;
  state.buffers[agent] = (state.buffers[agent] || '') + token;

  const bodyId = state.currentMsgId[agent];
  if (!bodyId) return;
  const el = $(bodyId);
  if (el) {
    el.textContent = state.buffers[agent];
    const panelId = agent === 'jarvis' ? 'jarvis-messages' : `${agent}-messages`;
    scrollToBottom($(panelId));
  }
}

/** Finalize the streaming bubble (remove cursor, optionally TTS). */
function finishBubble(agent) {
  const bodyId = state.currentMsgId[agent];
  if (bodyId) {
    const el = $(bodyId);
    if (el) el.classList.remove('typing-cursor');
    state.currentMsgId[agent] = null;
  }
}

/** Add a tool-result badge below the current JARVIS message. */
function addToolBadge(tool, result) {
  const bodyId = state.currentMsgId.jarvis;
  const target = bodyId ? $(bodyId)?.parentElement : $('jarvis-messages').lastElementChild;
  if (!target) return;

  const badge = document.createElement('div');
  const typeMap = { send_email: 'email', run_shell_command: 'shell', open_url: 'url', delegate_to_agent: 'delegate' };
  const cls = typeMap[tool] || '';
  badge.className = `tool-result-badge ${cls}`;

  const icons = { email: '✉', shell: '⚡', url: '🔗', delegate: '→' };
  const icon = icons[cls] || '◆';

  let label = '';
  if (tool === 'send_email')        label = result?.success ? 'Email sent' : `Email failed: ${result?.error}`;
  else if (tool === 'run_shell_command') label = result?.success ? `$ ${result.stdout?.substring(0, 60) || 'done'}` : `Error: ${result?.error?.substring(0, 60)}`;
  else if (tool === 'open_url')     label = `Opened: ${result?.url}`;
  else label = tool;

  badge.textContent = `${icon} ${label}`;
  target.appendChild(badge);
}

/** Show a delegation notice in the sub-agent panel. */
function showDelegationBadge(agent, task) {
  removeHint(agent);
  const panelId = `${agent}-messages`;
  const messagesEl = $(panelId);
  if (!messagesEl) return;

  const badge = document.createElement('div');
  badge.className = 'delegation-badge';
  badge.textContent = `← DELEGATED BY JARVIS`;
  messagesEl.appendChild(badge);
  scrollToBottom(messagesEl);
}

// ─── Memory replay ───────────────────────────────────────────────────────────

async function replayMemory() {
  const memory = await window.jarvis.loadMemory();
  if (!memory || memory.length === 0) return;

  // Show last 6 entries for context
  const recent = memory.slice(-6);
  for (const entry of recent) {
    const agent = entry.agent || (entry.role === 'user' ? 'user' : 'jarvis');
    const panelId = agent === 'user' ? 'jarvis-messages' : `${agent}-messages`;
    const messagesEl = $(panelId);
    if (!messagesEl || !entry.content) continue;

    removeHint(agent === 'user' ? 'jarvis' : agent);
    const role = entry.role === 'user' ? 'user' : agent;
    const body = createMessageEl(messagesEl, role, agent === 'user' ? null : agent);
    body.textContent = entry.content;
  }
}

// ─── Send message ─────────────────────────────────────────────────────────────

async function sendMessage(skipConfirm = false) {
  const input = $('user-input');
  const text = input.value.trim();
  if (!text || state.activeRequestId) return;

  input.value = '';
  state.activeRequestId = crypto.randomUUID();

  // UI — user message
  renderUserMessage(text);
  setStatus('jarvis', 'THINKING…');
  setDot('jarvis', true);
  setHeaderStatus('PROCESSING');
  $('send-btn').disabled = true;

  // Save user turn to memory
  await window.jarvis.saveMemory({ role: 'user', agent: 'user', content: text });

  // Start JARVIS bubble
  startAgentBubble('jarvis');

  // Fire
  window.jarvis.runAgent(state.activeRequestId, text, skipConfirm);
}

// ─── IPC listeners ────────────────────────────────────────────────────────────

function setupIPCListeners() {
  window.jarvis.removeAllListeners();

  // Streaming token
  window.jarvis.onToken(({ requestId, agent, token }) => {
    if (requestId !== state.activeRequestId) return;
    if (!token) return; // empty = "started" signal

    // If this is the first token for a sub-agent bubble, create it
    if (agent !== 'jarvis' && !state.currentMsgId[agent]) {
      startAgentBubble(agent);
    }
    if (agent === 'jarvis' && !state.currentMsgId[agent]) {
      startAgentBubble(agent);
    }

    appendToken(agent, token);

    if (agent === 'jarvis') {
      setStatus('jarvis', 'RESPONDING…');
    }
  });

  // Done
  window.jarvis.onDone(({ requestId }) => {
    if (requestId !== state.activeRequestId) return;

    // Finalize all active bubbles
    ['jarvis', 'hannah', 'marcus', 'rob'].forEach((a) => {
      if (state.currentMsgId[a]) finishBubble(a);
    });

    const jarvisResponse = state.buffers.jarvis;

    // TTS for JARVIS response
    if (state.ttsEnabled && jarvisResponse && jarvisResponse.length < 600) {
      window.jarvis.speak(jarvisResponse);
    }

    // Persist JARVIS response
    if (jarvisResponse) {
      window.jarvis.saveMemory({ role: 'assistant', agent: 'jarvis', content: jarvisResponse });
    }

    // Reset state
    state.activeRequestId = null;
    Object.keys(state.buffers).forEach((k) => (state.buffers[k] = ''));

    setStatus('jarvis', 'IDLE');
    setDot('jarvis', false);
    setHeaderStatus('READY');
    $('send-btn').disabled = false;
    $('user-input').focus();
  });

  // Error
  window.jarvis.onError(({ requestId, agent, error }) => {
    if (requestId !== state.activeRequestId) return;

    finishBubble(agent);

    const messagesEl = $('jarvis-messages');
    const errEl = document.createElement('div');
    errEl.className = 'error-msg';
    errEl.textContent = `⚠ ${error}`;
    messagesEl.appendChild(errEl);
    scrollToBottom(messagesEl);

    state.activeRequestId = null;
    setStatus('jarvis', 'ERROR');
    setDot('jarvis', false);
    setHeaderStatus('ERROR');
    $('send-btn').disabled = false;
  });

  // Delegation start
  window.jarvis.onDelegateStart(({ subAgent, task }) => {
    setStatus(subAgent, 'WORKING…');
    setDot(subAgent, true);
    const panel = $(`panel-${subAgent}`);
    if (panel) panel.classList.add('highlighted');
    showDelegationBadge(subAgent, task);
  });

  // Delegation end
  window.jarvis.onDelegateEnd(({ subAgent }) => {
    if (state.currentMsgId[subAgent]) finishBubble(subAgent);

    const response = state.buffers[subAgent];
    if (response) {
      window.jarvis.saveMemory({ role: 'assistant', agent: subAgent, content: response });
    }

    setStatus(subAgent, 'DONE');
    setDot(subAgent, false);
    setTimeout(() => {
      const panel = $(`panel-${subAgent}`);
      if (panel) panel.classList.remove('highlighted');
      setStatus(subAgent, 'IDLE');
    }, 2000);
  });

  // Tool result
  window.jarvis.onToolResult(({ tool, result }) => {
    addToolBadge(tool, result);
  });
}

// ─── Voice input ─────────────────────────────────────────────────────────────

async function startRecording() {
  if (state.isRecording) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.audioChunks = [];
    state.mediaRecorder = new MediaRecorder(stream);
    state.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) state.audioChunks.push(e.data);
    };
    state.mediaRecorder.start(100);
    state.isRecording = true;

    const btn = $('voice-btn');
    btn.classList.add('recording');
    btn.textContent = '⏺';
  } catch (err) {
    console.error('Mic access denied:', err);
  }
}

async function stopRecording() {
  if (!state.isRecording || !state.mediaRecorder) return;
  state.isRecording = false;

  const btn = $('voice-btn');
  btn.classList.remove('recording');
  btn.textContent = '🎤';
  btn.disabled = true;

  state.mediaRecorder.stop();
  state.mediaRecorder.stream.getTracks().forEach((t) => t.stop());

  await new Promise((res) => setTimeout(res, 200)); // wait for final chunk

  const blob = new Blob(state.audioChunks, { type: 'audio/webm' });
  const arrayBuffer = await blob.arrayBuffer();

  setHeaderStatus('TRANSCRIBING…');
  const result = await window.jarvis.transcribeAudio(Array.from(new Uint8Array(arrayBuffer)));
  setHeaderStatus('READY');

  if (result.success && result.text) {
    $('user-input').value = result.text;
    $('user-input').focus();
  } else {
    console.error('Transcription error:', result.error);
  }

  btn.disabled = false;
}

// ─── Event wiring ─────────────────────────────────────────────────────────────

function setupUI() {
  // Send
  $('send-btn').addEventListener('click', () => sendMessage());

  $('user-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // If user said "just send it" skip confirm
      const skipConfirm = e.target.value.toLowerCase().includes('just send it');
      sendMessage(skipConfirm);
    }
  });

  // Voice — hold to record
  const voiceBtn = $('voice-btn');
  voiceBtn.addEventListener('mousedown', startRecording);
  voiceBtn.addEventListener('mouseup',   stopRecording);
  voiceBtn.addEventListener('mouseleave', stopRecording);

  // TTS toggle
  const ttsBtn = $('tts-btn');
  ttsBtn.addEventListener('click', () => {
    state.ttsEnabled = !state.ttsEnabled;
    ttsBtn.classList.toggle('active', state.ttsEnabled);
    ttsBtn.title = state.ttsEnabled ? 'Voice responses ON' : 'Voice responses OFF';
  });
  ttsBtn.classList.add('active'); // default on

  // Window controls
  $('btn-hide').addEventListener('click',  () => window.jarvis.hideWindow());
  $('btn-min').addEventListener('click',   () => window.jarvis.minimizeWindow());
  $('btn-close').addEventListener('click', () => window.jarvis.closeWindow());
}

// ─── Boot ────────────────────────────────────────────────────────────────────

async function boot() {
  setupUI();
  setupIPCListeners();
  await replayMemory();
  $('user-input').focus();
}

boot();
