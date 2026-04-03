/**
 * RFC 4180-style CSV: quoted fields, commas inside quotes, "" escapes, newlines inside quotes.
 */

export function splitCSVLine(line, delimiter = ',') {
  const vals = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === delimiter) {
      vals.push(cur.replace(/\r/g, '').trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  vals.push(cur.replace(/\r/g, '').trim());
  return vals;
}

/**
 * Split entire file into records (rows as string arrays). Handles multiline quoted cells.
 */
/**
 * Excel sometimes saves UTF-16; if the file is read as UTF-8, you get NUL bytes between ASCII chars.
 * Strip those so "T\0i\0t\0l\0e" becomes "Title".
 */
export function normalizeCsvTextEncoding(text) {
  let s = String(text).replace(/^\uFEFF/, '');
  const nulMatches = s.match(/\0/g);
  const nulCount = nulMatches ? nulMatches.length : 0;
  if (nulCount >= 4 && nulCount >= s.length * 0.08) {
    s = s.replace(/\0/g, '');
  }
  return s
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

export function parseCSVRecords(text, delimiter = ',') {
  const s = normalizeCsvTextEncoding(text);

  let delim = delimiter;
  const firstNl = s.indexOf('\n');
  const firstLine = firstNl < 0 ? s : s.slice(0, firstNl);
  const commas = (firstLine.match(/,/g) || []).length;
  const semis = (firstLine.match(/;/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;
  // Prefer TSV when the header line clearly uses tabs — commas inside cells (e.g. "Plano, Fairview, …")
  // must not force comma mode or the row splits in the wrong places.
  if (tabs >= 3) {
    delim = '\t';
  } else if (delimiter === ',' && semis > commas && semis > 5) {
    delim = ';';
  }

  const records = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < s.length) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === delim) {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (c === '\n') {
      row.push(field);
      records.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += c;
    i++;
  }
  row.push(field);
  if (row.some((cell) => String(cell).trim() !== '')) {
    records.push(row);
  }

  return { records, delimiter: delim };
}

export function rowIsEmpty(vals) {
  return !vals.some((v) => String(v ?? '').trim() !== '');
}

export function normalizeHeaderCell(h) {
  return String(h ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Score how likely a row is the real column header for show/programming sheets. */
export function scoreCsvHeaderRow(cells) {
  const lower = cells.map((c) => normalizeHeaderCell(c).toLowerCase());
  let s = 0;
  for (const c of lower) {
    if (!c) continue;
    if (c === 'title' || c === 'show name' || c === 'show title') s += 3;
    if (c.includes('programming team proposed title')) s += 3;
    if (c === 'director') s += 2;
    if (c.startsWith('location (')) s += 2;
    if (c.includes('theatre weekend') || c.includes('theater weekend')) s += 1;
    if (c.includes('show technician')) s += 1;
    if (c === 'performance space') s += 1;
    if (c === 'first show date') s += 1;
  }
  return s;
}

const MIN_SHOW_HEADER_SCORE = 3;

/**
 * Pick the header row among the first rows (title rows above headers, multi-line exports).
 * Falls back to row 0 when no row looks like a show header (e.g. student/email CSVs).
 */
export function findShowCsvHeaderRowIndex(records, maxScan = 35) {
  if (!records.length) return 0;
  let bestIdx = 0;
  let bestScore = scoreCsvHeaderRow(records[0] || []);
  for (let i = 1; i < Math.min(maxScan, records.length); i++) {
    const sc = scoreCsvHeaderRow(records[i] || []);
    if (sc > bestScore) {
      bestScore = sc;
      bestIdx = i;
    }
  }
  if (bestScore >= MIN_SHOW_HEADER_SCORE) return bestIdx;
  return 0;
}

/** Returns array of plain objects keyed by header row. Skips blank rows. */
export function parseCSVRows(text) {
  const { records, delimiter } = parseCSVRecords(text);
  if (records.length < 2) return [];
  const headerIdx = findShowCsvHeaderRowIndex(records);
  const headers = records[headerIdx].map((h) => normalizeHeaderCell(h));
  const rows = [];
  for (let r = headerIdx + 1; r < records.length; r++) {
    const vals = records[r];
    if (rowIsEmpty(vals)) continue;
    const row = {};
    headers.forEach((h, idx) => {
      if (!h) return;
      row[h] = vals[idx] ?? '';
    });
    row.__vals = vals;
    row.__delimiter = delimiter;
    rows.push(row);
  }
  return rows;
}
