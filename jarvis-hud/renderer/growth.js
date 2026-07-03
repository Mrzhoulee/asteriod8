'use strict';

// ═══════════════════════════════════════════════════════════════════════════════
//  ASTEROID GROWTH SUITE — everything a music-app founder needs to hit 1,000 users.
//  Three hubs: Growth (⌘5), Toolkit (⌘6), Focus (⌘7). Loaded after app.js and
//  shares its top-level helpers ($, LS, toast, escapeHTML, addLog, download,
//  openOverlay/closeOverlay, sendMessage, state, settings).
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Tiny helpers ────────────────────────────────────────────────────────────────
function gToday() { return new Date().toLocaleDateString('en-CA'); } // local YYYY-MM-DD
function gUid() { return crypto.randomUUID().slice(0, 8); }
const G_KEYS = [
  'gr_goal', 'gr_checklist', 'gr_experiments', 'gr_calendar', 'gr_crm',
  'gr_feedback', 'gr_testimonials', 'gr_competitors', 'gr_launch',
  'tk_prompts', 'tk_utm_history', 'tk_press', 'fc_goals', 'fc_scratch', 'fc_pomo',
];

// Hand a task to JARVIS: prefill the chat input and fire it (or queue if busy).
function sendToJarvis(prompt) {
  const inp = $('user-input');
  inp.value = prompt;
  closeOverlay();
  if (state.activeRequestId) {
    toast('JARVIS is busy — prompt loaded, press Enter when ready');
    inp.focus();
    return;
  }
  sendMessage();
}

// ─── Confetti (milestones, finished focus sessions) ─────────────────────────────
function confettiBurst() {
  const cv = document.createElement('canvas');
  cv.id = 'confetti-canvas';
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  cv.width = window.innerWidth; cv.height = window.innerHeight;
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00d4ff';
  const colors = [accent, '#ffd700', '#ff6eb4', '#00ff88', '#ffffff'];
  const parts = Array.from({ length: 110 }, () => ({
    x: cv.width / 2 + (Math.random() - 0.5) * 160,
    y: cv.height * 0.42,
    vx: (Math.random() - 0.5) * 11,
    vy: -Math.random() * 11 - 3,
    s: Math.random() * 5 + 2,
    c: colors[Math.floor(Math.random() * colors.length)],
    r: Math.random() * Math.PI,
  }));
  const t0 = performance.now();
  (function frame(t) {
    const dt = (t - t0) / 1400;
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.28; p.r += 0.1;
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.globalAlpha = Math.max(0, 1 - dt);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
      ctx.restore();
    }
    if (dt < 1) requestAnimationFrame(frame);
    else cv.remove();
  })(t0);
}

// ─── Stores ──────────────────────────────────────────────────────────────────────
function grGoal() {
  return Object.assign({ target: 1000, users: 0, log: [], celebrated: [] }, LS.get('gr_goal', {}));
}
const GR_MILESTONES = [10, 25, 50, 100, 250, 500, 750, 1000];

const GR_DEFAULT_CHECKLIST = [
  'Post 1 TikTok / Reel about Asteroid',
  'Engage with 10 comments in music communities',
  'DM 3 playlist curators or micro-influencers',
  'Check analytics — what moved yesterday?',
  'Ship or polish 1 small product improvement',
  'Reply to every user message / review',
];
function grChecklist() {
  const c = LS.get('gr_checklist', null);
  if (c && Array.isArray(c.items)) return c;
  return { items: GR_DEFAULT_CHECKLIST.map((text) => ({ id: gUid(), text })), doneByDay: {} };
}
function grStreak(doneByDay) {
  let streak = 0;
  const d = new Date();
  // If nothing is done yet today, the streak isn't broken until the day ends.
  if (!(doneByDay[gToday()] || []).length) d.setDate(d.getDate() - 1);
  for (;;) {
    const key = d.toLocaleDateString('en-CA');
    if ((doneByDay[key] || []).length) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}

// ─── Founder XP / levels (gamified consistency) ──────────────────────────────────
const GR_LEVELS = [
  [0, 'Garage Demo'], [150, 'Open Mic'], [400, 'Local Act'], [900, 'Indie Artist'],
  [1800, 'Rising Star'], [3500, 'Headliner'], [7000, 'Chart-Topper'], [12000, 'Platinum'],
];
function grXP() {
  const goal = grGoal();
  const check = grChecklist();
  const doneTotal = Object.values(check.doneByDay).reduce((n, a) => n + a.length, 0);
  const exps = LS.get('gr_experiments', []);
  const cal = LS.get('gr_calendar', []);
  const crm = LS.get('gr_crm', []);
  const pomo = LS.get('fc_pomo', { sessionsByDay: {} });
  const sessions = Object.values(pomo.sessionsByDay || {}).reduce((n, v) => n + v, 0);
  const xp =
    goal.users * 3 +
    doneTotal * 5 +
    exps.filter((e) => e.status === 'done').length * 25 +
    cal.filter((c) => c.status === 'posted').length * 15 +
    crm.filter((c) => c.status === 'won').length * 30 +
    grStreak(check.doneByDay) * 20 +
    sessions * 5;
  let level = GR_LEVELS[0], next = null;
  for (let i = 0; i < GR_LEVELS.length; i++) {
    if (xp >= GR_LEVELS[i][0]) { level = GR_LEVELS[i]; next = GR_LEVELS[i + 1] || null; }
  }
  return { xp, level, next };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  GROWTH HUB (⌘5)
// ═══════════════════════════════════════════════════════════════════════════════
const GR_TABS = [
  ['mission', '🎯 Mission'], ['checklist', '☑ Daily'], ['calendar', '📅 Content'],
  ['outreach', '🤝 Outreach'], ['experiments', '⚗ Experiments'], ['feedback', '💬 Feedback'],
  ['competitors', '🔭 Rivals'], ['launch', '🚀 Launch'],
];
let grTab = 'mission';

function buildGrowthHub() {
  const body = $('growth-body');
  body.innerHTML = `
    <div class="hub-tabs" id="gr-tabs">
      ${GR_TABS.map(([k, l]) => `<button class="hub-tab ${k === grTab ? 'active' : ''}" data-tab="${k}">${l}</button>`).join('')}
    </div>
    <div id="gr-tab-body"></div>`;
  $('gr-tabs').querySelectorAll('.hub-tab').forEach((b) =>
    b.addEventListener('click', () => { grTab = b.dataset.tab; buildGrowthHub(); }));
  const render = {
    mission: grRenderMission, checklist: grRenderChecklist, calendar: grRenderCalendar,
    outreach: grRenderOutreach, experiments: grRenderExperiments, feedback: grRenderFeedback,
    competitors: grRenderCompetitors, launch: grRenderLaunch,
  }[grTab];
  render($('gr-tab-body'));
}

// ── Mission: north-star tracker + XP + milestones + backup ──
function grRenderMission(host) {
  const goal = grGoal();
  const { xp, level, next } = grXP();
  const streak = grStreak(grChecklist().doneByDay);
  const pct = Math.min(100, (goal.users / goal.target) * 100);
  const xpPct = next ? Math.min(100, ((xp - level[0]) / (next[0] - level[0])) * 100) : 100;

  host.innerHTML = `
    <div class="g-card">
      <div class="g-flex">
        <div>
          <div class="g-sub">FOUNDER LEVEL</div>
          <div class="g-level">${level[1]}</div>
          <div class="g-sub">${xp} XP${next ? ` · ${next[0] - xp} to ${next[1]}` : ' · MAX'} · 🔥 ${streak}-day streak</div>
        </div>
        <div class="g-grow"></div>
        <div style="text-align:right;">
          <div class="g-big">${goal.users}<span class="g-dim"> / ${goal.target}</span></div>
          <div class="g-sub">USERS ON ASTEROID</div>
        </div>
      </div>
      <div class="g-bar"><div class="g-fill" style="width:${pct}%"></div></div>
      <div class="g-bar xp"><div class="g-fill" style="width:${xpPct}%"></div></div>
      <div class="ms-row">
        ${GR_MILESTONES.map((m) => `<span class="ms-item ${goal.users >= m ? 'done' : ''}">${m >= 1000 ? '1K 🏆' : m}</span>`).join('')}
      </div>
    </div>

    <div class="g-card">
      <div class="g-sub" style="margin-bottom:8px;">LOG NEW USERS — where did they come from?</div>
      <div class="g-form">
        <input class="g-input" id="gr-users-delta" type="number" placeholder="+ users" style="width:90px;">
        <select class="mini-select" id="gr-users-source">
          <option value="organic">Organic / word of mouth</option>
          <option value="tiktok">TikTok</option>
          <option value="instagram">Instagram</option>
          <option value="x">X / Twitter</option>
          <option value="reddit">Reddit / communities</option>
          <option value="press">Press / blogs</option>
          <option value="playlist">Playlist / curator</option>
          <option value="referral">Referral / invite</option>
          <option value="ads">Paid ads</option>
          <option value="other">Other</option>
        </select>
        <button class="ghost-btn" id="gr-users-add">Add</button>
        <span class="g-grow"></span>
        <input class="g-input" id="gr-target" type="number" value="${goal.target}" title="Goal target" style="width:80px;">
        <button class="ghost-btn" id="gr-target-set" title="Change target">Set goal</button>
      </div>
      <div class="g-log">
        ${goal.log.slice(-8).reverse().map((l) =>
          `<div class="g-log-line"><span class="g-dim">${new Date(l.t).toLocaleDateString()}</span>
           <span class="${l.delta >= 0 ? 'g-good' : 'g-bad'}">${l.delta >= 0 ? '+' : ''}${l.delta}</span>
           <span>${escapeHTML(l.source)}</span></div>`).join('') || '<div class="g-dim" style="font-size:11px;">No entries yet — log your first users above.</div>'}
      </div>
    </div>

    <div class="g-card">
      <div class="g-flex">
        <button class="ghost-btn" id="gr-ask-plan">🧠 Ask JARVIS: what should I do next?</button>
        <span class="g-grow"></span>
        <button class="ghost-btn" id="gr-export">⤓ Backup data</button>
        <button class="ghost-btn" id="gr-import">⤒ Import</button>
        <input type="file" id="gr-import-file" accept=".json" class="hidden">
      </div>
    </div>`;

  $('gr-users-add').addEventListener('click', () => {
    const delta = parseInt($('gr-users-delta').value, 10);
    if (!delta) { toast('Enter a user count', 'bad'); return; }
    const g = grGoal();
    const before = g.users;
    g.users = Math.max(0, g.users + delta);
    g.log.push({ t: Date.now(), delta, source: $('gr-users-source').value });
    if (g.log.length > 200) g.log = g.log.slice(-200);
    const crossed = GR_MILESTONES.filter((m) => before < m && g.users >= m && !g.celebrated.includes(m));
    crossed.forEach((m) => g.celebrated.push(m));
    LS.set('gr_goal', g);
    if (crossed.length) {
      confettiBurst();
      toast(`🎉 Milestone: ${crossed[crossed.length - 1]} users!`, 'good');
      addLog('system', `Milestone reached: ${crossed.join(', ')} users`);
    }
    grRenderMission(host);
  });
  $('gr-target-set').addEventListener('click', () => {
    const t = parseInt($('gr-target').value, 10);
    if (!t || t < 1) return;
    const g = grGoal(); g.target = t; LS.set('gr_goal', g);
    grRenderMission(host); toast(`Goal set: ${t} users`, 'good');
  });
  $('gr-ask-plan').addEventListener('click', () => {
    const g = grGoal();
    const bySource = {};
    g.log.forEach((l) => { bySource[l.source] = (bySource[l.source] || 0) + l.delta; });
    const src = Object.entries(bySource).map(([k, v]) => `${k}: ${v}`).join(', ') || 'no data yet';
    sendToJarvis(`I'm at ${g.users}/${g.target} users for Asteroid, my music platform app. Acquisition so far — ${src}. Check my live analytics with get_analytics if configured, then give me the 3 highest-leverage moves to make this week, ranked, with exactly how to execute each one.`);
  });
  $('gr-export').addEventListener('click', () => {
    const data = {};
    G_KEYS.forEach((k) => { data[k] = LS.get(k, null); });
    download(`asteroid-growth-backup-${gToday()}.json`, JSON.stringify(data, null, 2), 'application/json');
    toast('Growth data exported', 'good');
  });
  $('gr-import').addEventListener('click', () => $('gr-import-file').click());
  $('gr-import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        G_KEYS.forEach((k) => { if (data[k] != null) LS.set(k, data[k]); });
        toast('Growth data imported', 'good');
        grRenderMission(host);
      } catch { toast('Invalid backup file', 'bad'); }
    };
    reader.readAsText(file);
  });
}

