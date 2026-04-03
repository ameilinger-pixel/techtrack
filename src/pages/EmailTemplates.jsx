import { db } from '@/lib/backend/client';

import React, { useState, useRef } from 'react';

import { parseCSVRows } from '@/lib/csvParse';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Mail, ToggleLeft, ToggleRight, Upload, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import EmptyState from '@/components/shared/EmptyState';

const TRIGGER_LABELS = {
  technician_assigned: 'Technician Assigned',
  no_tech_90_days: 'No Tech ~90 Days Before Show',
  no_tech_30_days: 'No Tech 30 Days Before Show',
  crew_form_overdue: 'Crew Assignment Form Overdue',
};

const TRIGGER_COLORS = {
  technician_assigned: 'bg-green-50 text-green-700 border-green-200',
  no_tech_90_days: 'bg-sky-50 text-sky-800 border-sky-200',
  no_tech_30_days: 'bg-amber-50 text-amber-700 border-amber-200',
  crew_form_overdue: 'bg-red-50 text-red-700 border-red-200',
};

const VALID_TRIGGERS = new Set(Object.keys(TRIGGER_LABELS));

/** Base44 / export CSV columns: name, recipient, active, trigger, body, subject, ... */
function rowToEmailTemplate(row) {
  const name = (row.name || '').trim();
  const subject = (row.subject || '').trim();
  const body = (row.body || '').trim();
  const trigger = (row.trigger || '').trim();
  let recipient = (row.recipient || 'director').trim().toLowerCase();
  if (recipient !== 'student') recipient = 'director';
  const av = row.active;
  const active = av === true || String(av).toLowerCase() === 'true';
  if (!name || !subject || !body || !trigger || !VALID_TRIGGERS.has(trigger)) return null;
  return { name, subject, body, trigger, recipient, active };
}

const PLACEHOLDER_HINT =
  '{{show_title}}, {{director_name}}, {{director_first_name}}, {{student_name}}, {{technician_first_name}}, {{tech_role}}, {{tech_week_start}}, {{days_until_tech}}, {{theater}}, {{troupe}}, {{tech_needs_form_url}}';

const BLANK = { name: '', trigger: 'technician_assigned', recipient: 'director', subject: '', body: '', active: true };

