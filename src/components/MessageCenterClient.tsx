// src/components/MessageCenterClient.tsx
"use client";

import {
  useEffect, useState, useRef, useCallback, useMemo, useSyncExternalStore,
  type ChangeEvent,
} from "react";
import { createClient }      from "@/utils/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useRouter }         from "next/navigation";
// import Image                 from "next/image";
import toast                 from "react-hot-toast";
import QRCode                from "react-qr-code";
import { Html5Qrcode }       from "html5-qrcode";
import { createHandshakeQrPayload } from "@/lib/qr-handshake";
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


import {
  AttachmentStrip,
  Avatar,
  ConnectionBanner,
  ConversationRow,
  DateDivider,
  DealStatusCard,
  ImageLightbox,
  MessageBubble,
  QUICK_REACTIONS,
  ScrollToBottomFAB,
  SearchOverlay,
  TypingDots,
  UnreadSeparator,
  VoiceNoteButton,
  dateDivLabel,
  diffDay,
  shouldGroup,
  sortConversations,
  type ExtendedConversation,
  type ExtendedMessage,
  type MsgType,
} from "@/components/messages/MessageCenterParts";

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
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
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
  const [forwardingMsg,     setForwardingMsg]     = useState<ExtendedMessage | null>(null);

  // ── Refs ─────────────────────────────────────────────────────
  const messagesEndRef    = useRef<HTMLDivElement>(null);
  const scrollContainerRef= useRef<HTMLDivElement>(null);
  const inputRef          = useRef<HTMLTextAreaElement>(null);
  const channelRef        = useRef<RealtimeChannel | null>(null);
  const typingTimer       = useRef<NodeJS.Timeout | null>(null);
  const messageRefs       = useRef<Record<string, HTMLDivElement | null>>({});
  const fileInputRef      = useRef<HTMLInputElement>(null);
  const dealInfoRef       = useRef<DealInfo | null>(null);
  const userIdRef         = useRef(userId);
  const activeConversationIdRef = useRef(activeConversationId);
  const conversationsRef  = useRef(conversations);   // always-fresh read for handlers
  const isAtBottomRef     = useRef(true);
  const [showScrollFab,   setShowScrollFab]   = useState(false);

  useEffect(() => { userIdRef.current      = userId;        }, [userId]);
  useEffect(() => { activeConversationIdRef.current = activeConversationId; }, [activeConversationId]);
  useEffect(() => { dealInfoRef.current    = dealInfo;      }, [dealInfo]);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);

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
  const getQrAction = useCallback((): "handoff" | "return" | "complete" | null => {
    if (!dealInfo) return null;

    if (dealInfo.type === "task") {
      return "complete";
    }

    if (dealInfo.status === "accepted") {
      return "handoff";
    }

    if (dealInfo.status === "returning") {
      return "return";
    }

    return null;
  }, [dealInfo]);

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


  // ── Auto-focus input ─────────────────────────────────────────
  useEffect(() => {
    if (!activeConversationId) return;
    const t = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(t);
  }, [activeConversationId]);

  // ── Smart scroll — only auto-scroll when near the bottom ─────
  const [newMsgCount,         setNewMsgCount]         = useState(0);
  const [unreadSeparatorIdx,  setUnreadSeparatorIdx]  = useState<number | null>(null);
  const [connectionState,     setConnectionState]     = useState<"connected"|"connecting"|"error">("connecting");
  const [convListSearch,      setConvListSearch]      = useState("");
  const [selectedIds,         setSelectedIds]         = useState<Set<string>>(new Set());
  const [starredIds,          setStarredIds]          = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("cs:starred") ?? "[]")); }
    catch { return new Set(); }
  });

  // Scroll container scroll handler
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      isAtBottomRef.current = distFromBottom < 120;
      setShowScrollFab(!isAtBottomRef.current);
      if (isAtBottomRef.current) setNewMsgCount(0);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [activeConversationId]);

  // When conversation opens, mark where unread starts
  useEffect(() => {
    if (!activeConversation) return;
    const msgs = activeConversation.messages;
    const firstUnread = msgs.findIndex(m => !m.is_read && m.sender_id !== userId);
    setUnreadSeparatorIdx(firstUnread >= 0 ? firstUnread : null);
    setNewMsgCount(0);
    setShowScrollFab(false);
    isAtBottomRef.current = true;
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "instant" as ScrollBehavior }), 50);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId]);

  // Auto-scroll on new messages (only if already at bottom)
  const prevMsgLen = useRef(0);
  useEffect(() => {
    const len = memoizedMessages.length;
    if (len <= prevMsgLen.current) { prevMsgLen.current = len; return; }
    const newOnes = len - prevMsgLen.current;
    prevMsgLen.current = len;

    if (isAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } else {
      // Count only peer messages as "new"
      const lastNew = memoizedMessages.slice(-newOnes);
      const peerNew = lastNew.filter(m => m.sender_id !== userId && !m.id.startsWith("temp-")).length;
      if (peerNew > 0) setNewMsgCount(n => n + peerNew);
    }
  }, [memoizedMessages.length, memoizedMessages, userId]);

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

      type ItemRequestWithItem = {
        id: string;
        status: string | null;
        requester_id: string;
        items: {
          id: string;
          title: string;
          images: string[] | null;
          price_amount: number | null;
          user_id: string;
        } | null;
      };
      const itemRequest = ir as unknown as ItemRequestWithItem | null;

      if (itemRequest?.items) {
        setDealInfo({
          type:          "item",
          id:            itemRequest.id,
          status:        itemRequest.status ?? "pending",
          title:         itemRequest.items.title,
          image_url:     itemRequest.items.images?.[0] ?? "",
          reward_amount: itemRequest.items.price_amount ?? undefined,
          owner_id:      itemRequest.items.user_id,
          requester_id:  itemRequest.requester_id,
          item_id:       itemRequest.items.id,
        });
        return;
      }

      const { data: tr } = await supabase
        .from("tasks")
        .select("*, task_claims(*)")
        .eq("id", activeConversation.deal_id)
        .maybeSingle();

      type TaskWithClaims = {
        id: string;
        status: string | null;
        title: string;
        reward_amount: number | null;
        user_id: string;
        task_claims?: Array<{ claimed_by: string }> | null;
      };
      const task = tr as unknown as TaskWithClaims | null;

      if (task) {
        setDealInfo({
          type:          "task",
          id:            task.id,
          status:        task.status ?? "open",
          title:         task.title,
          image_url:     "",
          reward_amount: task.reward_amount ?? undefined,
          owner_id:      task.user_id,
          requester_id:
            task.task_claims?.[0]?.claimed_by ??
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
    }).then(({ error }) => {
      if (error) console.error("[Messages] mark_conversation_as_read failed:", error);
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
  }, [activeConversationId, conversations, supabase, userId]);

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
        const openConversationId = activeConversationIdRef.current;
        if (nm.conversation_id === openConversationId && nm.sender_id !== userIdRef.current) {
          nm.is_read = true;
          supabase.rpc("mark_conversation_as_read", {
            p_conversation_id: nm.conversation_id,
          }).then(({ error }) => {
            if (error) console.error("[Messages] realtime mark read failed:", error);
          });
        }

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
        setConnectionState("connected");
        await ch.track({ online_at: new Date().toISOString() });
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setConnectionState("error");
      } else {
        setConnectionState("connecting");
      }
    });

    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, supabase, userId]);
  const handleQRConfirm = useCallback(
    async (qrData: string) => {
      if (!dealInfo) return;

      const action = getQrAction();

      const { error } = await supabase.rpc("verify_qr_handshake", {
        p_deal_id:   dealInfo.id,
        p_deal_type: dealInfo.type,
        p_qr_data:   qrData,
        p_action:    action,
      });

      if (error) {
        toast.error(error.message || "QR verification failed");
        return;
      }

      toast.success("QR confirmed!");
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

      const { data: updated } = await supabase
        .from(dealInfo.type === "item" ? "item_requests" : "tasks")
        .select("status")
        .eq("id", dealInfo.id)
        .single();

      if (updated) {
        setDealInfo(prev =>
          prev ? { ...prev, status: updated.status ?? prev.status } : null
        );
      }
    },
    [dealInfo, supabase, getQrAction]
  );
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
          handleQRConfirm(decoded);
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
      if (qr.isScanning) {
        qr.stop().catch(() => {});
      } else {
        qr.clear();
      }
    };
  }, [showScannerModal, handleQRConfirm]);

  // ── Handlers ─────────────────────────────────────────────────

  

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
          .from("chat-attachments")
          .upload(path, pendingAttachment, { upsert: false });

        setUploading(false);

        if (error || !data) {
          toast.error("Upload failed");
          return;
        }

        const { data: { publicUrl } } = supabase.storage
          .from("chat-attachments")
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
        const { error } = await supabase.rpc("edit_message", {
          p_msg_id: editingMsg.id,
          p_content: content,
        });
        if (error) {
          toast.error(error.message || "Could not edit message");
        }
        setEditingMsg(null);
      } else {
        const { error } = await supabase.rpc("send_message", {
          p_conversation_id: activeConversationId,
          p_content: content,
          p_msg_type: msgType,
          p_reply_to_id: replyingTo?.id ?? null,
        });
        if (error) {
          toast.error(error.message || "Could not send message");
        }
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

      // Compute new reactions synchronously before any state update
      const conv = conversationsRef.current.find(c => c.id === activeConversationId);
      const msg  = conv?.messages.find(m => m.id === msgId);
      const r    = { ...(msg?.reactions ?? {}) };
      if (!r[emoji]) r[emoji] = { emoji, user_ids: [] };
      const idx = r[emoji].user_ids.indexOf(userId);
      if (idx === -1) r[emoji].user_ids.push(userId);
      else r[emoji].user_ids.splice(idx, 1);
      if (r[emoji].user_ids.length === 0) delete r[emoji];

      // Optimistic update
      setConversations(prev =>
        prev.map(c =>
          c.id !== activeConversationId ? c : {
            ...c,
            messages: c.messages.map(m =>
              m.id !== msgId ? m : { ...m, reactions: r }
            ),
          }
        )
      );

      const { error } = await supabase.rpc("toggle_reaction", {
        p_msg_id: msgId,
        p_emoji: emoji,
        p_user_id: userId,
      });

      if (error) {
        toast.error("Reaction failed");
      }
    },
    [activeConversationId, supabase, userId]
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

      await supabase.rpc("soft_delete_message", { p_msg_id: msgId });

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
        .from("chat-attachments")
        .upload(path, blob, { contentType: "audio/webm" });

      setUploading(false);

      if (error || !data) {
        toast.error("Voice upload failed");
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("chat-attachments")
        .getPublicUrl(data.path);

      const { error: sendError } = await supabase.rpc("send_message", {
        p_conversation_id: activeConversationId,
        p_content: publicUrl,
        p_msg_type: "audio",
        p_reply_to_id: null,
      });

      if (sendError) {
        toast.error(sendError.message || "Could not send voice message");
      }
    },
    [activeConversationId, supabase, userId]
  );

  const handleAccept = useCallback(async () => {
    if (!dealInfo) return;

    if (dealInfo.type === "item") {
      const { error } = await supabase.rpc("respond_item_request", {
        p_request_id: dealInfo.id,
        p_action: "accepted",
      });
      if (error) {
        toast.error(error.message || "Could not accept deal");
        return;
      }
      setDealInfo(prev => prev ? { ...prev, status: "accepted" } : null);
      toast.success("Deal accepted!");
      return;
    }

    toast.error("Task acceptance is handled from the task claim flow.");
  }, [dealInfo, supabase]);

  const handleDecline = useCallback(async () => {
    if (!dealInfo) return;

    if (dealInfo.type === "item") {
      const { error } = await supabase.rpc("respond_item_request", {
        p_request_id: dealInfo.id,
        p_action: "declined",
      });
      if (error) {
        toast.error(error.message || "Could not decline deal");
        return;
      }
      setDealInfo(prev => (prev ? { ...prev, status: "declined" } : null));
      toast.success("Deal declined");
      return;
    }

    toast.error("Task decline is handled from the task claim flow.");
  }, [dealInfo, supabase]);

  const handleInitiateReturn = useCallback(async () => {
    if (!dealInfo || dealInfo.type !== "item") return;
    const { error } = await supabase.rpc("initiate_item_return", {
      p_request_id: dealInfo.id,
    });
    if (error) {
      toast.error(error.message || "Could not initiate return");
      return;
    }
    setDealInfo(prev => (prev ? { ...prev, status: "returning" } : null));
    toast.success("Return initiated");
  }, [dealInfo, supabase]);

  const handleCancelDeal = useCallback(async () => {
    if (!dealInfo) return;
    setShowCancelModal(false);

    if (dealInfo.type === "item") {
      const { error } = await supabase.rpc("respond_item_request", {
        p_request_id: dealInfo.id,
        p_action: "declined",
      });
      if (error) {
        toast.error(error.message || "Could not cancel deal");
        return;
      }
      setDealInfo(prev => (prev ? { ...prev, status: "declined" } : null));
      toast.success("Deal cancelled");
      return;
    }

    toast.error("Task cancellation is handled from the task flow.");
  }, [dealInfo, supabase]);

  const handleStar = useCallback((msgId: string) => {
    setStarredIds(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId); else next.add(msgId);
      try { localStorage.setItem("cs:starred", JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  const handleForward = useCallback(
    async (msg: ExtendedMessage, targetConvId: string) => {
      if (!msg.content) return;
      const { error } = await supabase.rpc("send_message", {
        p_conversation_id: targetConvId,
        p_content: msg.content,
        p_msg_type: msg.msg_type ?? "text",
        p_reply_to_id: null,
      });
      if (error) {
        toast.error(error.message || "Could not forward message");
        return;
      }
      setForwardingMsg(null);
      toast.success("Forwarded");
    },
    [supabase, userId]
  );

  const handleDeleteSelected = useCallback(async () => {
    const ids = [...selectedIds];
    // Optimistic
    setConversations(prev =>
      prev.map(c =>
        c.id !== activeConversationId ? c : {
          ...c,
          messages: c.messages.map(m =>
            ids.includes(m.id) && m.sender_id === userId
              ? { ...m, is_deleted: true, content: "" }
              : m
          ),
        }
      )
    );
    // DB - only own messages
    for (const id of ids) {
      const conv = conversationsRef.current.find(c => c.id === activeConversationId);
      const msg  = conv?.messages.find(m => m.id === id);
      if (msg?.sender_id === userId) {
        await supabase.rpc("soft_delete_message", { p_msg_id: id });
      }
    }
    setSelectedIds(new Set());
  }, [selectedIds, activeConversationId, userId, supabase]);

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
        } flex-col w-full md:w-80 shrink-0`}
        style={{
          borderRight: `1px solid ${t.border}`,
          background:  t.surface,
        }}
      >
        {/* Header */}
        <header
          className="px-4 pt-4 pb-3 shrink-0"
          style={{ borderBottom: `1px solid ${t.border}` }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-headline text-lg font-bold" style={{ color: t.text }}>
              Messages
            </h2>
            <span
              className="text-[11px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: `${t.secondary}12`, color: t.secondary }}
            >
              {conversations.length}
            </span>
          </div>
          {/* Inline conversation search */}
          <div
            className="rounded-xl px-3 py-2 flex items-center gap-2"
            style={{ background: t.surfaceSoft, border: `1px solid ${t.border}` }}
          >
            <span className="material-symbols-outlined text-[16px]" style={{ color: t.textMuted }}>
              search
            </span>
            <input
              value={convListSearch}
              onChange={e => setConvListSearch(e.target.value)}
              placeholder="Search by name…"
              className="bg-transparent flex-1 text-sm border-none outline-none ring-0 p-0"
              style={{ color: t.text }}
              aria-label="Search conversations"
            />
            {convListSearch && (
              <button onClick={() => setConvListSearch("")}>
                <span className="material-symbols-outlined text-[14px]" style={{ color: t.textMuted }}>close</span>
              </button>
            )}
          </div>
        </header>

        {/* List */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {(() => {
            const q = convListSearch.toLowerCase().trim();
            const filtered = sortConversations(conversations).filter(c => {
              if (!q) return true;
              const peer = c.p1.id === userId ? c.p2 : c.p1;
              return peer.full_name?.toLowerCase().includes(q);
            });
            if (filtered.length === 0) return (
              <div className="flex flex-col items-center justify-center h-full px-4">
                <span className="material-symbols-outlined text-5xl mb-3" style={{ color: t.textMuted }}>
                  {q ? "search_off" : "forum"}
                </span>
                <p className="text-sm text-center" style={{ color: t.textMuted }}>
                  {q ? `No results for "${convListSearch}"` : "No conversations yet"}
                </p>
              </div>
            );
            return filtered.map(conv => (
              <ConversationRow
                key={conv.id}
                conv={conv}
                userId={userId}
                isActive={conv.id === activeConversationId}
                onlinePeers={onlinePeers}
                peerTypingMap={peerTypingMap}
                searchQuery={convListSearch}
                onClick={() => router.prefetch(`/messages?id=${conv.id}`)}
              />
            ));
          })()}
        </div>
      </aside>

      {/* Chat thread */}
      {activeConversationId && activeConversation ? (
        <div className="flex-1 flex flex-col w-full overflow-hidden">
          {/* Header */}
          <header
            className="px-4 py-3 flex items-center justify-between shrink-0"
            style={{
              borderBottom: `1px solid ${t.border}`,
              background:   t.card,
            }}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button
                onClick={() => router.prefetch("/messages")}
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

          {/* Connection banner */}
          <AnimatePresence>
            {connectionState !== "connected" && (
              <ConnectionBanner state={connectionState} />
            )}
          </AnimatePresence>

          {/* Messages — scroll container */}
          <div className="relative flex-1 overflow-hidden">
            <div
              ref={scrollContainerRef}
              className="h-full overflow-y-auto no-scrollbar flex flex-col"
            >
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
                  const prev      = i > 0 ? memoizedMessages[i - 1] : null;
                  const showDate  = diffDay(prev, msg);
                  const grouped   = shouldGroup(prev, msg);
                  const isMe      = msg.sender_id === userId;
                  const isRead    = msg.is_read;
                  const isDelivered = !isRead;
                  const isSelected = selectedIds.has(msg.id);
                  const isStarred  = starredIds.has(msg.id);

                  return (
                    <div
                      key={msg.id}
                      ref={el => { messageRefs.current[msg.id] = el; }}
                    >
                      {showDate && <DateDivider label={dateDivLabel(msg.created_at)} />}
                      {/* Unread separator — appears before the first unread message */}
                      {unreadSeparatorIdx === i && (
                        <UnreadSeparator
                          count={memoizedMessages.slice(i).filter(
                            m => !m.is_read && m.sender_id !== userId
                          ).length}
                        />
                      )}
                      <MessageBubble
                        msg={msg}
                        isMe={isMe}
                        isRead={isRead}
                        isDelivered={isDelivered}
                        isGrouped={grouped}
                        isSelected={isSelected}
                        isStarred={isStarred}
                        isSelecting={selectedIds.size > 0}
                        peer={peer}
                        userId={userId}
                        onReact={handleReaction}
                        onReply={m => { setReplyingTo(m); inputRef.current?.focus(); }}
                        onEdit={m => { setEditingMsg(m); setNewMessage(m.content); inputRef.current?.focus(); }}
                        onDelete={handleDelete}
                        onStar={handleStar}
                        onForward={m => setForwardingMsg(m)}
                        onSelect={id => {
                          setSelectedIds(prev => {
                            const next = new Set(prev);
                            if (next.has(id)) next.delete(id); else next.add(id);
                            return next;
                          });
                        }}
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

            {/* Scroll-to-bottom FAB */}
            <AnimatePresence>
              {showScrollFab && (
                <ScrollToBottomFAB
                  count={newMsgCount}
                  onClick={() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                    setNewMsgCount(0);
                  }}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Input */}
          <div
            className="shrink-0"
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
                className="material-symbols-outlined p-2.5 mb-1.5 rounded-full shrink-0 transition-colors active:scale-90"
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
                    // Auto-grow
                    const el = e.target;
                    el.style.height = "auto";
                    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(e as unknown as React.FormEvent);
                    }
                  }}
                  placeholder="Type a message…"
                  rows={1}
                  className="flex-1 resize-none bg-transparent text-sm no-scrollbar border-none outline-none ring-0 shadow-none appearance-none focus:border-none focus:outline-none focus:ring-0 focus:shadow-none"
                  style={{ color: t.text, maxHeight: "8rem", overflowY: "auto" }}
                  disabled={uploading}
                  aria-label="Message input"
                />
                <button
                  type="button"
                  onClick={() => setShowEmojiBar(v => !v)}
                  className="material-symbols-outlined text-[18px] shrink-0"
                  style={{ color: t.textMuted }}
                >
                  sentiment_satisfied
                </button>
              </div>

              {newMessage.trim() || pendingAttachment ? (
                <button
                  type="submit"
                  className="p-2.5 rounded-full shrink-0 active:scale-90 transition-all"
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
            className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 p-4"
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
                {dealInfo && (
                  <QRCode
                    value={createHandshakeQrPayload({
                      dealId: dealInfo.id,
                      dealType: dealInfo.type,
                      userId,
                      action: getQrAction(),
                    })}
                    size={256}
                    className="w-full h-auto"
                  />
                )}
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
            className="fixed inset-0 z-100 flex flex-col bg-black"
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
            className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 p-4"
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
        {/* Forward modal */}
        {forwardingMsg && (
          <motion.div
            variants={fade}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="fixed inset-0 z-100 flex items-end justify-center bg-black/60 p-4"
            onClick={() => setForwardingMsg(null)}
          >
            <motion.div
              variants={slideUp}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl overflow-hidden"
              style={{ background: t.card }}
            >
              <div className="px-5 pt-5 pb-3 flex items-center justify-between"
                style={{ borderBottom: `1px solid ${t.border}` }}>
                <h3 className="font-bold text-base" style={{ color: t.text }}>Forward to…</h3>
                <button onClick={() => setForwardingMsg(null)}>
                  <span className="material-symbols-outlined text-[20px]" style={{ color: t.textMuted }}>close</span>
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto no-scrollbar py-1">
                {sortConversations(conversations)
                  .filter(c => c.id !== activeConversationId)
                  .map(c => {
                    const p = c.p1.id === userId ? c.p2 : c.p1;
                    return (
                      <button
                        key={c.id}
                        onClick={() => handleForward(forwardingMsg, c.id)}
                        className="w-full flex items-center gap-3 px-5 py-3 text-left transition-colors"
                        style={{ borderBottom: `1px solid ${t.border}` }}
                      >
                        <Avatar name={p.full_name ?? "?"} avatarUrl={p.avatar_url} size={10} />
                        <span className="text-sm font-semibold" style={{ color: t.text }}>
                          {p.full_name}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selection bar (shown above input when messages are selected) */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0,  opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 32 }}
            className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 md:max-w-none safe-bottom"
            style={{
              background: t.primary,
              boxShadow: "0 -4px 24px rgba(0,10,30,0.16)",
            }}
          >
            <button onClick={() => setSelectedIds(new Set())} className="flex items-center gap-2 text-white/70">
              <span className="material-symbols-outlined text-[20px]">close</span>
              <span className="text-sm font-bold">{selectedIds.size} selected</span>
            </button>
            <div className="flex gap-1">
              {[...selectedIds].length === 1 && (
                <>
                  <button
                    onClick={() => {
                      const id = [...selectedIds][0];
                      const conv = conversationsRef.current.find(c => c.id === activeConversationId);
                      const msg  = conv?.messages.find(m => m.id === id);
                      if (msg) { setForwardingMsg(msg); setSelectedIds(new Set()); }
                    }}
                    className="p-2.5 rounded-full text-white/80 hover:bg-white/10 transition-colors"
                    aria-label="Forward"
                  >
                    <span className="material-symbols-outlined text-[20px]">forward</span>
                  </button>
                  <button
                    onClick={() => {
                      const id = [...selectedIds][0];
                      handleStar(id);
                      setSelectedIds(new Set());
                    }}
                    className="p-2.5 rounded-full text-white/80 hover:bg-white/10 transition-colors"
                    aria-label="Star"
                  >
                    <span className="material-symbols-outlined text-[20px]"
                      style={{ fontVariationSettings: starredIds.has([...selectedIds][0]) ? "'FILL' 1" : "'FILL' 0" }}>
                      star
                    </span>
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  const id = [...selectedIds][0];
                  const conv = conversationsRef.current.find(c => c.id === activeConversationId);
                  const msg  = conv?.messages.find(m => m.id === id);
                  if (msg?.content) { navigator.clipboard?.writeText([...selectedIds].map(sid => conv?.messages.find(m=>m.id===sid)?.content ?? "").join("\n")); toast.success("Copied"); }
                  setSelectedIds(new Set());
                }}
                className="p-2.5 rounded-full text-white/80 hover:bg-white/10 transition-colors"
                aria-label="Copy"
              >
                <span className="material-symbols-outlined text-[20px]">content_copy</span>
              </button>
              <button
                onClick={handleDeleteSelected}
                className="p-2.5 rounded-full hover:bg-white/10 transition-colors"
                style={{ color: "#ff8a80" }}
                aria-label="Delete selected"
              >
                <span className="material-symbols-outlined text-[20px]">delete</span>
              </button>
            </div>
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