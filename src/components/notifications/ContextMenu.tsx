'use client';

import { motion } from 'framer-motion';

interface ContextMenuProps {
  x: number;
  y: number;
  actions: {
    label: string;
    icon: string;
    color?: string;
    onClick: () => void;
  }[];
  onClose: () => void;
}

export function ContextMenu({ x, y, actions, onClose }: ContextMenuProps) {
  return (
    <>
      <div className="fixed inset-0 z-[200]" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: -10 }}
        className="fixed z-[201] min-w-[180px] bg-surface-container-highest/95 backdrop-blur-xl border border-outline-variant/30 rounded-2xl shadow-2xl overflow-hidden editorial-shadow"
        style={{
          left: Math.min(x, typeof window !== 'undefined' ? window.innerWidth - 200 : x),
          top: Math.min(y, typeof window !== 'undefined' ? window.innerHeight - 150 : y),
        }}
      >
        <div className="py-1.5">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={() => {
                action.onClick();
                onClose();
              }}
              className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-white/5 active:bg-white/10 transition-colors group"
            >
              <span className="material-symbols-outlined text-xl opacity-70 group-hover:opacity-100 transition-opacity" style={{ color: action.color }}>
                {action.icon}
              </span>
              <span className="text-sm font-medium text-on-surface" style={{ color: action.color }}>
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </motion.div>
    </>
  );
}
