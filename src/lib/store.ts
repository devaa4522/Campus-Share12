"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppState {
  lowBandwidth: boolean;
  toggleLowBandwidth: () => void;
  earnMode: boolean;
  toggleEarnMode: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      lowBandwidth: false,
      toggleLowBandwidth: () =>
        set((state) => ({ lowBandwidth: !state.lowBandwidth })),
      earnMode: false,
      toggleEarnMode: () =>
        set((state) => ({ earnMode: !state.earnMode })),
    }),
    {
      name: "academic-exchange-settings",
    }
  )
);
