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

  // ✅ Fixed TypeScript error
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

    console.log('[push] Received:', JSON.stringify({
      user_id: payload.user_id,
      type:    payload.type,
      title:   payload.title,
      body:    payload.body?.slice(0, 50),
    }));

    // Validate required fields
    if (!payload.user_id || !payload.title || !payload.body) {
      return new Response(
        JSON.stringify({ error: 'Missing: user_id, title, or body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', payload.user_id);

    console.log('[push] Subscriptions:', subscriptions?.length ?? 0, subError?.message ?? '');

    if (subError || !subscriptions?.length) {
      return new Response(
        JSON.stringify({ sent: 0, reason: subError?.message || 'no subscriptions found' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Web Push message
    const webPushMessage = JSON.stringify({
      title: payload.title,
      body:  payload.body,
      type:  payload.type,
      data: {
        ...(payload.data ?? {}),
        url: payload.data?.url ?? '/messages',
      },
    });

    type Sub = { endpoint: string; p256dh: string; auth: string };

    const results = await Promise.allSettled(
      (subscriptions as Sub[]).map(async (sub) => {
        const headers  = await generateVAPIDHeaders(sub.endpoint);
        const response = await fetch(sub.endpoint, {
          method: 'POST',
          headers,
          body: new TextEncoder().encode(webPushMessage),
        });

        console.log('[push] FCM status:', response.status, sub.endpoint.slice(0, 50));

        // Remove dead subscriptions
        if (response.status === 410 || response.status === 404) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint);
          console.log('[push] Removed stale subscription');
        }

        return response.status;
      })
    );

    const sent   = results.filter(
      (r): r is PromiseFulfilledResult<number> =>
        r.status === 'fulfilled' && [200, 201].includes(r.value)
    ).length;

    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`[push] Done — sent:${sent} failed:${failed} total:${subscriptions.length}`);

    return new Response(
      JSON.stringify({ sent, failed, total: subscriptions.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[push] Fatal:', String(err));
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});