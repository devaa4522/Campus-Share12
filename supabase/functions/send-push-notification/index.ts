// @ts-expect-error // Supabase client import from CDN
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT     = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@campusshare.app';

interface PushPayload {
  user_id:         string;
  type:            string;
  title?:          string;
  body?:           string;
  data?:           Record<string, unknown>;
  sender_id?:      string;
  message_id?:     string;
  conversation_id?: string;
}

async function generateVAPIDHeaders(endpoint: string): Promise<Record<string, string>> {
  const audience = new URL(endpoint).origin;
  const expiration = Math.floor(Date.now() / 1000) + 12 * 3600;

  const header = btoa(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const payload = btoa(JSON.stringify({
    aud: audience,
    exp: expiration,
    sub: VAPID_SUBJECT,
  })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const signingInput = `${header}.${payload}`;

  const privateKeyBytes = Uint8Array.from(
    atob(VAPID_PRIVATE_KEY.replace(/-/g, '+').replace(/_/g, '/')),
    (c) => c.charCodeAt(0)
  );

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBytes as unknown as BufferSource,
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

  const token = `${signingInput}.${sig}`;

  return {
    Authorization: `vapid t=${token},k=${VAPID_PUBLIC_KEY}`,
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
    const pushPayload: PushPayload = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ── Fetch sender profile if it's a message ──────────────────────────
    let senderName = 'CampusShare';
    let messageContent = pushPayload.body || 'You have a new notification';

    if (pushPayload.type === 'new_message' && pushPayload.sender_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, username')
        .eq('id', pushPayload.sender_id)
        .single();

      if (profile) {
        senderName = profile.full_name || profile.username || 'Someone';
      }

      // Fetch actual message content
      if (pushPayload.message_id) {
        const { data: message } = await supabase
          .from('messages')
          .select('content')
          .eq('id', pushPayload.message_id)
          .single();

        if (message) {
          messageContent = message.content;
        }
      }
    }

    // ── Build final notification payload ────────────────────────────────
    const title = pushPayload.type === 'new_message' 
      ? senderName 
      : (pushPayload.title || 'CampusShare');

    const body = pushPayload.type === 'new_message'
      ? messageContent
      : pushPayload.body || 'You have a new notification';

    // ── Fetch all push subscriptions for this user ─────────────────────
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', pushPayload.user_id);

    if (error || !subscriptions?.length) {
      return new Response(
        JSON.stringify({ sent: 0, reason: error?.message || 'no subscriptions' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const messageBody = JSON.stringify({
      title,
      body,
      type: pushPayload.type,
      data: pushPayload.data || {},
    });

    type PushSubscription = { endpoint: string; p256dh: string; auth: string };

    const results = await Promise.allSettled(
      (subscriptions as PushSubscription[]).map(async (sub) => {
        const headers = await generateVAPIDHeaders(sub.endpoint);

        const response = await fetch(sub.endpoint, {
          method: 'POST',
          headers,
          body: new TextEncoder().encode(messageBody),
        });

        // Clean up dead subscriptions
        if (response.status === 410 || response.status === 404) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint);
        }

        return response.status;
      })
    );

    const sent = results.filter(
      (r): r is PromiseFulfilledResult<number> =>
        r.status === 'fulfilled' && (r.value === 201 || r.value === 200)
    ).length;

    // ✅ ADD THIS LOGGING
  console.log('[PUSH DEBUG]', {
    user_id: pushPayload.user_id,
    total_subscriptions: subscriptions.length,
    sent_count: sent,
    results: results.map(r => ({
      status: r.status,
      value: r.status === 'fulfilled' ? r.value : (r as PromiseRejectedResult).reason
    }))
  });
    return new Response(
      JSON.stringify({ sent, total: subscriptions.length }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err) {
    console.error('[push-notification]', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});