"use client";
import {
  useEffect, useState, useRef, useCallback,
  type ChangeEvent,
} from "react";
import { createClient } from "@/utils/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import Image from "next/image";
import toast from "react-hot-toast";
import QRCode from "react-qr-code";
import { Html5Qrcode } from "html5-qrcode";
import { deduplicateConversations } from "@/lib/conversation-utils";
import type { Message, Conversation, DealInfo } from "@/lib/types";
import { motion, AnimatePresence, useMotionValue, useTransform, useAnimation } from "framer-motion";

// ─── Constants ────────────────────────────────────────────────────────────────
const QUICK_REACTIONS  = ["👍","❤️","😂","😮","😢","🔥","👏","🎉","✅","❌"];
const SWIPE_THRESHOLD  = 58;

// ─── Extended types ───────────────────────────────────────────────────────────
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt12 = (s: string) =>
  new Date(s).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });

const dateDivLabel = (s: string) => {
  const d = new Date(s), now = new Date(), yd = new Date(now);
  yd.setDate(yd.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === yd.toDateString())  return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
};

const diffDay = (a: ExtendedMessage | null, b: ExtendedMessage) =>
  !a || new Date(a.created_at).toDateString() !== new Date(b.created_at).toDateString();

const isImageUrl   = (u: string) => /\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(u);
const isAudioUrl   = (u: string) => /\.(webm|mp3|ogg|wav|m4a)(\?|$)/i.test(u) || u.includes("audio");
const isStorageUrl = (u: string) => u.startsWith("https://");

function detectType(msg: ExtendedMessage): MsgType {
  if (msg.msg_type && msg.msg_type !== "text") return msg.msg_type;
  if (!isStorageUrl(msg.content)) return "text";
  if (isImageUrl(msg.content))    return "image";
  if (isAudioUrl(msg.content))    return "audio";
  return "file";
}

// ════════════════════════════════════════════════════════════════════════════
// Sub-components
// ════════════════════════════════════════════════════════════════════════════

function Avatar({ name, avatarUrl, size = 10, online = false }: { name: string; avatarUrl?: string | null; size?: number; online?: boolean }) {
  return (
    <div className={`relative shrink-0 w-${size} h-${size}`}>
      {avatarUrl ? (
        <div className={`w-${size} h-${size} rounded-full overflow-hidden relative ${online ? "ring-2 ring-[#006e0c] ring-offset-1" : ""}`}>
          <Image src={avatarUrl} alt={name} fill sizes={`${size * 4}px`} className="object-cover" />
        </div>
      ) : (
        <div className={`w-${size} h-${size} rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm ${online ? "ring-2 ring-[#006e0c] ring-offset-1" : ""}`}>
          {(name || "?").charAt(0).toUpperCase()}
        </div>
      )}
      {online && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />}
    </div>
  );
}

function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-4 px-2 pointer-events-none select-none">
      <div className="flex-1 h-px bg-black/8" />
      <span className="text-[10px] font-bold text-outline/70 uppercase tracking-widest bg-[#eaf0ea]/80 border border-black/6 px-2.5 py-1 rounded-full">{label}</span>
      <div className="flex-1 h-px bg-black/8" />
    </div>
  );
}

// ── Image lightbox ────────────────────────────────────────────────────────────
function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black flex flex-col"
    >
      <header className="absolute top-0 left-0 right-0 z-10 flex justify-between items-center p-4 bg-gradient-to-b from-black/70 to-transparent">
        <button onClick={onClose} className="material-symbols-outlined text-white p-2.5 bg-white/10 rounded-full backdrop-blur-sm">arrow_back</button>
        <a href={src} download onClick={e => e.stopPropagation()} className="material-symbols-outlined text-white p-2.5 bg-white/10 rounded-full backdrop-blur-sm">download</a>
      </header>
      <div className="flex-1 flex items-center justify-center p-4" onClick={onClose}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="media" onClick={e => e.stopPropagation()} className="max-w-full max-h-full object-contain rounded-lg select-none" draggable={false} />
      </div>
    </motion.div>
  );
}

// ── Audio player with waveform ────────────────────────────────────────────────
function AudioPlayer({ src, isMe }: { src: string; isMe: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing,  setPlaying]  = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed,    setSpeed]    = useState(1);

  const toggle = () => {
    const a = audioRef.current; if (!a) return;
    playing ? (a.pause(), setPlaying(false)) : (a.play(), setPlaying(true));
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current; if (!a?.duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    a.currentTime = ((e.clientX - r.left) / r.width) * a.duration;
  };

  const cycleSpeed = () => {
    const n = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(n); if (audioRef.current) audioRef.current.playbackRate = n;
  };

  const fmtSec = (s: number) =>
    isNaN(s) ? "0:00" : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  const BARS = [30,55,70,40,85,50,35,90,60,42,78,52,65,38,88,55,28,72,45,82,62,33,76,50,38,68,55,43];

  return (
    <div className={`flex items-center gap-2.5 min-w-[200px] max-w-[260px]`}>
      <audio ref={audioRef} src={src} preload="metadata"
        onTimeUpdate={() => { const a = audioRef.current; if (a) setProgress(a.currentTime / (a.duration || 1)); }}
        onEnded={() => { setPlaying(false); setProgress(0); }}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)} />
      <button onClick={toggle}
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm active:scale-90 transition-transform ${isMe ? "bg-white/25 text-white" : "bg-primary text-white"}`}>
        <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
          {playing ? "pause" : "play_arrow"}
        </span>
      </button>
      <div className="flex-1 flex flex-col gap-1.5">
        <div className="relative h-7 flex items-center cursor-pointer" onClick={seek}>
          <div className="absolute inset-0 flex items-end gap-px pb-0.5">
            {BARS.map((h, i) => (
              <div key={i} className="flex-1 rounded-sm transition-colors"
                style={{
                  height: `${h}%`,
                  background: i / BARS.length <= progress
                    ? (isMe ? "rgba(255,255,255,0.95)" : "#006e0c")
                    : (isMe ? "rgba(255,255,255,0.3)" : "rgba(0,110,12,0.22)"),
                }} />
            ))}
          </div>
        </div>
        <div className={`flex justify-between items-center ${isMe ? "text-white/65" : "text-outline"}`}>
          <span className="text-[10px] font-bold tabular-nums">
            {playing ? fmtSec(audioRef.current?.currentTime ?? 0) : fmtSec(duration)}
          </span>
          <button onClick={cycleSpeed} className="text-[10px] font-bold bg-black/8 rounded-full px-1.5 py-0.5 hover:bg-black/15 transition-colors">{speed}×</button>
        </div>
      </div>
    </div>
  );
}

// ── Bubble content ────────────────────────────────────────────────────────────
function BubbleContent({ msg, isMe, onImageClick }: { msg: ExtendedMessage; isMe: boolean; onImageClick: (src: string) => void }) {
  const type = detectType(msg);

  if (type === "image") return (
    <button onClick={() => onImageClick(msg.content)}
      className="block rounded-xl overflow-hidden max-w-60 active:opacity-80 transition-opacity"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={msg.content} alt="photo" className="w-full h-auto max-w-70 object-cover block" />
    </button>
  );

  if (type === "audio") return <AudioPlayer src={msg.content} isMe={isMe} />;

  if (type === "file") {
    const filename = decodeURIComponent(msg.content.split("/").pop() ?? "File");
    return (
      <a href={msg.content} target="_blank" rel="noreferrer"
        className={`flex items-center gap-3 min-w-[180px] ${isMe ? "text-white/90" : "text-on-surface"}`}
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isMe ? "bg-white/20" : "bg-primary/10"}`}>
          <span className="material-symbols-outlined text-[20px]">description</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate">{filename}</p>
          <p className={`text-[10px] ${isMe ? "text-white/60" : "text-outline"}`}>Tap to open</p>
        </div>
        <span className="material-symbols-outlined opacity-60 text-[18px]">open_in_new</span>
      </a>
    );
  }

  return <span className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</span>;
}

