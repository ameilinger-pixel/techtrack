import { db } from '@/lib/backend/client';

import React, { useState, useEffect } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle, Loader2, FileText, Download } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function ApplyForAssignment() {
  const params = new URLSearchParams(window.location.search);
  const assignmentId = params.get("assignment");
  const { toast } = useToast();

  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    student_name: "",
    student_email: "",
    level: "",
    track: "",
    roles_applying_for: [],
    conflicts: "",
    relevant_badges_skills: "",
    recent_shows: "",
    comments: "",
    initials: "",
  });

  useEffect(() => {
    if (!assignmentId) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    db.entities.TechAssignment.list()
      .then(results => {
        const found = results?.find(r => r.id === assignmentId);
        if (!found || found.status === "cancelled" || found.status === "completed") {
          setNotFound(true);
        } else {
          setAssignment(found);
        }
        setLoading(false);
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
  }, [assignmentId]);

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const toggleRole = (role) => {
    setForm(prev => ({
      ...prev,
      roles_applying_for: prev.roles_applying_for.includes(role)
        ? prev.roles_applying_for.filter(r => r !== role)
        : [...prev.roles_applying_for, role]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.student_name || !form.student_email) {
      toast({ title: "Please enter your name and email.", variant: "destructive" });
      return;
    }
    if (!form.initials) {
      toast({ title: "Please sign with your initials to confirm.", variant: "destructive" });
      return;
    }
    setSaving(true);
    await db.entities.TechApplication.create({
      assignment_id: assignmentId,
      student_name: form.student_name,
      student_email: form.student_email,
      experience: `Level: ${form.level}\nTrack: ${form.track}\nRoles: ${form.roles_applying_for.join(", ")}\nRecent Shows: ${form.recent_shows}\nBadges/Skills: ${form.relevant_badges_skills}`,
      cover_letter: form.comments,
      availability_notes: form.conflicts,
      status: "pending",
    });

    try {
      const admins = await db.entities.User.filter({ role: "admin" });
      const adminEmail = admins?.[0]?.email;
      if (adminEmail) {
        await db.integrations.Core.SendEmail({
          to: adminEmail,
          subject: `New Application: ${assignment.show_title}`,
          body: `<strong>${form.student_name}</strong> (${form.student_email}) has applied for <strong>${form.roles_applying_for.join(", ") || "a tech position"}</strong> on <strong>${assignment.show_title}</strong>.<br><br><strong>Level:</strong> ${form.level}<br><strong>Track:</strong> ${form.track}<br><strong>Conflicts:</strong> ${form.conflicts || "None listed"}<br><strong>Badges/Skills:</strong> ${form.relevant_badges_skills || "—"}<br><strong>Recent Shows:</strong> ${form.recent_shows || "—"}<br><strong>Comments:</strong> ${form.comments || "—"}<br><br>Review it in the Tech Assignments admin page.`,
        });
      }
    } catch (_) {}

    setSaving(false);
    setSubmitted(true);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  if (notFound) return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center p-6">
      <h1 className="text-2xl font-bold mb-2">Position Not Found</h1>
      <p className="text-muted-foreground">This application link is no longer active or doesn't exist.</p>
    </div>
  );

  if (submitted) return (
    <div className="flex items-center justify-center min-h-screen p-6">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground mb-2">
            <CheckCircle className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Application Submitted!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Thanks, <strong>{form.student_name}</strong>! Your application for <strong>{assignment.show_title}</strong> has been received. The admin team will be in touch.
          </p>
          <a href={`/profile?email=${encodeURIComponent(form.student_email)}`}
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium">
            View your profile &amp; application history →
          </a>
        </CardContent>
      </Card>
    </div>
  );

  const rolesNeeded = assignment.roles_needed || [];

  // Build position options with level requirements
  const ROLE_LEVELS = {
    "Lighting Design": "Level 3+",
    "Sound Design": "Level 3+",
    "Lighting Operation": "Level 2+",
    "Sound Operation": "Level 2+",
    "Spotlight Operation": "Level 2+",
    "Backstage Crew": "Level 2+",
    "Stage Management": "Level 2+",
  };
  const ROLE_BADGES = {
    "Lighting Design": "Lighting Design Badge",
    "Sound Design": "Sound Design Badge",
    "Lighting Operation": "Lighting Badge",
    "Sound Operation": "Sound Badge",
  };

  const positionOptions = assignment.positions?.length
    ? assignment.positions
    : rolesNeeded.map(role => ({
        role,
        level: ROLE_LEVELS[role] || "Level 1+",
        badges: ROLE_BADGES[role] || "N/A",
      }));
  if (!assignment.positions?.length && assignment.shadow_opportunity) {
    positionOptions.push({ role: "Shadow Tech", level: "Level 1", badges: "N/A" });
  }

  // Due date = 5 weeks before tech_week_start
  let dueDate = "";
  if (assignment.tech_week_start) {
    const d = new Date(assignment.tech_week_start);
    d.setDate(d.getDate() - 35);
    dueDate = d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }

  // Title: Show Name (Troupe - Location) Dir. Name / DUE DATE
  const troupePart = [assignment.troupe, assignment.theater].filter(Boolean).join(" - ");
  const titleDisplay = [
    assignment.show_title,
    troupePart ? ` (${troupePart})` : "",
    assignment.director_name ? ` ${assignment.director_name}` : "",
    dueDate ? ` / ${dueDate}` : "",
  ].join("");

  // Format a "YYYY-MM-DD HH:MM–HH:MM" string to readable format
  const fmt12 = (t) => {
    if (!t) return t;
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'pm' : 'am';
    const hour = h % 12 || 12;
    return m === 0 ? `${hour}${ampm}` : `${hour}:${m.toString().padStart(2,'0')}${ampm}`;
  };

  const formatDateStr = (dateStr) => {
    // dateStr is YYYY-MM-DD
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  // Parse tech_rehearsal_times — was stored as "YYYY-MM-DD HH:MM–HH:MM, ..."
  const formatLegacyTechTimes = (text) => {
    if (!text) return text;
    return text.split(', ').map(entry => {
      // entry: "2026-03-29 20:52–23:52"
      const parts = entry.trim().split(' ');
      const dateP = parts[0];
      const timeP = parts.slice(1).join(' ');
      if (!dateP || !/^\d{4}-\d{2}-\d{2}$/.test(dateP)) return entry;
      const d = new Date(dateP + 'T00:00:00');
      const dayStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' });
      // timeP: "20:52–23:52"
      const formattedTime = timeP.replace(/(\d{2}:\d{2})/g, (m) => fmt12(m));
      return `${dayStr} ${formattedTime}`;
    }).join(', ');
  };

  // Dates — support both new separate fields and legacy combined field
  const rehearsalText = assignment.rehearsal_schedule || "";
  // tech_week_schedule is already human-readable; fall back to legacy formatted text
  const techWeekText = assignment.tech_week_schedule || "";
  const performancesText = assignment.show_dates || "";
  const legacyText = assignment.tech_rehearsal_times || "";
  const formattedLegacyText = formatLegacyTechTimes(legacyText);

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Header Card - Show Info */}
        <Card>
          <CardContent className="pt-6 space-y-3">
            <h1 className="text-xl font-bold text-foreground leading-snug">{titleDisplay}</h1>

            {positionOptions.length > 0 && (
              <div className="border-t pt-3 text-sm space-y-3">
                <div><strong>POSITIONS NEEDED:</strong></div>
                {positionOptions.map((pos, i) => (
                  <div key={pos.role}>
                    <div><strong>Option {i + 1}:</strong> {pos.role}</div>
                    <div><strong>Level/Track Required:</strong> {pos.level}</div>
                    <div><strong>Specific Badge(s) Needed:</strong> {pos.badges}</div>
                  </div>
                ))}
              </div>
            )}

            {rehearsalText && (
              <div className="border-t pt-3 text-sm space-y-1">
                <div><strong>REHEARSALS:</strong></div>
                <div>{rehearsalText}</div>
              </div>
            )}

            {(techWeekText || formattedLegacyText || performancesText) && (
              <div className="border-t pt-3 text-sm space-y-1">
                <div><strong>TECH WEEK &amp; PERFORMANCES:</strong></div>
                {techWeekText && <div><strong>Tech Week:</strong> {techWeekText}</div>}
                {!techWeekText && formattedLegacyText && <div><strong>Tech Week:</strong> {formattedLegacyText}</div>}
                {performancesText && <div><strong>Performances:</strong> {performancesText}</div>}
              </div>
            )}

            {assignment.tech_needs_description && (
              <div className="border-t pt-3 text-sm text-muted-foreground">
                {assignment.tech_needs_description}
              </div>
            )}

            {assignment.show_files?.length > 0 && (
              <div className="border-t pt-3 text-sm space-y-2">
                <div className="font-semibold">ATTACHED FILES:</div>
                {assignment.show_files.map((f, i) => (
                  <a key={i} href={f.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary hover:underline">
                    <FileText className="w-4 h-4 shrink-0" />
                    <span>{f.name}</span>
                    <span className="text-xs text-muted-foreground capitalize">({f.category?.replace('_',' ')})</span>
                    <Download className="w-3.5 h-3.5 ml-auto" />
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contact Info */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label>Email <span className="text-red-500">*</span></Label>
              <Input type="email" value={form.student_email} onChange={e => handleChange("student_email", e.target.value)} placeholder="Valid email" required />
            </div>
          </CardContent>
        </Card>

        {/* Application */}
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">

              <div className="space-y-2">
                <Label>Name (First + Last) <span className="text-red-500">*</span></Label>
                <Input value={form.student_name} onChange={e => handleChange("student_name", e.target.value)} placeholder="Your full name" required />
              </div>

              <div className="space-y-2">
                <Label>Level <span className="text-red-500">*</span></Label>
                {["0: Tech Explorer", "1: Tech Operator", "2: Official Technician", "3: Tech Director", "4: Tech Designer"].map(opt => (
                  <div key={opt} className="flex items-center gap-2">
                    <input type="radio" id={opt} name="level" value={opt} checked={form.level === opt} onChange={() => handleChange("level", opt)} className="w-4 h-4" />
                    <label htmlFor={opt} className="text-sm">{opt}</label>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label>Track (pertaining to your application) <span className="text-red-500">*</span></Label>
                {["Lighting", "Sound", "Stage Management", "General"].map(opt => (
                  <div key={opt} className="flex items-center gap-2">
                    <input type="radio" id={`track-${opt}`} name="track" value={opt} checked={form.track === opt} onChange={() => handleChange("track", opt)} className="w-4 h-4" />
                    <label htmlFor={`track-${opt}`} className="text-sm">{opt}</label>
                  </div>
                ))}
              </div>

              {positionOptions.length > 0 && (
                <div className="space-y-2">
                  <Label>What roles are you interested in? <span className="text-red-500">*</span></Label>
                  {positionOptions.map(pos => (
                    <div key={pos.role} className="flex items-center gap-2">
                      <Checkbox
                        id={`role-${pos.role}`}
                        checked={form.roles_applying_for.includes(pos.role)}
                        onCheckedChange={() => toggleRole(pos.role)}
                      />
                      <label htmlFor={`role-${pos.role}`} className="text-sm">{pos.role}</label>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <Label>Please list any and all conflicts for the tech and show dates. <span className="text-red-500">*</span></Label>
                <Textarea value={form.conflicts} onChange={e => handleChange("conflicts", e.target.value)} placeholder="List conflicts or write 'No conflicts'" className="h-20" />
              </div>

              <div className="space-y-2">
                <Label>Relevant Badges/Skills that would make you a good fit for this role. <span className="text-red-500">*</span></Label>
                <Textarea value={form.relevant_badges_skills} onChange={e => handleChange("relevant_badges_skills", e.target.value)} placeholder="List your badges and relevant skills..." className="h-20" />
              </div>

              <div className="space-y-2">
                <Label>What are the last 2 shows that you helped with? (Name + Estimated Dates) <span className="text-red-500">*</span></Label>
                <Textarea value={form.recent_shows} onChange={e => handleChange("recent_shows", e.target.value)} placeholder="e.g. Hamlet (Fall 2024), Into the Woods (Spring 2025)" className="h-20" />
              </div>

              <div className="space-y-2">
                <Label>Comments/Notes/Questions:</Label>
                <Textarea value={form.comments} onChange={e => handleChange("comments", e.target.value)} placeholder="Any questions or additional comments..." className="h-20" />
              </div>

              <div className="space-y-2">
                <Label className="text-sm leading-relaxed block">
                  By signing my initials below, I confirm that I will be present for every Tech week and performance date except for the conflicts I listed above. I understand that I am expected to communicate with directors and staff in order to schedule a designer run during a rehearsal date to watch the show and plan, as well as notify the director if anything changes. I agree to complete all responsibilities required of my crew position. <span className="text-red-500">*</span>
                </Label>
                <Input value={form.initials} onChange={e => handleChange("initials", e.target.value)} placeholder="Your initials" className="max-w-[120px]" required />
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={saving}>
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</> : "Submit"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}