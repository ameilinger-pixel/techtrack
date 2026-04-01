import React from 'react';
import { Link } from 'react-router-dom';
import { differenceInDays } from 'date-fns';
import { parseDateSafe, crewCount } from '@/lib/showUtils';
import {
  ArrowRight, Phone, FileText, Users, Bell, ClipboardCheck,
  CreditCard, Clock, CheckCircle, Award, GraduationCap, AlertTriangle
} from 'lucide-react';

// ─── Actions from TechAssignment records ───────────────────────────────────
function getAssignmentActions(assignments, today) {
  const actions = [];

  const pending = assignments.filter(a => a.status === 'pending_admin_approval');
  if (pending.length > 0) {
    actions.push({
      key: 'pending_approvals',
      color: 'orange',
      icon: Clock,
      label: `${pending.length} tech request${pending.length !== 1 ? 's' : ''} waiting for admin approval`,
      link: '/admin/tech-assignments',
      priority: 0,
    });
  }

  assignments.forEach(a => {
    if (a.status === 'cancelled' || a.status === 'completed') return;
    const techStart = parseDateSafe(a.tech_week_start) || parseDateSafe(a.first_tech_date) || parseDateSafe(a.opening_night);
    if (!techStart) return;
    const daysUntil = differenceInDays(techStart, today);

    if (daysUntil <= 35 && daysUntil > 30 && a.status === 'requested') {
      actions.push({ key: `assign_${a.id}`, color: 'purple', icon: Users, label: `Assign technician for "${a.show_title}" — 5 weeks out`, link: '/admin/tech-assignments', priority: 1 });
    }
    if (daysUntil <= 30 && daysUntil > 0 && ['requested', 'pending_admin_approval'].includes(a.status)) {
      actions.push({ key: `notify_dir_${a.id}`, color: 'red', icon: Bell, label: `No tech assigned for "${a.show_title}" — notify director (${daysUntil} days left)`, link: '/admin/tech-assignments', priority: 0 });
    }
    if (daysUntil <= 7 && daysUntil > 0 && ['assigned', 'confirmed'].includes(a.status)) {
      actions.push({ key: `crew_form_${a.id}`, color: 'indigo', icon: ClipboardCheck, label: `Prepare crew assignment form for "${a.show_title}" (tech week in ${daysUntil} day${daysUntil !== 1 ? 's' : ''})`, link: '/admin/tech-assignments', priority: 1 });
    }
    if (daysUntil < 0 && daysUntil >= -14 && ['assigned', 'confirmed'].includes(a.status) && !a.crew_assignment_form_submitted) {
      actions.push({ key: `form_due_${a.id}`, color: 'orange', icon: ClipboardCheck, label: `Crew assignment form not submitted for "${a.show_title}"`, link: '/admin/tech-assignments', priority: 0 });
    }
    if (daysUntil < -7 && daysUntil >= -21 && ['assigned', 'confirmed', 'completed'].includes(a.status) && a.payment_status === 'pending') {
      actions.push({ key: `payment_${a.id}`, color: 'green', icon: CreditCard, label: `Check payment for "${a.show_title}"`, link: '/admin/tech-assignments', priority: 2 });
    }
  });

  return actions;
}

