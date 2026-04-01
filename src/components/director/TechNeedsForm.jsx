import { db } from '@/lib/backend/client';

import React, { useState } from 'react';

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

export default function TechNeedsForm({ user, onSubmitted }) {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    show_title: '',
    theater: '',
    tech_week_start: '',
    tech_week_end: '',
    opening_night: '',
    show_dates: '',
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

  const set = (field, value) => setForm(p => ({ ...p, [field]: value }));

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
    await db.entities.TechAssignment.create({
      ...form,
      director_name: user?.full_name || '',
      director_email: user?.email || '',
      status: 'pending_admin_approval',
      policy_acknowledged: true,
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
        <h2 className="text-xl font-bold text-card-foreground">Tech Needs Form</h2>
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
        Submit Tech Needs Form
      </Button>
    </form>
  );
}