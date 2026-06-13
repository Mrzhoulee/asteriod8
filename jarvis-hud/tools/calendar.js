// Scheduling — create calendar events / calls. Two outputs:
//   1. A native event in macOS Calendar.app (via AppleScript), so it syncs to
//      iCloud/Google if that account is in Calendar.
//   2. A standards-compliant .ics file, which can be emailed to attendees as an
//      invite (hand-rolled — no dependency).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { runAppleScript } = require('./mac');

function pad(n) { return String(n).padStart(2, '0'); }

/** Date -> iCalendar UTC stamp: 20260613T143000Z */
function icsStamp(date) {
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) + 'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) + 'Z'
  );
}

function buildICS({ title, start, end, notes, location, attendees }) {
  const uid = `${Date.now()}@jarvis-hud`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//JARVIS HUD//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${(title || 'Meeting').replace(/\n/g, ' ')}`,
  ];
  if (location) lines.push(`LOCATION:${location.replace(/\n/g, ' ')}`);
  if (notes) lines.push(`DESCRIPTION:${notes.replace(/\n/g, '\\n')}`);
  for (const a of attendees || []) {
    lines.push(`ATTENDEE;RSVP=TRUE:mailto:${a}`);
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

/** Build AppleScript that creates the event in Calendar.app. */
function buildCalendarScript({ title, start, end, notes, location, calendar }) {
  const esc = (s) => String(s || '').replace(/"/g, '\\"');
  const setDate = (varName, d) => `
    set ${varName} to (current date)
    set year of ${varName} to ${d.getFullYear()}
    set month of ${varName} to ${d.getMonth() + 1}
    set day of ${varName} to ${d.getDate()}
    set hours of ${varName} to ${d.getHours()}
    set minutes of ${varName} to ${d.getMinutes()}
    set seconds of ${varName} to 0`;

  return `
tell application "Calendar"
  ${setDate('startDate', start)}
  ${setDate('endDate', end)}
  set targetCal to ${calendar ? `calendar "${esc(calendar)}"` : 'calendar 1'}
  tell targetCal
    make new event with properties {summary:"${esc(title)}", start date:startDate, end date:endDate${location ? `, location:"${esc(location)}"` : ''}${notes ? `, description:"${esc(notes)}"` : ''}}
  end tell
end tell
return "ok"`;
}

function parseWhen(value) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d;
}

/**
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.start  ISO 8601 or parseable date string
 * @param {string} [opts.end]
 * @param {number} [opts.durationMinutes=30]
 * @param {string} [opts.notes]
 * @param {string} [opts.location]   e.g. a Zoom/Meet link
 * @param {string} [opts.calendar]   target calendar name
 * @param {string[]} [opts.attendees]
 */
async function scheduleEvent(opts) {
  const start = parseWhen(opts.start);
  if (!start) return { success: false, error: `Could not parse start time: "${opts.start}"` };

  const end = opts.end
    ? parseWhen(opts.end)
    : new Date(start.getTime() + (opts.durationMinutes || 30) * 60000);

  // Write an .ics next to the OS temp dir for emailing as an invite.
  const ics = buildICS({ ...opts, start, end });
  const icsPath = path.join(os.tmpdir(), `jarvis-invite-${Date.now()}.ics`);
  try { fs.writeFileSync(icsPath, ics, 'utf8'); } catch { /* non-fatal */ }

  // Add to Calendar.app on macOS.
  let calResult = { success: false, error: 'Not macOS — created .ics only.' };
  if (process.platform === 'darwin') {
    calResult = await runAppleScript(buildCalendarScript({ ...opts, start, end }));
  }

  return {
    success: calResult.success || fs.existsSync(icsPath),
    addedToCalendar: calResult.success,
    calendarError: calResult.success ? undefined : calResult.error,
    icsPath,
    start: start.toISOString(),
    end: end.toISOString(),
    title: opts.title,
  };
}

module.exports = { scheduleEvent, buildICS };
