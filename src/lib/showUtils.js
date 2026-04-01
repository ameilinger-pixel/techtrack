import { format, differenceInDays, addDays, parseISO } from 'date-fns';

// Parse dates at noon UTC to avoid TZ bugs
// Handles ISO (2026-04-01), M/D (3/9), M/D/YY (3/9/26), M/D/YYYY (3/9/2026)
export function parseDateSafe(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).trim();

  // Already ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = parseISO(s.substring(0, 10) + 'T12:00:00Z');
    return isNaN(d.getTime()) ? null : d;
  }

  // M/D, M/D/YY, or M/D/YYYY
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (mdy) {
    let month = parseInt(mdy[1], 10);
    let day = parseInt(mdy[2], 10);
    let year = mdy[3] ? parseInt(mdy[3], 10) : new Date().getFullYear();
    // 2-digit year: 26 → 2026
    if (year < 100) year += 2000;
    const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

// Parse technicians: prefer assigned_technicians array, fallback to legacy fields
export function parseTechnicians(show) {
  if (show.assigned_technicians && Array.isArray(show.assigned_technicians) && show.assigned_technicians.length > 0) {
    return show.assigned_technicians;
  }
  // Legacy single-tech fields
  if (show.assigned_technician_name || show.assigned_technician_email) {
    return [{
      name: show.assigned_technician_name || '',
      email: show.assigned_technician_email || '',
      role: show.assigned_technician_role || '',
      payment_amount: show.assigned_technician_payment || 0,
      payment_status: ''
    }];
  }
  return [];
}

// Count valid crew members: any of name, email, role, or payment_amount > 0
export function crewCount(show) {
  const techs = parseTechnicians(show);
  return techs.filter(t => t.name || t.email || t.role || (t.payment_amount > 0)).length;
}

// Check if application step is done
export function isApplicationDone(show) {
  if (show.posting_created_date) return true;
  if (show.show_files && Array.isArray(show.show_files)) {
    return show.show_files.some(f => {
      const cat = (f.category || '').toLowerCase();
      return cat === 'application' || cat === 'application_link';
    });
  }
  return false;
}

// Check if show needs action — returns an action key string or false
// Only surfaces actions when it is actually time to take them.
export function showNeedsAction(show) {
  if (show.status !== 'upcoming') return false;
  if (!show.tech_week_start) return false;

  const techStart = parseDateSafe(show.tech_week_start);
  if (!techStart) return false;

  const now = new Date();
  const daysUntilTech = differenceInDays(techStart, now);

  // Ignore shows far in the future or long past
  if (daysUntilTech > 90 || daysUntilTech < -7) return false;

  // Declined shows: only flag if equipment is reserved (needs to be returned)
  if (show.tech_support_declined) {
    if (show.equipment_reserved && !show.equipment_returned) return 'return_equipment';
    return false;
  }

  const hasCrew = crewCount(show) > 0;

  if (hasCrew) {
    // Crew is assigned — only remaining admin task is printing the crew form,
    // and only within 7 days of tech week start
    if (daysUntilTech <= 7 && !show.crew_assignment_form_submitted) {
      return 'print_crew_form';
    }
    // Otherwise this show is on track — no action needed
    return false;
  }

  // No crew yet — surface action based on where we are in the timeline
  // Within 30 days and director not yet notified → notify them
  if (daysUntilTech <= 30 && !show.director_notified_date) return 'notify_director';
  // Within 60 days and no application posted yet → post it
  if (daysUntilTech <= 60 && !isApplicationDone(show)) return 'post_application';
  // Director hasn't been contacted yet
  if (!show.director_contacted_date) return 'contact_director';

  // Director contacted, application posted (or not yet needed), 
  // director notified (or not yet needed) — on track
  return false;
}

// Get urgency bucket for kanban
export function getUrgencyBucket(show) {
  const techStart = parseDateSafe(show.tech_week_start);
  if (!techStart) return 'future';
  const daysUntil = differenceInDays(techStart, new Date());
  if (daysUntil <= 7) return 'this_week';
  if (daysUntil <= 30) return '30_days';
  if (daysUntil <= 60) return '60_days';
  if (daysUntil <= 90) return '90_days';
  return 'future';
}

// Alias for parseTechnicians used in showNeedsAction spec
export const getTechnicianRowsFromShow = parseTechnicians;

// NTPA director email: firstInitial + lastName @ntpa.org
export function directorNtpaOrgEmail(directorName) {
  if (!directorName) return '';
  const parts = directorName.trim().split(/\s+/);
  if (parts.length < 2) return '';
  const firstInitial = parts[0][0].toLowerCase();
  const lastName = parts[parts.length - 1].toLowerCase();
  return `${firstInitial}${lastName}@ntpa.org`;
}

// Keep old export name for backward compatibility
export const ntpaDirectorEmail = directorNtpaOrgEmail;

// Merge form data for save
export function mergeFormDataForSave(formData) {
  const data = { ...formData };

  // Clean crew rows - remove empty ones
  if (data.assigned_technicians) {
    data.assigned_technicians = data.assigned_technicians.filter(t => t.name || t.email);
  }

  const crew = data.assigned_technicians || [];

  // Primary row → legacy fields
  if (crew.length > 0) {
    data.assigned_technician_name = crew[0].name || '';
    data.assigned_technician_email = crew[0].email || '';
    data.assigned_technician_role = crew[0].role || '';
    data.assigned_technician_payment = crew[0].payment_amount || 0;
  }

  // payment_amount = rounded sum of all crew payments
  data.payment_amount = Math.round(crew.reduce((sum, t) => sum + (parseFloat(t.payment_amount) || 0), 0));

  // tech_support_declined only if declined AND no crew
  if (data.tech_support_declined && crew.length > 0) {
    data.tech_support_declined = false;
  }

  // needs_technician = not declined and no crew
  data.needs_technician = !data.tech_support_declined && crew.length === 0;

  // Drop empty application_link_url
  if (!data.application_link_url) {
    delete data.application_link_url;
  }

  // If awaiting_form and application done, advance to posting_open
  if (data.workflow_status === 'awaiting_form' && isApplicationDone(data)) {
    data.workflow_status = 'posting_open';
  }

  return data;
}

// Save show with optional column retry
export async function saveShowWithRetry(ShowEntity, showId, data) {
  const retryColumns = ['assigned_technicians', 'tech_support_declined', 'application_link_url'];
  
  const cleanData = mergeFormDataForSave(data);
  
  try {
    return await ShowEntity.update(showId, cleanData);
  } catch (err) {
    // Retry without optional columns if schema error
    if (err && err.message && err.message.includes('schema')) {
      const retryData = { ...cleanData };
      retryColumns.forEach(col => delete retryData[col]);
      return await ShowEntity.update(showId, retryData);
    }
    throw err;
  }
}

export function formatDateDisplay(dateStr) {
  if (!dateStr) return '—';
  const d = parseDateSafe(dateStr);
  return d ? format(d, 'MMM d, yyyy') : '—';
}