import { BoneyardSkeleton } from "./BoneyardSkeleton";

type Variant =
  | "home"
  | "hub"
  | "search"
  | "tasks"
  | "deals"
  | "messages"
  | "notifications"
  | "form"
  | "profile"
  | "item"
  | "auth";

const surfaceCard = "rounded-3xl border border-outline-variant/15 bg-surface-container-lowest shadow-[0px_12px_32px_rgba(0,10,30,0.06)]";
const muted = "bg-surface-container-high";
const mutedLow = "bg-surface-container-low";
const mutedHigh = "bg-surface-container-highest";

export function PageSkeleton({ name, variant = "hub" }: { name: string; variant?: Variant }) {
  return (
    <BoneyardSkeleton name={`page-${name}`} loading>
      {getSkeletonContent(variant)}
    </BoneyardSkeleton>
  );
}

export function CardGridSkeleton({ name = "card-grid" }: { name?: string }) {
  return (
    <BoneyardSkeleton name={name} loading>
      <ItemTaskGrid />
    </BoneyardSkeleton>
  );
}

function getSkeletonContent(variant: Variant) {
  if (variant === "home") return <HomeSkeleton />;
  if (variant === "hub") return <HubSkeleton />;
  if (variant === "search") return <SearchSkeleton />;
  if (variant === "tasks") return <TasksSkeleton />;
  if (variant === "deals") return <DealsSkeleton />;
  if (variant === "messages") return <MessagesSkeleton />;
  if (variant === "notifications") return <NotificationsSkeleton />;
  if (variant === "form") return <FormSkeleton />;
  if (variant === "profile") return <ProfileSkeleton />;
  if (variant === "item") return <ItemDetailSkeleton />;
  if (variant === "auth") return <AuthSkeleton />;
  return <HubSkeleton />;
}

function PageFrame({ children, narrow = false }: { children: React.ReactNode; narrow?: boolean }) {
  return (
    <div className={`min-h-dvh w-full bg-surface px-4 pb-24 pt-24 md:px-8 ${narrow ? "mx-auto max-w-4xl" : "mx-auto max-w-7xl"}`}>
      {children}
    </div>
  );
}

function Pill({ className = "" }: { className?: string }) {
  return <div className={`rounded-full ${muted} ${className}`} />;
}

function Block({ className = "" }: { className?: string }) {
  return <div className={`rounded-2xl ${muted} ${className}`} />;
}

function Avatar({ size = "h-10 w-10" }: { size?: string }) {
  return <div className={`${size} shrink-0 rounded-full ${mutedHigh}`} />;
}

function HomeSkeleton() {
  return (
    <PageFrame>
      <section className="overflow-hidden rounded-[2rem] bg-primary p-7 text-white md:p-10">
        <div className="max-w-2xl space-y-5">
          <div className="h-4 w-28 rounded-full bg-white/25" />
          <div className="h-12 w-4/5 rounded-2xl bg-white/25" />
          <div className="h-4 w-full rounded-full bg-white/15" />
          <div className="h-4 w-3/5 rounded-full bg-white/15" />
          <div className="flex gap-3 pt-2">
            <div className="h-12 w-36 rounded-full bg-secondary/45" />
            <div className="h-12 w-32 rounded-full bg-white/15" />
          </div>
        </div>
      </section>

      <section className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
        {["Borrow", "Help", "Earn"].map((label) => (
          <article key={label} className={`${surfaceCard} p-5`}>
            <div className="mb-5 h-12 w-12 rounded-2xl bg-primary/15" />
            <Pill className="mb-3 h-5 w-28" />
            <Pill className="mb-2 h-3 w-full" />
            <Pill className="h-3 w-2/3" />
          </article>
        ))}
      </section>

      <section className="mt-9">
        <div className="mb-5 flex items-center justify-between">
          <Pill className="h-8 w-44" />
          <Pill className="h-8 w-24" />
        </div>
        <ItemTaskGrid />
      </section>
    </PageFrame>
  );
}

