// src/lib/design/palettes.ts
// ─────────────────────────────────────────────────────────────
// EDIT THIS FILE TO CHANGE YOUR ENTIRE APP'S VISUAL IDENTITY
// Switch ACTIVE_THEME between "oxford" and "signature" to compare
// ─────────────────────────────────────────────────────────────

export type ThemeName = "oxford" | "signature";

export const ACTIVE_THEME: ThemeName = "signature";

export interface Palette {
  // Core brand
  primary:        string;
  secondary:      string;
  accent:         string;

  // Surfaces
  surface:        string;
  surfaceSoft:    string;
  surfaceCard:    string;

  // Text
  textPrimary:    string;
  textSecondary:  string;
  textMuted:      string;

  // Borders
  borderSoft:     string;
  borderFocus:    string;

  // Semantic
  success:        string;
  warning:        string;
  error:          string;
  info:           string;

  // Message bubbles
  sentBg:         string;
  sentText:       string;
  sentTime:       string;
  receivedBg:     string;
  receivedText:   string;
  receivedTime:   string;

  // Ticks
  tickSent:       string;
  tickDelivered:  string;
  tickRead:       string;

  // Interactive states
  typingDot:      string;
  recordingPulse: string;
  reactionBg:     string;
  reactionActive: string;
  onlineDot:      string;

  // Navigation
  navBg:          string;
  navActive:      string;
  navInactive:    string;
}

export const palettes: Record<ThemeName, Palette> = {
  // ── Oxford Scholastic ──────────────────────────────────────
  // Institutional authority. Deep navy, scholar green, snow white.
  oxford: {
    primary:        "#000a1e",
    secondary:      "#006e0c",
    accent:         "#006e0c",

    surface:        "#f7f9fb",
    surfaceSoft:    "#f2f4f6",
    surfaceCard:    "#ffffff",

    textPrimary:    "#000a1e",
    textSecondary:  "#44474d",
    textMuted:      "#75777d",

    borderSoft:     "rgba(0,10,30,0.06)",
    borderFocus:    "#000a1e",

    success:        "#006e0c",
    warning:        "#b45309",
    error:          "#ba1a1a",
    info:           "#1d4ed8",

    sentBg:         "#000a1e",
    sentText:       "#ffffff",
    sentTime:       "rgba(255,255,255,0.60)",
    receivedBg:     "#ffffff",
    receivedText:   "#000a1e",
    receivedTime:   "rgba(0,10,30,0.45)",

    tickSent:       "rgba(255,255,255,0.45)",
    tickDelivered:  "rgba(255,255,255,0.70)",
    tickRead:       "#7dd876",

    typingDot:      "#006e0c",
    recordingPulse: "#ba1a1a",
    reactionBg:     "rgba(0,10,30,0.06)",
    reactionActive: "rgba(0,110,12,0.12)",
    onlineDot:      "#006e0c",

    navBg:          "rgba(247,249,251,0.92)",
    navActive:      "#006e0c",
    navInactive:    "rgba(0,10,30,0.38)",
  },

  // ── CampusShare Signature ──────────────────────────────────
  // Oxford authority + Carbon clarity + Sahara warmth.
  signature: {
    primary:        "#000a1e",
    secondary:      "#198038",
    accent:         "#c2652a",

    surface:        "#faf5ee",
    surfaceSoft:    "#f2ece4",
    surfaceCard:    "#ffffff",

    textPrimary:    "#000a1e",
    textSecondary:  "#44474d",
    textMuted:      "#75777d",

    borderSoft:     "rgba(0,10,30,0.05)",
    borderFocus:    "#000a1e",

    success:        "#198038",
    warning:        "#b45309",
    error:          "#ba1a1a",
    info:           "#1d4ed8",

    sentBg:         "#000a1e",
    sentText:       "#ffffff",
    sentTime:       "rgba(255,255,255,0.60)",
    receivedBg:     "#faf5ee",
    receivedText:   "#000a1e",
    receivedTime:   "rgba(0,10,30,0.45)",

    tickSent:       "rgba(255,255,255,0.45)",
    tickDelivered:  "rgba(255,255,255,0.70)",
    tickRead:       "#7dd876",

    typingDot:      "#198038",
    recordingPulse: "#ba1a1a",
    reactionBg:     "rgba(0,10,30,0.05)",
    reactionActive: "rgba(25,128,56,0.12)",
    onlineDot:      "#198038",

    navBg:          "rgba(250,245,238,0.92)",
    navActive:      "#c2652a",
    navInactive:    "rgba(0,10,30,0.38)",
  },
};

export const theme: Palette = palettes[ACTIVE_THEME];