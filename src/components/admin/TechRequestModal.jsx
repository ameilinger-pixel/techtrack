import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

const ROLES = ['Lighting Designer', 'Sound Designer', 'Stage Manager', 'Board Operator', 'Spotlight Operator', 'Fly Rail Operator', 'Stagehand', 'Projection Operator'];

export default function TechRequestModal({ open, onClose, onSubmit, isSubmitting }) {
  const [form, setForm] = useState({
    show_title: '', troupe: '', theater: '', director_name: '', director_email: '',
    tech_week_start: '', tech_week_end: '', opening_night: '',
    rehearsal_schedule: '', tech_week_schedule: '', show_dates: '',
    roles_needed: [], skill_level: 'any', skill_preferences: '',
    light_plot_available: false, shadow_opportunity: false, notes: '',
    policy_acknowledged: false,
  });

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const toggleRole = (role) => {
    const roles = form.roles_needed.includes(role)
      ? form.roles_needed.filter(r => r !== role)
      : [...form.roles_needed, role];
    update('roles_needed', roles);
  };

  const handleSubmit = () => {
    if (!form.show_title || !form.theater || !form.tech_week_start || !form.policy_acknowledged) return;
    // Build description fields
    const data = {
      ...form,
      tech_needs_description: `Roles: ${form.roles_needed.join(', ')}\nLevel: ${form.skill_level}\nPreferences: ${form.skill_preferences}`,
    };
    onSubmit(data);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Tech Request</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Show Title *</Label><Input value={form.show_title} onChange={e => update('show_title', e.target.value)} /></div>
            <div><Label>Troupe / School</Label><Input value={form.troupe} onChange={e => update('troupe', e.target.value)} placeholder="e.g. Plano Senior High" /></div>
            <div><Label>Theater / Location *</Label><Input value={form.theater} onChange={e => update('theater', e.target.value)} /></div>
            <div><Label>Director Name</Label><Input value={form.director_name} onChange={e => update('director_name', e.target.value)} /></div>
            <div><Label>Director Email</Label><Input type="email" value={form.director_email} onChange={e => update('director_email', e.target.value)} /></div>
            <div><Label>Tech Week Start *</Label><Input type="date" value={form.tech_week_start} onChange={e => update('tech_week_start', e.target.value)} /></div>
            <div><Label>Tech Week End</Label><Input type="date" value={form.tech_week_end} onChange={e => update('tech_week_end', e.target.value)} /></div>
          </div>
          <div><Label>Rehearsal Schedule</Label><Input value={form.rehearsal_schedule} onChange={e => update('rehearsal_schedule', e.target.value)} placeholder="e.g. Mondays 6-9 pm, Plano" /></div>
          <div><Label>Tech Week Schedule</Label><Input value={form.tech_week_schedule} onChange={e => update('tech_week_schedule', e.target.value)} placeholder="e.g. Monday March 12-Wednesday March 16, 5-9 pm / Copeland" /></div>
          <div><Label>Performances</Label><Textarea value={form.show_dates} onChange={e => update('show_dates', e.target.value)} rows={2} placeholder="e.g. Thursday March 17 @ 7 pm (Call time 5 pm), Friday March 18 @ 7 pm (Call time 5 pm)" /></div>

          <div>
            <Label className="mb-2 block">Roles Needed</Label>
            <div className="flex flex-wrap gap-3">
              {ROLES.map(role => (
                <label key={role} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={form.roles_needed.includes(role)} onCheckedChange={() => toggleRole(role)} />{role}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div><Label>Skill Level</Label>
              <Select value={form.skill_level} onValueChange={v => update('skill_level', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['any','beginner','intermediate','advanced'].map(l => <SelectItem key={l} value={l} className="capitalize">{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Skill Preferences</Label><Input value={form.skill_preferences} onChange={e => update('skill_preferences', e.target.value)} /></div>
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.light_plot_available} onCheckedChange={v => update('light_plot_available', v)} />Light plot available</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.shadow_opportunity} onCheckedChange={v => update('shadow_opportunity', v)} />Shadow opportunity</label>
          </div>

          <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => update('notes', e.target.value)} rows={3} /></div>

          <label className="flex items-center gap-2 text-sm border rounded-lg p-3 bg-muted">
            <Checkbox checked={form.policy_acknowledged} onCheckedChange={v => update('policy_acknowledged', v)} />
            <span>I acknowledge and agree to the tech support policies *</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !form.show_title || !form.tech_week_start || !form.policy_acknowledged}>
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}