function HubSkeleton() {
  return (
    <PageFrame>
      <section className="rounded-[2rem] bg-primary p-6 text-white md:p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <div className="mb-3 h-4 w-28 rounded-full bg-white/20" />
            <div className="h-9 w-64 rounded-full bg-white/25" />
          </div>
          <div className="hidden h-12 w-12 rounded-2xl bg-white/15 md:block" />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[170px_1fr_130px]">
          <div className="h-14 rounded-2xl bg-white/15" />
          <div className="h-14 rounded-2xl bg-white/15" />
          <div className="h-14 rounded-2xl bg-secondary/40" />
        </div>
      </section>

      <div className="mt-7 flex gap-3 overflow-hidden">
        {["All", "Items", "Tasks", "Free", "Urgent", "Credits"].map((tab, i) => (
          <div key={tab} className={`h-10 shrink-0 rounded-full ${i === 0 ? "w-20 bg-primary/20" : "w-24 bg-surface-container-low"}`} />
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-7 lg:grid-cols-[260px_1fr]">
        <aside className="hidden space-y-4 lg:block">
          <FilterPanel />
          <CampusCard />
        </aside>
        <main>
          <div className="mb-5 flex items-center justify-between">
            <Pill className="h-7 w-40" />
            <Pill className="h-9 w-28" />
          </div>
          <ItemTaskGrid />
        </main>
      </div>
    </PageFrame>
  );
}

function SearchSkeleton() {
  return (
    <PageFrame>
      <section className={`${surfaceCard} p-5 md:p-7`}>
        <Pill className="mb-5 h-8 w-56" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_150px]">
          <Block className="h-14" />
          <Block className="h-14 bg-primary/20" />
        </div>
      </section>
      <div className="mt-7 flex gap-3 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => <Pill key={i} className="h-10 w-24 shrink-0" />)}
      </div>
      <section className="mt-8">
        <div className="mb-5 flex items-center justify-between">
          <Pill className="h-7 w-48" />
          <Pill className="h-7 w-20" />
        </div>
        <ItemTaskGrid />
      </section>
    </PageFrame>
  );
}

function TasksSkeleton() {
  return (
    <PageFrame>
      <section className="rounded-[2rem] bg-primary p-6 text-white md:p-8">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div className="space-y-4">
            <div className="h-9 w-60 rounded-full bg-white/25" />
            <div className="h-4 w-80 max-w-full rounded-full bg-white/15" />
          </div>
          <div className="h-12 w-40 rounded-full bg-secondary/45" />
        </div>
      </section>

      <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <article key={i} className={`${surfaceCard} p-4`}>
            <Pill className="mb-3 h-4 w-16" />
            <Pill className="h-7 w-20" />
          </article>
        ))}
      </div>

      <section className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => <TaskCard key={i} urgent={i === 0} />)}
      </section>
    </PageFrame>
  );
}

function DealsSkeleton() {
  return (
    <PageFrame>
      <section className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Pill className="mb-4 h-4 w-28" />
          <Pill className="h-10 w-64" />
        </div>
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => <Pill key={i} className="h-10 w-28 shrink-0" />)}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
        <main className="space-y-5">
          <DealSection titleWidth="w-36" rows={3} />
          <DealSection titleWidth="w-44" rows={2} />
          <DealSection titleWidth="w-32" rows={2} />
        </main>
        <aside className="space-y-5">
          <QrActionCard />
          <CampusCard />
        </aside>
      </div>
    </PageFrame>
  );
}

