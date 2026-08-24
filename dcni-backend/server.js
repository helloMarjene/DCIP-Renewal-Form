// server.js
//
// The whole backend in one place: receives a submission from index.html,
// validates it, saves it, generates the PDF, emails the administrator,
// optionally sends a WhatsApp alert, and serves a tiny admin dashboard.
//
// Run with:  npm install   then   npm start

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const db = require('./db');
const { generateMembershipPdf } = require('./pdf');
const { sendNewRenewalEmail } = require('./mailer');
const { sendNewRenewalAlert } = require('./whatsapp');

const app = express();

app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

/* ============================================================
   VALIDATION
   ============================================================ */
function validateSubmission(body) {
  const errors = [];
  const required = (field, label) => {
    if (!body[field] || String(body[field]).trim() === '') {
      errors.push(`${label} is required.`);
    }
  };

  required('pastor_full_name', "Senior Pastor's Full Name");
  required('title', 'Title');
  required('denomination', 'Denomination');
  required('nationality', 'Nationality');
  required('date_of_birth', 'Date of Birth');
  required('mailing_address', 'Mailing Address');
  required('city', 'City');
  required('contact_email', 'Contact Email');
  required('phone', 'Phone');
  required('church_name', 'Church Organisation Name');
  required('church_founded_date', 'Church Founded Date');
  required('church_address', 'Church Mailing Address');
  required('church_city', 'Church City');
  required('existing_member', 'Existing Member answer');
  required('renewal_fee_response', 'Renewal Fee response');

  if (body.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.contact_email)) {
    errors.push('Contact Email is not a valid email address.');
  }
  if (body.church_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.church_email)) {
    errors.push('Church Email is not a valid email address.');
  }
  if (!Array.isArray(body.church_languages) || body.church_languages.length === 0) {
    errors.push('At least one church language is required.');
  }
  if (!['Yes', 'No'].includes(body.existing_member)) {
    errors.push('Existing Member must be Yes or No.');
  }
  if (!['Yes', 'Not sure', 'No'].includes(body.renewal_fee_response)) {
    errors.push('Renewal Fee response must be Yes, Not sure, or No.');
  }

  return errors;
}

function generateReference() {
  const year = new Date().getFullYear();
  let candidate;
  do {
    const num = Math.floor(1000 + Math.random() * 9000);
    candidate = `DCNI-${year}-${num}`;
  } while (db.referenceExists(candidate));
  return candidate;
}

/* ============================================================
   PUBLIC API — used by index.html
   ============================================================ */
const submitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions from this device. Please wait a moment and try again.' },
});

app.post('/api/membership-renewals', submitLimiter, async (req, res) => {
  const errors = validateSubmission(req.body || {});
  if (errors.length) {
    return res.status(422).json({ error: 'Validation failed', details: errors });
  }

  const registration_reference = generateReference();
  const renewal = {
    ...req.body,
    registration_reference,
    submitted_at: new Date().toISOString(),
    pdf_path: null,
    email_status: 'pending',
    whatsapp_status: 'not_configured',
  };

  db.insert(renewal);

  // 1. Generate the official PDF
  try {
    const { filename, fullPath } = await generateMembershipPdf(renewal);
    db.updateByReference(registration_reference, { pdf_path: filename });
    renewal.pdf_path = filename;

    // 2. Email the administrator with the PDF attached
    try {
      await sendNewRenewalEmail(renewal, fullPath);
      db.updateByReference(registration_reference, { email_status: 'sent' });
    } catch (emailErr) {
      console.error('Email sending failed:', emailErr.message);
      db.updateByReference(registration_reference, { email_status: 'failed' });
    }
  } catch (pdfErr) {
    console.error('PDF generation failed:', pdfErr.message);
  }

  // 3. WhatsApp (only if configured)
  try {
    const result = await sendNewRenewalAlert(renewal);
    db.updateByReference(registration_reference, {
      whatsapp_status: result.sent ? 'sent' : 'not_configured',
    });
  } catch (waErr) {
    console.error('WhatsApp notification failed:', waErr.message);
    db.updateByReference(registration_reference, { whatsapp_status: 'failed' });
  }

  return res.status(201).json({
    registration_reference,
    submitted_at: renewal.submitted_at,
  });
});

app.get('/api/membership-renewals/:reference', (req, res) => {
  const renewal = db.findByReference(req.params.reference);
  if (!renewal) return res.status(404).json({ error: 'Not found' });
  return res.json({
    registration_reference: renewal.registration_reference,
    submitted_at: renewal.submitted_at,
    pastor_full_name: renewal.pastor_full_name,
  });
});

