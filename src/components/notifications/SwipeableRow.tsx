// src/components/notifications/SwipeableRow.tsx
'use client';

import { useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';

interface SwipeableRowProps {
  children: React.ReactNode;
  onDelete: () => void;
  onRead: () => void;
  isRead: boolean;
}

const ACTIVATION_THRESHOLD  = 72;
const DRAG_START_THRESHOLD  = 12;  // px horizontal movement before swipe locks
const VERTICAL_LOCK_PRIORITY = 18; // if vertical movement exceeds this first, cancel swipe

export function SwipeableRow({ children, onDelete, onRead, isRead }: SwipeableRowProps) {
  const x = useMotionValue(0);
  const [dragging, setDragging] = useState(false);

  const startX     = useRef(0);
  const startY     = useRef(0);
  const lockMode   = useRef<'none' | 'swipe' | 'scroll'>('none');
  const pointerId  = useRef<number | null>(null);

  // ── Visual transforms ─────────────────────────────────────────────────────

  const deleteOpacity = useTransform(x, [0, ACTIVATION_THRESHOLD], [0, 1]);
  const deleteScale   = useTransform(x, [0, ACTIVATION_THRESHOLD], [0.5, 1]);
  const deleteX       = useTransform(x, [0, ACTIVATION_THRESHOLD], [-24, 0]);

  const readOpacity = useTransform(x, [-ACTIVATION_THRESHOLD, 0], [1, 0]);
  const readScale   = useTransform(x, [-ACTIVATION_THRESHOLD, 0], [1, 0.5]);
  const readX       = useTransform(x, [-ACTIVATION_THRESHOLD, 0], [0, 24]);

  const deleteBg = useTransform(
    x, [0, ACTIVATION_THRESHOLD],
    ['rgba(186,26,26,0)', 'rgba(186,26,26,0.10)']
  );
  const readBg = useTransform(
    x, [-ACTIVATION_THRESHOLD, 0],
    ['rgba(0,110,12,0.10)', 'rgba(0,110,12,0)']
  );

  // ── Snapshot current offset for non-drag reset ────────────────────────────

  const snapBack = () => {
    animate(x, 0, { type: 'spring', stiffness: 420, damping: 42 });
    setDragging(false);
    lockMode.current = 'none';
    pointerId.current = null;
  };

  // ── Pointer handlers ──────────────────────────────────────────────────────

  const onPointerDown = (e: React.PointerEvent) => {
    // Only start tracking if not already in any gesture
    if (lockMode.current !== 'none') return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    lockMode.current = 'none';
    pointerId.current = e.pointerId;
    // Capture pointer so we get future events even outside element
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (lockMode.current === 'scroll') return; // already decided this is a vertical scroll

    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;

    // ── Not yet locked ─────────────────────────────────────────────────
    if (lockMode.current === 'none') {
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // Both movements are tiny → wait
      if (absDx < DRAG_START_THRESHOLD && absDy < VERTICAL_LOCK_PRIORITY) return;

      // Vertical is dominant → lock as scroll, never activate swipe
      if (absDy >= absDx && absDy > VERTICAL_LOCK_PRIORITY) {
        lockMode.current = 'scroll';
        return;
      }

      // Horizontal is dominant → lock as swipe
      if (absDx >= DRAG_START_THRESHOLD && absDx >= absDy) {
        lockMode.current = 'swipe';
        setDragging(true);
      } else {
        // Not enough movement yet
        return;
      }
    }

    // ── Locked as swipe: update motion value ───────────────────────────
    if (lockMode.current === 'swipe') {
      x.set(dx);
      e.preventDefault(); // prevent vertical scroll while swiping
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (lockMode.current !== 'swipe') {
      // Was not a swipe — just reset
      lockMode.current = 'none';
      pointerId.current = null;
      return;
    }

    const dx = x.get();

    if (!isRead && dx < -ACTIVATION_THRESHOLD) {
      // Swipe left to mark read
      animate(x, -ACTIVATION_THRESHOLD, { duration: 0.1 }).then(() => {
        onRead();
        snapBack();
      });
    } else if (dx > ACTIVATION_THRESHOLD) {
      // Swipe right to delete
      animate(x, ACTIVATION_THRESHOLD, { duration: 0.1 }).then(() => {
        onDelete();
        snapBack();
      });
    } else {
      snapBack();
    }
  };

  const onPointerCancel = () => {
    if (lockMode.current === 'swipe') snapBack();
    lockMode.current = 'none';
    pointerId.current = null;
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative overflow-hidden">

      {/* ── Delete reveal (left side) ──────────────────────────────────────── */}
      <motion.div
        style={{ opacity: deleteOpacity, backgroundColor: deleteBg as any }}
        className="absolute inset-0 flex items-center px-5 pointer-events-none"
        aria-hidden
      >
        <motion.div
          style={{ scale: deleteScale, x: deleteX }}
          className="flex items-center gap-2 text-error"
        >
          <span className="material-symbols-outlined text-xl">delete</span>
          <span className="text-[11px] font-black uppercase tracking-wider">Delete</span>
        </motion.div>
      </motion.div>

      {/* ── Read reveal (right side) ───────────────────────────────────────── */}
      {!isRead && (
        <motion.div
          style={{ opacity: readOpacity, backgroundColor: readBg as any }}
          className="absolute inset-0 flex items-center justify-end px-5 pointer-events-none"
          aria-hidden
        >
          <motion.div
            style={{ scale: readScale, x: readX }}
            className="flex items-center gap-2 text-[#006e0c]"
          >
            <span className="text-[11px] font-black uppercase tracking-wider">Mark read</span>
            <span className="material-symbols-outlined text-xl">done_all</span>
          </motion.div>
        </motion.div>
      )}

      {/* ── Swipeable surface ──────────────────────────────────────────────── */}
      <motion.div
        style={{ x }}
        // Only enable framer-motion drag when we've locked into swipe mode
        drag={dragging ? 'x' : false}
        dragConstraints={{ left: isRead ? 0 : -100, right: 100 }}
        dragElastic={{ left: 0.05, right: 0.05 }}
        dragMomentum={false}
        dragSnapToOrigin={false}
        onDragEnd={(_, info) => {
          // This is a fallback — onPointerUp handles the logic
          const dx = info.offset.x;
          if (!isRead && dx < -ACTIVATION_THRESHOLD) onRead();
          else if (dx > ACTIVATION_THRESHOLD) onDelete();
          snapBack();
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        className="relative z-10 touch-none select-none"
        transition={{ type: 'spring', stiffness: 420, damping: 42 }}
      >
        {children}
      </motion.div>
    </div>
  );
}