import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const resendKey = Deno.env.get('RESEND_API_KEY');
    const fromAddr = Deno.env.get('RESEND_FROM') ?? 'onboarding@resend.dev';

    if (!resendKey) {
      console.error('RESEND_API_KEY is not set');
      return new Response(JSON.stringify({ error: 'Email provider not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    return new Response(JSON.stringify({ ok: true, id: payload.id }), {
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
