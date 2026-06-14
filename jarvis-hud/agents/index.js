require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { GoogleGenerativeAI } = require('@google/generative-ai');
const PERSONAS = require('./personas');
const { JARVIS_TOOLS } = require('./tools');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// gemini-2.0-flash — fast, free-tier, strong tool use. Override with JARVIS_MODEL in .env.
const MODEL = process.env.JARVIS_MODEL || 'gemini-2.0-flash';

// Convert Anthropic-style input_schema → Gemini functionDeclarations parameters.
// Also normalises union type arrays (e.g. ['object','string']) to the first type.
function toGeminiFunctions(tools) {
  return tools.map(({ name, description, input_schema }) => {
    const params = JSON.parse(JSON.stringify(input_schema)); // deep clone
    sanitiseSchema(params);
    return { name, description, parameters: params };
  });
}

function sanitiseSchema(obj) {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj.type)) obj.type = obj.type[0]; // Gemini doesn't allow union types
  for (const v of Object.values(obj)) sanitiseSchema(v);
}

// Convert Anthropic-format history ({ role, content }) → Gemini format ({ role, parts })
function toGeminiHistory(messages) {
  return messages.map(({ role, content }) => ({
    role: role === 'assistant' ? 'model' : 'user',
    parts: [{ text: typeof content === 'string' ? content : JSON.stringify(content) }],
  }));
}

/**
 * Run a sub-agent (Hannah, Marcus, Rob) — text-only, no tools.
 * Streams tokens via onToken callback.
 */
async function runSubAgent(agentName, task, onToken) {
  const persona = PERSONAS[agentName];
  if (!persona) throw new Error(`Unknown agent: ${agentName}`);

  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: persona.system,
  });

  const result = await model.generateContentStream([
    { role: 'user', parts: [{ text: task }] },
  ]);

  let fullText = '';
  for await (const chunk of result.stream) {
    let tok = '';
    try { tok = chunk.text(); } catch { /* function call chunk — skip */ }
    if (tok) {
      fullText += tok;
      if (onToken) onToken(tok);
    }
  }
  return fullText;
}

/**
 * Run JARVIS with full tool-use agentic loop.
 * Streams text tokens via onToken. Calls onToolCall for each tool.
 * Continues looping until the model stops requesting function calls.
 */
async function runJarvis(message, claudeHistory, { onToken, onToolCall }) {
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: PERSONAS.jarvis.system,
    tools: [{ functionDeclarations: toGeminiFunctions(JARVIS_TOOLS) }],
    toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
  });

  const chat = model.startChat({ history: toGeminiHistory(claudeHistory) });

  let assistantText = '';
  let currentInput = message;

  while (true) {
    const streamResult = await chat.sendMessageStream(currentInput);

    // Drain the stream — text chunks arrive here, function-call chunks are silent
    for await (const chunk of streamResult.stream) {
      let tok = '';
      try { tok = chunk.text(); } catch { /* function-call part — handled below */ }
      if (tok) {
        assistantText += tok;
        if (onToken) onToken(tok);
      }
    }

    const response = await streamResult.response;
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const functionCalls = parts.filter(p => p.functionCall).map(p => p.functionCall);

    if (!functionCalls.length) break; // no more tool calls → we're done

    if (assistantText && !assistantText.endsWith('\n')) assistantText += '\n';

    // Execute every function call and collect responses
    const functionResponses = [];
    for (const fc of functionCalls) {
      let toolResult;
      try {
        toolResult = await onToolCall(fc.name, fc.args);
      } catch (err) {
        toolResult = JSON.stringify({ error: err.message });
      }
      const resultStr = typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult);
      functionResponses.push({
        functionResponse: { name: fc.name, response: { result: resultStr } },
      });
    }

    // Feed results back so the model can continue
    currentInput = functionResponses;
  }

  return assistantText;
}

module.exports = { runJarvis, runSubAgent };
