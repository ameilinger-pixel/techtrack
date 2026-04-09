import { db } from '@/lib/backend/client';

import React, { useState, useRef } from "react";
import { useOutletContext } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle, Info, Briefcase, Clock, Calendar, Plus, Trash2, Loader2, Paperclip, X, FileText, Upload } from "lucide-react";
import { eachDateInclusive, summarizeTechRoles } from "@/lib/scheduleHelpers";
import { useToast } from "@/components/ui/use-toast";

const HELP_ROLE_OPTIONS = [
  { value: "Lighting design", label: "Lighting design" },
  { value: "Lighting operation", label: "Lighting operation" },
  { value: "Sound design", label: "Sound design" },
  { value: "Sound/mic operation", label: "Sound/mic operation" },
  { value: "Projections", label: "Projections" },
  { value: "Spotlight operator", label: "Spotlight operator" },
  { value: "Backstage crew", label: "Backstage crew" },
  { value: "Other", label: "Other" },
];

const equipmentOptions = ["Fog Machine", "Projector", "Extra Lights", "Practicals", "Gobos", "Other"];

const formatTime12 = (t) => {
  if (!t) return t;
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 || 12;
  return m === 0 ? `${hour}${ampm}` : `${hour}:${m.toString().padStart(2,'0')}${ampm}`;
};