// ── Daily checklist with streaks ──
function grRenderChecklist(host) {
  const c = grChecklist();
  const today = gToday();
  const done = c.doneByDay[today] || [];
  const streak = grStreak(c.doneByDay);
  const pct = c.items.length ? Math.round((done.length / c.items.length) * 100) : 0;

  host.innerHTML = `
    <div class="g-card">
      <div class="g-flex">
        <div class="g-sub">TODAY — ${done.length}/${c.items.length} done (${pct}%)</div>
        <span class="g-grow"></span>
        <span class="g-sub">🔥 ${streak}-DAY STREAK</span>
      </div>
      <div class="g-bar"><div class="g-fill" style="width:${pct}%"></div></div>
      <div class="g-list" id="gr-check-list">
        ${c.items.map((it) => `
          <div class="g-row">
            <div class="g-check ${done.includes(it.id) ? 'on' : ''}" data-id="${it.id}">${done.includes(it.id) ? '✓' : ''}</div>
            <span class="g-row-text ${done.includes(it.id) ? 'g-strike' : ''}">${escapeHTML(it.text)}</span>
            <button class="g-act" data-run="${it.id}" title="Do this with JARVIS">▶</button>
            <button class="g-del" data-del="${it.id}" title="Remove">✕</button>
          </div>`).join('')}
      </div>
      <div class="g-form" style="margin-top:10px;">
        <input class="g-input g-grow" id="gr-check-new" placeholder="Add a recurring daily task…">
        <button class="ghost-btn" id="gr-check-add">Add</button>
      </div>
    </div>`;

  const save = () => LS.set('gr_checklist', c);
  host.querySelectorAll('.g-check').forEach((el) => el.addEventListener('click', () => {
    const id = el.dataset.id;
    const arr = c.doneByDay[today] || (c.doneByDay[today] = []);
    const i = arr.indexOf(id);
    if (i >= 0) arr.splice(i, 1); else arr.push(id);
    if (arr.length === c.items.length && c.items.length) { confettiBurst(); toast('All daily tasks done! 🔥', 'good'); }
    save(); grRenderChecklist(host);
  }));
  host.querySelectorAll('[data-run]').forEach((b) => b.addEventListener('click', () => {
    const it = c.items.find((x) => x.id === b.dataset.run);
    sendToJarvis(`Help me complete this daily growth task for Asteroid (music platform app) right now: "${it.text}". Use your tools to actually do it where possible; otherwise give me the fastest concrete path and any copy I need.`);
  }));
  host.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    c.items = c.items.filter((x) => x.id !== b.dataset.del);
    save(); grRenderChecklist(host);
  }));
  $('gr-check-add').addEventListener('click', () => {
    const text = $('gr-check-new').value.trim();
    if (!text) return;
    c.items.push({ id: gUid(), text });
    save(); grRenderChecklist(host);
  });
}

// ── Content calendar ──
const GR_PLATFORMS = ['tiktok', 'instagram', 'x', 'youtube', 'reddit', 'other'];
const GR_CAL_STATUSES = ['idea', 'drafted', 'scheduled', 'posted'];
function grRenderCalendar(host) {
  const cal = LS.get('gr_calendar', []).sort((a, b) => a.date.localeCompare(b.date));
  host.innerHTML = `
    <div class="g-card">
      <div class="g-form">
        <input class="g-input" id="gr-cal-date" type="date" value="${gToday()}">
        <select class="mini-select" id="gr-cal-platform">${GR_PLATFORMS.map((p) => `<option>${p}</option>`).join('')}</select>
        <input class="g-input g-grow" id="gr-cal-idea" placeholder="Post idea… e.g. 'POV: your playlist finally gets you'">
        <button class="ghost-btn" id="gr-cal-add">Add</button>
      </div>
    </div>
    <div class="g-list">
      ${cal.map((c) => `
        <div class="g-row ${c.date < gToday() && c.status !== 'posted' ? 'g-overdue' : ''}">
          <span class="g-date">${c.date.slice(5)}</span>
          <span class="g-badge">${c.platform}</span>
          <span class="g-row-text">${escapeHTML(c.idea)}</span>
          <button class="g-chip-status st-${c.status}" data-cycle="${c.id}" title="Click to advance status">${c.status}</button>
          <button class="g-act" data-draft="${c.id}" title="Draft with Hannah">✍</button>
          <button class="g-act" data-post="${c.id}" title="Post via JARVIS">▶</button>
          <button class="g-del" data-del="${c.id}">✕</button>
        </div>`).join('') || '<div class="g-empty">No content planned. A post a day is the #1 driver to 1,000 users — add your first idea above.</div>'}
    </div>`;

  const save = (list) => LS.set('gr_calendar', list);
  $('gr-cal-add').addEventListener('click', () => {
    const idea = $('gr-cal-idea').value.trim();
    if (!idea) return;
    cal.push({ id: gUid(), date: $('gr-cal-date').value || gToday(), platform: $('gr-cal-platform').value, idea, status: 'idea' });
    save(cal); grRenderCalendar(host);
  });
  host.querySelectorAll('[data-cycle]').forEach((b) => b.addEventListener('click', () => {
    const c = cal.find((x) => x.id === b.dataset.cycle);
    c.status = GR_CAL_STATUSES[(GR_CAL_STATUSES.indexOf(c.status) + 1) % GR_CAL_STATUSES.length];
    save(cal); grRenderCalendar(host);
  }));
  host.querySelectorAll('[data-draft]').forEach((b) => b.addEventListener('click', () => {
    const c = cal.find((x) => x.id === b.dataset.draft);
    sendToJarvis(`Delegate to Hannah: write a ready-to-post ${c.platform} post for Asteroid, my music platform app. Idea: "${c.idea}". Include a scroll-stopping hook, the caption, and 8–12 niche music hashtags. Output only the final post, ready to paste.`);
  }));
  host.querySelectorAll('[data-post]').forEach((b) => b.addEventListener('click', () => {
    const c = cal.find((x) => x.id === b.dataset.post);
    sendToJarvis(`Post to ${c.platform} now with post_social: turn this idea into the final caption and post it — "${c.idea}". If the platform needs media (TikTok/Instagram), tell me exactly what file/URL to give you instead of posting.`);
  }));
  host.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    save(cal.filter((x) => x.id !== b.dataset.del)); grRenderCalendar(host);
  }));
}