function MessagesSkeleton() {
  return (
    <div className="mx-auto flex h-dvh max-w-7xl gap-5 bg-surface px-4 pb-20 pt-24 md:px-6 md:pb-6">
      <aside className={`${surfaceCard} flex w-full flex-col p-5 md:w-96`}>
        <div className="mb-5 flex items-center justify-between">
          <Pill className="h-8 w-36" />
          <div className="h-10 w-10 rounded-2xl bg-primary/15" />
        </div>
        <Block className="mb-5 h-12" />
        <div className="space-y-4 overflow-hidden">
          {Array.from({ length: 7 }).map((_, i) => <ConversationRow key={i} active={i === 0} />)}
        </div>
      </aside>

      <section className={`${surfaceCard} hidden min-w-0 flex-1 flex-col md:flex`}>
        <header className="flex items-center justify-between border-b border-outline-variant/10 p-5">
          <div className="flex items-center gap-3">
            <Avatar />
            <div>
              <Pill className="mb-2 h-4 w-32" />
              <Pill className="h-3 w-20" />
            </div>
          </div>
          <Pill className="h-9 w-24" />
        </header>
        <main className="flex-1 space-y-4 overflow-hidden p-6">
          <ChatBubble width="w-1/2" />
          <ChatBubble width="ml-auto w-3/5" self />
          <ChatBubble width="w-2/5" />
          <ChatBubble width="ml-auto w-1/2" self />
          <ChatBubble width="w-3/5" />
        </main>
        <footer className="border-t border-outline-variant/10 p-5">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-surface-container-low" />
            <Block className="h-12 flex-1" />
            <div className="h-12 w-12 rounded-2xl bg-primary/20" />
          </div>
        </footer>
      </section>
    </div>
  );
}

function NotificationsSkeleton() {
  return (
    <PageFrame narrow>
      <section className="mb-6 rounded-[2rem] bg-primary p-6 text-white md:p-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="mb-3 h-9 w-52 rounded-full bg-white/25" />
            <div className="h-4 w-72 max-w-full rounded-full bg-white/15" />
          </div>
          <div className="h-10 w-28 rounded-full bg-secondary/40" />
        </div>
      </section>
      <div className="space-y-3">
        <NotificationGroup />
        <NotificationGroup compact />
        {Array.from({ length: 5 }).map((_, i) => <NotificationRow key={i} unread={i < 2} />)}
      </div>
    </PageFrame>
  );
}

function FormSkeleton() {
  return (
    <PageFrame narrow>
      <section className={`${surfaceCard} p-6 md:p-8`}>
        <Pill className="mb-3 h-9 w-56" />
        <Pill className="mb-8 h-4 w-80 max-w-full" />
        <div className="space-y-5">
          <FieldSkeleton label="w-24" />
          <FieldSkeleton label="w-32" tall />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FieldSkeleton label="w-20" />
            <FieldSkeleton label="w-28" />
          </div>
          <UploadSkeleton />
          <div className="flex gap-3 pt-2">
            <Block className="h-12 flex-1 bg-primary/20" />
            <Block className="h-12 w-32" />
          </div>
        </div>
      </section>
    </PageFrame>
  );
}

function ProfileSkeleton() {
  return (
    <PageFrame>
      <section className="rounded-[2rem] bg-primary p-7 text-white md:p-9">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-5">
            <div className="h-24 w-24 rounded-full bg-white/20" />
            <div className="space-y-3">
              <div className="h-8 w-56 rounded-full bg-white/25" />
              <div className="h-4 w-40 rounded-full bg-white/15" />
              <div className="h-8 w-28 rounded-full bg-secondary/40" />
            </div>
          </div>
          <div className="h-12 w-32 rounded-full bg-white/15" />
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <article key={i} className={`${surfaceCard} p-5`}>
            <Pill className="mb-4 h-4 w-20" />
            <Pill className="h-9 w-24" />
          </article>
        ))}
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className={`${surfaceCard} p-6`}>
          <Pill className="mb-6 h-7 w-40" />
          <div className="space-y-4">
            <FieldSkeleton label="w-24" />
            <FieldSkeleton label="w-20" tall />
            <FieldSkeleton label="w-28" />
          </div>
        </div>
        <div className={`${surfaceCard} p-6`}>
          <Pill className="mb-6 h-7 w-36" />
          {Array.from({ length: 4 }).map((_, i) => <MiniActivity key={i} />)}
        </div>
      </section>
    </PageFrame>
  );
}

