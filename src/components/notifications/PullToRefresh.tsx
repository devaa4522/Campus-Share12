// src/components/notifications/PullToRefresh.tsx
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

const THRESHOLD   = 56;
const MAX_PULL    = 72;
const RESISTANCE  = 0.40;

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pullY,      setPullY]      = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const startY       = useRef(0);
  const currentPullY = useRef(0);
  const isPulling    = useRef(false);
  const isLocked     = useRef(false);

  const getScrollTop = () => containerRef.current?.scrollTop ?? 0;

  // ── We use non-passive touch listeners via ref attachment ────────────

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (isLocked.current) return;
      if (getScrollTop() > 0) return;
      startY.current  = e.touches[0].clientY;
      isPulling.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isPulling.current || isLocked.current) return;
      if (getScrollTop() > 0) {
        isPulling.current = false;
        setPullY(0);
        return;
      }

      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        setPullY(0);
        return;
      }

      // Prevent page bounce — this must NOT be passive
      e.preventDefault();

      const pull = Math.min(dy * RESISTANCE, MAX_PULL);
      currentPullY.current = pull;
      setPullY(pull);
    };

    const onTouchEnd = async () => {
      if (!isPulling.current) return;
      isPulling.current = false;

      if (currentPullY.current >= THRESHOLD && !isLocked.current) {
        isLocked.current = true;
        setRefreshing(true);
        setPullY(0);
        currentPullY.current = 0;

        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
          isLocked.current = false;
        }
      } else {
        setPullY(0);
        currentPullY.current = 0;
      }

      startY.current = 0;
    };

    // Attach with { passive: false } so preventDefault works
    el.addEventListener('touchstart', onTouchStart, { passive: true  });
    el.addEventListener('touchmove',  onTouchMove,  { passive: false });
    el.addEventListener('touchend',   onTouchEnd,   { passive: true  });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove',  onTouchMove);
      el.removeEventListener('touchend',   onTouchEnd);
    };
  }, [onRefresh]);

  const triggered = pullY >= THRESHOLD;
  const progress  = Math.min(pullY / THRESHOLD, 1);

  return (
    // This wrapper fills the remaining height in the flex parent
    <div className="flex-1 flex flex-col overflow-hidden relative">

      {/* ── Pull indicator ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {(pullY > 6 || refreshing) && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0,   scale: 1    }}
            exit={{   opacity: 0, y: -20, scale: 0.8   }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none
                       flex items-center gap-2 px-4 py-1.5 rounded-full
                       bg-primary/90 backdrop-blur-md border border-white/10 shadow-xl"
          >
            {refreshing ? (
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 0.85, repeat: Infinity, ease: 'linear' }}
                className="material-symbols-outlined text-[16px] text-secondary"
              >
                sync
              </motion.span>
            ) : (
              <motion.span
                animate={{ rotate: triggered ? 180 : Math.round(progress * 90) }}
                transition={{ duration: 0.15 }}
                className="material-symbols-outlined text-[16px] transition-colors"
                style={{
                  color: triggered ? '#006e0c' : `rgba(255,255,255,${0.3 + progress * 0.5})`
                }}
              >
                arrow_downward
              </motion.span>
            )}
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">
              {refreshing ? 'Updating…' : triggered ? 'Release to refresh' : 'Pull to refresh'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Scrollable content ──────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overscroll-none"
        style={{
          transform: pullY > 0 ? `translateY(${pullY}px)` : 'translateY(0)',
          transition: isPulling.current
            ? 'none'
            : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
}