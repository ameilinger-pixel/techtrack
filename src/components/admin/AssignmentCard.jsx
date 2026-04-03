import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/shared/StatusBadge';
import { formatDateDisplay } from '@/lib/showUtils';
import { CheckCircle, Users, Calendar, MapPin, Link, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function AssignmentCard({
  assignment,
  busyAssignmentId,
  onApprove,
  onViewApplicants,
  onMarkComplete,
  onToggleVerification,
  onEdit,
  onDelete,
}) {
  const a = assignment;
  const { toast } = useToast();
  const isPending = a.status === 'pending_admin_approval';
  const isRequested = a.status === 'requested';
  const isAssigned = a.status === 'assigned' || a.status === 'confirmed';

  const copyApplicationLink = () => {
    const url = `${window.location.origin}/apply?assignment=${a.id}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied!", description: "Share this link with students to apply." });
  };

  return (
    <Card className="p-4 hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm truncate">{a.show_title}</h3>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            {a.theater && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{a.theater}</span>}
            {a.tech_week_start && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDateDisplay(a.tech_week_start)}</span>}
          </div>
        </div>
        <StatusBadge status={a.status} />
      </div>

      {a.director_name && <p className="text-xs text-muted-foreground mb-2">Director: {a.director_name}</p>}
      {a.assigned_student_name && (
        <p className="text-xs text-primary font-medium mb-2">Assigned: {a.assigned_student_name}</p>
      )}
      {a.roles_needed?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {a.roles_needed.map(r => (
            <span key={r} className="text-xs px-2 py-0.5 bg-muted rounded-full">{r}</span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {onEdit && (
          <Button size="sm" variant="ghost" onClick={() => onEdit(a)}>
            <Pencil className="w-3.5 h-3.5 mr-1" />Edit
          </Button>
        )}
        {onDelete && (
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onDelete(a)}>
            <Trash2 className="w-3.5 h-3.5 mr-1" />Delete
          </Button>
        )}
        {isPending && onApprove && (
          <Button
            size="sm"
            onClick={() => onApprove(a)}
            disabled={busyAssignmentId === a.id}
          >
            <CheckCircle className="w-3.5 h-3.5 mr-1" />
            {busyAssignmentId === a.id ? 'Posting…' : 'Approve & Post'}
          </Button>
        )}
        {isRequested && (
          <Button size="sm" variant="outline" onClick={copyApplicationLink}>
            <Link className="w-3.5 h-3.5 mr-1" />Copy Link
          </Button>
        )}
        {(isRequested || isAssigned) && onViewApplicants && (
          <Button size="sm" variant="outline" onClick={() => onViewApplicants(a)}>
            <Users className="w-3.5 h-3.5 mr-1" />Applicants
          </Button>
        )}
        {isAssigned && onMarkComplete && (
          <Button size="sm" variant="outline" onClick={() => onMarkComplete(a)}>
            Mark Complete
          </Button>
        )}
        {isAssigned && onToggleVerification && (
          <div className="flex items-center gap-2 ml-auto">
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={a.director_verification || false} onChange={() => onToggleVerification(a, 'director_verification')} className="rounded" />
              Director verified
            </label>
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={a.student_pay_confirmation || false} onChange={() => onToggleVerification(a, 'student_pay_confirmation')} className="rounded" />
              Student paid
            </label>
          </div>
        )}
      </div>
    </Card>
  );
}