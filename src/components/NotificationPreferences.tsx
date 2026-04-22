"use client";

import { useState } from "react";
import { motion } from "framer-motion";

const PREF_ICONS: Record<string, string> = {
  new_request: "package_2",
  deal_updates: "handshake",
  messages: "chat_bubble",
  karma: "stars",
};

export default function NotificationPreferences() {
  // Eventually, fetch this initial state from your Supabase 'profiles' table
  const [prefs, setPrefs] = useState({
    new_request: true,
    deal_updates: true,
    messages: true,
    karma: false,
  });

  const toggle = (key: keyof typeof prefs) => {
    if (navigator.vibrate) navigator.vibrate(5);
    setPrefs(p => ({ ...p, [key]: !p[key] }));
    // TODO: Add Supabase RPC call here to save to the database
  };

  return (
    <div className="bg-[#000a1e] rounded-2xl p-6 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative overflow-hidden group">
      {/* Decorative background element */}
      <div className="absolute -right-8 -top-8 w-32 h-32 bg-[#006e0c]/5 rounded-full blur-3xl group-hover:bg-[#006e0c]/10 transition-colors duration-500" />
      
      <div className="relative z-10">
        <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#006e0c] text-xl">notifications_active</span>
          Push Preferences
        </h3>
        <p className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-6">Refine your alert stream</p>

        <div className="space-y-3">
          {Object.entries(prefs).map(([key, enabled]) => (
            <div 
              key={key} 
              className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-300 ${
                enabled ? 'bg-[#006e0c]/5 border-[#006e0c]/20' : 'bg-white/5 border-white/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                  enabled ? 'bg-[#006e0c] text-white' : 'bg-white/10 text-white/40'
                }`}>
                  <span className="material-symbols-outlined text-[18px]">
                    {PREF_ICONS[key] || "notifications"}
                  </span>
                </div>
                <div>
                  <span className={`text-xs font-bold capitalize tracking-tight transition-colors ${
                    enabled ? 'text-white' : 'text-white/50'
                  }`}>
                    {key.replace('_', ' ')}
                  </span>
                </div>
              </div>
              
              <button
                onClick={() => toggle(key as keyof typeof prefs)}
                className={`w-10 h-5 rounded-full transition-all duration-500 relative ${
                  enabled ? 'bg-[#006e0c]' : 'bg-white/10'
                }`}
              >
                <motion.div 
                  animate={{ x: enabled ? 20 : 2 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className="w-3.5 h-3.5 bg-white rounded-full absolute top-[3px]" 
                />
              </button>
            </div>
          ))}
        </div>
        
        <p className="mt-6 text-[10px] text-white/20 text-center font-medium">
          Changes are synced across all your PWA-enabled devices
        </p>
      </div>
    </div>
  );
}
