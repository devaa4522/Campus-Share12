// src/components/MessageCenterClient.tsx
"use client";

import {
  useEffect, useState, useRef, useCallback, useMemo,
  type ChangeEvent,
} from "react";
import { createClient }      from "@/utils/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useRouter }         from "next/navigation";
import Image                 from "next/image";
import toast                 from "react-hot-toast";
import QRCode                from "react-qr-code";
import { Html5Qrcode }       from "html5-qrcode";
import {
  motion, AnimatePresence,
  useMotionValue, useTransform, useAnimation,
} from "framer-motion";

import { deduplicateConversations } from "@/lib/conversation-utils";
import type { Message, Conversation, DealInfo } from "@/lib/types";
import { t }                 from "@/lib/design/tokens";
import {
  bubbleVariants, menuVariants, fade, slideUp,
  typingDot, SWIPE_THRESHOLD,
} from "@/lib/design/animations";

// ─── Types ────────────────────────────────────────────────────────────────────

type MsgType = "text" | "image" | "audio" | "file";

interface ExtendedMessage extends Message {
  reactions?:   Record<string, { emoji: string; user_ids: string[] }>;
  reply_to_id?: string | null;
  is_deleted?:  boolean;
  msg_type?:    MsgType;
  is_edited?:   boolean;
}

