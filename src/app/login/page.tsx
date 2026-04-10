"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { parseCollegeDomain, detectCollegeType } from "@/lib/college-utils";

type AuthMode = "signin" | "signup";

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLoginSuccess(destination: string, setOnboardingCookie: boolean = false) {
    // 1. Sync onboarding short-circuit cookie if user has passed onboarding
    if (setOnboardingCookie) {
      document.cookie = "onboarding_passed=true; path=/; max-age=31536000; SameSite=Lax";
    }

    // 2. Signal the Service Worker to clear caches
    // This prevents the SW from serving a cached "Guest" version of the destination
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
    }

    // 3. Implement a micro-delay handshake (100ms)
    // Ensures the cookie write and SW message are prioritized before the redirect
    setTimeout(() => {
      window.location.href = destination;
    }, 100);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();

    if (mode === "signup") {
      const { data: signUpData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      if (signUpData.user) {
        const domain = parseCollegeDomain(email);
        const collegeType = detectCollegeType(domain);
        await supabase.from("profiles").update({
          college_domain: domain,
          college_type: collegeType,
          full_name: fullName,
        }).eq("id", signUpData.user.id);
      }

      // Hard redirect to onboarding (don't set onboarding cookie yet)
      await handleLoginSuccess('/onboarding', false);
      return;
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
    }

    // For existing users: check if they have completed onboarding
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("college_domain, department")
        .eq("id", currentUser.id)
        .single();
      
      if (!profile?.department) {
        await handleLoginSuccess('/onboarding', false);
        return;
      }
    }

    // Successful login for authenticated user - set onboarding cookie
    await handleLoginSuccess('/', true);
  }

  return (
    <div className="min-h-full px-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center pt-16">
        {/* Left Column: Branding */}
        <div className="lg:col-span-5 space-y-8">
          <div className="space-y-4">
            <h1 className="font-headline text-5xl font-extrabold tracking-tight leading-tight text-primary-container">
              Campus Share: The private marketplace for{" "}
              <span className="italic text-secondary">your campus.</span>
            </h1>
            <p className="text-on-surface-variant leading-relaxed font-light text-lg">
              Exchange insights, resources, and intellectual capital exclusively 
              within your verified academic network.
            </p>
          </div>
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-surface-container-low rounded-full border border-outline-variant/20">
            <span
              className="material-symbols-outlined text-secondary text-sm"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              verified
            </span>
            <span className="font-label text-xs uppercase tracking-widest font-semibold text-on-surface-variant">
              Academic Integrity Certified
            </span>
          </div>
        </div>

        {/* Right Column: Auth Form */}
        <div className="lg:col-span-7">
          <div className="glass-card rounded-xl p-8 shadow-[0_12px_32px_rgba(0,10,30,0.06)] border border-outline-variant/10">
            {/* Mode Toggle */}
            <div className="flex gap-1 mb-8 bg-surface-container-low rounded-lg p-1">
              <button
                type="button"
                onClick={() => { setMode("signin"); setError(null); }}
                className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all ${
                  mode === "signin"
                    ? "bg-white text-primary shadow-sm"
                    : "text-on-surface-variant hover:text-primary"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode("signup"); setError(null); }}
                className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all ${
                  mode === "signup"
                    ? "bg-white text-primary shadow-sm"
                    : "text-on-surface-variant hover:text-primary"
                }`}
              >
                Create Account
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {mode === "signup" && (
                <div className="space-y-2">
                  <label className="font-headline text-sm font-bold text-primary">
                    FULL NAME
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full p-4 bg-surface-container-low ghost-border rounded-lg text-on-surface placeholder:text-outline-variant font-body"
                    placeholder="e.g. Julian Thorne"
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="font-headline text-sm font-bold text-primary">
                  EMAIL ADDRESS
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-4 bg-surface-container-low ghost-border rounded-lg text-on-surface placeholder:text-outline-variant font-body"
                  placeholder="you@university.edu"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="font-headline text-sm font-bold text-primary">
                  PASSWORD
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-4 bg-surface-container-low ghost-border rounded-lg text-on-surface placeholder:text-outline-variant font-body"
                  placeholder="Minimum 6 characters"
                  minLength={6}
                  required
                />
              </div>

              {error && (
                <div className="p-4 bg-error-container rounded-lg text-on-error-container text-sm font-medium">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-primary-container text-white rounded-lg font-label text-sm font-bold shadow-lg shadow-primary-container/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
              >
                {loading
                  ? "Processing..."
                  : mode === "signin"
                  ? "Sign In to Exchange"
                  : "Create Account"}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Footer Highlights */}
      <section className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-8 bg-surface-container-low rounded-xl space-y-4">
          <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>
            security
          </span>
          <h3 className="font-headline text-lg font-bold">Verified Domains</h3>
          <p className="text-sm text-on-surface-variant font-light">
            Only active faculty and students with valid institutional email addresses can participate.
          </p>
        </div>
        <div className="p-8 bg-surface-container-low rounded-xl space-y-4">
          <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>
            history_edu
          </span>
          <h3 className="font-headline text-lg font-bold">Citation Integrity</h3>
          <p className="text-sm text-on-surface-variant font-light">
            Every resource includes persistent meta-data for academic attribution.
          </p>
        </div>
        <div className="p-8 bg-surface-container-low rounded-xl space-y-4">
          <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>
            hub
          </span>
          <h3 className="font-headline text-lg font-bold">Global Network</h3>
          <p className="text-sm text-on-surface-variant font-light">
            Connect across 400+ partner institutions worldwide.
          </p>
        </div>
      </section>
    </div>
  );
}
