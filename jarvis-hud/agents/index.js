require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const Anthropic = require('@anthropic-ai/sdk');
const { loadPersonas, getModel, delegateDescription } = require('./personas');
const { JARVIS_TOOLS } = require('./tools');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
// The model and the full roster (names, roles, system prompts) are resolved per
// request from the persona store, so the user's Customize-panel edits and model
// choice take effect immediately — no restart needed. Default model is Opus 4.8.

// Clone the tool list with a delegate description generated from the live roster,
// so JARVIS delegates to the right teammate even after they've been renamed.
function buildTools(personas) {
  return JARVIS_TOOLS.map((tool) =>
    tool.name === 'delegate_to_agent'
      ? { ...tool, description: delegateDescription(personas) }
      : tool);
}

// Extended thinking: let JARVIS reason privately before answering/acting.
// Set JARVIS_THINKING=off to disable. Control reasoning depth with JARVIS_THINKING_EFFORT
// (low | medium | high | xhigh | max). Defaults to "medium".
const USE_THINKING = process.env.JARVIS_THINKING !== 'off';
const THINKING_EFFORT = process.env.JARVIS_THINKING_EFFORT || 'medium';

/**
 * Run a sub-agent (Hannah, Marcus, Rob) — text-only, no tools.
 * Streams tokens via onToken callback.
 */
async function runSubAgent(agentName, task, onToken) {
  const persona = loadPersonas()[agentName];
  if (!persona) throw new Error(`Unknown agent: ${agentName}`);

  const stream = client.messages.stream({
    model: getModel(),
    max_tokens: 4096,
    system: persona.system,
    messages: [{ role: 'user', content: task }],
  });

  let fullText = '';
  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      const tok = event.delta.text;
      fullText += tok;
      if (onToken) onToken(tok);
    }
  }

  await stream.finalMessage();
  return fullText;
}

/**
 * Run JARVIS with full tool-use agentic loop.
 * Streams text tokens via onToken. Calls onToolCall for each tool.
 * Continues looping until stop_reason === 'end_turn'.
 */
async function runJarvis(message, claudeHistory, { onToken, onToolCall }) {
  const messages = [
    ...claudeHistory,
    { role: 'user', content: message },
  ];

  // Resolve the model, roster, and tools once for this whole turn so a mid-turn
  // edit can't change them under us — but the next turn picks up any new edits.
  const personas = loadPersonas();
  const model = getModel();
  const tools = buildTools(personas);

  let assistantText = '';

  // Safety cap: stop an agentic tool loop that never settles — prevents the
  // "thinking forever" hang and runaway API cost if a tool keeps failing.
  const MAX_TOOL_ROUNDS = 16;
  let round = 0;

  while (true) {
    const params = {
      model,
      // Roomy output budget so JARVIS finishes the whole answer instead of
      // getting cut off mid-job. (Output here = thinking + visible reply.)
      max_tokens: 8192,
      system: personas.jarvis.system,
      tools,
      messages,
    };
    // Extended thinking makes it reason through hard, multi-step requests before
    // acting — the difference between a smart operator and a chatbot.
    if (USE_THINKING) {
      params.thinking = { type: 'adaptive' };
      params.output_config = { effort: THINKING_EFFORT };
    }

    const stream = client.messages.stream(params);

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        assistantText += event.delta.text;
        if (onToken) onToken(event.delta.text);
      }
    }

    const finalMsg = await stream.finalMessage();
    messages.push({ role: 'assistant', content: finalMsg.content });

    // Ran out of output budget mid-answer — ask it to continue rather than
    // leaving the user with a truncated, "unfinished" reply.
    if (finalMsg.stop_reason === 'max_tokens') {
      if (++round > MAX_TOOL_ROUNDS) break;
      messages.push({ role: 'user', content: 'Continue exactly where you left off.' });
      continue;
    }

    if (finalMsg.stop_reason !== 'tool_use') break;

    if (++round > MAX_TOOL_ROUNDS) {
      const note = '\n\n[Paused: too many tool calls in a row. Clear the conversation or rephrase if this wasn\'t expected.]';
      assistantText += note;
      if (onToken) onToken(note);
      break;
    }

    if (assistantText && !assistantText.endsWith('\n')) assistantText += '\n';

    const toolResults = [];
    for (const block of finalMsg.content) {
      if (block.type !== 'tool_use') continue;

      let result;
      try {
        result = await onToolCall(block.name, block.input);
      } catch (err) {
        result = JSON.stringify({ error: err.message });
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: typeof result === 'string' ? result : JSON.stringify(result),
      });
    }

    messages.push({ role: 'user', content: toolResults });
  }

  return assistantText;
}

module.exports = { runJarvis, runSubAgent };
