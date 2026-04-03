import React from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { Users, CheckCircle, XCircle, Loader2, Trash2 } from 'lucide-react';

export default function ApplicantModal({
  open, onClose, assignment, applications, students, onApprove, approving, onDeleteApplication
}) {
  if (!assignment) return null;

  const assignmentApps = (applications || []).filter(a => a.assignment_id === assignment.id);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Applicants — {assignment.show_title}</DialogTitle>
        </DialogHeader>
        {assignmentApps.length === 0 ? (
          <EmptyState icon={Users} title="No applicants yet" description="Applicants will appear here once students apply" />
        ) : (
          <div className="space-y-3">
            {assignmentApps.map(app => {
              const student = students?.find(s => s.id === app.student_id);
              return (
                <Card key={app.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-sm">{app.student_name}</p>
                      <p className="text-xs text-muted-foreground">{app.student_email}</p>
                    </div>
                    <StatusBadge status={app.status} />
                  </div>
                  {app.cover_letter && <p className="text-sm text-muted-foreground mb-2">{app.cover_letter}</p>}
                  {app.experience && <p className="text-xs text-muted-foreground mb-2">Experience: {app.experience}</p>}
                  <div className="flex gap-2">
                    {app.status === 'pending' && (
                      <Button size="sm" onClick={() => onApprove(app, assignment)} disabled={approving}>
                        {approving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5 mr-1" />}
                        Approve
                      </Button>
                    )}
                    {onDeleteApplication && (
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onDeleteApplication(app)}>
                        <Trash2 className="w-3.5 h-3.5 mr-1" />Delete
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}