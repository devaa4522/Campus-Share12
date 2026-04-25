// supabase/functions/push-notify/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VAPID_PUBLIC_KEY  = Deno.env.get("VAPID_PUBLIC_KEY")  ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT     = Deno.env.get("VAPID_SUBJECT")     ?? "mailto:admin@example.com";

interface PushPayload {
  notification_id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  sender_avatar?: string;
  data?: Record<string, unknown>;
  timestamp?: number;
}

interface Sub {
  endpoint: string;
  p256dh: string;
  auth: string;
}

// ── Base64url helpers (keep existing) ──
function base64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function jsonToBase64url(obj: unknown): string {
  return bytesToBase64url(new TextEncoder().encode(JSON.stringify(obj)));
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const a of arrays) total += a.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

// ── VAPID JWT (keep existing) ──
async function buildVapidJwt(audience: string): Promise<string> {
  const rawPriv = base64urlToBytes(VAPID_PRIVATE_KEY);
  const rawPub  = base64urlToBytes(VAPID_PUBLIC_KEY);

  const x = bytesToBase64url(rawPub.slice(1, 33));
  const y = bytesToBase64url(rawPub.slice(33, 65));
  const d = bytesToBase64url(rawPriv);

  const privKey = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x, y, d, ext: true },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const header = jsonToBase64url({ typ: "JWT", alg: "ES256" });
  const claims = jsonToBase64url({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: VAPID_SUBJECT,
  });

  const sigInput = `${header}.${claims}`;
  const sigBuffer = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privKey,
    new TextEncoder().encode(sigInput),
  );

  const sig = bytesToBase64url(new Uint8Array(sigBuffer));
  return `${sigInput}.${sig}`;
}

// ── HKDF (keep existing) ──
async function hkdf(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw", ikm, { name: "HKDF" }, false, ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

// ── Encryption (keep existing) ──
async function encryptPayload(
  sub: Sub,
  plaintext: string,
): Promise<{ body: Uint8Array; salt: Uint8Array; serverPubKey: Uint8Array }> {
  const authSecret = base64urlToBytes(sub.auth);
  const clientPub = base64urlToBytes(sub.p256dh);
  const enc = new TextEncoder();

  const serverKP = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const serverPubKey = new Uint8Array(
    await crypto.subtle.exportKey("raw", serverKP.publicKey),
  );

  const clientKey = await crypto.subtle.importKey(
    "raw", clientPub,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );

  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientKey },
      serverKP.privateKey,
      256,
    ),
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const authInfo = enc.encode("Content-Encoding: auth\0");
  const prk = await hkdf(sharedSecret, authSecret, authInfo, 32);

  const label = enc.encode("P-256");
  const context = concat(
    label,
    new Uint8Array([0]),
    new Uint8Array([0, clientPub.length]),
    clientPub,
    new Uint8Array([0, serverPubKey.length]),
    serverPubKey,
  );

  const cekInfo = concat(enc.encode("Content-Encoding: aesgcm\0"), context);
  const nonceInfo = concat(enc.encode("Content-Encoding: nonce\0"), context);

  const cek = await hkdf(prk, salt, cekInfo, 16);
  const nonce = await hkdf(prk, salt, nonceInfo, 12);

  const aesKey = await crypto.subtle.importKey(
    "raw", cek, { name: "AES-GCM" }, false, ["encrypt"],
  );

  const plaintextBytes = enc.encode(plaintext);
  const padded = new Uint8Array(2 + plaintextBytes.length);
  padded[0] = 0; padded[1] = 0;
  padded.set(plaintextBytes, 2);

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, padded),
  );

  return { body: ciphertext, salt, serverPubKey };
}

// ── Send push (keep existing) ──
async function sendOnePush(sub: Sub, message: string): Promise<number> {
  const audience = new URL(sub.endpoint).origin;
  const jwt = await buildVapidJwt(audience);
  const { body, salt, serverPubKey } = await encryptPayload(sub, message);

  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Authorization": `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aesgcm",
      "Encryption": `salt=${bytesToBase64url(salt)}`,
      "Crypto-Key": `dh=${bytesToBase64url(serverPubKey)}; p256ecdsa=${VAPID_PUBLIC_KEY}`,
      "TTL": "86400",
    },
    body,
  });

  if (res.status >= 400) {
    const errBody = await res.text().catch(() => "");
    console.error(`[push-notify] Push failed ${res.status}: ${errBody}`);
  }

  return res.status;
}

