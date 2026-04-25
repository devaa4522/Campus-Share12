// src/components/notifications/SwipeableRow.tsx
'use client';

import { useState } from 'react';
import { motion, animate, useMotionValue } from 'framer-motion';

interface SwipeableRowProps {
  children: React.ReactNode;
  onDelete: () => void;
  onRead: () => void;
  isRead: boolean;
}

const ACTION_WIDTH_UNREAD = 148;
const ACTION_WIDTH_READ = 82;
const OPEN_THRESHOLD = 54;
const CLOSE_THRESHOLD = 28;

export function SwipeableRow({ children, onDelete, onRead, isRead }: SwipeableRowProps) {
  const x = useMotionValue(0);
  const [open, setOpen] = useState(false);

  const actionWidth = isRead ? ACTION_WIDTH_READ : ACTION_WIDTH_UNREAD;

  const snapTo = (target: number) => {
    animate(x, target, { type: 'spring', stiffness: 420, damping: 40 });
    setOpen(target !== 0);
  };

  const close = () => snapTo(0);

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
            className="w-[66px] flex flex-col items-center justify-center gap-1 text-primary hover:bg-primary/8 active:bg-primary/12 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">done_all</span>
            <span className="text-[10px] font-black uppercase tracking-wide">Read</span>
          </button>
        )}
        <button
          type="button"
          onClick={handleDelete}
          className="w-[82px] flex flex-col items-center justify-center gap-1 text-error hover:bg-error/8 active:bg-error/12 transition-colors"
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
        dragElastic={0.03}
        dragMomentum={false}
        onDragEnd={(_, info) => {
          const offset = info.offset.x;
          const velocity = info.velocity.x;

          if (open) {
            if (offset > CLOSE_THRESHOLD || velocity > 420) snapTo(0);
            else snapTo(-actionWidth);
            return;
          }

          if (offset < -OPEN_THRESHOLD || velocity < -520) snapTo(-actionWidth);
          else snapTo(0);
        }}
        onTap={() => {
          if (open) close();
        }}
        className="relative z-10 bg-surface"
      >
        {children}
      </motion.div>
    </div>
  );
}
