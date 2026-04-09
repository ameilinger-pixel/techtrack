// @ts-nocheck
import { db } from '@/lib/backend/client';

import React, { useEffect, useState, useRef } from 'react';
import { useOutletContext, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { runEmailEngine } from '@/lib/emailEngine';
import { showNeedsAction, parseDateSafe, crewCount } from '@/lib/showUtils';
import { differenceInDays, format, formatDistanceToNow } from 'date-fns';
import ShowDetailModal from '@/components/admin/ShowDetailModal';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  Mail, Send, X, Loader2, ChevronRight, AlertTriangle,
  CheckCircle, Clapperboard, Users, Clock, CreditCard,
  Phone, FileText, ClipboardCheck, Bell, RefreshCw,
  GraduationCap, Award
} from 'lucide-react';

// ─── colour map for action items ────────────────────────────────────────────
const COLOR = {
  red:    'bg-red-50    border-red-200    text-red-800    [&_svg]:text-red-500',
  orange: 'bg-orange-50 border-orange-200 text-orange-800 [&_svg]:text-orange-500',
  amber:  'bg-amber-50  border-amber-200  text-amber-800  [&_svg]:text-amber-500',
  blue:   'bg-blue-50   border-blue-200   text-blue-800   [&_svg]:text-blue-500',
  purple: 'bg-purple-50 border-purple-200 text-purple-800 [&_svg]:text-purple-500',
  green:  'bg-green-50  border-green-200  text-green-800  [&_svg]:text-green-500',
  indigo: 'bg-indigo-50 border-indigo-200 text-indigo-800 [&_svg]:text-indigo-500',
};

const ICON_MAP = {
  Phone, FileText, Users, Bell, ClipboardCheck, CreditCard,
  AlertTriangle, GraduationCap, Award,
};

// ─── greeting ───────────────────────────────────────────────────────────────
function greeting(name) {
  const h = new Date().getHours();
  const first = (name || 'there').split(' ')[0];
  if (h < 12) return `Good morning, ${first}`;
  if (h < 17) return `Good afternoon, ${first}`;
  return `Good evening, ${first}`;
}

// ─── build action list (same logic as ActionCenter) ────────────────────────
function buildActions(assignments, shows) {
  const today = new Date();
  const actions = [];

  // from assignments
  const pending = assignments.filter(a => a.status === 'pending_admin_approval');
  if (pending.length)
    actions.push({ key: 'pending_approvals', color: 'orange', icon: 'Clock', label: `${pending.length} tech request${pending.length !== 1 ? 's' : ''} pending admin approval`, showId: null, priority: 0 });

  assignments.forEach(a => {
    if (['cancelled','completed'].includes(a.status)) return;
    const techStart = parseDateSafe(a.tech_week_start) || parseDateSafe(a.first_tech_date) || parseDateSafe(a.opening_night);
    if (!techStart) return;
    const d = differenceInDays(techStart, today);
    if (d <= 35 && d > 30 && a.status === 'requested')
      actions.push({ key: `assign_${a.id}`, color: 'purple', icon: 'Users', label: `Assign tech for "${a.show_title}" — 5 weeks out`, priority: 1 });
    if (d <= 30 && d > 0 && ['requested','pending_admin_approval'].includes(a.status))
      actions.push({ key: `notify_${a.id}`, color: 'red', icon: 'Bell', label: `No tech assigned — "${a.show_title}" in ${d}d`, priority: 0 });
    if (d <= 7 && d > 0 && ['assigned','confirmed'].includes(a.status))
      actions.push({ key: `crew_form_${a.id}`, color: 'indigo', icon: 'ClipboardCheck', label: `Prep crew form for "${a.show_title}" — tech week in ${d}d`, priority: 1 });
    if (d < 0 && d >= -14 && ['assigned','confirmed'].includes(a.status) && !a.crew_assignment_form_submitted)
      actions.push({ key: `form_due_${a.id}`, color: 'orange', icon: 'ClipboardCheck', label: `Crew form not submitted — "${a.show_title}"`, priority: 0 });
    if (d < -7 && d >= -21 && a.payment_status === 'pending')
      actions.push({ key: `pay_${a.id}`, color: 'green', icon: 'CreditCard', label: `Process payment for "${a.show_title}"`, priority: 2 });
  });

  // from shows
  shows.forEach(s => {
    if (['archived','completed'].includes(s.status)) return;
    if (s.tech_support_declined) return;
    const techStart = parseDateSafe(s.tech_week_start) || parseDateSafe(s.opening_night);
    if (!techStart) return;
    const d = differenceInDays(techStart, today);
    if (d > 90 || d < -7) return;
    const hasCrew = crewCount(s) > 0;
    const wasContacted = !!s.director_contacted_date;
    const hasPosting = !!(s.posting_created_date || s.application_link_url);
    const title = s.title || 'Untitled';
    if (d <= 90 && d > 60 && !wasContacted && !hasCrew)
      actions.push({ key: `contact_${s.id}`, color: 'blue', icon: 'Phone', label: `Contact director — "${title}" (${d}d)`, showId: s.id, action: 'contact_director', priority: 2 });
    if (d <= 60 && d > 30 && !hasPosting && !hasCrew)
      actions.push({ key: `post_${s.id}`, color: 'amber', icon: 'FileText', label: `Post application — "${title}" (${d}d)`, showId: s.id, action: 'post_application', priority: 1 });
    if (d <= 30 && d > 0 && !hasCrew)
      actions.push({ key: `urgent_${s.id}`, color: 'red', icon: 'AlertTriangle', label: `No tech! "${title}" — ${d} day${d !== 1 ? 's' : ''} to tech week`, showId: s.id, priority: 0 });
  });

  return actions.sort((a, b) => a.priority - b.priority);
}

