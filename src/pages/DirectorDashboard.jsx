import { db } from '@/lib/backend/client';
import React, { useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Clapperboard, Wrench, CheckCircle, Clock, Users,
  ExternalLink, AlertCircle, UserCheck, Plus, Copy,
  BookOpen, GraduationCap, Mail
} from 'lucide-react';

const STATUS_CONFIG = {
  pending_admin_approval: { label: 'Under Review',      color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock,      description: "Your request is being reviewed. You'll hear back soon." },
  requested:              { label: 'Applications Open', color: 'bg-blue-100 text-blue-800 border-blue-200',   icon: Users,      description: "Students are applying. We'll notify you once someone is assigned." },
  assigned:               { label: 'Tech Assigned',     color: 'bg-green-100 text-green-800 border-green-200', icon: UserCheck,  description: "A technician has been assigned to your show." },
  confirmed:              { label: 'Confirmed',          color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle,'description': "Your technician has confirmed and is ready to go." },
  completed:              { label: 'Completed',          color: 'bg-gray-100 text-gray-600 border-gray-200',   icon: CheckCircle, description: "This show has wrapped. Thanks for working with us!" },
  cancelled:              { label: 'Cancelled',          color: 'bg-red-100 text-red-600 border-red-200',      icon: AlertCircle, description: "This request was cancelled." },
};

const STEPS = ['Request submitted', 'Request approved', 'Applications open', 'Tech assigned', 'Ready for tech week'];

function getStepIndex(status) {
  if (status === 'pending_admin_approval') return 0;
  if (status === 'requested')              return 2;
  if (status === 'assigned')               return 3;
  if (status === 'confirmed')              return 4;
  if (status === 'completed')              return 5;
  return 0;
}

function ProgressBar({ status }) {
  const current = getStepIndex(status);
  return (
    <div className="flex items-center gap-0.5 mt-2 mb-1">
      {STEPS.map((step, i) => (
        <React.Fragment key={step}>
          <div title={step} className={`h-1.5 rounded-full flex-1 transition-colors ${i < current ? 'bg-primary' : i === current ? 'bg-primary/40' : 'bg-border'}`} />
        </React.Fragment>
      ))}
    </div>
  );
}

