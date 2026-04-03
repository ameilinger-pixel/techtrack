import React, { useState } from 'react';

import { db } from '@/lib/backend/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/shared/PageHeader';
import StatsCard from '@/components/shared/StatsCard';
import ShowCard from '@/components/admin/ShowCard';
import AddShowModal from '@/components/admin/AddShowModal';
import ShowDetailModal from '@/components/admin/ShowDetailModal';
import ActionCenter from '@/components/admin/ActionCenter';
import EmptyState from '@/components/shared/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Plus, Search, AlertTriangle, Users, Clock, CheckCircle, Clapperboard, Filter, X, ChevronRight, Inbox
} from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { parseDateSafe } from '@/lib/showUtils';
import { showNeedsAction, getUrgencyBucket, crewCount } from '@/lib/showUtils';

const ButtonAny = /** @type {any} */ (Button);
const CardAny = /** @type {any} */ (Card);
const CardHeaderAny = /** @type {any} */ (CardHeader);
const CardTitleAny = /** @type {any} */ (CardTitle);
const CardContentAny = /** @type {any} */ (CardContent);
const TabsListAny = /** @type {any} */ (TabsList);
const TabsTriggerAny = /** @type {any} */ (TabsTrigger);
const TabsContentAny = /** @type {any} */ (TabsContent);
const ShowDetailModalAny = /** @type {any} */ (ShowDetailModal);