interface ExtendedConversation extends Omit<Conversation, "messages"> {
  messages: ExtendedMessage[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const QUICK_REACTIONS = ["👍","❤️","😂","😮","😢","🔥","👏","🎉","✅","❌"];

// ─── Pure helpers ─────────────────────────────────────────────────────────────

const fmt12 = (s: string) =>
  new Date(s).toLocaleTimeString([], {
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

const dateDivLabel = (s: string) => {
  const d   = new Date(s);
  const now = new Date();
  const yd  = new Date(now);
  yd.setDate(yd.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === yd.toDateString())  return "Yesterday";
  return d.toLocaleDateString([], {
    weekday: "long", month: "short", day: "numeric",
  });
};

const diffDay = (a: ExtendedMessage | null, b: ExtendedMessage) =>
  !a ||
  new Date(a.created_at).toDateString() !==
  new Date(b.created_at).toDateString();

// Should two consecutive messages be grouped (same sender, within 2 min)?
const shouldGroup = (a: ExtendedMessage | null, b: ExtendedMessage) => {
  if (!a || a.sender_id !== b.sender_id) return false;
  const diff =
    new Date(b.created_at).getTime() -
    new Date(a.created_at).getTime();
  return diff < 2 * 60 * 1000;
};

const isImageUrl = (u: string) =>
  /\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(u);
const isAudioUrl = (u: string) =>
  /\.(webm|mp3|ogg|wav|m4a)(\?|$)/i.test(u) || u.includes("audio");
const isStorageUrl = (u: string) => u.startsWith("https://");

function detectType(msg: ExtendedMessage): MsgType {
  if (msg.msg_type && msg.msg_type !== "text") return msg.msg_type;
  if (!isStorageUrl(msg.content)) return "text";
  if (isImageUrl(msg.content))    return "image";
  if (isAudioUrl(msg.content))    return "audio";
  return "file";
}

function sortConversations(
  convs: ExtendedConversation[]
): ExtendedConversation[] {
  return [...convs].sort((a, b) => {
    const at = a.messages.at(-1)?.created_at ?? a.created_at;
    const bt = b.messages.at(-1)?.created_at ?? b.created_at;
    return new Date(bt).getTime() - new Date(at).getTime();
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// ── Avatar ────────────────────────────────────────────────────

function Avatar({
  name,
  avatarUrl,
  size = 10,
  online = false,
}: {
  name:       string;
  avatarUrl?: string | null;
  size?:      number;
  online?:    boolean;
}) {
  const sz = `${size * 4}px`;

  return (
    <div className="relative flex-shrink-0" style={{ width: sz, height: sz }}>
      {avatarUrl ? (
        <div
          className="w-full h-full rounded-full overflow-hidden relative"
          style={online ? {
            outline: `2px solid ${t.online}`,
            outlineOffset: "2px",
          } : undefined}
        >
          <Image
            src={avatarUrl}
            alt={name}
            fill
            sizes={sz}
            className="object-cover"
          />
        </div>
      ) : (
        <div
          className="w-full h-full rounded-full flex items-center justify-center font-bold text-sm text-white"
          style={{
            background: t.primary,
            outline: online ? `2px solid ${t.online}` : undefined,
            outlineOffset: online ? "2px" : undefined,
          }}
        >
          {(name || "?").charAt(0).toUpperCase()}
        </div>
      )}
      {online && (
        <div
          className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white"
          style={{ background: t.online }}
        />
      )}
    </div>
  );
}

// ── Date divider ──────────────────────────────────────────────

function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-5 px-2 select-none">
      <div className="flex-1 h-px" style={{ background: t.border }} />
      <span
        className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full"
        style={{
          color:      t.textMuted,
          background: t.surfaceSoft,
          border:     `1px solid ${t.border}`,
        }}
      >
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: t.border }} />
    </div>
  );
}

// ── Image lightbox ────────────────────────────────────────────

function ImageLightbox({
  src,
  onClose,
}: {
  src:     string;
  onClose: () => void;
}) {
  return (
    <motion.div
      variants={fade}
      initial="hidden"
      animate="visible"
      exit="hidden"
      className="fixed inset-0 z-[200] bg-black flex flex-col"
    >
      <header className="absolute top-0 left-0 right-0 z-10 flex justify-between items-center p-4 bg-gradient-to-b from-black/70 to-transparent">
        <button
          onClick={onClose}
          className="material-symbols-outlined text-white p-2.5 bg-white/10 rounded-full"
        >
          arrow_back
        </button>
        <a
          href={src}
          download
          className="material-symbols-outlined text-white p-2.5 bg-white/10 rounded-full"
        >
          download
        </a>
      </header>
      <div
        className="flex-1 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="media"
          onClick={e => e.stopPropagation()}
          className="max-w-full max-h-full object-contain rounded-lg select-none"
          draggable={false}
        />
      </div>
    </motion.div>
  );
}

// ── Audio player (simple WhatsApp-style bars) ─────────────────

function AudioPlayer({
  src,
  isMe,
}: {
  src:  string;
  isMe: boolean;
}) {
  const audioRef               = useRef<HTMLAudioElement>(null);
  const [playing,  setPlaying] = useState(false);
  const [progress, setProgress]= useState(0);
  const [duration, setDuration]= useState(0);
  const [speed,    setSpeed]   = useState(1);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else         { a.play();  setPlaying(true);  }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a?.duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    a.currentTime = ((e.clientX - r.left) / r.width) * a.duration;
  };

  const cycleSpeed = () => {
    const n = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(n);
    if (audioRef.current) audioRef.current.playbackRate = n;
  };

  const fmtSec = (s: number) =>
    isNaN(s)
      ? "0:00"
      : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  const BARS = [
    30,55,70,40,85,50,35,90,60,42,
    78,52,65,38,88,55,28,72,45,82,
    62,33,76,50,38,68,55,43,
  ];

  const activeColor = isMe ? "rgba(255,255,255,0.9)" : t.msg.typingDot;
  const inactiveColor = isMe ? "rgba(255,255,255,0.28)" : "rgba(0,10,30,0.15)";

  return (
    <div className="flex items-center gap-2.5 min-w-[200px] max-w-[260px]">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onTimeUpdate={() => {
          const a = audioRef.current;
          if (a) setProgress(a.currentTime / (a.duration || 1));
        }}
        onEnded={() => { setPlaying(false); setProgress(0); }}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
      />

      <button
        onClick={toggle}
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform"
        style={{
          background: isMe ? "rgba(255,255,255,0.2)" : t.primary,
          color: "#fff",
        }}
      >
        <span
          className="material-symbols-outlined text-[22px]"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          {playing ? "pause" : "play_arrow"}
        </span>
      </button>

      <div className="flex-1 flex flex-col gap-1.5">
        {/* Waveform bars */}
        <div
          className="relative h-8 flex items-end gap-px cursor-pointer"
          onClick={seek}
        >
          {BARS.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm transition-colors duration-75"
              style={{
                height: `${h}%`,
                background:
                  i / BARS.length <= progress
                    ? activeColor
                    : inactiveColor,
              }}
            />
          ))}
        </div>

        {/* Time + speed */}
        <div className="flex justify-between items-center">
          <span
            className="text-[10px] font-bold tabular-nums"
            style={{
              color: isMe
                ? "rgba(255,255,255,0.6)"
                : t.textMuted,
            }}
          >
            {fmtSec(
              playing
                ? (audioRef.current?.currentTime ?? 0)
                : duration
            )}
          </span>
          <button
            onClick={cycleSpeed}
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full transition-colors"
            style={{
              background: isMe
                ? "rgba(255,255,255,0.15)"
                : "rgba(0,10,30,0.08)",
              color: isMe
                ? "rgba(255,255,255,0.8)"
                : t.textMuted,
            }}
          >
            {speed}×
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Bubble content ────────────────────────────────────────────

function BubbleContent({
  msg,
  isMe,
  onImageClick,
}: {
  msg:          ExtendedMessage;
  isMe:         boolean;
  onImageClick: (src: string) => void;
}) {
  const type = detectType(msg);

  if (type === "image") return (
    <button
      onClick={() => onImageClick(msg.content)}
      className="block rounded-xl overflow-hidden active:opacity-80 transition-opacity"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={msg.content}
        alt="photo"
        className="w-full h-auto max-w-[260px] object-cover block"
        loading="lazy"
      />
    </button>
  );

  if (type === "audio") return (
    <AudioPlayer src={msg.content} isMe={isMe} />
  );

  if (type === "file") {
    const filename = decodeURIComponent(
      msg.content.split("/").pop() ?? "File"
    );
    return (
      <a
        href={msg.content}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-3 min-w-[180px]"
        style={{ color: isMe ? "rgba(255,255,255,0.9)" : t.text }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: isMe
              ? "rgba(255,255,255,0.15)"
              : `${t.primary}10`,
          }}
        >
          <span className="material-symbols-outlined text-[20px]">
            description
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate">{filename}</p>
          <p
            className="text-[10px]"
            style={{
              color: isMe
                ? "rgba(255,255,255,0.55)"
                : t.textMuted,
            }}
          >
            Tap to open
          </p>
        </div>
        <span
          className="material-symbols-outlined text-[18px] opacity-60"
        >
          open_in_new
        </span>
      </a>
    );
  }

  return (
    <span
      className="text-sm leading-relaxed whitespace-pre-wrap break-words"
    >
      {msg.content}
    </span>
  );
}

// ── Reply quote ───────────────────────────────────────────────

function ReplyQuote({
  source,
  isMe,
  label,
  onClick,
}: {
  source:  ExtendedMessage;
  isMe:    boolean;
  label:   string;
  onClick: () => void;
}) {
  const type = detectType(source);
  const preview =
    type === "image" ? "📷 Photo"
    : type === "audio" ? "🎙️ Voice note"
    : type === "file"  ? "📎 File"
    : source.content;

  return (
    <button
      onClick={onClick}
      className="w-full flex gap-2 rounded-xl px-2.5 py-2 mb-1.5 border-l-[3px] text-left active:opacity-70 transition-opacity"
      style={{
        background: isMe
          ? "rgba(0,0,0,0.3)"
          : `${t.primary}08`,
        borderLeftColor: isMe
          ? "rgba(255,255,255,0.5)"
          : t.secondary,
      }}
    >
      {type === "image" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={source.content}
          alt=""
          className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        <p
          className="text-[10px] font-bold uppercase tracking-wide mb-0.5"
          style={{
            color: isMe ? "rgba(255,255,255,0.75)" : t.secondary,
          }}
        >
          {label}
        </p>
        <p
          className="text-xs truncate"
          style={{
            color: isMe ? "rgba(255,255,255,0.65)" : t.textSub,
          }}
        >
          {preview}
        </p>
      </div>
    </button>
  );
}

// ── Reaction bubble ───────────────────────────────────────────

function ReactionBubble({
  emoji,
  count,
  reacted,
  onToggle,
}: {
  emoji:    string;
  count:    number;
  reacted:  boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-bold active:scale-90 transition-all"
      style={{
        background: reacted ? t.msg.reactionActive : t.msg.reactionBg,
        border: `1px solid ${reacted
          ? `${t.secondary}40`
          : t.border}`,
        color: reacted ? t.secondary : t.textSub,
      }}
    >
      <span>{emoji}</span>
      <span className="tabular-nums">{count}</span>
    </button>
  );
}

// ── Floating emoji picker ─────────────────────────────────────

function FloatingEmojiPicker({
  isMe,
  onSelect,
  onClose,
}: {
  isMe:     boolean;
  onSelect: (e: string) => void;
  onClose:  () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-[88]" onClick={onClose} />
      <motion.div
        variants={menuVariants}
        initial="hidden"
        animate="visible"
        exit="hidden"
        className="absolute z-[89] bottom-full mb-2 rounded-2xl p-1.5 flex gap-0.5"
        style={{
          background: t.card,
          border:     `1px solid ${t.border}`,
          boxShadow:  t.shadowElevated,
          right: isMe ? 0 : undefined,
          left:  isMe ? undefined : 0,
        }}
      >
        {QUICK_REACTIONS.map(e => (
          <button
            key={e}
            onClick={() => { onSelect(e); onClose(); }}
            className="w-9 h-9 flex items-center justify-center text-xl rounded-xl active:scale-90 transition-all hover:opacity-80"
            // ✅ Removed invalid style prop, added hover:opacity-80 class
          >
            {e}
          </button>
        ))}
      </motion.div>
    </>
  );
}

// ── Context menu ──────────────────────────────────────────────

function ContextMenu({
  isMe,
  pos,
  onReact,
  onReply,
  onEdit,
  onDelete,
  onCopy,
  onClose,
}: {
  isMe:      boolean;
  pos:       { x: number; y: number };
  onReact:   () => void;
  onReply:   () => void;
  onEdit?:   () => void;
  onDelete?: () => void;
  onCopy:    () => void;
  onClose:   () => void;
}) {
  const items = [
    { icon: "add_reaction", label: "React",  fn: onReact, danger: false },
    { icon: "reply",        label: "Reply",  fn: onReply, danger: false },
    { icon: "content_copy", label: "Copy",   fn: onCopy,  danger: false },
    ...(isMe ? [
      { icon: "edit",   label: "Edit",   fn: onEdit!,   danger: false },
      { icon: "delete", label: "Delete", fn: onDelete!, danger: true  },
    ] : []),
  ];

  const menuW = 172;
  const menuH = items.length * 48;
  const vw    = typeof window !== "undefined" ? window.innerWidth  : 400;
  const vh    = typeof window !== "undefined" ? window.innerHeight : 700;
  const left  = Math.min(pos.x, vw - menuW - 8);
  const top   = Math.min(pos.y, vh - menuH - 8);

  return (
    <>
      <div className="fixed inset-0 z-[90]" onClick={onClose} />
      <motion.div
        variants={menuVariants}
        initial="hidden"
        animate="visible"
        exit="hidden"
        className="fixed z-[91] rounded-2xl overflow-hidden"
        style={{
          left,
          top,
          minWidth: menuW,
          background: t.card,
          border:     `1px solid ${t.border}`,
          boxShadow:  t.shadowElevated,
        }}
      >
        {items.map(item => (
          <button
            key={item.label}
            onClick={() => { item.fn(); onClose(); }}
            className="flex items-center gap-3 w-full px-4 py-3 text-[13px] font-semibold transition-colors"
            style={{
              color:        item.danger ? t.error : t.text,
              borderBottom: `1px solid ${t.border}`,
            }}
          >
            <span
              className="material-symbols-outlined text-[18px]"
              style={{ color: item.danger ? t.error : t.textMuted }}
            >
              {item.icon}
            </span>
            {item.label}
          </button>
        ))}
      </motion.div>
    </>
  );
}

// ── Typing dots ───────────────────────────────────────────────

function TypingDots() {
  return (
    <motion.div
      variants={fade}
      initial="hidden"
      animate="visible"
      exit="hidden"
      className="flex items-end gap-2 mb-2 px-3"
    >
      <div
        className="px-4 py-3 rounded-2xl rounded-tl-sm"
        style={{
          background: t.msg.receivedBg,
          border:     `1px solid ${t.border}`,
          boxShadow:  t.shadow,
        }}
      >
        <div className="flex gap-1.5 items-center">
          {[0, 0.18, 0.36].map((delay, i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full"
              style={{ background: t.msg.typingDot }}
              animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
              transition={typingDot(delay)}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── Voice note record button ──────────────────────────────────

function VoiceNoteButton({ onSend }: { onSend: (blob: Blob) => void }) {
  const [rec,  setRec]  = useState(false);
  const [secs, setSecs] = useState(0);
  const mediaRef  = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef  = useRef<NodeJS.Timeout | null>(null);

  const start = async () => {
    try {
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRef.current  = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () =>
        onSend(new Blob(chunksRef.current, { type: "audio/webm" }));
      recorder.start();
      setRec(true);
      setSecs(0);
      timerRef.current = setInterval(() => setSecs(s => s + 1), 1000);
    } catch {
      toast.error("Microphone access denied.");
    }
  };

  const stop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRef.current?.stop();
    mediaRef.current?.stream.getTracks().forEach(t => t.stop());
    setRec(false);
  };

  if (rec) return (
    <button
      type="button"
      onClick={stop}
      className="flex items-center gap-1.5 rounded-full px-3 py-2.5 text-xs font-bold flex-shrink-0 active:scale-95 transition-all"
      style={{
        background: `${t.error}12`,
        color:      t.error,
        border:     `1px solid ${t.error}30`,
      }}
    >
      <motion.span
        className="w-2 h-2 rounded-full inline-block flex-shrink-0"
        style={{ background: t.error }}
        animate={{ opacity: [1, 0.2, 1] }}
        transition={{ duration: 0.8, repeat: Infinity }}
      />
      {secs}s · Stop
    </button>
  );

  return (
    <button
      type="button"
      onPointerDown={start}
      className="material-symbols-outlined p-2.5 rounded-full flex-shrink-0 transition-colors active:scale-90"
      style={{
        color:      t.textMuted,
        background: t.surfaceSoft,
      }}
    >
      mic
    </button>
  );
}

// ── Attachment strip ──────────────────────────────────────────

function AttachmentStrip({
  file,
  onRemove,
}: {
  file:     File;
  onRemove: () => void;
}) {
  const url   = useMemo(() => URL.createObjectURL(file), [file]);
  const isImg = file.type.startsWith("image/");

  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  return (
    <div
      className="flex items-center gap-3 mx-3 mb-2 mt-2 rounded-2xl p-2"
      style={{
        background: t.surfaceSoft,
        border:     `1px solid ${t.border}`,
      }}
    >
      <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 relative">
        {isImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: t.surfaceSoft }}
          >
            <span
              className="material-symbols-outlined"
              style={{ color: t.textMuted }}
            >
              description
            </span>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-xs font-semibold truncate"
          style={{ color: t.text }}
        >
          {file.name}
        </p>
        <p className="text-[10px]" style={{ color: t.textMuted }}>
          {(file.size / 1024).toFixed(0)} KB · {isImg ? "Image" : "File"}
        </p>
      </div>
      <button
        onClick={onRemove}
        className="w-7 h-7 rounded-full flex items-center justify-center transition-colors active:scale-90"
        style={{ background: t.card, border: `1px solid ${t.border}` }}
      >
        <span
          className="material-symbols-outlined text-[16px]"
          style={{ color: t.textMuted }}
        >
          close
        </span>
      </button>
    </div>
  );
}

// ── In-chat search ────────────────────────────────────────────

function SearchOverlay({
  messages,
  userId,
  peerName,
  onClose,
  onJump,
}: {
  messages: ExtendedMessage[];
  userId:   string;
  peerName: string;
  onClose:  () => void;
  onJump:   (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const results = useMemo(
    () =>
      q.trim().length > 1
        ? messages.filter(
            m =>
              !m.is_deleted &&
              m.content.toLowerCase().includes(q.toLowerCase())
          )
        : [],
    [messages, q]
  );

  return (
    <motion.div
      variants={fade}
      initial="hidden"
      animate="visible"
      exit="hidden"
      className="absolute inset-0 z-50 flex flex-col"
      style={{ background: t.card }}
    >
      <header
        className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ borderBottom: `1px solid ${t.border}` }}
      >
        <button
          onClick={onClose}
          className="material-symbols-outlined p-1.5 -ml-1 active:scale-90"
          style={{ color: t.textMuted }}
        >
          arrow_back
        </button>
        <div
          className="flex-1 rounded-xl px-3 py-2 flex items-center gap-2"
          style={{ background: t.surfaceSoft }}
        >
          <span
            className="material-symbols-outlined text-[16px]"
            style={{ color: t.textMuted }}
          >
            search
          </span>
          <input
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search in conversation…"
            className="bg-transparent flex-1 text-sm outline-none"
            style={{ color: t.text }}
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="material-symbols-outlined text-[16px]"
              style={{ color: t.textMuted }}
            >
              close
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {q.length <= 1 ? (
          <p
            className="text-center text-sm mt-12"
            style={{ color: t.textMuted }}
          >
            Type to search…
          </p>
        ) : results.length === 0 ? (
          <p
            className="text-center text-sm mt-12"
            style={{ color: t.textMuted }}
          >
            No results for &ldquo;{q}&rdquo;
          </p>
        ) : (
          results.map(m => {
            const me = m.sender_id === userId;
            const i  = m.content
              .toLowerCase()
              .indexOf(q.toLowerCase());
            return (
              <button
                key={m.id}
                onClick={() => { onJump(m.id); onClose(); }}
                className="w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors"
                style={{ borderBottom: `1px solid ${t.border}` }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{
                    background: `${t.primary}12`,
                    color:      t.primary,
                  }}
                >
                  {(me ? "You" : peerName || "?").charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between mb-0.5">
                    <span
                      className="text-[11px] font-bold"
                      style={{ color: t.text }}
                    >
                      {me ? "You" : peerName}
                    </span>
                    <span
                      className="text-[10px]"
                      style={{ color: t.textMuted }}
                    >
                      {fmt12(m.created_at)}
                    </span>
                  </div>
                  <p
                    className="text-xs line-clamp-2"
                    style={{ color: t.textSub }}
                  >
                    {m.content.slice(0, i)}
                    <mark
                      className="rounded px-0.5 font-semibold not-italic"
                      style={{
                        background: `${t.warning}30`,
                        color:      t.warning,
                      }}
                    >
                      {m.content.slice(i, i + q.length)}
                    </mark>
                    {m.content.slice(i + q.length)}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </motion.div>
  );
}

// ── Conversation row ──────────────────────────────────────────

function ConversationRow({
  conv,
  userId,
  isActive,
  onlinePeers,
  peerTypingMap,
  onClick,
}: {
  conv:          ExtendedConversation;
  userId:        string;
  isActive:      boolean;
  onlinePeers:   string[];
  peerTypingMap: Record<string, boolean>;
  onClick:       () => void;
}) {
  const peer    = conv.p1.id === userId ? conv.p2 : conv.p1;
  const lastMsg = conv.messages.at(-1) ?? null;
  const unread  = conv.messages.filter(
    m => !m.is_read && m.sender_id !== userId
  ).length;
  const isOnl   = onlinePeers.includes(peer.id);
  const isTyp   = peerTypingMap[peer.id];

  let preview = "No messages yet";
  if (lastMsg) {
    if (lastMsg.is_deleted) {
      preview = "🚫 Message deleted";
    } else {
      const tp = detectType(lastMsg);
      preview =
        tp === "image" ? "📷 Photo"
        : tp === "audio" ? "🎙️ Voice note"
        : tp === "file"  ? "📎 File"
        : lastMsg.content;
    }
  }

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center px-4 py-3 transition-colors text-left"
      style={{
        background: isActive ? `${t.primary}06` : "transparent",
        borderLeft: isActive ? `3px solid ${t.secondary}` : "3px solid transparent",
        borderBottom: `1px solid ${t.border}`,
      }}
    >
      <Avatar
        name={peer.full_name || "?"}
        avatarUrl={peer.avatar_url}
        size={12}
        online={isOnl}
      />

      <div className="ml-3 flex-1 min-w-0">
        {/* Name + time */}
        <div className="flex justify-between items-baseline mb-0.5">
          <h3
            className="font-semibold text-sm truncate"
            style={{ color: t.text }}
          >
            {peer.full_name}
          </h3>
          {lastMsg && (
            <span
              className="text-[10px] tabular-nums whitespace-nowrap ml-2 flex-shrink-0"
              style={{
                color: unread > 0 ? t.secondary : t.textMuted,
                fontWeight: unread > 0 ? 700 : 400,
              }}
            >
              {fmt12(lastMsg.created_at)}
            </span>
          )}
        </div>

        {/* Preview + unread */}
        <div className="flex justify-between items-center gap-2">
          <p
            className="truncate text-xs flex-1"
            style={{
              color: isTyp
                ? t.secondary
                : unread > 0
                ? t.text
                : t.textMuted,
              fontWeight: unread > 0 ? 600 : 400,
              fontStyle: isTyp ? "italic" : undefined,
            }}
          >
            {isTyp ? "typing…" : preview}
          </p>
          {unread > 0 && (
            <span
              className="text-[10px] font-bold min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full flex-shrink-0"
              style={{
                background: t.secondary,
                color: "#fff",
              }}
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Message bubble ────────────────────────────────────────────

const MessageBubble = ({
  msg,
  isMe,
  isRead,
  isDelivered,
  isGrouped,
  peer,
  userId,
  onReact,
  onReply,
  onEdit,
  onDelete,
  allMessages,
  onJump,
  onImageClick,
}: {
  msg:          ExtendedMessage;
  isMe:         boolean;
  isRead:       boolean;
  isDelivered:  boolean;
  isGrouped:    boolean;
  peer:         { full_name?: string | null; avatar_url?: string | null } | null;
  userId:       string;
  onReact:      (id: string, emoji: string) => void;
  onReply:      (msg: ExtendedMessage) => void;
  onEdit:       (msg: ExtendedMessage) => void;
  onDelete:     (id: string) => void;
  allMessages:  ExtendedMessage[];
  onJump:       (id: string) => void;
  onImageClick: (src: string) => void;
}) => {
  const [showContext, setShowContext] = useState(false);
  const [ctxPos,      setCtxPos]      = useState({ x: 0, y: 0 });
  const [showEmoji,   setShowEmoji]   = useState(false);
  const longPressRef = useRef<NodeJS.Timeout | null>(null);
  const controls     = useAnimation();
  const lastTap      = useRef(0);
  const x            = useMotionValue(0);

  // Swipe gesture
  const swipeOpacity = useTransform(
    x,
    isMe ? [-SWIPE_THRESHOLD, -20, 0] : [0, 20, SWIPE_THRESHOLD],
    isMe ? [1, 0.4, 0] : [0, 0.4, 1]
  );
  const swipeScale = useTransform(
    x,
    [0, SWIPE_THRESHOLD],
    [0.6, 1.1]
  );

  const onDragEnd = (_: unknown, info: { offset: { x: number } }) => {
    const travel = isMe ? -info.offset.x : info.offset.x;
    controls.start({
      x: 0,
      transition: { type: "spring", stiffness: 500, damping: 36 },
    });
    if (travel > SWIPE_THRESHOLD - 8) {
      if (navigator.vibrate) navigator.vibrate(14);
      onReply(msg);
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const { clientX, clientY } = e;
    longPressRef.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(28);
      setCtxPos({ x: clientX, y: clientY });
      setShowContext(true);
    }, 500);
  };

  const cancelPress = () => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
  };

  const onTouchEnd = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      onReact(msg.id, "❤️");
      if (navigator.vibrate) navigator.vibrate(18);
    }
    lastTap.current = now;
  };

  const replySource = msg.reply_to_id
    ? allMessages.find(m => m.id === msg.reply_to_id)
    : null;

  const reactions = Object.entries(msg.reactions ?? {}).filter(
    ([, v]) => v.user_ids.length > 0
  );

  const type    = detectType(msg);
  const isMedia = type !== "text";

  // Tick state
  let tickIcon = "check";
  let tickColor = t.msg.tickSent;
  if (isRead)        { tickIcon = "done_all"; tickColor = t.msg.tickRead;      }
  else if (isDelivered) { tickIcon = "done_all"; tickColor = t.msg.tickDelivered; }

  if (msg.is_deleted) return (
    <div
      className={`flex ${isMe ? "justify-end" : "justify-start"} mb-1 px-3`}
    >
      <div
        className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs italic"
        style={{
          background: t.surfaceSoft,
          border:     `1px dashed ${t.border}`,
          color:      t.textMuted,
        }}
      >
        <span className="material-symbols-outlined text-[14px] opacity-60">
          block
        </span>
        {isMe ? "You deleted this message" : "This message was deleted"}
      </div>
    </div>
  );

  const bubbleRadius = isMe
    ? isGrouped ? "rounded-2xl rounded-br-md" : "rounded-2xl rounded-tr-sm"
    : isGrouped ? "rounded-2xl rounded-bl-md" : "rounded-2xl rounded-tl-sm";

  return (
    <motion.div
      variants={bubbleVariants}
      initial="hidden"
      animate="visible"
      className={`flex w-full items-end ${isMe ? "justify-end" : "justify-start"} group px-3 ${
        isGrouped ? "mb-0.5" : "mb-1.5"
      }`}
    >
      {/* Peer avatar — only show if not grouped */}
      {!isMe && (
        <div className="w-7 w-7 flex-shrink-0 mr-1.5 self-end mb-0.5 hidden md:block">
          {!isGrouped ? (
            <div className="w-7 h-7 rounded-full overflow-hidden relative border"
              style={{ borderColor: t.border }}>
              {peer?.avatar_url ? (
                <Image
                  src={peer.avatar_url}
                  alt="peer"
                  fill
                  className="object-cover"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-white text-[10px] font-bold"
                  style={{ background: t.primary }}
                >
                  {(peer?.full_name || "?").charAt(0)}
                </div>
              )}
            </div>
          ) : (
            <div className="w-7 h-7" />
          )}
        </div>
      )}

      {/* Swipe-to-reply indicator (my side) */}
      {isMe && (
        <motion.div
          style={{ opacity: swipeOpacity, scale: swipeScale }}
          className="self-center mr-1.5 flex-shrink-0 pointer-events-none"
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: `${t.secondary}18` }}
          >
            <span
              className="material-symbols-outlined text-[15px]"
              style={{ color: t.secondary }}
            >
              reply
            </span>
          </div>
        </motion.div>
      )}

      {/* Bubble */}
      <motion.div
        drag="x"
        dragConstraints={
          isMe
            ? { left: -SWIPE_THRESHOLD - 20, right: 0 }
            : { left: 0, right: SWIPE_THRESHOLD + 20 }
        }
        dragElastic={0.1}
        animate={controls}
        style={{ x }}
        onDragEnd={onDragEnd}
        className={`flex flex-col max-w-[80%] md:max-w-[60%] w-fit ${
          isMe ? "items-end" : "items-start"
        }`}
      >
        {replySource && (
          <ReplyQuote
            source={replySource}
            isMe={isMe}
            label={
              replySource.sender_id === userId
                ? "You"
                : peer?.full_name ?? "Them"
            }
            onClick={() => onJump(replySource.id)}
          />
        )}

        <div className="relative">
          {/* The bubble itself */}
          <div
            onPointerDown={onPointerDown}
            onPointerUp={cancelPress}
            onPointerLeave={cancelPress}
            onPointerCancel={cancelPress}
            onTouchEnd={onTouchEnd}
            className={`${bubbleRadius} select-text cursor-default ${
              isMedia ? "overflow-hidden p-1.5" : "px-3.5 py-2.5"
            }`}
            style={{
              background: isMe
                ? t.msg.sentBg
                : t.msg.receivedBg,
              color: isMe
                ? t.msg.sentText
                : t.msg.receivedText,
              boxShadow: "0 1px 4px rgba(0,10,30,0.08)",
              border: `1px solid ${isMe
                ? "transparent"
                : t.border}`,
            }}
          >
            <BubbleContent
              msg={msg}
              isMe={isMe}
              onImageClick={onImageClick}
            />

            {/* Text bubble time + ticks */}
            {!isMedia && (
              <div
                className={`flex items-center gap-1 mt-1 ${
                  isMe ? "justify-end" : "justify-start"
                }`}
              >
                {msg.is_edited && (
                  <span
                    className="text-[9px] italic"
                    style={{
                      color: isMe
                        ? "rgba(255,255,255,0.5)"
                        : t.textMuted,
                    }}
                  >
                    edited
                  </span>
                )}
                <span
                  className="text-[9px] font-bold tabular-nums"
                  style={{
                    color: isMe
                      ? t.msg.sentTime
                      : t.msg.receivedTime,
                  }}
                >
                  {fmt12(msg.created_at)}
                </span>
                {isMe && (
                  <span
                    className="material-symbols-outlined text-[13px]"
                    style={{
                      color: tickColor,
                      fontVariationSettings:
                        isRead || isDelivered
                          ? "'FILL' 1"
                          : undefined,
                    }}
                  >
                    {tickIcon}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Media time overlay */}
          {isMedia && (
            <div className="absolute bottom-2 right-2 flex items-center gap-0.5 bg-black/45 backdrop-blur-sm rounded-full px-1.5 py-0.5 pointer-events-none">
              <span className="text-[9px] font-bold text-white tabular-nums">
                {fmt12(msg.created_at)}
              </span>
              {isMe && (
                <span
                  className="material-symbols-outlined text-[12px] text-white"
                  style={{
                    fontVariationSettings:
                      isRead || isDelivered ? "'FILL' 1" : undefined,
                  }}
                >
                  {tickIcon}
                </span>
              )}
            </div>
          )}

          {/* Hover action buttons */}
          <div
            className={`absolute top-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 ${
              isMe ? "-left-16" : "-right-16"
            }`}
          >
            <button
              onClick={() => onReply(msg)}
              className="w-7 h-7 rounded-full flex items-center justify-center active:scale-90 transition-all"
              style={{
                background: t.card,
                border:     `1px solid ${t.border}`,
                boxShadow:  t.shadow,
              }}
            >
              <span
                className="material-symbols-outlined text-[13px]"
                style={{ color: t.textMuted }}
              >
                reply
              </span>
            </button>
            <button
              onClick={e => {
                setCtxPos({ x: e.clientX, y: e.clientY });
                setShowContext(true);
              }}
              className="w-7 h-7 rounded-full flex items-center justify-center active:scale-90 transition-all"
              style={{
                background: t.card,
                border:     `1px solid ${t.border}`,
                boxShadow:  t.shadow,
              }}
            >
              <span
                className="material-symbols-outlined text-[13px]"
                style={{ color: t.textMuted }}
              >
                more_vert
              </span>
            </button>
          </div>

          <AnimatePresence>
            {showEmoji && (
              <FloatingEmojiPicker
                isMe={isMe}
                onSelect={e => { onReact(msg.id, e); }}
                onClose={() => setShowEmoji(false)}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Reactions */}
        {reactions.length > 0 && (
          <div
            className={`flex flex-wrap gap-1 mt-1 ${
              isMe ? "justify-end" : "justify-start"
            }`}
          >
            {reactions.map(([emoji, data]) => (
              <ReactionBubble
                key={emoji}
                emoji={emoji}
                count={data.user_ids.length}
                reacted={data.user_ids.includes(userId)}
                onToggle={() => onReact(msg.id, emoji)}
              />
            ))}
          </div>
        )}
      </motion.div>

      {/* Swipe-to-reply indicator (peer side) */}
      {!isMe && (
        <motion.div
          style={{ opacity: swipeOpacity, scale: swipeScale }}
          className="self-center ml-1.5 flex-shrink-0 pointer-events-none"
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: `${t.secondary}18` }}
          >
            <span
              className="material-symbols-outlined text-[15px]"
              style={{ color: t.secondary }}
            >
              reply
            </span>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {showContext && (
          <ContextMenu
            isMe={isMe}
            pos={ctxPos}
            onReact={() => setShowEmoji(true)}
            onReply={() => onReply(msg)}
            onEdit={() => onEdit(msg)}
            onDelete={() => onDelete(msg.id)}
            onCopy={() => {
              navigator.clipboard?.writeText(msg.content);
              toast.success("Copied");
            }}
            onClose={() => setShowContext(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─── Deal Status Card ─────────────────────────────────────────────────────────

function DealStatusCard({
  dealInfo,
  isLender,
  isBorrower,
  activeConversationId,
  onAccept,
  onDecline,
  onInitiateReturn,
  onShowQr,
  onScanQr,
  onCancelDeal,
}: {
  dealInfo:              DealInfo;
  isLender:              boolean;
  isBorrower:            boolean;
  activeConversationId?: string;
  onAccept:              () => void;
  onDecline:             () => void;
  onInitiateReturn:      () => void;
  onShowQr:              () => void;
  onScanQr:              () => void;
  onCancelDeal:          () => void;
}) {
  const [open, setOpen] = useState(true);

  const STATUS_MAP: Record<string, { label: string; color: string }> = {
    pending:   { label: "Pending Request",        color: t.primary    },
    open:      { label: "Open Task",              color: t.primary    },
    accepted:  { label: "Accepted · Awaiting QR", color: t.success    },
    claimed:   { label: "Claimed · Awaiting QR",  color: t.success    },
    rented:    { label: "In-Use",                 color: t.info       },
    returning: { label: "Return Initiated",       color: t.warning    },
    completed: { label: "✓ Completed",            color: t.textMuted  },
    declined:  { label: "Declined",               color: t.textMuted  },
  };

  const s = STATUS_MAP[dealInfo.status] ?? {
    label: dealInfo.status,
    color: t.textMuted,
  };

  const steps =
    dealInfo.type === "item"
      ? ["pending", "accepted", "rented", "returning", "completed"]
      : ["open", "claimed", "completed"];
  const stepIdx = steps.indexOf(dealInfo.status);

  return (
    <div
      className="mx-2 mb-3 rounded-2xl overflow-hidden flex-shrink-0"
      style={{
        background: t.card,
        border:     `1px solid ${t.border}`,
        boxShadow:  t.shadow,
      }}
    >
      {/* Status bar */}
      <div
        className="px-4 py-2.5 flex justify-between items-center"
        style={{ background: s.color }}
      >
        <span className="text-[10px] font-bold tracking-widest uppercase text-white">
          {s.label}
        </span>
        <button
          onClick={() => setOpen(v => !v)}
          className="material-symbols-outlined text-white/70 text-[18px] hover:text-white transition-colors active:scale-90"
        >
          {open ? "expand_less" : "expand_more"}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="p-3">
              {/* Step progress */}
              <div className="flex items-center gap-0 mb-3">
                {steps.map((step, i) => (
                  <div key={step} className="flex items-center flex-1">
                    <div
                      className="w-3 h-3 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
                      style={{
                        background:
                          i <= stepIdx ? t.success : `${t.textMuted}30`,
                      }}
                    >
                      {i < stepIdx && (
                        <span className="material-symbols-outlined text-white text-[8px]">
                          check
                        </span>
                      )}
                      {i === stepIdx && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </div>
                    {i < steps.length - 1 && (
                      <div
                        className="flex-1 h-0.5 mx-0.5 transition-colors"
                        style={{
                          background:
                            i < stepIdx
                              ? t.success
                              : `${t.textMuted}20`,
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Deal info */}
              <div className="flex gap-3 items-center">
                {dealInfo.image_url ? (
                  <div className="w-11 h-11 rounded-xl overflow-hidden relative flex-shrink-0">
                    <Image
                      src={dealInfo.image_url}
                      alt="item"
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: t.surfaceSoft }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ color: t.textMuted }}
                    >
                      inventory_2
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h5
                    className="font-bold text-sm truncate"
                    style={{ color: t.text, fontFamily: "var(--font-headline)" }}
                  >
                    {dealInfo.title}
                  </h5>
                  {dealInfo.reward_amount !== undefined && (
                    <p
                      className="text-xs font-bold mt-0.5"
                      style={{ color: t.secondary }}
                    >
                      ₹{dealInfo.reward_amount}
                    </p>
                  )}
                </div>
                {dealInfo.status !== "completed" &&
                  dealInfo.status !== "declined" &&
                  isLender && (
                    <button
                      onClick={onCancelDeal}
                      className="material-symbols-outlined p-1.5 rounded-full transition-colors active:scale-90"
                      style={{ color: `${t.error}60` }}
                    >
                      more_vert
                    </button>
                  )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 mt-3">
                {/* Pending: lender actions */}
                {(dealInfo.status === "pending" ||
                  dealInfo.status === "open") &&
                  isLender && (
                    <>
                      <button
                        onClick={onAccept}
                        className="flex-1 py-2 text-white text-xs font-bold rounded-xl active:scale-95 transition-all"
                        style={{ background: t.success }}
                      >
                        Accept
                      </button>
                      <button
                        onClick={onDecline}
                        className="flex-1 py-2 text-xs font-bold rounded-xl active:scale-95 transition-all"
                        style={{
                          background: t.surfaceSoft,
                          color: t.textSub,
                          border: `1px solid ${t.border}`,
                        }}
                      >
                        Decline
                      </button>
                    </>
                  )}

                {/* Pending: borrower waiting */}
                {(dealInfo.status === "pending" ||
                  dealInfo.status === "open") &&
                  isBorrower && (
                    <p
                      className="w-full text-center text-xs italic py-1"
                      style={{ color: t.textMuted }}
                    >
                      Waiting for owner to accept…
                    </p>
                  )}

                {/* Accepted: scan QR (lender) */}
                {(dealInfo.status === "accepted" ||
                  dealInfo.status === "claimed") &&
                  isLender && (
                    <button
                      onClick={onScanQr}
                      className="w-full text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95"
                      style={{ background: t.success }}
                    >
                      <span className="material-symbols-outlined text-[15px]">
                        qr_code_scanner
                      </span>
                      Scan Borrower&apos;s QR
                    </button>
                  )}

                {/* Accepted: show QR (borrower) */}
                {(dealInfo.status === "accepted" ||
                  dealInfo.status === "claimed") &&
                  isBorrower && (
                    <button
                      onClick={onShowQr}
                      className="w-full text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95"
                      style={{ background: t.primary }}
                    >
                      <span className="material-symbols-outlined text-[15px]">
                        qr_code_2
                      </span>
                      Show My QR
                    </button>
                  )}

                {/* Rented: initiate return (borrower) */}
                {dealInfo.status === "rented" && isBorrower && (
                  <button
                    onClick={onInitiateReturn}
                    className="w-full text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95"
                    style={{ background: t.primary }}
                  >
                    <span className="material-symbols-outlined text-[15px]">
                      assignment_return
                    </span>
                    Initiate Return
                  </button>
                )}

                {/* Rented: waiting (lender) */}
                {dealInfo.status === "rented" && isLender && (
                  <p
                    className="w-full text-center text-xs italic py-1"
                    style={{ color: t.textMuted }}
                  >
                    Waiting for borrower to return…
                  </p>
                )}

                {/* Returning: show QR (lender) */}
                {dealInfo.status === "returning" && isLender && (
                  <button
                    onClick={onShowQr}
                    className="w-full text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95"
                    style={{ background: t.primary }}
                  >
                    <span className="material-symbols-outlined text-[15px]">
                      qr_code_2
                    </span>
                    Show Return QR
                  </button>
                )}

                {/* Returning: scan QR (borrower) */}
                {dealInfo.status === "returning" && isBorrower && (
                  <button
                    onClick={onScanQr}
                    className="w-full text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95"
                    style={{ background: t.success }}
                  >
                    <span className="material-symbols-outlined text-[15px]">
                      qr_code_scanner
                    </span>
                    Scan Lender&apos;s QR
                  </button>
                )}

                {/* Completed */}
                {dealInfo.status === "completed" && (
                  <div
                    className="w-full flex items-center justify-center gap-1.5 py-1.5"
                    style={{ color: t.success }}
                  >
                    <span
                      className="material-symbols-outlined text-sm"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      verified
                    </span>
                    <span className="text-xs font-bold">
                      Transaction verified &amp; complete
                    </span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MessageCenterClient({
  initialConversations,
  activeConversationId,
  userId,
}: {
  initialConversations:  Conversation[];
  activeConversationId?: string;
  userId:                string;
}) {
  const [mounted, setMounted] = useState(false);
  const router   = useRouter();
  const supabase = useRef(createClient()).current;

  // ── State ────────────────────────────────────────────────────
  const [conversations, setConversations] = useState<ExtendedConversation[]>(
    () => deduplicateConversations(
      initialConversations, userId
    ) as ExtendedConversation[]
  );
  const [newMessage,        setNewMessage]        = useState("");
  const [searchQuery,       setSearchQuery]       = useState("");
  const [editingMsg,        setEditingMsg]        = useState<ExtendedMessage | null>(null);
  const [replyingTo,        setReplyingTo]        = useState<ExtendedMessage | null>(null);
  const [dealInfo,          setDealInfo]          = useState<DealInfo | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<File | null>(null);
  const [showEmojiBar,      setShowEmojiBar]      = useState(false);
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  const [lightboxSrc,       setLightboxSrc]       = useState<string | null>(null);
  const [onlinePeers,       setOnlinePeers]       = useState<string[]>([]);
  const [peerTypingMap,     setPeerTypingMap]     = useState<Record<string, boolean>>({});
  const [showQrModal,       setShowQrModal]       = useState<string | null>(null);
  const [showScannerModal,  setShowScannerModal]  = useState<string | null>(null);
  const [showCancelModal,   setShowCancelModal]   = useState(false);
  const [uploading,         setUploading]         = useState(false);

  // ── Refs ─────────────────────────────────────────────────────
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);
  const channelRef     = useRef<RealtimeChannel | null>(null);
  const typingTimer    = useRef<NodeJS.Timeout | null>(null);
  const messageRefs    = useRef<Record<string, HTMLDivElement | null>>({});
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const dealInfoRef    = useRef<DealInfo | null>(null);
  const userIdRef      = useRef(userId);

  useEffect(() => { userIdRef.current = userId; }, [userId]);
  useEffect(() => { dealInfoRef.current = dealInfo; }, [dealInfo]);

  // ── Derived ──────────────────────────────────────────────────
  const activeConversation = useMemo(
    () => conversations.find(c => c.id === activeConversationId),
    [conversations, activeConversationId]
  );

  const peer = useMemo(
    () =>
      activeConversation
        ? activeConversation.p1.id === userId
          ? activeConversation.p2
          : activeConversation.p1
        : null,
    [activeConversation, userId]
  );

  const memoizedMessages = useMemo(
    () => activeConversation?.messages ?? [],
    [activeConversation?.messages]
  );

  // ── Fetch single conversation ────────────────────────────────
  const fetchConversation = useCallback(
    async (convId: string): Promise<ExtendedConversation | null> => {
      const { data, error } = await supabase
        .from("conversations")
        .select(`
          id, deal_id, participant_1, participant_2, created_at,
          p1:profiles!participant_1(id, full_name, avatar_url),
          p2:profiles!participant_2(id, full_name, avatar_url),
          messages(
            id, content, created_at, sender_id, is_read,
            msg_type, reply_to_id, is_deleted, is_edited, reactions
          )
        `)
        .eq("id", convId)
        .single();

      if (error || !data) return null;

      const conv = data as unknown as ExtendedConversation;
      conv.messages = [...(conv.messages ?? [])].sort(
        (a, b) =>
          new Date(a.created_at).getTime() -
          new Date(b.created_at).getTime()
      );
      return conv;
    },
    [supabase]
  );

  // ── Mount ────────────────────────────────────────────────────
  useEffect(() => { setMounted(true); }, []);

  // ── Auto-focus input ─────────────────────────────────────────
  useEffect(() => {
    if (!activeConversationId) return;
    const t = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(t);
  }, [activeConversationId]);

  // ── Auto-scroll to latest ────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [memoizedMessages.length]);

  // ── Deal fetch ───────────────────────────────────────────────
  useEffect(() => {
    if (!activeConversation) return;
    setDealInfo(null);

    (async () => {
      const { data: ir } = await supabase
        .from("item_requests")
        .select("*, items(*)")
        .eq("id", activeConversation.deal_id)
        .maybeSingle();

      if (ir?.items) {
        setDealInfo({
          type:          "item",
          id:            ir.id,
          status:        ir.status,
          title:         ir.items.title,
          image_url:     ir.items.images?.[0] ?? "",
          reward_amount: ir.items.price_amount,
          owner_id:      ir.items.user_id,
          requester_id:  ir.requester_id,
          item_id:       ir.items.id,
        });
        return;
      }

      const { data: tr } = await supabase
        .from("tasks")
        .select("*, task_claims(*)")
        .eq("id", activeConversation.deal_id)
        .maybeSingle();

      if (tr) {
        setDealInfo({
          type:          "task",
          id:            tr.id,
          status:        tr.status,
          title:         tr.title,
          image_url:     "",
          reward_amount: tr.reward_amount,
          owner_id:      tr.user_id,
          requester_id:
            tr.task_claims?.[0]?.claimed_by ??
            activeConversation.participant_1,
        });
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId, activeConversation?.deal_id]);

  // ── Mark read ────────────────────────────────────────────────
  useEffect(() => {
    if (!activeConversationId) return;
    const conv = conversations.find(c => c.id === activeConversationId);
    const hasUnread = conv?.messages.some(
      m => !m.is_read && m.sender_id !== userId
    );
    if (!hasUnread) return;

    supabase.rpc("mark_conversation_as_read", {
      p_conversation_id: activeConversationId,
    });

    setConversations(prev =>
      prev.map(c =>
        c.id !== activeConversationId ? c : {
          ...c,
          messages: c.messages.map(m =>
            m.sender_id !== userId ? { ...m, is_read: true } : m
          ),
        }
      )
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId]);

  // ── Realtime ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mounted) return;

    const ch = supabase.channel("campusshare:msg:v3", {
      config: { presence: { key: userId } },
    });
    channelRef.current = ch;

    // New message
    ch.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      async ({ new: m }) => {
        const nm = m as ExtendedMessage;

        setConversations(prev => {
          const idx = prev.findIndex(c => c.id === nm.conversation_id);

          if (idx === -1) {
            // Conversation not loaded yet — fetch it
            fetchConversation(nm.conversation_id).then(nc => {
              if (!nc) return;
              setConversations(p => {
                if (p.some(c => c.id === nc.id)) return p;
                return sortConversations([nc, ...p]);
              });
            });
            return prev;
          }

          const updated = prev.map(c => {
            if (c.id !== nm.conversation_id) return c;
            const filtered = c.messages.filter(
              x =>
                !(
                  x.id.startsWith("temp-") &&
                  x.content === nm.content &&
                  x.sender_id === nm.sender_id
                )
            );
            if (filtered.some(x => x.id === nm.id)) return c;
            return { ...c, messages: [...filtered, nm] };
          });

          return sortConversations(updated);
        });
      }
    )

    // Updated message
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "messages" },
      ({ new: m }) => {
        const um = m as ExtendedMessage;
        setConversations(prev =>
          prev.map(c =>
            c.id !== um.conversation_id ? c : {
              ...c,
              messages: c.messages.map(x =>
                x.id === um.id ? um : x
              ),
            }
          )
        );
      }
    )

    // Deleted message
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "messages" },
      ({ old: m }) => {
        const dm = m as { id: string; conversation_id: string };
        setConversations(prev =>
          prev.map(c =>
            c.id !== dm.conversation_id ? c : {
              ...c,
              messages: c.messages.filter(x => x.id !== dm.id),
            }
          )
        );
      }
    )

    // New conversation (new deal accepted)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "conversations" },
      async ({ new: conv }) => {
        const nc = conv as {
          id: string;
          participant_1: string;
          participant_2: string;
        };
        if (
          nc.participant_1 !== userIdRef.current &&
          nc.participant_2 !== userIdRef.current
        ) return;

        const full = await fetchConversation(nc.id);
        if (!full) return;

        setConversations(prev => {
          if (prev.some(c => c.id === full.id)) return prev;
          return sortConversations([full, ...prev]);
        });
      }
    )

    // Presence
    .on("presence", { event: "sync" }, () => {
      setOnlinePeers(Object.keys(ch.presenceState()));
    })

    // Typing
    .on("broadcast", { event: "typing" }, ({ payload }) => {
      if (payload?.userId && payload.userId !== userIdRef.current) {
        setPeerTypingMap(p => ({
          ...p,
          [payload.userId]: payload.isTyping,
        }));
      }
    })

    .subscribe(async status => {
      if (status === "SUBSCRIBED") {
        await ch.track({ online_at: new Date().toISOString() });
      }
    });

    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, supabase, userId]);

  // ── QR scanner ───────────────────────────────────────────────
  useEffect(() => {
    if (!showScannerModal) return;
    const qr = new Html5Qrcode("qr-reader");
    qr
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        decoded => {
          setShowScannerModal(null);
          handleQRConfirm(decoded, showScannerModal);
        },
                () => {
          console.error("[QR] Scan error");
        }
      )
      .catch(() => {
        toast.error("Camera access denied");
        setShowScannerModal(null);
      });

    return () => {
      qr.stop().catch(() => {});
    };
  }, [showScannerModal]);

  // ── Handlers ─────────────────────────────────────────────────

  const handleQRConfirm = useCallback(
    async (qrData: string, action: string) => {
      if (!dealInfo) return;

      const { error } = await supabase.rpc("verify_qr_handshake", {
        p_deal_id:   dealInfo.id,
        p_deal_type: dealInfo.type,
        p_qr_data:   qrData,
        p_action:    action,
      });

      if (error) {
        toast.error("QR verification failed");
        return;
      }

      toast.success("QR confirmed!");
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

      // Refresh deal info
      const { data: updated } = await supabase
        .from(dealInfo.type === "item" ? "item_requests" : "tasks")
        .select("status")
        .eq("id", dealInfo.id)
        .single();

      if (updated) {
        setDealInfo(prev =>
          prev ? { ...prev, status: updated.status } : null
        );
      }
    },
    [dealInfo, supabase]
  );

  const sendMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!activeConversationId || (!newMessage.trim() && !pendingAttachment)) return;

      let content = newMessage.trim();
      let msgType: MsgType = "text";

      // Upload attachment if present
      if (pendingAttachment) {
        setUploading(true);
        const ext  = pendingAttachment.name.split(".").pop();
        const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const path = `messages/${userId}/${name}`;

        const { data, error } = await supabase.storage
          .from("attachments")
          .upload(path, pendingAttachment, { upsert: false });

        setUploading(false);

        if (error || !data) {
          toast.error("Upload failed");
          return;
        }

        const { data: { publicUrl } } = supabase.storage
          .from("attachments")
          .getPublicUrl(data.path);

        content = publicUrl;

        if (pendingAttachment.type.startsWith("image/")) msgType = "image";
        else if (pendingAttachment.type.startsWith("audio/")) msgType = "audio";
        else msgType = "file";

        setPendingAttachment(null);
      }

      // Optimistic message
      const tempId = `temp-${Date.now()}`;
      const tempMsg: ExtendedMessage = {
        id:              tempId,
        conversation_id: activeConversationId,
        sender_id:       userId,
        content,
        msg_type:        msgType,
        is_read:         false,
        created_at:      new Date().toISOString(),
        reply_to_id:     replyingTo?.id ?? null,
        is_deleted:      false,
        is_edited:       false,
        reactions:       {},
      };

      setConversations(prev =>
        prev.map(c =>
          c.id !== activeConversationId ? c : {
            ...c,
            messages: [...c.messages, tempMsg],
          }
        )
      );

      setNewMessage("");
      setReplyingTo(null);

      // DB insert
      if (editingMsg) {
        await supabase
          .from("messages")
          .update({
            content,
            is_edited: true,
          })
          .eq("id", editingMsg.id);
        setEditingMsg(null);
      } else {
        await supabase.from("messages").insert({
          conversation_id: activeConversationId,
          sender_id:       userId,
          content,
          msg_type:        msgType,
          reply_to_id:     replyingTo?.id ?? null,
        });
      }

      inputRef.current?.focus();
    },
    [
      activeConversationId,
      newMessage,
      pendingAttachment,
      userId,
      replyingTo,
      editingMsg,
      supabase,
    ]
  );

  const handleReaction = useCallback(
    async (msgId: string, emoji: string) => {
      if (!activeConversationId) return;

      setConversations(prev =>
        prev.map(c => {
          if (c.id !== activeConversationId) return c;
          return {
            ...c,
            messages: c.messages.map(m => {
              if (m.id !== msgId) return m;
              const r = { ...(m.reactions ?? {}) };
              if (!r[emoji]) r[emoji] = { emoji, user_ids: [] };
              const idx = r[emoji].user_ids.indexOf(userId);
              if (idx === -1) r[emoji].user_ids.push(userId);
              else r[emoji].user_ids.splice(idx, 1);
              if (r[emoji].user_ids.length === 0) delete r[emoji];
              return { ...m, reactions: r };
            }),
          };
        })
      );

      await supabase
        .from("messages")
        .update({
          reactions: conversations
            .find(c => c.id === activeConversationId)
            ?.messages.find(m => m.id === msgId)?.reactions ?? {},
        })
        .eq("id", msgId);
    },
    [activeConversationId, conversations, supabase, userId]
  );

  const handleDelete = useCallback(
    async (msgId: string) => {
      if (!activeConversationId) return;

      setConversations(prev =>
        prev.map(c =>
          c.id !== activeConversationId ? c : {
            ...c,
            messages: c.messages.map(m =>
              m.id === msgId ? { ...m, is_deleted: true, content: "" } : m
            ),
          }
        )
      );

      await supabase
        .from("messages")
        .update({ is_deleted: true, content: "" })
        .eq("id", msgId);

      toast.success("Message deleted");
    },
    [activeConversationId, supabase]
  );

  const handleTyping = useCallback(() => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type:    "broadcast",
      event:   "typing",
      payload: { userId, isTyping: true },
    });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      channelRef.current?.send({
        type:    "broadcast",
        event:   "typing",
        payload: { userId, isTyping: false },
      });
    }, 2000);
  }, [userId]);

  const handleVoiceSend = useCallback(
    async (blob: Blob) => {
      if (!activeConversationId) return;
      setUploading(true);

      const name = `voice-${Date.now()}.webm`;
      const path = `messages/${userId}/${name}`;

      const { data, error } = await supabase.storage
        .from("attachments")
        .upload(path, blob, { contentType: "audio/webm" });

      setUploading(false);

      if (error || !data) {
        toast.error("Voice upload failed");
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("attachments")
        .getPublicUrl(data.path);

      await supabase.from("messages").insert({
        conversation_id: activeConversationId,
        sender_id:       userId,
        content:         publicUrl,
        msg_type:        "audio",
      });
    },
    [activeConversationId, supabase, userId]
  );

  const handleAccept = useCallback(async () => {
    if (!dealInfo) return;
    await supabase
      .from(dealInfo.type === "item" ? "item_requests" : "task_claims")
      .update({ status: dealInfo.type === "item" ? "accepted" : "claimed" })
      .eq("id", dealInfo.id);
    setDealInfo(prev =>
      prev ? { ...prev, status: prev.type === "item" ? "accepted" : "claimed" } : null
    );
    toast.success("Deal accepted!");
  }, [dealInfo, supabase]);

  const handleDecline = useCallback(async () => {
    if (!dealInfo) return;
    await supabase
      .from(dealInfo.type === "item" ? "item_requests" : "task_claims")
      .update({ status: "declined" })
      .eq("id", dealInfo.id);
    setDealInfo(prev => (prev ? { ...prev, status: "declined" } : null));
    toast.success("Deal declined");
  }, [dealInfo, supabase]);

  const handleInitiateReturn = useCallback(async () => {
    if (!dealInfo || dealInfo.type !== "item") return;
    await supabase
      .from("item_requests")
      .update({ status: "returning" })
      .eq("id", dealInfo.id);
    setDealInfo(prev => (prev ? { ...prev, status: "returning" } : null));
    toast.success("Return initiated");
  }, [dealInfo, supabase]);

  const handleCancelDeal = useCallback(async () => {
    if (!dealInfo) return;
    setShowCancelModal(false);
    await supabase
      .from(dealInfo.type === "item" ? "item_requests" : "tasks")
      .update({ status: "declined" })
      .eq("id", dealInfo.id);
    setDealInfo(prev => (prev ? { ...prev, status: "declined" } : null));
    toast.success("Deal cancelled");
  }, [dealInfo, supabase]);

  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large (max 10 MB)");
      return;
    }
    setPendingAttachment(file);
  }, []);

  const jumpToMessage = useCallback((id: string) => {
    const el = messageRefs.current[id];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("highlight-flash");
    setTimeout(() => el.classList.remove("highlight-flash"), 1400);
  }, []);

  // ── Render ───────────────────────────────────────────────────

  if (!mounted) return null;

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Conversation list (desktop sidebar) */}
      <aside
        className={`${
          activeConversationId ? "hidden md:flex" : "flex"
        } flex-col w-full md:w-80 flex-shrink-0`}
        style={{
          borderRight: `1px solid ${t.border}`,
          background:  t.surface,
        }}
      >
        {/* Header */}
        <header
          className="px-4 py-3 flex items-center justify-between flex-shrink-0"
          style={{ borderBottom: `1px solid ${t.border}` }}
        >
          <h2
            className="font-headline text-lg font-bold"
            style={{ color: t.text }}
          >
            Messages
          </h2>
          <button
            onClick={() => setShowSearchOverlay(true)}
            className="material-symbols-outlined p-2 rounded-full active:scale-90 transition-all"
            style={{ color: t.textMuted, background: t.surfaceSoft }}
          >
            search
          </button>
        </header>

        {/* Search bar */}
        {searchQuery.length > 0 && (
          <div className="px-3 py-2">
            <div
              className="rounded-xl px-3 py-2 flex items-center gap-2"
              style={{ background: t.surfaceSoft }}
            >
              <span
                className="material-symbols-outlined text-[16px]"
                style={{ color: t.textMuted }}
              >
                search
              </span>
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search conversations…"
                className="bg-transparent flex-1 text-sm outline-none"
                style={{ color: t.text }}
              />
            </div>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-4">
              <span
                className="material-symbols-outlined text-5xl mb-3"
                style={{ color: t.textMuted }}
              >
                forum
              </span>
              <p
                className="text-sm text-center"
                style={{ color: t.textMuted }}
              >
                No conversations yet
              </p>
            </div>
          ) : (
            sortConversations(conversations).map(conv => (
              <ConversationRow
                key={conv.id}
                conv={conv}
                userId={userId}
                isActive={conv.id === activeConversationId}
                onlinePeers={onlinePeers}
                peerTypingMap={peerTypingMap}
                onClick={() => router.push(`/messages?id=${conv.id}`)}
              />
            ))
          )}
        </div>
      </aside>

      {/* Chat thread */}
      {activeConversationId && activeConversation ? (
        <div className="flex-1 flex flex-col w-full overflow-hidden">
          {/* Header */}
          <header
            className="px-4 py-3 flex items-center justify-between flex-shrink-0"
            style={{
              borderBottom: `1px solid ${t.border}`,
              background:   t.card,
            }}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button
                onClick={() => router.push("/messages")}
                className="md:hidden material-symbols-outlined p-1.5 -ml-1 active:scale-90"
                style={{ color: t.textMuted }}
              >
                arrow_back
              </button>
              {peer && (
                <>
                  <Avatar
                    name={peer.full_name || "?"}
                    avatarUrl={peer.avatar_url}
                    size={10}
                    online={onlinePeers.includes(peer.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <h3
                      className="font-semibold text-sm truncate"
                      style={{ color: t.text }}
                    >
                      {peer.full_name}
                    </h3>
                    {peerTypingMap[peer.id] && (
                      <p
                        className="text-[11px] italic"
                        style={{ color: t.secondary }}
                      >
                        typing…
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => setShowSearchOverlay(true)}
              className="material-symbols-outlined p-2 rounded-full active:scale-90"
              style={{ color: t.textMuted }}
            >
              search
            </button>
          </header>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col">
            {/* Deal card */}
            {dealInfo && (
              <DealStatusCard
                dealInfo={dealInfo}
                isLender={dealInfo.owner_id === userId}
                isBorrower={dealInfo.requester_id === userId}
                activeConversationId={activeConversationId}
                onAccept={handleAccept}
                onDecline={handleDecline}
                onInitiateReturn={handleInitiateReturn}
                onShowQr={() => setShowQrModal(activeConversationId)}
                onScanQr={() => setShowScannerModal(activeConversationId)}
                onCancelDeal={() => setShowCancelModal(true)}
              />
            )}

            {/* Message list */}
            <div className="flex-1 py-3">
              {memoizedMessages.map((msg, i) => {
                const prev = i > 0 ? memoizedMessages[i - 1] : null;
                const showDate = diffDay(prev, msg);
                const grouped  = shouldGroup(prev, msg);
                const isMe     = msg.sender_id === userId;

                // Read/delivered state (simplistic — real impl would check per-message)
                const isRead      = msg.is_read;
                const isDelivered = !isRead;

                return (
                  <div
                    key={msg.id}
                    ref={el => {
                      messageRefs.current[msg.id] = el;
                    }}
                  >
                    {showDate && (
                      <DateDivider label={dateDivLabel(msg.created_at)} />
                    )}
                    <MessageBubble
                      msg={msg}
                      isMe={isMe}
                      isRead={isRead}
                      isDelivered={isDelivered}
                      isGrouped={grouped}
                      peer={peer}
                      userId={userId}
                      onReact={handleReaction}
                      onReply={m => {
                        setReplyingTo(m);
                        inputRef.current?.focus();
                      }}
                      onEdit={m => {
                        setEditingMsg(m);
                        setNewMessage(m.content);
                        inputRef.current?.focus();
                      }}
                      onDelete={handleDelete}
                      allMessages={memoizedMessages}
                      onJump={jumpToMessage}
                      onImageClick={setLightboxSrc}
                    />
                  </div>
                );
              })}

              {peerTypingMap[peer?.id ?? ""] && <TypingDots />}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div
            className="flex-shrink-0"
            style={{
              borderTop:  `1px solid ${t.border}`,
              background: t.card,
            }}
          >
            {pendingAttachment && (
              <AttachmentStrip
                file={pendingAttachment}
                onRemove={() => setPendingAttachment(null)}
              />
            )}

            {replyingTo && (
              <div
                className="mx-3 mt-2 rounded-xl px-3 py-2 flex items-center gap-2"
                style={{
                  background: t.surfaceSoft,
                  border:     `1px solid ${t.border}`,
                }}
              >
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[10px] font-bold uppercase tracking-wide"
                    style={{ color: t.secondary }}
                  >
                    Replying to
                  </p>
                  <p
                    className="text-xs truncate"
                    style={{ color: t.textSub }}
                  >
                    {replyingTo.content}
                  </p>
                </div>
                <button
                  onClick={() => setReplyingTo(null)}
                  className="material-symbols-outlined text-[16px]"
                  style={{ color: t.textMuted }}
                >
                  close
                </button>
              </div>
            )}

            {editingMsg && (
              <div
                className="mx-3 mt-2 rounded-xl px-3 py-2 flex items-center gap-2"
                style={{
                  background: `${t.warning}10`,
                  border:     `1px solid ${t.warning}40`,
                }}
              >
                <span
                  className="material-symbols-outlined text-[16px]"
                  style={{ color: t.warning }}
                >
                  edit
                </span>
                <p
                  className="flex-1 text-xs font-semibold"
                  style={{ color: t.warning }}
                >
                  Editing message
                </p>
                <button
                  onClick={() => {
                    setEditingMsg(null);
                    setNewMessage("");
                  }}
                  className="material-symbols-outlined text-[16px]"
                  style={{ color: t.warning }}
                >
                  close
                </button>
              </div>
            )}

            <form onSubmit={sendMessage} className="p-3 flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,audio/*,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="material-symbols-outlined p-2.5 rounded-full flex-shrink-0 transition-colors active:scale-90"
                style={{
                  color:      t.textMuted,
                  background: t.surfaceSoft,
                }}
                disabled={uploading}
              >
                attach_file
              </button>

              <div
                className="flex-1 rounded-2xl px-4 py-2.5 flex items-center gap-2"
                style={{
                  background: t.surfaceSoft,
                  border:     `1px solid ${t.border}`,
                }}
              >
                <textarea
                  ref={inputRef}
                  value={newMessage}
                  onChange={e => {
                    setNewMessage(e.target.value);
                    handleTyping();
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(e as unknown as React.FormEvent);
                    }
                  }}
                  placeholder="Type a message…"
                  rows={1}
                  className="bg-transparent flex-1 text-sm outline-none resize-none max-h-32 no-scrollbar"
                  style={{ color: t.text }}
                  disabled={uploading}
                />
                <button
                  type="button"
                  onClick={() => setShowEmojiBar(v => !v)}
                  className="material-symbols-outlined text-[18px] flex-shrink-0"
                  style={{ color: t.textMuted }}
                >
                  sentiment_satisfied
                </button>
              </div>

              {newMessage.trim() || pendingAttachment ? (
                <button
                  type="submit"
                  className="p-2.5 rounded-full flex-shrink-0 active:scale-90 transition-all"
                  style={{
                    background: t.primary,
                    color:      "#fff",
                  }}
                  disabled={uploading}
                >
                  <span
                    className="material-symbols-outlined text-[20px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    send
                  </span>
                </button>
              ) : (
                <VoiceNoteButton onSend={handleVoiceSend} />
              )}
            </form>

            {showEmojiBar && (
              <div
                className="px-3 pb-2 flex gap-1 flex-wrap"
                style={{ background: t.card }}
              >
                {QUICK_REACTIONS.map(e => (
                  <button
                    key={e}
                    onClick={() => {
                      setNewMessage(m => m + e);
                      inputRef.current?.focus();
                    }}
                    className="w-9 h-9 flex items-center justify-center text-xl rounded-xl active:scale-90 transition-all"
                    style={{ background: t.surfaceSoft }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div
          className="hidden md:flex flex-1 items-center justify-center"
          style={{ background: t.surface }}
        >
          <div className="text-center">
            <span
              className="material-symbols-outlined text-6xl mb-3 block"
              style={{ color: t.textMuted }}
            >
              chat_bubble
            </span>
            <p className="text-sm" style={{ color: t.textMuted }}>
              Select a conversation to start messaging
            </p>
          </div>
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {lightboxSrc && (
          <ImageLightbox
            src={lightboxSrc}
            onClose={() => setLightboxSrc(null)}
          />
        )}

        {showSearchOverlay && activeConversation && (
          <SearchOverlay
            messages={memoizedMessages}
            userId={userId}
            peerName={peer?.full_name ?? ""}
            onClose={() => setShowSearchOverlay(false)}
            onJump={jumpToMessage}
          />
        )}

        {showQrModal && (
          <motion.div
            variants={fade}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
            onClick={() => setShowQrModal(null)}
          >
            <motion.div
              variants={slideUp}
              onClick={e => e.stopPropagation()}
              className="rounded-3xl p-6 max-w-sm w-full"
              style={{ background: t.card }}
            >
              <h3
                className="font-headline text-lg font-bold text-center mb-4"
                style={{ color: t.text }}
              >
                Show This QR
              </h3>
              <div className="bg-white p-4 rounded-2xl">
                <QRCode
                  value={JSON.stringify({
                    deal_id:   dealInfo?.id,
                    user_id:   userId,
                    timestamp: Date.now(),
                  })}
                  size={256}
                  className="w-full h-auto"
                />
              </div>
              <button
                onClick={() => setShowQrModal(null)}
                className="w-full mt-4 py-3 rounded-xl font-bold transition-colors"
                style={{
                  background: t.surfaceSoft,
                  color:      t.text,
                }}
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}

        {showScannerModal && (
          <motion.div
            variants={fade}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="fixed inset-0 z-[100] flex flex-col bg-black"
          >
            <header className="p-4 flex justify-between items-center">
              <button
                onClick={() => setShowScannerModal(null)}
                className="material-symbols-outlined text-white p-2"
              >
                close
              </button>
              <h3 className="text-white font-bold">Scan QR Code</h3>
              <div className="w-10" />
            </header>
            <div id="qr-reader" className="flex-1" />
          </motion.div>
        )}

        {showCancelModal && (
          <motion.div
            variants={fade}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
            onClick={() => setShowCancelModal(false)}
          >
            <motion.div
              variants={slideUp}
              onClick={e => e.stopPropagation()}
              className="rounded-3xl p-6 max-w-sm w-full"
              style={{ background: t.card }}
            >
              <h3
                className="font-headline text-lg font-bold mb-2"
                style={{ color: t.text }}
              >
                Cancel Deal?
              </h3>
              <p className="text-sm mb-5" style={{ color: t.textSub }}>
                This will mark the deal as declined. This action cannot be
                undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 py-3 rounded-xl font-bold"
                  style={{
                    background: t.surfaceSoft,
                    color:      t.text,
                  }}
                >
                  Nevermind
                </button>
                <button
                  onClick={handleCancelDeal}
                  className="flex-1 py-3 rounded-xl font-bold text-white"
                  style={{ background: t.error }}
                >
                  Cancel Deal
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Highlight flash animation */}
      <style jsx global>{`
        @keyframes highlight-flash {
          0%, 100% { background: transparent; }
          50% { background: ${t.warning}25; }
        }
        .highlight-flash {
          animation: highlight-flash 1.4s ease;
        }
      `}</style>
    </div>
  );
}