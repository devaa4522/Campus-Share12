'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

const THRESHOLD = 52; // px of pull needed to trigger

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pullY, setPullY]         = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY  = useRef(0);
  const pulling = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if ((listRef.current?.scrollTop ?? 0) === 0) {
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!pulling.current) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) setPullY(Math.min(dy * 0.42, 68));
  };

  const handleTouchEnd = async () => {
    pulling.current = false;
    if (pullY >= THRESHOLD) {
      setRefreshing(true);
      setPullY(0);
      await onRefresh();
      setRefreshing(false);
    } else {
      setPullY(0);
    }
    startY.current = 0;
  };

  const triggered = pullY >= THRESHOLD;

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      {/* Pull indicator */}
      <AnimatePresence>
        {(pullY > 8 || refreshing) && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{   opacity: 0, y: -16 }}
            className="absolute top-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex items-center gap-2 bg-[#000a1e]/90 backdrop-blur-md text-white px-4 py-1.5 rounded-full border border-white/10 shadow-xl"
          >
            {refreshing ? (
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                className="material-symbols-outlined text-[16px] text-[#006e0c]"
              >
                sync
              </motion.span>
            ) : (
              <motion.span
                animate={{ rotate: triggered ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="material-symbols-outlined text-[16px]"
                style={{ color: triggered ? '#006e0c' : 'rgba(255,255,255,0.5)' }}
              >
                arrow_downward
              </motion.span>
            )}
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">
              {refreshing ? 'Updating…' : triggered ? 'Release' : 'Pull to refresh'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        ref={listRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateY(${pullY}px)`,
          transition: pulling.current ? 'none' : 'transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
        className="overflow-y-auto flex-1 overscroll-none"
      >
        {children}
      </div>
    </div>
  );
}