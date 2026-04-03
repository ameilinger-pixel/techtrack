import { db } from '@/lib/backend/client';

import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import StatusBadge from '@/components/shared/StatusBadge';
import EmailPreviewModal from '@/components/shared/EmailPreviewModal';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

import { useToast } from '@/components/ui/use-toast';
import {
  parseTechnicians, formatDateDisplay, directorNtpaOrgEmail, saveShowWithRetry
} from '@/lib/showUtils';
import {
  Save, Trash2, Archive, RotateCcw, Upload, Plus, X,
  Loader2, Link as LinkIcon, Mail, Copy
} from 'lucide-react';

export default function ShowDetailModal({ show, open, onClose, onUpdated }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [emailModal, setEmailModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (show) {
      setForm({
        ...show,
        assigned_technicians: parseTechnicians(show),
      });
    }
  }, [show]);

  if (!show) return null;

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
  const portalUrl = `${window.location.origin}/director/show-portal?id=${show.id}`;

  const handleSave = async () => {
    setSaving(true);
    await saveShowWithRetry(db.entities.Show, show.id, form);
    toast({ title: 'Show saved' });
    onUpdated?.();
    setSaving(false);
    onClose();
  };

  const handleDelete = async () => {
    await db.entities.Show.delete(show.id);
    toast({ title: 'Show deleted' });
    onUpdated?.();
    onClose();
  };

  const handleArchive = async () => {
    await db.entities.Show.update(show.id, { status: 'archived' });
    toast({ title: 'Show archived' });
    onUpdated?.();
    onClose();
  };

  const handleRestore = async () => {
    await db.entities.Show.update(show.id, { status: 'upcoming' });
    toast({ title: 'Show restored' });
    onUpdated?.();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const { file_url } = await db.integrations.Core.UploadFile({ file });
    const newFiles = [...(form.show_files || []), { name: file.name, url: file_url, category: 'general' }];
    update('show_files', newFiles);
  };

  const removeFile = (idx) => {
    const newFiles = [...(form.show_files || [])];
    newFiles.splice(idx, 1);
    update('show_files', newFiles);
  };

  // Crew management
  const addCrewRow = () => {
    update('assigned_technicians', [
      ...(form.assigned_technicians || []),
      { name: '', email: '', role: '', payment_amount: 0, payment_status: 'pending' }
    ]);
  };

  const updateCrew = (idx, field, value) => {
    const crew = [...(form.assigned_technicians || [])];
    crew[idx] = { ...crew[idx], [field]: value };
    update('assigned_technicians', crew);
  };

  const removeCrew = (idx) => {
    const crew = [...(form.assigned_technicians || [])];
    crew.splice(idx, 1);
    update('assigned_technicians', crew);
  };

  // Workflow — cascade: marking a step fills all prior step dates too
  const today = new Date().toISOString().split('T')[0];

  const WORKFLOW_STEPS = [
    { status: 'awaiting_form',        dateField: 'director_contacted_date' },
    { status: 'needs_director_notify',dateField: 'student_outreach_date' },
    { status: 'posting_open',         dateField: 'posting_created_date' },
    { status: 'technician_assigned',  dateField: null },
  ];

  const advanceWorkflow = (newStatus, datefield) => {
    const targetIdx = WORKFLOW_STEPS.findIndex(s => s.status === newStatus);
    const updates = { workflow_status: newStatus };
    if (datefield) updates[datefield] = updates[datefield] || today;
    // Fill all preceding steps if not already set
    WORKFLOW_STEPS.slice(0, targetIdx).forEach(step => {
      if (step.dateField && !form[step.dateField]) updates[step.dateField] = today;
    });
    setForm(prev => ({ ...prev, ...updates }));
  };

  const DEFAULT_FROM = 'amelinger@ntpa.org';

  const sendDirectorContactEmail = () => {
    const directorFirst = (form.director_name || '').split(' ')[0] || 'Director';
    const techStart = form.tech_week_start ? formatDateDisplay(form.tech_week_start) : null;
    const techEnd = form.tech_week_end ? formatDateDisplay(form.tech_week_end) : null;
    const dateRange = techStart && techEnd ? `${techStart} – ${techEnd}` : techStart || '(dates TBD)';
    const theater = form.theater ? ` at ${form.theater}` : '';
    const portalLink = `${window.location.origin}/director/show-portal?id=${show.id}`;

    setEmailModal({
      from: DEFAULT_FROM,
      to: form.director_email || '',
      subject: `Tech support check-in — ${form.title}`,
      body: `Hi ${directorFirst},<br><br>Hope your rehearsals for <strong>${form.title}</strong> are going well! I'm reaching out for our standard 90-day check-in to get the ball rolling on tech support${theater}.<br><br>Tech week is currently scheduled for <strong>${dateRange}</strong>. As we get closer, I want to make sure we have everything lined up for you.<br><br>Could you take a few minutes to let me know:<br><ul><li>What technical support you're expecting to need (lighting, sound, projection, rigging, etc.)</li><li>Any changes to your tech week or performance schedule</li><li>Whether anything has changed since your original request</li></ul><br>You can also view your show details and upload any relevant files (light plots, cue sheets, etc.) through your director portal:<br><a href="${portalLink}">${portalLink}</a><br><br>Let me know if you have any questions — happy to help!<br><br>Best,<br>TechTrack / NTPA`,
    });
    advanceWorkflow('awaiting_form', 'director_contacted_date');
  };

  const sendNotifyDirectorEmail = () => {
    const directorFirst = (form.director_name || '').split(' ')[0] || 'Director';
    const techStart = form.tech_week_start ? formatDateDisplay(form.tech_week_start) : null;
    const techEnd = form.tech_week_end ? formatDateDisplay(form.tech_week_end) : null;
    const dateRange = techStart && techEnd ? `${techStart} – ${techEnd}` : techStart || '(dates TBD)';
    const appLink = form.application_link_url || null;

    setEmailModal({
      from: DEFAULT_FROM,
      to: form.director_email || '',
      subject: `Tech assignment update — ${form.title}`,
      body: `Hi ${directorFirst},<br><br>I wanted to give you a quick update on the tech support situation for <strong>${form.title}</strong> (tech week: <strong>${dateRange}</strong>).<br><br>We have an open application posted for a technician and are actively working to find the right match for your show. ${appLink ? `Students can apply here: <a href="${appLink}">${appLink}</a><br><br>` : ''}As soon as someone is confirmed, I'll reach out right away to introduce you and get the conversation started.<br><br>In the meantime, if anything has changed about your schedule or technical needs, please let me know so I can update the posting.<br><br>Thanks for your patience — we're on it!<br><br>Best,<br>TechTrack / NTPA`,
    });
    advanceWorkflow('needs_director_notify', 'director_notified_date');
  };

  const sendIntroEmail = () => {
    const crew = form.assigned_technicians || [];
    const primaryTech = crew[0];
    if (!primaryTech) return;
    const ntpaEmail = directorNtpaOrgEmail(form.director_name);
    const directorTo = ntpaEmail || (form.director_email || '').trim();
    const toEmails = [directorTo, primaryTech.email].filter(Boolean).join(', ');
    const directorFirst = (form.director_name || '').split(' ')[0];
    const technicianFull = primaryTech.name || '';
    const technicianFirst = technicianFull.split(' ')[0];
    const role = primaryTech.role || 'technician';
    const crewExtra = crew.length > 1
      ? `<br><br><em>Note: ${crew.length} technicians are listed on this show; this message introduces the primary contact (${technicianFull}).</em>`
      : '';
    setEmailModal({
      from: DEFAULT_FROM,
      to: toEmails,
      subject: `[${form.title}] tech assignment`,
      body: `Hi ${directorFirst},<br><br>I am connecting you with technician ${technicianFull}, who has offered to take the position of ${role} for ${form.title}.${crewExtra}<br><br>Remember to set a date with each other to watch a run and discuss your needs and any conflicts. I will then give ${directorFirst} our new Crew Assignment sheet for ${technicianFirst} to obtain signatures on each day they are there.<br><br>Let me know if y'all need anything :)`,
    });
    setForm(prev => ({ ...prev, assignment_email_sent: true, workflow_status: 'technician_assigned' }));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <DialogTitle className="text-xl">{show.title}</DialogTitle>
              <StatusBadge status={form.workflow_status || form.status} />
            </div>
          </DialogHeader>

          {/* Quick Actions bar */}
          {(() => {
            const ws = form.workflow_status;
            const hasCrew = (form.assigned_technicians || []).length > 0;
            const actions = [];
            if (!form.director_contacted_date)
              actions.push({ label: '📧 Email Director', fn: sendDirectorContactEmail });
            if (form.director_contacted_date && !form.posting_created_date)
              actions.push({ label: '📋 Mark App Posted', fn: () => advanceWorkflow('posting_open', 'posting_created_date') });
            if (form.posting_created_date && !form.director_notified_date)
              actions.push({ label: '📣 Notify Director', fn: sendNotifyDirectorEmail });
            if (hasCrew && !form.assignment_email_sent)
              actions.push({ label: '🤝 Send Intro Email', fn: sendIntroEmail });
            if (actions.length === 0 && hasCrew)
              actions.push({ label: '✅ All steps done', fn: null });
            return actions.length > 0 ? (
              <div className="flex flex-wrap gap-2 py-2 px-1 mb-1 bg-accent/40 rounded-lg">
                <span className="text-xs font-semibold text-muted-foreground self-center mr-1">Next:</span>
                {actions.map((a, i) => a.fn ? (
                  <Button key={i} size="sm" variant="secondary" className="text-xs h-7" onClick={a.fn}>{a.label}</Button>
                ) : (
                  <span key={i} className="text-xs text-emerald-600 font-medium self-center">{a.label}</span>
                ))}
              </div>
            ) : null;
          })()}

          <Tabs defaultValue="details" className="mt-2">
            <TabsList className="w-full grid grid-cols-6">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="files">Files</TabsTrigger>
              <TabsTrigger value="equipment">Equipment</TabsTrigger>
              <TabsTrigger value="workflow">Workflow</TabsTrigger>
              <TabsTrigger value="assignment">Assignment</TabsTrigger>
              <TabsTrigger value="checklist">Checklist</TabsTrigger>
            </TabsList>

            {/* Details Tab */}
            <TabsContent value="details" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Status</Label><Select value={form.status} onValueChange={v => update('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['upcoming','in_progress','completed','archived'].map(s => <SelectItem key={s} value={s}>{s.replace(/_/g,' ')}</SelectItem>)}
                  </SelectContent>
                </Select></div>
                <div><Label>Theater</Label><Input value={form.theater||''} onChange={e => update('theater', e.target.value)} /></div>
                <div><Label>Director</Label><Input value={form.director_name||''} onChange={e => update('director_name', e.target.value)} /></div>
                <div><Label>Director Email</Label><Input value={form.director_email||''} onChange={e => update('director_email', e.target.value)} /></div>
                <div><Label>Tech Week Start</Label><Input type="date" value={form.tech_week_start||''} onChange={e => update('tech_week_start', e.target.value)} /></div>
                <div><Label>Tech Week End</Label><Input type="date" value={form.tech_week_end||''} onChange={e => update('tech_week_end', e.target.value)} /></div>
              </div>
              <div>
                <Label>Director Portal URL</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={portalUrl} readOnly className="text-xs" />
                  <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(portalUrl); toast({ title: 'Copied' }); }}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div><Label>Notes</Label><Textarea value={form.notes||''} onChange={e => update('notes', e.target.value)} rows={3} /></div>
            </TabsContent>

            {/* Files Tab */}
            <TabsContent value="files" className="space-y-4 mt-4">
              <div className="flex items-center gap-2">
                <label className="cursor-pointer">
                  <input type="file" className="hidden" onChange={handleFileUpload} />
                  <Button variant="outline" size="sm" asChild><span><Upload className="w-4 h-4 mr-1" />Upload File</span></Button>
                </label>
              </div>
              <div>
                <Label>Application Link URL</Label>
                <Input value={form.application_link_url||''} onChange={e => update('application_link_url', e.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-2">
                {(form.show_files || []).map((f, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 min-w-0">
                      <LinkIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <a href={f.url} target="_blank" rel="noopener" className="text-sm text-primary truncate hover:underline">{f.name}</a>
                      <Select value={f.category||'general'} onValueChange={v => {
                        const files = [...(form.show_files || [])];
                        files[i] = { ...files[i], category: v };
                        update('show_files', files);
                      }}>
                        <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['general','application','application_link','contract','schedule','tech_rider'].map(c =>
                            <SelectItem key={c} value={c}>{c.replace(/_/g,' ')}</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeFile(i)}><X className="w-3 h-3" /></Button>
                  </div>
                ))}
                {(!form.show_files || form.show_files.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">No files uploaded</p>
                )}
              </div>
            </TabsContent>

            {/* Equipment Tab */}
            <TabsContent value="equipment" className="space-y-4 mt-4">
              <div className="flex flex-wrap gap-4">
                {[{ k: 'needs_lighting', l: 'Lighting' },{ k: 'needs_sound', l: 'Sound' },{ k: 'needs_projection', l: 'Projection' },{ k: 'needs_rigging', l: 'Rigging' }].map(eq => (
                  <label key={eq.k} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form[eq.k]||false} onCheckedChange={v => update(eq.k, v)} />{eq.l}
                  </label>
                ))}
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={form.equipment_reserved||false} onCheckedChange={v => update('equipment_reserved', v)} />Equipment Reserved
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={form.equipment_returned||false} onCheckedChange={v => update('equipment_returned', v)} />Equipment Returned
                </label>
              </div>
              <div><Label>Equipment Notes</Label><Textarea value={form.equipment_needs||''} onChange={e => update('equipment_needs', e.target.value)} rows={3} /></div>
            </TabsContent>

            {/* Workflow Tab */}
            <TabsContent value="workflow" className="space-y-4 mt-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <div><p className="text-sm font-medium">1. Contact Director</p><p className="text-xs text-muted-foreground">Contacted: {formatDateDisplay(form.director_contacted_date)}</p></div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={sendDirectorContactEmail}>
                      <Mail className="w-4 h-4 mr-1" />Email & Mark
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => advanceWorkflow('awaiting_form', 'director_contacted_date')}>
                      Log Only
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <div><p className="text-sm font-medium">2. Student Outreach</p><p className="text-xs text-muted-foreground">Outreach: {formatDateDisplay(form.student_outreach_date)}</p></div>
                  <Button size="sm" variant="outline" onClick={() => advanceWorkflow('needs_director_notify', 'student_outreach_date')}>
                    Mark Outreach Done
                  </Button>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <div><p className="text-sm font-medium">3. Application Posted</p><p className="text-xs text-muted-foreground">Posted: {formatDateDisplay(form.posting_created_date)}</p></div>
                  <Button size="sm" variant="outline" onClick={() => advanceWorkflow('posting_open', 'posting_created_date')}>
                    Mark Posted
                  </Button>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <div><p className="text-sm font-medium">4. Notify Director</p><p className="text-xs text-muted-foreground">Notified: {formatDateDisplay(form.director_notified_date)}</p></div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={sendNotifyDirectorEmail}>
                      <Mail className="w-4 h-4 mr-1" />Email & Mark
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => advanceWorkflow('needs_director_notify', 'director_notified_date')}>
                      Log Only
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <div><p className="text-sm font-medium">5. Assignment Intro Email</p></div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={sendIntroEmail} disabled={!form.assigned_technicians?.length}>
                      <Mail className="w-4 h-4 mr-1" />Send Intro
                    </Button>
                    <Button size="sm" variant="ghost" disabled={!form.assigned_technicians?.length} onClick={() => {
                      setForm(prev => ({ ...prev, assignment_email_sent: true, workflow_status: 'technician_assigned' }));
                    }}>
                      Log Only
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={form.tech_support_declined||false} onCheckedChange={v => update('tech_support_declined', v)} />
                <Label>Tech Support Declined</Label>
              </div>
            </TabsContent>

            {/* Assignment Tab */}
            <TabsContent value="assignment" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Crew</h3>
                <Button size="sm" variant="outline" onClick={addCrewRow}><Plus className="w-4 h-4 mr-1" />Add</Button>
              </div>
              {(form.assigned_technicians || []).map((tech, i) => (
                <div key={i} className="grid grid-cols-5 gap-2 items-end p-3 bg-muted rounded-lg">
                  <div><Label className="text-xs">Name</Label><Input value={tech.name||''} onChange={e => updateCrew(i, 'name', e.target.value)} className="h-8 text-sm" /></div>
                  <div><Label className="text-xs">Email</Label><Input value={tech.email||''} onChange={e => updateCrew(i, 'email', e.target.value)} className="h-8 text-sm" /></div>
                  <div><Label className="text-xs">Role</Label><Input value={tech.role||''} onChange={e => updateCrew(i, 'role', e.target.value)} className="h-8 text-sm" /></div>
                  <div><Label className="text-xs">Payment</Label><Input type="number" value={tech.payment_amount||''} onChange={e => updateCrew(i, 'payment_amount', parseFloat(e.target.value)||0)} className="h-8 text-sm" /></div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeCrew(i)}><X className="w-4 h-4" /></Button>
                </div>
              ))}
              {(!form.assigned_technicians || form.assigned_technicians.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">No crew assigned yet</p>
              )}
            </TabsContent>

            {/* Checklist Tab */}
            <TabsContent value="checklist" className="space-y-3 mt-4">
              {(() => {
                const today = new Date().toISOString().split('T')[0];

                // Each step: what fields to set when checked (cascade all prior steps too)
                const cascade = (stepIndex) => {
                  const updates = {};
                  if (stepIndex >= 0) updates.director_contacted_date = form.director_contacted_date || today;
                  if (stepIndex >= 1) updates.director_notified_date = form.director_notified_date || today;
                  if (stepIndex >= 2) updates.posting_created_date = form.posting_created_date || today;
                  if (stepIndex >= 4) updates.assignment_email_sent = true;
                  if (stepIndex >= 5) updates.crew_sheet_sent = true;
                  if (stepIndex >= 6) updates.crew_sheet_returned = true;
                  if (stepIndex >= 7) updates.technician_paid = true;
                  setForm(prev => ({ ...prev, ...updates }));
                };

                const uncascade = (stepIndex) => {
                  const updates = {};
                  if (stepIndex <= 0) updates.director_contacted_date = null;
                  if (stepIndex <= 1) updates.director_notified_date = null;
                  if (stepIndex <= 2) updates.posting_created_date = null;
                  if (stepIndex <= 4) updates.assignment_email_sent = false;
                  if (stepIndex <= 5) updates.crew_sheet_sent = false;
                  if (stepIndex <= 6) updates.crew_sheet_returned = false;
                  if (stepIndex <= 7) updates.technician_paid = false;
                  setForm(prev => ({ ...prev, ...updates }));
                };

                return (
                  <>
                    <ToggleCheckItem label="Director contacted" checked={!!form.director_contacted_date}
                      onChange={v => v ? cascade(0) : uncascade(0)} />
                    <ToggleCheckItem label="Director notified" checked={!!form.director_notified_date}
                      onChange={v => v ? cascade(1) : uncascade(1)} />
                    <ToggleCheckItem label="Application posted" checked={!!form.posting_created_date}
                      onChange={v => v ? cascade(2) : uncascade(2)} />
                    <CheckItem label="Crew assigned" checked={(form.assigned_technicians||[]).length > 0} />
                    <CheckItem label="Equipment reserved" checked={!!form.equipment_reserved} />
                    <ToggleCheckItem label="Assignment email sent" checked={!!form.assignment_email_sent}
                      onChange={v => v ? cascade(4) : uncascade(4)} />
                    <ToggleCheckItem label="Crew sheet sent" checked={!!form.crew_sheet_sent}
                      onChange={v => v ? cascade(5) : uncascade(5)} />
                    <ToggleCheckItem label="Crew sheet returned" checked={!!form.crew_sheet_returned}
                      onChange={v => v ? cascade(6) : uncascade(6)} />
                    <ToggleCheckItem label="Technician paid" checked={!!form.technician_paid}
                      onChange={v => v ? cascade(7) : uncascade(7)} />
                  </>
                );
              })()}
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex gap-2">
              {show.status === 'archived' ? (
                <Button variant="outline" size="sm" onClick={handleRestore}><RotateCcw className="w-4 h-4 mr-1" />Restore</Button>
              ) : (
                <Button variant="outline" size="sm" onClick={handleArchive}><Archive className="w-4 h-4 mr-1" />Archive</Button>
              )}
              <Button variant="outline" size="sm" className="text-destructive" onClick={() => setConfirmDelete(true)}><Trash2 className="w-4 h-4 mr-1" />Delete</Button>
            </div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {emailModal && (
        <EmailPreviewModal
          open={!!emailModal}
          onClose={() => setEmailModal(null)}
          initialFrom={emailModal.from}
          initialTo={emailModal.to}
          initialSubject={emailModal.subject}
          initialBody={emailModal.body}
        />
      )}
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete Show?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        destructive
      />
    </>
  );
}

function CheckItem({ label, checked }) {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted">
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${checked ? 'bg-primary border-primary' : 'border-muted-foreground'}`}>
        {checked && <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
      </div>
      <span className={`text-sm ${checked ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
    </div>
  );
}

function ToggleCheckItem({ label, checked, onChange }) {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted cursor-pointer" onClick={() => onChange(!checked)}>
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${checked ? 'bg-primary border-primary' : 'border-muted-foreground hover:border-primary'}`}>
        {checked && <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
      </div>
      <span className={`text-sm select-none ${checked ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
    </div>
  );
}