function ItemDetailSkeleton() {
  return (
    <PageFrame>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_430px]">
        <section>
          <div className="aspect-square rounded-[2rem] bg-surface-container-high" />
          <div className="mt-4 grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <Block key={i} className="aspect-square" />)}
          </div>
        </section>
        <aside className="space-y-5">
          <section className={`${surfaceCard} p-6`}>
            <Pill className="mb-3 h-4 w-24" />
            <Pill className="mb-4 h-10 w-4/5" />
            <Pill className="mb-2 h-4 w-full" />
            <Pill className="mb-6 h-4 w-3/4" />
            <div className="flex items-center gap-3 border-t border-outline-variant/10 pt-5">
              <Avatar />
              <div className="flex-1">
                <Pill className="mb-2 h-4 w-32" />
                <Pill className="h-3 w-24" />
              </div>
            </div>
          </section>
          <section className={`${surfaceCard} p-6`}>
            <Pill className="mb-5 h-7 w-36" />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => <Block key={i} className="h-20" />)}
            </div>
          </section>
          <Block className="h-14 bg-primary/20" />
        </aside>
      </div>
    </PageFrame>
  );
}

function AuthSkeleton() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface px-5 py-16">
      <section className={`${surfaceCard} w-full max-w-md p-7 md:p-8`}>
        <div className="mx-auto mb-7 h-16 w-16 rounded-3xl bg-primary/15" />
        <Pill className="mx-auto mb-3 h-8 w-48" />
        <Pill className="mx-auto mb-8 h-4 w-64 max-w-full" />
        <div className="space-y-4">
          <FieldSkeleton label="w-24" />
          <FieldSkeleton label="w-20" />
          <Block className="h-12 bg-primary/20" />
          <Pill className="mx-auto h-4 w-40" />
        </div>
      </section>
    </div>
  );
}

function ItemTaskGrid() {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <article key={i} className={`${surfaceCard} overflow-hidden`}>
          <div className="aspect-[4/3] bg-surface-container-high" />
          <div className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <Pill className="h-6 w-24" />
              <Pill className="h-6 w-16 bg-secondary/20" />
            </div>
            <Pill className="mb-3 h-6 w-4/5" />
            <Pill className="mb-2 h-3 w-full" />
            <Pill className="mb-5 h-3 w-2/3" />
            <div className="flex items-center justify-between border-t border-outline-variant/10 pt-4">
              <div className="flex items-center gap-2">
                <Avatar size="h-8 w-8" />
                <Pill className="h-3 w-24" />
              </div>
              <Pill className="h-8 w-20" />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function FilterPanel() {
  return (
    <section className={`${surfaceCard} p-5`}>
      <Pill className="mb-5 h-6 w-28" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-5 w-5 rounded-md bg-surface-container-high" />
            <Pill className="h-4 flex-1" />
          </div>
        ))}
      </div>
    </section>
  );
}

function CampusCard() {
  return (
    <section className="rounded-3xl bg-primary p-5 text-white">
      <div className="mb-4 h-10 w-10 rounded-2xl bg-white/15" />
      <div className="mb-3 h-6 w-32 rounded-full bg-white/25" />
      <div className="mb-2 h-3 w-full rounded-full bg-white/15" />
      <div className="h-3 w-2/3 rounded-full bg-white/15" />
    </section>
  );
}

function TaskCard({ urgent = false }: { urgent?: boolean }) {
  return (
    <article className={`${surfaceCard} p-5`}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="space-y-3">
          <Pill className="h-5 w-24" />
          <Pill className="h-6 w-56 max-w-full" />
        </div>
        <div className={`h-9 w-20 rounded-full ${urgent ? "bg-error/20" : "bg-secondary/20"}`} />
      </div>
      <Pill className="mb-2 h-3 w-full" />
      <Pill className="mb-5 h-3 w-3/4" />
      <div className="flex items-center justify-between border-t border-outline-variant/10 pt-4">
        <div className="flex items-center gap-2">
          <Avatar size="h-8 w-8" />
          <Pill className="h-3 w-28" />
        </div>
        <Pill className="h-9 w-24 bg-primary/15" />
      </div>
    </article>
  );
}

