import { db } from '@/lib/backend/client';

import React, { useState, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, CheckCircle2, AlertCircle, Loader2, FileText } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/shared/PageHeader';

function parseDate(str) {
  if (!str || typeof str !== 'string') return '';
  const clean = str.replace(/\\/g, '').trim();
  if (!clean) return '';
  const d = new Date(clean);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

function splitCSVLine(line) {
  const vals = [];
  let cur = '';
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { vals.push(cur.replace(/^"|"$/g, '').trim()); cur = ''; }
    else { cur += ch; }
  }
  vals.push(cur.replace(/^"|"$/g, '').trim());
  return vals;
}

function parseCSV(text) {
  const lines = text.split('\n');
  if (lines.length < 2) return [];
  const headers = splitCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = splitCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });
    // Also store by index for columns with commas in their names
    row.__vals = vals;
    rows.push(row);
  }
  return rows;
}

function parseTechWeekStart(techDatesStr) {
  if (!techDatesStr) return '';
  // Try to extract a date from strings like "3/9/26-3/11/26 / 6:00-9:00 pm" or "March 8-11 5-9"
  const match = techDatesStr.match(/(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/);
  if (match) return parseDate(match[1]);
  return '';
}

function isNotNeeded(techName) {
  if (!techName) return false;
  const lower = techName.toLowerCase();
  return lower.includes('not needed') || lower.includes('n/a') || lower.includes('no need');
}

function rowToShow(row) {
  // This handles the MasterFullShowList CSV format with named columns
  const title = (row['Show Name'] || '').trim();
  const director = (row['Director'] || '').trim();
  const location = (row['Location'] || '').trim();
  const techDates = (row['Tech Dates/Times'] || '').trim();
  const showDates = (row['Show Dates/Times'] || '').trim();
  const equipment = (row['Equipment Needed'] || '').trim();
  const techName = (row["Technician Assigned'"] || '').trim();
  const roles = (row['Roles Needed (from request)'] || '').trim();
  const rehearsals = (row['Rehearsals (from request)'] || '').trim();
  const appUrl = (row['Application Live URL (from script)'] || row['Application Edit URL (from script)'] || '').trim();
  const shadow = (row['Shadow Tech (from request)'] || '').trim().toLowerCase() === 'yes';
  const techStartRaw = (row['Tech Start Date (from request)'] || '').trim();

  // Must have a real title and director
  if (!title || !director) return null;

  // Skip junk rows
  const junk = ['#ref', 'thanksgiving', '4th of july', 'spring break', 'easter',
    'summer vacation', 'pisd', '***', '---', 'rental', 'false'];
  if (junk.some(j => title.toLowerCase().includes(j))) return null;

  // Determine if tech is needed
  const techDeclined = isNotNeeded(techName);
  const assigned = techName && !techDeclined ? techName : '';

  // Try to parse a show date to filter historical shows
  const showDateParsed = parseDate(showDates) || parseDate(techStartRaw);
  if (showDateParsed && new Date(showDateParsed) < new Date('2026-01-01')) return null;

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
    ].filter(Boolean).join(' | '),
    roles_needed: roles ? roles.split(/,|and/).map(r => r.trim()).filter(Boolean) : [],
    assigned_technician_name: assigned,
    needs_technician: !assigned && !techDeclined,
    tech_support_declined: techDeclined,
    application_link_url: appUrl && !appUrl.toLowerCase().includes('edit') ? appUrl : '',
    shadow_opportunity: shadow,
    status: 'upcoming',
    workflow_status: assigned ? 'assigned' : techDeclined ? 'posting_created' : 'needs_director_contact',
  };
}

function rowToStudent(row) {
  const name = (row['Name'] || row['Full Name'] || row['full_name'] || '').trim();
  const email = (row['Email'] || row['email'] || '').trim();
  if (!name || !email) return null;
  return {
    full_name: name,
    email,
    phone: (row['Phone'] || row['phone'] || '').trim(),
    skills: (row['Skills'] || row['skills'] || '').split(/,|;/).map(s => s.trim()).filter(Boolean),
    skill_level: (['beginner','intermediate','advanced'].includes((row['Skill Level'] || row['skill_level'] || '').toLowerCase())
      ? (row['Skill Level'] || row['skill_level']).toLowerCase() : 'beginner'),
    bio: (row['Bio'] || row['bio'] || row['Notes'] || '').trim(),
    active: true,
  };
}

