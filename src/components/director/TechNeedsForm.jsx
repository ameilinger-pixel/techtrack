import { db } from '@/lib/backend/client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle, ClipboardList } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const ROLES = ['Lighting Designer', 'Sound Designer', 'Spotlight Operator', 'Board Operator', 'Stage Manager', 'Projection Operator', 'Other'];

export default function TechNeedsForm({ user, onSubmitted, initialShow = null }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [draftId, setDraftId] = useState(null);
  const autosaveRef = useRef(null);
  const [form, setForm] = useState({
    show_title: initialShow?.title || '',
    theater: initialShow?.theater || '',
    tech_week_start: initialShow?.tech_week_start || '',
    tech_week_end: initialShow?.tech_week_end || '',
    opening_night: initialShow?.opening_night || '',
    show_dates: initialShow?.show_dates || '',
    rehearsal_schedule: '',
    tech_week_schedule: '',
    tech_needs_description: '',
    roles_needed: [],
    skill_level: 'any',
    needs_lighting: false,
    needs_sound: false,
    needs_projection: false,
    needs_rigging: false,
    shadow_opportunity: false,
    notes: '',
  });
  const hasMeaningfulInput = useMemo(() => {
    const truthyScalar = (val) => {
      if (typeof val === 'string') return val.trim().length > 0;
      return !!val;
    };
    return Object.entries(form).some(([key, value]) => {
      if (key === 'status' || key === 'policy_acknowledged') return false;
      if (Array.isArray(value)) return value.length > 0;
      return truthyScalar(value);
    });
  }, [form]);

  const set = (field, value) => setForm(p => ({ ...p, [field]: value }));

  const { data: existingDrafts = [] } = useQuery({
    queryKey: ['director-tech-drafts', user?.email],
    queryFn: () => db.entities.TechAssignment.filter({ director_email: user?.email, status: 'draft' }),
    enabled: !!user?.email,
  });

  useEffect(() => {
    if (!existingDrafts.length) return;
    const byShow = existingDrafts.find((d) => d.show_title?.trim().toLowerCase() === (initialShow?.title || '').trim().toLowerCase());
    const draft = byShow || existingDrafts[0];
    setDraftId(draft.id);
    setForm((prev) => ({ ...prev, ...draft }));
    if (draft.director_portal_last_saved_at) setDraftSavedAt(draft.director_portal_last_saved_at);
  }, [existingDrafts, initialShow?.title]);

  const updateRelatedShow = async (patch) => {
    if (!user?.email || !form.show_title?.trim()) return;
    const shows = await db.entities.Show.filter({ director_email: user.email });
    const matching = shows.find((s) => (s.title || '').trim().toLowerCase() === form.show_title.trim().toLowerCase());
    if (!matching?.id) return;
    await db.entities.Show.update(matching.id, patch);
  };

  const saveDraft = async () => {
    if (!hasMeaningfulInput || !user?.email) return;
    try {
      setDraftSaving(true);
      const nowIso = new Date().toISOString();
      const payload = {
        ...form,
        director_name: user?.full_name || '',
        director_email: user?.email || '',
        status: 'draft',
        director_portal_last_saved_at: nowIso,
      };
      let savedDraft;
      if (draftId) {
        savedDraft = await db.entities.TechAssignment.update(draftId, payload);
      } else {
        savedDraft = await db.entities.TechAssignment.create(payload);
        setDraftId(savedDraft.id);
      }
      setDraftSavedAt(nowIso);
      try {
        await updateRelatedShow({ director_portal_last_saved_at: nowIso });
      } catch (err) {
        console.warn('[TechNeedsForm.saveDraft] show timestamp update skipped', err);
      }
      try {
        await db.activity.log({
          event_type: 'director_form_saved',
          source: 'director_portal',
          actor_id: user?.id || user?.email || null,
          actor_role: 'director',
          assignment_id: savedDraft?.id || draftId,
          summary: `Director draft saved for ${form.show_title || 'untitled show'}`,
          metadata: { show_title: form.show_title || null },
        });
      } catch (err) {
        console.warn('[TechNeedsForm.saveDraft] activity log skipped', err);
      }
      try {
        await queryClient.invalidateQueries({ queryKey: ['director-tech-drafts', user?.email] });
        await queryClient.invalidateQueries({ queryKey: ['director-portal-shows'] });
      } catch (err) {
        console.warn('[TechNeedsForm.saveDraft] query refresh skipped', err);
      }
    } catch (err) {
      console.error('[TechNeedsForm.saveDraft]', err);
      toast({
        title: 'Draft save failed',
        description: String(err?.message || err),
        variant: 'destructive',
      });
    } finally {
      setDraftSaving(false);
    }
  };

  useEffect(() => {
    if (!hasMeaningfulInput) return;
    if (autosaveRef.current) clearTimeout(autosaveRef.current);
    autosaveRef.current = setTimeout(() => { void saveDraft(); }, 1200);
    return () => {
      if (autosaveRef.current) clearTimeout(autosaveRef.current);
    };
  }, [form, hasMeaningfulInput]);

  const toggleRole = (role) => {
    setForm(p => ({
      ...p,
      roles_needed: p.roles_needed.includes(role)
        ? p.roles_needed.filter(r => r !== role)
        : [...p.roles_needed, role]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.show_title.trim()) {
      toast({ title: 'Show title is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      director_name: user?.full_name || '',
      director_email: user?.email || '',
      status: 'pending_admin_approval',
      policy_acknowledged: true,
      director_portal_last_submitted_at: new Date().toISOString(),
    };
    let result;
    if (draftId) {
      result = await db.entities.TechAssignment.update(draftId, payload);
    } else {
      result = await db.entities.TechAssignment.create(payload);
    }
    await updateRelatedShow({ director_portal_last_submitted_at: payload.director_portal_last_submitted_at });
    await db.activity.log({
      event_type: 'director_form_submitted',
      source: 'director_portal',
      actor_id: user?.id || user?.email || null,
      actor_role: 'director',
      assignment_id: result?.id || draftId,
      summary: `Director submitted tech form for ${form.show_title || 'untitled show'}`,
      metadata: { show_title: form.show_title || null },
    });
    toast({ title: 'Form submitted!', description: "We'll review your request and be in touch." });
    setSaving(false);
    setSubmitted(true);
    onSubmitted?.();
  };

  if (submitted) {
    return (
      <Card>
        <CardContent className="pt-10 pb-10 text-center">
          <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-card-foreground">Form Submitted!</h3>
          <p className="text-muted-foreground mt-2 text-sm max-w-sm mx-auto">
            Thank you! We'll review your tech needs and follow up soon.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-2 mb-2">
        <ClipboardList className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold text-card-foreground">Director Tech Request</h2>
      </div>
      <div className="text-xs text-muted-foreground flex items-center gap-2">
        {draftSaving ? 'Saving draft…' : draftSavedAt ? `Draft saved ${new Date(draftSavedAt).toLocaleString()}` : 'Draft autosaves while you type'}
      </div>
      <div>
        <Button type="button" variant="outline" size="sm" onClick={() => void saveDraft()} disabled={draftSaving || !hasMeaningfulInput}>
          Save Draft Now
        </Button>
      </div>

      {/* Show Info */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Show Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Show Title <span className="text-destructive">*</span></Label>
              <Input value={form.show_title} onChange={e => set('show_title', e.target.value)} placeholder="e.g. Into the Woods" />
            </div>
            <div className="space-y-1.5">
              <Label>Theater / Venue</Label>
              <Input value={form.theater} onChange={e => set('theater', e.target.value)} placeholder="e.g. Main Stage" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Schedule */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Schedule</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tech Week Start</Label>
              <Input type="date" value={form.tech_week_start} onChange={e => set('tech_week_start', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Tech Week End</Label>
              <Input type="date" value={form.tech_week_end} onChange={e => set('tech_week_end', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Opening Night</Label>
              <Input type="date" value={form.opening_night} onChange={e => set('opening_night', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Show / Performance Dates</Label>
            <Input value={form.show_dates} onChange={e => set('show_dates', e.target.value)} placeholder="e.g. March 12 7pm, March 13 7pm, March 14 2pm & 7pm" />
          </div>
          <div className="space-y-1.5">
            <Label>Rehearsal Schedule</Label>
            <Textarea value={form.rehearsal_schedule} onChange={e => set('rehearsal_schedule', e.target.value)} placeholder="Dates, times, and location of rehearsals" rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Tech Week Schedule</Label>
            <Textarea value={form.tech_week_schedule} onChange={e => set('tech_week_schedule', e.target.value)} placeholder="Dates, times, and location for tech week" rows={2} />
          </div>
        </CardContent>
      </Card>

      {/* Tech Needs */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Tech Needs</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Roles Needed</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {ROLES.map(role => (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggleRole(role)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    form.roles_needed.includes(role)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-foreground border-border hover:bg-muted'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Equipment Needs</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {[
                { key: 'needs_lighting', label: 'Lighting' },
                { key: 'needs_sound', label: 'Sound' },
                { key: 'needs_projection', label: 'Projection' },
                { key: 'needs_rigging', label: 'Rigging' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={form[key]} onCheckedChange={v => set(key, !!v)} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Skill Level Preference</Label>
            <Select value={form.skill_level} onValueChange={v => set('skill_level', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any Level</SelectItem>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Additional Tech Details</Label>
            <Textarea
              value={form.tech_needs_description}
              onChange={e => set('tech_needs_description', e.target.value)}
              placeholder="Describe any specific equipment, fixtures, or requirements..."
              rows={3}
            />
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={form.shadow_opportunity} onCheckedChange={v => set('shadow_opportunity', !!v)} />
            This show has a shadow/observation opportunity for students
          </label>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardContent className="pt-5 space-y-1.5">
          <Label>Any other notes or questions for Alayna?</Label>
          <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Anything else we should know..." rows={3} />
        </CardContent>
      </Card>

      <Button type="submit" className="w-full" size="lg" disabled={saving}>
        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
        Submit Director Tech Request
      </Button>
    </form>
  );
}