// Tool definitions exposed to JARVIS. This is the full "do anything" surface:
// delegation, computer control, communications, scheduling, social, and the web.
const JARVIS_TOOLS = [
  {
    name: 'delegate_to_agent',
    description:
      'Delegate a task to a specialist teammate. Hannah=marketing/copy, Marcus=development/code, Rob=customer success/comms.',
    input_schema: {
      type: 'object',
      properties: {
        agent: { type: 'string', enum: ['hannah', 'marcus', 'rob'] },
        task: { type: 'string', description: 'The task with full context.' },
      },
      required: ['agent', 'task'],
    },
  },

  {
    name: 'run_command',
    description:
      'Run any shell command on the user\'s Mac (zsh/bash). Use for git, npm, file ops, system info, automation — anything a terminal can do. Safe commands run immediately; destructive ones (rm, sudo, etc.) trigger a confirmation dialog the user must approve.',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The exact shell command.' },
        cwd: { type: 'string', description: 'Optional working directory.' },
      },
      required: ['command'],
    },
  },

  {
    name: 'run_applescript',
    description:
      'Run AppleScript to control any scriptable Mac app: Messages, Mail, Calendar, Music, Finder, Safari/Chrome, Keynote, System Events (UI automation, keystrokes), Reminders, Notes, etc. The most powerful way to "do anything" on the Mac.',
    input_schema: {
      type: 'object',
      properties: {
        script: { type: 'string', description: 'The AppleScript source.' },
        purpose: { type: 'string', description: 'One line on what this does (shown to the user).' },
      },
      required: ['script'],
    },
  },

  {
    name: 'control_mac',
    description:
      'Common Mac actions without writing AppleScript. Actions: screenshot, notify, open_app, set_volume, clipboard_read, clipboard_write.',
    input_schema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['screenshot', 'notify', 'open_app', 'set_volume', 'clipboard_read', 'clipboard_write'],
        },
        app: { type: 'string', description: 'App name for open_app.' },
        title: { type: 'string', description: 'Notification title.' },
        message: { type: 'string', description: 'Notification body.' },
        level: { type: 'number', description: 'Volume 0–100 for set_volume.' },
        text: { type: 'string', description: 'Text for clipboard_write.' },
        interactive: { type: 'boolean', description: 'screenshot: let user pick a region.' },
      },
      required: ['action'],
    },
  },

  {
    name: 'send_email',
    description: 'Send an email from a configured Gmail/SMTP account. A confirmation dialog appears unless the user said to skip it. If the user says "from my work email" or "from personal", pass that as fromAccount.',
    input_schema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient address(es), comma-separated.' },
        subject: { type: 'string' },
        body: { type: 'string' },
        cc: { type: 'string' },
        fromAccount: {
          type: 'string',
          description: 'Which account to send from — use the label (e.g. "Work", "Personal") or the email address. Omit to use the default (first configured) account.',
        },
        attachmentPath: { type: 'string', description: 'Optional local file path to attach (e.g. a generated .ics invite).' },
      },
      required: ['to', 'subject', 'body'],
    },
  },

  {
    name: 'open_url',
    description: 'Open a URL in the default browser.',
    input_schema: {
      type: 'object',
      properties: { url: { type: 'string' } },
      required: ['url'],
    },
  },

  {
    name: 'post_social',
    description:
      'Post to social media. For TikTok videos/photos use platform="tiktok" with mediaUrl. For Instagram photos/reels/carousels use platform="instagram" with mediaUrl or mediaUrls. For X, LinkedIn, Facebook, Threads, Reddit — uses a webhook (if configured) or opens a compose window.',
    input_schema: {
      type: 'object',
      properties: {
        platform: { type: 'string', description: 'x, twitter, linkedin, facebook, threads, reddit, tiktok, instagram' },
        text: { type: 'string', description: 'Caption or post copy.' },
        link: { type: 'string', description: 'Optional URL to include.' },
        mediaUrl: { type: 'string', description: 'Public HTTPS URL to an image or video (for TikTok & Instagram).' },
        mediaUrls: { type: 'array', items: { type: 'string' }, description: 'Multiple media URLs for a carousel (Instagram) or photo post (TikTok).' },
        hashtags: { type: 'array', items: { type: 'string' }, description: 'Hashtags to append (Instagram/TikTok). No # needed — added automatically.' },
      },
      required: ['platform', 'text'],
    },
  },

  {
    name: 'get_analytics',
    description:
      'Fetch analytics. Sources: "ga4" (Google Analytics users/sessions/pageviews), "appstore"/"appstore_reviews"/"appstore_apps" (App Store Connect), "appfigures_sales"/"appfigures_reviews"/"appfigures_ratings"/"appfigures_products" (Appfigures cross-store app analytics).',
    input_schema: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          enum: ['ga4', 'appstore', 'appstore_reviews', 'appstore_apps', 'appfigures_sales', 'appfigures_reviews', 'appfigures_ratings', 'appfigures_products'],
          description: 'Which analytics source to query.',
        },
        startDate: { type: 'string', description: 'GA4: "7daysAgo"/"YYYY-MM-DD". App Store: "YYYY-MM". Appfigures: "YYYY-MM-DD".' },
        endDate: { type: 'string', description: 'End date where applicable ("today" or "YYYY-MM-DD").' },
        metrics: { type: 'array', items: { type: 'string' }, description: 'GA4 metric names (e.g. ["activeUsers","sessions"]).' },
        dimensions: { type: 'array', items: { type: 'string' }, description: 'GA4 dimension names (e.g. ["date","country"]).' },
        propertyId: { type: 'string', description: 'GA4 property ID override.' },
        frequency: { type: 'string', description: 'App Store report frequency: DAILY, WEEKLY, MONTHLY.' },
        appId: { type: 'string', description: 'App Store app ID (for appstore_reviews).' },
        groupBy: { type: 'string', description: 'Appfigures sales grouping: product, date, country, or store.' },
      },
      required: ['source'],
    },
  },

  {
    name: 'mailchimp',
    description:
      'Manage Mailchimp email marketing. Actions: list_audiences, audience_stats, add_subscriber, list_campaigns, create_campaign (optionally send), campaign_report.',
    input_schema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list_audiences', 'audience_stats', 'add_subscriber', 'list_campaigns', 'create_campaign', 'campaign_report'],
        },
        listId: { type: 'string', description: 'Audience/list ID (from list_audiences).' },
        email: { type: 'string', description: 'Subscriber email (add_subscriber).' },
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        subject: { type: 'string', description: 'Campaign subject line (create_campaign).' },
        fromName: { type: 'string', description: 'Sender name (create_campaign).' },
        replyTo: { type: 'string', description: 'Reply-to email (create_campaign).' },
        html: { type: 'string', description: 'Campaign HTML body (create_campaign).' },
        title: { type: 'string', description: 'Internal campaign name.' },
        send: { type: 'boolean', description: 'create_campaign: send immediately instead of saving a draft.' },
        campaignId: { type: 'string', description: 'Campaign ID (campaign_report).' },
      },
      required: ['action'],
    },
  },

  {
    name: 'schedule_event',
    description:
      'Schedule a call/meeting/event. Adds it to macOS Calendar and produces an .ics invite you can email to attendees with send_email.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        start: { type: 'string', description: 'ISO 8601 or natural date, e.g. "2026-06-14T15:00:00".' },
        end: { type: 'string', description: 'Optional ISO end time.' },
        durationMinutes: { type: 'number', description: 'Used if no end given (default 30).' },
        location: { type: 'string', description: 'Place or a Zoom/Meet link.' },
        notes: { type: 'string' },
        attendees: { type: 'array', items: { type: 'string' }, description: 'Attendee emails.' },
        calendar: { type: 'string', description: 'Target calendar name.' },
      },
      required: ['title', 'start'],
    },
  },

  {
    name: 'web_request',
    description:
      'Make an authenticated HTTP request to any web API — the way to check analytics, fetch data, or trigger services (Stripe, Google Analytics, GitHub, any REST API). Use authProfile to inject a configured secret without seeing it.',
    input_schema: {
      type: 'object',
      properties: {
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
        url: { type: 'string' },
        headers: { type: 'object', description: 'Extra request headers.' },
        body: { type: ['object', 'string'], description: 'Request body for non-GET.' },
        authProfile: { type: 'string', description: 'Name of a WEB_AUTH_* secret in .env (e.g. "stripe").' },
      },
      required: ['url'],
    },
  },

  {
    name: 'read_file',
    description: 'Read a text file (supports ~ home expansion).',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path'],
    },
  },

  {
    name: 'write_file',
    description: 'Write or append to a file. Triggers a confirmation dialog before writing.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string' },
        append: { type: 'boolean' },
      },
      required: ['path', 'content'],
    },
  },

  {
    name: 'list_directory',
    description: 'List files and folders in a directory.',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path'],
    },
  },
];

module.exports = { JARVIS_TOOLS };
