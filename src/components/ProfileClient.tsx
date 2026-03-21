"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { Profile } from "@/lib/types";
import { getBranchesForDepartment } from "@/lib/college-utils";
import imageCompression from "browser-image-compression";

interface Props {
  profile: Profile;
  email: string;
  itemCount: number;
}

const ACADEMIC_YEARS = [
  "First Year (Freshman)",
  "Second Year (Sophomore)",
  "Third Year (Junior)",
  "Fourth Year (Senior)",
  "Graduate Student",
];

export default function ProfileClient({ profile: initialProfile, email, itemCount }: Props) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Form fields
  const [bio, setBio] = useState(profile.bio ?? "");
  const [branch, setBranch] = useState(profile.branch ?? "");
  const [yearOfStudy, setYearOfStudy] = useState(profile.year_of_study ?? "");
  const [fullName, setFullName] = useState(profile.full_name ?? "");

  const branches = getBranchesForDepartment(profile.department ?? "");
  const trustScore = Math.min(100, Math.round(((profile.karma_score ?? 0) / 2000) * 100));

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
      router.refresh();
    }
    setSaving(false);
  }

  function handleCancel() {
    setBio(profile.bio ?? "");
    setBranch(profile.branch ?? "");
    setYearOfStudy(profile.year_of_study ?? "");
    setFullName(profile.full_name ?? "");
  }

  return (
    <main className="pt-8 pb-32 px-4 max-w-5xl mx-auto">
      {/* Header */}
      <header className="mb-10 text-center md:text-left">
        <h1 className="font-headline text-4xl font-bold tracking-tight text-primary mb-2">Edit Profile</h1>
        <p className="text-on-surface-variant font-medium">Update your digital identity within the campus ecosystem.</p>
      </header>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Profile Overview Card */}
        <div className="md:col-span-8 bg-surface-container-lowest rounded-xl p-8 shadow-[0_12px_32px_rgba(0,10,30,0.06)] flex flex-col md:flex-row gap-8 items-center md:items-start">
          <div className="relative">
            <div className="w-32 h-32 rounded-full overflow-hidden bg-surface-container-high ring-4 ring-surface-container-lowest">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={fullName || "Profile"} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-on-surface-variant">
                  {(fullName || "U").charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <label className="absolute bottom-0 right-0 bg-primary text-white p-2 rounded-full shadow-lg flex items-center justify-center hover:bg-primary/80 transition-colors cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              <span className="material-symbols-outlined text-sm">edit</span>
            </label>
          </div>
          <div className="flex-1 space-y-4 text-center md:text-left">
            <div className="flex flex-col md:flex-row md:items-center gap-3 justify-center md:justify-start">
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="font-headline text-2xl font-semibold bg-transparent border-none focus:ring-0 p-0 text-center md:text-left"
                placeholder="Your Name"
              />
              {profile.is_verified && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full text-xs font-bold uppercase tracking-wider">
                  <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                  Verified Student
                </div>
              )}
            </div>
            <p className="text-on-surface-variant text-sm">{email} • {itemCount} listings</p>
            <div className="flex flex-wrap gap-2 justify-center md:justify-start pt-2">
              {profile.department && (
                <span className="px-3 py-1 bg-surface-container-low text-on-surface-variant text-xs rounded-lg font-semibold tracking-wide border border-outline-variant/20">
                  {profile.department}
                </span>
              )}
              {profile.degree && (
                <span className="px-3 py-1 bg-surface-container-low text-on-surface-variant text-xs rounded-lg font-semibold tracking-wide border border-outline-variant/20">
                  {profile.degree}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Account Status Card */}
        <div className="md:col-span-4 bg-primary-container rounded-xl p-8 flex flex-col justify-between text-white overflow-hidden relative">
          <div className="relative z-10">
            <h3 className="font-headline text-xl mb-4">Account Status</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="opacity-70">Trust Score</span>
                <span className="font-bold">{trustScore}/100</span>
              </div>
              <div className="w-full bg-white/10 h-1.5 rounded-full">
                <div className="bg-secondary-fixed h-full rounded-full transition-all" style={{ width: `${trustScore}%` }} />
              </div>
              <p className="text-xs opacity-60 leading-relaxed italic">
                {trustScore > 80
                  ? '"Your reputation as a reliable campus peer is outstanding."'
                  : '"Keep building trust by completing more exchanges."'
                }
              </p>
            </div>
          </div>
          <div className="absolute -right-4 -bottom-4 opacity-10">
            <span className="material-symbols-outlined text-8xl">shield_person</span>
          </div>
        </div>

        {/* Main Edit Form */}
        <div className="md:col-span-12 bg-surface-container-lowest rounded-xl p-10 shadow-[0_12px_32px_rgba(0,10,30,0.06)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
            {/* Bio */}
            <div className="md:col-span-2 space-y-2">
              <label className="font-headline text-sm font-semibold text-on-surface">Bio</label>
              <div className="border border-outline-variant/20 focus-within:border-primary rounded-lg bg-surface-container-low overflow-hidden transition-colors">
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, 160))}
                  className="w-full bg-transparent border-none focus:ring-0 p-4 text-on-surface placeholder:text-outline"
                  placeholder="Tell the campus community about yourself..."
                  rows={4}
                />
              </div>
              <p className="text-[11px] text-on-surface-variant uppercase tracking-widest font-bold">
                Character limit: {bio.length}/160
              </p>
            </div>

            {/* Branch */}
            <div className="space-y-2">
              <label className="font-headline text-sm font-semibold text-on-surface">Academic Branch</label>
              <div className="border border-outline-variant/20 focus-within:border-primary rounded-lg bg-surface-container-low overflow-hidden transition-colors">
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full bg-transparent border-none focus:ring-0 p-4 text-on-surface appearance-none"
                >
                  <option value="">Select branch...</option>
                  {branches.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Year */}
            <div className="space-y-2">
              <label className="font-headline text-sm font-semibold text-on-surface">Academic Year</label>
              <div className="border border-outline-variant/20 focus-within:border-primary rounded-lg bg-surface-container-low overflow-hidden transition-colors">
                <select
                  value={yearOfStudy}
                  onChange={(e) => setYearOfStudy(e.target.value)}
                  className="w-full bg-transparent border-none focus:ring-0 p-4 text-on-surface appearance-none"
                >
                  <option value="">Select year...</option>
                  {ACADEMIC_YEARS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* College Domain (Read-only) */}
            <div className="space-y-2">
              <label className="font-headline text-sm font-semibold text-on-surface">College Domain</label>
              <div className="border border-outline-variant/20 rounded-lg bg-surface-container-low overflow-hidden">
                <input
                  value={profile.college_domain ?? "Not set"}
                  disabled
                  className="w-full bg-transparent border-none focus:ring-0 p-4 text-on-surface-variant"
                />
              </div>
            </div>

            {/* Email (Read-only) */}
            <div className="space-y-2">
              <label className="font-headline text-sm font-semibold text-on-surface">Institutional Email</label>
              <div className="border border-outline-variant/20 rounded-lg bg-surface-container-low overflow-hidden">
                <input
                  value={email}
                  disabled
                  className="w-full bg-transparent border-none focus:ring-0 p-4 text-on-surface-variant"
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="mt-12 pt-8 border-t border-surface-container flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined text-secondary">lock_open</span>
              <span className="text-xs font-semibold uppercase tracking-wider">Privacy Settings: Campus Only</span>
            </div>
            <div className="flex items-center gap-4 w-full md:w-auto">
              {saved && (
                <span className="text-secondary font-medium text-sm flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  Saved!
                </span>
              )}
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 md:flex-none px-8 py-3 rounded-lg border border-outline-variant font-semibold text-on-surface-variant hover:bg-surface-container-low transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 md:flex-none px-10 py-3 rounded-lg bg-secondary text-white font-bold shadow-lg shadow-secondary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>

        {/* Preference Toggles */}
        <div className="md:col-span-6 bg-surface-container-lowest rounded-xl p-6 shadow-[0_12px_32px_rgba(0,10,30,0.06)] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary-container flex items-center justify-center text-secondary-fixed">
              <span className="material-symbols-outlined">notifications_active</span>
            </div>
            <div>
              <h4 className="font-headline font-semibold">Activity Alerts</h4>
              <p className="text-xs text-on-surface-variant">Push notifications for tasks</p>
            </div>
          </div>
          <div className="w-12 h-6 bg-secondary rounded-full relative cursor-pointer">
            <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
          </div>
        </div>

        <div className="md:col-span-6 bg-surface-container-lowest rounded-xl p-6 shadow-[0_12px_32px_rgba(0,10,30,0.06)] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">visibility</span>
            </div>
            <div>
              <h4 className="font-headline font-semibold">Public Profile</h4>
              <p className="text-xs text-on-surface-variant">Visible to campus peers</p>
            </div>
          </div>
          <div className="w-12 h-6 bg-surface-dim rounded-full relative cursor-pointer">
            <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full" />
          </div>
        </div>

        {/* Sign Out */}
        <div className="md:col-span-12 flex justify-center pt-4">
          <a
            href="/auth/signout"
            className="text-sm font-medium text-on-surface-variant hover:text-error transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined">logout</span>
            Sign out
          </a>
        </div>
      </div>
    </main>
  );
}
