// db.js
//
// A tiny file-based "database". No MySQL/Postgres server to install —
// registrations are stored as one JSON file on disk. This is fine for a
// forum of modest size. If registrations grow into the thousands, or you
// want multiple people editing data at once, swap this file for a real
// database (see the note at the bottom of README-SETUP.md).

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'renewals.json');

function readAll() {
  if (!fs.existsSync(DB_PATH)) return [];
  const raw = fs.readFileSync(DB_PATH, 'utf8').trim();
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error('renewals.json is corrupted, starting fresh:', err.message);
    return [];
  }
}

function writeAll(records) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(records, null, 2), 'utf8');
}

function insert(record) {
  const records = readAll();
  records.push(record);
  writeAll(records);
  return record;
}

function findByReference(reference) {
  return readAll().find((r) => r.registration_reference === reference) || null;
}

function updateByReference(reference, patch) {
  const records = readAll();
  const idx = records.findIndex((r) => r.registration_reference === reference);
  if (idx === -1) return null;
  records[idx] = { ...records[idx], ...patch };
  writeAll(records);
  return records[idx];
}

function referenceExists(reference) {
  return readAll().some((r) => r.registration_reference === reference);
}

module.exports = { readAll, insert, findByReference, updateByReference, referenceExists };
