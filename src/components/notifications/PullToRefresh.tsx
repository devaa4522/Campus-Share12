'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullY, setPullY] = useState(0);
  const startY = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (listRef.current?.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!startY.current) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0 && listRef.current?.scrollTop === 0) {
      setPulling(true);
      setPullY(Math.min(dy * 0.45, 60));
    }
  };

  const handleTouchEnd = async () => {
    if (pullY > 45) {
      setRefreshing(true);
      await onRefresh();
      setRefreshing(false);
    }
    setPulling(false);
    setPullY(0);
    startY.current = 0;
  };

  return (
    <div className="relative flex-1 overflow-hidden flex flex-col">
      <AnimatePresence>
        {(pulling || refreshing) && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-0 left-0 right-0 z-20 flex justify-center items-center py-2 pointer-events-none"
          >
            <div className="flex items-center gap-2 bg-primary-container text-on-primary px-4 py-1.5 rounded-full shadow-lg border border-primary/20">
              {refreshing ? (
                <motion.span 
                  animate={{ rotate: 360 }} 
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="material-symbols-outlined text-sm"
                >
                  sync
                </motion.span>
              ) : (
                <span 
                  style={{ transform: `rotate(${pullY > 45 ? 180 : 0}deg)` }}
                  className="material-symbols-outlined text-sm transition-transform"
                >
                  arrow_downward
                </span>
              )}
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {refreshing ? "Updating..." : pullY > 45 ? "Release" : "Pull"}
              </span>
            </div>
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
          transition: pulling ? "none" : "transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
        className="overflow-y-auto flex-1 overscroll-none"
      >
        {children}
      </div>
    </div>
  );
}
