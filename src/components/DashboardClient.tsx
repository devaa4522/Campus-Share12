"use client";

import { useState, useEffect, useCallback, type MouseEvent } from "react";
import { createClient } from "@/utils/supabase/client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import QRCode from "react-qr-code";
import { Html5Qrcode } from "html5-qrcode";
import { useHaptics } from "@/hooks/useHaptics";

// ── Inline types (from DB schema) ──────────────────────────────────────────────
type DealTab = "received" | "made" | "my_listings" | "task_requests" | "helping_with";

interface Profile {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  karma_score?: number | null;
  college_domain?: string | null;
  college_type?: string | null;
  major?: string | null;
  year_of_study?: string | null;
  bio?: string | null;
  degree?: string | null;
  branch?: string | null;
  department?: string | null;
  notifications_enabled?: boolean | null;
  profile_public?: boolean | null;
  karma_escrow?: number | null;
  total_tasks_claimed?: number | null;
  total_tasks_completed?: number | null;
  reliability_score?: number | null;
  is_verified?: boolean | null;
  is_shadow_banned?: boolean | null;
  flags_count?: number | null;
  banned_until?: string | null;
}

interface Item {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  condition?: string | null;
  price_type?: string | null;
  price_amount?: number | null;
  status: string | null;
  images?: string[] | null;
  created_at?: string | null;
  college_domain?: string | null;
  is_hidden?: boolean | null;
  thumbnail_url?: string | null;
  profiles?: Profile | null;
}

interface ItemRequest {
  id: string;
  item_id: string;
  requester_id: string;
  duration_days: number;
  status: string | null;
  created_at: string;
}

interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  reward_type?: string | null;
  reward_amount?: number | null;
  status: string | null;
  deadline?: string | null;
  college_domain?: string | null;
  created_at: string;
  profiles?: Profile | null;
}

interface TaskClaim {
  id: string;
  task_id: string;
  claimed_by: string;
  created_at?: string | null;
  profiles?: Profile | null;
}

interface RequestWithRelations extends ItemRequest {
  items: (Item & { profiles?: Profile | null }) | null;
  profiles: Profile | null;
}

