import { db } from '@/lib/backend/client';

import React from 'react';
import { useOutletContext, Link } from 'react-router-dom';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Clapperboard, Wrench, ClipboardList, CheckCircle, Clock,
  Users, ExternalLink, AlertCircle, UserCheck, Plus, Copy
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

function getDueDate(tech_week_start) {
  if (!tech_week_start) return null;
  const d = new Date(tech_week_start + 'T00:00:00');
  d.setDate(d.getDate() - 35);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

const STATUS_CONFIG = {
  pending_admin_approval: { label: 'Under Review', color: 'bg-amber-100 text-amber-800', icon: Clock },
  requested:              { label: 'Applications Open', color: 'bg-blue-100 text-blue-800', icon: Users },
  assigned:               { label: 'Tech Assigned!', color: 'bg-green-100 text-green-800', icon: UserCheck },
  confirmed:              { label: 'Confirmed', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  completed:              { label: 'Completed', color: 'bg-gray-100 text-gray-600', icon: CheckCircle },
  cancelled:              { label: 'Cancelled', color: 'bg-red-100 text-red-600', icon: AlertCircle },
};

export default function DirectorDashboard() {
  const { user } = useOutletContext();
  const { toast } = useToast();

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['director-assignments', user?.email],
    queryFn: () => db.entities.TechAssignment.filter({ director_email: user?.email }),
    enabled: !!user?.email,
  });

  const { data: allApplications = [] } = useQuery({
    queryKey: ['director-applications', user?.email],
    queryFn: () => db.entities.TechApplication.list(),
    enabled: !!user?.email,
  });

  const active = assignments.filter(a => !['completed', 'cancelled'].includes(a.status));
  const past = assignments.filter(a => ['completed', 'cancelled'].includes(a.status));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Welcome */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome back, {(user?.full_name || user?.email || 'Director').split(' ')[0]}!
          </h1>
          <p className="text-muted-foreground mt-1">Here's a status update on all your shows and tech requests.</p>
        </div>
        <Link to="/director/request-tech">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />Request a Technician
          </Button>
        </Link>
      </div>

      {/* Active requests */}
      <div>
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          <Clapperboard className="w-4 h-4" />Your Active Shows
        </h2>

        {isLoading ? (
          <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}</div>
        ) : active.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center space-y-3">
              <ClipboardList className="w-10 h-10 mx-auto text-muted-foreground" />
              <p className="font-medium">No active tech requests</p>
              <p className="text-sm text-muted-foreground">Submit a request to get a student technician assigned to your show.</p>
              <Link to="/director/request-tech">
                <Button size="sm" className="mt-2 gap-1"><Wrench className="w-4 h-4" />Request Tech Help</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {active.map(a => {
              const cfg = STATUS_CONFIG[a.status] || { label: a.status, color: 'bg-gray-100 text-gray-600', icon: Clock };
              const StatusIcon = cfg.icon;
              const dueDate = getDueDate(a.tech_week_start);
              const appCount = allApplications.filter(ap => ap.assignment_id === a.id).length;
              const applyUrl = `${window.location.origin}/apply?assignment=${a.id}`;

              return (
                <Card key={a.id} className="overflow-hidden">
                  <div className="flex items-center gap-3 px-5 pt-4 pb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground text-base">{a.show_title}</h3>
                        {a.troupe && <span className="text-sm text-muted-foreground">({a.troupe})</span>}
                      </div>
                      {a.theater && <p className="text-xs text-muted-foreground">{a.theater}</p>}
                      {/* Date + countdown row */}
                      {(a.tech_week_start || a.opening_night) && (() => {
                        const techDate = a.tech_week_start ? new Date(a.tech_week_start + 'T12:00:00') : null;
                        const openDate = a.opening_night ? new Date(a.opening_night + 'T12:00:00') : null;
                        const daysUntil = techDate ? Math.ceil((techDate - new Date()) / 86400000) : null;
                        return (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {techDate && `Tech week: ${techDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                            {openDate && ` · Opens ${openDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                            {daysUntil !== null && (
                              <span className={`ml-1.5 font-semibold ${daysUntil <= 14 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                                ({daysUntil > 0 ? `${daysUntil} days away` : daysUntil === 0 ? 'today!' : `${Math.abs(daysUntil)}d ago`})
                              </span>
                            )}
                          </p>
                        );
                      })()}
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0 ${cfg.color}`}>
                      <StatusIcon className="w-3 h-3" />{cfg.label}
                    </span>
                  </div>

                  <CardContent className="px-5 pb-4 space-y-3">
                    {/* Schedule */}
                    {a.tech_week_schedule && (
                      <p className="text-sm"><span className="font-medium">Tech Week:</span> {a.tech_week_schedule}</p>
                    )}

                    {/* Status-specific info */}
                    {a.status === 'pending_admin_approval' && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800">
                        Your request is being reviewed. You'll get an email once it's approved and posted for applications.
                      </div>
                    )}

                    {a.status === 'requested' && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 text-sm space-y-1.5">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-blue-800 font-medium">
                            {appCount > 0 ? `${appCount} student${appCount > 1 ? 's' : ''} have applied!` : 'Waiting for students to apply'}
                          </span>
                          {dueDate && <span className="text-xs text-blue-600">Deadline: {dueDate}</span>}
                        </div>
                        <a href={applyUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-blue-700 hover:underline">
                          <ExternalLink className="w-3 h-3" />View application page
                        </a>
                      </div>
                    )}

                    {(a.status === 'assigned' || a.status === 'confirmed') && a.assigned_student_name && (
                      <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 text-sm">
                        <p className="font-semibold text-green-800">✓ Technician Assigned</p>
                        <p className="text-green-700">{a.assigned_student_name}</p>
                        {a.assigned_student_email && (
                          <a href={`mailto:${a.assigned_student_email}`} className="text-xs text-green-600 hover:underline">
                            {a.assigned_student_email}
                          </a>
                        )}
                      </div>
                    )}

                    {a.roles_needed?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {a.roles_needed.map(r => (
                          <Badge key={r} variant="secondary" className="text-xs">{r}</Badge>
                        ))}
                      </div>
                    )}

                    {/* Persistent copy application link */}
                    <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                      <span className="text-xs text-muted-foreground flex-1">Application link</span>
                      <button
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                        onClick={() => {
                          navigator.clipboard.writeText(applyUrl);
                          toast({ title: 'Application link copied!' });
                        }}
                      >
                        <Copy className="w-3 h-3" /> Copy link
                      </button>
                      <a href={applyUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Past shows */}
      {past.length > 0 && (
        <div>
          <h2 className="text-base font-semibold mb-3 text-muted-foreground">Past Shows</h2>
          <div className="space-y-2">
            {past.map(a => (
              <div key={a.id} className="flex items-center justify-between px-4 py-3 rounded-lg bg-muted/50 text-sm">
                <span className="font-medium text-muted-foreground">{a.show_title}</span>
                <Badge variant="outline" className="text-xs capitalize">{a.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        <Link to="/director/request-tech">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="pt-5 pb-4 flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Wrench className="w-5 h-5 text-primary" />
              </div>
              <p className="font-medium text-sm">Request a Technician</p>
              <p className="text-xs text-muted-foreground">Submit a new tech request for your show</p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/students">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="pt-5 pb-4 flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                <Users className="w-5 h-5 text-accent-foreground" />
              </div>
              <p className="font-medium text-sm">Student Directory</p>
              <p className="text-xs text-muted-foreground">Browse available student technicians</p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/resources">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="pt-5 pb-4 flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-secondary-foreground" />
              </div>
              <p className="font-medium text-sm">Resource Library</p>
              <p className="text-xs text-muted-foreground">Guides, templates, and training materials</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}