// ─── main component ──────────────────────────────────────────────────────────
export default function CommandCenter() {
  const { user, role } = useOutletContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const scannedRef = useRef(false);

  const [selectedShow, setSelectedShow] = useState(null);
  const [previewEmail, setPreviewEmail] = useState(null);
  const [editedBody, setEditedBody] = useState('');
  const [sending, setSending] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [dismissedActions, setDismissedActions] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('dismissed_actions') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    if (role && role !== 'admin') navigate('/director/portal', { replace: true });
  }, [role]);

  const adminEnabled = role === 'admin';

  // ── queries ──
  const { data: shows = [], isLoading: lsh } = useQuery({ queryKey: ['cc-shows'], queryFn: () => db.entities.Show.list('-updated_date', 500), enabled: adminEnabled });
  const { data: assignments = [], isLoading: la } = useQuery({ queryKey: ['cc-assignments'], queryFn: () => db.entities.TechAssignment.list('-updated_date', 500), enabled: adminEnabled });
  const { data: students = [] } = useQuery({ queryKey: ['cc-students'], queryFn: () => db.entities.Student.list(), enabled: adminEnabled });
  const { data: trainings = [] } = useQuery({ queryKey: ['cc-trainings'], queryFn: () => db.entities.Training.list(), enabled: adminEnabled });
  const { data: enrollments = [] } = useQuery({ queryKey: ['cc-enrollments'], queryFn: () => db.entities.BadgeEnrollment.list(), enabled: adminEnabled });
  const { data: pendingEmails = [], isLoading: lpe } = useQuery({ queryKey: ['cc-pending-emails'], queryFn: () => db.entities.PendingEmail.list('-created_date', 200), enabled: adminEnabled });
  const { data: templates = [] } = useQuery({ queryKey: ['cc-templates'], queryFn: () => db.entities.EmailTemplate.list(), enabled: adminEnabled });
  const { data: events = [] } = useQuery({ queryKey: ['cc-activity-events'], queryFn: () => db.entities.ActivityEvent.list('-created_date', 300), enabled: adminEnabled });

  const isLoading = lsh || la || lpe;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['cc-shows'] });
    qc.invalidateQueries({ queryKey: ['cc-assignments'] });
    qc.invalidateQueries({ queryKey: ['cc-pending-emails'] });
  };

  // ── auto-scan emails once on load ──
  useEffect(() => {
    if (scannedRef.current) return;
    if (!assignments.length || !templates.length) return;
    scannedRef.current = true;
    (async () => {
      setScanning(true);
      const queued = await runEmailEngine(assignments, templates, pendingEmails);
      if (queued.length) {
        toast({ title: `${queued.length} new email${queued.length !== 1 ? 's' : ''} queued` });
        qc.invalidateQueries({ queryKey: ['cc-pending-emails'] });
      }
      setScanning(false);
    })();
  }, [assignments.length, templates.length]);

  if (role && role !== 'admin') return null;

  // ── derived data ──
  const today = new Date();
  const dateLabel = format(today, 'EEEE, MMMM d');

  const rawActions = buildActions(assignments, shows);
  const visibleActions = rawActions.filter(a => !dismissedActions.includes(a.key));

  const pendingQueue = pendingEmails.filter(e => e.status === 'pending');
  const sentEmails   = pendingEmails.filter(e => e.status === 'sent');
  const stalePendingEmails = pendingQueue.filter((e) => {
    if (!e.created_date) return false;
    return differenceInDays(new Date(), new Date(e.created_date)) >= 5;
  });
  const latestEventByPendingEmail = events.reduce((acc, event) => {
    if (!event.pending_email_id) return acc;
    if (!acc[event.pending_email_id]) acc[event.pending_email_id] = event;
    return acc;
  }, {});

  const thisWeekShows = shows.filter(s => {
    const d = parseDateSafe(s.tech_week_start);
    if (!d) return false;
    const diff = differenceInDays(d, today);
    return diff >= -1 && diff <= 7;
  }).sort((a, b) => {
    const da = parseDateSafe(a.tech_week_start);
    const db_ = parseDateSafe(b.tech_week_start);
    return (da?.getTime() || 0) - (db_?.getTime() || 0);
  });

  const nextShows = shows.filter(s => {
    const d = parseDateSafe(s.tech_week_start);
    if (!d) return false;
    const diff = differenceInDays(d, today);
    return diff > 7 && diff <= 30 && s.status !== 'archived';
  }).sort((a, b) => {
    const da = parseDateSafe(a.tech_week_start);
    const db_ = parseDateSafe(b.tech_week_start);
    return (da?.getTime() || 0) - (db_?.getTime() || 0);
  }).slice(0, 5);

  // ── stats ──
  const activeShows = shows.filter(s => ['upcoming','in_progress'].includes(s.status)).length;
  const unassigned  = shows.filter(s => s.status === 'upcoming' && crewCount(s) === 0 && !s.tech_support_declined).length;
  const pendingTrainingProposals = trainings.filter(t => t.status === 'proposed').length;
  const pendingBadgeReviews = enrollments.filter(e => e.status === 'pending_review').length;

  // ── inline action handlers ──
  const handleMarkContacted = async (showId, actionKey) => {
    await db.entities.Show.update(showId, { director_contacted_date: today.toISOString().slice(0, 10) });
    dismiss(actionKey);
    refresh();
    toast({ title: 'Director marked as contacted' });
  };

  const handleMarkPosted = async (showId, actionKey) => {
    await db.entities.Show.update(showId, {
      posting_created_date: today.toISOString().slice(0, 10),
      workflow_status: 'posting_open',
    });
    dismiss(actionKey);
    refresh();
    toast({ title: 'Application posting recorded' });
  };

  const dismiss = (key) => {
    const next = [...dismissedActions, key];
    setDismissedActions(next);
    try { sessionStorage.setItem('dismissed_actions', JSON.stringify(next)); } catch {}
  };

  // ── email handlers ──
  const openEmail = (email) => {
    setPreviewEmail(email);
    setEditedBody(email.body || '');
  };

  const handleSend = async (email) => {
    setSending(email.id);
    const body = editedBody || email.body;
    const actorId = user?.id || user?.email || null;
    const actorRole = role || null;
    try {
      if (body !== email.body) await db.entities.PendingEmail.update(email.id, { body });
      const providerResponse = await db.integrations.Core.SendEmail({ to: email.to, subject: email.subject, body });
      await db.entities.PendingEmail.update(email.id, {
        status: 'sent',
        sent_at: new Date().toISOString(),
        sent_by: actorId,
        provider_message_id: providerResponse?.id || providerResponse?.messageId || null,
        delivery_status: 'sent',
        error_message: null,
      });
      await db.activity.log({
        event_type: 'email_sent',
        source: 'command_center',
        actor_id: actorId,
        actor_role: actorRole,
        assignment_id: email.assignment_id || null,
        pending_email_id: email.id,
        summary: `Email sent to ${email.to}`,
        metadata: { trigger: email.trigger, show_title: email.show_title || null },
      });
      toast({ title: `Sent to ${email.to}` });
    } catch (err) {
      await db.entities.PendingEmail.update(email.id, {
        delivery_status: 'failed',
        error_message: String(err?.message || err),
        retry_count: (email.retry_count || 0) + 1,
      });
      try {
        await db.activity.log({
          event_type: 'email_failed',
          source: 'command_center',
          actor_id: actorId,
          actor_role: actorRole,
          assignment_id: email.assignment_id || null,
          pending_email_id: email.id,
          summary: `Email failed for ${email.to}`,
          metadata: { error: String(err?.message || err) },
        });
      } catch (_) {}
      toast({ title: 'Send failed', description: String(err?.message || err), variant: 'destructive' });
    }
    setPreviewEmail(null);
    setEditedBody('');
    setSending(null);
    refresh();
    qc.invalidateQueries({ queryKey: ['cc-activity-events'] });
  };

  const handleReject = async (email) => {
    await db.entities.PendingEmail.update(email.id, { status: 'rejected' });
    toast({ title: 'Email rejected' });
    setPreviewEmail(null);
    refresh();
  };

  // ── render ──
  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">

      {/* ── Header ── */}
      <div className="flex items-end justify-between flex-wrap gap-3 pt-2">
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">{dateLabel}</p>
          <h1 className="text-2xl font-bold">{greeting(user?.full_name)}</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {scanning && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />Scanning emails…
            </span>
          )}
          <Button variant="outline" size="sm" onClick={async () => {
            setScanning(true);
            const queued = await runEmailEngine(assignments, templates, pendingEmails);
            toast({ title: queued.length ? `${queued.length} new email${queued.length !== 1 ? 's' : ''} queued` : 'No new emails' });
            qc.invalidateQueries({ queryKey: ['cc-pending-emails'] });
            setScanning(false);
          }} disabled={scanning}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${scanning ? 'animate-spin' : ''}`} />Scan emails
          </Button>
          <Link to="/admin/hub"><Button size="sm">Open Hub →</Button></Link>
        </div>
      </div>

      {/* ── Pulse strip ── */}
      {!isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Active shows', value: activeShows, color: 'text-blue-600', sub: `${unassigned} unassigned` },
            { label: 'Action items', value: visibleActions.length, color: visibleActions.length > 0 ? 'text-amber-600' : 'text-green-600', sub: visibleActions.length === 0 ? 'All clear!' : 'need attention' },
            { label: 'Emails to send', value: pendingQueue.length, color: pendingQueue.length > 0 ? 'text-orange-600' : 'text-muted-foreground', sub: `${sentEmails.length} sent` },
            { label: 'Students', value: students.length, color: 'text-purple-600', sub: `${enrollments.filter(e=>e.status==='in_progress').length} in badge progress` },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs font-medium text-foreground mt-0.5">{s.label}</p>
              <p className="text-xs text-muted-foreground">{s.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Action Items ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Action Items
            {visibleActions.length > 0 && <Badge variant="secondary">{visibleActions.length}</Badge>}
          </h2>
          {dismissedActions.length > 0 && (
            <button
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => { setDismissedActions([]); sessionStorage.removeItem('dismissed_actions'); }}
            >
              Show all ({dismissedActions.length} hidden)
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
        ) : visibleActions.length === 0 ? (
          <div className="flex items-center gap-2 p-4 rounded-xl border border-green-200 bg-green-50 text-sm text-green-800">
            <CheckCircle className="w-4 h-4 text-green-500" />All caught up — nothing needs attention right now.
          </div>
        ) : (
          <div className="space-y-2">
            {visibleActions.map(action => {
              const Icon = ICON_MAP[action.icon] || AlertTriangle;
              const colorCls = COLOR[action.color] || COLOR.amber;
              return (
                <div key={action.key} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${colorCls}`}>
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm font-medium flex-1">{action.label}</span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {action.action === 'contact_director' && (
                      <Button size="sm" variant="outline" className="h-6 text-xs px-2"
                        onClick={() => handleMarkContacted(action.showId, action.key)}>
                        ✓ Mark contacted
                      </Button>
                    )}
                    {action.action === 'post_application' && (
                      <Button size="sm" variant="outline" className="h-6 text-xs px-2"
                        onClick={() => handleMarkPosted(action.showId, action.key)}>
                        ✓ Mark posted
                      </Button>
                    )}
                    {action.showId && !action.action && (
                      <button onClick={() => setSelectedShow(shows.find(s => s.id === action.showId))}
                        className="p-1 rounded hover:bg-black/5 transition-colors">
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => dismiss(action.key)}
                      className="p-1 rounded hover:bg-black/10 transition-colors opacity-50 hover:opacity-100"
                      title="Dismiss (until refresh)">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Email Queue ── */}
      {(pendingQueue.length > 0 || lpe) && (
        <section>
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Mail className="w-4 h-4 text-orange-500" />
            Emails Waiting to Send
            <Badge variant="secondary">{pendingQueue.length}</Badge>
          </h2>
          {lpe ? (
            <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
          ) : (
            <div className="space-y-2">
              {pendingQueue.map(email => (
                <div key={email.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border border-orange-200 bg-orange-50 cursor-pointer hover:bg-orange-100 transition-colors"
                  onClick={() => openEmail(email)}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-orange-900 truncate">{email.subject}</p>
                    <p className="text-xs text-orange-700 truncate">
                      {email.to_name ? `${email.to_name} · ` : ''}{email.to}
                      {email.show_title && ` · ${email.show_title}`}
                    </p>
                    {latestEventByPendingEmail[email.id]?.source && (
                      <p className="text-[11px] text-orange-700/80 mt-0.5">
                        Last touch: {latestEventByPendingEmail[email.id].source}
                        {latestEventByPendingEmail[email.id].created_date ? ` · ${formatDistanceToNow(new Date(latestEventByPendingEmail[email.id].created_date), { addSuffix: true })}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button size="sm" className="h-7 text-xs" onClick={e => { e.stopPropagation(); handleSend(email); }} disabled={sending === email.id}>
                      {sending === email.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Send className="w-3 h-3 mr-1" />Send</>}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={e => { e.stopPropagation(); handleReject(email); }}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {stalePendingEmails.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            Stale Pending Emails
            <Badge variant="secondary">{stalePendingEmails.length}</Badge>
          </h2>
          <div className="space-y-2">
            {stalePendingEmails.map((email) => (
              <div key={email.id} className="p-3 rounded-lg border border-red-200 bg-red-50">
                <p className="text-sm font-medium text-red-900">{email.subject}</p>
                <p className="text-xs text-red-700 mt-0.5">{email.to} {email.show_title ? `· ${email.show_title}` : ''}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── This Week's Shows ── */}
      {(thisWeekShows.length > 0 || isLoading) && (
        <section>
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Clapperboard className="w-4 h-4 text-blue-500" />
            In Tech Week
            <Badge variant="secondary">{thisWeekShows.length}</Badge>
          </h2>
          {isLoading ? (
            <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
          ) : (
            <div className="space-y-2">
              {thisWeekShows.map(s => {
                const d = parseDateSafe(s.tech_week_start);
                const diff = d ? differenceInDays(d, today) : null;
                const crew = crewCount(s);
                return (
                  <div key={s.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-blue-200 bg-blue-50 cursor-pointer hover:bg-blue-100 transition-colors"
                    onClick={() => setSelectedShow(s)}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-blue-900 truncate">{s.title}</p>
                      <p className="text-xs text-blue-700">
                        {s.director_name && `${s.director_name} · `}
                        {s.theater && `${s.theater} · `}
                        {crew > 0 ? `${crew} crew assigned` : '⚠ No crew'}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-xs font-bold text-blue-800">
                        {diff === 0 ? 'Starts today' : diff < 0 ? `Day ${Math.abs(diff) + 1}` : `In ${diff}d`}
                      </p>
                      <p className="text-xs text-blue-600">{d ? format(d, 'MMM d') : ''}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ── Coming Up (next 30 days) ── */}
      {nextShows.length > 0 && !isLoading && (
        <section>
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-muted-foreground" />
            Coming Up — Next 30 Days
          </h2>
          <div className="space-y-1.5">
            {nextShows.map(s => {
              const d = parseDateSafe(s.tech_week_start);
              const diff = d ? differenceInDays(d, today) : null;
              const crew = crewCount(s);
              const action = showNeedsAction(s);
              return (
                <div key={s.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-card cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => setSelectedShow(s)}>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate">{s.title}</span>
                    {s.director_name && <span className="text-xs text-muted-foreground ml-2">{s.director_name}</span>}
                  </div>
                  {action && (
                    <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full hidden sm:inline flex-shrink-0">
                      {action.replace(/_/g, ' ')}
                    </span>
                  )}
                  <span className={`text-xs font-semibold flex-shrink-0 ${diff <= 14 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                    {diff}d
                  </span>
                  {crew > 0
                    ? <Users className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    : <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  }
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                </div>
              );
            })}
            <Link to="/admin/hub" className="block text-xs text-center text-muted-foreground hover:text-foreground pt-1 transition-colors">
              View all shows →
            </Link>
          </div>
        </section>
      )}

      {/* ── All clear state ── */}
      {!isLoading && visibleActions.length === 0 && pendingQueue.length === 0 && thisWeekShows.length === 0 && nextShows.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
          <p className="font-medium text-foreground">Everything's on track</p>
          <p className="text-sm mt-1">No shows in tech week, no pending emails, no action items.</p>
          <Link to="/admin/hub" className="mt-4 inline-block">
            <Button variant="outline" size="sm">Go to Hub</Button>
          </Link>
        </div>
      )}

      {/* ── Modals ── */}
      <ShowDetailModal
        show={selectedShow}
        open={!!selectedShow}
        onClose={() => setSelectedShow(null)}
        onUpdated={refresh}
      />

      {previewEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPreviewEmail(null)}>
          <div className="bg-background rounded-2xl border border-border w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Review Email</h3>
                <button onClick={() => setPreviewEmail(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="font-medium">To: </span>{previewEmail.to_name ? `${previewEmail.to_name} <${previewEmail.to}>` : previewEmail.to}</div>
                <div><span className="font-medium">Show: </span>{previewEmail.show_title || '—'}</div>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Subject</p>
                <p className="text-sm border rounded px-3 py-2 bg-muted">{previewEmail.subject}</p>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Body <span className="text-xs text-muted-foreground font-normal">(editable)</span></p>
                <Textarea value={editedBody} onChange={e => setEditedBody(e.target.value)} rows={10} className="text-sm font-mono" />
              </div>
              {editedBody && (
                <div className="border rounded p-3 text-sm bg-white prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: editedBody }} />
              )}
              <div className="flex gap-2 pt-1">
                <Button className="flex-1" onClick={() => handleSend(previewEmail)} disabled={!!sending}>
                  {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                  Approve & Send
                </Button>
                <Button variant="outline" onClick={() => handleReject(previewEmail)}>
                  <X className="w-4 h-4 mr-1" />Reject
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
