import { db } from '@/lib/backend/client';

import React, { useState } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, UserCog, Mail, Phone, Pencil, Trash2, Loader2, Upload } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

export default function Directors() {
  const [editModal, setEditModal] = useState(null); // null = closed, {} = new, {id,...} = edit
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: directors = [], isLoading } = useQuery({
    queryKey: ['directors'],
    queryFn: () => db.entities.Director.list(),
  });

  const handleSave = async () => {
    if (!editModal?.full_name || !editModal?.email) {
      toast({ title: 'Name and email are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    if (editModal.id) {
      await db.entities.Director.update(editModal.id, {
        full_name: editModal.full_name, email: editModal.email,
        phone: editModal.phone || '', notes: editModal.notes || '',
      });
    } else {
      await db.entities.Director.create(editModal);
    }
    toast({ title: editModal.id ? 'Director updated' : 'Director added' });
    queryClient.invalidateQueries({ queryKey: ['directors'] });
    setEditModal(null);
    setSaving(false);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    const text = await file.text();
    const lines = text.trim().split('\n');
    if (lines.length < 2) {
      toast({ title: 'File is empty', variant: 'destructive' });
      setImporting(false);
      e.target.value = '';
      return;
    }
    // Parse headers, normalize to lowercase and trim
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    // Map flexible column names to entity fields
    const colMap = {
      full_name: headers.findIndex(h => h === 'full_name' || h === 'director name' || h === 'name' || h === 'full name'),
      email: headers.findIndex(h => h === 'email' || h === 'email address'),
      phone: headers.findIndex(h => h === 'phone' || h === 'phone number'),
      organization: headers.findIndex(h => h === 'organization' || h === 'school' || h === 'org'),
      notes: headers.findIndex(h => h === 'notes'),
    };
    const rows = lines.slice(1).map(line => {
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      const row = {};
      if (colMap.full_name >= 0) row.full_name = cols[colMap.full_name] || '';
      if (colMap.email >= 0) row.email = cols[colMap.email] || '';
      if (colMap.phone >= 0 && colMap.phone < cols.length) row.phone = cols[colMap.phone] || '';
      if (colMap.organization >= 0 && colMap.organization < cols.length) row.organization = cols[colMap.organization] || '';
      if (colMap.notes >= 0 && colMap.notes < cols.length) row.notes = cols[colMap.notes] || '';
      return row;
    }).filter(r => r.full_name && r.email);
    await Promise.all(rows.map(r => db.entities.Director.create(r)));
    toast({ title: `Imported ${rows.length} director(s)` });
    queryClient.invalidateQueries({ queryKey: ['directors'] });
    setImporting(false);
    e.target.value = '';
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await db.entities.Director.delete(confirmDelete.id);
    toast({ title: 'Director deleted' });
    queryClient.invalidateQueries({ queryKey: ['directors'] });
    setConfirmDelete(null);
  };

  return (
    <div>
      <PageHeader title="Directors" subtitle={`${directors.length} directors`}>
        <label className="cursor-pointer">
          <input type="file" accept=".csv,.xlsx,.json" className="hidden" onChange={handleImport} disabled={importing} />
          <Button variant="outline" asChild>
            <span>{importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}Import</span>
          </Button>
        </label>
        <Button onClick={() => setEditModal({ full_name: '', email: '', phone: '' })}>
          <Plus className="w-4 h-4 mr-2" />Add Director
        </Button>
      </PageHeader>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      ) : directors.length === 0 ? (
        <EmptyState icon={UserCog} title="No directors yet" action={
          <Button size="sm" onClick={() => setEditModal({ full_name: '', email: '', phone: '' })}>Add Director</Button>
        } />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {directors.map(d => (
            <Card key={d.id} className="p-4 hover:shadow-md transition-all">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">{(d.full_name||'?')[0].toUpperCase()}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{d.full_name}</h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Mail className="w-3 h-3" />{d.email}</p>
                    {d.phone && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" />{d.phone}</p>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditModal({ ...d })}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setConfirmDelete(d)}>
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editModal} onOpenChange={() => setEditModal(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editModal?.id ? 'Edit Director' : 'Add Director'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Full Name *</Label><Input value={editModal?.full_name || ''} onChange={e => setEditModal(p => ({ ...p, full_name: e.target.value }))} /></div>
            <div><Label>Email *</Label><Input type="email" value={editModal?.email || ''} onChange={e => setEditModal(p => ({ ...p, email: e.target.value }))} /></div>
            <div><Label>Phone</Label><Input value={editModal?.phone || ''} onChange={e => setEditModal(p => ({ ...p, phone: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModal(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Delete Director?"
        description={`Remove ${confirmDelete?.full_name}? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
      />
    </div>
  );
}