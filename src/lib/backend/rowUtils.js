const META_KEYS = new Set([
  'id',
  'created_at',
  'updated_at',
  'created_date',
  'updated_date',
  'body',
]);

export function rowToEntity(table, row) {
  if (!row) return null;
  if (table === 'profiles') {
    return {
      id: row.id,
      email: row.email,
      full_name: row.full_name ?? '',
      role: row.role,
      created_date: row.created_at,
      updated_date: row.updated_at,
    };
  }
  const body =
    row.body && typeof row.body === 'object' ? { ...row.body } : {};
  const out = {
    id: row.id,
    ...body,
    created_date: row.created_at,
    updated_date: row.updated_at,
  };
  return out;
}

export function patchToBody(patch) {
  const next = { ...patch };
  for (const k of META_KEYS) {
    delete next[k];
  }
  return next;
}

export function parseListSort(sort, table) {
  if (sort === 'full_name') {
    return { column: 'full_name', ascending: true };
  }
  if (sort === 'title') {
    return { column: 'title', ascending: true };
  }
  if (sort === '-created_date') {
    return { column: 'created_at', ascending: false };
  }
  if (sort === '-updated_date' || sort === undefined || sort === null || sort === '') {
    return { column: 'updated_at', ascending: false };
  }
  if (typeof sort === 'string' && sort.startsWith('-')) {
    const field = sort.slice(1);
    if (field === 'updated_date') {
      return { column: 'updated_at', ascending: false };
    }
    if (field === 'created_date') {
      return { column: 'created_at', ascending: false };
    }
  }
  if (typeof sort === 'string' && !sort.startsWith('-')) {
    return { column: 'full_name', ascending: true };
  }
  return { column: 'updated_at', ascending: false };
}