// ── Reply quote ───────────────────────────────────────────────────────────────
function ReplyQuote({ source, isMe, label, onClick }: {
  source: ExtendedMessage; isMe: boolean; label: string; onClick: () => void;
}) {
  const t = detectType(source);
  const preview = t === "image" ? "📷 Photo" : t === "audio" ? "🎙️ Voice note" : t === "file" ? "📎 File" : source.content;
  return (
    <button onClick={onClick}
      className={`w-full flex gap-2 rounded-xl px-2.5 py-2 mb-1.5 border-l-[3px] text-left active:opacity-70 transition-opacity ${
        isMe ? "bg-black/65 border-black/70" : "bg-black/5 border-primary/70"
      }`}
    >
      {t === "image" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={source.content} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className={`text-[10px] font-bold uppercase tracking-wide mb-0.5 ${isMe ? "text-white/75" : "text-primary"}`}>{label}</p>
        <p className={`text-xs truncate ${isMe ? "text-white/70" : "text-on-surface-variant"}`}>{preview}</p>
      </div>
    </button>
  );
}

// ── Reaction bubbles ──────────────────────────────────────────────────────────
function ReactionBubble({ emoji, count, reacted, onToggle }: { emoji: string; count: number; reacted: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] border transition-all active:scale-90 shadow-sm ${reacted ? "bg-primary/10 border-primary/25 text-primary font-bold" : "bg-black border-black/8 text-on-surface-variant"}`}>
      <span>{emoji}</span><span className="font-bold tabular-nums">{count}</span>
    </button>
  );
}

// ── Floating emoji picker ─────────────────────────────────────────────────────
function FloatingEmojiPicker({ isMe, onSelect, onClose }: { isMe: boolean; onSelect: (e: string) => void; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-[88]" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.85, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.85 }}
        transition={{ type: "spring", stiffness: 480, damping: 28 }}
        className={`absolute z-[89] bottom-full mb-2 bg-white border border-black/6 rounded-2xl shadow-2xl p-1.5 flex gap-0.5 ${isMe ? "right-0" : "left-0"}`}
      >
        {QUICK_REACTIONS.map(e => (
          <button key={e} onClick={() => { onSelect(e); onClose(); }}
            className="w-9 h-9 flex items-center justify-center text-xl rounded-xl hover:bg-slate-100 active:scale-90 transition-all"
          >{e}</button>
        ))}
      </motion.div>
    </>
  );
}

// ── Context menu ──────────────────────────────────────────────────────────────
function ContextMenu({ isMe, pos, onReact, onReply, onEdit, onDelete, onCopy, onClose }: {
  isMe: boolean; pos: { x: number; y: number };
  onReact: () => void; onReply: () => void;
  onEdit?: () => void; onDelete?: () => void;
  onCopy: () => void; onClose: () => void;
}) {
  const items = [
    { icon: "add_reaction", label: "React",  fn: onReact,   danger: false },
    { icon: "reply",        label: "Reply",  fn: onReply,   danger: false },
    { icon: "content_copy", label: "Copy",   fn: onCopy,    danger: false },
    ...(isMe ? [
      { icon: "edit",   label: "Edit",   fn: onEdit!,   danger: false },
      { icon: "delete", label: "Delete", fn: onDelete!, danger: true  },
    ] : []),
  ];
  const menuW = 168, menuH = items.length * 48;
  const left = Math.min(pos.x, (typeof window !== "undefined" ? window.innerWidth  : 400) - menuW - 8);
  const top  = Math.min(pos.y, (typeof window !== "undefined" ? window.innerHeight : 700) - menuH - 8);

  return (
    <>
      <div className="fixed inset-0 z-[90]" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.88, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.88 }}
        transition={{ type: "spring", stiffness: 480, damping: 28 }}
        className="fixed z-[91] bg-white rounded-2xl shadow-2xl overflow-hidden border border-black/5"
        style={{ left, top, minWidth: menuW }}
      >
        {items.map(item => (
          <button key={item.label} onClick={() => { item.fn(); onClose(); }}
            className={`flex items-center gap-3 w-full px-4 py-3 text-[13px] font-semibold hover:bg-slate-50/80 transition-colors border-b border-black/4 last:border-none ${item.danger ? "text-red-500" : "text-[#000a1e]"}`}
          >
            <span className={`material-symbols-outlined text-[18px] ${item.danger ? "text-red-400" : "text-outline"}`}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </motion.div>
    </>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex gap-2 items-end mb-1 pl-2">
      <div className="w-8 h-8 rounded-full bg-slate-200 hidden md:flex" />
      <div className="bg-white border border-black/5 shadow-sm px-4 py-3 rounded-2xl rounded-tl-sm flex gap-1 items-center">
        {[0, 180, 360].map(d => (
          <motion.div key={d} className="w-1.5 h-1.5 bg-outline/60 rounded-full"
            animate={{ y: [0, -5, 0] }} transition={{ duration: 0.7, repeat: Infinity, delay: d / 1000, ease: "easeInOut" }} />
        ))}
      </div>
    </div>
  );
}

// ── Voice recorder ────────────────────────────────────────────────────────────
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
      mediaRef.current  = recorder; chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => onSend(new Blob(chunksRef.current, { type: "audio/webm" }));
      recorder.start(); setRec(true); setSecs(0);
      timerRef.current = setInterval(() => setSecs(s => s + 1), 1000);
    } catch { toast.error("Microphone access denied."); }
  };

  const stop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRef.current?.stop();
    mediaRef.current?.stream.getTracks().forEach(t => t.stop());
    setRec(false);
  };

  if (rec) return (
    <button type="button" onClick={stop}
      className="flex items-center gap-1.5 bg-red-50 text-red-500 border border-red-200 rounded-full px-3 py-2.5 text-xs font-bold shrink-0 active:scale-95 transition-all"
    >
      <motion.span className="w-2 h-2 rounded-full bg-red-500 inline-block shrink-0"
        animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />
      {secs}s · Stop
    </button>
  );
  return (
    <button type="button" onPointerDown={start}
      className="material-symbols-outlined text-outline hover:text-primary transition-colors mb-1 p-2.5 rounded-full shrink-0 bg-[#eef2ee]"
    >mic</button>
  );
}

// ── Attachment strip ──────────────────────────────────────────────────────────
function AttachmentStrip({ file, onRemove }: { file: File; onRemove: () => void }) {
  const url = URL.createObjectURL(file);
  const isImg = file.type.startsWith("image/");
  return (
    <div className="flex items-center gap-3 mx-3 mb-2 mt-2 bg-[#f0f4f8] rounded-2xl p-2 border border-black/6">
      <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-surface-variant relative">
        {isImg
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={url} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><span className="material-symbols-outlined text-outline">description</span></div>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-[#000a1e] truncate">{file.name}</p>
        <p className="text-[10px] text-outline">{(file.size / 1024).toFixed(0)} KB · {isImg ? "Image" : "File"}</p>
      </div>
      <button onClick={() => { URL.revokeObjectURL(url); onRemove(); }}
        className="w-7 h-7 bg-white/80 rounded-full flex items-center justify-center text-outline hover:text-error transition-colors border border-black/6">
        <span className="material-symbols-outlined text-[16px]">close</span>
      </button>
    </div>
  );
}

// ── Search overlay ────────────────────────────────────────────────────────────
function SearchOverlay({ messages, userId, peerName, onClose, onJump }: {
  messages: ExtendedMessage[]; userId: string; peerName: string;
  onClose: () => void; onJump: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const results = q.trim().length > 1
    ? messages.filter(m => !m.is_deleted && m.content.toLowerCase().includes(q.toLowerCase()))
    : [];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 bg-white flex flex-col"
    >
      <header className="flex items-center gap-3 px-4 py-3 border-b border-black/5 bg-white shrink-0">
        <button onClick={onClose} className="material-symbols-outlined text-outline p-1.5 -ml-1">arrow_back</button>
        <div className="flex-1 bg-[#f0f4f8] rounded-xl px-3 py-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-outline text-[16px]">search</span>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search in conversation…"
            className="bg-transparent flex-1 text-sm outline-none placeholder:text-outline" />
          {q && <button onClick={() => setQ("")} className="material-symbols-outlined text-outline text-[16px]">close</button>}
        </div>
      </header>
      <div className="flex-1 overflow-y-auto no-scrollbar divide-y divide-black/4">
        {q.length <= 1 ? <p className="text-center text-sm text-outline mt-12">Type to search…</p>
         : results.length === 0 ? <p className="text-center text-sm text-outline mt-12">No results for &ldquo;{q}&rdquo;</p>
         : results.map(m => {
             const me = m.sender_id === userId;
             const i  = m.content.toLowerCase().indexOf(q.toLowerCase());
             return (
               <button key={m.id} onClick={() => { onJump(m.id); onClose(); }}
                 className="w-full flex items-start gap-3 px-4 py-3.5 hover:bg-slate-50 text-left transition-colors"
               >
                 <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                   {(me ? "You" : peerName || "?").charAt(0)}
                 </div>
                 <div className="flex-1 min-w-0">
                   <div className="flex justify-between mb-0.5">
                     <span className="text-[11px] font-bold text-[#000a1e]">{me ? "You" : peerName}</span>
                     <span className="text-[10px] text-outline">{fmt12(m.created_at)}</span>
                   </div>
                   <p className="text-xs text-on-surface-variant line-clamp-2">
                     {m.content.slice(0, i)}
                     <mark className="bg-yellow-200 text-yellow-900 rounded px-0.5 not-italic font-semibold">{m.content.slice(i, i + q.length)}</mark>
                     {m.content.slice(i + q.length)}
                   </p>
                 </div>
               </button>
             );
           })}
      </div>
    </motion.div>
  );
}
function MessageBubble({
  msg, isMe, isRead, isDelivered, peer, userId,
  onReact, onReply, onEdit, onDelete, allMessages, onJump, onImageClick,
}: {
  msg: ExtendedMessage; isMe: boolean; isRead: boolean; isDelivered: boolean;
  peer: { full_name?: string | null; avatar_url?: string | null } | null;
  userId: string;
  onReact: (id: string, emoji: string) => void;
  onReply: (msg: ExtendedMessage) => void;
  onEdit: (msg: ExtendedMessage) => void;
  onDelete: (id: string) => void;
  allMessages: ExtendedMessage[];
  onJump: (id: string) => void;
  onImageClick: (src: string) => void;
}) {
  const [showContext, setShowContext] = useState(false);
  const [ctxPos,      setCtxPos]      = useState({ x: 0, y: 0 });
  const [showEmoji,   setShowEmoji]   = useState(false);
  const longPressRef = useRef<NodeJS.Timeout | null>(null);
  const controls     = useAnimation();
  const lastTap      = useRef(0);

  // Swipe setup —————————————————————————————————————————————————————————————
  // isMe=true  → drag left  (negative), icon on LEFT side
  // isMe=false → drag right (positive), icon on RIGHT side
  const x = useMotionValue(0);
  const absX = useTransform(x, v => Math.abs(v));
  const iconOpacity = useTransform(absX, [0, 20, SWIPE_THRESHOLD], [0, 0.3, 1]);
  const iconScale   = useTransform(absX, [0, SWIPE_THRESHOLD], [0.5, 1.15]);
  const iconX       = useTransform(x,
    isMe ? [-SWIPE_THRESHOLD, 0] : [0, SWIPE_THRESHOLD],
    isMe ? [-12, 0]              : [0, 12]
  );

  const onDragEnd = (_: unknown, info: { offset: { x: number } }) => {
    const travel = isMe ? -info.offset.x : info.offset.x; // positive = correct swipe direction
    controls.start({ x: 0, transition: { type: "spring", stiffness: 520, damping: 36 } });
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
    }, 480);
  };
  const cancelPress = () => { if (longPressRef.current) clearTimeout(longPressRef.current); };

  const onTouchEnd = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) { onReact(msg.id, "❤️"); if (navigator.vibrate) navigator.vibrate(18); }
    lastTap.current = now;
  };

  const replySource = msg.reply_to_id ? allMessages.find(m => m.id === msg.reply_to_id) : null;
  const reactions   = Object.entries(msg.reactions ?? {}).filter(([, v]) => v.user_ids.length > 0);
  const type        = detectType(msg);
  const isMedia     = type !== "text";

  let tickIcon = "check", tickCls = "text-outline/50";
  if (isRead)           { tickIcon = "done_all"; tickCls = "text-[#53bdeb]"; }
  else if (isDelivered) { tickIcon = "done_all"; tickCls = "text-outline/55"; }

  if (msg.is_deleted) return (
    <div className={`flex ${isMe ? "justify-end" : "justify-start"} mb-1 px-1`}>
      <div className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-white/70 text-outline/70 text-xs italic border border-dashed border-black/10 shadow-sm">
        <span className="material-symbols-outlined text-[14px] opacity-60">block</span>
        {isMe ? "You deleted this message" : "This message was deleted"}
      </div>
    </div>
  );

  const bubbleRadius = isMe ? "rounded-2xl rounded-tr-sm" : "rounded-2xl rounded-tl-sm";
  const bubbleBg     = isMe ? "bg-primary-container" : "bg-white";
  const bubbleText   = isMe ? "text-white" : "text-on-surface";
  

  return (
    <div className={`flex w-full mb-0.5 items-end ${isMe ? "justify-end" : "justify-start"} group px-1`}>

      {/* ── Receiver avatar (desktop) ── */}
      {!isMe && (
        <div className="w-8 h-8 rounded-full shrink-0 overflow-hidden self-end mr-2 mb-1 hidden md:block border border-black/6 shadow-sm relative">
          {peer?.avatar_url
            ? <Image src={peer.avatar_url} alt="peer" fill className="object-cover" />
            : <div className="w-full h-full bg-primary flex items-center justify-center text-white text-xs font-bold">{(peer?.full_name || "?").charAt(0)}</div>}
        </div>
      )}

      {/* ── Reply icon for SENDER (left side) ── */}
      {isMe && (
        <motion.div style={{ opacity: iconOpacity, x: iconX, scale: iconScale }}
          className="self-center mr-1.5 pointer-events-none shrink-0"
        >
          <div className="w-8 h-8 bg-primary/15 rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-[17px]">reply</span>
          </div>
        </motion.div>
      )}

      {/* ── Swipeable bubble ── */}
      <motion.div
        drag="x"
        dragConstraints={isMe ? { left: -SWIPE_THRESHOLD - 20, right: 0 } : { left: 0, right: SWIPE_THRESHOLD + 20 }}
        dragElastic={0.12}
        animate={controls}
        style={{ x }}
        onDragEnd={onDragEnd}
        className={`flex flex-col max-w-[82%] md:max-w-[62%] w-fit ${isMe ? "items-end" : "items-start"}`}
      >
        {/* Reply quote */}
        {replySource && (
          <ReplyQuote
            source={replySource} isMe={isMe}
            label={replySource.sender_id === userId ? "You" : (peer?.full_name ?? "Them")}
            onClick={() => onJump(replySource.id)}
          />
        )}

        {/* Bubble */}
        <div className="relative">
          <div
            onPointerDown={onPointerDown}
            onPointerUp={cancelPress}
            onPointerLeave={cancelPress}
            onPointerCancel={cancelPress}
            onTouchEnd={onTouchEnd}
            className={`${bubbleRadius} ${bubbleBg} ${bubbleText} shadow-sm border border-black/5 select-text cursor-default ${
              isMedia ? "overflow-hidden p-1.5" : "px-3.5 py-2.5"
            }`}
          >
            <BubbleContent msg={msg} isMe={isMe} onImageClick={onImageClick} />

            {/* Timestamp row — inside for text, overlay for media */}
            {!isMedia && (
              <div className={`flex items-center gap-1 mt-1 ${isMe ? "justify-end" : "justify-start"}`}>
                {msg.is_edited && <span className={`text-[9px] italic ${isMe ? "text-white/55" : "text-outline"}`}>edited</span>}
                <span className={`text-[9px] font-bold tracking-wide tabular-nums ${isMe ? "text-white/60" : "text-outline"}`}>{fmt12(msg.created_at)}</span>
                {isMe && (
                  <span className={`material-symbols-outlined text-[13px] ${tickCls}`} style={{ fontVariationSettings: isRead || isDelivered ? "'FILL' 1" : "" }}>
                    {tickIcon}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Media timestamp overlay */}
          {isMedia && (
            <div className="absolute bottom-2 right-2 flex items-center gap-0.5 bg-black/45 backdrop-blur-sm rounded-full px-1.5 py-0.5 pointer-events-none">
              <span className="text-[9px] font-bold text-white tabular-nums">{fmt12(msg.created_at)}</span>
              {isMe && (
                <span className={`material-symbols-outlined text-[12px] text-white/90`} style={{ fontVariationSettings: isRead || isDelivered ? "'FILL' 1" : "" }}>
                  {tickIcon}
                </span>
              )}
            </div>
          )}

          {/* Hover action buttons */}
          <div className={`absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-0.5 ${isMe ? "-left-9" : "-right-9"}`}>
            <button onClick={() => onReply(msg)} className="w-7 h-7 bg-white border border-black/6 rounded-full shadow-sm flex items-center justify-center hover:bg-slate-50 active:scale-90 transition-all">
              <span className="material-symbols-outlined text-outline text-[14px]">reply</span>
            </button>
            <button onClick={e => { setCtxPos({ x: e.clientX, y: e.clientY }); setShowContext(true); }} className="w-7 h-7 bg-white border border-black/6 rounded-full shadow-sm flex items-center justify-center hover:bg-slate-50 active:scale-90 transition-all">
              <span className="material-symbols-outlined text-outline text-[14px]">more_vert</span>
            </button>
          </div>

          {/* Emoji picker */}
          <AnimatePresence>
            {showEmoji && (
              <FloatingEmojiPicker isMe={isMe}
                onSelect={e => { onReact(msg.id, e); }}
                onClose={() => setShowEmoji(false)} />
            )}
          </AnimatePresence>
        </div>

        {/* Reactions */}
        {reactions.length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? "justify-end" : "justify-start"}`}>
            {reactions.map(([emoji, data]) => (
              <ReactionBubble key={emoji} emoji={emoji} count={data.user_ids.length}
                reacted={data.user_ids.includes(userId)} onToggle={() => onReact(msg.id, emoji)} />
            ))}
          </div>
        )}
      </motion.div>

      {/* ── Reply icon for RECEIVER (right side) ── */}
      {!isMe && (
        <motion.div style={{ opacity: iconOpacity, x: iconX, scale: iconScale }}
          className="self-center ml-1.5 pointer-events-none shrink-0"
        >
          <div className="w-8 h-8 bg-primary/15 rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-[17px]">reply</span>
          </div>
        </motion.div>
      )}

      {/* Context menu */}
      <AnimatePresence>
        {showContext && (
          <ContextMenu isMe={isMe} pos={ctxPos}
            onReact={() => setShowEmoji(true)}
            onReply={() => onReply(msg)}
            onEdit={() => onEdit(msg)}
            onDelete={() => onDelete(msg.id)}
            onCopy={() => { navigator.clipboard?.writeText(msg.content); toast.success("Copied"); }}
            onClose={() => setShowContext(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Main Component
// ════════════════════════════════════════════════════════════════════════════
export default function MessageCenterClient({
  initialConversations,
  activeConversationId,
  userId,
}: {
  initialConversations: Conversation[];
  activeConversationId?: string;
  userId: string;
}) {
  const [mounted, setMounted] = useState(false); 
  const router   = useRouter();
  const supabase = useRef(createClient()).current;

  const [conversations,     setConversations]     = useState<ExtendedConversation[]>(() =>
    deduplicateConversations(initialConversations, userId) as ExtendedConversation[]
  );
  const [newMessage,        setNewMessage]        = useState("");
  const [searchQuery,       setSearchQuery]       = useState("");
  const [editingMsg,        setEditingMsg]        = useState<ExtendedMessage | null>(null);
  const [replyingTo,        setReplyingTo]        = useState<ExtendedMessage | null>(null);
  const [dealInfo,          setDealInfo]          = useState<DealInfo | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<File | null>(null);
  const [dealPanelOpen,     setDealPanelOpen]     = useState(true);
  const [showEmojiBar,      setShowEmojiBar]      = useState(false);
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  const [lightboxSrc,       setLightboxSrc]       = useState<string | null>(null);
  const [onlinePeers,       setOnlinePeers]       = useState<string[]>([]);
  const [peerTypingMap,     setPeerTypingMap]     = useState<Record<string, boolean>>({});
  const [showQrModal,       setShowQrModal]       = useState<string | null>(null);
  const [showScannerModal,  setShowScannerModal]  = useState<string | null>(null);
  const [showCancelModal,   setShowCancelModal]   = useState(false);
  const [uploading,         setUploading]         = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);
  const channelRef     = useRef<RealtimeChannel | null>(null);
  const typingTimer    = useRef<NodeJS.Timeout | null>(null);
  const messageRefs    = useRef<Record<string, HTMLDivElement | null>>({});
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const dealInfoRef    = useRef<DealInfo | null>(null);

  useEffect(() => { dealInfoRef.current = dealInfo; }, [dealInfo]);

  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const peer = activeConversation
    ? activeConversation.p1.id === userId ? activeConversation.p2 : activeConversation.p1
    : null;

  // ── Viewport / PWA ───────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true); // Set to true once we are on the client
  }, []);
  
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const nav = document.querySelector("nav.fixed.bottom-0") as HTMLElement | null;
    if (activeConversationId) {
      if (nav) nav.style.display = "none";
      window.history.pushState({ isChat: true }, "", `/messages?id=${activeConversationId}`);
    } else {
      if (nav) nav.style.display = "";
      if (window.location.search.includes("id=")) router.replace("/messages");
    }
    const pop = () => { if (activeConversationId) router.replace("/messages"); };
    window.addEventListener("popstate", pop);
    return () => { document.body.style.overflow = ""; if (nav) nav.style.display = ""; window.removeEventListener("popstate", pop); };
  }, [activeConversationId, router]);

  useEffect(() => {
    if (!activeConversationId) return;
    const t = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(t);
  }, [activeConversationId]);

  // ── Deal fetch ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeConversation) return;
    (async () => {
      const { data: ir } = await supabase.from("item_requests").select("*, items(*)").eq("id", activeConversation.deal_id).maybeSingle();
      if (ir?.items) {
        setDealInfo({ type: "item", id: ir.id, status: ir.status, title: ir.items.title, image_url: ir.items.images?.[0] ?? "", reward_amount: ir.items.price_amount, owner_id: ir.items.user_id, requester_id: ir.requester_id, item_id: ir.items.id });
        return;
      }
      const { data: tr } = await supabase.from("tasks").select("*, task_claims(*)").eq("id", activeConversation.deal_id).maybeSingle();
      if (tr) setDealInfo({ type: "task", id: tr.id, status: tr.status, title: tr.title, image_url: "", reward_amount: tr.reward_amount, owner_id: tr.user_id, requester_id: tr.task_claims?.[0]?.claimed_by ?? activeConversation.participant_1 });
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId, activeConversation?.deal_id]);

  // ── Realtime ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel("campusshare:messages", { config: { presence: { key: userId } } });
    channelRef.current = ch;
    ch
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, ({ new: m }) => {
        const nm = m as ExtendedMessage;
        setConversations(prev => prev.map(c => {
          if (c.id !== nm.conversation_id) return c;
          const f = c.messages.filter(x => !(x.id.startsWith("temp-") && x.content === nm.content && x.sender_id === nm.sender_id));
          return { ...c, messages: [...f, nm] };
        }));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, ({ new: m }) => {
        const um = m as ExtendedMessage;
        setConversations(prev => prev.map(c => c.id === um.conversation_id ? { ...c, messages: c.messages.map(x => x.id === um.id ? um : x) } : c));
      })
      .on("presence", { event: "sync" }, () => setOnlinePeers(Object.keys(ch.presenceState())))
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload?.userId) setPeerTypingMap(p => ({ ...p, [payload.userId]: payload.isTyping }));
      })
      .subscribe(async s => { if (s === "SUBSCRIBED") await ch.track({ online_at: new Date().toISOString() }); });
    return () => { supabase.removeChannel(ch); channelRef.current = null; };
  }, [supabase, userId]);

  // ── Mark read ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeConversationId) return;
    const conv = conversations.find(c => c.id === activeConversationId);
    if (conv?.messages.some(m => !m.is_read && m.sender_id !== userId))
      supabase.rpc("mark_conversation_as_read", { p_conversation_id: activeConversationId });
  }, [activeConversationId, conversations, userId, supabase]);

  // ── Scroll ───────────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation?.messages.length]);

  const isPendingDeal    = dealInfo?.status === "pending" || dealInfo?.status === "open";
  const isBorrower       = dealInfo?.requester_id === userId;
  const isLender         = dealInfo?.owner_id === userId;
  const borrowerMsgCount = activeConversation?.messages.filter(m => m.sender_id === userId).length ?? 0;
  const isInputLocked    = isPendingDeal && isBorrower && borrowerMsgCount >= 5;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleReact = useCallback(async (msgId: string, emoji: string) => {
    setConversations(prev => prev.map(c => {
      if (c.id !== activeConversationId) return c;
      return { ...c, messages: c.messages.map(m => {
        if (m.id !== msgId) return m;
        const r = { ...(m.reactions ?? {}) };
        if (!r[emoji]) r[emoji] = { emoji, user_ids: [] };
        const ids = r[emoji].user_ids;
        r[emoji] = { emoji, user_ids: ids.includes(userId) ? ids.filter(i => i !== userId) : [...ids, userId] };
        return { ...m, reactions: r };
      })};
    }));
    // To persist: await supabase.rpc("toggle_reaction", { p_msg_id: msgId, p_emoji: emoji, p_user_id: userId });
  }, [activeConversationId, userId]);

  const handleReply  = useCallback((msg: ExtendedMessage) => { setReplyingTo(msg); inputRef.current?.focus(); }, []);
  const handleEditMsg = useCallback((msg: ExtendedMessage) => { setEditingMsg(msg); setNewMessage(msg.content); inputRef.current?.focus(); }, []);
  const handleDeleteMsg = useCallback(async (id: string) => {
    setConversations(prev => prev.map(c => ({ ...c, messages: c.messages.map(m => m.id === id ? { ...m, is_deleted: true, content: "" } : m) })));
    await supabase.from("messages").update({ content: "", is_deleted: true } as never).eq("id", id);
  }, [supabase]);

  const jumpToMessage = useCallback((id: string) => {
    const el = messageRefs.current[id]; if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.style.transition = "background 0.15s";
    el.style.background = "rgba(0,110,12,0.1)";
    setTimeout(() => { el.style.background = "transparent"; }, 1200);
  }, []);

  const uploadFile = async (file: File | Blob, ext: string): Promise<string> => {
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("chat-attachments").upload(path, file);
    if (error) throw error;
    return supabase.storage.from("chat-attachments").getPublicUrl(path).data.publicUrl;
  };

  const handleSendMessage = async (e?: React.FormEvent, audioBlob?: Blob) => {
    if (e) e.preventDefault();
    if (isInputLocked || !activeConversationId) return;
    const raw = newMessage.trim();
    if (!raw && !pendingAttachment && !audioBlob) return;

    let finalContent = raw, msgType: MsgType = "text";

    if (audioBlob || pendingAttachment) {
      setUploading(true);
      try {
        if (audioBlob) {
          finalContent = await uploadFile(audioBlob, "webm"); msgType = "audio";
        } else if (pendingAttachment) {
          const ext = pendingAttachment.name.split(".").pop() ?? "bin";
          finalContent = await uploadFile(pendingAttachment, ext);
          msgType = pendingAttachment.type.startsWith("image/") ? "image" : "file";
        }
      } catch { toast.error("Upload failed."); setUploading(false); return; }
      setUploading(false);
    }

    if (editingMsg) {
      const eid = editingMsg.id;
      setNewMessage(""); setEditingMsg(null);
      setConversations(prev => prev.map(c => c.id !== activeConversationId ? c : {
        ...c, messages: c.messages.map(m => m.id === eid ? { ...m, content: finalContent, is_edited: true } : m),
      }));
      await supabase.from("messages").update({ content: finalContent, is_edited: true } as never).eq("id", eid);
      return;
    }

    setNewMessage(""); setShowEmojiBar(false); setReplyingTo(null); setPendingAttachment(null);
    if (inputRef.current) inputRef.current.style.height = "auto";

    const tempId = `temp-${Date.now()}`;
    const optimistic: ExtendedMessage = {
      id: tempId, conversation_id: activeConversationId, sender_id: userId,
      content: finalContent, created_at: new Date().toISOString(), is_read: false,
      reply_to_id: replyingTo?.id ?? null, msg_type: msgType,
    };
    setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, messages: [...c.messages, optimistic] } : c));

    const { error } = await supabase.from("messages").insert({
      conversation_id: activeConversationId, sender_id: userId,
      content: finalContent, reply_to_id: replyingTo?.id ?? null, msg_type: msgType,
    });
    if (error) {
      toast.error("Failed to send.");
      setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, messages: c.messages.filter(m => m.id !== tempId) } : c));
    }
  };

  const handleKeyboardInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    const ch = channelRef.current;
    if (ch) {
      ch.send({ type: "broadcast", event: "typing", payload: { userId, isTyping: true } });
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => ch.send({ type: "broadcast", event: "typing", payload: { userId, isTyping: false } }), 2000);
    }
  };

  // ── QR ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!showScannerModal) return;
    const qr = new Html5Qrcode("qr-reader");
    qr.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 },
      decoded => { setShowScannerModal(null); handleQRConfirm(decoded, showScannerModal); }, () => {}
    ).catch(() => toast.error("Camera access failed."));
    return () => { if (qr.isScanning) qr.stop().catch(console.error); else qr.clear(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showScannerModal]);

  const handleQRConfirm = async (payload: string, expected: string) => {
    if (payload !== expected) { toast.error("Invalid QR code!"); return; }
    const info = dealInfoRef.current; if (!info) return;
    try {
      if (info.type === "task") {
        const { error } = await supabase.rpc("complete_task_handshake", { qr_payload: expected });
        if (!error) { toast.success("Task complete!"); setDealInfo(p => p ? { ...p, status: "completed" } : p); }
      } else if (info.status === "accepted") {
        await supabase.from("items").update({ status: "rented" }).eq("id", info.item_id!);
        await supabase.from("item_requests").update({ status: "rented" }).eq("id", info.id);
        toast.success("Item handed over!"); setDealInfo(p => p ? { ...p, status: "rented" } : p);
      } else if (info.status === "returning") {
        await supabase.from("items").update({ status: "available" }).eq("id", info.item_id!);
        await supabase.from("item_requests").update({ status: "completed" }).eq("id", info.id);
        toast.success("Item returned!"); setDealInfo(p => p ? { ...p, status: "completed" } : p);
      }
    } catch { toast.error("Action failed."); }
  };

  const handleAcceptDecline = async (action: "accepted" | "declined") => {
    if (!dealInfo) return;
    try {
      if (dealInfo.type === "item") {
        await supabase.from("item_requests").update({ status: action }).eq("id", dealInfo.id);
        if (action === "declined" && dealInfo.item_id) await supabase.from("items").update({ status: "available" }).eq("id", dealInfo.item_id);
      } else {
        await supabase.from("tasks").update({ status: action === "accepted" ? "claimed" : "open" }).eq("id", dealInfo.id);
      }
      setDealInfo(p => p ? { ...p, status: action } : p);
      toast.success(`Request ${action}.`);
    } catch { toast.error("Failed."); }
  };

  const initiateReturn = async () => {
    if (!dealInfo) return;
    try {
      await supabase.from("item_requests").update({ status: "returning" }).eq("id", dealInfo.id);
      setDealInfo(p => p ? { ...p, status: "returning" } : p);
      toast.success("Return initiated!");
    } catch { toast.error("Error."); }
  };

  const cancelDeal = async () => {
    if (!dealInfo) return;
    try {
      await supabase.rpc("handle_lender_cancellation_penalty", { p_user_id: userId });
      if (dealInfo.type === "item") await supabase.from("item_requests").update({ status: "declined" }).eq("id", dealInfo.id);
      else await supabase.from("tasks").update({ status: "open" }).eq("id", dealInfo.id);
      toast.error("Deal cancelled. Karma penalty applied.");
      setDealInfo(p => p ? { ...p, status: "declined" } : p);
      setShowCancelModal(false);
    } catch { toast.error("Failed."); }
  };

  const filteredConversations = conversations.filter(c => {
    if (!searchQuery.trim()) return true;
    const cp = c.p1.id === userId ? c.p2 : c.p1;
    return cp.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
  });
  if (!mounted) return <div className="flex-1 w-full h-full bg-[#f7f9fb]" />;

  // ── Deal card ─────────────────────────────────────────────────────────────
  const renderTransactionCard = () => {
    if (!dealInfo) return null;
    const STATUS_MAP: Record<string, { label: string; color: string }> = {
      pending:   { label: "Pending Request",        color: "bg-primary"    },
      open:      { label: "Open Task",              color: "bg-primary"    },
      accepted:  { label: "Accepted · Awaiting QR", color: "bg-[#006e0c]" },
      claimed:   { label: "Claimed · Awaiting QR",  color: "bg-[#006e0c]" },
      rented:    { label: "In-Use",                 color: "bg-blue-600"  },
      returning: { label: "Return Initiated",       color: "bg-[#f0443a]" },
      completed: { label: "✓ Completed",            color: "bg-slate-700" },
      declined:  { label: "Declined",               color: "bg-slate-400" },
    };
    const s     = STATUS_MAP[dealInfo.status] ?? { label: dealInfo.status, color: "bg-outline" };
    const steps = dealInfo.type === "item"
      ? ["pending","accepted","rented","returning","completed"]
      : ["open","claimed","completed"];
    const stepIdx = steps.indexOf(dealInfo.status);

    return (
      <div className="max-w-md mx-auto w-full bg-white rounded-2xl border border-black/6 shadow-md overflow-hidden mb-4 shrink-0">
        <div className={`${s.color} px-4 py-2 flex justify-between items-center`}>
          <span className="text-[10px] font-bold tracking-widest uppercase text-white">{s.label}</span>
          <button onClick={() => setDealPanelOpen(v => !v)} className="material-symbols-outlined text-white/70 text-[18px] hover:text-white transition-colors">
            {dealPanelOpen ? "expand_less" : "expand_more"}
          </button>
        </div>
        <AnimatePresence initial={false}>
          {dealPanelOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <div className="p-3">
                {/* Stepper */}
                <div className="flex items-center gap-0 mb-3">
                  {steps.map((step, i) => (
                    <div key={step} className="flex items-center flex-1">
                      <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 transition-colors ${i <= stepIdx ? "bg-[#006e0c]" : "bg-outline-variant/20"}`}>
                        {i < stepIdx && <span className="material-symbols-outlined text-white text-[9px]">check</span>}
                        {i === stepIdx && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      {i < steps.length - 1 && <div className={`flex-1 h-0.5 mx-0.5 transition-colors ${i < stepIdx ? "bg-[#006e0c]" : "bg-outline-variant/15"}`} />}
                    </div>
                  ))}
                </div>
                {/* Item info */}
                <div className="flex gap-3 items-center">
                  {dealInfo.image_url
                    ? <div className="w-12 h-12 rounded-xl overflow-hidden relative shrink-0"><Image src={dealInfo.image_url} alt="item" fill className="object-cover" /></div>
                    : <div className="w-12 h-12 rounded-xl bg-surface-variant flex items-center justify-center shrink-0"><span className="material-symbols-outlined text-outline">inventory_2</span></div>}
                  <div className="flex-1 min-w-0">
                    <h5 className="font-serif font-bold text-[#000a1e] text-sm truncate">{dealInfo.title}</h5>
                    {dealInfo.reward_amount !== undefined && <p className="text-primary font-bold text-xs mt-0.5">₹{dealInfo.reward_amount}</p>}
                  </div>
                  {dealInfo.status !== "completed" && dealInfo.status !== "declined" && isLender && (
                    <button onClick={() => setShowCancelModal(true)} className="material-symbols-outlined text-error/50 hover:text-error p-1 rounded-full hover:bg-error/5 transition-colors text-[20px]">more_vert</button>
                  )}
                </div>
                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {(dealInfo.status === "pending" || dealInfo.status === "open") && isLender && (
                    <><button onClick={() => handleAcceptDecline("accepted")} className="flex-1 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow-sm active:scale-95 transition-all">Accept</button>
                    <button onClick={() => handleAcceptDecline("declined")} className="flex-1 py-2 bg-surface-container text-on-surface-variant text-xs font-bold rounded-xl border border-black/8 active:scale-95 transition-all">Decline</button></>
                  )}
                  {(dealInfo.status === "pending" || dealInfo.status === "open") && isBorrower && (
                    <p className="w-full text-center text-xs text-outline italic py-1">Waiting for owner to accept…</p>
                  )}
                  {(dealInfo.status === "accepted" || dealInfo.status === "claimed") && isLender && (
                    <button onClick={() => setShowScannerModal(dealInfo.id)} className="w-full bg-[#006e0c] text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95">
                      <span className="material-symbols-outlined text-[15px]">qr_code_scanner</span>Scan Borrower&apos;s QR
                    </button>
                  )}
                  {(dealInfo.status === "accepted" || dealInfo.status === "claimed") && isBorrower && (
                    <button onClick={() => setShowQrModal(dealInfo.id)} className="w-full bg-primary text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95">
                      <span className="material-symbols-outlined text-[15px]">qr_code_2</span>Show My QR
                    </button>
                  )}
                  {dealInfo.status === "rented" && isBorrower && (
                    <button onClick={initiateReturn} className="w-full bg-primary text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95">
                      <span className="material-symbols-outlined text-[15px]">assignment_return</span>Initiate Return
                    </button>
                  )}
                  {dealInfo.status === "rented" && isLender && (
                    <p className="w-full text-center text-xs text-outline italic py-1">Waiting for borrower to return…</p>
                  )}
                  {dealInfo.status === "returning" && isLender && (
                    <button onClick={() => setShowQrModal(dealInfo.id)} className="w-full bg-primary text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95">
                      <span className="material-symbols-outlined text-[15px]">qr_code_2</span>Show Return QR
                    </button>
                  )}
                  {dealInfo.status === "returning" && isBorrower && (
                    <button onClick={() => setShowScannerModal(dealInfo.id)} className="w-full bg-[#006e0c] text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95">
                      <span className="material-symbols-outlined text-[15px]">qr_code_scanner</span>Scan Lender&apos;s QR
                    </button>
                  )}
                  {dealInfo.status === "completed" && (
                    <div className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[#006e0c]">
                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                      <span className="text-xs font-bold">Transaction verified & complete</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // ════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════
  return (
    <>
      <div className="flex-1 w-full h-full flex overflow-hidden relative bg-[#f7f9fb]">

        {/* ── Sidebar ────────────────────────────────────────────────────────── */}
        <aside className={`w-full md:w-[360px] flex-col bg-white border-r border-black/5 shrink-0 overflow-hidden ${activeConversationId ? "hidden md:flex" : "flex"}`}>
          <div className="px-5 pt-8 pb-3 border-b border-black/5 shrink-0">
            <h1 className="font-headline text-2xl font-bold tracking-tight text-[#000a1e] mb-3">Messages</h1>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[16px]">search</span>
              <input className="w-full bg-[#f0f4f8] rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary/20 transition-all border border-transparent focus:border-primary/15"
                placeholder="Search conversations…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar pb-20 md:pb-0">
            {filteredConversations.length === 0 ? (
              <p className="text-center text-sm text-outline mt-12">{searchQuery ? `No results for "${searchQuery}"` : "No conversations yet."}</p>
            ) : filteredConversations.map(conv => {
              const cp      = conv.p1.id === userId ? conv.p2 : conv.p1;
              const isAct   = activeConversationId === conv.id;
              const lastMsg = conv.messages.at(-1) ?? null;
              const unread  = conv.messages.filter(m => !m.is_read && m.sender_id !== userId).length;
              const isOnl   = onlinePeers.includes(cp.id);
              const isTyp   = peerTypingMap[cp.id];
              let preview   = "No messages";
              if (lastMsg) {
                if (lastMsg.is_deleted) preview = "🚫 Message deleted";
                else {
                  const t = detectType(lastMsg);
                  preview = t === "image" ? "📷 Photo" : t === "audio" ? "🎙️ Voice note" : t === "file" ? "📎 File" : lastMsg.content;
                }
              }
              return (
                <div key={conv.id} onClick={() => router.push(`/messages?id=${conv.id}`)}
                  className={`flex items-center px-4 py-3.5 cursor-pointer transition-colors border-b border-black/3 ${isAct ? "bg-primary/5 border-l-[3px] border-l-primary/55 pl-[13px]" : "hover:bg-[#f0f4f8]"}`}
                >
                  <Avatar name={cp.full_name || "?"} avatarUrl={cp.avatar_url} size={12} online={isOnl} />
                  <div className="ml-3 flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h3 className="font-semibold text-sm text-[#000a1e] truncate">{cp.full_name}</h3>
                      <span className={`text-[10px] tabular-nums whitespace-nowrap ml-2 ${unread > 0 ? "text-primary font-bold" : "text-outline"}`}>
                        {lastMsg ? fmt12(lastMsg.created_at) : ""}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <p className={`truncate text-xs ${isTyp ? "text-[#006e0c] italic font-medium" : unread > 0 ? "text-[#000a1e] font-semibold" : "text-on-surface-variant"}`}>
                        {isTyp ? "typing…" : preview}
                      </p>
                      {unread > 0 && (
                        <span className="bg-primary text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full shrink-0">
                          {unread > 99 ? "99+" : unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* ── Chat area ──────────────────────────────────────────────────────── */}
        {activeConversationId ? (
          <section className="absolute inset-0 z-[60] md:relative md:inset-auto md:z-0 flex-1 flex flex-col overflow-hidden" style={{ background: "#eef5ee" }}>

            {/* Chat header */}
            <header className="flex-none bg-white/92 backdrop-blur-md px-4 py-3 border-b border-black/5 shadow-sm flex justify-between items-center z-30 shrink-0">
              <div className="flex items-center gap-3">
                <button className="md:hidden material-symbols-outlined text-[#000a1e] p-2 -ml-2 rounded-full active:bg-black/6" onClick={() => router.push("/messages")}>arrow_back</button>
                <Avatar name={peer?.full_name || "?"} avatarUrl={peer?.avatar_url} size={10} online={onlinePeers.includes(peer?.id ?? "")} />
                <div>
                  <h4 className="font-serif font-bold text-[#000a1e] text-sm leading-tight">{peer?.full_name}</h4>
                  <p className={`text-[10px] font-semibold ${onlinePeers.includes(peer?.id ?? "") ? "text-[#006e0c]" : "text-outline"} uppercase tracking-widest`}>
                    {peerTypingMap[peer?.id ?? ""]
                      ? <span className="normal-case italic tracking-normal text-[#006e0c] font-medium">typing…</span>
                      : onlinePeers.includes(peer?.id ?? "") ? "Active now" : "Offline"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                <button onClick={() => setShowSearchOverlay(true)} className="p-2.5 rounded-full hover:bg-black/5 transition-colors">
                  <span className="material-symbols-outlined text-outline text-[20px]">search</span>
                </button>
                <button onClick={() => setDealPanelOpen(v => !v)} className="p-2.5 rounded-full hover:bg-black/5 transition-colors">
                  <span className={`material-symbols-outlined text-[20px] ${dealPanelOpen ? "text-primary" : "text-outline"}`}>handshake</span>
                </button>
              </div>
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-2 md:px-3 py-3 no-scrollbar flex flex-col">
              {renderTransactionCard()}

              {activeConversation?.messages.map((msg, idx) => {
                const prev   = idx > 0 ? activeConversation.messages[idx - 1] : null;
                const showD  = diffDay(prev, msg);
                return (
                  <div key={msg.id} ref={el => { messageRefs.current[msg.id] = el; }} className="rounded-2xl transition-colors">
                    {showD && <DateDivider label={dateDivLabel(msg.created_at)} />}
                    <MessageBubble
                      msg={msg}
                      isMe={msg.sender_id === userId}
                      isRead={msg.is_read}
                      isDelivered={onlinePeers.includes(peer?.id ?? "")}
                      peer={peer} userId={userId}
                      onReact={handleReact} onReply={handleReply}
                      onEdit={handleEditMsg} onDelete={handleDeleteMsg}
                      allMessages={activeConversation.messages}
                      onJump={jumpToMessage} onImageClick={setLightboxSrc}
                    />
                  </div>
                );
              })}

              {peerTypingMap[peer?.id ?? ""] && <TypingDots />}

              {isInputLocked && (
                <div className="bg-white border border-error/10 rounded-2xl px-4 py-3 flex gap-3 items-start my-3 mx-1 shadow-sm">
                  <span className="material-symbols-outlined text-error shrink-0 text-[18px] mt-0.5">info</span>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    <strong className="text-error block mb-0.5">Message limit reached</strong>
                    5/5 messages sent. Wait for the owner to accept your request to continue chatting.
                  </p>
                </div>
              )}
              <div ref={messagesEndRef} className="h-3 shrink-0" />
            </div>

            {/* Search overlay */}
            <AnimatePresence>
              {showSearchOverlay && (
                <SearchOverlay messages={activeConversation?.messages ?? []} userId={userId} peerName={peer?.full_name ?? ""} onClose={() => setShowSearchOverlay(false)} onJump={jumpToMessage} />
              )}
            </AnimatePresence>

            {/* Input area */}
            <footer className="flex-none bg-white/95 backdrop-blur-md border-t border-black/5 z-20 pb-safe shrink-0">
              {/* Attachment */}
              {pendingAttachment && <AttachmentStrip file={pendingAttachment} onRemove={() => setPendingAttachment(null)} />}

              {/* Reply strip */}
              {replyingTo && !editingMsg && (
                <div className="flex items-center gap-2 mx-3 mt-2.5 bg-[#f0f4f8] border-l-[3px] border-primary rounded-r-xl px-3 py-2">
                  <span className="material-symbols-outlined text-primary text-[16px]">reply</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-primary uppercase tracking-wide mb-0.5">{replyingTo.sender_id === userId ? "You" : peer?.full_name}</p>
                    <p className="text-xs text-on-surface-variant truncate">
                      {detectType(replyingTo) === "image" ? "📷 Photo" : detectType(replyingTo) === "audio" ? "🎙️ Voice note" : replyingTo.content}
                    </p>
                  </div>
                  <button onClick={() => setReplyingTo(null)} className="material-symbols-outlined text-outline text-[16px] hover:text-on-surface transition-colors">close</button>
                </div>
              )}

              {/* Edit strip */}
              {editingMsg && (
                <div className="flex items-center gap-2 mx-3 mt-2.5 bg-amber-50 border-l-[3px] border-amber-400 rounded-r-xl px-3 py-2">
                  <span className="material-symbols-outlined text-amber-500 text-[16px]">edit</span>
                  <p className="text-xs text-amber-700 flex-1 truncate font-medium">Editing: {editingMsg.content}</p>
                  <button onClick={() => { setEditingMsg(null); setNewMessage(""); }} className="material-symbols-outlined text-outline text-[16px]">close</button>
                </div>
              )}

              {/* Emoji bar */}
              <AnimatePresence>
                {showEmojiBar && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="flex gap-1 px-3 py-2 border-b border-black/4 bg-[#f7f9f7]">
                      {QUICK_REACTIONS.map(e => (
                        <button key={e} onClick={() => setNewMessage(m => m + e)}
                          className="w-9 h-9 flex items-center justify-center text-xl rounded-xl hover:bg-white active:scale-90 transition-all"
                        >{e}</button>
                      ))}
                      <button onClick={() => setShowEmojiBar(false)} className="material-symbols-outlined text-outline text-[16px] ml-auto self-center">close</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Input row */}
              <div className="flex items-end gap-2 px-3 py-2.5">
                <button type="button" onClick={() => setShowEmojiBar(v => !v)}
                  className={`material-symbols-outlined transition-colors p-2.5 rounded-full shrink-0 mb-0.5 ${showEmojiBar ? "text-primary bg-primary/10" : "text-outline hover:text-primary bg-[#eef2ee]"}`}
                >sentiment_satisfied</button>

                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="material-symbols-outlined text-outline hover:text-primary transition-colors p-2.5 rounded-full shrink-0 mb-0.5 bg-[#eef2ee]"
                >attach_file</button>
                <input ref={fileInputRef} type="file" accept="image/*,audio/*,.pdf,.doc,.docx,.xlsx,.zip" className="hidden"
                  onChange={(e: ChangeEvent<HTMLInputElement>) => { if (e.target.files?.[0]) setPendingAttachment(e.target.files[0]); e.target.value = ""; }} />

                <div className="flex-1 bg-[#eef2ee] rounded-2xl flex items-end px-3.5 py-2 border border-transparent focus-within:border-primary/18 transition-all min-w-0">
                  <textarea ref={inputRef}
                    className="bg-transparent border-none focus:ring-0 text-sm w-full placeholder:text-outline max-h-32 resize-none no-scrollbar outline-none leading-relaxed"
                    placeholder={isInputLocked ? "Waiting for approval…" : editingMsg ? "Edit message…" : "Message…"}
                    rows={1}
                    value={newMessage}
                    onChange={e => { handleKeyboardInput(e); e.target.style.height = "auto"; e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`; }}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(e as unknown as React.FormEvent); }
                      if (e.key === "Escape") { setEditingMsg(null); setReplyingTo(null); setNewMessage(""); }
                    }}
                    disabled={isInputLocked}
                  />
                </div>

                <VoiceNoteButton onSend={blob => handleSendMessage(undefined, blob)} />

                <button
                  onClick={e => handleSendMessage(e)}
                  disabled={(!newMessage.trim() && !pendingAttachment) || isInputLocked || uploading}
                  className={`w-11 h-11 rounded-full flex items-center justify-center transition-all shrink-0 shadow-md mb-0.5 ${(newMessage.trim() || pendingAttachment) && !isInputLocked && !uploading ? "bg-primary text-white active:scale-90 hover:opacity-90" : "bg-[#d8e6d8] text-outline/60 cursor-not-allowed"}`}
                >
                  {uploading
                    ? <motion.span className="material-symbols-outlined text-[20px]" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>sync</motion.span>
                    : <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>}
                </button>
              </div>
            </footer>
          </section>
        ) : (
          <section className="hidden md:flex flex-1 flex-col items-center justify-center text-on-surface-variant bg-[#f7f9fb]">
            <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center mb-6 shadow-sm border border-black/6">
              <span className="material-symbols-outlined text-4xl text-outline">forum</span>
            </div>
            <h2 className="text-xl font-headline font-bold text-[#000a1e] mb-2">CampusShare Messages</h2>
            <p className="text-sm text-outline">Select a conversation to get started.</p>
          </section>
        )}
      </div>

      {/* ── Lightbox ──────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      </AnimatePresence>

      {/* ── QR modal ──────────────────────────────────────────────────────────── */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl"
          >
            <h3 className="font-headline font-bold text-xl text-[#000a1e] mb-1">Deal Verification</h3>
            <p className="text-sm text-outline mb-6">Show this QR code to the other party.</p>
            <div className="bg-[#f7f9fb] p-6 rounded-xl border border-black/6 inline-block mb-4">
              <QRCode value={showQrModal} size={180} />
            </div>
            <button onClick={() => setShowQrModal(null)} className="w-full py-3 border border-black/10 text-primary font-bold rounded-xl hover:bg-[#f7f9fb] transition-colors">Close</button>
          </motion.div>
        </div>
      )}

      {/* ── QR scanner ────────────────────────────────────────────────────────── */}
      {showScannerModal && (
        <div className="fixed inset-0 bg-black/95 z-[100] flex flex-col">
          <header className="absolute top-0 left-0 right-0 flex justify-between items-center p-4 bg-black/50 z-10 text-white">
            <h3 className="font-bold text-sm uppercase tracking-widest">Verify QR Code</h3>
            <button onClick={() => setShowScannerModal(null)} className="material-symbols-outlined p-2 bg-white/10 rounded-full">close</button>
          </header>
          <div id="qr-reader" className="flex-1 w-full bg-black flex items-center justify-center" />
        </div>
      )}

      {/* ── Cancel modal ──────────────────────────────────────────────────────── */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl"
          >
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-error">warning</span>
            </div>
            <h2 className="font-serif font-bold text-xl text-[#000a1e] mb-2">Cancel Transaction?</h2>
            <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
              Cancelling will apply a <span className="text-error font-bold">−5 Karma penalty</span>. Proceed?
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={cancelDeal} className="w-full py-3 bg-error text-white font-bold rounded-xl shadow-md active:scale-95 transition-all">Yes, accept penalty</button>
              <button onClick={() => setShowCancelModal(false)} className="w-full py-3 bg-[#f7f9fb] text-[#000a1e] font-bold rounded-xl border border-black/8 active:scale-95 transition-all">No, go back</button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}