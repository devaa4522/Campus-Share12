"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppState {
  lowBandwidth: boolean;
  toggleLowBandwidth: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      lowBandwidth: false,
      toggleLowBandwidth: () =>
        set((state) => ({ lowBandwidth: !state.lowBandwidth })),
    }),
    {
      name: "academic-exchange-settings",
    }
  )
);
