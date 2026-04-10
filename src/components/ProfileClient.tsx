"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { Profile } from "@/lib/types";
import { getBranchesForDepartment } from "@/lib/college-utils";
import imageCompression from "browser-image-compression";
import Image from "next/image";

interface Props {
  profile: Profile;
  email: string;
  itemCount: number;
  recentExchanges: any[];
  reliableCategories: { name: string; count: number }[];
}

const ACADEMIC_YEARS = [
  "First Year (Freshman)",
  "Second Year (Sophomore)",
  "Third Year (Junior)",
  "Fourth Year (Senior)",
  "Graduate Student",
];

export default function ProfileClient({ profile: initialProfile, email, itemCount, recentExchanges, reliableCategories }: Props) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Time-based re-render for countdowns
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Form fields
  const [bio, setBio] = useState(profile.bio ?? "");
  const [branch, setBranch] = useState(profile.branch ?? "");
  const [yearOfStudy, setYearOfStudy] = useState(profile.year_of_study ?? "");
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [notificationsEnabled, setNotificationsEnabled] = useState(profile.notifications_enabled ?? true);
  const [profilePublic, setProfilePublic] = useState(profile.profile_public ?? true);

  const branches = getBranchesForDepartment(profile.department ?? "");
  const trustScore = Math.min(100, Math.round(((profile.karma_score ?? 0) / 2000) * 100));

  // Determine shadowban status safely (with tick dependency for live updates)
  const isBanned = Boolean(profile?.banned_until && new Date(profile.banned_until).getTime() > new Date().getTime());
  const distance = isBanned ? new Date(profile.banned_until!).getTime() - new Date().getTime() : 0;
  const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  const s = Math.floor((distance % (1000 * 60)) / 1000);
  const timeLeftStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const compressed = await imageCompression(file, { maxSizeMB: 0.2, maxWidthOrHeight: 400 });
    const supabase = createClient();
    const filePath = `avatars/${profile.id}/${Date.now()}.webp`;
    const { error } = await supabase.storage.from("item-images").upload(filePath, compressed);
    if (error) return;

    const { data: { publicUrl } } = supabase.storage.from("item-images").getPublicUrl(filePath);
    await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", profile.id);
    setProfile((p) => ({ ...p, avatar_url: publicUrl }));
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({
      full_name: fullName,
      bio,
      branch,
      year_of_study: yearOfStudy,
    }).eq("id", profile.id);

    if (!error) {
      setProfile((p) => ({ ...p, full_name: fullName, bio, branch, year_of_study: yearOfStudy }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  }

  function handleCancel() {
    setBio(profile.bio ?? "");
    setBranch(profile.branch ?? "");
    setYearOfStudy(profile.year_of_study ?? "");
    setFullName(profile.full_name ?? "");
    setIsEditing(false);
  }

  async function toggleNotifications() {
    const newValue = !notificationsEnabled;
    setNotificationsEnabled(newValue);
    const supabase = createClient();
    await supabase.from("profiles").update({ notifications_enabled: newValue }).eq("id", profile.id);
  }

  async function togglePublicProfile() {
    const newValue = !profilePublic;
    setProfilePublic(newValue);
    const supabase = createClient();
    await supabase.from("profiles").update({ profile_public: newValue }).eq("id", profile.id);
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    
    // Clear the performance short-circuit cookie
    document.cookie = "onboarding_passed=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    
    // Signal the Service Worker to purge all CacheStorage
    // This prevents stale Turbopack chunks from poisoning the next session
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
    }
    
    // Clear local storage and enforce a hard reload to the landing page
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/';
  }

  return (
    <main className="pt-8 pb-32 px-4 max-w-5xl mx-auto">
      {/* Header */}
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between text-center md:text-left gap-6">
        <div>
          <h1 className="font-headline text-4xl font-bold tracking-tight text-primary mb-2">My Profile</h1>
          <p className="text-on-surface-variant font-medium">Manage your digital identity and reputation insights.</p>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-[#000a1e] text-white rounded-lg font-bold shadow-md hover:bg-[#000a1e]/90 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">edit</span>
            Edit Portfolio
          </button>
        )}
      </header>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Profile Overview Card */}
        <div className="md:col-span-8 bg-surface-container-lowest rounded-xl p-8 shadow-[0_12px_32px_rgba(0,10,30,0.06)] flex flex-col md:flex-row gap-8 items-center md:items-start">
          <div className="relative">
            <div className="w-32 h-32 rounded-full overflow-hidden bg-surface-container-high ring-4 ring-surface-container-lowest relative">
              {profile.avatar_url ? (
                <Image src={profile.avatar_url} alt={fullName || "Profile"} fill sizes="128px" className="object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-on-surface-variant">
                  {(fullName || "U").charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 space-y-4 text-center md:text-left">
            <div className="flex flex-col md:flex-row md:items-center gap-3 justify-center md:justify-start">
              <h2 className="font-headline text-2xl font-semibold bg-transparent border-none focus:ring-0 p-0 text-center md:text-left">{fullName || "Your Name"}</h2>
              {profile.is_verified && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#006e0c]/10 text-[#006e0c] rounded-full text-xs font-bold uppercase tracking-wider border border-[#006e0c]/20">
                  <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                  Verified Student
                </div>
              )}
            </div>
            <p className="text-on-surface-variant text-sm">{email} • {itemCount} listings</p>
            <p className="text-on-surface-variant text-sm italic py-2">{profile.bio ? `"${profile.bio}"` : ""}</p>
            <div className="flex flex-wrap gap-2 justify-center md:justify-start pt-2">
              {profile.department && (
                <span className="px-3 py-1 bg-surface-container-low text-[#000a1e] text-xs rounded-lg font-bold tracking-wide border border-outline-variant/20 shadow-sm">
                  {profile.department}
                </span>
              )}
              {profile.year_of_study && (
                <span className="px-3 py-1 bg-surface-container-low text-[#000a1e] text-xs rounded-lg font-bold tracking-wide border border-outline-variant/20 shadow-sm">
                  {profile.year_of_study}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Trust Score & Badges Card */}
        <div className="md:col-span-4 bg-[#000a1e] rounded-xl p-8 flex flex-col justify-between text-white overflow-hidden relative shadow-[0_12px_32px_rgba(0,10,30,0.15)]">
          <div className="relative z-10">
            <h3 className="font-headline text-xl mb-6 font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-[#006e0c]">verified</span>
              Campus Trust
            </h3>
            <div className="space-y-5">
              <div className="flex justify-between items-baseline">
                <span className="opacity-80 text-sm font-medium tracking-wide">Reliability Score</span>
                <span className="font-black text-2xl text-[#006e0c] drop-shadow-sm">{trustScore}%</span>
              </div>
              <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                <div className="bg-[#006e0c] h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${trustScore}%` }} />
              </div>
              <div className="p-4 bg-white/5 rounded-lg border border-white/10 backdrop-blur-sm">
                <p className="text-xs opacity-80 leading-relaxed font-medium">
                  {trustScore >= 90
                    ? '"Elite Sharer. Your peers consider you exceptionally reliable."'
                    : trustScore >= 50
                      ? '"Active Peer. Keep completing exchanges to build your reputation."'
                      : '"Caution: Low reliability. Fulfill your task claims to improve."'}
                </p>
              </div>
            </div>
          </div>
          <div className="absolute -right-10 -bottom-10 opacity-5 pointer-events-none">
            <span className="material-symbols-outlined text-[150px]">hub</span>
          </div>
        </div>

        {/* --- Trust & Safety Console (Private) --- */}
        <div className="md:col-span-12 bg-surface-container-lowest rounded-xl p-8 shadow-[0_12px_32px_rgba(0,10,30,0.06)] border-t-4 border-[#006e0c]">
          <h2 className="text-2xl font-headline font-bold mb-6 text-[#000a1e] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#006e0c]">admin_panel_settings</span>
            Trust & Safety Console
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Sanctions & Ban Status */}
            <div className="space-y-4">
              {isBanned && (
                <div className="flex items-start gap-4 p-5 bg-[#ba1a1a]/10 rounded-xl border border-[#ba1a1a]/20">
                  <span className="material-symbols-outlined text-[#ba1a1a] text-3xl">gavel</span>
                  <div>
                    <h4 className="font-bold text-[#ba1a1a] mb-1">Account Shadowbanned</h4>
                    <p className="text-xs text-on-surface-variant leading-relaxed mb-3">
                      Your listings are temporarily hidden from the Hub due to multiple community reports.
                    </p>
                    <div className="inline-flex items-center gap-2 bg-[#ba1a1a] text-white px-3 py-1.5 rounded text-xs font-bold tracking-widest uppercase">
                      <span className="material-symbols-outlined text-[14px]">timer</span>
                      Lifts in {timeLeftStr}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Flags Gauge */}
            <div className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/20">
              <h3 className="text-sm font-bold mb-4 flex items-center gap-2 text-[#000a1e]">
                <span className="material-symbols-outlined text-outline text-[20px]">flag</span>
                Active Safety Flags
              </h3>

              {(() => {
                const flagsCount = profile.flags_count ?? 0;
                const maxFlags = 12;
                const fillWidth = Math.min(100, (flagsCount / maxFlags) * 100);
                let colorClass = "bg-[#006e0c]";
                if (flagsCount >= 3 && flagsCount <= 5) colorClass = "bg-[#eab308]";
                if (flagsCount >= 6) colorClass = "bg-[#ba1a1a]";

                return (
                  <>
                    <div className="h-3 w-full bg-surface-container-highest rounded-full overflow-hidden mb-3 relative shadow-inner">
                      <div className={`h-full rounded-full transition-all duration-1000 ${colorClass}`} style={{ width: `${fillWidth}%` }}></div>
                      {/* Demarcation markers for 3, 6, 9 flags */}
                      <div className="absolute top-0 bottom-0 left-[25%] border-l border-white/50 w-px"></div>
                      <div className="absolute top-0 bottom-0 left-[50%] border-l border-white/50 w-px"></div>
                      <div className="absolute top-0 bottom-0 left-[75%] border-l border-white/50 w-px"></div>
                    </div>
                    <div className="flex justify-between items-center text-xs font-semibold">
                      <span className="text-on-surface-variant">{flagsCount} Flags</span>
                      <span className="text-outline uppercase tracking-widest text-[10px]">Max {maxFlags}</span>
                    </div>
                    {flagsCount > 0 && (
                      <p className="mt-3 text-[11px] text-on-surface-variant italic leading-relaxed">
                        Flags slowly decay over time. Excessive flags result in automated shadowbans.
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>



        {/* --- Category Reliability --- */}
        <div className="md:col-span-12 bg-surface-container-lowest rounded-xl p-8 shadow-[0_12px_32px_rgba(0,10,30,0.06)] border border-outline-variant/20 mt-2">
          <h2 className="text-2xl font-headline font-bold mb-6 text-[#000a1e] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#006e0c]">workspace_premium</span>
            Category Reliability
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {reliableCategories.length > 0 ? (
              reliableCategories.map((cat, idx) => (
                <div key={idx} className="p-5 bg-surface-container-low rounded-xl border border-outline-variant/30 flex flex-col gap-2 items-center text-center">
                  <span className="text-xl font-bold text-[#000a1e]">{cat.count}</span>
                  <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">{cat.name} Tracker</span>
                </div>
              ))
            ) : (
              <div className="col-span-full py-8 text-center text-on-surface-variant text-sm border-2 border-dashed border-outline-variant/20 rounded-xl">
                No completed exchanges yet. Complete deals to build Category Reliability.
              </div>
            )}
          </div>
        </div>

        {/* --- Recent Exchanges --- */}
        <div className="md:col-span-12 bg-surface-container-lowest rounded-xl p-8 shadow-[0_12px_32px_rgba(0,10,30,0.06)] border border-outline-variant/20 mt-2">
          <h2 className="text-2xl font-headline font-bold mb-6 text-[#000a1e] flex items-center gap-2">
            <span className="material-symbols-outlined text-outline">history</span>
            Recent Exchanges
          </h2>
          <div className="flex flex-col gap-3">
            {recentExchanges.length > 0 ? (
              recentExchanges.map((excl, i) => (
                <div key={i} className="flex justify-between items-center p-4 border border-outline-variant/30 rounded-lg bg-surface-container-lowest hover:bg-surface-container transition-colors cursor-pointer" onClick={() => router.push(`/items/${excl.item_id}`)}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-surface-container-highest rounded flex items-center justify-center text-on-surface-variant">
                      <span className="material-symbols-outlined">inventory_2</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-[#000a1e] text-sm">{excl.items?.title || "Unknown Listing"}</h4>
                      <p className="text-xs text-on-surface-variant">{new Date(excl.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-[#006e0c]/10 text-[#006e0c] rounded text-[11px] font-bold uppercase tracking-wider">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    Successful Trade
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center py-10 border-2 border-dashed border-outline-variant/20 rounded-xl">
                <p className="text-on-surface-variant text-sm font-medium flex items-center gap-2">
                  <span className="material-symbols-outlined text-outline">hourglass_empty</span>
                  No recent exchanges to display.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Preference Toggles */}
        <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-[0_12px_32px_rgba(0,10,30,0.06)] flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${notificationsEnabled ? "bg-primary-container text-secondary-fixed" : "bg-surface-container text-outline"}`}>
                <span className="material-symbols-outlined">notifications_active</span>
              </div>
              <div>
                <h4 className="font-headline font-semibold">Activity Alerts</h4>
                <p className="text-xs text-on-surface-variant">Push notifications for tasks</p>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleNotifications}
              className={`w-12 h-6 rounded-full relative transition-colors ${notificationsEnabled ? "bg-secondary" : "bg-surface-dim"}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${notificationsEnabled ? "right-1" : "left-1"}`} />
            </button>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-[0_12px_32px_rgba(0,10,30,0.06)] flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${profilePublic ? "bg-primary-container text-secondary-fixed" : "bg-surface-container text-outline"}`}>
                <span className="material-symbols-outlined">visibility</span>
              </div>
              <div>
                <h4 className="font-headline font-semibold">Public Profile</h4>
                <p className="text-xs text-on-surface-variant">Visible to campus peers</p>
              </div>
            </div>
            <button
              type="button"
              onClick={togglePublicProfile}
              className={`w-12 h-6 rounded-full relative transition-colors ${profilePublic ? "bg-secondary" : "bg-surface-dim"}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${profilePublic ? "right-1" : "left-1"}`} />
            </button>
          </div>
        </div>

        {/* Sign Out Trigger */}
        <div className="md:col-span-12 flex justify-center pt-4">
          <button
            onClick={() => setIsSignOutModalOpen(true)}
            className="text-sm font-medium text-on-surface-variant hover:text-[#ba1a1a] transition-colors flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-[#ba1a1a]/10"
          >
            <span className="material-symbols-outlined">logout</span>
            Sign out
          </button>
        </div>
      </div>

      {/* Profile Edit Modal (Institutional V2) */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" style={{ margin: 0 }}>
          {/* Backdrop */}
          <div onClick={handleCancel} className="absolute inset-0 bg-[#000a1e]/60 backdrop-blur-sm animate-in fade-in duration-200"></div>
          
          {/* Modal Content */}
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 border border-outline-variant/20">
            {/* Header */}
            <div className="px-6 py-4 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container-lowest shrink-0">
              <h2 className="text-xl font-headline font-bold text-[#000a1e]">Edit Portfolio</h2>
              <button onClick={handleCancel} className="p-2 text-on-surface-variant hover:text-[#000a1e] hover:bg-surface-container rounded-full transition-colors active:scale-95">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            
            {/* Body */}
            <div className="p-8 overflow-y-auto space-y-8 flex-1 bg-surface-container-lowest">
              
              {/* Avatar & Name Row */}
              <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-outline-variant/10">
                <div className="relative shrink-0">
                  <div className="w-32 h-32 rounded-2xl overflow-hidden bg-surface-container-high focus-within:ring-4 focus-within:ring-[#006e0c]/20 transition-all border-4 border-white shadow-sm relative">
                    {profile.avatar_url ? (
                      <Image src={profile.avatar_url} alt="Profile" fill sizes="128px" className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-5xl font-bold text-on-surface-variant">
                        {(fullName || "U").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <label className="absolute -bottom-2 -right-2 bg-[#006e0c] text-white p-2 rounded-xl shadow-lg flex items-center justify-center hover:bg-[#006e0c]/90 transition-colors cursor-pointer border-2 border-white transform hover:scale-105 active:scale-95">
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                  </label>
                </div>
                
                <div className="flex-1 w-full space-y-2">
                  <label className="font-headline text-sm font-semibold text-[#000a1e]">Given Name</label>
                  <div className="relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline-variant group-focus-within:text-[#006e0c] transition-colors">person</span>
                    <input
                      type="text"
                      className="w-full pl-12 pr-4 py-3 bg-surface-container-low border border-outline-variant/30 rounded-xl focus:border-[#006e0c] focus:ring-1 focus:ring-[#006e0c] focus:bg-white text-[#000a1e] transition-all outline-none font-medium"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Your Full Name"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Branch */}
                <div className="space-y-2">
                  <label className="font-headline text-sm font-semibold text-[#000a1e]">Academic Department</label>
                  <div className="relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline-variant pointer-events-none group-focus-within:text-[#006e0c] transition-colors">domain</span>
                    <select
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      className="w-full pl-12 pr-10 py-3 bg-surface-container-low border border-outline-variant/30 rounded-xl focus:border-[#006e0c] focus:ring-1 focus:ring-[#006e0c] focus:bg-white appearance-none outline-none text-[#000a1e] font-medium transition-all"
                    >
                      <option value="">Select branch...</option>
                      {branches.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline-variant pointer-events-none">expand_more</span>
                  </div>
                </div>

                {/* Year */}
                <div className="space-y-2">
                  <label className="font-headline text-sm font-semibold text-[#000a1e]">Academic Year</label>
                  <div className="relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline-variant pointer-events-none group-focus-within:text-[#006e0c] transition-colors">history_edu</span>
                    <select
                      value={yearOfStudy}
                      onChange={(e) => setYearOfStudy(e.target.value)}
                      className="w-full pl-12 pr-10 py-3 bg-surface-container-low border border-outline-variant/30 rounded-xl focus:border-[#006e0c] focus:ring-1 focus:ring-[#006e0c] focus:bg-white appearance-none outline-none text-[#000a1e] font-medium transition-all"
                    >
                      <option value="">Select year...</option>
                      {ACADEMIC_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline-variant pointer-events-none">expand_more</span>
                  </div>
                </div>

                {/* Bio */}
                <div className="md:col-span-2 space-y-2 pt-2">
                  <div className="flex justify-between items-center">
                    <label className="font-headline text-sm font-semibold text-[#000a1e]">Bio & Professional Summary</label>
                    <span className="text-[11px] text-[#000a1e]/60 font-bold bg-[#000a1e]/5 px-2.5 py-1 rounded-full uppercase tracking-wider">{bio.length}/160</span>
                  </div>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value.slice(0, 160))}
                    className="w-full p-4 bg-surface-container-low border border-outline-variant/30 rounded-xl focus:border-[#006e0c] focus:ring-1 focus:ring-[#006e0c] focus:bg-white transition-all outline-none resize-none text-[#000a1e] leading-relaxed"
                    placeholder="Tell the campus community about your academic focus and goals..."
                    rows={4}
                  />
                </div>
              </div>

            </div>
            
            {/* Footer */}
            <div className="px-6 py-5 border-t border-outline-variant/20 bg-surface-container-low flex flex-col sm:flex-row items-center justify-between shrink-0 gap-4 sm:gap-0">
              <div className="flex items-center gap-2 text-on-surface-variant w-full sm:w-auto justify-center sm:justify-start">
                <span className="material-symbols-outlined text-[#006e0c] text-[18px]">lock</span>
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#000a1e]/60">Privacy Locked</span>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button type="button" onClick={handleCancel} className="px-5 py-2.5 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container-high transition-colors text-sm border border-transparent hover:border-outline-variant/30 flex-1 sm:flex-none">
                  Cancel
                </button>
                <button type="button" onClick={handleSave} disabled={saving} className="px-8 py-2.5 rounded-xl bg-[#006e0c] hover:bg-[#006e0c]/90 shadow-md hover:shadow-lg text-white font-bold transition-all active:scale-95 text-sm disabled:opacity-50 flex items-center justify-center gap-2 flex-1 sm:flex-none">
                  {saving ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                      Saving...
                    </>
                  ) : "Save Changes"}
                </button>
              </div>
            </div>
            
          </div>
        </div>
      )}

      {/* Sign Out Confirmation Modal */}
      {isSignOutModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6" style={{ margin: 0 }}>
          {/* Backdrop */}
          <div onClick={() => !isSigningOut && setIsSignOutModalOpen(false)} className="absolute inset-0 bg-[#000a1e]/60 backdrop-blur-sm animate-in fade-in duration-200"></div>
          
          {/* Modal Content */}
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col p-8 text-center animate-in fade-in zoom-in-95 duration-200 border border-outline-variant/20">
            <div className="w-16 h-16 bg-[#ba1a1a]/10 text-[#ba1a1a] rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[32px]">logout</span>
            </div>
            
            <h2 className="text-xl font-headline font-bold text-[#000a1e] mb-2">Sign Out</h2>
            <p className="text-sm text-on-surface-variant leading-relaxed mb-8">
              Are you sure you want to sign out? You will need to log back in to access the Campus Share hub.
            </p>
            
            <div className="flex items-center gap-3 w-full">
              <button 
                type="button" 
                onClick={() => setIsSignOutModalOpen(false)} 
                disabled={isSigningOut}
                className="px-5 py-2.5 flex-1 rounded-xl font-bold bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high transition-colors text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleSignOut} 
                disabled={isSigningOut}
                className="px-5 py-2.5 flex-1 rounded-xl bg-[#ba1a1a] hover:bg-[#ba1a1a]/90 shadow-md text-white font-bold transition-all active:scale-95 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSigningOut ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                    Wait...
                  </>
                ) : (
                  "Sign Out"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