// ─── Actions from Show records ──────────────────────────────────────────────
function getShowActions(shows, today) {
  const actions = [];

  shows.forEach(s => {
    // Skip declined, archived, completed, no technician needed
    if (['archived', 'completed'].includes(s.status)) return;
    if (s.tech_support_declined) return;
    if (!s.needs_technician && crewCount(s) > 0) return;

    const techStart = parseDateSafe(s.tech_week_start) || parseDateSafe(s.opening_night);
    if (!techStart) return;

    const daysUntil = differenceInDays(techStart, today);

    // Only care about shows within 90 days and not more than 7 days past
    if (daysUntil > 90 || daysUntil < -7) return;

    const hasCrew = crewCount(s) > 0;
    const wasContacted = !!s.director_contacted_date;
    const hasApplication = !!(s.posting_created_date || s.application_link_url ||
      (s.show_files && s.show_files.some(f => ['application','application_link'].includes((f.category||'').toLowerCase()))));

    const title = s.title || 'Untitled Show';

    // 90 days out: contact director
    if (daysUntil <= 90 && daysUntil > 60 && !wasContacted && !hasCrew) {
      actions.push({ key: `show_contact_${s.id}`, color: 'blue', icon: Phone, label: `Contact director for "${title}" (tech week in ${daysUntil} days)`, link: '/admin/hub', priority: 2 });
    }

    // 60 days out: post application / create posting
    if (daysUntil <= 60 && daysUntil > 30 && !hasApplication && !hasCrew) {
      actions.push({ key: `show_post_${s.id}`, color: 'amber', icon: FileText, label: `Post application for "${title}" (${daysUntil} days to tech week)`, link: '/admin/hub', priority: 1 });
    }

    // 30 days out: still no tech — urgent
    if (daysUntil <= 30 && daysUntil > 0 && !hasCrew) {
      actions.push({ key: `show_urgent_${s.id}`, color: 'red', icon: AlertTriangle, label: `No technician assigned for "${title}" — ${daysUntil} day${daysUntil !== 1 ? 's' : ''} to tech week!`, link: '/admin/hub', priority: 0 });
    }

    // Payment pending after show
    if (daysUntil < 0 && daysUntil >= -21) {
      const techs = Array.isArray(s.assigned_technicians) ? s.assigned_technicians : [];
      const unpaid = techs.filter(t => t.payment_status === 'unpaid' || t.payment_status === 'pending');
      if (unpaid.length > 0) {
        actions.push({ key: `show_pay_${s.id}`, color: 'green', icon: CreditCard, label: `Process payment for crew on "${title}"`, link: '/admin/hub', priority: 2 });
      }
    }
  });

  return actions;
}

const COLOR_MAP = {
  orange: 'bg-orange-50 border-orange-200 hover:bg-orange-100 text-orange-800 [&_svg]:text-orange-600',
  amber:  'bg-amber-50  border-amber-200  hover:bg-amber-100  text-amber-800  [&_svg]:text-amber-600',
  blue:   'bg-blue-50   border-blue-200   hover:bg-blue-100   text-blue-800   [&_svg]:text-blue-600',
  purple: 'bg-purple-50 border-purple-200 hover:bg-purple-100 text-purple-800 [&_svg]:text-purple-600',
  red:    'bg-red-50    border-red-200    hover:bg-red-100    text-red-800    [&_svg]:text-red-600',
  green:  'bg-green-50  border-green-200  hover:bg-green-100  text-green-800  [&_svg]:text-green-600',
  indigo: 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100 text-indigo-800 [&_svg]:text-indigo-600',
};

export default function ActionCenter({ assignments = [], shows = [], pendingTrainingProposals = 0, pendingBadgeReviews = 0 }) {
  const today = new Date();

  const actions = [
    ...getAssignmentActions(assignments, today),
    ...getShowActions(shows, today),
  ];

  if (pendingTrainingProposals > 0) {
    actions.push({ key: 'training', color: 'blue', icon: GraduationCap, label: `${pendingTrainingProposals} pending training proposal${pendingTrainingProposals !== 1 ? 's' : ''}`, link: null, priority: 3 });
  }
  if (pendingBadgeReviews > 0) {
    actions.push({ key: 'badges', color: 'purple', icon: Award, label: `${pendingBadgeReviews} pending badge review${pendingBadgeReviews !== 1 ? 's' : ''}`, link: null, priority: 3 });
  }

  actions.sort((a, b) => a.priority - b.priority);

  if (actions.length === 0) {
    return (
      <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
        <CheckCircle className="w-4 h-4 text-green-500" />
        All caught up! No pending actions.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {actions.map(action => {
        const Icon = action.icon;
        const colorCls = COLOR_MAP[action.color] || COLOR_MAP.orange;
        const inner = (
          <div className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${colorCls}`}>
            <div className="flex items-center gap-3">
              <Icon className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">{action.label}</span>
            </div>
            {action.link && <ArrowRight className="w-4 h-4 shrink-0" />}
          </div>
        );
        return action.link
          ? <Link key={action.key} to={action.link}>{inner}</Link>
          : <div key={action.key}>{inner}</div>;
      })}
    </div>
  );
}