/* ============================================================
   ADMIN DASHBOARD — simple, password-protected
   Visit http://localhost:3000/admin
   Username/password come from .env (ADMIN_USER / ADMIN_PASS)
   ============================================================ */
function requireAdminAuth(req, res, next) {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASS;
  if (!user || !pass) {
    return res.status(500).send('Admin dashboard is not configured. Set ADMIN_USER and ADMIN_PASS in .env.');
  }
  const header = req.headers.authorization || '';
  const [, encoded] = header.split(' ');
  const decoded = encoded ? Buffer.from(encoded, 'base64').toString() : '';
  const [suppliedUser, suppliedPass] = decoded.split(':');

  if (suppliedUser === user && suppliedPass === pass) return next();

  res.set('WWW-Authenticate', 'Basic realm="DCNI Admin"');
  return res.status(401).send('Authentication required.');
}

app.get('/admin', requireAdminAuth, (req, res) => {
  const all = db.readAll().sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));

  const now = new Date();
  const thisMonth = all.filter((r) => {
    const d = new Date(r.submitted_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const byCountry = {};
  all.forEach((r) => { byCountry[r.nationality] = (byCountry[r.nationality] || 0) + 1; });
  const countryRows = Object.entries(byCountry)
    .sort((a, b) => b[1] - a[1])
    .map(([country, count]) => `<tr><td>${escapeHtml(country)}</td><td>${count}</td></tr>`)
    .join('');

  const recentRows = all.slice(0, 50).map((r) => `
    <tr>
      <td>${escapeHtml(r.registration_reference)}</td>
      <td>${escapeHtml(r.pastor_full_name)}</td>
      <td>${escapeHtml(r.church_name)}</td>
      <td>${escapeHtml(r.nationality)}</td>
      <td>${new Date(r.submitted_at).toLocaleString()}</td>
      <td>${r.pdf_path ? `<a href="/admin/pdf/${encodeURIComponent(r.registration_reference)}">Download</a>` : '—'}</td>
      <td>${escapeHtml(r.email_status)}</td>
    </tr>
  `).join('');

  res.send(`
    <!DOCTYPE html>
    <html><head><meta charset="utf-8"><title>DCNI Admin Dashboard</title>
    <style>
      body{ font-family: -apple-system, sans-serif; background:#FAF8F3; color:#232330; padding: 24px; }
      h1{ color:#16233F; }
      .cards{ display:flex; gap:16px; margin-bottom:24px; flex-wrap:wrap; }
      .card{ background:#fff; border:1px solid #E6E1D3; border-radius:10px; padding:16px 20px; min-width:160px; }
      .card .num{ font-size:28px; font-weight:700; color:#16233F; }
      .card .label{ font-size:12px; color:#6B6B78; }
      table{ width:100%; border-collapse:collapse; background:#fff; border:1px solid #E6E1D3; border-radius:10px; overflow:hidden; margin-bottom:28px;}
      th,td{ text-align:left; padding:8px 10px; border-bottom:1px solid #E6E1D3; font-size:13px; }
      th{ background:#F6F4EE; color:#16233F; }
      a{ color:#2F5D62; }
    </style></head>
    <body>
      <h1>DCNI Pastoral Forum — Admin Dashboard</h1>
      <div class="cards">
        <div class="card"><div class="num">${all.length}</div><div class="label">Total registrations</div></div>
        <div class="card"><div class="num">${thisMonth}</div><div class="label">This month</div></div>
        <div class="card"><div class="num">${Object.keys(byCountry).length}</div><div class="label">Countries represented</div></div>
      </div>
      <h2>By country</h2>
      <table><tr><th>Country</th><th>Registrations</th></tr>${countryRows || '<tr><td colspan="2">No data yet.</td></tr>'}</table>
      <h2>Recent registrations</h2>
      <table>
        <tr><th>Reference</th><th>Pastor</th><th>Church</th><th>Country</th><th>Submitted</th><th>PDF</th><th>Email</th></tr>
        ${recentRows || '<tr><td colspan="7">No registrations yet.</td></tr>'}
      </table>
    </body></html>
  `);
});

app.get('/admin/pdf/:reference', requireAdminAuth, (req, res) => {
  const renewal = db.findByReference(req.params.reference);
  if (!renewal || !renewal.pdf_path) return res.status(404).send('PDF not found.');
  const filePath = path.join(__dirname, 'pdfs', renewal.pdf_path);
  if (!fs.existsSync(filePath)) return res.status(404).send('PDF file missing on disk.');
  res.download(filePath);
});

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

app.listen(PORT, () => {
  console.log(`DCNI backend running at http://localhost:${PORT}`);
  console.log(`Admin dashboard at http://localhost:${PORT}/admin`);
});
