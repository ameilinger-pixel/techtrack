import { db } from '@/lib/backend/client';

import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, BookOpen, Upload, ExternalLink, Loader2, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { isAdmin } from '@/lib/roleUtils';

const TYPES = ['lesson_plan', 'reference', 'guide', 'template', 'video', 'other'];

export default function ResourceLibrary() {
  const { role } = useOutletContext();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [addModal, setAddModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', type: 'reference', category: '', external_url: '', file_url: '' });
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ['resources'],
    queryFn: () => db.entities.Resource.list(),
  });

  const filtered = resources.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.title?.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q);
    const matchType = typeFilter === 'all' || r.type === typeFilter;
    return matchSearch && matchType;
  });

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const { file_url } = await db.integrations.Core.UploadFile({ file });
    setForm(p => ({ ...p, file_url }));
  };

  const handleSave = async () => {
    if (!form.title) return;
    setSaving(true);
    await db.entities.Resource.create({ ...form, active: true });
    toast({ title: 'Resource added' });
    queryClient.invalidateQueries({ queryKey: ['resources'] });
    setAddModal(false);
    setForm({ title: '', description: '', type: 'reference', category: '', external_url: '', file_url: '' });
    setSaving(false);
  };

  const handleDelete = async (id) => {
    await db.entities.Resource.delete(id);
    toast({ title: 'Resource deleted' });
    queryClient.invalidateQueries({ queryKey: ['resources'] });
  };

  return (
    <div>
      <PageHeader title="Resource Library" subtitle={`${resources.length} resources`}>
        {isAdmin(role) && <Button onClick={() => setAddModal(true)}><Plus className="w-4 h-4 mr-2" />Add Resource</Button>}
      </PageHeader>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search resources..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g, ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={BookOpen} title="No resources found" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(r => (
            <Card key={r.id} className="p-4 hover:shadow-md transition-all">
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-sm">{r.title}</h3>
                {isAdmin(role) && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(r.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                )}
              </div>
              {r.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.description}</p>}
              <div className="flex items-center gap-2 mt-3">
                <Badge variant="outline" className="capitalize text-xs">{(r.type || 'other').replace(/_/g, ' ')}</Badge>
                {r.category && <Badge variant="secondary" className="text-xs">{r.category}</Badge>}
              </div>
              <div className="flex gap-2 mt-3">
                {r.file_url && <a href={r.file_url} target="_blank" rel="noopener" className="text-xs text-primary hover:underline flex items-center gap-1"><ExternalLink className="w-3 h-3" />Download</a>}
                {r.external_url && <a href={r.external_url} target="_blank" rel="noopener" className="text-xs text-primary hover:underline flex items-center gap-1"><ExternalLink className="w-3 h-3" />Link</a>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={addModal} onOpenChange={setAddModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Resource</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Type</Label><Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g,' ')}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Category</Label><Input value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} /></div>
            </div>
            <div><Label>External URL</Label><Input value={form.external_url} onChange={e => setForm(p => ({ ...p, external_url: e.target.value }))} placeholder="https://..." /></div>
            <div>
              <Label>Upload File</Label>
              <label className="cursor-pointer">
                <input type="file" className="hidden" onChange={handleUpload} />
                <Button variant="outline" size="sm" asChild><span><Upload className="w-4 h-4 mr-1" />{form.file_url ? 'File uploaded' : 'Choose file'}</span></Button>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.title}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}