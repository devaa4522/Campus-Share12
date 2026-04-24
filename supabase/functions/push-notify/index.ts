// @ts-nocheck
// supabase/functions/push-notify/index.ts
// Sends Web Push notifications (RFC 8291 aesgcm encryption + VAPID ES256)
// Invoked either directly or via a Postgres database webhook on notifications INSERT.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Env ──────────────────────────────────────────────────────────────────────

const VAPID_PUBLIC_KEY  = Deno.env.get("VAPID_PUBLIC_KEY")  ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT     = Deno.env.get("VAPID_SUBJECT")     ?? "mailto:devendrapalli143@gmail.com";

// ── Types ────────────────────────────────────────────────────────────────────

interface PushPayload {
  user_id: string;
  type:    string;
  title:   string;
  body:    string;
  data?:   Record<string, unknown>;
}

interface Sub {
  endpoint: string;
  p256dh:   string;
  auth:     string;
}

// ── Base64url helpers ────────────────────────────────────────────────────────

function base64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64url(bytes: Uint8Array): string {
  // Chunk-safe: don't use String.fromCharCode(...spread) which blows up on large arrays
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function jsonToBase64url(obj: unknown): string {
  return bytesToBase64url(new TextEncoder().encode(JSON.stringify(obj)));
}

// ── Concat helper ────────────────────────────────────────────────────────────

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

// ── VAPID JWT (ES256) ────────────────────────────────────────────────────────
// VAPID private key from web-push is a 32-byte raw EC scalar in base64url.
// Deno's Web Crypto doesn't support importKey('raw') for ECDSA, so we must
// convert to JWK format.

async function buildVapidJwt(audience: string): Promise<string> {
  // 1. Decode the raw 32-byte private scalar
  const rawPriv = base64urlToBytes(VAPID_PRIVATE_KEY);
  const rawPub  = base64urlToBytes(VAPID_PUBLIC_KEY);

  // 2. The uncompressed public key is 65 bytes: 0x04 || x(32) || y(32)
  const x = bytesToBase64url(rawPub.slice(1, 33));
  const y = bytesToBase64url(rawPub.slice(33, 65));
  const d = bytesToBase64url(rawPriv);

  // 3. Import as JWK — this is the only reliable cross-runtime way
  const privKey = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x, y, d, ext: true },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  // 4. Build JWT header + claims
  const header = jsonToBase64url({ typ: "JWT", alg: "ES256" });
  const claims = jsonToBase64url({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: VAPID_SUBJECT,
  });

  const sigInput = `${header}.${claims}`;

  // 5. Sign with ECDSA SHA-256
  const sigBuffer = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privKey,
    new TextEncoder().encode(sigInput),
  );

  // 6. Web Crypto returns IEEE P1363 format (r‖s, 64 bytes) which is what VAPID expects
  const sig = bytesToBase64url(new Uint8Array(sigBuffer));
  return `${sigInput}.${sig}`;
}

// ── HKDF ─────────────────────────────────────────────────────────────────────