export default function AdminHub() {
  const [search, setSearch] = useState('');
  const [selectedShow, setSelectedShow] = useState(null);
  const [addModal, setAddModal] = useState(false);
  const [quickFilter, setQuickFilter] = useState(null);
  const queryClient = useQueryClient();

  const { data: shows = [], isLoading } = useQuery({
    queryKey: ['hub-shows'],
    queryFn: () => db.entities.Show.list('-updated_date', 500),
  });
  const { data: assignments = [], isLoading: la } = useQuery({
    queryKey: ['hub-assignments'],
    queryFn: () => db.entities.TechAssignment.list('-updated_date', 500),
  });
  const { data: trainings = [] } = useQuery({
    queryKey: ['hub-trainings'],
    queryFn: () => db.entities.Training.list(),
  });
  const { data: enrollments = [] } = useQuery({
    queryKey: ['hub-enrollments'],
    queryFn: () => db.entities.BadgeEnrollment.list(),
  });

  const pendingTrainingProposals = trainings.filter(t => t.status === 'proposed').length;
  const pendingBadgeReviews = enrollments.filter(e => e.status === 'pending_review').length;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['hub-shows'] });
    queryClient.invalidateQueries({ queryKey: ['hub-assignments'] });
  };

  const handleMarkContacted = async (e, showId) => {
    e.stopPropagation();
    const today = new Date().toISOString().split('T')[0];
    await db.entities.Show.update(showId, { director_contacted_date: today });
    refresh();
  };

  const handleCreatePosting = async (e, showId) => {
    e.stopPropagation();
    const today = new Date().toISOString().split('T')[0];
    await db.entities.Show.update(showId, {
      posting_created_date: today,
      workflow_status: 'posting_open',
    });
    refresh();
  };

  const filteredShows = shows.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q || (
      s.title?.toLowerCase().includes(q) ||
      s.director_name?.toLowerCase().includes(q) ||
      s.theater?.toLowerCase().includes(q)
    );
    if (!matchSearch) return false;

    if (quickFilter === 'needs_action') return showNeedsAction(s);
    if (quickFilter === 'declined') return s.tech_support_declined;
    if (quickFilter === 'application_live') return s.workflow_status === 'posting_open' || s.workflow_status === 'posting_created';
    return true;
  });

  // Stats
  const needsAction = shows.filter(s => showNeedsAction(s)).length;
  const assigned = shows.filter(s => crewCount(s) > 0).length;
  const inProgress = shows.filter(s => s.status === 'in_progress').length;
  const onTrack = shows.filter(s => s.status === 'upcoming' && !showNeedsAction(s) && !s.tech_support_declined).length;

  // Inbox: upcoming shows that need action, sorted by urgency
  const inboxShows = shows
    .filter(s => s.status === 'upcoming' && !s.tech_support_declined && showNeedsAction(s))
    .sort((a, b) => {
      const da = parseDateSafe(a.tech_week_start);
      const db = parseDateSafe(b.tech_week_start);
      return (da?.getTime() || 0) - (db?.getTime() || 0);
    })
    .slice(0, 8);

  const ACTION_LABEL = {
    contact_director: 'Contact director',
    post_application: 'Post application',
    notify_director: 'Notify director — tech week in ≤30d',
    print_crew_form: 'Print crew form (tech week soon)',
    return_equipment: 'Equipment needs to be returned',
  };

  // Tab filters
  const upcoming = filteredShows.filter(s => s.status === 'upcoming');
  const kanbanBuckets = {
    '90_days': upcoming.filter(s => getUrgencyBucket(s) === '90_days'),
    '60_days': upcoming.filter(s => getUrgencyBucket(s) === '60_days'),
    '30_days': upcoming.filter(s => getUrgencyBucket(s) === '30_days'),
    'this_week': upcoming.filter(s => getUrgencyBucket(s) === 'this_week'),
  };

  const tabShows = {
    upcoming: upcoming,
    assigned: filteredShows.filter(s => crewCount(s) > 0),
    in_progress: filteredShows.filter(s => s.status === 'in_progress'),
    future: filteredShows.filter(s => getUrgencyBucket(s) === 'future'),
    archived: filteredShows.filter(s => s.status === 'archived'),
    completed: filteredShows.filter(s => s.status === 'completed'),
  };

  // Calendar: all shows with a tech_week_start date
  const calendarShows = shows.filter(s => s.tech_week_start && s.status !== 'archived');

  return (
    <div>
      <PageHeader title="Admin Hub" subtitle="Manage all shows and their workflows">
        <ButtonAny onClick={() => setAddModal(true)}><Plus className="w-4 h-4 mr-2" />Add Show</ButtonAny>
      </PageHeader>

      {/* Action Center */}
      <CardAny className="mb-6">
        <CardHeaderAny className="pb-3">
          <CardTitleAny className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />Action Center
          </CardTitleAny>
        </CardHeaderAny>
        <CardContentAny>
          {isLoading || la ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <ActionCenter
              assignments={assignments}
              shows={shows}
              pendingTrainingProposals={pendingTrainingProposals}
              pendingBadgeReviews={pendingBadgeReviews}
            />
          )}
        </CardContentAny>
      </CardAny>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatsCard title="Needs Action" value={needsAction} icon={AlertTriangle} color="red" onClick={() => setQuickFilter(quickFilter === 'needs_action' ? null : 'needs_action')} />
        <StatsCard title="Assigned" value={assigned} icon={Users} color="purple" />
        <StatsCard title="In Progress" value={inProgress} icon={Clock} color="amber" />
        <StatsCard title="On Track" value={onTrack} icon={CheckCircle} color="green" />
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search shows..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2">
          {[
            { key: 'needs_action', label: 'Needs Action', color: 'text-red-600' },
            { key: 'declined', label: 'Declined' },
            { key: 'application_live', label: 'Application Live' },
          ].map(f => (
            <ButtonAny
              key={f.key}
              variant={quickFilter === f.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setQuickFilter(quickFilter === f.key ? null : f.key)}
            >
              <Filter className="w-3 h-3 mr-1" />{f.label}
            </ButtonAny>
          ))}
          {quickFilter && (
            <ButtonAny variant="ghost" size="sm" onClick={() => setQuickFilter(null)}><X className="w-3 h-3 mr-1" />Clear</ButtonAny>
          )}
        </div>
      </div>

      {/* Inbox: urgent action items */}
      {!quickFilter && inboxShows.length > 0 && (
        <div className="mb-6 border border-amber-200 bg-amber-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Inbox className="w-4 h-4 text-amber-600" />
            <span className="font-semibold text-sm text-amber-800">Action Required ({inboxShows.length})</span>
          </div>
          <div className="space-y-2">
            {inboxShows.map(s => {
              const action = showNeedsAction(s);
              const techStart = parseDateSafe(s.tech_week_start);
              const days = techStart ? differenceInDays(techStart, new Date()) : null;
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between bg-white rounded-lg px-3 py-2 cursor-pointer hover:bg-amber-50 border border-amber-100 transition-colors"
                  onClick={() => setSelectedShow(s)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                    <span className="text-sm font-medium text-foreground truncate">{s.title}</span>
                    <span className="text-xs text-muted-foreground hidden sm:inline truncate">{s.director_name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    {action === 'contact_director' && (
                      <ButtonAny
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs px-2 border-amber-300 hover:bg-amber-100"
                        onClick={(e) => handleMarkContacted(e, s.id)}
                      >
                        ✓ Mark Contacted
                      </ButtonAny>
                    )}
                    {action === 'post_application' && (
                      <ButtonAny
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs px-2 border-amber-300 hover:bg-amber-100"
                        onClick={(e) => handleCreatePosting(e, s.id)}
                      >
                        ✓ Mark Posted
                      </ButtonAny>
                    )}
                    <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full hidden sm:inline">
                      {ACTION_LABEL[action] || action}
                    </span>
                    {days !== null && (
                      <span className={`text-xs font-semibold ${days <= 14 ? 'text-red-600' : 'text-muted-foreground'}`}>
                        {days < 0 ? `${Math.abs(days)}d past` : `${days}d`}
                      </span>
                    )}
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Kanban for upcoming shows */}
      {!quickFilter && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { key: 'this_week', label: 'This Week', color: 'border-red-300 bg-red-50' },
            { key: '30_days', label: '≤ 30 Days', color: 'border-amber-300 bg-amber-50' },
            { key: '60_days', label: '≤ 60 Days', color: 'border-blue-300 bg-blue-50' },
            { key: '90_days', label: '≤ 90 Days', color: 'border-gray-300 bg-gray-50' },
          ].map(bucket => (
            <div key={bucket.key} className={`rounded-xl border-2 ${bucket.color} p-3`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wide">{bucket.label}</span>
                <Badge variant="secondary" className="text-xs">{kanbanBuckets[bucket.key]?.length || 0}</Badge>
              </div>
              <div className="space-y-2">
                {(kanbanBuckets[bucket.key] || []).slice(0, 5).map(s => (
                  <ShowCard key={s.id} show={s} onClick={setSelectedShow} />
                ))}
                {(kanbanBuckets[bucket.key]?.length || 0) === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3">None</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabbed views */}
      <Tabs defaultValue="upcoming">
        <TabsListAny className="flex-wrap h-auto">
          {Object.entries(tabShows).map(([key, arr]) => (
            <TabsTriggerAny key={key} value={key} className="capitalize">
              {key.replace(/_/g, ' ')} <Badge variant="secondary" className="ml-1 text-xs">{arr.length}</Badge>
            </TabsTriggerAny>
          ))}
          <TabsTriggerAny value="calendar">📅 Calendar</TabsTriggerAny>
        </TabsListAny>

        {Object.entries(tabShows).map(([key, arr]) => (
          <TabsContentAny key={key} value={key} className="mt-4">
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
              </div>
            ) : arr.length === 0 ? (
              <EmptyState icon={Clapperboard} title={`No ${key.replace(/_/g, ' ')} shows`} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {arr.map(s => <ShowCard key={s.id} show={s} onClick={setSelectedShow} />)}
              </div>
            )}
          </TabsContentAny>
        ))}

        {/* Calendar Tab */}
        <TabsContentAny value="calendar" className="mt-4">
          <ShowCalendar shows={calendarShows} onShowClick={setSelectedShow} />
        </TabsContentAny>
      </Tabs>

      <AddShowModal open={addModal} onClose={() => setAddModal(false)} onCreated={refresh} />
      <ShowDetailModalAny
        show={selectedShow}
        open={!!selectedShow}
        onClose={() => setSelectedShow(null)}
        onUpdated={refresh}
      />
    </div>
  );
}

// ─── Inline calendar component ─────────────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const STATUS_DOT = {
  upcoming: 'bg-blue-400',
  in_progress: 'bg-amber-400',
  completed: 'bg-green-400',
};

function ShowCalendar({ shows, onShowClick }) {
  const today = new Date();
  const [year, setYear] = React.useState(today.getFullYear());
  const [month, setMonth] = React.useState(today.getMonth());

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Map day-of-month → shows whose tech_week_start falls on that day
  const showsByDay = {};
  shows.forEach(s => {
    if (!s.tech_week_start) return;
    const d = new Date(s.tech_week_start + 'T12:00:00');
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!showsByDay[day]) showsByDay[day] = [];
      showsByDay[day].push(s);
    }
  });

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const todayDay = today.getFullYear() === year && today.getMonth() === month ? today.getDate() : null;

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <ButtonAny variant="outline" size="sm" onClick={prevMonth}>←</ButtonAny>
        <span className="font-semibold text-base">{MONTHS[month]} {year}</span>
        <ButtonAny variant="outline" size="sm" onClick={nextMonth}>→</ButtonAny>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1">{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border border-border">
        {cells.map((day, i) => {
          const dayShows = day ? (showsByDay[day] || []) : [];
          const isToday = day === todayDay;
          return (
            <div
              key={i}
              className={`min-h-[72px] p-1.5 text-xs ${day ? 'bg-background' : 'bg-muted/30'} ${isToday ? 'bg-primary/5' : ''}`}
            >
              {day && (
                <>
                  <span className={`inline-flex w-5 h-5 items-center justify-center rounded-full text-xs font-medium mb-1 ${isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
                    {day}
                  </span>
                  <div className="space-y-0.5">
                    {dayShows.slice(0, 3).map(s => (
                      <div
                        key={s.id}
                        className="flex items-center gap-1 cursor-pointer group"
                        onClick={() => onShowClick(s)}
                        title={s.title}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[s.status] || 'bg-gray-400'}`} />
                        <span className="truncate text-[10px] text-foreground group-hover:text-primary leading-tight">
                          {s.title}
                        </span>
                      </div>
                    ))}
                    {dayShows.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">+{dayShows.length - 3} more</span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" />Upcoming</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />In progress</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400" />Completed</span>
      </div>
    </div>
  );
}