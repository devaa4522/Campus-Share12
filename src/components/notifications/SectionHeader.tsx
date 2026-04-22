'use client';



interface SectionHeaderProps {
  label: string;
  count: number;
}

export function SectionHeader({ label, count }: SectionHeaderProps) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-2 bg-surface/90 backdrop-blur-md border-b border-outline-variant/10">
      <span className="text-[10px] font-black uppercase tracking-[0.15em] text-on-surface-variant/60">
        {label}
      </span>
      <div className="flex-1 h-[1px] bg-outline-variant/10" />
      <span className="text-[10px] font-mono text-on-surface-variant/40">{count}</span>
    </div>
  );
}
