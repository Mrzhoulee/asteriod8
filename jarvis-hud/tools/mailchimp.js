// Mailchimp Marketing API — audiences, subscribers, campaigns, and reports.
//
// Setup:
//   MAILCHIMP_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-us21
//   (The "-us21" suffix is your data center — the code reads it automatically.)
//   Get a key: Mailchimp → Account → Extras → API keys.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

function config() {
  const key = process.env.MAILCHIMP_API_KEY;
  if (!key) return null;
  const dc = key.split('-')[1];
  if (!dc) return null;
  return { key, base: `https://${dc}.api.mailchimp.com/3.0` };
}

async function mc(method, path, body) {
  const cfg = config();
  if (!cfg) return { success: false, error: 'Mailchimp not configured. Set MAILCHIMP_API_KEY (e.g. abc123-us21) in .env.' };

  const auth = Buffer.from(`anystring:${cfg.key}`).toString('base64');
  const res = await fetch(`${cfg.base}${path}`, {
    method,
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return { success: true, data: null };
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, error: data.detail || data.title || `Mailchimp ${res.status}`, errors: data.errors };
  }
  return { success: true, data };
}

/** List all audiences (lists) with member counts. */
async function listAudiences() {
  const r = await mc('GET', '/lists?count=50&fields=lists.id,lists.name,lists.stats.member_count,lists.stats.unsubscribe_count');
  if (!r.success) return r;
  return {
    success: true,
    audiences: (r.data.lists || []).map((l) => ({
      id: l.id,
      name: l.name,
      members: l.stats?.member_count,
      unsubscribed: l.stats?.unsubscribe_count,
    })),
  };
}

/** Detailed stats for one audience. */
async function audienceStats(listId) {
  if (!listId) return { success: false, error: 'listId required (get it from list_audiences).' };
  const r = await mc('GET', `/lists/${listId}`);
  if (!r.success) return r;
  const d = r.data;
  return {
    success: true,
    name: d.name,
    members: d.stats?.member_count,
    unsubscribed: d.stats?.unsubscribe_count,
    cleaned: d.stats?.cleaned_count,
    openRate: d.stats?.open_rate,
    clickRate: d.stats?.click_rate,
    lastSubscribed: d.stats?.last_sub_date,
  };
}

/** Add or update a subscriber. */
async function addSubscriber({ listId, email, firstName, lastName, tags, status = 'subscribed' }) {
  if (!listId || !email) return { success: false, error: 'listId and email are required.' };
  const r = await mc('POST', `/lists/${listId}/members`, {
    email_address: email,
    status,
    merge_fields: { ...(firstName ? { FNAME: firstName } : {}), ...(lastName ? { LNAME: lastName } : {}) },
    ...(tags ? { tags } : {}),
  });
  if (!r.success) return r;
  return { success: true, id: r.data.id, email: r.data.email_address, status: r.data.status };
}

/** List recent campaigns. */
async function listCampaigns({ count = 10 } = {}) {
  const r = await mc('GET', `/campaigns?count=${count}&sort_field=create_time&sort_dir=DESC&fields=campaigns.id,campaigns.settings.title,campaigns.settings.subject_line,campaigns.status,campaigns.send_time`);
  if (!r.success) return r;
  return {
    success: true,
    campaigns: (r.data.campaigns || []).map((c) => ({
      id: c.id,
      title: c.settings?.title,
      subject: c.settings?.subject_line,
      status: c.status,
      sentAt: c.send_time,
    })),
  };
}

/**
 * Create a campaign, set its content, and optionally send it.
 * @param {object} o
 * @param {string} o.listId
 * @param {string} o.subject
 * @param {string} o.fromName
 * @param {string} o.replyTo
 * @param {string} o.html       Email body HTML
 * @param {string} [o.title]    Internal name
 * @param {boolean} [o.send]    Send immediately (otherwise saved as draft)
 */
async function createCampaign({ listId, subject, fromName, replyTo, html, title, send = false }) {
  if (!listId || !subject || !fromName || !replyTo) {
    return { success: false, error: 'listId, subject, fromName, and replyTo are required.' };
  }

  const created = await mc('POST', '/campaigns', {
    type: 'regular',
    recipients: { list_id: listId },
    settings: {
      subject_line: subject,
      title: title || subject,
      from_name: fromName,
      reply_to: replyTo,
    },
  });
  if (!created.success) return created;
  const campaignId = created.data.id;

  if (html) {
    const content = await mc('PUT', `/campaigns/${campaignId}/content`, { html });
    if (!content.success) return { success: false, error: `Created campaign ${campaignId} but content failed: ${content.error}`, campaignId };
  }

  if (send) {
    const sent = await mc('POST', `/campaigns/${campaignId}/actions/send`);
    if (!sent.success) return { success: false, error: `Created campaign ${campaignId} but send failed: ${sent.error}`, campaignId };
    return { success: true, campaignId, sent: true };
  }

  return { success: true, campaignId, sent: false, note: 'Saved as draft. Set send:true to send it.' };
}

/** Open/click report for a sent campaign. */
async function campaignReport(campaignId) {
  if (!campaignId) return { success: false, error: 'campaignId required.' };
  const r = await mc('GET', `/reports/${campaignId}`);
  if (!r.success) return r;
  const d = r.data;
  return {
    success: true,
    subject: d.subject_line,
    emailsSent: d.emails_sent,
    opens: d.opens?.opens_total,
    openRate: d.opens?.open_rate,
    clicks: d.clicks?.clicks_total,
    clickRate: d.clicks?.click_rate,
    unsubscribes: d.unsubscribed,
    bounces: d.bounces?.hard_bounces,
  };
}

module.exports = {
  listAudiences,
  audienceStats,
  addSubscriber,
  listCampaigns,
  createCampaign,
  campaignReport,
};
