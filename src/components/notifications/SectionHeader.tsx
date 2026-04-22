'use client';

interface SectionHeaderProps {
  label: string;
  count: number;
}

export function SectionHeader({ label, count }: SectionHeaderProps) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-2 bg-surface/90 backdrop-blur-md border-b border-outline-variant/8">
      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-on-surface-variant/50">
        {label}
      </span>
      <div className="flex-1 h-px bg-outline-variant/10" />
      <span className="text-[10px] font-mono text-on-surface-variant/30 tabular-nums">{count}</span>
    </div>
  );
}