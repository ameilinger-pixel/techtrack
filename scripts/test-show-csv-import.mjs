/**
 * Regression tests for show CSV parsing (no Vite; run: npm run test:show-csv).
 */
import { parseShowCsvText } from '../src/lib/showCsvImport.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

// 1) Uppercase headers (common Excel / Sheets export)
const upper = `FP,TITLE,DIRECTOR,LOCATION (PLANO, FAIRVIEW, FRISCO, SOUTHLAKE, DALLAS),THEATRE WEEKEND DATE
1,Annie,Jane Doe,Plano,3/15/26
`;
{
  const r = parseShowCsvText(upper);
  assert(r.shows.length === 1, `uppercase headers: expected 1 show, got ${r.shows.length}`);
  assert(r.shows[0].title === 'Annie', `title got ${r.shows[0].title}`);
  assert(r.shows[0].director_name === 'Jane Doe', 'director');
}

// 2) Title rows above real header
const junk = `NTPA Production Planning 2026
Some note
Fp,Title,Director,Location (Plano, Fairview, Frisco, Southlake, Dallas),Theatre Weekend Date,First Show Date,SHOW TECHNICIAN
1,Frozen,Bob Smith,Dallas,3/1/26,3/5/26,
`;
{
  const r = parseShowCsvText(junk);
  assert(r.shows.length === 1, `junk header rows: got ${r.shows.length}`);
  assert(r.meta.headerRowIndex >= 1, `expected header past row 0, got index ${r.meta.headerRowIndex}`);
  assert(r.shows[0].title === 'Frozen', 'title');
}

// 3) Tab-separated
const tab = `Fp\tTitle\tDirector\tLocation (Plano, Fairview, Frisco, Southlake, Dallas)\tTheatre Weekend Date
1\tWicked\tMary\tFrisco\t4/1/26
`;
{
  const r = parseShowCsvText(tab);
  assert(r.shows.length === 1, `tab: got ${r.shows.length}`);
  assert(r.meta.delimiter === '\t', `expected TAB delimiter, got ${JSON.stringify(r.meta.delimiter)}`);
}

// 4) Master list: SHOW NAME casing
const master = `SHOW NAME,Director,Location
My Show,Director A,Dallas
`;
{
  const r = parseShowCsvText(master);
  assert(r.shows.length === 1, `master SHOW NAME: got ${r.shows.length}`);
  assert(r.shows[0].director_name === 'Director A', 'director');
  assert(r.shows[0].theater === 'Dallas', 'theater');
}

// 5) Two-digit year 2017 must not drop row
const oldYear = `Title,Director,Theatre Weekend Date
Old Show,Someone,9/15/17
`;
{
  const r = parseShowCsvText(oldYear);
  assert(r.shows.length === 1, `2017 date: got ${r.shows.length}`);
}

// 6) Programming proposed title column
const proposed = `Fp,PROGRAMMING TEAM PROPOSED TITLE,Director
1,Heathers,Pat Lee
`;
{
  const r = parseShowCsvText(proposed);
  assert(r.shows.length === 1, `proposed title: got ${r.shows.length}`);
  assert(r.shows[0].title === 'Heathers', 'title');
}

// 7) UTF-16-style NUL between ASCII bytes (Excel “Unicode” mis-read as UTF-8)
const nulBetween = 'T\0i\0t\0l\0e\0,\0D\0i\0r\0e\0c\0t\0o\0r\0\n\0C\0a\0t\0s\0,\0X\0';
{
  const r = parseShowCsvText(nulBetween);
  assert(r.shows.length === 1, `NUL-stripped CSV: got ${r.shows.length}`);
  assert(r.shows[0].title === 'Cats', 'title Cats');
}

// 8) Comma CSV with quoted cells (commas inside Location) — no tabs
const quotedComma = `"Fp","Title","Director","Location (Plano, Fairview, Frisco, Southlake, Dallas)","Theatre Weekend Date"
"1","Cats","Ann","Plano","5/1/26"
`;
{
  const r = parseShowCsvText(quotedComma);
  assert(r.shows.length === 1, `quoted comma CSV: got ${r.shows.length}`);
  assert(r.meta.delimiter === ',', 'comma delimiter');
}

console.log('test-show-csv-import: all passed');
