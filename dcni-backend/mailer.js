// mailer.js
//
// Sends the notification email to the administrator/Bishop with the PDF
// attached, using Nodemailer. Works with a normal Gmail account and an
// "app password" (recommended) so you don't need a dedicated mail server.
// All credentials live in .env — never in the frontend.

const nodemailer = require('nodemailer');

function buildTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendNewRenewalEmail(renewal, pdfFullPath) {
  const adminEmail = process.env.DCNI_ADMIN_EMAIL;
  if (!adminEmail || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('Email is not configured yet — set SMTP_USER, SMTP_PASS and DCNI_ADMIN_EMAIL in .env');
  }

  const transport = buildTransport();

  const html = `
    <p>A new membership renewal has been submitted.</p>
    <ul>
      <li><strong>Pastor:</strong> ${renewal.pastor_full_name}</li>
      <li><strong>Country:</strong> ${renewal.nationality}</li>
      <li><strong>Church:</strong> ${renewal.church_name}</li>
      <li><strong>Reference:</strong> ${renewal.registration_reference}</li>
      <li><strong>Submitted:</strong> ${new Date(renewal.submitted_at).toLocaleString()}</li>
      <li><strong>Renewal fee response:</strong> ${renewal.renewal_fee_response}</li>
    </ul>
    <p>The full registration PDF is attached.</p>
  `;

  await transport.sendMail({
    from: `"DCNI Pastoral Forum" <${process.env.SMTP_USER}>`,
    to: adminEmail,
    subject: `New Pastoral Forum Membership Renewal — ${renewal.pastor_full_name}`,
    html,
    attachments: [{ path: pdfFullPath }],
  });
}

module.exports = { sendNewRenewalEmail };