export default function DirectorTechRequest() {
  const { user } = useOutletContext();
  const { toast } = useToast();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    show_title: "",
    director_name: user?.full_name || "",
    director_email: user?.email || "",
    troupe: "",
    theater: "",
    rehearsal_location: "",
    rehearsal_schedule: "",
    tech_week: { start_date: "", end_date: "", start_time: "", end_time: "" },
    performances: [],
    roles_needed: [],
    other_role_needed: "",
    equipment_needed: [],
    other_equipment: "",
    shadow_student_ok: false,
    specific_tech_request: "",
    notes: "",
    show_files: [],
  });
  const [uploadingFile, setUploadingFile] = useState(false);

  const [newPerformance, setNewPerformance] = useState({ date: "", call_time: "", curtain_time: "" });

  const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleTechWeekChange = (field, value) =>
    setFormData(prev => ({ ...prev, tech_week: { ...prev.tech_week, [field]: value } }));

  const handleRoleToggle = (value, checked) => {
    setFormData(prev => {
      const next = checked ? [...prev.roles_needed, value] : prev.roles_needed.filter(r => r !== value);
      return { ...prev, roles_needed: next, other_role_needed: next.includes("Other") ? prev.other_role_needed : "" };
    });
  };

  const handleEquipmentChange = (equipment) => {
    const current = formData.equipment_needed || [];
    handleChange("equipment_needed", current.includes(equipment)
      ? current.filter(e => e !== equipment)
      : [...current, equipment]);
  };

  const addPerformance = () => {
    const { date, call_time, curtain_time } = newPerformance;
    if (!date || !call_time || !curtain_time) {
      toast({ title: "Please enter performance date, call time, and curtain time.", variant: "destructive" });
      return;
    }
    setFormData(prev => ({ ...prev, performances: [...prev.performances, { date, call_time, curtain_time }] }));
    setNewPerformance({ date: "", call_time: "", curtain_time: "" });
  };

  const removePerformance = (index) =>
    setFormData(prev => ({ ...prev, performances: prev.performances.filter((_, i) => i !== index) }));

  const FILE_CATEGORIES = [
    { value: "light_plot", label: "Light Plot" },
    { value: "cue_sheet", label: "Cue Sheet" },
    { value: "script", label: "Script" },
    { value: "other", label: "Other" },
  ];

  const fileInputRef = useRef(null);
  const [pendingFileCategory, setPendingFileCategory] = useState("light_plot");

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    const { file_url } = await db.integrations.Core.UploadFile({ file });
    setFormData(prev => ({
      ...prev,
      show_files: [...(prev.show_files || []), {
        name: file.name,
        url: file_url,
        category: pendingFileCategory,
        uploaded_at: new Date().toISOString(),
      }],
    }));
    setUploadingFile(false);
    e.target.value = "";
  };

  const removeFile = (index) =>
    setFormData(prev => ({ ...prev, show_files: prev.show_files.filter((_, i) => i !== index) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { tech_week, performances, roles_needed, other_role_needed } = formData;

    if (!tech_week.start_date || !tech_week.end_date || !tech_week.start_time || !tech_week.end_time) {
      toast({ title: "Please enter tech week start date, end date, and daily start/end times.", variant: "destructive" });
      return;
    }
    if (new Date(tech_week.start_date) > new Date(tech_week.end_date)) {
      toast({ title: "Tech week start date must be on or before the end date.", variant: "destructive" });
      return;
    }
    if (performances.length === 0) {
      toast({ title: "Add at least one performance.", variant: "destructive" });
      return;
    }
    if (roles_needed.length === 0) {
      toast({ title: "Select at least one type of technical help needed.", variant: "destructive" });
      return;
    }
    if (roles_needed.includes("Other") && !String(other_role_needed || "").trim()) {
      toast({ title: 'Please describe what you need in the "Other" field.', variant: "destructive" });
      return;
    }

    const techDates = eachDateInclusive(tech_week.start_date, tech_week.end_date);
    if (techDates.length === 0) {
      toast({ title: "Could not build tech week dates. Check your start and end dates.", variant: "destructive" });
      return;
    }

    const showDates = [...new Set(performances.map(p => p.date))].sort();
    const openingNight = showDates.length ? showDates[0] : null;
    const tech_needs_description = summarizeTechRoles(roles_needed, other_role_needed);

    const fmtDay = (dateStr) => new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const techWeekSchedule = `${fmtDay(tech_week.start_date)} - ${fmtDay(tech_week.end_date)} @ ${formatTime12(tech_week.start_time)}-${formatTime12(tech_week.end_time)}`;
    const showDatesFormatted = performances.map(p => {
      const d = new Date(p.date + 'T00:00:00');
      const dayStr = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      return `${dayStr} @ ${formatTime12(p.curtain_time)} (Call time ${formatTime12(p.call_time)})`;
    }).join(', ');

    setSaving(true);
    try {
      await db.entities.TechAssignment.create({
        show_title: formData.show_title,
        director_name: formData.director_name,
        director_email: formData.director_email,
        troupe: formData.troupe,
        theater: formData.theater,
        rehearsal_location: formData.rehearsal_location,
        rehearsal_schedule: formData.rehearsal_schedule,
        tech_week_schedule: techWeekSchedule,
        assigned_role: "pending_assignment",
        required_level: "Level 0",
        payment_amount: 0,
        roles_needed: [...roles_needed],
        other_role_needed: roles_needed.includes("Other") ? String(other_role_needed || "").trim() : "",
        tech_week_start: tech_week.start_date,
        tech_week_end: tech_week.end_date,
        tech_rehearsal_times: techDates.map(date => `${date} ${tech_week.start_time}-${tech_week.end_time}`).join(', '),
        show_dates: showDatesFormatted,
        show_call_times: performances.map(p => ({
          date: p.date,
          call_time: p.call_time,
          curtain_time: p.curtain_time,
        })),
        first_tech_date: tech_week.start_date,
        opening_night: openingNight,
        assignment_status: "pending_admin_approval",
        status: "pending_admin_approval",
        notes: formData.notes,
        can_shadow_tech: formData.shadow_student_ok,
        shadow_student_ok: formData.shadow_student_ok,
        resources_needed: [
          ...(formData.equipment_needed || []),
          ...(formData.other_equipment ? [formData.other_equipment] : []),
        ],
        created_date: new Date().toISOString().split("T")[0],
        specific_tech_request: formData.specific_tech_request,
        tech_needs_description,
        show_files: formData.show_files || [],
      });

      try {
        const adminUsers = await db.entities.User.filter({ role: "admin" });
        const adminEmail = adminUsers?.[0]?.email;
        if (adminEmail) {
          await db.integrations.Core.SendEmail({
            to: adminEmail,
            subject: `New Tech Request: ${formData.show_title}`,
            body: `A new tech request has been submitted:<br><br><strong>Show:</strong> ${formData.show_title}<br><strong>Director:</strong> ${formData.director_name}<br><strong>Help needed:</strong> ${tech_needs_description}<br><strong>Specific Request:</strong> ${formData.specific_tech_request || "None"}<br><br>Please review the request in the admin dashboard.`,
          });
        }
        if (formData.director_email) {
          await db.integrations.Core.SendEmail({
            to: formData.director_email,
            subject: `Tech Request Received: ${formData.show_title}`,
            body: `Hi ${formData.director_name.split(" ")[0]},<br><br>We've received your tech request for <strong>${formData.show_title}</strong>.<br><br>Our admin team will review and assign technicians. You'll be notified once confirmed.<br><br>Best regards,<br>NTPA TechTrack Team`,
          });
        }
      } catch (emailErr) {
        console.warn('Email notification failed:', emailErr);
      }

      setSaving(false);
      setIsSubmitted(true);
    } catch (err) {
      setSaving(false);
      toast({ title: "Submission failed. Please try again.", variant: "destructive" });
      throw err;
    }
  };

  const formReady =
    formData.show_title &&
    formData.theater &&
    formData.rehearsal_location &&
    formData.tech_week.start_date &&
    formData.tech_week.end_date &&
    formData.tech_week.start_time &&
    formData.tech_week.end_time &&
    formData.performances.length > 0 &&
    formData.roles_needed.length > 0 &&
    (!formData.roles_needed.includes("Other") || String(formData.other_role_needed || "").trim());

  if (isSubmitted) {
    return (
      <div className="flex justify-center items-center min-h-[60vh] p-6">
        <Card className="w-full max-w-lg text-center">
          <CardHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground mb-2">
              <CheckCircle className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl">Request Submitted!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Thank you! Your tech request for "{formData.show_title}" has been sent to the admin for review.
              They'll assign specific roles and handle payment details before posting it for student applications.
            </p>
            <Button onClick={() => { setIsSubmitted(false); setFormData(prev => ({ ...prev, show_title: "", performances: [], roles_needed: [], equipment_needed: [], notes: "", specific_tech_request: "", other_role_needed: "", other_equipment: "", shadow_student_ok: false, tech_week: { start_date: "", end_date: "", start_time: "", end_time: "" } })); }}>
              Submit Another Request
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Director Tech Request</h1>
        <p className="text-sm text-muted-foreground mt-1">Tell us about your show and what technical support you need. Our admin team will handle role assignments and payment details.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Briefcase className="w-4 h-4" />Show Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Show title *</Label>
              <Input value={formData.show_title} onChange={e => handleChange("show_title", e.target.value)} required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Theater / Performance Venue *</Label>
                <Input value={formData.theater} onChange={e => handleChange("theater", e.target.value)} placeholder="e.g. Rodenbaugh Theatre" required />
              </div>
              <div className="space-y-2">
                <Label>Troupe / Program</Label>
                <Input value={formData.troupe} onChange={e => handleChange("troupe", e.target.value)} placeholder="e.g. NTPA Repertory" />
              </div>
              <div className="space-y-2">
                <Label>Director name *</Label>
                <Input value={formData.director_name} onChange={e => handleChange("director_name", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Director email *</Label>
                <Input type="email" value={formData.director_email} onChange={e => handleChange("director_email", e.target.value)} required />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4" />Rehearsal Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Rehearsal Location *</Label>
              <Input value={formData.rehearsal_location} onChange={e => handleChange("rehearsal_location", e.target.value)} placeholder="e.g. Plano East Rehearsal Hall B" required />
            </div>
            <div className="space-y-2">
              <Label>Rehearsal Schedule (days and times)</Label>
              <Input value={formData.rehearsal_schedule} onChange={e => handleChange("rehearsal_schedule", e.target.value)} placeholder="e.g. Mondays 6-9 pm, Plano East PAC" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4" />Tech Week</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Step 1: Enter Tech Week dates and times in this order: start date, end date, start time, end time.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Tech Week Start Date *</Label><Input type="date" value={formData.tech_week.start_date} onChange={e => handleTechWeekChange("start_date", e.target.value)} required /></div>
              <div className="space-y-2"><Label>Tech Week End Date *</Label><Input type="date" value={formData.tech_week.end_date} onChange={e => handleTechWeekChange("end_date", e.target.value)} required /></div>
              <div className="space-y-2"><Label>Tech Week Start Time *</Label><Input type="time" value={formData.tech_week.start_time} onChange={e => handleTechWeekChange("start_time", e.target.value)} required /></div>
              <div className="space-y-2"><Label>Tech Week End Time *</Label><Input type="time" value={formData.tech_week.end_time} onChange={e => handleTechWeekChange("end_time", e.target.value)} required /></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4" />Performances</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Step 2: Click Add for each performance and enter Date, Call Time, and Curtain Time.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
              <div className="sm:col-span-4 space-y-2"><Label>Date</Label><Input type="date" value={newPerformance.date} onChange={e => setNewPerformance(p => ({ ...p, date: e.target.value }))} /></div>
              <div className="sm:col-span-3 space-y-2"><Label>Call time</Label><Input type="time" value={newPerformance.call_time} onChange={e => setNewPerformance(p => ({ ...p, call_time: e.target.value }))} /></div>
              <div className="sm:col-span-3 space-y-2"><Label>Curtain time</Label><Input type="time" value={newPerformance.curtain_time} onChange={e => setNewPerformance(p => ({ ...p, curtain_time: e.target.value }))} /></div>
              <div className="sm:col-span-2"><Button type="button" onClick={addPerformance} className="w-full gap-1"><Plus className="w-4 h-4" />Add</Button></div>
            </div>
            {formData.performances.length > 0 ? (
              <ul className="space-y-2">
                {formData.performances.map((p, index) => (
                  <li key={`${p.date}-${index}`} className="flex items-center justify-between gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm">
                    <span><strong>{new Date(p.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</strong> - Call {formatTime12(p.call_time)}, curtain {formatTime12(p.curtain_time)}</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removePerformance(index)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground bg-muted rounded-md px-3 py-2">No performances added yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Technical Support Needed *</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Select everything you need-you can choose multiple options.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {HELP_ROLE_OPTIONS.map(role => (
                <label key={role.value} className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm cursor-pointer hover:bg-muted transition-colors">
                  <Checkbox checked={formData.roles_needed.includes(role.value)} onCheckedChange={v => handleRoleToggle(role.value, !!v)} />
                  <span>{role.label}</span>
                </label>
              ))}
            </div>
            {formData.roles_needed.includes("Other") && (
              <div className="space-y-2">
                <Label>Describe other help needed *</Label>
                <Input value={formData.other_role_needed} onChange={e => handleChange("other_role_needed", e.target.value)} placeholder="e.g., Video playback / QLab, follow-spot only, etc." />
              </div>
            )}
            <div className="space-y-2">
              <Label>Specific student request (optional)</Label>
              <Input value={formData.specific_tech_request} onChange={e => handleChange("specific_tech_request", e.target.value)} placeholder="e.g., 'I'd like Sarah Johnson if she's available'" />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={formData.shadow_student_ok} onCheckedChange={v => handleChange("shadow_student_ok", !!v)} />
              <span>I'm okay with having a shadow student observe</span>
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Equipment / Things Requested</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {equipmentOptions.map(equipment => (
                <label key={equipment} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={(formData.equipment_needed || []).includes(equipment)} onCheckedChange={() => handleEquipmentChange(equipment)} />
                  <span>{equipment}</span>
                </label>
              ))}
            </div>
            {formData.equipment_needed.includes("Other") && (
              <div className="space-y-2">
                <Label>Specify other equipment needed</Label>
                <Input value={formData.other_equipment} onChange={e => handleChange("other_equipment", e.target.value)} placeholder="e.g., special props, additional microphones, etc." />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Paperclip className="w-4 h-4" />Attach Files (optional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Attach your light plot, cue sheets, script, or any other files the technician will need.</p>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-xs">File type</Label>
                <select
                  value={pendingFileCategory}
                  onChange={e => setPendingFileCategory(e.target.value)}
                  className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {FILE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadingFile} className="gap-2">
                {uploadingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploadingFile ? "Uploading..." : "Choose File"}
              </Button>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
            </div>
            {formData.show_files?.length > 0 && (
              <ul className="space-y-2">
                {formData.show_files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                      <a href={f.url} target="_blank" rel="noopener noreferrer" className="truncate font-medium hover:underline text-primary">{f.name}</a>
                      <span className="text-xs text-muted-foreground capitalize shrink-0">({f.category?.replace('_',' ')})</span>
                    </div>
                    <button type="button" onClick={() => removeFile(i)} className="shrink-0 text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-2">
          <Label>Additional notes</Label>
          <Textarea value={formData.notes} onChange={e => handleChange("notes", e.target.value)} placeholder="Any special requirements, preferences, or additional details..." className="h-24" />
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>What happens next?</AlertTitle>
          <AlertDescription>Your request will be reviewed by an admin who will determine the specific technical roles needed and handle any payment details. Once approved and configured, it will be posted for student applications.</AlertDescription>
        </Alert>

        <Button type="submit" className="w-full" size="lg" disabled={!formReady || saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          {saving ? "Submitting..." : "Submit Tech Request"}
        </Button>
      </form>
    </div>
  );
}