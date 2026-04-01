import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, FileText, Download, Eye, Pencil, Plus, X, Trash2 } from 'lucide-react';

const ROLE_LEVELS = {
  "Lighting Design": "Level 3+",
  "Sound Design": "Level 3+",
  "Lighting Operation": "Level 2+",
  "Sound Operation": "Level 2+",
  "Spotlight Operation": "Level 2+",
  "Backstage Crew": "Level 2+",
  "Stage Management": "Level 2+",
};
const ROLE_BADGES = {
  "Lighting Design": "Lighting Design Badge",
  "Sound Design": "Sound Design Badge",
  "Lighting Operation": "Lighting Badge",
  "Sound Operation": "Sound Badge",
};

// Convert legacy roles_needed array → positions array with defaults
function hydratePositions(assignment) {
  if (assignment.positions?.length) return assignment.positions;
  const roles = assignment.roles_needed || [];
  const positions = roles.map(role => ({
    role,
    level: ROLE_LEVELS[role] || 'Level 1+',
    badges: ROLE_BADGES[role] || 'N/A',
  }));
  if (assignment.shadow_opportunity) {
    positions.push({ role: 'Shadow Tech', level: 'Level 1', badges: 'N/A' });
  }
  return positions;
}

export default function EditAssignmentModal({ open, onClose, assignment, onSave }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (assignment) {
      setForm({
        ...assignment,
        positions: hydratePositions(assignment),
      });
    }
  }, [assignment]);

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const updatePosition = (i, field, value) => {
    const pos = [...(form.positions || [])];
    pos[i] = { ...pos[i], [field]: value };
    setForm(p => ({ ...p, positions: pos, roles_needed: pos.map(p => p.role) }));
  };

  const addPosition = () => {
    const pos = [...(form.positions || []), { role: '', level: 'Level 1+', badges: 'N/A' }];
    setForm(p => ({ ...p, positions: pos, roles_needed: pos.map(p => p.role) }));
  };

  const removePosition = (i) => {
    const pos = [...(form.positions || [])];
    pos.splice(i, 1);
    setForm(p => ({ ...p, positions: pos, roles_needed: pos.map(p => p.role) }));
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  if (!assignment) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Assignment</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="edit">
          <TabsList className="w-full grid grid-cols-2 mb-2">
            <TabsTrigger value="edit"><Pencil className="w-3.5 h-3.5 mr-1.5" />Edit</TabsTrigger>
            <TabsTrigger value="preview"><Eye className="w-3.5 h-3.5 mr-1.5" />Application Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="preview">
            <ApplicationPreview assignment={form} />
          </TabsContent>

          <TabsContent value="edit">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label>Show Title</Label><Input value={form.show_title || ''} onChange={e => update('show_title', e.target.value)} /></div>
                <div><Label>Troupe</Label><Input value={form.troupe || ''} onChange={e => update('troupe', e.target.value)} placeholder="e.g. Plano Senior High" /></div>
                <div><Label>Theater / Location</Label><Input value={form.theater || ''} onChange={e => update('theater', e.target.value)} /></div>
                <div><Label>Director Name</Label><Input value={form.director_name || ''} onChange={e => update('director_name', e.target.value)} /></div>
                <div><Label>Director Email</Label><Input type="email" value={form.director_email || ''} onChange={e => update('director_email', e.target.value)} /></div>
                <div><Label>Tech Week Start</Label><Input type="date" value={form.tech_week_start || ''} onChange={e => update('tech_week_start', e.target.value)} /></div>
                <div><Label>Tech Week End</Label><Input type="date" value={form.tech_week_end || ''} onChange={e => update('tech_week_end', e.target.value)} /></div>
              </div>

              <div>
                <Label>Rehearsal Schedule</Label>
                <Input value={form.rehearsal_schedule || ''} onChange={e => update('rehearsal_schedule', e.target.value)} placeholder="e.g. Mondays 6-9 pm, Plano" />
              </div>
              <div>
                <Label>Tech Week Schedule</Label>
                <Input value={form.tech_week_schedule || ''} onChange={e => update('tech_week_schedule', e.target.value)} placeholder="e.g. Monday March 12-Wednesday March 16, 5-9 pm / Copeland" />
              </div>
              <div>
                <Label>Performances</Label>
                <Textarea value={form.show_dates || ''} onChange={e => update('show_dates', e.target.value)} rows={3} placeholder="e.g. Thursday March 17 @ 7 pm (Call time 5 pm), Friday March 18 @ 7 pm (Call time 5 pm)" />
              </div>

              {/* Positions editor */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Positions Needed</Label>
                  <Button size="sm" variant="outline" onClick={addPosition}><Plus className="w-3.5 h-3.5 mr-1" />Add Position</Button>
                </div>
                <div className="space-y-2">
                  {(form.positions || []).map((pos, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end p-3 bg-muted rounded-lg">
                      <div>
                        <Label className="text-xs">Role / Position</Label>
                        <Input value={pos.role} onChange={e => updatePosition(i, 'role', e.target.value)} className="h-8 text-sm" placeholder="e.g. Lighting Design" />
                      </div>
                      <div>
                        <Label className="text-xs">Level/Track Required</Label>
                        <Input value={pos.level} onChange={e => updatePosition(i, 'level', e.target.value)} className="h-8 text-sm" placeholder="e.g. Level 1+" />
                      </div>
                      <div>
                        <Label className="text-xs">Specific Badge(s) Needed</Label>
                        <Input value={pos.badges} onChange={e => updatePosition(i, 'badges', e.target.value)} className="h-8 text-sm" placeholder="e.g. N/A" />
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 mb-0.5" onClick={() => removePosition(i)}><X className="w-4 h-4" /></Button>
                    </div>
                  ))}
                  {(form.positions || []).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-3">No positions yet — click Add Position</p>
                  )}
                </div>
              </div>

              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={!!form.light_plot_available} onCheckedChange={v => update('light_plot_available', v)} />Light plot available
                </label>
              </div>

              <div><Label>Notes / Tech Needs Description</Label><Textarea value={form.notes || ''} onChange={e => update('notes', e.target.value)} rows={3} /></div>

              {form.show_files?.length > 0 && (
                <div>
                  <Label className="mb-2 block">Attached Files</Label>
                  <ul className="space-y-2">
                    {form.show_files.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                        <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                        <a href={f.url} target="_blank" rel="noopener noreferrer" className="truncate font-medium hover:underline text-primary flex-1">{f.name}</a>
                        <span className="text-xs text-muted-foreground capitalize shrink-0">{f.category?.replace('_', ' ')}</span>
                        <a href={f.url} target="_blank" rel="noopener noreferrer"><Download className="w-4 h-4 text-muted-foreground hover:text-foreground" /></a>
                        <button type="button" onClick={() => update('show_files', form.show_files.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApplicationPreview({ assignment }) {
  const positions = assignment.positions?.length
    ? assignment.positions
    : (assignment.roles_needed || []).map(role => ({
        role,
        level: ROLE_LEVELS[role] || 'Level 1+',
        badges: ROLE_BADGES[role] || 'N/A',
      }));

  const rehearsalText = assignment.rehearsal_schedule || '';
  const techWeekText = assignment.tech_week_schedule || '';
  const performancesText = assignment.show_dates || '';

  const troupePart = [assignment.troupe, assignment.theater].filter(Boolean).join(' - ');
  const titleDisplay = [
    assignment.show_title || 'Untitled Show',
    troupePart ? ` (${troupePart})` : '',
    assignment.director_name ? ` ${assignment.director_name}` : '',
  ].join('');

  return (
    <div className="border rounded-xl bg-gray-50 p-5 text-sm space-y-0">
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">Preview — as seen by students</p>
      <div className="bg-white border rounded-lg p-5 space-y-4">
        <h2 className="font-bold text-base text-foreground leading-snug">{titleDisplay}</h2>

        {positions.length > 0 && (
          <div className="border-t pt-3 space-y-3">
            <div><strong>POSITIONS NEEDED:</strong></div>
            {positions.map((pos, i) => (
              <div key={i}>
                <div><strong>Option {i + 1}:</strong> {pos.role}</div>
                <div><strong>Level/Track Required:</strong> {pos.level}</div>
                <div><strong>Specific Badge(s) Needed:</strong> {pos.badges}</div>
              </div>
            ))}
          </div>
        )}

        {rehearsalText && (
          <div className="border-t pt-3 space-y-1">
            <div><strong>REHEARSALS:</strong></div>
            <div>{rehearsalText}</div>
          </div>
        )}

        {(techWeekText || performancesText) && (
          <div className="border-t pt-3 space-y-1">
            <div><strong>TECH WEEK &amp; PERFORMANCES:</strong></div>
            {techWeekText && <div><strong>Tech Week:</strong> {techWeekText}</div>}
            {performancesText && <div><strong>Performances:</strong> {performancesText}</div>}
          </div>
        )}

        {assignment.notes && (
          <div className="border-t pt-3 text-muted-foreground">{assignment.notes}</div>
        )}
      </div>
    </div>
  );
}