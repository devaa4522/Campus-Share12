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
  const dragRef = useRef(false);
  
  // Transform values for reveal layers
  const deleteOpacity = useTransform(x, [0, 80], [0, 1]);
  const readOpacity = useTransform(x, [-80, 0], [1, 0]);
  const deleteScale = useTransform(x, [0, 80], [0.7, 1]);
  const readScale = useTransform(x, [-80, 0], [1, 0.7]);

  return (
    <div className="relative overflow-hidden group">
      {/* Delete Reveal Layer (Swipe Right) */}
      <motion.div 
        style={{ opacity: deleteOpacity }}
        className="absolute inset-0 bg-error/10 flex items-center px-6 pointer-events-none"
      >
        <motion.div style={{ scale: deleteScale }} className="flex items-center gap-2 text-error font-bold">
          <span className="material-symbols-outlined">delete</span>
          <span className="text-xs uppercase tracking-wider">Delete</span>
        </motion.div>
      </motion.div>

      {/* Read Reveal Layer (Swipe Left) */}
      {!isRead && (
        <motion.div 
          style={{ opacity: readOpacity }}
          className="absolute inset-0 bg-success-container/30 flex items-center justify-end px-6 pointer-events-none"
        >
          <motion.div style={{ scale: readScale }} className="flex items-center gap-2 text-success font-bold">
            <span className="text-xs uppercase tracking-wider">Mark Read</span>
            <span className="material-symbols-outlined">done_all</span>
          </motion.div>
        </motion.div>
      )}

      <motion.div
        drag="x"
        style={{ x }}
        dragConstraints={{ left: isRead ? 0 : -100, right: 100 }}
        dragElastic={{ left: 0.1, right: 0.1 }}
        onDragStart={() => { dragRef.current = true; }}
        onDragEnd={(_, info) => {
          setTimeout(() => { dragRef.current = false; }, 100);
          if (info.offset.x > 70) {
             onDelete();
          } else if (info.offset.x < -70 && !isRead) {
             onRead();
          }
        }}
        className="relative z-10 bg-surface cursor-grab active:cursor-grabbing transition-colors group-hover:bg-surface-container-low/50"
      >
        {children}
      </motion.div>
    </div>
  );
}