// ── Deep link ──
function getDeepLink(type: string, data?: Record<string, unknown>): string {
  const d = data ?? {};
  const routes: Record<string, string> = {
    new_request: `/dashboard?deal=${String(d.deal_id ?? "")}`,
    request_accepted: `/dashboard?deal=${String(d.deal_id ?? "")}&scan=true`,
    request_rejected: `/hub`,
    qr_handshake: `/dashboard?deal=${String(d.deal_id ?? "")}`,
    deal_completed: `/profile`,
    new_message: `/messages?id=${String(d.conversation_id ?? "")}`,
    task_claimed: `/dashboard?deal=${String(d.task_id ?? "")}&type=task`,
    task_completed: `/dashboard?deal=${String(d.task_id ?? "")}&type=task`,
    karma_received: `/profile`,
    karma_penalty: `/profile`,
    system: `/`,
  };
  return routes[type] ?? "/";
}

// ── Main handler ──
Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      console.error("[push-notify] VAPID keys not configured");
      return jsonResponse({ error: "Server misconfigured" }, 500);
    }

    const sbUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const webhookSecret = Deno.env.get("PUSH_WEBHOOK_SECRET") ?? "";
    if (!sbUrl || !sbKey) {
      return jsonResponse({ error: "Supabase credentials missing" }, 500);
    }
    if (!webhookSecret) {
      console.error("[push-notify] PUSH_WEBHOOK_SECRET is not configured");
      return jsonResponse({ error: "Server misconfigured" }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (authHeader !== `Bearer ${webhookSecret}`) {
      console.error("[push-notify] Unauthorized call");
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const rawBody = await req.json() as unknown;
    const payload = rawBody as PushPayload;

    if (!payload.user_id || !payload.title || !payload.body) {
      return jsonResponse({ error: "Missing user_id, title, or body" }, 400);
    }

    console.log("[push-notify] Processing:", {
      user_id: payload.user_id,
      type: payload.type,
      title: payload.title,
      body: payload.body.slice(0, 50) + "...",
    });

    const supabase = createClient(sbUrl, sbKey);

    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", payload.user_id);

    if (subError || !subscriptions?.length) {
      return jsonResponse({
        sent: 0,
        reason: subError?.message ?? "no subscriptions",
      });
    }

    // Build WhatsApp-style rich notification
    const messageJson = JSON.stringify({
      title: payload.title, // Sender name from profiles
      body: payload.body,   // Actual message content
      icon: payload.sender_avatar || "/android-chrome-192x192.png",
      badge: "/favicon-32x32.png",
      type: payload.type,
      data: {
        ...(payload.data ?? {}),
        url: payload.data?.url || getDeepLink(payload.type, payload.data),
        notification_id: payload.notification_id,
        timestamp: payload.timestamp || Date.now(),
      },
    });

    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions as Sub[]) {
      try {
        if (!sub.endpoint || !sub.auth || !sub.p256dh) continue;

        const status = await sendOnePush(sub, messageJson);

        if (status === 410 || status === 404) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", sub.endpoint);
          console.log("[push-notify] Removed stale subscription");
        } else if (status >= 200 && status < 300) {
          sent++;
          await supabase
            .from("push_subscriptions")
            .update({ last_used_at: new Date().toISOString() })
            .eq("endpoint", sub.endpoint);
        } else {
          failed++;
        }
      } catch (err) {
        failed++;
        console.error("[push-notify] Error:", err);
      }
    }

    console.log(`[push-notify] Results: sent=${sent} failed=${failed}`);
    return jsonResponse({ sent, failed, total: subscriptions.length });

  } catch (err) {
    console.error("[push-notify] Fatal error:", err);
    return jsonResponse({ error: String(err) }, 500);
  }
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}