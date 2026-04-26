// src/components/notifications/SwipeableRow.tsx
'use client';

import { useEffect, useState } from 'react';
import { animate, motion, useMotionValue } from 'framer-motion';

interface SwipeableRowProps {
  children: React.ReactNode;
  onDelete: () => void;
  onRead: () => void;
  isRead: boolean;
  onOpenChange?: (open: boolean) => void;
  closeSignal?: number;
}

const ACTION_WIDTH_UNREAD = 152;
const ACTION_WIDTH_READ = 88;

// Intentionally conservative so normal vertical scrolling does not reveal actions.
const OPEN_THRESHOLD = 92;
const CLOSE_THRESHOLD = 36;
const HORIZONTAL_INTENT = 14;

export function SwipeableRow({
  children,
  onDelete,
  onRead,
  isRead,
  onOpenChange,
  closeSignal = 0,
}: SwipeableRowProps) {
  const x = useMotionValue(0);
  const [open, setOpen] = useState(false);
  const actionWidth = isRead ? ACTION_WIDTH_READ : ACTION_WIDTH_UNREAD;

  const snapTo = (target: number) => {
    animate(x, target, { type: 'spring', stiffness: 430, damping: 42 });
    const nextOpen = target !== 0;
    setOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  const close = () => snapTo(0);

  useEffect(() => {
    close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeSignal]);

  const handleRead = () => {
    close();
    onRead();
  };

  const handleDelete = () => {
    close();
    onDelete();
  };

  return (
    <div className="relative overflow-hidden bg-surface">
      <div
        className="absolute inset-y-0 right-0 flex items-stretch justify-end bg-surface-container-low"
        style={{ width: actionWidth }}
        aria-hidden={!open}
      >
        {!isRead && (
          <button
            type="button"
            onClick={handleRead}
            className="w-[64px] flex flex-col items-center justify-center gap-1 text-primary hover:bg-primary/8 active:bg-primary/12 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">done_all</span>
            <span className="text-[10px] font-black uppercase tracking-wide">Read</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleDelete}
          className="w-[88px] flex flex-col items-center justify-center gap-1 text-error hover:bg-error/8 active:bg-error/12 transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">delete</span>
          <span className="text-[10px] font-black uppercase tracking-wide">Delete</span>
        </button>
      </div>

      <motion.div
        style={{ x, touchAction: 'pan-y' }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -actionWidth, right: 0 }}
        dragElastic={0.01}
        dragMomentum={false}
        onDragEnd={(_, info) => {
          const horizontal = info.offset.x;
          const vertical = info.offset.y;

          // Do not treat small diagonal/vertical gestures as notification swipes.
          if (Math.abs(horizontal) < HORIZONTAL_INTENT || Math.abs(vertical) > Math.abs(horizontal) * 0.65) {
            snapTo(open ? -actionWidth : 0);
            return;
          }

          if (open) {
            snapTo(horizontal > CLOSE_THRESHOLD ? 0 : -actionWidth);
            return;
          }

          snapTo(horizontal < -OPEN_THRESHOLD ? -actionWidth : 0);
        }}
        className="relative z-10 bg-surface"
      >
        {children}
      </motion.div>
    </div>
  );
}
