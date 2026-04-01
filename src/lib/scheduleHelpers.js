// Generate all dates inclusive between start and end (YYYY-MM-DD strings)
export function eachDateInclusive(startStr, endStr) {
  if (!startStr || !endStr) return [];
  const dates = [];
  const current = new Date(startStr + 'T12:00:00Z');
  const end = new Date(endStr + 'T12:00:00Z');
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// Summarize tech roles into a description string
export function summarizeTechRoles(rolesNeeded, otherRoleNeeded) {
  if (!rolesNeeded || rolesNeeded.length === 0) return '';
  const parts = rolesNeeded.map(r => {
    if (r === 'Other' && otherRoleNeeded) return `Other: ${otherRoleNeeded}`;
    return r;
  });
  return parts.join(', ');
}