// ── Outreach CRM (curators / influencers / press) ──
const GR_CRM_TYPES = ['curator', 'influencer', 'press', 'community'];
const GR_CRM_STATUSES = ['to_contact', 'sent', 'replied', 'won', 'lost'];
function grRenderOutreach(host) {
  const crm = LS.get('gr_crm', []);
  const due = crm.filter((c) => c.next && c.next <= gToday() && ['to_contact', 'sent'].includes(c.status));
  host.innerHTML = `
    ${due.length ? `<div class="due-banner">⏰ ${due.length} follow-up${due.length > 1 ? 's' : ''} due: ${due.slice(0, 3).map((d) => escapeHTML(d.name)).join(', ')}${due.length > 3 ? '…' : ''}</div>` : ''}
    <div class="g-card">
      <div class="g-form">
        <input class="g-input" id="gr-crm-name" placeholder="Name" style="width:120px;">
        <select class="mini-select" id="gr-crm-type">${GR_CRM_TYPES.map((t) => `<option>${t}</option>`).join('')}</select>
        <input class="g-input" id="gr-crm-channel" placeholder="@handle / email" style="width:130px;">
        <input class="g-input g-grow" id="gr-crm-link" placeholder="Link (playlist / profile / outlet)">
        <input class="g-input" id="gr-crm-next" type="date" title="Next follow-up" style="width:125px;">
        <button class="ghost-btn" id="gr-crm-add">Add</button>
      </div>
      <div class="g-sub" style="margin-top:6px;">Playlist curators are the fastest path to listeners — aim for 3 new contacts a day.</div>
    </div>
    <div class="g-list">
      ${crm.map((c) => `
        <div class="g-row ${due.includes(c) ? 'g-overdue' : ''}">
          <span class="g-row-text" style="flex:0 0 110px;font-weight:600;">${escapeHTML(c.name)}</span>
          <span class="g-badge">${c.type}</span>
          <span class="g-dim" style="flex:0 0 120px;overflow:hidden;text-overflow:ellipsis;">${escapeHTML(c.channel || '')}</span>
          ${c.link ? `<a class="g-link" data-href="${escapeHTML(c.link)}">↗</a>` : '<span style="width:14px;"></span>'}
          <button class="g-chip-status st-${c.status}" data-cycle="${c.id}">${c.status.replace('_', ' ')}</button>
          <input class="g-input g-date-inline" type="date" value="${c.next || ''}" data-next="${c.id}" title="Next follow-up">
          <button class="g-act" data-pitch="${c.id}" title="Draft outreach with Hannah">✉</button>
          <button class="g-del" data-del="${c.id}">✕</button>
        </div>`).join('') || '<div class="g-empty">No contacts yet. Add playlist curators, micro-influencers, and music blogs — then let Hannah draft the pitches.</div>'}
    </div>`;

  const save = (list) => LS.set('gr_crm', list);
  $('gr-crm-add').addEventListener('click', () => {
    const name = $('gr-crm-name').value.trim();
    if (!name) return;
    crm.push({
      id: gUid(), name, type: $('gr-crm-type').value, channel: $('gr-crm-channel').value.trim(),
      link: $('gr-crm-link').value.trim(), next: $('gr-crm-next').value, status: 'to_contact',
    });
    save(crm); grRenderOutreach(host);
  });
  host.querySelectorAll('[data-cycle]').forEach((b) => b.addEventListener('click', () => {
    const c = crm.find((x) => x.id === b.dataset.cycle);
    c.status = GR_CRM_STATUSES[(GR_CRM_STATUSES.indexOf(c.status) + 1) % GR_CRM_STATUSES.length];
    if (c.status === 'won') { confettiBurst(); toast(`🏆 ${c.name} — WON!`, 'good'); }
    save(crm); grRenderOutreach(host);
  }));
  host.querySelectorAll('[data-next]').forEach((el) => el.addEventListener('change', () => {
    const c = crm.find((x) => x.id === el.dataset.next);
    c.next = el.value; save(crm);
  }));
  host.querySelectorAll('[data-pitch]').forEach((b) => b.addEventListener('click', () => {
    const c = crm.find((x) => x.id === b.dataset.pitch);
    sendToJarvis(`Delegate to Hannah: draft a short, personalized ${c.type} outreach message to ${c.name} (${c.channel || 'contact info in my CRM'}${c.link ? `, ${c.link}` : ''}) about Asteroid, my music platform app. Goal: ${c.type === 'curator' ? 'get our tracks/playlists featured' : c.type === 'press' ? 'coverage or a mention' : 'a collab or shout-out'}. Warm, specific, zero fluff, under 120 words.`);
  }));
  host.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    save(crm.filter((x) => x.id !== b.dataset.del)); grRenderOutreach(host);
  }));
  host.querySelectorAll('.g-link[data-href]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault(); window.jarvis.openExternal(a.dataset.href);
  }));
}

// ── Growth experiments with ICE scoring ──
const GR_EXP_STATUSES = ['idea', 'running', 'done'];
function grRenderExperiments(host) {
  const exps = LS.get('gr_experiments', []).sort((a, b) => (b.i * b.c * b.e) - (a.i * a.c * a.e));
  const sel = (id, lbl) => `<select class="mini-select" id="${id}" title="${lbl} 1–5">${[1, 2, 3, 4, 5].map((n) => `<option ${n === 3 ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
  host.innerHTML = `
    <div class="g-card">
      <div class="g-form">
        <input class="g-input g-grow" id="gr-exp-title" placeholder="Experiment… e.g. 'Duet trending artist clips daily for a week'">
        <span class="g-sub">I</span>${sel('gr-exp-i', 'Impact')}
        <span class="g-sub">C</span>${sel('gr-exp-c', 'Confidence')}
        <span class="g-sub">E</span>${sel('gr-exp-e', 'Ease')}
        <button class="ghost-btn" id="gr-exp-add">Add</button>
      </div>
      <div class="g-sub" style="margin-top:6px;">ICE score = Impact × Confidence × Ease. Run the top one this week — one experiment at a time.</div>
    </div>
    <div class="g-list">
      ${exps.map((x) => `
        <div class="g-row">
          <span class="g-score" title="ICE score">${x.i * x.c * x.e}</span>
          <span class="g-row-text">${escapeHTML(x.title)}</span>
          <span class="g-dim">I${x.i}·C${x.c}·E${x.e}</span>
          <button class="g-chip-status st-${x.status}" data-cycle="${x.id}">${x.status}</button>
          <button class="g-act" data-plan="${x.id}" title="Plan with JARVIS">▶</button>
          <button class="g-del" data-del="${x.id}">✕</button>
        </div>`).join('') || '<div class="g-empty">No experiments. Add growth bets and rank them by ICE — highest score first.</div>'}
    </div>`;

  const save = (list) => LS.set('gr_experiments', list);
  $('gr-exp-add').addEventListener('click', () => {
    const title = $('gr-exp-title').value.trim();
    if (!title) return;
    exps.push({ id: gUid(), title, i: +$('gr-exp-i').value, c: +$('gr-exp-c').value, e: +$('gr-exp-e').value, status: 'idea' });
    save(exps); grRenderExperiments(host);
  });
  host.querySelectorAll('[data-cycle]').forEach((b) => b.addEventListener('click', () => {
    const x = exps.find((v) => v.id === b.dataset.cycle);
    x.status = GR_EXP_STATUSES[(GR_EXP_STATUSES.indexOf(x.status) + 1) % GR_EXP_STATUSES.length];
    save(exps); grRenderExperiments(host);
  }));
  host.querySelectorAll('[data-plan]').forEach((b) => b.addEventListener('click', () => {
    const x = exps.find((v) => v.id === b.dataset.plan);
    sendToJarvis(`Design this growth experiment for Asteroid (music platform app): "${x.title}". Give me: the success metric, the smallest possible version to test this week, a day-by-day launch plan, and how we'll know to double down or kill it.`);
  }));
  host.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    save(exps.filter((v) => v.id !== b.dataset.del)); grRenderExperiments(host);
  }));
}

