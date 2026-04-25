// src/lib/design/tokens.ts
// Auto-derived from palettes.ts — do not edit directly.
// Import { t } from here in all components.

import { theme } from "./palettes";

export const t = {
  // ── Core ─────────────────────────────────────────────────
  primary:   theme.primary,
  secondary: theme.secondary,
  accent:    theme.accent,

  // ── Surfaces ─────────────────────────────────────────────
  surface:     theme.surface,
  surfaceSoft: theme.surfaceSoft,
  card:        theme.surfaceCard,

  // ── Text ─────────────────────────────────────────────────
  text:        theme.textPrimary,
  textSub:     theme.textSecondary,
  textMuted:   theme.textMuted,

  // ── Borders ──────────────────────────────────────────────
  border:      theme.borderSoft,
  borderFocus: theme.borderFocus,

  // ── Semantic ─────────────────────────────────────────────
  success: theme.success,
  warning: theme.warning,
  error:   theme.error,
  info:    theme.info,

  // ── Messages ─────────────────────────────────────────────
  msg: {
    sentBg:        theme.sentBg,
    sentText:      theme.sentText,
    sentTime:      theme.sentTime,
    receivedBg:    theme.receivedBg,
    receivedText:  theme.receivedText,
    receivedTime:  theme.receivedTime,
    tickSent:      theme.tickSent,
    tickDelivered: theme.tickDelivered,
    tickRead:      theme.tickRead,
    typingDot:     theme.typingDot,
    recordingPulse: theme.recordingPulse,
    reactionBg:    theme.reactionBg,
    reactionActive: theme.reactionActive,
  },

  // ── Presence ─────────────────────────────────────────────
  online: theme.onlineDot,

  // ── Nav ──────────────────────────────────────────────────
  nav: {
    bg:       theme.navBg,
    active:   theme.navActive,
    inactive: theme.navInactive,
  },

  // ── Shadows ──────────────────────────────────────────────
  shadow:        "0 12px 32px rgba(0,10,30,0.06)",
  shadowElevated: "0 8px 24px rgba(0,10,30,0.10)",
};