export default function DirectorDashboard() {
  const { user } = useOutletContext();
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState(null);

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['director-assignments', user?.email],
    queryFn: () => db.entities.TechAssignment.filter({ director_email: user?.email }),
    enabled: !!user?.email,
  });
  const { data: allApplications = [] } = useQuery({
    queryKey: ['director-applications'],
    queryFn: () => db.entities.TechApplication.list(),
    enabled: !!user?.email,
  });

  const copyLink = (id) => {
    navigator.clipboard.writeText(`${window.location.origin}/apply?assignment=${id}`);
    setCopiedId(id);
    toast({ title: 'Application link copied!' });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const active = assignments.filter(a => !['completed','cancelled'].includes(a.status));
  const past   = assignments.filter(a =>  ['completed','cancelled'].includes(a.status));
  const firstName = (user?.full_name || user?.email || 'Director').split(' ')[0];

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap pt-2">
        <div>
          <h1 className="text-2xl font-bold">Hi, {firstName}!</h1>
          <p className="text-sm text-muted-foreground mt-1">Here's the status of your shows and tech requests.</p>
        </div>
        <Link to="/director/request-tech">
          <Button className="gap-2 shrink-0"><Plus className="w-4 h-4" />Request a Technician</Button>
        </Link>
      </div>

      {/* Active assignments */}
      {isLoading ? (
        <div className="space-y-4">{[1,2].map(i => <Skeleton key={i} className="h-52 w-full rounded-xl" />)}</div>
      ) : active.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Clapperboard className="w-7 h-7 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-lg">No active requests</p>
              <p className="text-sm text-muted-foreground mt-1">Submit a tech request and we'll find the right student for your show.</p>
            </div>
            <Link to="/director/request-tech"><Button className="gap-2"><Wrench className="w-4 h-4" />Submit a Request</Button></Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {active.map(a => {
            const cfg = STATUS_CONFIG[a.status] || STATUS_CONFIG.pending_admin_approval;
            const StatusIcon = cfg.icon;
            const appCount = allApplications.filter(ap => ap.assignment_id === a.id).length;
            const techDate = a.tech_week_start ? new Date(a.tech_week_start + 'T12:00:00') : null;
            const openDate = a.opening_night   ? new Date(a.opening_night   + 'T12:00:00') : null;
            const daysUntil = techDate ? Math.ceil((techDate - new Date()) / 86400000) : null;

            return (
              <Card key={a.id} className="overflow-hidden">
                <CardContent className="pt-5 pb-5 space-y-4">

                  {/* Title + status badge */}
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <h2 className="font-bold text-lg leading-snug">{a.show_title}</h2>
                      {(a.troupe || a.theater) && (
                        <p className="text-xs text-muted-foreground mt-0.5">{[a.troupe, a.theater].filter(Boolean).join(' · ')}</p>
                      )}
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1 shrink-0 ${cfg.color}`}>
                      <StatusIcon className="w-3 h-3" />{cfg.label}
                    </span>
                  </div>

                  {/* Progress bar */}
                  {!['completed','cancelled'].includes(a.status) && <ProgressBar status={a.status} />}

                  {/* Status blurb */}
                  <p className="text-sm text-muted-foreground">{cfg.description}</p>

                  {/* Dates */}
                  {(techDate || openDate) && (
                    <div className="flex flex-wrap gap-5 text-sm">
                      {techDate && (
                        <div>
                          <p className="text-xs text-muted-foreground">Tech week starts</p>
                          <p className="font-medium">
                            {techDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            {daysUntil !== null && daysUntil > 0 && (
                              <span className={`ml-2 text-xs font-semibold ${daysUntil <= 14 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                                ({daysUntil}d away)
                              </span>
                            )}
                            {daysUntil !== null && daysUntil <= 0 && (
                              <span className="ml-2 text-xs font-semibold text-green-600">(in progress!)</span>
                            )}
                          </p>
                        </div>
                      )}
                      {openDate && (
                        <div>
                          <p className="text-xs text-muted-foreground">Opening night</p>
                          <p className="font-medium">{openDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Assigned tech */}
                  {['assigned','confirmed'].includes(a.status) && a.assigned_student_name && (
                    <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 space-y-1">
                      <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Your Technician</p>
                      <p className="font-semibold text-green-900">{a.assigned_student_name}</p>
                      {a.assigned_student_email && (
                        <a href={`mailto:${a.assigned_student_email}`} className="text-sm text-green-700 hover:underline flex items-center gap-1">
                          <Mail className="w-3 h-3" />{a.assigned_student_email}
                        </a>
                      )}
                    </div>
                  )}

                  {/* Applications count */}
                  {a.status === 'requested' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                      <p className="text-sm font-medium text-blue-900">
                        {appCount > 0 ? `${appCount} student${appCount !== 1 ? 's' : ''} applied` : 'Waiting for students to apply'}
                      </p>
                    </div>
                  )}

                  {/* Roles */}
                  {a.roles_needed?.length > 0 && !['assigned','confirmed'].includes(a.status) && (
                    <div className="flex flex-wrap gap-1.5">
                      {a.roles_needed.map(r => <Badge key={r} variant="secondary" className="text-xs">{r}</Badge>)}
                    </div>
                  )}

                  {/* Copy application link */}
                  <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                    <span className="text-xs text-muted-foreground flex-1">Application link</span>
                    <button onClick={() => copyLink(a.id)} className="flex items-center gap-1 text-xs text-primary hover:underline font-medium">
                      <Copy className="w-3 h-3" />{copiedId === a.id ? 'Copied!' : 'Copy link'}
                    </button>
                    <a href={`${window.location.origin}/apply?assignment=${a.id}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Past shows */}
      {past.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">Past Shows</h2>
          <div className="space-y-1.5">
            {past.map(a => (
              <div key={a.id} className="flex items-center justify-between px-4 py-3 rounded-lg bg-muted/50">
                <span className="text-sm font-medium">{a.show_title}</span>
                <Badge variant="outline" className="text-xs capitalize">{a.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        {[
          { to: '/director/request-tech', icon: Wrench,       title: 'Request a Technician', desc: 'Submit a new tech request' },
          { to: '/students',              icon: GraduationCap, title: 'Student Directory',    desc: 'Browse available technicians' },
          { to: '/resources',             icon: BookOpen,      title: 'Resource Library',     desc: 'Guides and materials' },
        ].map(link => (
          <Link key={link.to} to={link.to}>
            <Card className="hover:shadow-md transition-all cursor-pointer h-full group">
              <CardContent className="pt-5 pb-4 flex flex-col items-center text-center gap-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <link.icon className="w-5 h-5 text-primary" />
                </div>
                <p className="font-medium text-sm">{link.title}</p>
                <p className="text-xs text-muted-foreground">{link.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