export default function EmailTemplates() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [modal, setModal] = useState(null); // null | 'new' | template object
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const csvInputRef = useRef(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['email-templates'],
    queryFn: () => db.entities.EmailTemplate.list(),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['email-templates'] });

  const openNew = () => { setForm(BLANK); setModal('new'); };
  const openEdit = (t) => { setForm({ ...t }); setModal(t); };

  const handleSave = async () => {
    if (!form.name || !form.subject || !form.body) {
      toast({ title: 'Please fill in all required fields.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    if (modal === 'new') {
      await db.entities.EmailTemplate.create(form);
      toast({ title: 'Template created' });
    } else {
      await db.entities.EmailTemplate.update(modal.id, form);
      toast({ title: 'Template saved' });
    }
    refresh();
    setModal(null);
    setSaving(false);
  };

  const handleDelete = async (t) => {
    await db.entities.EmailTemplate.delete(t.id);
    toast({ title: 'Template deleted' });
    refresh();
  };

  const handleToggle = async (t) => {
    await db.entities.EmailTemplate.update(t.id, { active: !t.active });
    refresh();
  };

  const handleEmailTemplateCsv = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const inputEl = e.target;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        setCsvImporting(true);
        const rows = parseCSVRows(ev.target.result);
        const parsed = rows.map(rowToEmailTemplate).filter(Boolean);
        if (parsed.length === 0) {
          toast({
            title: 'No valid template rows',
            description:
              'Expected columns: name, recipient, active, trigger, body, subject (e.g. Base44 EmailTemplate_export.csv).',
            variant: 'destructive',
          });
          return;
        }
        const existing = await db.entities.EmailTemplate.list();
        const byTrigger = {};
        for (const t of existing) {
          byTrigger[t.trigger] = t;
        }
        let created = 0;
        let updated = 0;
        let failed = 0;
        for (const t of parsed) {
          try {
            const match = byTrigger[t.trigger];
            if (match) {
              await db.entities.EmailTemplate.update(match.id, t);
              updated++;
            } else {
              const row = await db.entities.EmailTemplate.create(t);
              byTrigger[t.trigger] = row;
              created++;
            }
          } catch {
            failed++;
          }
        }
        if (failed && !created && !updated) {
          toast({
            title: 'Template import failed',
            description: 'Check the browser console or try again.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: `Templates: ${created} created, ${updated} updated${failed ? `, ${failed} failed` : ''}`,
          });
        }
        refresh();
      } catch (err) {
        toast({
          title: 'CSV import failed',
          description: err?.message || String(err),
          variant: 'destructive',
        });
      } finally {
        setCsvImporting(false);
        inputEl.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div>
      <PageHeader title="Email Templates" subtitle="Configure automated email notifications">
        <div className="flex flex-wrap gap-2">
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleEmailTemplateCsv}
          />
          <Button
            type="button"
            variant="outline"
            disabled={csvImporting}
            onClick={() => csvInputRef.current?.click()}
          >
            {csvImporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            Import CSV
          </Button>
          <Button type="button" onClick={openNew}>
            <Plus className="w-4 h-4 mr-2" />
            New Template
          </Button>
        </div>
      </PageHeader>

      <div className="mb-4 p-3 rounded-lg bg-accent border text-sm text-accent-foreground">
        <strong>Available placeholders:</strong> {PLACEHOLDER_HINT}
        <span className="block mt-1 text-muted-foreground">
          Import matches your Base44 export: same row updates an existing template with the same <code className="text-xs">trigger</code>.
        </span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No templates yet"
          description="The database has no rows in email_templates yet. Apply the Supabase migration supabase/migrations/20260402160000_seed_email_templates.sql (Supabase Dashboard → SQL → paste file), or use New Template / Import CSV."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map(t => (
            <Card key={t.id} className={!t.active ? 'opacity-50' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">To: {t.recipient}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => handleToggle(t)} title={t.active ? 'Disable' : 'Enable'}>
                      {t.active ? <ToggleRight className="w-4 h-4 text-green-600" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(t)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${TRIGGER_COLORS[t.trigger] || 'bg-gray-50 text-gray-700'}`}>
                  {TRIGGER_LABELS[t.trigger] || t.trigger}
                </span>
                <p className="text-sm font-medium truncate">{t.subject}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{t.body.replace(/<[^>]*>/g, ' ')}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!modal} onOpenChange={open => !open && setModal(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{modal === 'new' ? 'New Email Template' : 'Edit Template'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Template Name <span className="text-red-500">*</span></Label>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Tech Assigned - Director" />
              </div>
              <div className="space-y-1">
                <Label>Trigger <span className="text-red-500">*</span></Label>
                <Select value={form.trigger} onValueChange={v => setForm(p => ({ ...p, trigger: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRIGGER_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Send To</Label>
              <Select value={form.recipient} onValueChange={v => setForm(p => ({ ...p, recipient: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="director">Director</SelectItem>
                  <SelectItem value="student">Assigned Student</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Subject <span className="text-red-500">*</span></Label>
              <Input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} placeholder="e.g. Technician Assigned for {{show_title}}" />
            </div>
            <div className="space-y-1">
              <Label>Body <span className="text-red-500">*</span></Label>
              <p className="text-xs text-muted-foreground">Supports HTML. Placeholders: {PLACEHOLDER_HINT}</p>
              <Textarea value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} className="h-48 font-mono text-sm" placeholder="Hi {{director_name}},&#10;&#10;A technician has been assigned to {{show_title}}..." />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Template'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}