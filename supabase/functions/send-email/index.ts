import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function toBase64Url(input: string) {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function toBase64(input: string) {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function encodeMimeHeader(value: string) {
  // RFC 2047 encoded-word for non-ASCII headers (fixes mojibake in subjects)
  return /[^\x00-\x7F]/.test(value) ? `=?UTF-8?B?${toBase64(value)}?=` : value;
}

async function sendViaGmailApi({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const clientId = Deno.env.get('GMAIL_CLIENT_ID');
  const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET');
  const refreshToken = Deno.env.get('GMAIL_REFRESH_TOKEN');
  const fromAddr = Deno.env.get('GMAIL_FROM');

  if (!clientId || !clientSecret || !refreshToken || !fromAddr) {
    throw new Error('Gmail API is not fully configured');
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const tokenPayload = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenPayload?.access_token) {
    console.error('Gmail token error', tokenPayload);
    throw new Error(tokenPayload?.error_description ?? tokenPayload?.error ?? 'Failed to obtain Gmail access token');
  }

  const mime = [
    `From: ${fromAddr}`,
    `To: ${to}`,
    `Subject: ${encodeMimeHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    '',
    html,
  ].join('\r\n');

  const raw = toBase64Url(mime);

  const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenPayload.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  const sendPayload = await sendRes.json().catch(() => ({}));
  if (!sendRes.ok) {
    console.error('Gmail send error', sendPayload);
    throw new Error(sendPayload?.error?.message ?? 'Gmail send failed');
  }

  return { id: sendPayload.id };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { to, subject, body: html } = await req.json();
    if (!to || !subject || !html) {
      return new Response(JSON.stringify({ error: 'to, subject, and body are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();

    if (!user) {
      const { data: admins, error: adminErr } = await admin
        .from('profiles')
        .select('email')
        .eq('role', 'admin');
      if (adminErr) {
        console.error(adminErr);
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const allowed = (admins ?? []).some((a) => a.email?.toLowerCase() === String(to).toLowerCase());
      if (!allowed) {
        return new Response(JSON.stringify({ error: 'Unauthenticated sends must target an admin email' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const provider = (Deno.env.get('EMAIL_PROVIDER') ?? '').trim().toLowerCase();
    let result: { id?: string } | null = null;

    if (provider === 'gmail') {
      result = await sendViaGmailApi({ to, subject, html });
    } else {
      const resendKey = Deno.env.get('RESEND_API_KEY');
      const fromAddr = Deno.env.get('RESEND_FROM') ?? 'onboarding@resend.dev';

      if (!resendKey) {
        // Automatic Gmail fallback if Gmail secrets are present.
        const hasGmailCreds = !!(
          Deno.env.get('GMAIL_CLIENT_ID') &&
          Deno.env.get('GMAIL_CLIENT_SECRET') &&
          Deno.env.get('GMAIL_REFRESH_TOKEN') &&
          Deno.env.get('GMAIL_FROM')
        );
        if (hasGmailCreds) {
          result = await sendViaGmailApi({ to, subject, html });
        } else {
          console.error('No email provider configured');
          return new Response(JSON.stringify({ error: 'Email provider not configured (set Resend or Gmail secrets)' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } else {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromAddr,
            to: [to],
            subject,
            html,
          }),
        });

        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          console.error('Resend error', payload);
          return new Response(JSON.stringify({ error: payload.message ?? 'Resend failed' }), {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        result = { id: payload.id };
      }
    }

    return new Response(JSON.stringify({ ok: true, id: result?.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
