import { db } from '@/lib/backend/client';

import React, { useState, useEffect } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/shared/StatusBadge';
import TechNeedsForm from '@/components/director/TechNeedsForm';
import {
  Clapperboard, Users, ClipboardList, CheckCircle,
  Clock, AlertCircle, LogOut, ChevronRight, Mail, Phone,
  ExternalLink, FileText
} from 'lucide-react';
import { formatDateDisplay, parseTechnicians } from '@/lib/showUtils';

export default function DirectorPortal() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [selectedShow, setSelectedShow] = useState(null);
  const [showTechForm, setShowTechForm] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    db.auth.me().then(u => { setUser(u); setLoadingUser(false); }).catch(() => {
      db.auth.redirectToLogin('/director/portal');
    });
  }, []);

  const { data: shows = [], isLoading: loadingShows } = useQuery({
    queryKey: ['director-portal-shows', user?.email],
    queryFn: () => db.entities.Show.filter({ director_email: user?.email }),
    enabled: !!user?.email,
  });

  const { data: allShows = [], isLoading: loadingAllShows } = useQuery({
    queryKey: ['director-portal-allshows', user?.full_name],
    queryFn: () => db.entities.Show.filter({ director_name: user?.full_name }),
    enabled: !!user?.full_name && shows.length === 0,
  });

  const activeShows = (shows.length > 0 ? shows : allShows).filter(s => s.status !== 'archived');

  const isLoading = loadingUser || loadingShows;

  if (loadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const firstName = user?.full_name ? user.full_name.trim().split(' ')[0] : 'Director';

  if (showTechForm) {
    return (
      <div className="min-h-screen bg-background">
        <PortalHeader user={user} />
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Button variant="ghost" size="sm" className="mb-4" onClick={() => setShowTechForm(false)}>
            ← Back to Dashboard
          </Button>
          <TechNeedsForm user={user} onSubmitted={() => {
            setShowTechForm(false);
            queryClient.invalidateQueries({ queryKey: ['director-portal-shows'] });
          }} />
        </div>
      </div>
    );
  }

  if (selectedShow) {
    return (
      <div className="min-h-screen bg-background">
        <PortalHeader user={user} />
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Button variant="ghost" size="sm" className="mb-4" onClick={() => setSelectedShow(null)}>
            ← Back to My Shows
          </Button>
          <ShowDetail show={selectedShow} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PortalHeader user={user} />

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Welcome */}
        <div className="rounded-2xl bg-gradient-to-r from-primary/10 to-accent p-6">
          <h2 className="text-2xl font-bold text-card-foreground">Welcome back, {firstName}!</h2>
          <p className="text-muted-foreground mt-1">Here's everything you need for your productions.</p>
        </div>

        {/* My Shows */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clapperboard className="w-5 h-5 text-primary" />
              My Shows
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : activeShows.length === 0 ? (
              <div className="text-center py-8">
                <Clapperboard className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No shows found yet.</p>
                <p className="text-xs text-muted-foreground mt-1">If you have a show, submit a Tech Needs Form below.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activeShows.map(show => (
                  <button
                    key={show.id}
                    onClick={() => setSelectedShow(show)}
                    className="w-full flex items-center justify-between p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-card-foreground truncate">{show.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {show.theater && `${show.theater} · `}Tech Week: {formatDateDisplay(show.tech_week_start)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                      <TechStatusPill show={show} />
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit Tech Needs Form */}
        <Card className="border-primary/20 bg-accent/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <ClipboardList className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-card-foreground">Submit a Tech Needs Form</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Have a new show or need to update your tech requirements? Fill out the form and we'll get you set up.
                </p>
                <Button className="mt-3" onClick={() => setShowTechForm(true)}>
                  Fill Out Form
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-semibold text-card-foreground mb-3">Need help? Contact Alayna</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a href="mailto:ameilinger@ntpa.org" className="flex items-center gap-2 text-sm text-primary hover:underline">
                <Mail className="w-4 h-4" /> ameilinger@ntpa.org
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PortalHeader({ user }) {
  return (
    <header className="sticky top-0 z-40 bg-card border-b border-border">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clapperboard className="w-5 h-5 text-primary" />
          <span className="font-bold text-card-foreground">TechTrack</span>
          <span className="text-muted-foreground text-sm hidden sm:inline">· Director Portal</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden sm:inline">{user?.full_name || user?.email}</span>
          <Button variant="ghost" size="sm" onClick={() => db.auth.logout('/')}>
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline ml-1">Sign Out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}

function TechStatusPill({ show }) {
  const crew = parseTechnicians(show);
  if (show.tech_support_declined) {
    return <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">No Tech Needed</span>;
  }
  if (crew.length > 0) {
    return <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-700 flex items-center gap-1"><CheckCircle className="w-3 h-3" />Tech Assigned</span>;
  }
  return <span className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700 flex items-center gap-1"><Clock className="w-3 h-3" />Seeking Tech</span>;
}

function ShowDetail({ show }) {
  const crew = parseTechnicians(show);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-card-foreground">{show.title}</h2>
          <p className="text-muted-foreground text-sm mt-1">{show.theater}</p>
        </div>
        <StatusBadge status={show.status} />
      </div>

      {/* Dates */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Schedule</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {show.tech_week_start && <DetailRow label="Tech Week" value={`${formatDateDisplay(show.tech_week_start)}${show.tech_week_end ? ' – ' + formatDateDisplay(show.tech_week_end) : ''}`} />}
          {show.opening_night && <DetailRow label="Opening Night" value={formatDateDisplay(show.opening_night)} />}
          {show.show_dates && <DetailRow label="Show Dates" value={show.show_dates} />}
          {show.tech_rehearsal_times && <DetailRow label="Rehearsals" value={show.tech_rehearsal_times} />}
          {show.schedule_notes && <DetailRow label="Notes" value={show.schedule_notes} />}
        </CardContent>
      </Card>

      {/* Tech Status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />Assigned Technician
          </CardTitle>
        </CardHeader>
        <CardContent>
          {show.tech_support_declined ? (
            <p className="text-sm text-muted-foreground">Tech support not needed for this show.</p>
          ) : crew.length === 0 ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-800">We're actively looking for a technician for this show. We'll be in touch!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {crew.map((t, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div>
                    <p className="font-semibold text-sm text-card-foreground">{t.name}</p>
                    {t.role && <p className="text-xs text-muted-foreground">{t.role}</p>}
                    {t.email && (
                      <a href={`mailto:${t.email}`} className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3" />{t.email}
                      </a>
                    )}
                  </div>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Equipment */}
      {(show.needs_lighting || show.needs_sound || show.needs_projection || show.needs_rigging) && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Equipment Needs</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {show.needs_lighting && <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-medium">Lighting</span>}
            {show.needs_sound && <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">Sound</span>}
            {show.needs_projection && <span className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-medium">Projection</span>}
            {show.needs_rigging && <span className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">Rigging</span>}
          </CardContent>
        </Card>
      )}

      {/* What's Next */}
      <NextStepBanner show={show} />

      {/* Application Link */}
      {show.application_link_url && (
        <Card className="border-primary/20 bg-accent/30">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm font-semibold text-card-foreground mb-1">Application / Tech Form</p>
            <a href={show.application_link_url} target="_blank" rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1">
              <ExternalLink className="w-3.5 h-3.5" />Open Application Form
            </a>
          </CardContent>
        </Card>
      )}

      {/* Files from admin */}
      {(show.show_files || []).length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Files & Documents</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {show.show_files.map((f, i) => (
              <a key={i} href={f.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:underline">
                <FileText className="w-4 h-4 flex-shrink-0" />
                {f.name}
                {f.category && f.category !== 'general' && (
                  <span className="text-xs text-muted-foreground capitalize">({f.category.replace(/_/g, ' ')})</span>
                )}
              </a>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function NextStepBanner({ show }) {
  const crew = parseTechnicians(show);
  if (show.tech_support_declined) return null;

  let message = null;
  let color = 'bg-blue-50 border-blue-200 text-blue-800';

  if (crew.length > 0) {
    message = '✅ Your technician has been assigned! Check the details above and reach out to coordinate.';
    color = 'bg-green-50 border-green-200 text-green-800';
  } else if (show.workflow_status === 'posting_open' || show.workflow_status === 'posting_created') {
    message = '📋 Applications are open — we\'re reviewing candidates and will notify you as soon as someone is confirmed.';
  } else if (show.director_contacted_date) {
    message = '🔍 We\'re actively searching for a technician for your show. Hang tight!';
  } else {
    message = '📝 Next step: Please fill out the Tech Needs Form below so we can find the right technician for your show.';
    color = 'bg-amber-50 border-amber-200 text-amber-800';
  }

  return (
    <div className={`p-3 rounded-lg border text-sm font-medium ${color}`}>
      {message}
    </div>
  );
}

function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex gap-3">
      <span className="text-xs text-muted-foreground w-28 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-card-foreground">{value}</span>
    </div>
  );
}