// ── Feedback inbox + testimonial vault ──
const GR_FB_TAGS = ['feature', 'bug', 'praise', 'other'];
function grRenderFeedback(host) {
  const fb = LS.get('gr_feedback', []).sort((a, b) => (b.votes - a.votes) || (b.t - a.t));
  const ts = LS.get('gr_testimonials', []);
  host.innerHTML = `
    <div class="g-card">
      <div class="g-form">
        <input class="g-input g-grow" id="gr-fb-text" placeholder="What did a user say? Paste feedback, reviews, DMs…">
        <select class="mini-select" id="gr-fb-tag">${GR_FB_TAGS.map((t) => `<option>${t}</option>`).join('')}</select>
        <button class="ghost-btn" id="gr-fb-add">Log</button>
      </div>
    </div>
    <div class="g-list">
      ${fb.map((f) => `
        <div class="g-row">
          <button class="g-vote" data-vote="${f.id}" title="Heard again — +1">▲ ${f.votes}</button>
          <span class="g-badge tag-${f.tag}">${f.tag}</span>
          <span class="g-row-text">${escapeHTML(f.text)}</span>
          ${f.tag === 'praise' ? `<button class="g-act" data-star="${f.id}" title="Save as testimonial">★</button>` : ''}
          <button class="g-del" data-del="${f.id}">✕</button>
        </div>`).join('') || '<div class="g-empty">Log every piece of user feedback — the most-upvoted line is your roadmap.</div>'}
    </div>
    <div class="g-card" style="margin-top:12px;">
      <div class="g-sub" style="margin-bottom:8px;">★ TESTIMONIAL VAULT — social proof, ready to paste</div>
      ${ts.map((t) => `
        <div class="g-row">
          <span class="g-row-text">"${escapeHTML(t.quote)}"${t.author ? ` — ${escapeHTML(t.author)}` : ''}</span>
          <button class="g-act" data-copy="${t.id}" title="Copy">⧉</button>
          <button class="g-del" data-tdel="${t.id}">✕</button>
        </div>`).join('') || '<div class="g-empty">Star praise above to collect testimonials for your App Store page & socials.</div>'}
    </div>`;

  const saveFb = (l) => LS.set('gr_feedback', l);
  const saveTs = (l) => LS.set('gr_testimonials', l);
  $('gr-fb-add').addEventListener('click', () => {
    const text = $('gr-fb-text').value.trim();
    if (!text) return;
    fb.push({ id: gUid(), text, tag: $('gr-fb-tag').value, votes: 1, t: Date.now() });
    saveFb(fb); grRenderFeedback(host);
  });
  host.querySelectorAll('[data-vote]').forEach((b) => b.addEventListener('click', () => {
    fb.find((f) => f.id === b.dataset.vote).votes++;
    saveFb(fb); grRenderFeedback(host);
  }));
  host.querySelectorAll('[data-star]').forEach((b) => b.addEventListener('click', () => {
    const f = fb.find((x) => x.id === b.dataset.star);
    ts.push({ id: gUid(), quote: f.text, author: '', source: 'feedback' });
    saveTs(ts); toast('Saved to testimonials ★', 'good'); grRenderFeedback(host);
  }));
  host.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    saveFb(fb.filter((f) => f.id !== b.dataset.del)); grRenderFeedback(host);
  }));
  host.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', () => {
    const t = ts.find((x) => x.id === b.dataset.copy);
    navigator.clipboard.writeText(`"${t.quote}"${t.author ? ` — ${t.author}` : ''}`).then(() => toast('Copied', 'good'));
  }));
  host.querySelectorAll('[data-tdel]').forEach((b) => b.addEventListener('click', () => {
    saveTs(ts.filter((x) => x.id !== b.dataset.tdel)); grRenderFeedback(host);
  }));
}

// ── Competitor watchlist ──
function grRenderCompetitors(host) {
  const comps = LS.get('gr_competitors', []);
  host.innerHTML = `
    <div class="g-card">
      <div class="g-form">
        <input class="g-input" id="gr-comp-name" placeholder="Competitor" style="width:140px;">
        <input class="g-input g-grow" id="gr-comp-link" placeholder="Link">
        <input class="g-input g-grow" id="gr-comp-notes" placeholder="Why they matter / notes">
        <button class="ghost-btn" id="gr-comp-add">Watch</button>
      </div>
    </div>
    <div class="g-list">
      ${comps.map((c) => `
        <div class="g-row">
          <span class="g-row-text" style="flex:0 0 130px;font-weight:600;">${escapeHTML(c.name)}</span>
          ${c.link ? `<a class="g-link" data-href="${escapeHTML(c.link)}">↗</a>` : ''}
          <span class="g-dim g-grow">${escapeHTML(c.notes || '')}</span>
          <button class="g-act" data-analyze="${c.id}" title="Analyze with JARVIS">🔍</button>
          <button class="g-del" data-del="${c.id}">✕</button>
        </div>`).join('') || '<div class="g-empty">Track Spotify, SoundCloud, Audiomack, BandLab… whoever you\'re stealing users from.</div>'}
    </div>`;

  const save = (l) => LS.set('gr_competitors', l);
  $('gr-comp-add').addEventListener('click', () => {
    const name = $('gr-comp-name').value.trim();
    if (!name) return;
    comps.push({ id: gUid(), name, link: $('gr-comp-link').value.trim(), notes: $('gr-comp-notes').value.trim() });
    save(comps); grRenderCompetitors(host);
  });
  host.querySelectorAll('[data-analyze]').forEach((b) => b.addEventListener('click', () => {
    const c = comps.find((x) => x.id === b.dataset.analyze);
    sendToJarvis(`Research competitor "${c.name}"${c.link ? ` (${c.link})` : ''} for Asteroid, my music platform app. Use web_request/open_url where useful. Report: their positioning, pricing, standout features, what users complain about, and 3 concrete ways Asteroid can win their users.`);
  }));
  host.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    save(comps.filter((x) => x.id !== b.dataset.del)); grRenderCompetitors(host);
  }));
  host.querySelectorAll('.g-link[data-href]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault(); window.jarvis.openExternal(a.dataset.href);
  }));
}

