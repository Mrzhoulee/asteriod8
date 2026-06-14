require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const Anthropic = require('@anthropic-ai/sdk');
const PERSONAS = require('./personas');
const { JARVIS_TOOLS } = require('./tools');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
// claude-sonnet-4-6 — strong tool-use at lower cost than Opus.
// Override with JARVIS_MODEL in .env (e.g. claude-opus-4-8, claude-haiku-4-5).
const MODEL = process.env.JARVIS_MODEL || 'claude-sonnet-4-6';

/**
 * Run a sub-agent (Hannah, Marcus, Rob) — text-only, no tools.
 * Streams tokens via onToken callback.
 */
async function runSubAgent(agentName, task, onToken) {
  const persona = PERSONAS[agentName];
  if (!persona) throw new Error(`Unknown agent: ${agentName}`);

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 2048,
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

  while (true) {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 4096,
      system: PERSONAS.jarvis.system,
      tools: JARVIS_TOOLS,
      messages,
    });

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

    if (finalMsg.stop_reason !== 'tool_use') break;

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
