// src/lib/design/theme.ts
// Call applyTheme() once in MainWrapper to sync CSS vars with palette.

import { theme } from "./palettes";

export function applyTheme() {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  const vars: Record<string, string> = {
    "--app-primary":         theme.primary,
    "--app-secondary":       theme.secondary,
    "--app-accent":          theme.accent,
    "--app-surface":         theme.surface,
    "--app-surface-soft":    theme.surfaceSoft,
    "--app-card":            theme.surfaceCard,
    "--app-text":            theme.textPrimary,
    "--app-text-sub":        theme.textSecondary,
    "--app-text-muted":      theme.textMuted,
    "--app-border":          theme.borderSoft,
    "--app-border-focus":    theme.borderFocus,
    "--app-success":         theme.success,
    "--app-warning":         theme.warning,
    "--app-error":           theme.error,
    "--app-sent-bg":         theme.sentBg,
    "--app-sent-text":       theme.sentText,
    "--app-sent-time":       theme.sentTime,
    "--app-received-bg":     theme.receivedBg,
    "--app-received-text":   theme.receivedText,
    "--app-received-time":   theme.receivedTime,
    "--app-tick-sent":       theme.tickSent,
    "--app-tick-delivered":  theme.tickDelivered,
    "--app-tick-read":       theme.tickRead,
    "--app-typing-dot":      theme.typingDot,
    "--app-recording":       theme.recordingPulse,
    "--app-reaction-bg":     theme.reactionBg,
    "--app-reaction-active": theme.reactionActive,
    "--app-online":          theme.onlineDot,
    "--app-nav-bg":          theme.navBg,
    "--app-nav-active":      theme.navActive,
    "--app-nav-inactive":    theme.navInactive,
    "--app-shadow":          "0 12px 32px rgba(0,10,30,0.06)",
  };

  for (const [key, val] of Object.entries(vars)) {
    root.style.setProperty(key, val);
  }
}