require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const Anthropic = require('@anthropic-ai/sdk');
const PERSONAS = require('./personas');
const { JARVIS_TOOLS } = require('./tools');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
// Default to Opus 4.8 — Anthropic's most capable model, so JARVIS reasons and
// finishes complex multi-step jobs like the real thing. To spend less, set
// JARVIS_MODEL=claude-sonnet-4-6 (balanced) or claude-haiku-4-5 (cheapest) in .env.
const MODEL = process.env.JARVIS_MODEL || 'claude-opus-4-8';

// Extended thinking: let JARVIS reason privately before answering/acting — this is
// what makes it genuinely smart on hard, multi-step requests instead of replying
// off the top of its head. Set JARVIS_THINKING=off to disable, or tune the budget.
const THINKING_BUDGET = parseInt(process.env.JARVIS_THINKING_BUDGET || '2048', 10);
const USE_THINKING = process.env.JARVIS_THINKING !== 'off' && THINKING_BUDGET >= 1024;

/**
 * Run a sub-agent (Hannah, Marcus, Rob) — text-only, no tools.
 * Streams tokens via onToken callback.
 */
async function runSubAgent(agentName, task, onToken) {
  const persona = PERSONAS[agentName];
  if (!persona) throw new Error(`Unknown agent: ${agentName}`);

  const stream = client.messages.stream({
    model: MODEL,
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

  let assistantText = '';

  // Safety cap: stop an agentic tool loop that never settles — prevents the
  // "thinking forever" hang and runaway API cost if a tool keeps failing.
  const MAX_TOOL_ROUNDS = 16;
  let round = 0;

  while (true) {
    const params = {
      model: MODEL,
      // Roomy output budget so JARVIS finishes the whole answer instead of
      // getting cut off mid-job. (Output here = thinking + visible reply.)
      max_tokens: 8192,
      system: PERSONAS.jarvis.system,
      tools: JARVIS_TOOLS,
      messages,
    };
    // Extended thinking makes it reason through hard, multi-step requests before
    // acting — the difference between a smart operator and a chatbot.
    if (USE_THINKING) params.thinking = { type: 'enabled', budget_tokens: THINKING_BUDGET };

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
