// Multi-account email. Accounts are defined in .env with simple numbered keys:
//
//   GMAIL_ACCOUNT_1_LABEL=Personal
//   GMAIL_ACCOUNT_1_USER=me@gmail.com
//   GMAIL_ACCOUNT_1_PASS=ernt xvok demw yzni
//
//   GMAIL_ACCOUNT_2_LABEL=Work
//   GMAIL_ACCOUNT_2_USER=work@company.com
//   GMAIL_ACCOUNT_2_PASS=yyyy yyyy yyyy yyyy
//
// (App-password spaces are stripped automatically.) For a non-Gmail SMTP
// account, add GMAIL_ACCOUNT_N_HOST / _PORT / _SECURE.
//
// Single-account legacy format still works: GMAIL_USER / GMAIL_PASS or SMTP_*.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const nodemailer = require('nodemailer');

// Gmail app passwords are shown in groups of 4 with spaces — strip them.
function cleanGmailPass(pass) {
  return pass ? pass.replace(/\s+/g, '') : pass;
}

// ── Account loader ────────────────────────────────────────────────────────────

function loadAccounts() {
  const accounts = [];

  // Numbered accounts: GMAIL_ACCOUNT_<N>_USER / _PASS / _LABEL / _HOST / ...
  const indices = new Set();
  for (const key of Object.keys(process.env)) {
    const m = key.match(/^GMAIL_ACCOUNT_(\d+)_USER$/);
    if (m) indices.add(parseInt(m[1], 10));
  }
  for (const n of [...indices].sort((a, b) => a - b)) {
    const p = `GMAIL_ACCOUNT_${n}_`;
    const user = process.env[`${p}USER`];
    const pass = process.env[`${p}PASS`];
    if (!user || !pass) continue;
    const host = process.env[`${p}HOST`] || null;
    accounts.push({
      label: process.env[`${p}LABEL`] || user,
      user,
      pass: host ? pass : cleanGmailPass(pass), // only strip spaces for Gmail
      host,
      port: parseInt(process.env[`${p}PORT`] || '587', 10),
      secure: process.env[`${p}SECURE`] === 'true',
    });
  }

  // Legacy single Gmail account
  if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
    const already = accounts.some((a) => a.user === process.env.GMAIL_USER);
    if (!already) {
      accounts.unshift({
        label: 'default',
        user: process.env.GMAIL_USER,
        pass: cleanGmailPass(process.env.GMAIL_PASS),
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

  // Bounded timeouts so a bad network/credential can't hang verify() or send forever.
  const timeouts = { connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000 };
  const transport = account.host
    ? nodemailer.createTransport({
        host: account.host,
        port: account.port,
        secure: account.secure,
        auth: { user: account.user, pass: account.pass },
        ...timeouts,
      })
    : nodemailer.createTransport({
        service: 'gmail',
        auth: { user: account.user, pass: account.pass },
        ...timeouts,
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
    const displayName = account.label && account.label !== 'default' ? account.label.replace(/"/g, '') : '';
    const info = await transport.sendMail({
      from: displayName ? `"${displayName}" <${account.user}>` : account.user,
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

// Map raw SMTP errors to plain guidance the user can act on.
function friendlyMailError(err) {
  const m = (err && err.message) || String(err);
  const low = m.toLowerCase();
  if (low.includes('username and password not accepted') || low.includes('invalid login') ||
      low.includes('badcredentials') || (err && err.responseCode === 535)) {
    return 'Gmail rejected the login. Use a 16-character App Password (NOT your normal Gmail password), and make sure 2-Step Verification is ON. Create one at myaccount.google.com/apppasswords.';
  }
  if (low.includes('missing credentials')) return 'Username or password is empty — check GMAIL_ACCOUNT_1_USER / _PASS in .env.';
  if (low.includes('timeout') || low.includes('etimedout') || low.includes('econnrefused') || low.includes('enotfound')) {
    return 'Could not reach the mail server — check your network/firewall, or the SMTP host/port for a non-Gmail account.';
  }
  return m;
}

/**
 * Verify each configured account can actually authenticate (real SMTP handshake,
 * no email sent). Surfaces the true connection state instead of just "is a
 * username set". Returns per-account ok/error.
 */
async function verifyAccounts() {
  const accounts = loadAccounts();
  if (!accounts.length) {
    return {
      configured: false,
      success: false,
      accounts: [],
      error: 'No email account configured. Add GMAIL_ACCOUNT_1_USER and GMAIL_ACCOUNT_1_PASS (a Gmail App Password) to your .env, then restart.',
    };
  }
  const results = [];
  for (const a of accounts) {
    try {
      await getTransporter(a).verify();
      results.push({ label: a.label, user: a.user, ok: true });
    } catch (err) {
      results.push({ label: a.label, user: a.user, ok: false, error: friendlyMailError(err) });
    }
  }
  return { configured: true, success: results.every((r) => r.ok), accounts: results };
}

/**
 * Read emails from a Gmail/IMAP inbox.
 *
 * @param {object} opts
 * @param {string} [opts.account]     label or email of the account to read
 * @param {string} [opts.folder]      mailbox folder (default "INBOX")
 * @param {number} [opts.limit]       max messages to return (default 10, max 50)
 * @param {string} [opts.search]      search subject/from by this string
 * @param {boolean} [opts.unreadOnly] only return unseen messages
 */
async function readEmails({ account, folder = 'INBOX', limit = 10, search, unreadOnly = false } = {}) {
  let ImapFlow;
  try {
    ImapFlow = require('imapflow').ImapFlow;
  } catch {
    return { success: false, error: 'IMAP library not installed. Run: cd jarvis-hud && npm install' };
  }

  const acc = resolveAccount(account);
  if (!acc) {
    return { success: false, error: 'No email account configured. Add GMAIL_ACCOUNT_1_USER and GMAIL_ACCOUNT_1_PASS to .env.' };
  }

  // Derive IMAP host: custom accounts specify a HOST, Gmail uses imap.gmail.com.
  const imapHost = acc.host
    ? acc.host.replace(/^smtp\./i, 'imap.')
    : 'imap.gmail.com';

  const client = new ImapFlow({
    host: imapHost,
    port: 993,
    secure: true,
    auth: { user: acc.user, pass: acc.pass },
    logger: false,
  });

  try {
    await client.connect();
    await client.mailboxOpen(folder);

    // Build search query for imapflow
    let query;
    if (search) {
      const s = String(search).trim();
      query = unreadOnly
        ? { seen: false, or: [{ subject: s }, { from: s }] }
        : { or: [{ subject: s }, { from: s }] };
    } else {
      query = unreadOnly ? { seen: false } : { all: true };
    }

    const uids = await client.search(query, { uid: true });
    const n = Math.min(Math.max(parseInt(limit) || 10, 1), 50);
    const take = uids.slice(-n); // last N UIDs = most recent messages

    const emails = [];
    if (take.length) {
      for await (const msg of client.fetch(take, { envelope: true, flags: true }, { uid: true })) {
        const f0 = msg.envelope?.from?.[0];
        emails.push({
          uid: msg.uid,
          from: f0?.address || '',
          fromName: f0?.name || '',
          subject: msg.envelope?.subject || '(no subject)',
          date: msg.envelope?.date ? new Date(msg.envelope.date).toISOString() : '',
          unread: !msg.flags?.has('\\Seen'),
        });
      }
    }

    await client.logout();
    return {
      success: true,
      account: acc.label,
      folder,
      total: uids.length,
      shown: emails.length,
      emails: emails.reverse(), // newest first
    };
  } catch (err) {
    try { await client.logout(); } catch {}
    return { success: false, error: friendlyMailError(err) };
  }
}

module.exports = { sendEmail, listAccounts, verifyAccounts, readEmails };