type CancelTaskClaimResult = {
  success?: boolean;
  penalty_applied?: boolean;
  message?: string;
  error?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function deadlineLabel(deadline: string | null | undefined): string {
  if (!deadline) return "Flexible";
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff < 0) return "Overdue";
  const days = Math.ceil(diff / 86400000);
  if (days === 0) return "Due today";
  return `${days}d left`;
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Steppers ───────────────────────────────────────────────────────────────────
const ITEM_STEPS = ["Pending", "Accepted", "Rented", "Returning", "Done"];
const ITEM_STEP_IDX: Record<string, number> = {
  pending: 0, accepted: 1, rented: 2, returning: 3, completed: 4, declined: -1,
};

function DealStepper({ status }: { status: string }) {
  if (status === "declined") return (
    <div className="flex items-center gap-1.5 py-2">
      <span className="w-4 h-4 rounded-full bg-error/20 flex items-center justify-center flex-shrink-0">
        <span className="material-symbols-outlined text-error" style={{ fontSize: 10 }}>close</span>
      </span>
      <span className="text-[10px] font-bold uppercase tracking-widest text-error">Declined</span>
    </div>
  );
  const cur = ITEM_STEP_IDX[status] ?? 0;
  return (
    <div className="flex items-center gap-0.5 py-2 overflow-x-auto no-scrollbar">
      {ITEM_STEPS.map((step, i) => (
        <div key={step} className="flex items-center gap-0.5 flex-shrink-0">
          <div className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide transition-all flex items-center gap-0.5 ${
            i < cur ? "bg-secondary/15 text-secondary" :
            i === cur ? "bg-primary text-on-primary" :
            "bg-surface-container-high text-on-surface-variant/30"
          }`}>
            {i < cur && <span className="material-symbols-outlined" style={{ fontSize: 9 }}>check</span>}
            {step}
          </div>
          {i < ITEM_STEPS.length - 1 && (
            <div className={`w-3 h-px flex-shrink-0 ${i < cur ? "bg-secondary/30" : "bg-outline-variant/20"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

const TASK_STEPS = ["Posted", "Helper Found", "In Progress", "Done"];
const TASK_STEP_IDX: Record<string, number> = { open: 0, claimed: 2, completed: 3 };

function TaskStepper({ status }: { status: string }) {
  const cur = TASK_STEP_IDX[status] ?? 0;
  return (
    <div className="flex items-center gap-0.5 py-2 overflow-x-auto no-scrollbar">
      {TASK_STEPS.map((step, i) => (
        <div key={step} className="flex items-center gap-0.5 flex-shrink-0">
          <div className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide transition-all flex items-center gap-0.5 ${
            i < cur ? "bg-secondary/15 text-secondary" :
            i === cur ? "bg-primary text-on-primary" :
            "bg-surface-container-high text-on-surface-variant/30"
          }`}>
            {i < cur && <span className="material-symbols-outlined" style={{ fontSize: 9 }}>check</span>}
            {step}
          </div>
          {i < TASK_STEPS.length - 1 && (
            <div className={`w-3 h-px flex-shrink-0 ${i < cur ? "bg-secondary/30" : "bg-outline-variant/20"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Small reusable components ──────────────────────────────────────────────────
function Avatar({ url, name, size = 32 }: { url?: string | null; name?: string | null; size?: number }) {
  return (
    <div className="rounded-full bg-primary/10 overflow-hidden flex-shrink-0 relative flex items-center justify-center"
      style={{ width: size, height: size }}>
      {url
        ? <Image src={url} alt={name ?? "User"} fill className="object-cover" />
        : <span className="font-bold text-primary" style={{ fontSize: size * 0.4 }}>{name?.charAt(0)?.toUpperCase() ?? "?"}</span>
      }
    </div>
  );
}

function EmptyState({ icon, text, cta, ctaHref }: { icon: string; text: string; cta?: string; ctaHref?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-on-surface-variant/40 text-3xl">{icon}</span>
      </div>
      <p className="text-on-surface-variant text-sm leading-relaxed mb-4">{text}</p>
      {cta && ctaHref && (
        <Link href={ctaHref} className="bg-primary text-on-primary px-6 py-2.5 rounded-2xl font-bold text-sm active:scale-95 transition-transform">
          {cta}
        </Link>
      )}
    </div>
  );
}

// Slide-up bottom sheet: confirm before opening scanner
function ScanConfirmSheet({ data, onConfirm, onCancel }: {
  data: { title: string; body: string; reward?: number; rewardType?: string } | null;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!data) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-[#000a1e]/60 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-surface-container-lowest w-full max-w-lg rounded-t-3xl p-6 pb-10 shadow-2xl border-t border-outline-variant/10" onClick={(e: MouseEvent) => e.stopPropagation()}>
        <div className="w-10 h-1 bg-outline-variant/40 rounded-full mx-auto mb-5" />
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-primary">qr_code_scanner</span>
          </div>
          <div>
            <p className="font-bold text-primary text-base leading-tight">{data.title}</p>
            <p className="text-on-surface-variant text-xs mt-0.5 leading-relaxed">{data.body}</p>
          </div>
        </div>
        {data.reward !== undefined && data.reward > 0 && (
          <div className="bg-secondary/10 rounded-2xl px-4 py-3 mb-5 flex items-center gap-3">
            <span className="material-symbols-outlined text-secondary">toll</span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-secondary/60">Reward on completion</p>
              <p className="font-headline font-bold text-secondary text-xl">{data.reward} {data.rewardType === "karma" ? "CP" : "₹"}</p>
            </div>
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 border border-outline-variant/30 text-on-surface-variant py-3 rounded-2xl font-bold text-sm active:scale-95 transition-transform">Cancel</button>
          <button onClick={onConfirm} className="flex-[2] bg-primary text-on-primary py-3 rounded-2xl font-bold text-sm active:scale-95 transition-transform">Open Scanner</button>
        </div>
      </div>
    </div>
  );
}

// QR Display
function QRModal({ dealId, userId, onClose }: { dealId: string; userId: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#000a1e]/80 backdrop-blur-md p-4" onClick={onClose}>
      <div className="bg-surface-container-lowest rounded-3xl w-full max-w-xs overflow-hidden shadow-2xl border border-outline-variant/10 text-center relative p-7" onClick={(e: MouseEvent) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high">
          <span className="material-symbols-outlined text-on-surface-variant text-[18px]">close</span>
        </button>
        <div className="w-10 h-10 rounded-2xl bg-secondary/10 flex items-center justify-center mx-auto mb-3">
          <span className="material-symbols-outlined text-secondary">qr_code_2</span>
        </div>
        <h2 className="font-headline font-bold text-lg text-primary mb-1">Proof of Work</h2>
        <p className="text-on-surface-variant text-xs mb-5 leading-relaxed">Show this to the other party to confirm the handshake</p>
        <div className="bg-white p-5 rounded-2xl inline-block shadow-lg border-4 border-secondary/30 mb-4">
          <QRCode value={JSON.stringify({deal_id: dealId, user_id: userId, timestamp: Date.now(),})} size={200} fgColor="#000a1e"/>
        </div>
        <p className="text-[9px] uppercase font-bold tracking-[0.2em] text-secondary">Encrypted · Tamper-proof</p>
      </div>
    </div>
  );
}

// Scanner
function ScannerModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#000a1e]/90 backdrop-blur-md">
      <div className="w-full max-w-sm relative p-6 text-center">
        <button onClick={onClose} className="absolute top-0 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-error/20 hover:bg-error/30 z-[120]">
          <span className="material-symbols-outlined text-error">close</span>
        </button>
        <p className="text-white/70 text-sm mb-4">Point camera at the QR code</p>
        <div className="bg-black rounded-2xl overflow-hidden border-4 border-secondary/40">
          <div id="qr-reader" className="w-full min-h-[280px]" />
        </div>
        <p className="text-white/40 text-xs mt-3">Deal completes automatically when scanned</p>
      </div>
    </div>
  );
}

// Status config
const ITEM_STATUS: Record<string, { label: string; dot: string; text: string; bar: string }> = {
  pending:   { label: "Awaiting",  dot: "bg-on-surface-variant/40", text: "text-on-surface-variant", bar: "border-l-outline-variant/30" },
  accepted:  { label: "Accepted",  dot: "bg-secondary",             text: "text-secondary",          bar: "border-l-secondary" },
  rented:    { label: "Active",    dot: "bg-blue-500",              text: "text-blue-600",           bar: "border-l-blue-500" },
  returning: { label: "Returning", dot: "bg-error",                 text: "text-error",              bar: "border-l-error" },
  completed: { label: "Complete",  dot: "bg-secondary/50",          text: "text-secondary",          bar: "border-l-secondary/40" },
  declined:  { label: "Declined",  dot: "bg-error/40",              text: "text-error",              bar: "border-l-error/30" },
};

// ── Main Component ─────────────────────────────────────────────────────────────
export default function DashboardClient({
  profile,
  items,
  madeRequests,
  receivedRequests,
  myTaskRequests = [],
  helpingWithTasks = [],
  focusedDealId,
  focusedDealType,
  initialTab,
  openScanner = false,
}: {
  profile: Profile;
  items: Item[];
  madeRequests: RequestWithRelations[];
  receivedRequests: RequestWithRelations[];
  myTaskRequests?: (Task & { task_claims?: (TaskClaim & { profiles: Profile | null })[] })[];
  helpingWithTasks?: (TaskClaim & { tasks?: (Task & { profiles: Profile | null }) | null })[];
  focusedDealId?: string;
  focusedDealType?: "item" | "task";
  initialTab?: DealTab;
  openScanner?: boolean;
}) {
  const resolveTab = (): DealTab => {
    if (initialTab) return initialTab;
    if (!focusedDealId) return "received";
    if (focusedDealType === "task") return helpingWithTasks.some(c => c.tasks?.id === focusedDealId) ? "helping_with" : "task_requests";
    if (focusedDealType === "item") return madeRequests.some(r => r.id === focusedDealId) ? "made" : "received";
    if (madeRequests.some(r => r.id === focusedDealId)) return "made";
    if (receivedRequests.some(r => r.id === focusedDealId)) return "received";
    if (myTaskRequests.some(t => t.id === focusedDealId)) return "task_requests";
    if (helpingWithTasks.some(c => c.tasks?.id === focusedDealId)) return "helping_with";
    return "received";
  };

  const [activeTab, setActiveTab] = useState<DealTab>(resolveTab);
  const [localMade, setLocalMade] = useState<RequestWithRelations[]>(madeRequests);
  const [localReceived, setLocalReceived] = useState<RequestWithRelations[]>(receivedRequests);
  const [localTaskReqs, setLocalTaskReqs] = useState(myTaskRequests);
  const [localHelping, setLocalHelping] = useState(helpingWithTasks);
  const [showQr, setShowQr] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState<string | null>(null);
  const [confirmScan, setConfirmScan] = useState<{ dealId: string; title: string; body: string; reward?: number; rewardType?: string } | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const router = useRouter();
  const haptics = useHaptics();

  useEffect(() => {
    if (!focusedDealId) return;
    setActiveTab(resolveTab());
    const t = setTimeout(() => {
      document.getElementById(`deal-${focusedDealId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    if (openScanner) setShowScanner(focusedDealId);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedDealId, openScanner]);

  const focused = (id?: string | null) => Boolean(id && focusedDealId === id);

  // QR confirm
  type HelpingEntry = TaskClaim & { tasks?: (Task & { profiles: Profile | null }) | null };
  type TaskReqEntry = Task & { task_claims?: (TaskClaim & { profiles: Profile | null })[] };

  const handleQRConfirm = useCallback(async (scanned: string, expected: string) => {
    if (scanned !== expected) { haptics.error(); toast.error("Wrong QR code for this deal."); return; }
    try {
      const supabase = createClient();
      const isTask = localTaskReqs.some((t: TaskReqEntry) => t.id === expected) || localHelping.some((c: HelpingEntry) => c.tasks?.id === expected);
      const itemReq = localReceived.find((r: RequestWithRelations) => r.id === expected) ?? localMade.find((r: RequestWithRelations) => r.id === expected);

      if (isTask) {
        const { error } = await supabase.rpc("verify_qr_handshake", { p_deal_id: expected, p_deal_type: "task", p_qr_data: scanned, p_action: null });
        if (error) { haptics.error(); toast.error(error.message || "Could not complete."); return; }
        haptics.success(); toast.success("Task completed! Karma awarded 🎉");
        setLocalTaskReqs((prev: TaskReqEntry[]) => prev.map((t: TaskReqEntry) => t.id === expected ? { ...t, status: "completed" as const } : t));
        setLocalHelping((prev: HelpingEntry[]) => prev.map((c: HelpingEntry) => c.tasks?.id === expected ? { ...c, tasks: c.tasks ? { ...c.tasks, status: "completed" as const } : c.tasks } : c));
      } else if (itemReq) {
        const { data, error } = await supabase.rpc("verify_qr_handshake", {
          p_deal_id: itemReq.id, p_deal_type: "item", p_qr_data: scanned,
          p_action: itemReq.status === "accepted" ? "handoff" : "return",
        });
        if (error) { haptics.error(); toast.error(error.message || "Could not complete."); return; }
        const next = (data as { status?: string } | null)?.status;
        if (next === "rented") {
          haptics.success(); toast.success("Handoff confirmed! Rental started.");
          setLocalReceived((p: RequestWithRelations[]) => p.map((r: RequestWithRelations) => r.id === expected ? { ...r, status: "rented" } : r));
          setLocalMade((p: RequestWithRelations[]) => p.map((r: RequestWithRelations) => r.id === expected ? { ...r, status: "rented" } : r));
        } else if (next === "completed") {
          haptics.success(); toast.success("Item returned! Deal complete 🎉");
          setLocalReceived((p: RequestWithRelations[]) => p.map((r: RequestWithRelations) => r.id === expected ? { ...r, status: "completed" } : r));
          setLocalMade((p: RequestWithRelations[]) => p.map((r: RequestWithRelations) => r.id === expected ? { ...r, status: "completed" } : r));
        }
      }
    } catch { toast.error("Action could not be completed."); }
  }, [localTaskReqs, localHelping, localReceived, localMade, haptics]);

  // Scanner effect
  useEffect(() => {
    if (!showScanner) return;
    const qr = new Html5Qrcode("qr-reader");
    qr.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 240, height: 240 } },
      (decoded: string) => { setShowScanner(null); handleQRConfirm(decoded, showScanner); }, () => {}
    ).catch((err: unknown) => { console.error(err); toast.error("Camera access denied."); });
    return () => { if (qr.isScanning) qr.stop().catch(console.error); else qr.clear(); };
  }, [showScanner, handleQRConfirm]);

  // Actions
  async function handleUpdateStatus(requestId: string, action: "accepted" | "declined") {
    setLoadingId(requestId);
    const { error } = await createClient().rpc("respond_item_request", { p_request_id: requestId, p_action: action });
    setLoadingId(null);
    if (error) { toast.error(error.message || "Could not update status."); return; }
    toast.success(action === "accepted" ? "Deal accepted! 🤝" : "Deal declined.");
    setLocalReceived((p: RequestWithRelations[]) => p.map((r: RequestWithRelations) => r.id === requestId ? { ...r, status: action } : r));
  }

  async function handleCancelHelp(claimId: string) {
    setLoadingId(claimId);
    const { data, error } = await createClient().rpc("cancel_task_claim", { c_id: claimId, u_id: profile.id });
    setLoadingId(null);
    if (error) { toast.error("Could not cancel."); return; }
    const res = data as CancelTaskClaimResult | null;
    if (res?.penalty_applied) toast.error("Cancelled — 10% escrow penalty applied.");
    else toast.success("Cancelled. Escrow refunded.");
    setLocalHelping((p: HelpingEntry[]) => p.filter((c: HelpingEntry) => c.id !== claimId));
  }

  async function handleInitiateReturn(requestId: string) {
    setLoadingId(requestId);
    const { error } = await createClient().rpc("initiate_item_return", { p_request_id: requestId });
    setLoadingId(null);
    if (error) { toast.error(error.message || "Could not initiate return."); return; }
    toast.success("Return initiated!");
    setLocalMade((p: RequestWithRelations[]) => p.map((r: RequestWithRelations) => r.id === requestId ? { ...r, status: "returning" } : r));
  }

  async function handleMessageUser(req: RequestWithRelations) {
    const { data, error } = await createClient().rpc("create_item_conversation", { p_request_id: req.id });
    const convId = (data as { conversation_id?: string } | null)?.conversation_id;
    if (error || !convId) { toast.error("Could not open chat."); return; }
    router.push(`/messages?id=${convId}`);
  }

  async function handleMessageForTask(taskId: string) {
  const { data, error } = await createClient().rpc("get_task_conversation", {
    p_task_id: taskId,
  });
  const convId = (data as { conversation_id?: string } | null)?.conversation_id;
  if (error || !convId) {
    toast.error("Could not open chat.");
    return;
  }
  router.push(`/messages?id=${convId}`);
}

  // Stats
  const pendingCount = localReceived.filter((r: RequestWithRelations) => r.status === "pending").length;
  const activeRentals = items.filter((i: Item) => i.status === "rented").length;
  const activeEarnings = items.filter((i: Item) => i.status === "rented").reduce((a: number, c: Item) => a + (c.price_amount || 0), 0);
  const helpingCount = localHelping.filter((c: HelpingEntry) => c.tasks?.status === "claimed").length;

  const tabs: { id: DealTab; label: string; icon: string; badge?: number }[] = [
    { id: "received",      label: "Incoming",    icon: "inbox",     badge: pendingCount },
    { id: "made",          label: "Requested",   icon: "send" },
    { id: "my_listings",   label: "Listings",    icon: "storefront", badge: items.length },
    { id: "task_requests", label: "My Tasks",    icon: "task_alt",   badge: localTaskReqs.filter((t: TaskReqEntry) => t.status === "claimed").length },
    { id: "helping_with",  label: "Helping",     icon: "handshake",  badge: helpingCount },
  ];

  // ── Card: Item request ─────────────────────────────────────────────────────
  const renderItemCard = (req: RequestWithRelations, isLenderView: boolean) => {
    const item = req.items;
    if (!item) return null;
    const other = isLenderView ? req.profiles : item.profiles;
    const isLender = item.user_id === profile.id;
    const isBorrower = req.requester_id === profile.id;
    const canManage = isLenderView && isLender;
    const st = ITEM_STATUS[req.status ?? "pending"] ?? ITEM_STATUS.pending;
    const loading = loadingId === req.id;

    return (
      <div id={`deal-${req.id}`} key={req.id}
        className={`bg-surface-container-lowest rounded-2xl overflow-hidden border border-outline-variant/10 border-l-4 ${st.bar} transition-all ${focused(req.id) ? "ring-2 ring-secondary/70 shadow-[0_0_0_4px_rgba(0,110,12,0.10)]" : "shadow-sm"}`}>
        <div className="p-4">
          <div className="flex gap-3 mb-3">
            <div className="w-16 h-16 rounded-xl bg-surface-container overflow-hidden flex-shrink-0 relative">
              {item.images?.[0]
                ? <Image src={item.images[0]} alt={item.title} fill sizes="64px" className="object-cover" />
                : <div className="w-full h-full flex items-center justify-center"><span className="material-symbols-outlined text-on-surface-variant/40 text-2xl">inventory_2</span></div>}
            </div>
            <div className="flex-grow min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${st.dot}`} />
                <span className={`text-[9px] font-bold uppercase tracking-widest ${st.text}`}>{st.label}</span>
                <span className="text-[9px] text-on-surface-variant/40 ml-auto">{timeAgo(req.created_at)}</span>
              </div>
              <h3 className="font-headline font-bold text-primary text-sm leading-tight truncate">{item.title}</h3>
              <div className="flex items-center gap-2 mt-1.5">
                <Avatar url={other?.avatar_url} name={other?.full_name} size={20} />
                <span className="text-xs text-on-surface-variant truncate">{other?.full_name ?? "Unknown"}</span>
                <span className="text-on-surface-variant/30 text-xs">·</span>
                <span className="text-xs text-on-surface-variant">{req.duration_days}d</span>
              </div>
            </div>
          </div>

          <DealStepper status={req.status ?? "pending"} />

          <div className="flex gap-2 mt-3 flex-wrap">
            {req.status === "pending" && canManage && (
              <>
                <button disabled={loading} onClick={() => handleUpdateStatus(req.id, "accepted")}
                  className="flex-1 bg-primary text-on-primary py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-1">
                  {loading ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><span className="material-symbols-outlined text-[14px]">check</span>Accept</>}
                </button>
                <button disabled={loading} onClick={() => handleUpdateStatus(req.id, "declined")}
                  className="border border-outline-variant/30 text-on-surface-variant py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider active:scale-95 transition-transform disabled:opacity-50">
                  Decline
                </button>
              </>
            )}
            {req.status === "accepted" && canManage && (
              <button onClick={() => setConfirmScan({ dealId: req.id, title: "Confirm Handoff", body: "Scan the borrower's QR to mark the item as rented." })}
                className="flex-1 bg-secondary text-on-secondary py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider active:scale-95 transition-transform flex items-center justify-center gap-1">
                <span className="material-symbols-outlined text-[14px]">qr_code_scanner</span>Scan Borrower QR
              </button>
            )}
            {req.status === "accepted" && isBorrower && (
              <button onClick={() => setShowQr(req.id)}
                className="flex-1 bg-primary text-on-primary py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider active:scale-95 transition-transform flex items-center justify-center gap-1">
                <span className="material-symbols-outlined text-[14px]">qr_code_2</span>Show My QR
              </button>
            )}
            {req.status === "rented" && isBorrower && (
              <button disabled={loadingId === req.id} onClick={() => handleInitiateReturn(req.id)}
                className="flex-1 bg-primary text-on-primary py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-1">
                <span className="material-symbols-outlined text-[14px]">assignment_return</span>Initiate Return
              </button>
            )}
            {req.status === "returning" && isBorrower && (
              <button onClick={() => setConfirmScan({ dealId: req.id, title: "Confirm Return", body: "Scan the lender's QR to finalise the return.",
                })
              }
              className="flex-1 bg-secondary text-on-secondary py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider active:scale-95 transition-transform flex items-center justify-center gap-1"
            >
              <span className="material-symbols-outlined text-[14px]">
                qr_code_scanner
              </span>
              Scan Lender QR
            </button>
          )}

          {req.status === "returning" && isLender && (
            <button
              onClick={() => setShowQr(req.id)}
              className="flex-1 bg-primary text-on-primary py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider active:scale-95 transition-transform flex items-center justify-center gap-1"
            >
              <span className="material-symbols-outlined text-[14px]">
                qr_code_2
              </span>
              Show Return QR
            </button>
          )}
            {["pending", "accepted", "rented", "returning"].includes(req.status ?? "") && (
              <button onClick={() => handleMessageUser(req)}
                className="border border-outline-variant/20 text-secondary py-2.5 px-3 rounded-xl text-xs font-bold active:scale-95 transition-transform flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">chat</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Card: Task I posted ────────────────────────────────────────────────────
  const renderMyTaskCard = (task: Task & { task_claims?: (TaskClaim & { profiles: Profile | null })[] }) => {
    const helper = task.task_claims?.[0]?.profiles;
    const dl = deadlineLabel(task.deadline);
    const isOverdue = task.deadline && new Date(task.deadline) < new Date();

    return (
      <div id={`deal-${task.id}`} key={task.id}
        className={`bg-surface-container-lowest rounded-2xl overflow-hidden border border-outline-variant/10 border-l-4 ${task.status === "claimed" ? "border-l-secondary" : task.status === "completed" ? "border-l-secondary/30" : "border-l-outline-variant/30"} transition-all ${focused(task.id) ? "ring-2 ring-secondary/70" : "shadow-sm"}`}>
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-grow min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                  task.category === "Academic" ? "bg-primary/10 text-primary" :
                  task.category === "Delivery" ? "bg-secondary/10 text-secondary" :
                  "bg-surface-container-high text-on-surface-variant"}`}>
                  {task.category ?? "General"}
                </span>
                <span className={`text-[9px] font-bold uppercase ${isOverdue ? "text-error" : "text-on-surface-variant/50"}`}>{dl}</span>
              </div>
              <h3 className="font-headline font-bold text-primary text-sm leading-tight">{task.title}</h3>
            </div>
            <div className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider flex-shrink-0 ${
              task.status === "open" ? "bg-error/10 text-error" :
              task.status === "claimed" ? "bg-secondary-container text-on-secondary-container" :
              "bg-primary/10 text-primary"}`}>
              {task.status}
            </div>
          </div>

          <div className="flex items-center gap-1.5 mb-2">
            <span className="material-symbols-outlined text-secondary text-[14px]">toll</span>
            <span className="text-xs font-bold text-secondary">{task.reward_amount} {task.reward_type === "karma" ? "CP" : "₹"}</span>
          </div>

          <TaskStepper status={task.status ?? "open"} />

          {helper && task.status !== "open" && (
            <div className="flex items-center gap-2 mt-2 py-2 border-t border-outline-variant/10">
              <Avatar url={helper.avatar_url} name={helper.full_name} size={24} />
              <div className="flex-grow min-w-0">
                <p className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant/60">{task.status === "completed" ? "Completed by" : "Helper"}</p>
                <p className="text-xs font-semibold text-primary truncate">{helper.full_name}</p>
              </div>
              {task.status === "claimed" && (
                <button onClick={() => handleMessageForTask(task.id)} className="text-secondary text-[10px] font-bold uppercase tracking-wider flex items-center gap-0.5">
                  Chat <span className="material-symbols-outlined text-[12px]">chevron_right</span>
                </button>
              )}
            </div>
          )}

          {task.status === "claimed" && (
            <button onClick={() => setConfirmScan({
              dealId: task.id, title: "Confirm Task Done",
              body: "Scan your helper's QR code to confirm completion and release their reward.",
              reward: task.reward_amount ?? 0, rewardType: task.reward_type ?? "karma",
            })} className="mt-3 w-full bg-primary text-on-primary py-3 rounded-2xl font-bold text-sm uppercase tracking-wider active:scale-95 transition-transform flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[16px]">qr_code_scanner</span>
              Scan to Confirm Done
            </button>
          )}
        </div>
      </div>
    );
  };

  // ── Card: Helping with ─────────────────────────────────────────────────────
  const renderHelpingCard = (claim: TaskClaim & { tasks?: (Task & { profiles: Profile | null }) | null }) => {
    const task = claim.tasks;
    if (!task) return null;
    const creator = task.profiles;
    const loading = loadingId === claim.id;

    return (
      <div id={`deal-${task.id}`} key={claim.id}
        className={`bg-surface-container-lowest rounded-2xl overflow-hidden border border-outline-variant/10 border-l-4 ${task.status === "claimed" ? "border-l-secondary" : "border-l-secondary/30"} transition-all ${focused(task.id) ? "ring-2 ring-secondary/70" : "shadow-sm"}`}>
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-grow min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-surface-container-high text-on-surface-variant">{task.category ?? "General"}</span>
                <span className="text-[9px] font-bold text-on-surface-variant/50">{deadlineLabel(task.deadline)}</span>
              </div>
              <h3 className="font-headline font-bold text-primary text-sm leading-tight">{task.title}</h3>
            </div>
            <div className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider flex-shrink-0 ${
              task.status === "claimed" ? "bg-secondary-container text-on-secondary-container" : "bg-primary/10 text-primary"}`}>
              {task.status}
            </div>
          </div>

          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-secondary text-[14px]">toll</span>
              <span className="text-xs font-bold text-secondary">{task.reward_amount} {task.reward_type === "karma" ? "CP" : "₹"}</span>
            </div>
            {task.status === "claimed" && (
              <span className="text-[9px] text-error font-bold uppercase">{Math.floor((task.reward_amount ?? 0) * 0.1)} CP escrow locked</span>
            )}
          </div>

          <TaskStepper status={task.status ?? "open"} />

          {creator && (
            <div className="flex items-center gap-2 mt-2 py-2 border-t border-outline-variant/10">
              <Avatar url={creator.avatar_url} name={creator.full_name} size={24} />
              <div className="flex-grow min-w-0">
                <p className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant/60">Requester</p>
                <p className="text-xs font-semibold text-primary truncate">{creator.full_name}</p>
              </div>
            </div>
          )}

          {task.description && (
            <p className="text-xs text-on-surface-variant mt-2 line-clamp-2 leading-relaxed">{task.description}</p>
          )}

          {task.status === "claimed" && (
            <div className="flex gap-2 mt-3">
              <button onClick={() => setShowQr(task.id)}
                className="flex-1 bg-primary text-on-primary py-3 rounded-2xl font-bold text-xs uppercase tracking-wider active:scale-95 transition-transform flex items-center justify-center gap-1">
                <span className="material-symbols-outlined text-[14px]">qr_code_2</span>My Proof QR
              </button>
              <button onClick={() => handleMessageForTask(task.id)}
                className="border border-outline-variant/20 text-secondary py-3 px-3 rounded-2xl font-bold text-xs active:scale-95 transition-transform">
                <span className="material-symbols-outlined text-[14px]">chat</span>
              </button>
              <button disabled={loading} onClick={() => handleCancelHelp(claim.id)}
                className="border border-error/30 text-error py-3 px-3 rounded-2xl font-bold text-xs active:scale-95 transition-transform disabled:opacity-50">
                {loading ? <span className="w-3 h-3 border-2 border-error/30 border-t-error rounded-full animate-spin" /> : <span className="material-symbols-outlined text-[14px]">cancel</span>}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Card: Listing ──────────────────────────────────────────────────────────
  const renderListingCard = (item: Item) => (
    <div key={item.id} className="bg-surface-container-lowest rounded-2xl overflow-hidden border border-outline-variant/10 shadow-sm flex gap-3 p-4">
      <div className="w-16 h-16 rounded-xl bg-surface-container overflow-hidden flex-shrink-0 relative">
        {(item.thumbnail_url || item.images?.[0])
          ? <Image src={item.thumbnail_url ?? item.images![0]} alt={item.title} fill sizes="64px" className="object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><span className="material-symbols-outlined text-on-surface-variant/30 text-2xl">inventory_2</span></div>}
      </div>
      <div className="flex-grow min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-headline font-bold text-primary text-sm leading-tight truncate">{item.title}</h3>
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider flex-shrink-0 ${item.is_hidden ? "bg-surface-container-highest text-on-surface-variant" : item.status === "rented" ? "bg-blue-100 text-blue-600" : "bg-secondary/10 text-secondary"}`}>
            {item.is_hidden ? "Hidden" : item.status === "rented" ? "Rented" : "Live"}
          </span>
        </div>
        {item.price_type && <p className="text-xs text-on-surface-variant mb-2">{item.price_type}{item.price_amount ? ` · ${item.price_amount}${item.price_type === "Karma" ? " CP" : " ₹"}` : ""}</p>}
        <Link href={`/items/${item.id}/edit`} className="inline-flex items-center gap-1 text-xs font-bold text-primary border border-outline-variant/20 px-3 py-1.5 rounded-xl active:scale-95 transition-transform">
          <span className="material-symbols-outlined text-[12px]">edit</span>Edit
        </Link>
      </div>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
  className="h-[calc(100dvh-4rem)] md:h-[calc(100dvh-5rem)] overflow-y-auto hide-scrollbar w-full"
  id="dashboard-scroll"
>
      {showQr && <QRModal dealId={showQr} userId={profile.id} onClose={() => setShowQr(null)} />}
      {showScanner && <ScannerModal onClose={() => setShowScanner(null)} />}
      <ScanConfirmSheet
        data={confirmScan ? { title: confirmScan.title, body: confirmScan.body, reward: confirmScan.reward, rewardType: confirmScan.rewardType } : null}
        onCancel={() => setConfirmScan(null)}
        onConfirm={() => { const id = confirmScan!.dealId; setConfirmScan(null); setShowScanner(id); }}
      />

      <div className="px-4 max-w-2xl mx-auto pb-32">
        {/* Header */}
        <div className="pt-6 pb-4">
          <h1 className="font-headline text-2xl font-bold text-primary">Activity</h1>
          <p className="text-on-surface-variant text-sm">Your deals, tasks &amp; listings</p>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="bg-primary rounded-2xl p-3 text-center">
            <p className="text-on-primary/60 text-[9px] uppercase font-bold tracking-widest mb-0.5">Earnings</p>
            <p className="text-on-primary font-headline font-bold text-lg leading-tight">{activeEarnings}<span className="text-xs font-bold text-on-primary/60 ml-0.5">CP</span></p>
          </div>
          <div className="bg-surface-container-lowest rounded-2xl p-3 text-center border border-outline-variant/10">
            <p className="text-on-surface-variant/60 text-[9px] uppercase font-bold tracking-widest mb-0.5">Rented Out</p>
            <p className="text-primary font-headline font-bold text-lg leading-tight">{activeRentals}<span className="text-xs font-bold text-on-surface-variant/40 ml-0.5">items</span></p>
          </div>
          <div className="bg-surface-container-lowest rounded-2xl p-3 text-center border border-outline-variant/10">
            <p className="text-on-surface-variant/60 text-[9px] uppercase font-bold tracking-widest mb-0.5">Helping</p>
            <p className="text-primary font-headline font-bold text-lg leading-tight">{helpingCount}<span className="text-xs font-bold text-on-surface-variant/40 ml-0.5">tasks</span></p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-4 -mx-1 px-1 pb-1">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl font-bold text-xs uppercase tracking-wide whitespace-nowrap flex-shrink-0 transition-all active:scale-95 ${
                activeTab === tab.id ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"}`}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{tab.icon}</span>
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${activeTab === tab.id ? "bg-on-primary/20 text-on-primary" : "bg-error text-white"}`}>{tab.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex flex-col gap-3">
          {activeTab === "received" && (localReceived.length > 0 ? localReceived.map((r: RequestWithRelations) => renderItemCard(r, true)) : <EmptyState icon="inbox" text="No incoming requests yet. List items to start lending." cta="Go to Hub" ctaHref="/hub" />)}
          {activeTab === "made" && (localMade.length > 0 ? localMade.map((r: RequestWithRelations) => renderItemCard(r, false)) : <EmptyState icon="send" text="You haven't requested any items yet." cta="Browse Hub" ctaHref="/hub" />)}
          {activeTab === "my_listings" && (items.length > 0 ? items.map(renderListingCard) : <EmptyState icon="storefront" text="No listings yet. Share items with your campus." cta="Post an Item" ctaHref="/post" />)}
          {activeTab === "task_requests" && (localTaskReqs.length > 0 ? localTaskReqs.map((t: TaskReqEntry) => renderMyTaskCard(t)) : <EmptyState icon="task_alt" text="No tasks posted yet." cta="Browse Tasks" ctaHref="/tasks" />)}
          {activeTab === "helping_with" && (localHelping.length > 0 ? localHelping.map((c: HelpingEntry) => renderHelpingCard(c)) : <EmptyState icon="handshake" text="Not helping with any tasks right now." cta="Browse Tasks" ctaHref="/tasks" />)}
        </div>
      </div>
    </div>
  );
}
