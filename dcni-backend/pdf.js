// pdf.js
//
// Generates the official membership renewal PDF using PDFKit — a pure
// JavaScript library, so there is nothing to compile and no extra system
// software to install beyond `npm install`.
//
// IMPORTANT: only image/logo.png (the official forum logo) is used here.
// The developer/company watermark.png must never appear in this PDF.

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const LOGO_PATH = path.join(__dirname, 'image', 'logo.png');
const OUTPUT_DIR = path.join(__dirname, 'pdfs');

function sanitizeFilename(name) {
  return String(name)
    .trim()
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
}

function row(doc, label, value) {
  const y = doc.y;
  doc.font('Helvetica').fontSize(10).fillColor('#6B6B78')
    .text(label, 50, y, { width: 190 });
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#232330')
    .text(value || '—', 250, y, { width: 290 });
  doc.moveDown(0.6);
}

function sectionHeading(doc, title) {
  doc.moveDown(0.4);
  const y = doc.y;
  doc.rect(50, y, 490, 20).fill('#F6F4EE');
  doc.fillColor('#16233F').font('Helvetica-Bold').fontSize(11)
    .text(title, 58, y + 5);
  doc.moveDown(1.4);
  doc.fillColor('#232330');
}

function generateMembershipPdf(renewal) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const safeName = sanitizeFilename(renewal.pastor_full_name || 'Pastor');
    const year = new Date(renewal.submitted_at).getFullYear();
    const filename = `DCNI-Membership-Renewal-${safeName}-${year}.pdf`;
    const outputPath = path.join(OUTPUT_DIR, filename);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // Faint background watermark: the OFFICIAL LOGO ONLY (never watermark.png)
    if (fs.existsSync(LOGO_PATH)) {
      doc.save();
      doc.opacity(0.06);
      doc.image(LOGO_PATH, 130, 300, { width: 340 });
      doc.opacity(1);
      doc.restore();
    }

    // Header
    if (fs.existsSync(LOGO_PATH)) {
      doc.image(LOGO_PATH, 265, 40, { width: 60 });
    }
    doc.moveDown(4.5);
    doc.font('Helvetica-Bold').fontSize(15).fillColor('#16233F')
      .text('DISCIPLESHIP CHRISTIAN NETWORK INTERNATIONAL', { align: 'center' });
    doc.font('Helvetica').fontSize(11).fillColor('#555')
      .text('Pastoral Forum — Membership Renewal Form', { align: 'center' });
    doc.moveDown(1);

    doc.font('Helvetica').fontSize(9.5).fillColor('#555')
      .text(`Registration Reference: ${renewal.registration_reference}`)
      .text(`Submission Date: ${new Date(renewal.submitted_at).toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' })}`);
    doc.moveDown(0.6);

    sectionHeading(doc, 'PERSONNEL INFORMATION');
    row(doc, "Senior Pastor's Full Name", renewal.pastor_full_name);
    row(doc, 'Title', renewal.title);
    row(doc, 'Denomination', renewal.denomination);
    row(doc, 'Nationality', renewal.nationality);
    row(doc, 'Date of Birth', renewal.date_of_birth);
    row(doc, 'Gender', renewal.gender);
    row(doc, 'Mailing Address', renewal.mailing_address);
    row(doc, 'City', renewal.city);
    row(doc, 'Postal / ZIP Code', renewal.postal_code);
    row(doc, 'Contact Email', renewal.contact_email);
    row(doc, 'Tel / Cell Phone', renewal.phone);

    sectionHeading(doc, 'CHURCH ORGANISATION INFORMATION');
    row(doc, 'Church Organisation Name', renewal.church_name);
    row(doc, 'Founded Date', renewal.church_founded_date);
    row(doc, 'Church Mailing Address', renewal.church_address);
    row(doc, 'City', renewal.church_city);
    row(doc, 'Postal / ZIP Code', renewal.church_postal_code);
    row(doc, 'Church Email', renewal.church_email);
    row(doc, 'Church Tel', renewal.church_phone);
    row(doc, 'Language(s) Spoken in the Church', (renewal.church_languages || []).join(', '));

    sectionHeading(doc, 'MEMBERSHIP & RENEWAL');
    row(doc, 'Existing Member', renewal.existing_member);
    row(doc, 'Willing to Contribute Renewal Fee ($50.00)', renewal.renewal_fee_response);

    doc.end();

    stream.on('finish', () => resolve({ filename, fullPath: outputPath }));
    stream.on('error', reject);
  });
}

module.exports = { generateMembershipPdf };
