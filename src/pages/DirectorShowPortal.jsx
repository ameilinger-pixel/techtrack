import { db } from '@/lib/backend/client';

import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';

import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Save, Users, Calendar, MapPin, Package } from 'lucide-react';
import { formatDateDisplay, parseTechnicians } from '@/lib/showUtils';
import { useToast } from '@/components/ui/use-toast';

export default function DirectorShowPortal() {
  const { user } = useOutletContext();
  const { toast } = useToast();
  const params = new URLSearchParams(window.location.search);
  const showId = params.get('id');
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState(null);

  const { data: show, isLoading } = useQuery({
    queryKey: ['show-portal', showId],
    queryFn: async () => {
      const shows = await db.entities.Show.list();
      return shows.find(s => s.id === showId) || null;
    },
    enabled: !!showId,
  });

  const { data: reservations = [] } = useQuery({
    queryKey: ['show-reservations', showId],
    queryFn: async () => {
      const all = await db.entities.EquipmentReservation.list();
      return all.filter(r => r.show_id === showId);
    },
    enabled: !!showId,
  });

  useEffect(() => {
    if (show && !editForm) setEditForm({ ...show });
  }, [show]);

  if (!showId) return <div className="text-center py-12"><p className="text-muted-foreground">No show ID provided</p></div>;
  if (isLoading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>;
  if (!show) return <div className="text-center py-12"><p className="text-muted-foreground">Show not found</p></div>;

  const crew = parseTechnicians(show);

  const handleSave = async () => {
    setSaving(true);
    await db.entities.Show.update(show.id, {
      schedule_notes: editForm.schedule_notes,
      notes: editForm.notes,
    });
    toast({ title: 'Changes saved' });
    setSaving(false);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader title={show.title} subtitle={`${show.theater || ''} · Director Portal`}>
        <StatusBadge status={show.status} />
      </PageHeader>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="technician">Technician</TabsTrigger>
          <TabsTrigger value="equipment">Equipment</TabsTrigger>
          <TabsTrigger value="edit">Edit</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card><CardContent className="pt-6 space-y-3">
              <InfoRow icon={MapPin} label="Theater" value={show.theater} />
              <InfoRow icon={Calendar} label="Tech Week" value={`${formatDateDisplay(show.tech_week_start)}${show.tech_week_end ? ' – ' + formatDateDisplay(show.tech_week_end) : ''}`} />
              <InfoRow icon={Calendar} label="Opening Night" value={formatDateDisplay(show.opening_night)} />
              <InfoRow label="Show Dates" value={show.show_dates} />
              <InfoRow label="Rehearsal Times" value={show.tech_rehearsal_times} />
            </CardContent></Card>
            <Card><CardContent className="pt-6 space-y-3">
              <InfoRow label="Status" value={<StatusBadge status={show.workflow_status || show.status} />} />
              <InfoRow label="Director" value={show.director_name} />
              {show.notes && <InfoRow label="Notes" value={show.notes} />}
            </CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="technician" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Users className="w-5 h-5" />Assigned Crew</CardTitle></CardHeader>
            <CardContent>
              {crew.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No technician assigned yet</p>
              ) : (
                <div className="space-y-3">
                  {crew.map((t, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{t.name || 'Unnamed'}</p>
                        <p className="text-xs text-muted-foreground">{t.email}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{t.role}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="equipment" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Package className="w-5 h-5" />Equipment</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3 mb-4">
                {show.needs_lighting && <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-medium">Lighting</span>}
                {show.needs_sound && <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">Sound</span>}
                {show.needs_projection && <span className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-medium">Projection</span>}
                {show.needs_rigging && <span className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">Rigging</span>}
              </div>
              {reservations.length > 0 ? (
                <div className="space-y-2">
                  {reservations.map(r => (
                    <div key={r.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <span className="text-sm font-medium">{r.equipment_name}</span>
                      <StatusBadge status={r.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No equipment reservations</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="edit" className="mt-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div><Label>Schedule Notes</Label><Textarea value={editForm?.schedule_notes || ''} onChange={e => setEditForm(p => ({ ...p, schedule_notes: e.target.value }))} rows={4} /></div>
              <div><Label>Notes</Label><Textarea value={editForm?.notes || ''} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} rows={4} /></div>
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Save
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      {Icon && <Icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />}
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}