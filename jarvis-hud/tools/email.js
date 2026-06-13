require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const nodemailer = require('nodemailer');

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
    _transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });
  } else if (process.env.SMTP_HOST) {
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  return _transporter;
}

async function sendEmail({ to, subject, body, cc }) {
  const transport = getTransporter();
  if (!transport) {
    return {
      success: false,
      error: 'Email not configured. Copy .env.example to .env and set GMAIL_USER/GMAIL_PASS or SMTP_* vars.',
    };
  }

  const from = process.env.GMAIL_USER || process.env.SMTP_USER;
  const isHtml = /<[a-z][\s\S]*>/i.test(body);

  try {
    const info = await transport.sendMail({
      from,
      to,
      cc: cc || undefined,
      subject,
      ...(isHtml ? { html: body } : { text: body }),
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { sendEmail };