async function hkdf(
  ikm:    Uint8Array,
  salt:   Uint8Array,
  info:   Uint8Array,
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

// ── RFC 8291 aesgcm encryption ───────────────────────────────────────────────

async function encryptPayload(
  sub:       Sub,
  plaintext: string,
): Promise<{ body: Uint8Array; salt: Uint8Array; serverPubKey: Uint8Array }> {
  const authSecret  = base64urlToBytes(sub.auth);
  const clientPub   = base64urlToBytes(sub.p256dh);
  const enc         = new TextEncoder();

  // 1. Ephemeral server ECDH keypair
  const serverKP = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const serverPubKey = new Uint8Array(
    await crypto.subtle.exportKey("raw", serverKP.publicKey),
  );

  // 2. Import client public key
  const clientKey = await crypto.subtle.importKey(
    "raw", clientPub,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );

  // 3. ECDH shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientKey },
      serverKP.privateKey,
      256,
    ),
  );

  // 4. Random 16-byte salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 5. Build info parameters per RFC 8291 (aesgcm content encoding)
  // info for auth: "Content-Encoding: auth\0"
  const authInfo = enc.encode("Content-Encoding: auth\0");

  // PRK from HKDF(ikm=sharedSecret, salt=authSecret, info=authInfo)
  const prk = await hkdf(sharedSecret, authSecret, authInfo, 32);

  // Context for aesgcm:
  //   "P-256" + \0 + uint16(clientPub.length) + clientPub + uint16(serverPub.length) + serverPub
  const label = enc.encode("P-256");
  const context = concat(
    label,
    new Uint8Array([0]),
    new Uint8Array([0, clientPub.length]),
    clientPub,
    new Uint8Array([0, serverPubKey.length]),
    serverPubKey,
  );

  const cekInfo   = concat(enc.encode("Content-Encoding: aesgcm\0"), context);
  const nonceInfo = concat(enc.encode("Content-Encoding: nonce\0"),  context);

  // 6. Derive CEK (16 bytes) and nonce (12 bytes)
  const cek   = await hkdf(prk, salt, cekInfo, 16);
  const nonce = await hkdf(prk, salt, nonceInfo, 12);

  // 7. AES-128-GCM encrypt with 2-byte big-endian padding length prefix
  const aesKey = await crypto.subtle.importKey(
    "raw", cek, { name: "AES-GCM" }, false, ["encrypt"],
  );

  const plaintextBytes = enc.encode(plaintext);
  // aesgcm uses a 2-byte BE padding length prefix (set to 0 = no padding)
  const padded = new Uint8Array(2 + plaintextBytes.length);
  padded[0] = 0; padded[1] = 0;
  padded.set(plaintextBytes, 2);

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, padded),
  );

  return { body: ciphertext, salt, serverPubKey };
}

// ── Send one push notification ───────────────────────────────────────────────

async function sendOnePush(sub: Sub, message: string): Promise<number> {
  const audience = new URL(sub.endpoint).origin;
  const jwt = await buildVapidJwt(audience);
  const { body, salt, serverPubKey } = await encryptPayload(sub, message);

  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Authorization":      `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
      "Content-Type":       "application/octet-stream",
      "Content-Encoding":   "aesgcm",
      "Encryption":         `salt=${bytesToBase64url(salt)}`,
      "Crypto-Key":         `dh=${bytesToBase64url(serverPubKey)}; p256ecdsa=${VAPID_PUBLIC_KEY}`,
      "TTL":                "86400",
    },
    body,
  });

  // Log response body on failure for debugging
  if (res.status >= 400) {
    const errBody = await res.text().catch(() => "");
    console.error(`[push-notify] Push endpoint returned ${res.status}: ${errBody}`);
  }

  return res.status;
}

// ── Deep link helper (mirrors sw.js) ─────────────────────────────────────────

function getDeepLink(type: string, data?: Record<string, unknown>): string {
  const d = data ?? {};
  const routes: Record<string, string> = {
    new_request:      `/dashboard?deal=${String(d.deal_id ?? "")}`,
    request_accepted: `/dashboard?deal=${String(d.deal_id ?? "")}&scan=true`,
    request_rejected: `/hub`,
    qr_handshake:     `/dashboard?deal=${String(d.deal_id ?? "")}`,
    deal_completed:   `/profile`,
    new_message:      `/messages?conv=${String(d.conversation_id ?? "")}`,
    task_claimed:     `/tasks?task=${String(d.task_id ?? "")}`,
    task_completed:   `/profile`,
    karma_received:   `/profile`,
    karma_penalty:    `/profile`,
    system:           `/`,
  };
  return routes[type] ?? "/";
}

// ── Parse payload from either direct call or DB webhook ──────────────────────

