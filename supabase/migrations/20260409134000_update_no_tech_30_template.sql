UPDATE public.email_templates
SET body = jsonb_set(
  jsonb_set(
    jsonb_set(
      body,
      '{subject}',
      to_jsonb('Quick update on tech coverage for {{show_title}}'::text),
      true
    ),
    '{recipient}',
    to_jsonb('director'::text),
    true
  ),
  '{body}',
  to_jsonb('<p>Hi {{director_first_name}},<br><br>I hope you''re doing well!<br><br>I just wanted to give you a quick heads up that, as of right now, we don''t have a technician signed up for your show. I wanted to let you know early so we have time to figure out the best plan, whether that''s me helping arrange coverage, giving you a quick crash course, or giving you time to find someone.<br><br>I''ll keep looking and reaching out all the way up until the show closes, so no need to worry, I just wanted to keep you in the loop.</p>'::text),
  true
)
WHERE body->>'trigger' = 'no_tech_30_days';
