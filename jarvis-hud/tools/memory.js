const fs = require('fs');
const path = require('path');

const MEMORY_PATH = path.join(__dirname, '../memory/context.json');
const MAX_ENTRIES = 20;
const CONTEXT_WINDOW = 10;

function loadMemory() {
  try {
    if (!fs.existsSync(MEMORY_PATH)) return [];
    const raw = fs.readFileSync(MEMORY_PATH, 'utf8').trim();
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveMemory(entry) {
  let memory = loadMemory();
  memory.push({ ...entry, timestamp: new Date().toISOString() });
  if (memory.length > MAX_ENTRIES) memory = memory.slice(-MAX_ENTRIES);
  fs.mkdirSync(path.dirname(MEMORY_PATH), { recursive: true });
  fs.writeFileSync(MEMORY_PATH, JSON.stringify(memory, null, 2));
  return memory;
}

/**
 * Build a valid Claude message history from stored memory.
 * Claude requires strict user/assistant alternation.
 */
function buildClaudeHistory(memory) {
  const window = memory.slice(-CONTEXT_WINDOW);
  const messages = [];

  for (const entry of window) {
    // Map stored roles to Claude roles; sub-agent responses become 'assistant'
    const role = entry.role === 'user' ? 'user' : 'assistant';
    if (!entry.content) continue;

    // Avoid consecutive same-role messages by merging content
    const last = messages[messages.length - 1];
    if (last && last.role === role) {
      last.content += '\n\n' + entry.content;
    } else {
      messages.push({ role, content: entry.content });
    }
  }

  // Claude requires history to start with 'user' if non-empty
  while (messages.length > 0 && messages[0].role !== 'user') {
    messages.shift();
  }

  return messages;
}

module.exports = { loadMemory, saveMemory, buildClaudeHistory };
