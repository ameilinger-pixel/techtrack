import { db } from '@/lib/backend/client';

import React, { useEffect } from 'react';
import { useOutletContext, Link, useNavigate } from 'react-router-dom';

import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/components/shared/PageHeader';
import StatsCard from '@/components/shared/StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/shared/StatusBadge';
import {
  ClipboardList, GraduationCap, Award,
  AlertTriangle, Package, CheckCircle,
  ArrowRight, Clapperboard, Mail, Settings2
} from 'lucide-react';
import { showNeedsAction, parseDateSafe } from '@/lib/showUtils';
import { differenceInDays } from 'date-fns';
import ActionCenter from '@/components/admin/ActionCenter';

export default function AdminDashboard() {
  const { user, role } = useOutletContext();
  const navigate = useNavigate();

  // Redirect non-admins away immediately
  useEffect(() => {
    if (role && role !== 'admin') {
      navigate('/director', { replace: true });
    }
  }, [role]);

  if (role && role !== 'admin') return null;

  const { data: students = [], isLoading: ls } = useQuery({
    queryKey: ['admin-students'],
    queryFn: () => db.entities.Student.list(),
  });
  const { data: assignments = [], isLoading: la } = useQuery({
    queryKey: ['admin-assignments'],
    queryFn: () => db.entities.TechAssignment.list(),
  });
  const { data: badges = [], isLoading: lb } = useQuery({
    queryKey: ['admin-badges'],
    queryFn: () => db.entities.Badge.list(),
  });
  const { data: enrollments = [], isLoading: le } = useQuery({
    queryKey: ['admin-enrollments'],
    queryFn: () => db.entities.BadgeEnrollment.list(),
  });
  const { data: shows = [], isLoading: lsh } = useQuery({
    queryKey: ['admin-shows'],
    queryFn: () => db.entities.Show.list(),
  });
  const { data: trainings = [], isLoading: lt } = useQuery({
    queryKey: ['admin-trainings'],
    queryFn: () => db.entities.Training.list(),
  });
  const { data: pendingEmails = [] } = useQuery({
    queryKey: ['pending-emails'],
    queryFn: () => db.entities.PendingEmail.list('-created_date', 200),
  });
  const pendingEmailCount = pendingEmails.filter(e => e.status === 'pending').length;

  const isLoading = ls || la || lb || le || lsh || lt;

  const pendingApprovals = assignments.filter(a => a.status === 'pending_admin_approval').length;
  const pendingTrainingProposals = trainings.filter(t => t.status === 'proposed').length;
  const pendingBadgeReviews = enrollments.filter(e => e.status === 'pending_review').length;

  const today = new Date();

  const showsNeedingTech = shows.filter(s => showNeedsAction(s)).length;
  const showsEquipmentNotReserved = shows.filter(s =>
    s.status === 'upcoming' && !s.equipment_reserved &&
    (s.needs_lighting || s.needs_sound || s.needs_projection || s.needs_rigging)
  ).length;
  const showsAwaitingReturn = shows.filter(s => s.equipment_reserved && !s.equipment_returned && s.status === 'completed').length;

  // Active shows: upcoming/in_progress PLUS recently-closed shows that still need forms or payment
  const activeShows = shows.filter(s => {
    if (['upcoming', 'in_progress'].includes(s.status)) return true;
    if (s.status === 'completed') {
      // Keep if equipment not returned
      if (s.equipment_reserved && !s.equipment_returned) return true;
      // Keep if any assigned tech still has pending payment
      const techs = s.assigned_technicians || [];
      if (techs.some(t => t.payment_status === 'pending')) return true;
      // Keep for up to 21 days after tech_week_start for payment follow-up
      const techStart = parseDateSafe(s.tech_week_start);
      if (techStart && differenceInDays(today, techStart) <= 21) return true;
    }
    return false;
  });

  return (
    <div>
      <PageHeader title="Admin Dashboard" subtitle="Overview of all TechTrack operations" />

      {/* Top Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <Link to="/students"><StatsCard title="Students" value={isLoading ? '—' : students.length} icon={GraduationCap} color="blue" /></Link>
        <Link to="/admin/hub"><StatsCard title="Active Shows" value={isLoading ? '—' : activeShows.length} icon={Clapperboard} color="purple" /></Link>
        <Link to="/admin/tech-assignments"><StatsCard title="Tech Assignments" value={isLoading ? '—' : assignments.length} icon={ClipboardList} color="green" /></Link>
        <Link to="/students"><StatsCard title="Badges" value={isLoading ? '—' : badges.length} icon={Award} color="amber" /></Link>
      </div>

      {/* Action Center */}
      <Card className="mb-8">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />Action Center
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <ActionCenter
              assignments={assignments}
              shows={shows}
              pendingTrainingProposals={pendingTrainingProposals}
              pendingBadgeReviews={pendingBadgeReviews}
            />
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Shows Widget */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clapperboard className="w-5 h-5" />Shows Needing Attention
              </CardTitle>
              <Link to="/admin/hub"><Button variant="ghost" size="sm">View All <ArrowRight className="w-4 h-4 ml-1" /></Button></Link>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : (
              <div className="space-y-2">
                {showsNeedingTech > 0 && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-800">{showsNeedingTech} show{showsNeedingTech !== 1 ? 's' : ''} need tech support (within 90 days)</span>
                  </div>
                )}
                {showsEquipmentNotReserved > 0 && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <Package className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">{showsEquipmentNotReserved} show{showsEquipmentNotReserved !== 1 ? 's' : ''} with equipment not reserved</span>
                  </div>
                )}
                {showsAwaitingReturn > 0 && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">{showsAwaitingReturn} show{showsAwaitingReturn !== 1 ? 's' : ''} awaiting equipment return</span>
                  </div>
                )}
                {showsNeedingTech === 0 && showsEquipmentNotReserved === 0 && showsAwaitingReturn === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">All shows on track!</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Links */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Quick Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link to="/admin/tech-assignments" className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
              <ClipboardList className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Tech Assignments</p>
                <p className="text-xs text-muted-foreground">{assignments.length} total assignments</p>
              </div>
            </Link>
            <Link to="/students" className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
              <GraduationCap className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Badge Progress</p>
                <p className="text-xs text-muted-foreground">{enrollments.filter(e => e.status === 'in_progress').length} in progress</p>
              </div>
            </Link>
            <Link to="/admin/pending-emails" className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
              <Mail className="w-5 h-5 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">Email Outbox</p>
                <p className="text-xs text-muted-foreground">{pendingEmailCount > 0 ? `${pendingEmailCount} awaiting approval` : 'No pending emails'}</p>
              </div>
              {pendingEmailCount > 0 && (
                <span className="text-xs bg-amber-500 text-white rounded-full px-2 py-0.5 font-bold">{pendingEmailCount}</span>
              )}
            </Link>
            <Link to="/admin/email-templates" className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
              <Settings2 className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Email Templates</p>
                <p className="text-xs text-muted-foreground">Configure automated notifications</p>
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}