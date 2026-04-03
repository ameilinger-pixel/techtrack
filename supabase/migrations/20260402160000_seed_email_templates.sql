-- Default email templates (idempotent: one row per trigger)
-- Placeholders {{...}} are filled by src/lib/emailEngine.js at send time.
-- Uses dollar-quoting so Supabase SQL Editor accepts the file (no adjacent E'' concat).

INSERT INTO public.email_templates (body)
SELECT jsonb_build_object(
  'name', 'Technician Assigned',
  'trigger', 'technician_assigned',
  'recipient', 'director',
  'subject', 'Technician assigned: {{show_title}}',
  'body', $html$
<p>Hi {{director_first_name}},</p>
<p><strong>{{technician_first_name}}</strong> has been assigned as crew for <strong>{{show_title}}</strong>.</p>
<p>Theater: {{theater}} · Troupe: {{troupe}}</p>
<p>Tech week starts <strong>{{tech_week_start}}</strong> ({{days_until_tech}} days from today). Role focus: {{tech_role}}</p>
<p>Thank you,<br/>TechTrack</p>
$html$,
  'active', true
)
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates t WHERE t.body->>'trigger' = 'technician_assigned'
);

INSERT INTO public.email_templates (body)
SELECT jsonb_build_object(
  'name', 'No Tech ~90 Days Before Show',
  'trigger', 'no_tech_90_days',
  'recipient', 'director',
  'subject', 'Quick check-in: tech for {{show_title}}',
  'body', $html$
<p>Hi {{director_first_name}},<br><br>I hope you're doing well!<br><br>I wanted to do a quick check-in about tech for <strong>{{show_title}}</strong> and see how we can best support you. When you have a chance, could you fill out the <a href="{{tech_needs_form_url}}">TechTrack Tech Needs Form</a>? It helps me get dates, fixtures, and any specific needs organized so I can get applications up sooner and keep them open longer.<br><br>Also, if you're planning to handle tech on your own or don't need a technician for this show, that's totally okay — I just need it noted on the form for documentation purposes so everything's covered on my end.<br><br>Let me know if you have any questions or need anything from me in the meantime!<br><br>Thanks so much,<br>Alayna</p>
$html$,
  'active', true
)
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates t WHERE t.body->>'trigger' = 'no_tech_90_days'
);

INSERT INTO public.email_templates (body)
SELECT jsonb_build_object(
  'name', 'No Tech 30 Days Before Show',
  'trigger', 'no_tech_30_days',
  'recipient', 'director',
  'subject', 'Urgent: assign tech for {{show_title}}',
  'body', $html$
<p>Hi {{director_first_name}},</p>
<p><strong>{{show_title}}</strong> is within <strong>30 days</strong> of tech week and still needs a technician. Please prioritize crew assignment.</p>
<p>Theater: {{theater}}</p>
<p>TechTrack</p>
$html$,
  'active', true
)
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates t WHERE t.body->>'trigger' = 'no_tech_30_days'
);

INSERT INTO public.email_templates (body)
SELECT jsonb_build_object(
  'name', 'Crew Assignment Form Overdue',
  'trigger', 'crew_form_overdue',
  'recipient', 'student',
  'subject', 'Action needed: crew form for {{show_title}}',
  'body', $html$
<p>Hi {{technician_first_name}},</p>
<p>Please submit your crew assignment form for <strong>{{show_title}}</strong>. Tech week: <strong>{{tech_week_start}}</strong>.</p>
<p>If you already submitted, you can ignore this message.</p>
<p>TechTrack</p>
$html$,
  'active', true
)
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates t WHERE t.body->>'trigger' = 'crew_form_overdue'
);
