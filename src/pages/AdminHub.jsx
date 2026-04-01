import React, { useState } from 'react';

import { db } from '@/lib/backend/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/shared/PageHeader';
import StatsCard from '@/components/shared/StatsCard';
import ShowCard from '@/components/admin/ShowCard';
import AddShowModal from '@/components/admin/AddShowModal';
import ShowDetailModal from '@/components/admin/ShowDetailModal';
import EmptyState from '@/components/shared/EmptyState';
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

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['hub-shows'] });

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

  return (
    <div>
      <PageHeader title="Admin Hub" subtitle="Manage all shows and their workflows">
        <Button onClick={() => setAddModal(true)}><Plus className="w-4 h-4 mr-2" />Add Show</Button>
      </PageHeader>

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
            <Button
              key={f.key}
              variant={quickFilter === f.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setQuickFilter(quickFilter === f.key ? null : f.key)}
            >
              <Filter className="w-3 h-3 mr-1" />{f.label}
            </Button>
          ))}
          {quickFilter && (
            <Button variant="ghost" size="sm" onClick={() => setQuickFilter(null)}><X className="w-3 h-3 mr-1" />Clear</Button>
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
                  <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
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
        <TabsList>
          {Object.entries(tabShows).map(([key, arr]) => (
            <TabsTrigger key={key} value={key} className="capitalize">
              {key.replace(/_/g, ' ')} <Badge variant="secondary" className="ml-1 text-xs">{arr.length}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>
        {Object.entries(tabShows).map(([key, arr]) => (
          <TabsContent key={key} value={key} className="mt-4">
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
          </TabsContent>
        ))}
      </Tabs>

      <AddShowModal open={addModal} onClose={() => setAddModal(false)} onCreated={refresh} />
      <ShowDetailModal show={selectedShow} open={!!selectedShow} onClose={() => setSelectedShow(null)} onUpdated={refresh} />
    </div>
  );
}