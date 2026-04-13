#!/usr/bin/env node
/**
 * Bulk-create Supabase Auth users from a CSV with headers: Name,Email
 *
 * Usage (from project root):
 *   export SUPABASE_URL="https://xxxxx.supabase.co"
 *   export SUPABASE_SERVICE_ROLE_KEY="eyJ..."   # Project Settings → API → service_role (secret!)
 *   export BULK_TEMP_PASSWORD="ChangeMeAfterLogin1!"   # same temp password for everyone (optional)
 *   node scripts/bulk-create-auth-users.mjs "/path/to/file.csv"
 *
 * Or put secrets in scripts/.env.bulk (gitignored), one per line (optional "export " OK):
 *   SUPABASE_URL=https://xxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ...
 *   BULK_TEMP_PASSWORD=YourTempPass!
 * Do not paste shell commands into that file — only KEY=value lines.
 * Then from project root:
 *   node scripts/bulk-create-auth-users.mjs "/path/to/Name,Email.csv"
 *
 * - Skips empty emails; skips if user already exists (by email).
 * - Sets email_confirm: true so they are not stuck on verify email.
 * - Writes scripts/bulk-auth-results.json with created / skipped / errors.
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const envBulkPath = resolve(__dirname, '.env.bulk');
if (fs.existsSync(envBulkPath)) {
  const text = fs.readFileSync(envBulkPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    let trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (/^export\s+/i.test(trimmed)) {
      trimmed = trimmed.replace(/^export\s+/i, '');
    }
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const k = trimmed.slice(0, eq).trim();
    let v = trimmed.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined || process.env[k] === '') {
      process.env[k] = v;
    }
  }
}

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const tempPassword =
  process.env.BULK_TEMP_PASSWORD || 'NTPATechTrack!';

const csvPath = process.argv[2];
if (!url || !serviceKey) {
  console.error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.\nSee comments at top of this script.'
  );
  process.exit(1);
}
if (!csvPath || !fs.existsSync(csvPath)) {
  console.error('Usage: node scripts/bulk-create-auth-users.mjs "/path/to/Name,Email.csv"');
  process.exit(1);
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') {
        out.push(cur);
        cur = '';
      } else cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const text = fs.readFileSync(csvPath, 'utf8');
const lines = text.split(/\r?\n/).filter((l) => l.trim());
const header = parseCsvLine(lines[0]);
const iName = header.indexOf('Name');
const iEmail = header.indexOf('Email');
if (iName < 0 || iEmail < 0) {
  console.error('CSV must have headers Name and Email. Found:', header);
  process.exit(1);
}

const seen = new Set();
const rows = [];
for (let r = 1; r < lines.length; r++) {
  const cells = parseCsvLine(lines[r]);
  const fullName = (cells[iName] || '').trim();
  const email = (cells[iEmail] || '').trim().toLowerCase();
  if (!email || seen.has(email)) continue;
  seen.add(email);
  rows.push({ full_name: fullName, email });
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const results = { created: [], skipped: [], errors: [] };

const etaSec = Math.max(1, Math.ceil((rows.length * 150) / 1000));
console.log(
  `Bulk auth: ${rows.length} unique emails from CSV (about ${etaSec}s). Calling Supabase…`
);

for (const row of rows) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: row.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: row.full_name },
  });

  if (error) {
    if (
      String(error.message).toLowerCase().includes('already') ||
      String(error.message).toLowerCase().includes('registered') ||
      error.status === 422
    ) {
      results.skipped.push({ email: row.email, reason: error.message });
      console.log(`  skip ${row.email}`);
    } else {
      results.errors.push({ email: row.email, message: error.message });
      console.log(`  ERR  ${row.email}: ${error.message}`);
    }
  } else {
    results.created.push({ email: row.email, id: data.user?.id });
    console.log(`  ok   ${row.email}`);
  }

  await new Promise((r) => setTimeout(r, 150));
}

const outPath = resolve(__dirname, 'bulk-auth-results.json');
fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');

console.log(
  `Done. Created: ${results.created.length}, skipped (likely exists): ${results.skipped.length}, errors: ${results.errors.length}`
);
console.log(`Details: ${outPath}`);
if (results.errors.length) {
  console.log('Errors:', JSON.stringify(results.errors, null, 2));
  process.exitCode = 1;
}
