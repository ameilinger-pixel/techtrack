import { db } from '@/lib/backend/client';

import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Send, Loader2 } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';

export default function EmailPreviewModal({ open, onClose, initialTo, initialCc, initialSubject, initialBody, initialFrom, onSent }) {
  const [from, setFrom] = useState(initialFrom || '');
  const [to, setTo] = useState(initialTo || '');
  const [cc, setCc] = useState(initialCc || '');
  const [subject, setSubject] = useState(initialSubject || '');
  const [body, setBody] = useState(initialBody || '');
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    setFrom(initialFrom || '');
    setTo(initialTo || '');
    setCc(initialCc || '');
    setSubject(initialSubject || '');
    setBody(initialBody || '');
  }, [initialFrom, initialTo, initialCc, initialSubject, initialBody]);

  const handleSend = async () => {
    setSending(true);
    try {
      await db.integrations.Core.SendEmail({
        to,
        subject,
        body: `<div style="font-family:Arial,sans-serif;line-height:1.6">${body.replace(/\n/g, '<br/>')}</div>`,
      });
      toast({ title: 'Email sent successfully' });
      onSent?.();
      onClose();
    } catch (err) {
      toast({ title: 'Failed to send email', description: err.message, variant: 'destructive' });
    }
    setSending(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Email Preview</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>From</Label>
            <Input value={from} onChange={e => setFrom(e.target.value)} placeholder="amelinger@ntpa.org" />
          </div>
          <div>
            <Label>To</Label>
            <Input value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <div>
            <Label>CC</Label>
            <Input value={cc} onChange={e => setCc(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <Label>Subject</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          <div>
            <Label>Body</Label>
            <Textarea value={body} onChange={e => setBody(e.target.value)} rows={8} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSend} disabled={sending || !to || !subject}>
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}