// ── Launch checklist ──
const GR_LAUNCH = [
  ['App Store readiness', [
    'Screenshots for every device size (with captions that sell)',
    'App preview video (15–30s, music playing in first 3s)',
    'Subtitle contains your #1 keyword (e.g. "music discovery")',
    'First 3 lines of description hook before "more"',
    '100-char keyword field fully used, no wasted spaces',
    'In-app rating prompt after a "magic moment"',
    'TestFlight feedback loop closed — top 3 complaints fixed',
  ]],
  ['Product Hunt', [
    'Teaser page live 1 week before',
    'Hunter with followers lined up (or self-hunt at 12:01am PT)',
    'First comment tells the founder story',
    '5 gallery assets / GIFs showing the product in motion',
    '20 supporters DM\'d the night before (no vote-begging)',
    'Reply to every single comment on launch day',
  ]],
  ['Press & creators', [
    'Press kit ready (Toolkit → Press Kit)',
    'List of 10 music blogs/newsletters with the right beat',
    'List of 10 micro-influencers (1k–50k) in your genre',
    'Personalized pitches sent (Outreach tab + Hannah)',
    'Follow-up scheduled day 3 and day 7',
  ]],
  ['Community', [
    'Identified 5 subreddits / Discords where your listeners hang out',
    'Given value there for 2+ weeks before any self-promo',
    'Launch post drafts written per community\'s rules',
    'Feedback capture link in app + bio',
    'Every early user gets a personal thank-you',
  ]],
];
function grRenderLaunch(host) {
  const st = LS.get('gr_launch', { done: {} });
  const all = GR_LAUNCH.flatMap(([g, items], gi) => items.map((_, i) => `${gi}-${i}`));
  const doneCount = all.filter((id) => st.done[id]).length;
  const pct = Math.round((doneCount / all.length) * 100);
  host.innerHTML = `
    <div class="g-card">
      <div class="g-flex"><div class="g-sub">LAUNCH READINESS</div><span class="g-grow"></span><div class="g-sub">${doneCount}/${all.length} · ${pct}%</div></div>
      <div class="g-bar"><div class="g-fill" style="width:${pct}%"></div></div>
    </div>
    ${GR_LAUNCH.map(([group, items], gi) => `
      <div class="g-card">
        <div class="g-sub" style="margin-bottom:8px;">${group.toUpperCase()}</div>
        ${items.map((text, i) => {
          const id = `${gi}-${i}`;
          return `<div class="g-row">
            <div class="g-check ${st.done[id] ? 'on' : ''}" data-id="${id}">${st.done[id] ? '✓' : ''}</div>
            <span class="g-row-text ${st.done[id] ? 'g-strike' : ''}">${escapeHTML(text)}</span>
          </div>`;
        }).join('')}
      </div>`).join('')}`;
  host.querySelectorAll('.g-check').forEach((el) => el.addEventListener('click', () => {
    st.done[el.dataset.id] = !st.done[el.dataset.id];
    LS.set('gr_launch', st);
    grRenderLaunch(host);
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
//  STARTUP TOOLKIT (⌘6)
// ═══════════════════════════════════════════════════════════════════════════════
const TK_TABS = [
  ['playbooks', '▶ Playbooks'], ['templates', '✉ Templates'], ['hashtags', '# Hashtags'],
  ['utm', '🔗 UTM Links'], ['times', '🕐 Best Times'], ['revenue', '💰 Revenue'], ['press', '📰 Press Kit'],
];
let tkTab = 'playbooks';

function buildToolkitHub() {
  const body = $('toolkit-body');
  body.innerHTML = `
    <div class="hub-tabs" id="tk-tabs">
      ${TK_TABS.map(([k, l]) => `<button class="hub-tab ${k === tkTab ? 'active' : ''}" data-tab="${k}">${l}</button>`).join('')}
    </div>
    <div id="tk-tab-body"></div>`;
  $('tk-tabs').querySelectorAll('.hub-tab').forEach((b) =>
    b.addEventListener('click', () => { tkTab = b.dataset.tab; buildToolkitHub(); }));
  const render = {
    playbooks: tkRenderPlaybooks, templates: tkRenderTemplates, hashtags: tkRenderHashtags,
    utm: tkRenderUTM, times: tkRenderTimes, revenue: tkRenderRevenue, press: tkRenderPress,
  }[tkTab];
  render($('tk-tab-body'));
}

// ── One-click JARVIS playbooks ──
const TK_BRIEF_PROMPT = 'Morning briefing for Asteroid, my music platform app — in this exact order: 1) read_emails with unreadOnly true, limit 10 — flag anything important; 2) get_analytics source "ga4" for yesterday (activeUsers, sessions) vs the day before; 3) get_analytics for the latest App Store / Appfigures downloads if configured; 4) end with the top 3 highest-leverage growth actions for today, ranked. Keep the whole thing tight.';
const TK_PLAYBOOKS = [
  { name: '☀ Morning briefing', desc: 'Inbox + analytics + top 3 actions', prompt: TK_BRIEF_PROMPT },
  { name: '🌙 Evening wrap-up', desc: 'What moved today + plan tomorrow', prompt: 'Evening wrap-up for Asteroid: pull today\'s ga4 numbers with get_analytics vs yesterday, check for new app reviews (appfigures_reviews or appstore_reviews if configured), then summarize what moved, what didn\'t, and set my top 3 for tomorrow.' },
  { name: '🎬 10 TikTok hooks', desc: 'Scroll-stopping hooks batch', prompt: 'Delegate to Hannah: write 10 scroll-stopping TikTok hooks for Asteroid, a music platform app for discovering and sharing music. Each ≤ 8 words, numbered, each with a matching video format suggestion (POV / duet / text-overlay / trend). Optimize for the first 1.5 seconds.' },
  { name: '🎧 Curator pitch sprint', desc: '3 personalized curator DMs', prompt: 'Delegate to Hannah: draft 3 different short DM pitches to playlist curators for Asteroid (music platform app). Angle 1: mutual growth. Angle 2: exclusive early access. Angle 3: their audience benefit. Each under 90 words, personal-sounding, no corporate speak.' },
  { name: '🏪 ASO tune-up', desc: 'App Store listing optimizer', prompt: 'Delegate to Hannah: optimize my App Store listing for Asteroid, a music platform app. Give me: 3 subtitle options (≤30 chars) with a music-discovery keyword, a rewritten first-3-lines description hook, and a 100-character keyword field with no wasted characters.' },
  { name: '⭐ Review reply sweep', desc: 'Warm replies to latest reviews', prompt: 'Fetch my latest app reviews with get_analytics (appfigures_reviews or appstore_reviews). Then delegate to Rob: draft a warm, personal reply to each one — thank praise specifically, own problems and state the fix. Output them ready to paste.' },
  { name: '📈 Weekly growth report', desc: 'Full week in review', prompt: 'Build my weekly growth report for Asteroid: get_analytics ga4 for the last 7 days vs prior 7 (users, sessions, top sources), latest App Store/Appfigures downloads, and Mailchimp audience stats if configured. Finish with: 1 thing to double down on, 1 thing to kill, 1 experiment for next week.' },
  { name: '🚀 Launch thread', desc: '6-post X launch thread', prompt: 'Delegate to Hannah: write a 6-post X/Twitter launch thread for Asteroid, a music platform app. Post 1: hook + what it is. Posts 2–4: the problem, the magic moment, social proof placeholder. Post 5: founder story in 2 lines. Post 6: CTA with link placeholder. Punchy, no hashtag spam.' },
];
function tkRenderPlaybooks(host) {
  const custom = LS.get('tk_prompts', []);
  host.innerHTML = `
    <div class="g-sub" style="margin-bottom:10px;">One click → JARVIS runs the whole play with its tools. Add your own below.</div>
    <div class="g-list">
      ${TK_PLAYBOOKS.map((p, i) => `
        <div class="g-row">
          <span class="g-row-text"><b>${p.name}</b><span class="g-dim"> — ${p.desc}</span></span>
          <button class="g-act" data-copyp="d${i}" title="Copy prompt">⧉</button>
          <button class="ghost-btn" data-run="d${i}">▶ Run</button>
        </div>`).join('')}
      ${custom.map((p) => `
        <div class="g-row">
          <span class="g-row-text"><b>${escapeHTML(p.name)}</b></span>
          <button class="g-act" data-copyp="${p.id}" title="Copy prompt">⧉</button>
          <button class="ghost-btn" data-run="${p.id}">▶ Run</button>
          <button class="g-del" data-del="${p.id}">✕</button>
        </div>`).join('')}
    </div>
    <div class="g-card" style="margin-top:12px;">
      <div class="g-form" style="flex-wrap:wrap;">
        <input class="g-input" id="tk-pb-name" placeholder="Playbook name" style="width:180px;">
        <textarea class="g-area g-grow" id="tk-pb-prompt" rows="2" placeholder="The prompt JARVIS runs — reference tools like get_analytics, post_social, read_emails…"></textarea>
        <button class="ghost-btn" id="tk-pb-add">Save playbook</button>
      </div>
    </div>`;

  const find = (key) =>
    custom.find((c) => c.id === key) || (/^d\d+$/.test(key) ? TK_PLAYBOOKS[+key.slice(1)] : null);
  host.querySelectorAll('[data-run]').forEach((b) => b.addEventListener('click', () => {
    const p = find(b.dataset.run);
    if (p) sendToJarvis(p.prompt);
  }));
  host.querySelectorAll('[data-copyp]').forEach((b) => b.addEventListener('click', () => {
    const p = find(b.dataset.copyp);
    if (p) navigator.clipboard.writeText(p.prompt).then(() => toast('Prompt copied', 'good'));
  }));
  host.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    LS.set('tk_prompts', custom.filter((c) => c.id !== b.dataset.del));
    tkRenderPlaybooks(host);
  }));
  $('tk-pb-add').addEventListener('click', () => {
    const name = $('tk-pb-name').value.trim();
    const prompt = $('tk-pb-prompt').value.trim();
    if (!name || !prompt) { toast('Name and prompt required', 'bad'); return; }
    custom.push({ id: gUid(), name, prompt });
    LS.set('tk_prompts', custom);
    tkRenderPlaybooks(host);
  });
}
function runMorningBrief() { sendToJarvis(TK_BRIEF_PROMPT); }

// ── Outreach email templates with variable fill ──
const TK_TEMPLATES = [
  {
    id: 'curator', name: 'Playlist curator pitch',
    vars: ['name', 'playlist', 'genre', 'link'],
    subject: 'Loved {{playlist}} — quick idea',
    body: `Hi {{name}},

I've been following {{playlist}} — your {{genre}} picks are consistently ahead of the curve.

I'm building Asteroid, a music platform for surfacing exactly this kind of {{genre}}. I'd love to feature your playlist to our early listeners, and if any of our rising tracks fit your vibe, here's a hand-picked shortlist: {{link}}

Zero pressure either way — keep curating, it's great.

Best,`,
  },
  {
    id: 'influencer', name: 'Micro-influencer collab',
    vars: ['name', 'platform', 'niche'],
    subject: 'Collab idea for your {{niche}} audience',
    body: `Hey {{name}},

Your {{niche}} content on {{platform}} is exactly the energy we built Asteroid for — it's a music platform for discovering tracks before they blow up.

Idea: you get early access + a custom referral link, your audience gets a genuinely useful music app, and we shout out your picks in-app. No scripts, post whatever feels real.

Want me to send you access?`,
  },
  {
    id: 'press', name: 'Press / blog pitch',
    vars: ['outlet', 'name', 'angle'],
    subject: '{{angle}} — story for {{outlet}}',
    body: `Hi {{name}},

Quick pitch for {{outlet}}: {{angle}}.

Asteroid is a music platform tackling how broken music discovery has become — algorithms feed everyone the same 40 songs while great artists stay invisible. We're at the earliest stage, which means full access to the founder, real numbers, and the messy honest version of the story.

Press kit with everything: happy to send it over. Worth 15 minutes?`,
  },
  {
    id: 'beta', name: 'Beta invite',
    vars: ['name'],
    subject: 'You\'re in — Asteroid early access',
    body: `Hey {{name}},

You're one of the first people getting access to Asteroid — a music platform for finding music that actually gets you.

Two asks, that's it:
1. Use it like you'd actually use it (don't be polite).
2. Tell me the one thing that annoyed you most.

Your feedback literally decides what we build next week. Welcome aboard 🚀`,
  },
  {
    id: 'winback', name: 'Churned user win-back',
    vars: ['name', 'new_feature'],
    subject: 'We fixed the thing',
    body: `Hey {{name}},

You tried Asteroid a while back and drifted off — totally fair, it was rough around the edges.

Since then we shipped {{new_feature}}, and it changes the whole experience. I'd love 5 minutes of your skepticism: if it still doesn't stick, tell me why and I'll stop emailing.

Deal?`,
  },
];
let tkTplSel = 'curator';
function tkRenderTemplates(host) {
  const tpl = TK_TEMPLATES.find((t) => t.id === tkTplSel) || TK_TEMPLATES[0];
  host.innerHTML = `
    <div class="g-form" style="margin-bottom:10px;">
      <select class="mini-select" id="tk-tpl-sel">
        ${TK_TEMPLATES.map((t) => `<option value="${t.id}" ${t.id === tkTplSel ? 'selected' : ''}>${t.name}</option>`).join('')}
      </select>
      <input class="g-input g-grow" id="tk-tpl-to" placeholder="To: email (for send via JARVIS)">
    </div>
    <div class="g-card">
      <div class="g-form" style="flex-wrap:wrap;" id="tk-tpl-vars">
        ${tpl.vars.map((v) => `<input class="g-input" data-var="${v}" placeholder="{{${v}}}" style="width:150px;">`).join('')}
      </div>
      <div class="tk-preview" id="tk-tpl-preview"></div>
      <div class="g-flex" style="margin-top:10px;">
        <button class="ghost-btn" id="tk-tpl-copy">⧉ Copy email</button>
        <button class="ghost-btn" id="tk-tpl-send">✉ Send via JARVIS</button>
        <span class="g-sub g-grow" style="text-align:right;">Fill the blanks — preview updates live.</span>
      </div>
    </div>`;

  const fill = () => {
    let subject = tpl.subject, bodyTxt = tpl.body;
    host.querySelectorAll('[data-var]').forEach((inp) => {
      const val = inp.value.trim() || `{{${inp.dataset.var}}}`;
      subject = subject.split(`{{${inp.dataset.var}}}`).join(val);
      bodyTxt = bodyTxt.split(`{{${inp.dataset.var}}}`).join(val);
    });
    $('tk-tpl-preview').innerHTML =
      `<div class="tk-subject">Subject: ${escapeHTML(subject)}</div><pre class="tk-body">${escapeHTML(bodyTxt)}</pre>`;
    return { subject, bodyTxt };
  };
  fill();
  $('tk-tpl-sel').addEventListener('change', (e) => { tkTplSel = e.target.value; tkRenderTemplates(host); });
  host.querySelectorAll('[data-var]').forEach((inp) => inp.addEventListener('input', fill));
  $('tk-tpl-copy').addEventListener('click', () => {
    const { subject, bodyTxt } = fill();
    navigator.clipboard.writeText(`Subject: ${subject}\n\n${bodyTxt}`).then(() => toast('Email copied', 'good'));
  });
  $('tk-tpl-send').addEventListener('click', () => {
    const { subject, bodyTxt } = fill();
    const to = $('tk-tpl-to').value.trim();
    sendToJarvis(`Send this email with send_email${to ? ` to ${to}` : ' — ask me for the recipient first'}. Use it verbatim (fill any remaining {{placeholders}} sensibly or ask me).\n\nSubject: ${subject}\n\n${bodyTxt}`);
  });
}

// ── Hashtag bank ──
const TK_HASHTAGS = {
  'TikTok': ['#MusicTok', '#NewMusic', '#IndieArtist', '#UnsignedArtist', '#MusicDiscovery', '#NowPlaying', '#HiddenGems', '#SongRecommendations', '#MusicApp', '#PlaylistCurator', '#UpcomingArtist', '#fyp'],
  'Instagram': ['#NewMusicFriday', '#MusicGram', '#IndieMusic', '#MusicCommunity', '#SpotifyPlaylists', '#IndependentArtist', '#MusicPromotion', '#MusicLovers', '#DiscoverMusic', '#NewArtist', '#MusicIsLife'],
  'X / Twitter': ['#NewMusic', '#NowPlaying', '#MusicMonday', '#IndieMusic', '#NewMusicFriday', '#MusicNews', '#ListenNow', '#SupportIndieArtists'],
  'YouTube Shorts': ['#Shorts', '#NewMusic', '#MusicDiscovery', '#IndieArtist', '#MusicReaction', '#HiddenGems'],
};
function tkRenderHashtags(host) {
  host.innerHTML = Object.entries(TK_HASHTAGS).map(([platform, tags], i) => `
    <div class="g-card">
      <div class="g-flex">
        <div class="g-sub">${platform.toUpperCase()}</div><span class="g-grow"></span>
        <button class="ghost-btn" data-copyall="${i}">⧉ Copy set</button>
      </div>
      <div class="tag-cloud">${tags.map((t) => `<button class="tag-chip" data-tag="${t}">${t}</button>`).join('')}</div>
    </div>`).join('') + '<div class="g-sub">Click a tag to copy it · mix 3 big + 5 niche + 2 micro tags per post.</div>';
  host.querySelectorAll('[data-tag]').forEach((b) => b.addEventListener('click', () =>
    navigator.clipboard.writeText(b.dataset.tag).then(() => toast(`${b.dataset.tag} copied`, 'good'))));
  host.querySelectorAll('[data-copyall]').forEach((b) => b.addEventListener('click', () => {
    const tags = Object.values(TK_HASHTAGS)[+b.dataset.copyall];
    navigator.clipboard.writeText(tags.join(' ')).then(() => toast('Set copied', 'good'));
  }));
}

// ── UTM link builder ──
function tkRenderUTM(host) {
  const hist = LS.get('tk_utm_history', []);
  host.innerHTML = `
    <div class="g-card">
      <div class="g-form" style="flex-wrap:wrap;">
        <input class="g-input g-grow" id="tk-utm-url" placeholder="https://asteroid.app" style="min-width:220px;">
        <input class="g-input" id="tk-utm-source" placeholder="source (tiktok)" style="width:130px;">
        <input class="g-input" id="tk-utm-medium" placeholder="medium (social)" style="width:130px;">
        <input class="g-input" id="tk-utm-campaign" placeholder="campaign (launch)" style="width:140px;">
      </div>
      <div class="tk-utm-out" id="tk-utm-out">Fill the fields — your trackable link appears here.</div>
      <div class="g-flex" style="margin-top:8px;">
        <button class="ghost-btn" id="tk-utm-copy">⧉ Copy link</button>
        <span class="g-sub g-grow" style="text-align:right;">Tag every link you share → GA4 shows which channel actually converts.</span>
      </div>
    </div>
    <div class="g-card">
      <div class="g-sub" style="margin-bottom:6px;">RECENT LINKS</div>
      ${hist.slice().reverse().map((h) => `
        <div class="g-row"><span class="g-row-text g-mono" style="font-size:10.5px;overflow:hidden;text-overflow:ellipsis;">${escapeHTML(h.url)}</span>
        <button class="g-act" data-copyh="${escapeHTML(h.url)}">⧉</button></div>`).join('') || '<div class="g-empty">No links built yet.</div>'}
    </div>`;

  const build = () => {
    const url = $('tk-utm-url').value.trim();
    if (!/^https?:\/\//i.test(url)) return null;
    const p = new URLSearchParams();
    const s = $('tk-utm-source').value.trim(), m = $('tk-utm-medium').value.trim(), c = $('tk-utm-campaign').value.trim();
    if (s) p.set('utm_source', s);
    if (m) p.set('utm_medium', m);
    if (c) p.set('utm_campaign', c);
    const q = p.toString();
    return q ? `${url}${url.includes('?') ? '&' : '?'}${q}` : url;
  };
  const refresh = () => {
    const link = build();
    $('tk-utm-out').textContent = link || 'Fill the fields — your trackable link appears here.';
  };
  ['tk-utm-url', 'tk-utm-source', 'tk-utm-medium', 'tk-utm-campaign'].forEach((id) =>
    $(id).addEventListener('input', refresh));
  $('tk-utm-copy').addEventListener('click', () => {
    const link = build();
    if (!link) { toast('Enter a valid https:// URL', 'bad'); return; }
    navigator.clipboard.writeText(link).then(() => toast('Link copied', 'good'));
    hist.push({ url: link, t: Date.now() });
    LS.set('tk_utm_history', hist.slice(-12));
    tkRenderUTM(host);
  });
  host.querySelectorAll('[data-copyh]').forEach((b) => b.addEventListener('click', () =>
    navigator.clipboard.writeText(b.dataset.copyh).then(() => toast('Copied', 'good'))));
}

// ── Best posting times ──
const TK_TIMES = [
  ['TikTok', 'Tue–Thu', '7–9 PM (+ 12 PM lunch scroll)', 'Music content peaks with evening scroll sessions'],
  ['Instagram', 'Mon–Fri', '11 AM–1 PM & 7 PM', 'Reels get an extra push mid-day'],
  ['X / Twitter', 'Weekdays', '9 AM–12 PM', 'News-feed energy is a morning thing'],
  ['YouTube Shorts', 'Fri–Sun', '12–3 PM', 'Weekend watch-time is highest'],
  ['Reddit', 'Sat–Sun', '8–10 AM ET', 'Early posts ride the day\'s upvote wave'],
  ['Email (Mailchimp)', 'Tue & Thu', '10 AM local', 'Highest open rates mid-week mornings'],
];
function tkRenderTimes(host) {
  host.innerHTML = `
    <div class="g-card">
      <table class="g-table">
        <thead><tr><th>Platform</th><th>Best days</th><th>Best times</th><th>Why</th></tr></thead>
        <tbody>${TK_TIMES.map((r) => `<tr>${r.map((c, i) => `<td class="${i === 0 ? 'g-strong' : ''}">${c}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
      <div class="g-sub" style="margin-top:10px;">General benchmarks in YOUR audience's timezone — your own analytics beat any chart. Once GA4 is linked, ask JARVIS "when are my users most active?"</div>
    </div>`;
}

// ── Revenue calculator ──
function tkRenderRevenue(host) {
  const goal = grGoal();
  host.innerHTML = `
    <div class="g-card">
      <div class="g-form" style="flex-wrap:wrap;">
        <label class="g-sub">USERS <input class="g-input" id="tk-rev-users" type="number" value="${goal.users || 100}" style="width:90px;"></label>
        <label class="g-sub">PAID CONVERSION % <input class="g-input" id="tk-rev-conv" type="number" value="4" style="width:70px;"></label>
        <label class="g-sub">PRICE $/MO <input class="g-input" id="tk-rev-price" type="number" value="4.99" step="0.01" style="width:80px;"></label>
      </div>
      <div class="rev-grid" id="tk-rev-out"></div>
      <div class="g-sub" style="margin-top:8px;">Freemium music apps convert 2–5% typically. Every 100 users ≈ real recurring revenue — that's why 1,000 matters.</div>
    </div>`;
  const money = (n) => '$' + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  const refresh = () => {
    const users = +$('tk-rev-users').value || 0;
    const conv = (+$('tk-rev-conv').value || 0) / 100;
    const price = +$('tk-rev-price').value || 0;
    const payers = Math.round(users * conv);
    const mrr = payers * price;
    const payers1k = Math.round(goal.target * conv);
    const mrr1k = payers1k * price;
    $('tk-rev-out').innerHTML = `
      <div class="rev-card"><div class="rev-num">${payers}</div><div class="g-sub">PAYING USERS</div></div>
      <div class="rev-card"><div class="rev-num">${money(mrr)}</div><div class="g-sub">MRR</div></div>
      <div class="rev-card"><div class="rev-num">${money(mrr * 12)}</div><div class="g-sub">ARR</div></div>
      <div class="rev-card hi"><div class="rev-num">${money(mrr1k)}</div><div class="g-sub">MRR AT ${goal.target.toLocaleString()} USERS</div></div>`;
  };
  refresh();
  ['tk-rev-users', 'tk-rev-conv', 'tk-rev-price'].forEach((id) => $(id).addEventListener('input', refresh));
}

// ── Press kit generator ──
function tkRenderPress(host) {
  const pk = Object.assign({
    name: 'Asteroid', tagline: '', desc: '', founder: '', email: '', site: '', appstore: '', facts: '',
  }, LS.get('tk_press', {}));
  host.innerHTML = `
    <div class="g-card">
      <div class="g-form" style="flex-wrap:wrap;">
        <input class="g-input" id="pk-name" placeholder="App name" value="${escapeHTML(pk.name)}" style="width:140px;">
        <input class="g-input g-grow" id="pk-tagline" placeholder="One-line tagline" value="${escapeHTML(pk.tagline)}">
        <input class="g-input" id="pk-founder" placeholder="Founder name" value="${escapeHTML(pk.founder)}" style="width:150px;">
        <input class="g-input" id="pk-email" placeholder="Press email" value="${escapeHTML(pk.email)}" style="width:180px;">
        <input class="g-input g-grow" id="pk-site" placeholder="Website" value="${escapeHTML(pk.site)}">
        <input class="g-input g-grow" id="pk-appstore" placeholder="App Store link" value="${escapeHTML(pk.appstore)}">
      </div>
      <textarea class="g-area" id="pk-desc" rows="3" placeholder="What is it + why now (2–3 sentences)">${escapeHTML(pk.desc)}</textarea>
      <textarea class="g-area" id="pk-facts" rows="3" placeholder="Fast facts — one per line (founded date, users, funding, notable wins)">${escapeHTML(pk.facts)}</textarea>
      <div class="g-flex" style="margin-top:8px;">
        <button class="ghost-btn" id="pk-generate">Generate</button>
        <button class="ghost-btn" id="pk-copy">⧉ Copy markdown</button>
        <button class="ghost-btn" id="pk-download">⤓ Download .md</button>
        <button class="ghost-btn" id="pk-polish">✨ Polish with Hannah</button>
      </div>
      <pre class="tk-body" id="pk-preview" style="margin-top:10px;"></pre>
    </div>`;

  const collect = () => {
    const data = {
      name: $('pk-name').value.trim(), tagline: $('pk-tagline').value.trim(),
      desc: $('pk-desc').value.trim(), founder: $('pk-founder').value.trim(),
      email: $('pk-email').value.trim(), site: $('pk-site').value.trim(),
      appstore: $('pk-appstore').value.trim(), facts: $('pk-facts').value.trim(),
    };
    LS.set('tk_press', data);
    return data;
  };
  const generate = () => {
    const d = collect();
    const md = `# ${d.name} — Press Kit

**${d.tagline || 'Music discovery, reinvented.'}**

## About
${d.desc || `${d.name} is a music platform app.`}

## Fast facts
${(d.facts || '').split('\n').filter(Boolean).map((f) => `- ${f.trim()}`).join('\n') || '- Early-stage and moving fast'}

## Links
${d.site ? `- Website: ${d.site}\n` : ''}${d.appstore ? `- App Store: ${d.appstore}\n` : ''}
## Press contact
${d.founder || 'Founder'}${d.email ? ` — ${d.email}` : ''}

## Assets
Logo, screenshots and founder photo available on request.`;
    $('pk-preview').textContent = md;
    return md;
  };
  generate();
  $('pk-generate').addEventListener('click', generate);
  $('pk-copy').addEventListener('click', () => navigator.clipboard.writeText(generate()).then(() => toast('Press kit copied', 'good')));
  $('pk-download').addEventListener('click', () => { download(`${($('pk-name').value.trim() || 'asteroid').toLowerCase()}-press-kit.md`, generate(), 'text/markdown'); toast('Press kit downloaded', 'good'); });
  $('pk-polish').addEventListener('click', () => {
    sendToJarvis(`Delegate to Hannah: polish this press kit for maximum journalist appeal — punchier tagline, tighter about section, and add 2 quotable founder lines. Keep the markdown structure.\n\n${generate()}`);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  FOCUS MODE (⌘7) — pomodoro + daily top-3 + scratchpad
// ═══════════════════════════════════════════════════════════════════════════════
function fcPomo() { return Object.assign({ work: 25, brk: 5, sessionsByDay: {} }, LS.get('fc_pomo', {})); }
const fcTimer = { mode: 'work', remaining: fcPomo().work * 60, running: false, iv: null };
function fcFmt(s) { return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }

function fcTick() {
  fcTimer.remaining--;
  fcUpdateDisplays();
  if (fcTimer.remaining > 0) return;
  clearInterval(fcTimer.iv);
  fcTimer.running = false;
  const pomo = fcPomo();
  if (fcTimer.mode === 'work') {
    pomo.sessionsByDay[gToday()] = (pomo.sessionsByDay[gToday()] || 0) + 1;
    LS.set('fc_pomo', pomo);
    confettiBurst();
    toast('Focus session complete — take a break 🎉', 'good');
    if (settings.tts) window.jarvis.speak({ text: 'Focus session complete. Break time.', voice: settings.voice, rate: settings.rate });
    addLog('system', 'Pomodoro focus session completed');
    fcTimer.mode = 'break';
    fcTimer.remaining = pomo.brk * 60;
    fcStart(); // auto-roll into the break
  } else {
    toast('Break over — back to building 🚀');
    if (settings.tts) window.jarvis.speak({ text: 'Break over. Back to it.', voice: settings.voice, rate: settings.rate });
    fcTimer.mode = 'work';
    fcTimer.remaining = pomo.work * 60;
    fcUpdateDisplays();
  }
}
function fcStart() {
  if (fcTimer.running) return;
  fcTimer.running = true;
  fcTimer.iv = setInterval(fcTick, 1000);
  fcUpdateDisplays();
}
function fcPause() {
  fcTimer.running = false;
  clearInterval(fcTimer.iv);
  fcUpdateDisplays();
}
function fcReset() {
  fcPause();
  fcTimer.mode = 'work';
  fcTimer.remaining = fcPomo().work * 60;
  fcUpdateDisplays();
}
function fcUpdateDisplays() {
  const badge = $('focus-badge');
  if (badge) {
    badge.classList.toggle('hidden', !fcTimer.running);
    badge.textContent = `${fcTimer.mode === 'work' ? '◉' : '☕'} ${fcFmt(fcTimer.remaining)}`;
  }
  const time = $('fc-time');
  if (time) {
    time.textContent = fcFmt(fcTimer.remaining);
    $('fc-mode').textContent = fcTimer.mode === 'work' ? 'FOCUS' : 'BREAK';
    $('fc-startpause').textContent = fcTimer.running ? '⏸ Pause' : '▶ Start';
  }
}

function fcGoals() {
  const g = Object.assign({ date: gToday(), items: [{ text: '', done: false }, { text: '', done: false }, { text: '', done: false }], history: [] }, LS.get('fc_goals', {}));
  if (g.date !== gToday()) {
    // New day: archive yesterday's result and start fresh.
    const filled = g.items.filter((i) => i.text.trim());
    if (filled.length) g.history.push({ date: g.date, done: filled.filter((i) => i.done).length, total: filled.length });
    g.history = g.history.slice(-14);
    g.date = gToday();
    g.items = [{ text: '', done: false }, { text: '', done: false }, { text: '', done: false }];
    LS.set('fc_goals', g);
  }
  return g;
}

function buildFocusHub() {
  const pomo = fcPomo();
  const goals = fcGoals();
  const sessionsToday = pomo.sessionsByDay[gToday()] || 0;
  const last = goals.history[goals.history.length - 1];

  $('focus-body').innerHTML = `
    <div class="g-card" style="text-align:center;">
      <div class="g-sub" id="fc-mode">${fcTimer.mode === 'work' ? 'FOCUS' : 'BREAK'}</div>
      <div class="fc-time" id="fc-time">${fcFmt(fcTimer.remaining)}</div>
      <div class="fc-controls">
        <button class="ghost-btn" id="fc-startpause">${fcTimer.running ? '⏸ Pause' : '▶ Start'}</button>
        <button class="ghost-btn" id="fc-reset">↺ Reset</button>
        <select class="mini-select" id="fc-work" title="Focus length">${[25, 50].map((n) => `<option value="${n}" ${pomo.work === n ? 'selected' : ''}>${n}m focus</option>`).join('')}</select>
        <select class="mini-select" id="fc-brk" title="Break length">${[5, 10].map((n) => `<option value="${n}" ${pomo.brk === n ? 'selected' : ''}>${n}m break</option>`).join('')}</select>
      </div>
      <div class="g-sub" style="margin-top:8px;">${sessionsToday} focus session${sessionsToday === 1 ? '' : 's'} today · timer keeps running when you close this</div>
    </div>

    <div class="g-card">
      <div class="g-sub" style="margin-bottom:8px;">TODAY'S TOP 3 — if only these get done, today was a win</div>
      ${goals.items.map((it, i) => `
        <div class="g-row">
          <div class="g-check ${it.done ? 'on' : ''}" data-goal="${i}">${it.done ? '✓' : ''}</div>
          <input class="g-input g-grow ${it.done ? 'g-strike' : ''}" data-goaltext="${i}" value="${escapeHTML(it.text)}" placeholder="Goal ${i + 1}…">
        </div>`).join('')}
      ${last ? `<div class="g-sub" style="margin-top:6px;">Yesterday: ${last.done}/${last.total} done</div>` : ''}
    </div>

    <div class="g-card">
      <div class="g-flex" style="margin-bottom:8px;">
        <div class="g-sub">SCRATCHPAD — autosaved</div><span class="g-grow"></span>
        <button class="ghost-btn" id="fc-scratch-export">⤓ Export</button>
        <button class="ghost-btn" id="fc-scratch-clear">⌫ Clear</button>
      </div>
      <textarea class="g-area" id="fc-scratch" rows="7" placeholder="Ideas, links, lyrics, half-thoughts…">${escapeHTML(LS.get('fc_scratch', ''))}</textarea>
    </div>`;

  $('fc-startpause').addEventListener('click', () => (fcTimer.running ? fcPause() : fcStart()));
  $('fc-reset').addEventListener('click', fcReset);
  $('fc-work').addEventListener('change', (e) => {
    const p = fcPomo(); p.work = +e.target.value; LS.set('fc_pomo', p);
    if (!fcTimer.running && fcTimer.mode === 'work') { fcTimer.remaining = p.work * 60; fcUpdateDisplays(); }
  });
  $('fc-brk').addEventListener('change', (e) => {
    const p = fcPomo(); p.brk = +e.target.value; LS.set('fc_pomo', p);
    if (!fcTimer.running && fcTimer.mode === 'break') { fcTimer.remaining = p.brk * 60; fcUpdateDisplays(); }
  });

  const saveGoals = () => LS.set('fc_goals', goals);
  $('focus-body').querySelectorAll('[data-goal]').forEach((el) => el.addEventListener('click', () => {
    const it = goals.items[+el.dataset.goal];
    it.done = !it.done;
    saveGoals();
    if (goals.items.filter((g) => g.text.trim()).length && goals.items.filter((g) => g.text.trim()).every((g) => g.done)) {
      confettiBurst(); toast('Top 3 complete — legendary day 🏆', 'good');
    }
    buildFocusHub();
  }));
  $('focus-body').querySelectorAll('[data-goaltext]').forEach((el) => el.addEventListener('input', () => {
    goals.items[+el.dataset.goaltext].text = el.value;
    saveGoals();
  }));

  $('fc-scratch').addEventListener('input', (e) => LS.set('fc_scratch', e.target.value));
  $('fc-scratch-export').addEventListener('click', () => {
    download(`asteroid-notes-${gToday()}.md`, LS.get('fc_scratch', ''), 'text/markdown');
    toast('Notes exported', 'good');
  });
  $('fc-scratch-clear').addEventListener('click', () => {
    LS.set('fc_scratch', '');
    $('fc-scratch').value = '';
    toast('Scratchpad cleared');
  });
}

// ─── Init ────────────────────────────────────────────────────────────────────────
$('focus-badge')?.addEventListener('click', () => openOverlay('focus'));
