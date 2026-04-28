// src/components/MessageCenterLoader.tsx
"use client";

import dynamic from "next/dynamic";
import { t } from "@/lib/design/tokens";

// ── Skeleton Components ───────────────────────────────────────

function ConversationSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 animate-pulse">
      {/* Avatar */}
      <div
        className="w-12 h-12 rounded-full shrink-0"
        style={{ background: t.surfaceSoft }}
      />
      <div className="flex-1 min-w-0 space-y-2">
        {/* Name row */}
        <div className="flex justify-between items-center">
          <div
            className="h-3 rounded-full w-28"
            style={{ background: t.surfaceSoft }}
          />
          <div
            className="h-2.5 rounded-full w-10"
            style={{ background: t.surfaceSoft }}
          />
        </div>
        {/* Preview row */}
        <div
          className="h-2.5 rounded-full w-3/4"
          style={{ background: t.surfaceSoft }}
        />
        {/* Deal chip */}
        <div
          className="h-2 rounded-full w-20"
          style={{ background: t.surfaceSoft }}
        />
      </div>
    </div>
  );
}

function ChatBubbleSkeleton({
  isMe,
  width,
}: {
  isMe: boolean;
  width: string;
}) {
  return (
    <div
      className={`flex ${isMe ? "justify-end" : "justify-start"} mb-2 px-3 animate-pulse`}
    >
      {!isMe && (
        <div
          className="w-7 h-7 rounded-full mr-2 shrink-0 self-end"
          style={{ background: t.surfaceSoft }}
        />
      )}
      <div
        className="h-10 rounded-2xl"
        style={{
          width,
          background: isMe ? "rgba(0,10,30,0.08)" : t.surfaceSoft,
          borderRadius: isMe
            ? "18px 4px 18px 18px"
            : "4px 18px 18px 18px",
        }}
      />
    </div>
  );
}

export function ConversationListSkeleton() {
  return (
    <div
      className="w-full md:w-[360px] flex flex-col h-full"
      style={{ background: t.card }}
    >
      {/* Header skeleton */}
      <div
        className="px-5 pt-8 pb-4"
        style={{ borderBottom: `1px solid ${t.border}` }}
      >
        <div
          className="h-7 rounded-full w-32 mb-4 animate-pulse"
          style={{ background: t.surfaceSoft }}
        />
        <div
          className="h-10 rounded-xl w-full animate-pulse"
          style={{ background: t.surfaceSoft }}
        />
      </div>

      {/* Conversation rows */}
      <div
        className="flex-1 divide-y"
        style={{ borderColor: t.border }}
      >
        {[...Array(7)].map((_, i) => (
          <ConversationSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function ChatThreadSkeleton() {
  const bubbles = [
    { isMe: false, width: "55%" },
    { isMe: true,  width: "42%" },
    { isMe: false, width: "68%" },
    { isMe: true,  width: "35%" },
    { isMe: true,  width: "58%" },
    { isMe: false, width: "48%" },
    { isMe: true,  width: "38%" },
  ];

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      style={{ background: t.surfaceSoft }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 animate-pulse shrink-0"
        style={{
          background: t.card,
          borderBottom: `1px solid ${t.border}`,
        }}
      >
        <div
          className="w-8 h-8 rounded-full"
          style={{ background: t.surfaceSoft }}
        />
        <div
          className="w-10 h-10 rounded-full"
          style={{ background: t.surfaceSoft }}
        />
        <div className="flex-1 space-y-1.5">
          <div
            className="h-3 rounded-full w-32"
            style={{ background: t.surfaceSoft }}
          />
          <div
            className="h-2 rounded-full w-16"
            style={{ background: t.surfaceSoft }}
          />
        </div>
      </div>

      {/* Deal card skeleton */}
      <div className="px-3 pt-3">
        <div
          className="rounded-2xl p-3 animate-pulse"
          style={{ background: t.card }}
        >
          <div
            className="h-2 rounded-full w-24 mb-3"
            style={{ background: t.surfaceSoft }}
          />
          <div className="flex gap-3">
            <div
              className="w-12 h-12 rounded-xl shrink-0"
              style={{ background: t.surfaceSoft }}
            />
            <div className="flex-1 space-y-2">
              <div
                className="h-3 rounded-full w-3/4"
                style={{ background: t.surfaceSoft }}
              />
              <div
                className="h-2.5 rounded-full w-1/2"
                style={{ background: t.surfaceSoft }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bubbles */}
      <div className="flex-1 py-4">
        {bubbles.map((b, i) => (
          <ChatBubbleSkeleton key={i} {...b} />
        ))}
      </div>

      {/* Input skeleton */}
      <div
        className="px-3 py-3 flex items-center gap-2 shrink-0 animate-pulse"
        style={{
          background: t.card,
          borderTop: `1px solid ${t.border}`,
        }}
      >
        <div
          className="w-9 h-9 rounded-full shrink-0"
          style={{ background: t.surfaceSoft }}
        />
        <div
          className="flex-1 h-10 rounded-2xl"
          style={{ background: t.surfaceSoft }}
        />
        <div
          className="w-9 h-9 rounded-full shrink-0"
          style={{ background: t.surfaceSoft }}
        />
      </div>
    </div>
  );
}

// ── Full Page Skeleton (sidebar + chat) ───────────────────────

export function MessageCenterSkeleton() {
  return (
    <div className="flex w-full h-full overflow-hidden">
      <ConversationListSkeleton />
      <div className="hidden md:flex flex-1">
        <ChatThreadSkeleton />
      </div>
    </div>
  );
}

// ── Dynamic import with skeleton fallback ─────────────────────

const MessageCenterClient = dynamic(
  () => import("./MessageCenterClient"),
  {
    ssr: false,
    loading: () => <MessageCenterSkeleton />,
  }
);

export default MessageCenterClient;