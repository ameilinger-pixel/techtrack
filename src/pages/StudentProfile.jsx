import { db } from '@/lib/backend/client';
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import {
  GraduationCap, Award, Clapperboard, Mail,
  CheckCircle, Clock, Loader2, Search
} from 'lucide-react';

// Public page — no auth required. Student looks up their profile by email.

const STATUS_COLOR = {
  approved:  'bg-green-100 text-green-800',
  pending:   'bg-amber-100 text-amber-800',
  rejected:  'bg-red-100 text-red-600',
  assigned:  'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-600',
};

export default function StudentProfile() {
  const { toast } = useToast();
  const params = new URLSearchParams(window.location.search);
  const [email, setEmail] = useState(params.get('email') || '');
  const [lookup, setLookup] = useState('');
  const [loading, setLoading] = useState(false);
  const [student, setStudent] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [applications, setApplications] = useState([]);
  const [assignedShows, setAssignedShows] = useState([]);

  // Auto-lookup if email was in URL
  useEffect(() => {
    if (params.get('email')) doLookup();
  }, []);

  const doLookup = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setNotFound(false);
    setStudent(null);
    try {
      const students = await db.entities.Student.filter({ email: email.trim().toLowerCase() });
      const found = students?.[0];
      if (!found) { setNotFound(true); setLoading(false); return; }
      setStudent(found);
      setLookup(email.trim().toLowerCase());

      // Load their applications
      const allApps = await db.entities.TechApplication.list();
      const myApps = allApps.filter(a =>
        a.student_email?.toLowerCase() === email.trim().toLowerCase() ||
        a.student_id === found.id
      );
      setApplications(myApps);

      // Load assigned shows
      const allAssignments = await db.entities.TechAssignment.list();
      const myShows = allAssignments.filter(a =>
        a.assigned_student_email?.toLowerCase() === email.trim().toLowerCase() ||
        a.assigned_student_id === found.id
      );
      setAssignedShows(myShows);
    } catch (err) {
      toast({ title: 'Lookup failed', description: err?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!student) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center pb-2">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <GraduationCap className="w-7 h-7 text-primary" />
            </div>
            <CardTitle className="text-xl">Student Profile Lookup</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Enter your email to see your applications and show history.</p>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            {notFound && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800">
                No student profile found for that email. Make sure it matches the email you used on your applications.
              </div>
            )}
            <div className="space-y-2">
              <Label>Your email address</Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                onKeyDown={e => e.key === 'Enter' && doLookup()}
              />
            </div>
            <Button className="w-full" onClick={doLookup} disabled={loading || !email.trim()}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Looking up…</> : <><Search className="w-4 h-4 mr-2" />Look up my profile</>}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeShows = assignedShows.filter(s => !['completed','cancelled'].includes(s.status));
  const pastShows   = assignedShows.filter(s => ['completed','cancelled'].includes(s.status));
  const pendingApps = applications.filter(a => a.status === 'pending');
  const pastApps    = applications.filter(a => a.status !== 'pending');

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Profile header */}
        <Card>
          <CardContent className="pt-6 pb-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl font-bold text-primary">{(student.full_name || '?')[0].toUpperCase()}</span>
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold">{student.full_name}</h1>
                <p className="text-sm text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" />{student.email}</p>
                {student.skill_level && <Badge variant="outline" className="mt-1 capitalize text-xs">{student.skill_level}</Badge>}
              </div>
            </div>
            {student.skills?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4">
                {student.skills.map(sk => <span key={sk} className="text-xs px-2.5 py-1 bg-muted rounded-full">{sk}</span>)}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active assignments */}
        {activeShows.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Clapperboard className="w-4 h-4 text-primary" />Current Shows
            </h2>
            <div className="space-y-2">
              {activeShows.map(s => (
                <Card key={s.id}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{s.show_title}</p>
                        {s.director_name && <p className="text-xs text-muted-foreground">Dir. {s.director_name}</p>}
                        {s.theater && <p className="text-xs text-muted-foreground">{s.theater}</p>}
                      </div>
                      <Badge className={`text-xs ${STATUS_COLOR[s.status] || ''}`}>{s.status?.replace(/_/g,' ')}</Badge>
                    </div>
                    {s.tech_week_start && (
                      <p className="text-xs text-muted-foreground mt-2">Tech week: {new Date(s.tech_week_start + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    )}
                    {s.assigned_technician_role && (
                      <p className="text-xs font-medium text-primary mt-1">Role: {s.assigned_technician_role}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Pending applications */}
        {pendingApps.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />Pending Applications
            </h2>
            <div className="space-y-2">
              {pendingApps.map(app => (
                <div key={app.id} className="flex items-center justify-between px-4 py-3 rounded-lg bg-amber-50 border border-amber-200">
                  <div>
                    <p className="text-sm font-medium">{app.show_title || 'Show application'}</p>
                    <p className="text-xs text-muted-foreground">Submitted {app.created_date ? new Date(app.created_date).toLocaleDateString() : '—'}</p>
                  </div>
                  <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Pending review</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Show history */}
        {pastShows.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />Show History
            </h2>
            <div className="space-y-1.5">
              {pastShows.map(s => (
                <div key={s.id} className="flex items-center justify-between px-4 py-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">{s.show_title}</p>
                    {s.tech_week_start && <p className="text-xs text-muted-foreground">{new Date(s.tech_week_start + 'T12:00:00').getFullYear()}</p>}
                  </div>
                  <Badge variant="outline" className="text-xs capitalize">{s.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Past applications */}
        {pastApps.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold mb-2 text-muted-foreground">Past Applications</h2>
            <div className="space-y-1.5">
              {pastApps.map(app => (
                <div key={app.id} className="flex items-center justify-between px-4 py-3 rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground">{app.show_title || 'Application'}</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_COLOR[app.status] || 'bg-gray-100 text-gray-600'}`}>
                    {app.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeShows.length === 0 && pendingApps.length === 0 && pastShows.length === 0 && pastApps.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <Award className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No applications or shows yet</p>
              <p className="text-sm mt-1">Apply for a show position using a link from your admin.</p>
            </CardContent>
          </Card>
        )}

        <button onClick={() => { setStudent(null); setEmail(''); }} className="text-xs text-muted-foreground hover:text-foreground transition-colors block mx-auto">
          Look up a different email
        </button>
      </div>
    </div>
  );
}
