'use client';

import { useRef } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';

interface SwipeableRowProps {
  children: React.ReactNode;
  onDelete: () => void;
  onRead: () => void;
  isRead: boolean;
}

export function SwipeableRow({ children, onDelete, onRead, isRead }: SwipeableRowProps) {
  const x = useMotionValue(0);
  const isDragging = useRef(false);

  // Right swipe → delete reveal (red)
  const deleteOpacity = useTransform(x, [0, 72], [0, 1]);
  const deleteScale   = useTransform(x, [0, 72], [0.7, 1]);

  // Left swipe → read reveal (green), only when unread
  const readOpacity = useTransform(x, [-72, 0], [1, 0]);
  const readScale   = useTransform(x, [-72, 0], [1, 0.7]);

  return (
    <div className="relative overflow-hidden">
      {/* Delete layer — right */}
      <motion.div
        style={{ opacity: deleteOpacity }}
        className="absolute inset-0 bg-error/8 flex items-center px-5 pointer-events-none"
        aria-hidden
      >
        <motion.div style={{ scale: deleteScale }} className="flex items-center gap-2 text-error">
          <span className="material-symbols-outlined text-xl">delete</span>
          <span className="text-[11px] font-black uppercase tracking-wider">Delete</span>
        </motion.div>
      </motion.div>

      {/* Read layer — left */}
      {!isRead && (
        <motion.div
          style={{ opacity: readOpacity }}
          className="absolute inset-0 bg-[#006e0c]/8 flex items-center justify-end px-5 pointer-events-none"
          aria-hidden
        >
          <motion.div style={{ scale: readScale }} className="flex items-center gap-2 text-[#006e0c]">
            <span className="text-[11px] font-black uppercase tracking-wider">Mark read</span>
            <span className="material-symbols-outlined text-xl">done_all</span>
          </motion.div>
        </motion.div>
      )}

      {/* Draggable content */}
      <motion.div
        drag="x"
        style={{ x }}
        dragConstraints={{ left: isRead ? 0 : -90, right: 90 }}
        dragElastic={{ left: 0.08, right: 0.08 }}
        onDragStart={() => { isDragging.current = true; }}
        onDragEnd={(_, info) => {
          setTimeout(() => { isDragging.current = false; }, 80);
          if (info.offset.x > 68)        onDelete();
          else if (info.offset.x < -68 && !isRead) onRead();
        }}
        className="relative z-10 cursor-grab active:cursor-grabbing"
        // Snap back
        whileTap={{ cursor: 'grabbing' }}
        transition={{ type: 'spring', stiffness: 400, damping: 40 }}
      >
        {children}
      </motion.div>
    </div>
  );
}