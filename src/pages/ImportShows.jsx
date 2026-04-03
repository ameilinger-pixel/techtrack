import { db } from '@/lib/backend/client';

import React, { useState, useRef } from 'react';

import { parseCSVRows } from '@/lib/csvParse';
import { parseShowCsvText } from '@/lib/showCsvImport';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, CheckCircle2, AlertCircle, Loader2, FileText } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/shared/PageHeader';

function formatDbError(e) {
  if (e == null) return '';
  if (typeof e === 'string') return e;
  const msg = e.message || e.msg || e.error_description;
  const details = e.details || e.hint;
  if (msg && details && String(details) !== String(msg)) return `${msg}: ${details}`;
  if (msg) return String(msg);
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

function rowToStudent(row) {
  const name = (row['Name'] || row['Full Name'] || row['full_name'] || '').trim();
  const email = (row['Email'] || row['email'] || '').trim();
  if (!name || !email) return null;
  return {
    full_name: name,
    email,
    phone: (row['Phone'] || row['phone'] || '').trim(),
    skills: (row['Skills'] || row['skills'] || '').split(/,|;/).map((s) => s.trim()).filter(Boolean),
    skill_level: ['beginner', 'intermediate', 'advanced'].includes(
      (row['Skill Level'] || row['skill_level'] || '').toLowerCase()
    )
      ? (row['Skill Level'] || row['skill_level']).toLowerCase()
      : 'beginner',
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
  const [showImportMeta, setShowImportMeta] = useState(null);
  const fileRef = useRef();
  const { toast } = useToast();

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setResults(null);
    setParsedShows(null);
    setParsedStudents(null);
    setShowImportMeta(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      if (mode === 'students') {
        const rows = parseCSVRows(text);
        const students = rows.map(rowToStudent).filter(Boolean);
        setParsedStudents(students);
        if (rows.length > 1 && students.length === 0) {
          toast({
            title: 'No student rows recognized',
            description: 'Expected columns like Name and Email. Check for UTF-8 CSV and header row.',
            variant: 'destructive',
          });
        }
      } else {
        const { shows, meta } = parseShowCsvText(text);
        setParsedShows(shows.length ? shows : null);
        setShowImportMeta({
          scannedRows: meta.scannedRows,
          skippedNoTitle: meta.skippedNoTitle,
          delimiter: meta.delimiter,
          headerRowIndex: meta.headerRowIndex,
          headerScore: meta.headerScore,
          titleRowCount: meta.titleRowCount,
          columnKeysSample: meta.columnKeysSample,
        });
        if (meta.scannedRows >= 1 && shows.length === 0) {
          const cols = meta.columnKeysSample.length
            ? `Columns seen: ${meta.columnKeysSample.join(', ')}.`
            : 'No data columns parsed.';
          toast({
            title: 'No show rows recognized',
            description: `${cols} Guessed header line: ${meta.headerRowIndex + 1}. Rows with a detected title: ${meta.titleRowCount ?? 0} (before date/filters). Export a .csv from Sheets/Excel (not .xlsx). If this is CSV UTF-8 from Excel, try “CSV UTF-8 (Comma delimited)”.`,
            variant: 'destructive',
          });
        } else if (shows.length > 0 && meta.skippedNoTitle > 0) {
          toast({
            title: `${shows.length} show${shows.length === 1 ? '' : 's'} ready to import`,
            description: `Skipped ${meta.skippedNoTitle} empty row${meta.skippedNoTitle === 1 ? '' : 's'} (no show title).`,
          });
        }
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImportStudents = async () => {
    if (!parsedStudents?.length) return;
    setImporting(true);
    let created = 0,
      updated = 0,
      failed = 0;
    let firstError = '';
    try {
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
        } catch (e) {
          failed++;
          if (!firstError) firstError = e?.message || String(e);
          console.error('[ImportStudents]', student.email, e);
        }
      }
    } catch (e) {
      firstError = e?.message || String(e);
      console.error('[ImportStudents] list failed', e);
      toast({ title: 'Import failed', description: firstError, variant: 'destructive' });
      setImporting(false);
      return;
    }
    setImporting(false);
    setResults({ kind: 'students', created, updated, failed, firstError });
    toast({
      title: `Students: ${created} created, ${updated} updated${failed ? `, ${failed} failed` : ''}`,
      ...(firstError && failed ? { description: firstError, variant: 'destructive' } : {}),
    });
  };

  const handleImport = async () => {
    if (!parsedShows?.length) {
      toast({
        title: 'Nothing to import',
        description: 'Upload a CSV first. If you already did, the file may have no recognizable show titles.',
        variant: 'destructive',
      });
      return;
    }
    const total = parsedShows.length;
    setImporting(true);
    let created = 0,
      updated = 0,
      failed = 0;
    let firstError = '';

    try {
      let existing;
      try {
        existing = await db.entities.Show.list('title', 5000);
      } catch (e) {
        console.error('[ImportShows] list failed', e);
        toast({
          title: 'Could not load existing shows',
          description: formatDbError(e),
          variant: 'destructive',
        });
        return;
      }

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
            const patch = {};
            for (const [k, v] of Object.entries(show)) {
              if (v !== '' && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)) {
                patch[k] = v;
              }
            }
            await db.entities.Show.update(match.id, patch);
            updated++;
          } else {
            const row = await db.entities.Show.create(show);
            created++;
            existingMap[key] = row;
          }
        } catch (e) {
          failed++;
          if (!firstError) firstError = formatDbError(e);
          console.error('[ImportShows] row failed', show.title, e);
        }
      }

      const saved = created + updated;
      const allFailed = failed === total && total > 0;
      setResults({ kind: 'shows', created, updated, failed, firstError, total });
      toast({
        title: allFailed
          ? `Import failed: 0 of ${total} rows saved`
          : `Import complete: ${created} created, ${updated} updated${failed ? `, ${failed} failed` : ''}`,
        description: firstError && failed ? firstError : undefined,
        variant: allFailed || (failed > 0 && saved === 0) ? 'destructive' : 'default',
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Import from CSV"
        subtitle="Bulk-import or update shows and students from a CSV file."
      />

      <div className="flex gap-2 mb-6">
        <Button
          variant={mode === 'shows' ? 'default' : 'outline'}
          onClick={() => {
            setMode('shows');
            setResults(null);
            setParsedShows(null);
            setParsedStudents(null);
            setShowImportMeta(null);
          }}
        >
          Import Shows
        </Button>
        <Button
          variant={mode === 'students' ? 'default' : 'outline'}
          onClick={() => {
            setMode('students');
            setResults(null);
            setParsedShows(null);
            setParsedStudents(null);
            setShowImportMeta(null);
          }}
        >
          Import Students
        </Button>
      </div>

      {mode === 'students' && (
        <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
          CSV must have columns: <strong>Name</strong> (or Full Name), <strong>Email</strong>. Optional: Phone, Skills
          (comma-separated), Skill Level, Bio.
        </div>
      )}
      {mode === 'shows' && (
        <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
          Supports <strong>Master Full Show List</strong> (<code className="text-xs">Show Name</code>, Director, tech
          columns) and <strong>NTPA Programming Spreadsheet</strong> (<code className="text-xs">Title</code>, Director,
          Location, etc.). Headers are matched case-insensitively. Tab- or comma-separated. Rows without a show title are
          skipped.
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
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
          </div>
        </CardContent>
      </Card>

      {parsedShows && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 flex-wrap">
              Preview
              <Badge variant="outline">{parsedShows.length} shows found</Badge>
            </CardTitle>
            {showImportMeta && showImportMeta.scannedRows > 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                Scanned {showImportMeta.scannedRows} data row{showImportMeta.scannedRows === 1 ? '' : 's'}
                {showImportMeta.skippedNoTitle > 0
                  ? ` · skipped ${showImportMeta.skippedNoTitle} blank row${showImportMeta.skippedNoTitle === 1 ? '' : 's'} (no show title)`
                  : ''}
                {showImportMeta.delimiter !== ',' ? ` · delimiter “${showImportMeta.delimiter === '\t' ? 'TAB' : showImportMeta.delimiter}”` : ''}
                {typeof showImportMeta.headerRowIndex === 'number'
                  ? ` · header line ${showImportMeta.headerRowIndex + 1}`
                  : ''}
                {typeof showImportMeta.titleRowCount === 'number'
                  ? ` · ${showImportMeta.titleRowCount} row${showImportMeta.titleRowCount === 1 ? '' : 's'} with title text`
                  : ''}
              </p>
            )}
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
                <p className="text-sm text-muted-foreground text-center pt-2">...and {parsedShows.length - 100} more</p>
              )}
            </div>
            <Button onClick={handleImport} disabled={importing} className="w-full">
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Import {parsedShows.length} Shows
                </>
              )}
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
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Import {parsedStudents.length} Students
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {results && (
        <Card
          className={
            results.failed > 0 || (results.kind === 'shows' && results.created + results.updated === 0 && results.total > 0)
              ? 'border-destructive/40 bg-destructive/5'
              : ''
          }
        >
          <CardContent className="pt-6 space-y-2">
            <div
              className={`flex items-center gap-2 ${
                results.failed > 0 || (results.kind === 'shows' && results.created + results.updated === 0 && results.total > 0)
                  ? 'text-destructive'
                  : 'text-emerald-700'
              }`}
            >
              {results.failed > 0 || (results.kind === 'shows' && results.created + results.updated === 0 && results.total > 0) ? (
                <AlertCircle className="w-5 h-5 shrink-0" />
              ) : (
                <CheckCircle2 className="w-5 h-5 shrink-0" />
              )}
              <span className="font-medium">
                {results.kind === 'students'
                  ? `${results.created} students created, ${results.updated} updated`
                  : `${results.created} shows created, ${results.updated} updated`}
                {results.kind === 'shows' && results.total > 0 && (
                  <span className="font-normal text-muted-foreground"> ({results.total} in preview)</span>
                )}
              </span>
            </div>
            {results.failed > 0 && (
              <div className="flex flex-col gap-1 text-red-600">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>
                    {results.failed} row{results.failed !== 1 ? 's' : ''} failed
                    {results.kind === 'students' ? '' : ' to import'}
                  </span>
                </div>
                {results.firstError && <p className="text-sm pl-7 text-red-700/90 break-words">{results.firstError}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
