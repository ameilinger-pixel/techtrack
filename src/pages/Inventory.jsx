import { db } from '@/lib/backend/client';

import React, { useState } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import StatusBadge from '@/components/shared/StatusBadge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, Package, Pencil, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { formatDateDisplay } from '@/lib/showUtils';

const CATEGORIES = ['lighting', 'sound', 'projection', 'rigging', 'other'];

export default function Inventory() {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [editModal, setEditModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: equipment = [], isLoading } = useQuery({
    queryKey: ['equipment'],
    queryFn: () => db.entities.Equipment.list(),
  });
  const { data: reservations = [] } = useQuery({
    queryKey: ['reservations'],
    queryFn: () => db.entities.EquipmentReservation.list(),
  });

  const filtered = equipment.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = !q || e.name?.toLowerCase().includes(q);
    const matchCat = catFilter === 'all' || e.category === catFilter;
    return matchSearch && matchCat;
  });

  // Find conflicts: overlapping reservations for same equipment
  const getConflicts = (equipId) => {
    const eqRes = reservations.filter(r => r.equipment_id === equipId && r.status !== 'cancelled' && r.status !== 'returned');
    const conflicts = [];
    for (let i = 0; i < eqRes.length; i++) {
      for (let j = i + 1; j < eqRes.length; j++) {
        if (eqRes[i].start_date <= eqRes[j].end_date && eqRes[j].start_date <= eqRes[i].end_date) {
          conflicts.push({ a: eqRes[i], b: eqRes[j] });
        }
      }
    }
    return conflicts;
  };

  const handleSave = async () => {
    if (!editModal?.name) return;
    setSaving(true);
    if (editModal.id) {
      await db.entities.Equipment.update(editModal.id, editModal);
    } else {
      await db.entities.Equipment.create({ ...editModal, active: true });
    }
    toast({ title: editModal.id ? 'Equipment updated' : 'Equipment added' });
    queryClient.invalidateQueries({ queryKey: ['equipment'] });
    setEditModal(null);
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await db.entities.Equipment.delete(confirmDelete.id);
    queryClient.invalidateQueries({ queryKey: ['equipment'] });
    setConfirmDelete(null);
  };

  return (
    <div>
      <PageHeader title="Inventory" subtitle={`${equipment.length} items`}>
        <Button onClick={() => setEditModal({ name: '', category: 'other', description: '', quantity: 1, serial_number: '', location: '' })}>
          <Plus className="w-4 h-4 mr-2" />Add Equipment
        </Button>
      </PageHeader>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search equipment..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3].map(i => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Package} title="No equipment found" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(e => {
            const eqRes = reservations.filter(r => r.equipment_id === e.id && r.status !== 'cancelled');
            const conflicts = getConflicts(e.id);
            return (
              <Card key={e.id} className="p-4 hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-sm">{e.name}</h3>
                    <Badge variant="outline" className="capitalize text-xs mt-1">{e.category}</Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditModal({ ...e })}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setConfirmDelete(e)}><Trash2 className="w-3.5 h-3.5 text-muted-foreground" /></Button>
                  </div>
                </div>
                {e.description && <p className="text-xs text-muted-foreground mb-2">{e.description}</p>}
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>Qty: {e.quantity} {e.location && `· ${e.location}`}</p>
                  {e.serial_number && <p>S/N: {e.serial_number}</p>}
                </div>
                {conflicts.length > 0 && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-destructive">
                    <AlertTriangle className="w-3 h-3" />{conflicts.length} scheduling conflict{conflicts.length !== 1 ? 's' : ''}
                  </div>
                )}
                {eqRes.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {eqRes.slice(0, 3).map(r => (
                      <div key={r.id} className="text-xs flex items-center justify-between bg-muted rounded px-2 py-1">
                        <span className="truncate">{r.show_title}</span>
                        <StatusBadge status={r.status} />
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!editModal} onOpenChange={() => setEditModal(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editModal?.id ? 'Edit Equipment' : 'Add Equipment'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name *</Label><Input value={editModal?.name || ''} onChange={e => setEditModal(p => ({ ...p, name: e.target.value }))} /></div>
            <div><Label>Category</Label><Select value={editModal?.category || 'other'} onValueChange={v => setEditModal(p => ({ ...p, category: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Description</Label><Textarea value={editModal?.description || ''} onChange={e => setEditModal(p => ({ ...p, description: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Quantity</Label><Input type="number" value={editModal?.quantity || 1} onChange={e => setEditModal(p => ({ ...p, quantity: parseInt(e.target.value) || 1 }))} /></div>
              <div><Label>Location</Label><Input value={editModal?.location || ''} onChange={e => setEditModal(p => ({ ...p, location: e.target.value }))} /></div>
            </div>
            <div><Label>Serial Number</Label><Input value={editModal?.serial_number || ''} onChange={e => setEditModal(p => ({ ...p, serial_number: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModal(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={handleDelete}
        title="Delete Equipment?" description={`Remove ${confirmDelete?.name}?`} confirmLabel="Delete" destructive />
    </div>
  );
}