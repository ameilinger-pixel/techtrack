import { db } from '@/lib/backend/client';


import { differenceInDays } from 'date-fns';
import { parseDateSafe } from '@/lib/showUtils';

// Replace {{placeholder}} tokens in subject/body
export function fillTemplate(text, vars) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

// Extract first name from full name string
function firstName(fullName) {
  if (!fullName) return '';
  return fullName.trim().split(/\s+/)[0];
}

// For a given assignment + template, build the vars object
function buildVars(assignment) {
  const techStart = parseDateSafe(assignment.tech_week_start)
    || parseDateSafe(assignment.first_tech_date)
    || parseDateSafe(assignment.opening_night);
  const daysUntil = techStart ? differenceInDays(techStart, new Date()) : '';
  const techNeedsFormUrl = `${window.location.origin}/director/portal`;
  // Determine tech role from roles_needed or tech_needs_description
  const techRole = Array.isArray(assignment.roles_needed) && assignment.roles_needed.length > 0
    ? assignment.roles_needed[0]
    : (assignment.tech_needs_description || '');
  return {
    show_title: assignment.show_title || '',
    director_name: assignment.director_name || '',
    director_first_name: firstName(assignment.director_name),
    director_email: assignment.director_email || '',
    student_name: assignment.assigned_student_name || '',
    student_email: assignment.assigned_student_email || '',
    technician_first_name: firstName(assignment.assigned_student_name),
    tech_role: techRole,
    tech_week_start: assignment.tech_week_start || assignment.first_tech_date || assignment.opening_night || '',
    days_until_tech: daysUntil,
    theater: assignment.theater || '',
    troupe: assignment.troupe || '',
    tech_needs_form_url: techNeedsFormUrl,
  };
}

// Determine recipient email from template settings
function resolveRecipient(template, assignment) {
  if (template.recipient === 'student') {
    return { email: assignment.assigned_student_email, name: assignment.assigned_student_name };
  }
  return { email: assignment.director_email, name: assignment.director_name };
}

function hasExistingEmail(existingPending, assignmentId, trigger) {
  return existingPending.some(
    p => p.assignment_id === assignmentId
      && p.trigger === trigger
      && ['pending', 'approved', 'sent'].includes(p.status)
  );
}

// Queue a single pending email — deduplicates by assignment_id + trigger + status=pending
export async function queueEmail(template, assignment, existingPending = []) {
  const alreadyQueued = hasExistingEmail(existingPending, assignment.id, template.trigger);
  if (alreadyQueued) return null;

  const vars = buildVars(assignment);
  const recipient = resolveRecipient(template, assignment);
  if (!recipient.email) return null;

  const subject = fillTemplate(template.subject, vars);
  const body = fillTemplate(template.body, vars);

  const queued = await db.entities.PendingEmail.create({
    trigger: template.trigger,
    template_id: template.id,
    template_name: template.name,
    assignment_id: assignment.id,
    show_title: assignment.show_title,
    to: recipient.email,
    to_name: recipient.name,
    subject,
    body,
    status: 'pending',
    delivery_status: 'queued',
    retry_count: 0,
  });
  try {
    await db.activity.log({
      event_type: 'email_queued',
      source: 'email_engine',
      assignment_id: assignment.id,
      pending_email_id: queued.id,
      summary: `Queued ${template.trigger} email for ${recipient.email}`,
      metadata: { trigger: template.trigger, to: recipient.email },
    });
  } catch (err) {
    console.warn('[emailEngine] activity log failed', err);
  }
  return queued;
}

// Run the full engine scan — call this from a button or on dashboard load
export async function runEmailEngine(assignments, templates, existingPending) {
  const today = new Date();
  const activeTemplates = templates.filter(t => t.active);
  const queued = [];

  for (const assignment of assignments) {
    if (['cancelled', 'completed'].includes(assignment.status)) continue;

    const techStart = parseDateSafe(assignment.tech_week_start)
      || parseDateSafe(assignment.first_tech_date)
      || parseDateSafe(assignment.opening_night);
    const daysUntil = techStart ? differenceInDays(techStart, today) : null;

    for (const template of activeTemplates) {
      let shouldTrigger = false;

      if (template.trigger === 'technician_assigned' && assignment.status === 'assigned' && assignment.assigned_student_email) {
        // Only trigger once — check if we already sent or queued for this assignment
        const alreadySent = hasExistingEmail(existingPending, assignment.id, 'technician_assigned');
        shouldTrigger = !alreadySent;
      }

      if (template.trigger === 'application_posted') {
        // Fire once when posting_created_date is set (application has gone live)
        if (assignment.posting_created_date) {
          const alreadySent = hasExistingEmail(existingPending, assignment.id, 'application_posted');
          shouldTrigger = !alreadySent;
        }
      }

      if (template.trigger === 'tech_week_reminder' && daysUntil !== null && daysUntil <= 7 && daysUntil > 0) {
        // Remind assigned student one week before tech week
        if (['assigned', 'confirmed'].includes(assignment.status) && assignment.assigned_student_email) {
          const alreadySent = hasExistingEmail(existingPending, assignment.id, 'tech_week_reminder');
          shouldTrigger = !alreadySent;
        }
      }

      if (template.trigger === 'no_tech_90_days' && daysUntil !== null && daysUntil <= 90 && daysUntil > 60) {
        if (['requested', 'pending_admin_approval'].includes(assignment.status)) {
          shouldTrigger = !hasExistingEmail(existingPending, assignment.id, 'no_tech_90_days');
        }
      }

      if (template.trigger === 'no_tech_30_days' && daysUntil !== null && daysUntil <= 30 && daysUntil > 0) {
        if (['requested', 'pending_admin_approval'].includes(assignment.status)) {
          shouldTrigger = !hasExistingEmail(existingPending, assignment.id, 'no_tech_30_days');
        }
      }

      if (template.trigger === 'crew_form_overdue') {
        if (
          ['assigned', 'confirmed'].includes(assignment.status) &&
          daysUntil !== null && daysUntil < 0 &&
          !assignment.crew_assignment_form_submitted
        ) {
          shouldTrigger = !hasExistingEmail(existingPending, assignment.id, 'crew_form_overdue');
        }
      }

      if (shouldTrigger) {
        const result = await queueEmail(template, assignment, existingPending);
        if (result) queued.push(result);
      }
    }
  }

  return queued;
}