require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const Anthropic = require('@anthropic-ai/sdk');
const PERSONAS = require('./personas');
const { JARVIS_TOOLS } = require('./tools');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-opus-4-6';

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

  await stream.finalMessage(); // ensure stream is fully consumed
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

  // Agentic loop — keeps going while JARVIS wants to use tools
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
        if (onToken) onToken(event.delta.text);
      }
    }

    const finalMsg = await stream.finalMessage();

    // Add JARVIS's full response to the conversation
    messages.push({ role: 'assistant', content: finalMsg.content });

    if (finalMsg.stop_reason !== 'tool_use') break;

    // Process all tool calls and collect results
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

    // Feed results back so JARVIS can respond
    messages.push({ role: 'user', content: toolResults });
  }
}

module.exports = { runJarvis, runSubAgent };