function DealSection({ titleWidth, rows }: { titleWidth: string; rows: number }) {
  return (
    <section className={`${surfaceCard} p-5`}>
      <div className="mb-5 flex items-center justify-between">
        <Pill className={`h-7 ${titleWidth}`} />
        <Pill className="h-8 w-20" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: rows }).map((_, i) => <DealRow key={i} />)}
      </div>
    </section>
  );
}

function DealRow() {
  return (
    <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4">
      <div className="flex items-start gap-4">
        <div className="h-16 w-16 rounded-2xl bg-surface-container-high" />
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center justify-between gap-3">
            <Pill className="h-5 w-44 max-w-full" />
            <Pill className="h-6 w-20" />
          </div>
          <Pill className="mb-2 h-3 w-full" />
          <Pill className="h-3 w-2/3" />
        </div>
      </div>
      <div className="mt-4 flex gap-3 border-t border-outline-variant/10 pt-4">
        <Block className="h-10 flex-1 bg-primary/15" />
        <Block className="h-10 flex-1" />
      </div>
    </div>
  );
}

function QrActionCard() {
  return (
    <section className={`${surfaceCard} p-5`}>
      <Pill className="mb-4 h-7 w-36" />
      <div className="mx-auto mb-5 h-40 w-40 rounded-3xl bg-surface-container-high" />
      <Block className="h-12 bg-primary/20" />
    </section>
  );
}

function ConversationRow({ active = false }: { active?: boolean }) {
  return (
    <div className={`rounded-2xl p-3 ${active ? "bg-primary/10" : "bg-transparent"}`}>
      <div className="flex items-center gap-3">
        <Avatar />
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center justify-between gap-3">
            <Pill className="h-4 w-28" />
            <Pill className="h-3 w-10" />
          </div>
          <Pill className="h-3 w-full" />
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ width, self = false }: { width: string; self?: boolean }) {
  return <div className={`h-14 rounded-[1.3rem] ${self ? "bg-primary/20" : mutedLow} ${width}`} />;
}

function NotificationGroup({ compact = false }: { compact?: boolean }) {
  return (
    <section className={`${surfaceCard} p-4`}>
      <div className="mb-4 flex items-center justify-between">
        <Pill className="h-5 w-36" />
        <Pill className="h-7 w-16" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: compact ? 2 : 3 }).map((_, i) => <NotificationRow key={i} unread={i === 0} embedded />)}
      </div>
    </section>
  );
}

function NotificationRow({ unread = false, embedded = false }: { unread?: boolean; embedded?: boolean }) {
  return (
    <div className={`rounded-2xl border border-outline-variant/10 ${embedded ? "bg-surface-container-low" : "bg-surface-container-lowest"} p-4`}>
      <div className="flex gap-3">
        <div className={`h-11 w-11 rounded-2xl ${unread ? "bg-primary/20" : mutedHigh}`} />
        <div className="flex-1">
          <div className="mb-2 flex items-center justify-between gap-3">
            <Pill className="h-4 w-40" />
            <Pill className="h-3 w-12" />
          </div>
          <Pill className="mb-2 h-3 w-full" />
          <Pill className="h-3 w-3/5" />
        </div>
      </div>
    </div>
  );
}

function FieldSkeleton({ label, tall = false }: { label: string; tall?: boolean }) {
  return (
    <div>
      <Pill className={`mb-2 h-4 ${label}`} />
      <Block className={tall ? "h-28" : "h-13 min-h-14"} />
    </div>
  );
}

function UploadSkeleton() {
  return (
    <div>
      <Pill className="mb-2 h-4 w-28" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-2xl border border-dashed border-outline-variant/30 bg-surface-container-low" />
        ))}
      </div>
    </div>
  );
}

function MiniActivity() {
  return (
    <div className="mb-4 flex items-center gap-3 last:mb-0">
      <div className="h-9 w-9 rounded-xl bg-surface-container-high" />
      <div className="flex-1">
        <Pill className="mb-2 h-3 w-full" />
        <Pill className="h-3 w-1/2" />
      </div>
    </div>
  );
}
