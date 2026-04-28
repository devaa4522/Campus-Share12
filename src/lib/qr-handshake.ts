// src/lib/qr-handshake.ts

export type QrDealType = "item" | "task";
export type QrAction = "handoff" | "return" | "complete" | null;

export type HandshakeQrPayload = {
  v: 1;
  deal_id: string;
  deal_type: QrDealType;
  user_id: string;
  action: QrAction;
  timestamp: number;
};

export function createHandshakeQrPayload(params: {
  dealId: string;
  dealType: QrDealType;
  userId: string;
  action: QrAction;
}) {
  return JSON.stringify({
    v: 1,
    deal_id: params.dealId,
    deal_type: params.dealType,
    user_id: params.userId,
    action: params.action,
    timestamp: Date.now(),
  } satisfies HandshakeQrPayload);
}

export function parseHandshakeQrPayload(raw: string): HandshakeQrPayload | null {
  try {
    const parsed = JSON.parse(raw);

    if (
      parsed &&
      parsed.v === 1 &&
      typeof parsed.deal_id === "string" &&
      (parsed.deal_type === "item" || parsed.deal_type === "task") &&
      typeof parsed.user_id === "string" &&
      typeof parsed.timestamp === "number" &&
      (
        parsed.action === "handoff" ||
        parsed.action === "return" ||
        parsed.action === "complete" ||
        parsed.action === null
      )
    ) {
      return parsed as HandshakeQrPayload;
    }

    return null;
  } catch {
    return null;
  }
}