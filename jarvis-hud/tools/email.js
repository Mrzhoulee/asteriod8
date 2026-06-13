// Multi-account email. Accounts are defined in .env as a JSON array:
//
//   GMAIL_ACCOUNTS=[
//     {"label":"Personal","user":"me@gmail.com","pass":"xxxx-xxxx-xxxx-xxxx"},
//     {"label":"Work","user":"work@company.com","pass":"yyyy-yyyy-yyyy-yyyy"},
//     {"label":"Support","user":"support@company.com","pass":"zzzz-zzzz-zzzz-zzzz"}
//   ]
//
// Single-account legacy format still works (GMAIL_USER / GMAIL_PASS).
// SMTP accounts can be mixed in too:
//   {"label":"Outlook","host":"smtp.office365.com","port":587,"user":"...","pass":"..."}
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const nodemailer = require('nodemailer');

// ── Account loader ────────────────────────────────────────────────────────────

function loadAccounts() {
  const accounts = [];

  // Multi-account JSON array
  if (process.env.GMAIL_ACCOUNTS) {
    try {
      const parsed = JSON.parse(process.env.GMAIL_ACCOUNTS);
      for (const a of parsed) {
        accounts.push({
          label: a.label || a.user,
          user: a.user,
          pass: a.pass,
          host: a.host || null,  // null = Gmail service
          port: a.port || 587,
          secure: a.secure || false,
        });
      }
    } catch (e) {
      console.error('[email] Could not parse GMAIL_ACCOUNTS JSON:', e.message);
    }
  }

  // Legacy single account — added as "default" if not already in array
  if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
    const already = accounts.some((a) => a.user === process.env.GMAIL_USER);
    if (!already) {
      accounts.unshift({
        label: 'default',
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
        host: null,
      });
    }
  }

  // SMTP fallback
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    const already = accounts.some((a) => a.user === process.env.SMTP_USER);
    if (!already) {
      accounts.push({
        label: 'smtp',
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
      });
    }
  }

  return accounts;
}

// ── Transporter cache (one per account) ──────────────────────────────────────

const _transporters = new Map(); // label -> nodemailer transport

function getTransporter(account) {
  if (_transporters.has(account.label)) return _transporters.get(account.label);

  const transport = account.host
    ? nodemailer.createTransport({
        host: account.host,
        port: account.port,
        secure: account.secure,
        auth: { user: account.user, pass: account.pass },
      })
    : nodemailer.createTransport({
        service: 'gmail',
        auth: { user: account.user, pass: account.pass },
      });

  _transporters.set(account.label, transport);
  return transport;
}

// ── Account resolution ────────────────────────────────────────────────────────

function resolveAccount(fromAccount) {
  const accounts = loadAccounts();
  if (!accounts.length) return null;

  if (!fromAccount) return accounts[0]; // default = first in list

  const q = fromAccount.toLowerCase();
  // Match by label or email address (partial OK for label)
  return (
    accounts.find((a) => a.label.toLowerCase() === q) ||
    accounts.find((a) => a.user.toLowerCase() === q) ||
    accounts.find((a) => a.label.toLowerCase().includes(q)) ||
    accounts[0]
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Return a summary of configured accounts (no passwords). */
function listAccounts() {
  return loadAccounts().map((a, i) => ({
    index: i,
    label: a.label,
    user: a.user,
    isDefault: i === 0,
  }));
}

/**
 * @param {object} opts
 * @param {string} opts.to
 * @param {string} opts.subject
 * @param {string} opts.body
 * @param {string} [opts.cc]
 * @param {string} [opts.attachmentPath]
 * @param {string} [opts.fromAccount]  label or email of the sender account
 */
async function sendEmail({ to, subject, body, cc, attachmentPath, fromAccount }) {
  const account = resolveAccount(fromAccount);
  if (!account) {
    return {
      success: false,
      error:
        'No email accounts configured. Add GMAIL_ACCOUNTS (JSON array) or GMAIL_USER/GMAIL_PASS to .env.',
    };
  }

  const transport = getTransporter(account);
  const isHtml = /<[a-z][\s\S]*>/i.test(body);

  const attachments = [];
  if (attachmentPath) {
    const fs = require('fs');
    if (fs.existsSync(attachmentPath)) attachments.push({ path: attachmentPath });
  }

  try {
    const info = await transport.sendMail({
      from: `${account.label !== 'default' ? account.label + ' ' : ''}<${account.user}>`,
      to,
      cc: cc || undefined,
      subject,
      ...(isHtml ? { html: body } : { text: body }),
      ...(attachments.length ? { attachments } : {}),
    });
    return { success: true, messageId: info.messageId, from: account.user, account: account.label };
  } catch (err) {
    return { success: false, error: err.message, account: account.label };
  }
}

module.exports = { sendEmail, listAccounts };