function parsePayload(raw: Record<string, unknown>): PushPayload | null {
  // Case 1: Direct invocation — { user_id, type, title, body, data? }
  if (raw.user_id && raw.title && raw.body) {
    return raw as unknown as PushPayload;
  }

  // Case 2: Database webhook — { type: "INSERT", table: "notifications", record: {...} }
  if (raw.type === "INSERT" && raw.table === "notifications" && raw.record) {
    const r = raw.record as Record<string, unknown>;
    return {
      user_id: String(r.user_id ?? ""),
      type:    String(r.type ?? "system"),
      title:   String(r.title ?? ""),
      body:    String(r.body ?? ""),
      data:    (r.data as Record<string, unknown>) ?? {},
    };
  }

  return null;
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin":  "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    // ── Validate env ──
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      console.error("[push-notify] VAPID keys not set");
      return jsonResponse({ error: "VAPID keys not configured on server" }, 500);
    }

    const sbUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!sbUrl || !sbKey) {
      console.error("[push-notify] Supabase credentials not set");
      return jsonResponse({ error: "Server configuration error" }, 500);
    }

    // ── Parse body ──
    let rawBody: Record<string, unknown>;
    try {
      const parsed = await req.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Invalid payload structure");
      }
      rawBody = parsed as Record<string, unknown>;
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const payload = parsePayload(rawBody);
    if (!payload || !payload.user_id || !payload.title || !payload.body) {
      return jsonResponse({ error: "Missing required: user_id, title, body" }, 400);
    }

    console.log("[push-notify] Received:", JSON.stringify({
      user_id: payload.user_id,
      type:    payload.type,
      title:   payload.title,
      body:    payload.body.slice(0, 60),
    }));

    // ── Supabase client ──
    const supabase = createClient(sbUrl, sbKey);

    // ── Fetch subscriptions ──
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", payload.user_id);

    console.log(
      "[push-notify] Subscriptions:",
      subscriptions?.length ?? 0,
      subError ? `err=${subError.message}` : "ok",
    );

    if (subError || !subscriptions?.length) {
      return jsonResponse({
        sent: 0,
        reason: subError?.message ?? "no subscriptions",
      });
    }

    // ── Build push message ──
    const messageJson = JSON.stringify({
      title: payload.title,
      body:  payload.body,
      type:  payload.type,
      data: {
        ...(payload.data ?? {}),
        url: (payload.data?.url as string | undefined)
          ?? getDeepLink(payload.type, payload.data),
      },
    });

    // ── Send to each subscription ──
    let sent   = 0;
    let failed = 0;

    for (const subRaw of subscriptions as Sub[]) {
      try {
        if (!subRaw.endpoint || !subRaw.auth || !subRaw.p256dh) {
          console.warn("[push-notify] Incomplete subscription, skipping");
          continue;
        }

        const status = await sendOnePush(subRaw, messageJson);

        console.log("[push-notify] Status:", status, subRaw.endpoint.slice(0, 60) + "…");

        if (status === 410 || status === 404) {
          // Subscription expired — clean up
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", subRaw.endpoint);
          console.log("[push-notify] Removed stale subscription");
        } else if (status >= 200 && status < 300) {
          sent++;
          await supabase
            .from("push_subscriptions")
            .update({ last_used_at: new Date().toISOString() })
            .eq("endpoint", subRaw.endpoint);
        } else {
          failed++;
          console.error("[push-notify] Unexpected status:", status);
        }
      } catch (err) {
        failed++;
        console.error("[push-notify] sendOnePush error:", String(err));
      }
    }

    console.log(`[push-notify] Done — sent=${sent} failed=${failed} total=${subscriptions.length}`);

    return jsonResponse({ sent, failed, total: subscriptions.length });

  } catch (err) {
    console.error("[push-notify] Fatal:", String(err));
    return jsonResponse({ error: String(err) }, 500);
  }
});

// ── JSON response helper ────────────────────────────────────────────────────

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