export default function ImportShows() {
  const [mode, setMode] = useState('shows'); // 'shows' | 'students'
  const [parsedShows, setParsedShows] = useState(null);
  const [parsedStudents, setParsedStudents] = useState(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const fileRef = useRef();
  const { toast } = useToast();

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setResults(null);
    setParsedShows(null);
    setParsedStudents(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target.result);
      if (mode === 'students') {
        setParsedStudents(rows.map(rowToStudent).filter(Boolean));
      } else {
        setParsedShows(rows.map(rowToShow).filter(Boolean));
      }
    };
    reader.readAsText(file);
  };

  const handleImportStudents = async () => {
    if (!parsedStudents?.length) return;
    setImporting(true);
    let created = 0, updated = 0, failed = 0;
    const existing = await db.entities.Student.list('full_name', 2000);
    const existingMap = {};
    for (const s of existing) {
      existingMap[s.email?.toLowerCase().trim()] = s;
    }
    for (const student of parsedStudents) {
      const key = student.email?.toLowerCase().trim();
      const match = existingMap[key];
      try {
        if (match) {
          await db.entities.Student.update(match.id, student);
          updated++;
        } else {
          await db.entities.Student.create(student);
          created++;
        }
      } catch { failed++; }
    }
    setImporting(false);
    setResults({ created, updated, failed });
    toast({ title: `Students: ${created} created, ${updated} updated` });
  };

  const handleImport = async () => {
    if (!parsedShows?.length) return;
    setImporting(true);
    let created = 0, updated = 0, failed = 0;

    // Fetch all existing shows to match against
    const existing = await db.entities.Show.list('title', 2000);
    const existingMap = {};
    for (const s of existing) {
      const key = `${s.title?.toLowerCase().trim()}||${s.director_name?.toLowerCase().trim()}`;
      existingMap[key] = s;
    }

    for (const show of parsedShows) {
      const key = `${show.title?.toLowerCase().trim()}||${show.director_name?.toLowerCase().trim()}`;
      const match = existingMap[key];
      try {
        if (match) {
          // Only update fields that have values in the CSV (don't overwrite richer existing data with blanks)
          const patch = {};
          for (const [k, v] of Object.entries(show)) {
            if (v !== '' && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)) {
              patch[k] = v;
            }
          }
          await db.entities.Show.update(match.id, patch);
          updated++;
        } else {
          await db.entities.Show.create(show);
          created++;
        }
      } catch {
        failed++;
      }
    }

    setImporting(false);
    setResults({ created, updated, failed });
    toast({ title: `Import complete: ${created} created, ${updated} updated` });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Import from CSV"
        subtitle="Bulk-import or update shows and students from a CSV file."
      />

      {/* Mode switcher */}
      <div className="flex gap-2 mb-6">
        <Button variant={mode === 'shows' ? 'default' : 'outline'} onClick={() => { setMode('shows'); setResults(null); setParsedShows(null); setParsedStudents(null); }}>
          Import Shows
        </Button>
        <Button variant={mode === 'students' ? 'default' : 'outline'} onClick={() => { setMode('students'); setResults(null); setParsedShows(null); setParsedStudents(null); }}>
          Import Students
        </Button>
      </div>

      {mode === 'students' && (
        <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
          CSV must have columns: <strong>Name</strong> (or Full Name), <strong>Email</strong>. Optional: Phone, Skills (comma-separated), Skill Level, Bio.
        </div>
      )}

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div
            className="border-2 border-dashed border-border rounded-lg p-10 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium text-foreground">Click to upload your CSV</p>
            <p className="text-sm text-muted-foreground mt-1">{mode === 'shows' ? 'MasterFullShowList.csv' : 'students.csv'}</p>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          </div>
        </CardContent>
      </Card>

      {parsedShows && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Preview
              <Badge variant="outline">{parsedShows.length} shows found</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-72 overflow-y-auto space-y-2 mb-4">
              {parsedShows.slice(0, 100).map((s, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-border last:border-0 text-sm">
                  <div>
                    <span className="font-medium text-foreground">{s.title}</span>
                    <span className="text-muted-foreground ml-2">— {s.director_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <span>{s.theater}</span>
                    {s.opening_night && <span>{s.opening_night}</span>}
                  </div>
                </div>
              ))}
              {parsedShows.length > 100 && (
                <p className="text-sm text-muted-foreground text-center pt-2">
                  ...and {parsedShows.length - 100} more
                </p>
              )}
            </div>
            <Button onClick={handleImport} disabled={importing} className="w-full">
              {importing
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing...</>
                : <><Upload className="w-4 h-4 mr-2" />Import {parsedShows.length} Shows</>}
            </Button>
          </CardContent>
        </Card>
      )}

      {parsedStudents && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Preview
              <Badge variant="outline">{parsedStudents.length} students found</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-72 overflow-y-auto space-y-2 mb-4">
              {parsedStudents.slice(0, 100).map((s, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-border last:border-0 text-sm">
                  <span className="font-medium text-foreground">{s.full_name}</span>
                  <span className="text-muted-foreground text-xs">{s.email}</span>
                </div>
              ))}
            </div>
            <Button onClick={handleImportStudents} disabled={importing} className="w-full">
              {importing
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing...</>
                : <><Upload className="w-4 h-4 mr-2" />Import {parsedStudents.length} Students</>}
            </Button>
          </CardContent>
        </Card>
      )}

      {results && (
        <Card>
          <CardContent className="pt-6 space-y-2">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">{results.created} shows created, {results.updated} updated</span>
            </div>
            {results.failed > 0 && (
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="w-5 h-5" />
                <span>{results.failed} shows failed to import</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}