// src/components/notifications/SectionHeader.tsx
'use client';

interface SectionHeaderProps {
  label: string;
  count: number;
}

export function SectionHeader({ label, count }: SectionHeaderProps) {
  return (
    // NOTE: NOT sticky — the parent sticky header already handles that.
    // Making this sticky too caused double-sticking at wrong offsets.
    <div className="flex items-center gap-3 px-6 py-2.5 bg-surface/80 backdrop-blur-sm border-b border-outline-variant/8">
      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-on-surface-variant/50 select-none">
        {label}
      </span>
      <div className="flex-1 h-px bg-gradient-to-r from-outline-variant/20 to-transparent" />
      <span className="text-[10px] font-mono text-on-surface-variant/30 tabular-nums select-none">
        {count}
      </span>
    </div>
  );
}