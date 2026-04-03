import { requireSupabase, supabase } from '@/lib/backend/supabaseClient';
import { rowToEntity, patchToBody, parseListSort } from '@/lib/backend/rowUtils';

const TABLE_BY_ENTITY = {
  Show: 'shows',
  Student: 'students',
  TechAssignment: 'tech_assignments',
  TechApplication: 'tech_applications',
  Director: 'directors',
  Equipment: 'equipment',
  EquipmentReservation: 'equipment_reservations',
  Resource: 'resources',
  EmailTemplate: 'email_templates',
  PendingEmail: 'pending_emails',
  Badge: 'badges',
  BadgeEnrollment: 'badge_enrollments',
  Training: 'trainings',
  TrainingEnrollment: 'training_enrollments',
};

function resolveListArgs(sortArg, limitArg) {
  let sort = '-updated_date';
  let limit = 5000;
  if (typeof sortArg === 'string' && typeof limitArg === 'number') {
    sort = sortArg;
    limit = limitArg;
  } else if (typeof sortArg === 'string' && limitArg === undefined) {
    sort = sortArg;
  }
  return { sort, limit };
}

function makeEntityApi(table) {
  return {
    async list(sortArg, limitArg) {
      const sb = requireSupabase();
      const { sort, limit } = resolveListArgs(sortArg, limitArg);
      const { column, ascending } = parseListSort(sort, table);
      const { data, error } = await sb
        .from(table)
        .select('*')
        .order(column, { ascending, nullsFirst: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map((row) => rowToEntity(table, row));
    },

    async filter(where) {
      const sb = requireSupabase();
      let q = sb.from(table).select('*');
      for (const [key, value] of Object.entries(where || {})) {
        if (value === undefined || value === null) continue;
        q = q.eq(key, value);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((row) => rowToEntity(table, row));
    },

    async create(payload) {
      const sb = requireSupabase();
      const body = patchToBody({ ...payload });
      const { data, error } = await sb
        .from(table)
        .insert({ body })
        .select('*')
        .single();
      if (error) throw error;
      return rowToEntity(table, data);
    },

    async update(id, patch) {
      const sb = requireSupabase();
      const { data: existing, error: fetchErr } = await sb
        .from(table)
        .select('body')
        .eq('id', id)
        .single();
      if (fetchErr) throw fetchErr;
      const merged = { ...(existing?.body || {}), ...patchToBody({ ...patch }) };
      const { data, error } = await sb
        .from(table)
        .update({ body: merged })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return rowToEntity(table, data);
    },

    async delete(id) {
      const sb = requireSupabase();
      const { error } = await sb.from(table).delete().eq('id', id);
      if (error) throw error;
    },
  };
}

function makeProfilesUserApi() {
  return {
    async list() {
      const sb = requireSupabase();
      const { data, error } = await sb.from('profiles').select('*');
      if (error) throw error;
      return (data ?? []).map((row) => rowToEntity('profiles', row));
    },
    async filter(where) {
      const sb = requireSupabase();
      let q = sb.from('profiles').select('*');
      for (const [key, value] of Object.entries(where || {})) {
        if (value === undefined || value === null) continue;
        q = q.eq(key, value);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((row) => rowToEntity('profiles', row));
    },
    async create() {
      throw new Error('User profiles are created on signup only');
    },
    async update() {
      throw new Error('Use profile settings or Supabase dashboard');
    },
    async delete() {
      throw new Error('Not supported');
    },
  };
}

function makeAuthApi() {
  return {
    async isAuthenticated() {
      if (!supabase) return false;
      const { data } = await supabase.auth.getSession();
      return !!data.session;
    },

    async me() {
      const sb = requireSupabase();
      const {
        data: { user },
        error: userErr,
      } = await sb.auth.getUser();
      if (userErr || !user) {
        const err = new Error('Not authenticated');
        // Extend the Error object with a status code for callers.
        /** @type {any} */ (err).status = 401;
        throw err;
      }
      const { data: profile, error: pErr } = await sb
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      if (pErr) throw pErr;
      return {
        id: user.id,
        email: profile?.email ?? user.email ?? '',
        full_name: profile?.full_name ?? '',
        role: profile?.role ?? 'student',
      };
    },

    logout(redirectOrUndefined) {
      if (redirectOrUndefined === false) {
        if (supabase) {
          void supabase.auth.signOut();
        }
        return;
      }

      const targetUrl =
        typeof redirectOrUndefined === 'string' && redirectOrUndefined.length > 0
          ? redirectOrUndefined.startsWith('http')
            ? redirectOrUndefined
            : new URL(redirectOrUndefined, window.location.origin).href
          : new URL('/login', window.location.origin).href;

      const go = () => {
        window.location.replace(targetUrl);
      };

      if (!supabase) {
        go();
        return;
      }

      const hang = window.setTimeout(() => {
        console.warn('[logout] signOut slow; redirecting anyway');
        go();
      }, 1200);

      supabase.auth
        .signOut()
        .then(({ error }) => {
          if (error) {
            console.error('[logout]', error);
          }
        })
        .catch((err) => {
          console.error('[logout]', err);
        })
        .finally(() => {
          window.clearTimeout(hang);
          go();
        });
    },

    redirectToLogin(returnUrl) {
      const q = returnUrl
        ? `?returnUrl=${encodeURIComponent(returnUrl)}`
        : '';
      window.location.assign(`/login${q}`);
    },
  };
}

const SEND_EMAIL_TIMEOUT_MS = 15000;

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)),
        ms
      )
    ),
  ]);
}

function makeIntegrationsApi() {
  return {
    Core: {
      /** Returns { ok: true, data } or { ok: false, error } — does not throw (email is best-effort for most flows). */
      async SendEmail({ to, subject, body: html }) {
        const sb = requireSupabase();
        try {
          const {
            data: { session },
          } = await sb.auth.getSession();
          const { data, error } = await withTimeout(
            sb.functions.invoke('send-email', {
              body: { to, subject, body: html },
              headers: session?.access_token
                ? { Authorization: `Bearer ${session.access_token}` }
                : {},
            }),
            SEND_EMAIL_TIMEOUT_MS,
            'send-email'
          );
          if (error) {
            console.error('[SendEmail]', error);
            const msg =
              typeof error.message === 'string'
                ? error.message
                : String(error?.context?.msg || error);
            return { ok: false, error: msg };
          }
          return { ok: true, data };
        } catch (e) {
          console.error('[SendEmail]', e);
          return { ok: false, error: e?.message || String(e) };
        }
      },

      async UploadFile({ file }) {
        const sb = requireSupabase();
        const {
          data: { session },
        } = await sb.auth.getSession();
        if (!session?.user?.id) {
          throw new Error('You must be signed in to upload files');
        }
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${session.user.id}/${crypto.randomUUID()}-${safeName}`;
        const { error: upErr } = await sb.storage
          .from('uploads')
          .upload(path, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type || 'application/octet-stream',
          });
        if (upErr) throw upErr;
        const { data: pub } = sb.storage.from('uploads').getPublicUrl(path);
        return { file_url: pub.publicUrl };
      },
    },
  };
}

export function createDb() {
  const entities = {};
  for (const [name, table] of Object.entries(TABLE_BY_ENTITY)) {
    entities[name] = makeEntityApi(table);
  }
  entities.User = makeProfilesUserApi();

  return {
    auth: makeAuthApi(),
    entities,
    integrations: makeIntegrationsApi(),
  };
}

export const db = createDb();
