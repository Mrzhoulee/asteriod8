const JARVIS_TOOLS = [
  {
    name: 'delegate_to_agent',
    description:
      'Delegate a task to a specialized team member. Use Hannah for marketing/copywriting, Marcus for development/code, Rob for customer success/communications.',
    input_schema: {
      type: 'object',
      properties: {
        agent: {
          type: 'string',
          enum: ['hannah', 'marcus', 'rob'],
          description: 'Which agent to delegate to',
        },
        task: {
          type: 'string',
          description: 'The specific task or question to send to the agent, with full context',
        },
      },
      required: ['agent', 'task'],
    },
  },
  {
    name: 'send_email',
    description:
      'Send an email via the configured mail provider. A confirmation dialog will appear before sending unless the user said to skip confirmation.',
    input_schema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject line' },
        body: { type: 'string', description: 'Email body (plain text or HTML)' },
        cc: { type: 'string', description: 'CC address (optional)' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'run_shell_command',
    description:
      'Run a safe shell command on the local machine. Only whitelisted safe commands are allowed — no destructive operations.',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The shell command to execute' },
      },
      required: ['command'],
    },
  },
  {
    name: 'open_url',
    description: 'Open a URL in the default browser.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to open' },
      },
      required: ['url'],
    },
  },
];

module.exports = { JARVIS_TOOLS };
