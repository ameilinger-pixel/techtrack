/**
 * Show CSV → entity payloads. Uses lowercase-normalized header keys so
 * "SHOW NAME", "Show Name", and "show name" all match.
 */

import {
  parseCSVRecords,
  findShowCsvHeaderRowIndex,
  normalizeHeaderCell,
  rowIsEmpty,
  scoreCsvHeaderRow,
} from './csvParse.js';

export function normalizeHeaderKey(h) {
  return normalizeHeaderCell(h).toLowerCase();
}

/** Get first non-empty cell for any of the given header spellings. */
export function Lget(L, ...aliases) {
  for (const a of aliases) {
    const k = normalizeHeaderKey(a);
    const v = L[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      return String(v).trim().replace(/^\uFEFF/, '');
    }
  }
  return '';
}

function parseDate(str) {
  if (!str || typeof str !== 'string') return '';
  const clean = str.replace(/\\/g, '').trim();
  if (!clean) return '';
  const md = clean.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (md) {
    const y = new Date().getFullYear();
    const d = new Date(y, parseInt(md[1], 10) - 1, parseInt(md[2], 10));
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  const mdy2 = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (mdy2) {
    const yy = parseInt(mdy2[3], 10);
    const fullY = yy < 50 ? 2000 + yy : 1900 + yy;
    const d = new Date(fullY, parseInt(mdy2[1], 10) - 1, parseInt(mdy2[2], 10));
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  const d = new Date(clean);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

function parseTechWeekStart(techDatesStr) {
  if (!techDatesStr) return '';
  const match = techDatesStr.match(/(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/);
  if (match) return parseDate(match[1]);
  return '';
}

function isNotNeeded(techName) {
  if (!techName) return false;
  const lower = techName.toLowerCase();
  return lower.includes('not needed') || lower.includes('n/a') || lower.includes('no need');
}

function isGarbageTitle(s) {
  const t = String(s).trim();
  if (!t) return true;
  if (/^#REF!/i.test(t)) return true;
  if (/^\\+$/.test(t.replace(/\s/g, ''))) return true;
  if (/^\*+$/.test(t.replace(/\s/g, ''))) return true;
  return false;
}

function isAbsurdShowDate(isoDateStr) {
  if (!isoDateStr) return false;
  const y = new Date(isoDateStr).getFullYear();
  return !Number.isFinite(y) || y < 1990 || y > 2100;
}

const PROGRAMMING_LOCATION_FULL =
  'Location (Plano, Fairview, Frisco, Southlake, Dallas)';

function programmingLocationFromRow(L) {
  const direct = Lget(L, PROGRAMMING_LOCATION_FULL);
  if (direct) return direct;
  for (const k of Object.keys(L)) {
    if (k.startsWith('__')) continue;
    if (/^location\s*\(/.test(k)) {
      const v = L[k];
      if (v != null && String(v).trim()) return String(v).trim();
    }
  }
  return Lget(L, 'Location', 'location');
}

/**
 * Title column: L keys first, then raw header names (handles empty/duplicate header cells),
 * then NTPA-style column 1 after Fp.
 */
export function csvShowTitleFromRow(L, headers, vals) {
  const master = Lget(L, 'Show Name', 'show name', 'SHOW NAME', 'show_name');
  if (master) return master;

  const t = Lget(L, 'Title', 'title', 'TITLE');
  if (t && !isGarbageTitle(t)) return t;

  const p = Lget(
    L,
    'PROGRAMMING TEAM PROPOSED TITLE',
    'Programming Team Proposed Title',
    'programming team proposed title'
  );
  if (p && !isGarbageTitle(p)) return p;

  const st = Lget(L, 'Show Title', 'show title', 'Production Title', 'production title');
  if (st && !isGarbageTitle(st)) return st;

  for (const k of Object.keys(L)) {
    if (k.startsWith('__')) continue;
    if (k === 'fp') continue;
    if (/proposed title/.test(k)) {
      const v = String(L[k] ?? '').trim().replace(/^\uFEFF/, '');
      if (v && !isGarbageTitle(v)) return v;
    }
    if (k === 'show title' || k === 'production title') {
      const v = String(L[k] ?? '').trim().replace(/^\uFEFF/, '');
      if (v && !isGarbageTitle(v)) return v;
    }
    // "Musical Title", "Show Name 2", etc. (avoid generic "Production" alone)
    if (
      (/\btitle\b/.test(k) && !/\bsubtitle\b/.test(k)) ||
      /\bshow name\b/.test(k) ||
      (/\bmusical\b/.test(k) && /\btitle\b/.test(k))
    ) {
      const v = String(L[k] ?? '').trim().replace(/^\uFEFF/, '');
      if (v && !isGarbageTitle(v) && v.length <= 200) return v;
    }
  }

  if (headers && vals) {
    for (let i = 0; i < headers.length; i++) {
      const hk = normalizeHeaderKey(headers[i]);
      if (!hk) continue;
      if (
        hk === 'title' ||
        hk === 'show name' ||
        hk === 'show title' ||
        hk === 'production title' ||
        hk.includes('proposed title') ||
        hk === 'musical' ||
        (hk.includes('show') && hk.includes('name')) ||
        (hk.includes('musical') && hk.includes('title'))
      ) {
        const v = String(vals[i] ?? '').trim().replace(/^\uFEFF/, '');
        if (v && !isGarbageTitle(v)) return v;
      }
    }

    // NTPA programming: col0 = Fp / row index, col1 = show title (when headers are wrong or merged)
    if (vals.length >= 2) {
      const c0 = String(vals[0] ?? '').trim();
      const c1 = String(vals[1] ?? '').trim();
      const h0 = normalizeHeaderKey(headers[0] || '');
      const h1 = normalizeHeaderKey(headers[1] || '');
      const fpLike = h0 === 'fp' || /^(fp|#|row|num)$/i.test(headers[0] || '') || /^\d{1,4}$/.test(c0);
      const titleLike =
        h1 === 'title' ||
        (!h1 && c1.length >= 2) ||
        (h1 && (h1.includes('title') || h1.includes('show') || h1.includes('musical')));
      if (fpLike && titleLike && c1 && !isGarbageTitle(c1) && !/^\d+\/\d+/.test(c1)) {
        return c1;
      }
    }
  }

  return '';
}

function rowToShowFromMasterList(L, title) {
  const director = Lget(L, 'Director', 'director') || 'Unassigned';
  const location = Lget(L, 'Location', 'location');
  const techDates = Lget(L, 'Tech Dates/Times', 'Tech Dates/Times ');
  const showDates = Lget(L, 'Show Dates/Times', 'Show Dates/Times ');
  const equipment = Lget(L, 'Equipment Needed', 'Equipment Needed ');
  const techName = Lget(L, "Technician Assigned'", 'Technician Assigned', 'technician assigned');
  const roles = Lget(L, 'Roles Needed (from request)', 'Roles Needed (from request) ');
  const rehearsals = Lget(L, 'Rehearsals (from request)', 'Rehearsals (from request) ');
  const appUrl = Lget(
    L,
    'Application Live URL (from script)',
    'Application Edit URL (from script)'
  );
  const shadow =
    Lget(L, 'Shadow Tech (from request)', 'Shadow Tech (from request) ').toLowerCase() === 'yes';
  const techStartRaw = Lget(L, 'Tech Start Date (from request)', 'Tech Start Date (from request) ');

  const techDeclined = isNotNeeded(techName);
  const assigned = techName && !techDeclined ? techName : '';

  const showDateParsed = parseDate(showDates) || parseDate(techStartRaw);
  if (showDateParsed && isAbsurdShowDate(showDateParsed)) return null;

  const techWeekStart = parseTechWeekStart(techDates) || parseDate(techStartRaw);

  return {
    title,
    director_name: director,
    theater: location,
    tech_week_start: techWeekStart || '',
    show_dates: showDates,
    tech_rehearsal_times: [techDates, rehearsals].filter(Boolean).join(' | '),
    equipment_needs: equipment,
    tech_needs_description: [
      roles ? `Roles: ${roles}` : '',
      equipment ? `Equipment: ${equipment}` : '',
      shadow ? 'Shadow tech welcome' : '',
    ]
      .filter(Boolean)
      .join(' | '),
    roles_needed: roles ? roles.split(/,|and/).map((r) => r.trim()).filter(Boolean) : [],
    assigned_technician_name: assigned,
    needs_technician: !assigned && !techDeclined,
    tech_support_declined: techDeclined,
    application_link_url: appUrl && !appUrl.toLowerCase().includes('edit') ? appUrl : '',
    shadow_opportunity: shadow,
    status: 'upcoming',
    workflow_status: assigned ? 'assigned' : techDeclined ? 'posting_created' : 'needs_director_contact',
  };
}

function rowToShowFromProgramming(L, title) {
  const loc = programmingLocationFromRow(L);
  const space = Lget(L, 'Performance Space', 'performance space');
  const theater = [loc, space].filter(Boolean).join(' · ');
  const director = Lget(L, 'Director', 'director') || 'Unassigned';
  const weekend = Lget(L, 'Theatre Weekend Date', 'Theater Weekend Date', 'theatre weekend date');
  const firstShow = Lget(L, 'First Show Date', 'first show date');
  const showDates = [weekend, firstShow].filter(Boolean).join(' | ');
  const techDates = [
    Lget(L, 'Audition Dates/ Times', 'Audition Dates/Times', 'Audition Dates / Times'),
    Lget(L, 'First Rehearsal Date', 'first rehearsal date'),
    Lget(L, 'Rehearsal Days', 'rehearsal days'),
    Lget(L, 'Rehearsal Times', 'rehearsal times'),
  ]
    .filter(Boolean)
    .join(' | ');
  const techName = Lget(L, 'SHOW TECHNICIAN', 'Show Technician', 'show technician');
  const troupe = Lget(L, 'Troupe', 'TROUPE', 'troupe');
  const comments = Lget(L, 'COMMENTS', 'Comments', 'comments');
  const showTier = Lget(
    L,
    'Show Tier (Kids, Play, JR, Full, Premium)',
    'Show Tier (Kids, Play, Jr, Full, Premium)'
  );
  const musicalOrPlay = Lget(L, 'Musical or Play', 'musical or play');

  const showDateParsed = parseDate(weekend) || parseDate(firstShow);
  if (showDateParsed && isAbsurdShowDate(showDateParsed)) return null;

  const techWeekStart =
    parseTechWeekStart(techDates) || parseDate(weekend) || parseDate(firstShow);

  const techDeclined = isNotNeeded(techName);
  const assigned = techName && !techDeclined ? techName : '';

  return {
    title,
    director_name: director,
    theater,
    troupe: troupe || undefined,
    tech_week_start: techWeekStart || '',
    show_dates: showDates,
    tech_rehearsal_times: techDates,
    equipment_needs: '',
    tech_needs_description: [
      showTier && `Tier: ${showTier}`,
      musicalOrPlay && `Type: ${musicalOrPlay}`,
      troupe && `Troupe: ${troupe}`,
      comments && `Notes: ${comments}`,
    ]
      .filter(Boolean)
      .join(' | '),
    roles_needed: [],
    assigned_technician_name: assigned,
    needs_technician: !assigned && !techDeclined,
    tech_support_declined: techDeclined,
    application_link_url: '',
    shadow_opportunity: false,
    status: 'upcoming',
    workflow_status: assigned ? 'assigned' : techDeclined ? 'posting_created' : 'needs_director_contact',
  };
}

function rowToShow(L, headers, vals) {
  const title = csvShowTitleFromRow(L, headers, vals);
  if (!title) return null;

  const t = title.toLowerCase();
  if (t === '#ref' || t === 'false' || t === '---' || t.startsWith('***')) return null;

  const fromMaster =
    !!Lget(L, 'Show Name', 'show name', 'SHOW NAME', 'show_name') ||
    Object.keys(L).some((k) => !k.startsWith('__') && /^show name(__\d+)?$/.test(k)) ||
    !!(headers && headers.some((h) => normalizeHeaderKey(h) === 'show name'));
  if (fromMaster) return rowToShowFromMasterList(L, title);
  return rowToShowFromProgramming(L, title);
}

function buildLowerKeyRow(headers, vals, delimiter) {
  const L = {};
  headers.forEach((h, idx) => {
    let k = normalizeHeaderKey(h);
    if (!k) k = `__col${idx}`;
    else if (Object.prototype.hasOwnProperty.call(L, k)) {
      k = `${k}__${idx}`;
    }
    L[k] = vals[idx] ?? '';
  });
  Object.defineProperty(L, '__vals', { value: vals, enumerable: false });
  Object.defineProperty(L, '__headers', { value: headers, enumerable: false });
  Object.defineProperty(L, '__delimiter', { value: delimiter, enumerable: false });
  return L;
}

function countDataRowsWithTitle(records, headerIdx, delimiter) {
  const headers = (records[headerIdx] || []).map((h) => normalizeHeaderCell(h));
  if (!headers.some((h) => normalizeHeaderKey(h) || h)) return 0;
  let n = 0;
  for (let r = headerIdx + 1; r < records.length; r++) {
    const vals = records[r];
    if (rowIsEmpty(vals)) continue;
    const L = buildLowerKeyRow(headers, vals, delimiter);
    if (csvShowTitleFromRow(L, headers, vals)) n++;
  }
  return n;
}

/** Try several possible header rows; pick the one that yields the most recognizable titles. */
function pickBestShowHeaderIndex(records, delimiter) {
  const limit = Math.min(25, Math.max(0, records.length - 1));
  let bestIdx = findShowCsvHeaderRowIndex(records);
  let bestCount = countDataRowsWithTitle(records, bestIdx, delimiter);
  for (let i = 0; i < limit; i++) {
    const c = countDataRowsWithTitle(records, i, delimiter);
    if (c > bestCount) {
      bestCount = c;
      bestIdx = i;
    }
  }
  return { headerIdx: bestIdx, titleRowCount: bestCount };
}

/**
 * Parse CSV/TSV text into show payloads + diagnostics.
 */
export function parseShowCsvText(text) {
  const { records, delimiter } = parseCSVRecords(text);
  if (records.length < 2) {
    return {
      shows: [],
      meta: {
        scannedRows: 0,
        skippedNoTitle: 0,
        delimiter,
        headerRowIndex: 0,
        headerScore: 0,
        titleRowCount: 0,
        columnKeysSample: [],
      },
    };
  }

  const { headerIdx, titleRowCount } = pickBestShowHeaderIndex(records, delimiter);
  const headerScore = scoreCsvHeaderRow(records[headerIdx] || []);
  const headers = (records[headerIdx] || []).map((h) => normalizeHeaderCell(h));

  const rows = [];
  for (let r = headerIdx + 1; r < records.length; r++) {
    const vals = records[r];
    if (rowIsEmpty(vals)) continue;
    rows.push(buildLowerKeyRow(headers, vals, delimiter));
  }

  const withTitle = rows.filter((L) => csvShowTitleFromRow(L, headers, L.__vals));
  const skippedNoTitle = rows.length - withTitle.length;
  const shows = rows.map((L) => rowToShow(L, headers, L.__vals)).filter(Boolean);

  const firstL = rows[0];
  const columnKeysSample = firstL
    ? Object.keys(firstL)
        .filter((k) => !k.startsWith('__'))
        .slice(0, 14)
    : [];

  return {
    shows,
    meta: {
      scannedRows: rows.length,
      skippedNoTitle,
      delimiter,
      headerRowIndex: headerIdx,
      headerScore,
      titleRowCount,
      columnKeysSample,
    },
  };
}
