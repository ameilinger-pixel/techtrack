import { db } from '@/lib/backend/client';

import React, { useState } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { runEmailEngine } from '@/lib/emailEngine';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Mail, RefreshCw, Send, X, Eye, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import EmptyState from '@/components/shared/EmptyState';
import { format } from 'date-fns';

const TRIGGER_LABELS = {
  technician_assigned: 'Technician Assigned',
  no_tech_30_days: 'No Tech — 30 Days Out',
  crew_form_overdue: 'Crew Form Overdue',
};

const STATUS_COLORS = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-blue-50 text-blue-700 border-blue-200',
  sent: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-gray-100 text-gray-500 border-gray-200',
};

export default function PendingEmails() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [preview, setPreview] = useState(null);
  const [editedBody, setEditedBody] = useState('');
  const [scanning, setScanning] = useState(false);
  const [sending, setSending] = useState(null);

  const { data: emails = [], isLoading } = useQuery({
    queryKey: ['pending-emails'],
    queryFn: () => db.entities.PendingEmail.list('-created_date', 200),
  });
  const { data: assignments = [] } = useQuery({
    queryKey: ['tech-assignments'],
    queryFn: () => db.entities.TechAssignment.list('-updated_date', 500),
  });
  const { data: templates = [] } = useQuery({
    queryKey: ['email-templates'],
    queryFn: () => db.entities.EmailTemplate.list(),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['pending-emails'] });

  const handleScan = async () => {
    setScanning(true);
    const queued = await runEmailEngine(assignments, templates, emails);
    refresh();
    toast({ title: queued.length > 0 ? `${queued.length} new email${queued.length !== 1 ? 's' : ''} queued for review` : 'No new emails to queue' });
    setScanning(false);
  };

  const handleApproveAndSend = async (email) => {
    setSending(email.id);
    const bodyToSend = email.id === preview?.id ? editedBody : email.body;
    if (bodyToSend !== email.body) {
      await db.entities.PendingEmail.update(email.id, { body: bodyToSend });
    }
    await db.integrations.Core.SendEmail({ to: email.to, subject: email.subject, body: bodyToSend });
    await db.entities.PendingEmail.update(email.id, { status: 'sent' });
    toast({ title: `Email sent to ${email.to}` });
    refresh();
    setPreview(null);
    setSending(null);
  };

  const handleReject = async (email) => {
    await db.entities.PendingEmail.update(email.id, { status: 'rejected' });
    toast({ title: 'Email rejected' });
    refresh();
    setPreview(null);
  };

  const pending = emails.filter(e => e.status === 'pending');
  const sent = emails.filter(e => e.status === 'sent');
  const rejected = emails.filter(e => e.status === 'rejected');

  const EmailCard = ({ email }) => (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => { setPreview(email); setEditedBody(email.body || ''); }}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{email.show_title || '—'}</p>
            <p className="text-xs text-muted-foreground truncate">{email.to_name ? `${email.to_name} · ` : ''}{email.to}</p>
          </div>
          <span className={`shrink-0 text-xs px-2 py-0.5 rounded border font-medium ${STATUS_COLORS[email.status] || ''}`}>
            {email.status}
          </span>
        </div>
        <p className="text-sm font-medium line-clamp-1">{email.subject}</p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-muted-foreground">{TRIGGER_LABELS[email.trigger] || email.trigger}</span>
          {email.created_date && (
            <span className="text-xs text-muted-foreground">{format(new Date(email.created_date), 'MMM d')}</span>
          )}
        </div>
        {email.status === 'pending' && (
          <div className="flex gap-2 mt-3">
            <Button size="sm" className="flex-1" onClick={e => { e.stopPropagation(); handleApproveAndSend(email); }} disabled={sending === email.id}>
              {sending === email.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
              Approve & Send
            </Button>
            <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); handleReject(email); }}>
              <X className="w-3 h-3 mr-1" />Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div>
      <PageHeader title="Email Outbox" subtitle="Review and approve outgoing automated emails">
        <Button onClick={handleScan} disabled={scanning} variant="outline">
          {scanning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Scan for New Emails
        </Button>
      </PageHeader>

      {pending.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 font-medium flex items-center gap-2">
          <Mail className="w-4 h-4" />
          {pending.length} email{pending.length !== 1 ? 's' : ''} waiting for your approval
        </div>
      )}

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending <Badge variant="secondary" className="ml-1">{pending.length}</Badge></TabsTrigger>
          <TabsTrigger value="sent">Sent <Badge variant="secondary" className="ml-1">{sent.length}</Badge></TabsTrigger>
          <TabsTrigger value="rejected">Rejected <Badge variant="secondary" className="ml-1">{rejected.length}</Badge></TabsTrigger>
        </TabsList>

        {[['pending', pending], ['sent', sent], ['rejected', rejected]].map(([key, arr]) => (
          <TabsContent key={key} value={key} className="mt-4">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1,2,3].map(i => <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />)}
              </div>
            ) : arr.length === 0 ? (
              <EmptyState icon={Mail} title={`No ${key} emails`} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {arr.map(e => <EmailCard key={e.id} email={e} />)}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Preview / Edit Modal */}
      <Dialog open={!!preview} onOpenChange={open => { if (!open) { setPreview(null); setEditedBody(''); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-4 h-4" /> Email Preview
            </DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="font-medium">To:</span> {preview.to_name ? `${preview.to_name} <${preview.to}>` : preview.to}</div>
                <div><span className="font-medium">Show:</span> {preview.show_title}</div>
                <div><span className="font-medium">Trigger:</span> {TRIGGER_LABELS[preview.trigger] || preview.trigger}</div>
                <div><span className="font-medium">Status:</span> <span className="capitalize">{preview.status}</span></div>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Subject</p>
                <p className="text-sm border rounded px-3 py-2 bg-muted">{preview.subject}</p>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Body <span className="text-xs text-muted-foreground font-normal">(editable — changes are saved when you send)</span></p>
                <Textarea
                  value={editedBody}
                  onChange={e => setEditedBody(e.target.value)}
                  rows={12}
                  className="text-sm font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1">HTML is supported. Preview renders below.</p>
                {editedBody && (
                  <div className="mt-2 border rounded p-3 text-sm bg-white prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: editedBody }} />
                )}
              </div>
              {preview.status === 'pending' && (
                <div className="flex gap-2 pt-2">
                  <Button className="flex-1" onClick={() => handleApproveAndSend(preview)} disabled={!!sending}>
                    {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                    Approve & Send
                  </Button>
                  <Button variant="outline" onClick={() => handleReject(preview)}>
                    <X className="w-4 h-4 mr-1" />Reject
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}