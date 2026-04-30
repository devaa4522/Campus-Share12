"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNotifications } from "@/hooks/useNotifications";

const PREF_ICONS: Record<string, string> = {
  new_request: "package_2",
  deal_updates: "handshake",
  messages: "chat_bubble",
  karma: "stars",
};

export default function NotificationPreferences() {
  const { 
    pushSupported, 
    pushEnabled, 
    enablePushNotifications, 
    disablePushNotifications 
  } = useNotifications();
  
  const [isEnabling, setIsEnabling] = useState(false);

  // Fetch initial preferences from Supabase (optional - implement later)
  const [prefs, setPrefs] = useState({
    new_request: true,
    deal_updates: true,
    messages: true,
    karma: false,
  });

  const toggle = (key: keyof typeof prefs) => {
    if (navigator.vibrate) navigator.vibrate(5);
    setPrefs(p => ({ ...p, [key]: !p[key] }));
    // TODO: Save to Supabase profiles table
  };

  const handleEnablePush = async () => {
    setIsEnabling(true);
    const success = await enablePushNotifications();
    setIsEnabling(false);
    
    if (success && navigator.vibrate) {
      navigator.vibrate([100, 50, 200]); // Success pattern
    }
  };

  if (!pushSupported) {
    return (
      <div className="bg-primary/50 rounded-2xl p-6 border border-white/5">
        <div className="flex items-center gap-3 text-white/30">
          <span className="material-symbols-outlined text-2xl">browser_not_supported</span>
          <div>
            <p className="text-xs font-bold">Push notifications not supported</p>
            <p className="text-[10px] mt-0.5">Try using Chrome, Edge, or Samsung Internet</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* OS-Level Push Toggle */}
      <div className="bg-primary rounded-2xl p-6 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative overflow-hidden group">
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-secondary/5 rounded-full blur-3xl group-hover:bg-secondary/10 transition-colors duration-500" />
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-xl">
                  notifications_active
                </span>
                OS Push Notifications
              </h3>
              <p className="text-[11px] font-bold text-white/30 uppercase tracking-widest mt-1">
                Real-time alerts even when app is closed
              </p>
            </div>

            {pushEnabled ? (
              <button
                onClick={disablePushNotifications}
                className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">notifications_off</span>
                Disable
              </button>
            ) : (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleEnablePush}
                disabled={isEnabling}
                className="px-5 py-2.5 bg-gradient-to-r from-secondary to-[#008f10] text-white text-sm font-black rounded-xl shadow-lg shadow-secondary/30 hover:shadow-secondary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isEnabling ? (
                  <>
                    <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
                    Enabling...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">notifications</span>
                    Enable Push
                  </>
                )}
              </motion.button>
            )}
          </div>

          {pushEnabled && (
            <div className="flex items-center gap-2 bg-secondary/10 border border-secondary/20 rounded-lg p-3 mt-3">
              <span className="material-symbols-outlined text-secondary text-lg">check_circle</span>
              <p className="text-xs text-white/70 font-medium">
                Push notifications are <span className="text-secondary font-bold">active</span> on this device
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Notification Type Preferences */}
      {pushEnabled && (
        <div className="bg-primary rounded-2xl p-6 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
          <h3 className="text-base font-bold text-white mb-1">Notification Types</h3>
          <p className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-5">
            Choose what alerts you want
          </p>

          <div className="space-y-3">
            {Object.entries(prefs).map(([key, enabled]) => (
              <div 
                key={key} 
                className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-300 ${
                  enabled ? 'bg-secondary/5 border-secondary/20' : 'bg-white/5 border-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    enabled ? 'bg-secondary text-white' : 'bg-white/10 text-white/40'
                  }`}>
                    <span className="material-symbols-outlined text-[18px]">
                      {PREF_ICONS[key] || "notifications"}
                    </span>
                  </div>
                  <span className={`text-xs font-bold capitalize tracking-tight transition-colors ${
                    enabled ? 'text-white' : 'text-white/50'
                  }`}>
                    {key.replace('_', ' ')}
                  </span>
                </div>
                
                <button
                  onClick={() => toggle(key as keyof typeof prefs)}
                  className={`w-10 h-5 rounded-full transition-all duration-500 relative ${
                    enabled ? 'bg-secondary' : 'bg-white/10'
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
          
          <p className="mt-5 text-[10px] text-white/20 text-center font-medium">
            Preferences sync across all your devices
          </p>
        </div>
      )}
    </div>
  );
}