import { db } from '@/lib/backend/client';

import React from 'react';
import { useOutletContext } from 'react-router-dom';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardList, Clapperboard, Calendar, Users, Clock, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

function getDueDate(tech_week_start) {
  if (!tech_week_start) return null;
  const d = new Date(tech_week_start + 'T00:00:00');
  d.setDate(d.getDate() - 35);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

const STATUS_LABELS = {
  pending_admin_approval: { label: 'Under Review', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  requested: { label: 'Posted — Accepting Applications', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  assigned: { label: 'Technician Assigned', color: 'bg-green-50 text-green-700 border-green-200' },
  confirmed: { label: 'Confirmed', color: 'bg-green-50 text-green-700 border-green-200' },
  completed: { label: 'Completed', color: 'bg-gray-50 text-gray-600 border-gray-200' },
  cancelled: { label: 'Cancelled', color: 'bg-red-50 text-red-600 border-red-200' },
};

export default function DirectorHub() {
  const { user } = useOutletContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['director-hub-assignments'],
    queryFn: () => db.entities.TechAssignment.list('-updated_date', 500),
  });

  const emailLower = (user?.email || '').trim().toLowerCase();
  const nameLower = (user?.full_name || '').trim().toLowerCase();
  const myAssignments = assignments.filter((a) => {
    const ae = (a.director_email || '').trim().toLowerCase();
    if (emailLower && ae === emailLower) return true;
    const an = (a.director_name || '').trim().toLowerCase();
    return nameLower && an === nameLower;
  });

  const handleToggle = async (assignment, field) => {
    await db.entities.TechAssignment.update(assignment.id, { [field]: !assignment[field] });
    queryClient.invalidateQueries({ queryKey: ['director-hub-assignments'] });
    toast({ title: 'Updated' });
  };

  return (
    <div>
      <PageHeader title="My Shows" subtitle="Track the status of your tech requests and assignments" />

      {isLoading ? (
        <div className="space-y-4">{[1,2].map(i => <Skeleton key={i} className="h-48 w-full" />)}</div>
      ) : myAssignments.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No tech requests yet"
          description="Your submitted tech requests will appear here. Use 'Request a Technician' to get started."
        />
      ) : (
        <div className="space-y-4">
          {myAssignments.map(a => {
            const statusInfo = STATUS_LABELS[a.status] || { label: a.status, color: 'bg-gray-50 text-gray-600 border-gray-200' };
            const dueDate = getDueDate(a.tech_week_start);
            const applyUrl = `${window.location.origin}/apply?assignment=${a.id}`;

            return (
              <Card key={a.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clapperboard className="w-4 h-4 shrink-0" />
                      {a.show_title}
                      {a.troupe && <span className="font-normal text-muted-foreground text-sm">({a.troupe})</span>}
                    </CardTitle>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Schedule info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                    {a.tech_week_schedule && (
                      <div className="flex items-start gap-1.5">
                        <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span><strong className="text-foreground">Tech Week:</strong> {a.tech_week_schedule}</span>
                      </div>
                    )}
                    {a.rehearsal_schedule && (
                      <div className="flex items-start gap-1.5">
                        <Calendar className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span><strong className="text-foreground">Rehearsals:</strong> {a.rehearsal_schedule}</span>
                      </div>
                    )}
                  </div>

                  {/* Roles */}
                  {a.roles_needed?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {a.roles_needed.map(r => (
                        <Badge key={r} variant="secondary" className="text-xs">{r}</Badge>
                      ))}
                    </div>
                  )}

                  {/* If posted — show application link and due date */}
                  {a.status === 'requested' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 text-sm space-y-1">
                      <div className="flex items-center gap-2 text-blue-700 font-medium">
                        <Users className="w-4 h-4" /> Applications are open
                      </div>
                      {dueDate && (
                        <p className="text-blue-600 text-xs">Application deadline: <strong>{dueDate}</strong></p>
                      )}
                      <a href={applyUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-700 hover:underline mt-1">
                        <ExternalLink className="w-3 h-3" /> View application page
                      </a>
                    </div>
                  )}

                  {/* If pending review */}
                  {a.status === 'pending_admin_approval' && (
                    <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      Your request is being reviewed by our admin team. You'll receive an email once it's approved and posted.
                    </p>
                  )}

                  {/* Assigned technician info */}
                  {(a.status === 'assigned' || a.status === 'confirmed') && a.assigned_student_name && (
                    <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 text-sm space-y-1">
                      <p className="font-medium text-green-800">Assigned Technician: {a.assigned_student_name}</p>
                      {a.assigned_student_email && (
                        <p className="text-green-700 text-xs">{a.assigned_student_email}</p>
                      )}
                      <div className="flex items-center gap-4 pt-1">
                        <label className="flex items-center gap-2 text-xs text-green-700 cursor-pointer">
                          <Checkbox checked={a.director_verification || false} onCheckedChange={() => handleToggle(a, 'director_verification')} />
                          I've verified with the technician
                        </label>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}