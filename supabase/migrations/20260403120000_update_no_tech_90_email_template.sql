-- Refresh ~90 day director email copy + Tech Needs Form link placeholder (existing DBs that already seeded)

UPDATE public.email_templates
SET body = jsonb_set(
  jsonb_set(
    body,
    '{subject}',
    to_jsonb('Quick check-in: tech for {{show_title}}'::text),
    true
  ),
  '{body}',
  to_jsonb($html$
<p>Hi {{director_first_name}},<br><br>I hope you're doing well!<br><br>I wanted to do a quick check-in about tech for <strong>{{show_title}}</strong> and see how we can best support you. When you have a chance, could you fill out the <a href="{{tech_needs_form_url}}">TechTrack Tech Needs Form</a>? It helps me get dates, fixtures, and any specific needs organized so I can get applications up sooner and keep them open longer.<br><br>Also, if you're planning to handle tech on your own or don't need a technician for this show, that's totally okay — I just need it noted on the form for documentation purposes so everything's covered on my end.<br><br>Let me know if you have any questions or need anything from me in the meantime!<br><br>Thanks so much,<br>Alayna</p>
$html$::text),
  true
)
WHERE body->>'trigger' = 'no_tech_90_days';
