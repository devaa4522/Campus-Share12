'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface Action {
  label: string;
  icon: string;
  color?: string;
  onClick: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  actions: Action[];
  onClose: () => void;
}

export function ContextMenu({ x, y, actions, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Clamp so menu never overflows the viewport
  const safeX = typeof window !== 'undefined' ? Math.min(x, window.innerWidth  - 196) : x;
  const safeY = typeof window !== 'undefined' ? Math.min(y, window.innerHeight - (actions.length * 46 + 16)) : y;

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[200]" onClick={onClose} />

      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.88, y: -6 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{   opacity: 0, scale: 0.88, y: -6  }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
        className="fixed z-[201] min-w-[176px] bg-[#000a1e]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        style={{ left: safeX, top: safeY }}
        role="menu"
        aria-label="Notification actions"
      >
        <div className="py-1">
          {actions.map((action, i) => (
            <button
              key={i}
              role="menuitem"
              onClick={() => { action.onClick(); onClose(); }}
              className="flex items-center gap-3 w-full px-4 py-3 text-left transition-colors hover:bg-white/6 active:bg-white/10 group"
            >
              <span
                className="material-symbols-outlined text-[20px] opacity-70 group-hover:opacity-100 transition-opacity"
                style={{ color: action.color ?? 'rgba(255,255,255,0.7)' }}
              >
                {action.icon}
              </span>
              <span
                className="text-[13px] font-semibold"
                style={{ color: action.color ?? 'rgba(255,255,255,0.85)' }}
              >
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </motion.div>
    </>
  );
}