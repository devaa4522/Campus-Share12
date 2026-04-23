// @ts-expect-error
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT     = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@campusshare.app';

interface PushPayload {
  user_id: string;
  type:    string;
  title:   string;
  body:    string;
  data?:   Record<string, unknown>;
}

async function generateVAPIDHeaders(endpoint: string): Promise<Record<string, string>> {
  const audience   = new URL(endpoint).origin;
  const expiration = Math.floor(Date.now() / 1000) + 12 * 3600;

  const header = btoa(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const payload = btoa(JSON.stringify({
    aud: audience, exp: expiration, sub: VAPID_SUBJECT,
  })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const signingInput = `${header}.${payload}`;

  const privateKeyBytes = Uint8Array.from(
    atob(VAPID_PRIVATE_KEY.replace(/-/g, '+').replace(/_/g, '/')),
    (c) => c.charCodeAt(0)
  );

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBytes.buffer as ArrayBuffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return {
    Authorization: `vapid t=${signingInput}.${sig},k=${VAPID_PUBLIC_KEY}`,
    'Content-Type': 'application/octet-stream',
    TTL: '86400',
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  try {
    const payload: PushPayload = await req.json();

    console.log('[push] Incoming payload:', JSON.stringify(payload));

    if (!payload.user_id || !payload.title || !payload.body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: user_id, title, body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', payload.user_id);

    console.log('[push] Subscriptions found:', subscriptions?.length ?? 0);

    if (subError || !subscriptions?.length) {
      console.log('[push] No subscriptions:', subError?.message);
      return new Response(
        JSON.stringify({ sent: 0, reason: subError?.message || 'no subscriptions' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Build the Web Push payload
    const webPushBody = JSON.stringify({
      title: payload.title,
      body:  payload.body,
      type:  payload.type,
      data:  {
        ...(payload.data || {}),
        url: payload.data?.url || '/messages',
      },
    });

    console.log('[push] Sending to', subscriptions.length, 'subscriptions');

    type Sub = { endpoint: string; p256dh: string; auth: string };

    const results = await Promise.allSettled(
      (subscriptions as Sub[]).map(async (sub) => {
        try {
          const headers  = await generateVAPIDHeaders(sub.endpoint);
          const response = await fetch(sub.endpoint, {
            method: 'POST',
            headers,
            body: new TextEncoder().encode(webPushBody),
          });

          console.log(`[push] endpoint=${sub.endpoint.slice(0, 60)}… status=${response.status}`);

          // Clean up expired subscriptions
          if (response.status === 410 || response.status === 404) {
            console.log('[push] Removing stale subscription:', sub.endpoint.slice(0, 60));
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('endpoint', sub.endpoint);
          }

          return response.status;
        } catch (err) {
          console.error('[push] fetch error:', err);
          throw err;
        }
      })
    );

    const sent = results.filter(
      (r): r is PromiseFulfilledResult<number> =>
        r.status === 'fulfilled' && (r.value === 200 || r.value === 201)
    ).length;

    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`[push] Done: sent=${sent}, failed=${failed}, total=${subscriptions.length}`);

    return new Response(
      JSON.stringify({ sent, failed, total: subscriptions.length }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (err) {
    console.error('[push] Fatal error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});