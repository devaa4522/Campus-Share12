// src/lib/design/animations.ts

import type { Variants, Transition } from "framer-motion";

// ── Shared spring configs ─────────────────────────────────────

export const spring = {
  snappy: {
    type: "spring" as const,
    stiffness: 500,
    damping: 36,
  },
  gentle: {
    type: "spring" as const,
    stiffness: 320,
    damping: 28,
  },
  bounce: {
    type: "spring" as const,
    stiffness: 420,
    damping: 22,
  },
};

// ── Message bubble enter ──────────────────────────────────────

export const bubbleVariants: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: spring.snappy,
  },
};

// ── Conversation row ──────────────────────────────────────────

export const rowVariants: Variants = {
  hidden:  { opacity: 0, x: -6 },
  visible: { opacity: 1, x: 0, transition: spring.gentle },
  exit:    { opacity: 0, x: -6, transition: { duration: 0.15 } },
};

// ── Slide up (modals, panels) ─────────────────────────────────

export const slideUp: Variants = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0,  transition: spring.gentle },
  exit:    { opacity: 0, y: 16, transition: { duration: 0.18 } },
};

// ── Fade ─────────────────────────────────────────────────────

export const fade: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit:    { opacity: 0, transition: { duration: 0.15 } },
};

// ── Context menu / Emoji picker ───────────────────────────────

export const menuVariants: Variants = {
  hidden:  { opacity: 0, scale: 0.88, y: -6 },
  visible: {
    opacity: 1, scale: 1, y: 0,
    transition: spring.bounce,
  },
  exit: { opacity: 0, scale: 0.88, transition: { duration: 0.12 } },
};

// ── Typing dots ───────────────────────────────────────────────

export const typingDot = (delay: number): Transition => ({
  duration: 0.9,
  repeat: Infinity,
  delay,
  ease: "easeInOut",
});

// ── Swipe reply threshold ─────────────────────────────────────

export const SWIPE_THRESHOLD = 60;