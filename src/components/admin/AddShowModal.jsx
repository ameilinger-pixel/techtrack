import { db } from '@/lib/backend/client';

import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import { useQuery } from '@tanstack/react-query';

const defaultForm = {
  title: '', theater: '', director_name: '', director_email: '', director_phone: '',
  tech_week_start: '', tech_week_end: '', opening_night: '', show_dates: '',
  tech_rehearsal_times: '', schedule_notes: '', notes: '',
  needs_lighting: false, needs_sound: false, needs_projection: false, needs_rigging: false,
  equipment_ids: [],
};

export default function AddShowModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const { data: equipment = [] } = useQuery({
    queryKey: ['equipment-active'],
    queryFn: () => db.entities.Equipment.filter({ active: true }),
  });

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.title || !form.theater || !form.director_name || !form.director_email || !form.tech_week_start) {
      toast({ title: 'Please fill required fields', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const showData = {
      ...form,
      status: 'upcoming',
      workflow_status: 'needs_director_contact',
      assigned_technicians: [],
      needs_technician: true,
      tech_support_declined: false,
      equipment_reserved: false,
      equipment_returned: false,
      show_files: [],
    };
    delete showData.equipment_ids;
    const show = await db.entities.Show.create(showData);
    toast({ title: 'Show created' });
    onCreated?.(show);
    setForm(defaultForm);
    onClose();
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Show</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label>Title *</Label>
            <Input value={form.title} onChange={e => update('title', e.target.value)} placeholder="Show title" />
          </div>
          <div>
            <Label>Theater *</Label>
            <Input value={form.theater} onChange={e => update('theater', e.target.value)} />
          </div>
          <div>
            <Label>Director Name *</Label>
            <Input value={form.director_name} onChange={e => update('director_name', e.target.value)} />
          </div>
          <div>
            <Label>Director Email *</Label>
            <Input type="email" value={form.director_email} onChange={e => update('director_email', e.target.value)} />
          </div>
          <div>
            <Label>Director Phone</Label>
            <Input value={form.director_phone} onChange={e => update('director_phone', e.target.value)} />
          </div>
          <div>
            <Label>Tech Week Start *</Label>
            <Input type="date" value={form.tech_week_start} onChange={e => update('tech_week_start', e.target.value)} />
          </div>
          <div>
            <Label>Tech Week End</Label>
            <Input type="date" value={form.tech_week_end} onChange={e => update('tech_week_end', e.target.value)} />
          </div>
          <div>
            <Label>Opening Night</Label>
            <Input type="date" value={form.opening_night} onChange={e => update('opening_night', e.target.value)} />
          </div>
          <div>
            <Label>Show Dates</Label>
            <Input value={form.show_dates} onChange={e => update('show_dates', e.target.value)} placeholder="e.g. Jan 15-20" />
          </div>
          <div className="md:col-span-2">
            <Label>Tech Rehearsal Times</Label>
            <Textarea value={form.tech_rehearsal_times} onChange={e => update('tech_rehearsal_times', e.target.value)} rows={2} />
          </div>
          <div className="md:col-span-2">
            <Label>Schedule Notes</Label>
            <Textarea value={form.schedule_notes} onChange={e => update('schedule_notes', e.target.value)} rows={2} />
          </div>
          <div className="md:col-span-2">
            <Label className="mb-2 block">Equipment Needs</Label>
            <div className="flex flex-wrap gap-4">
              {[
                { key: 'needs_lighting', label: 'Lighting' },
                { key: 'needs_sound', label: 'Sound' },
                { key: 'needs_projection', label: 'Projection' },
                { key: 'needs_rigging', label: 'Rigging' },
              ].map(eq => (
                <label key={eq.key} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={form[eq.key]} onCheckedChange={v => update(eq.key, v)} />
                  {eq.label}
                </label>
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => update('notes', e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Create Show
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}