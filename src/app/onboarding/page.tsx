"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  parseCollegeDomain,
  detectCollegeType,
  getDegreesForDepartment,
  getBranchesForDepartment,
  ACADEMIC_YEARS,
} from "@/lib/college-utils";

type Department = "MEDICAL" | "ENGINEERING" | "ARTS";

const DEPARTMENTS = [
  { id: "ENGINEERING" as const, label: "Engineering", subtitle: "Technical & Applied Sciences", icon: "engineering" },
  { id: "MEDICAL" as const, label: "Medical", subtitle: "Health & Life Sciences", icon: "medical_services" },
  { id: "ARTS" as const, label: "Arts", subtitle: "Creative & Liberal Arts", icon: "palette" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [department, setDepartment] = useState<Department | null>(null);
  const [degree, setDegree] = useState("");
  const [branch, setBranch] = useState("");
  const [year, setYear] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const degrees = department ? getDegreesForDepartment(department) : [];
  const branches = department ? getBranchesForDepartment(department) : [];

  async function handleSubmit() {
    if (!department || !degree || !branch || !year) {
      setError("Please complete all fields.");
      return;
    }

    setSubmitting(true);
    setError("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      router.push("/login");
      return;
    }

    const collegeDomain = parseCollegeDomain(user.email);
    const collegeType = detectCollegeType(collegeDomain);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        college_domain: collegeDomain,
        college_type: collegeType,
        department,
        degree,
        branch,
        year_of_study: year,
      })
      .eq("id", user.id);

    if (updateError) {
      setError("Failed to save. Please try again.");
      setSubmitting(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 md:py-24 -mt-16">
      {/* Decorative elements */}
      <div className="fixed top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-secondary to-primary z-[100]" />
      <div className="fixed -bottom-24 -left-24 w-96 h-96 bg-secondary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed -top-24 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-4xl w-full space-y-12 relative z-10">
        {/* Header */}
        <header className="text-center space-y-4">
          <span className="font-label text-secondary font-semibold tracking-widest uppercase text-xs">
            Institutional Onboarding
          </span>
          <h1 className="font-headline text-4xl md:text-5xl font-bold tracking-tight text-primary">
            Define Your Academic Identity
          </h1>
          <p className="font-body text-on-surface-variant max-w-lg mx-auto">
            Welcome to Campus Share. Let&apos;s personalize your experience by establishing your current academic standing.
          </p>
        </header>

        {/* Bento Grid Form */}
        <div className="grid grid-cols-12 gap-6">
          {/* Step 1: Department */}
          <div className="col-span-12 md:col-span-8 space-y-6">
            <div className="flex items-center space-x-3">
              <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">1</span>
              <h2 className="font-headline text-xl font-semibold">Select Department</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {DEPARTMENTS.map((dept) => (
                <button
                  key={dept.id}
                  type="button"
                  onClick={() => { setDepartment(dept.id); setDegree(""); setBranch(""); }}
                  className={`group relative bg-surface-container-lowest p-6 rounded-xl cursor-pointer transition-all flex flex-col items-start space-y-4 border-2 ${
                    department === dept.id
                      ? "border-secondary"
                      : "border-outline-variant/20 hover:border-secondary/50"
                  }`}
                >
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${
                    department === dept.id ? "bg-secondary-container" : "bg-surface-container group-hover:bg-secondary-container"
                  }`}>
                    <span className="material-symbols-outlined text-primary">{dept.icon}</span>
                  </div>
                  <div>
                    <h3 className="font-headline text-lg font-bold">{dept.label}</h3>
                    <p className="text-sm text-on-surface-variant">{dept.subtitle}</p>
                  </div>
                  {department === dept.id && (
                    <div className="absolute top-4 right-4 text-secondary">
                      <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="hidden md:block col-span-4 bg-primary text-white rounded-xl p-8 space-y-6 shadow-xl">
            <h3 className="font-headline text-xl">Verification Note</h3>
            <p className="text-on-primary-container text-sm leading-relaxed">
              Your identity defines the academic resources, peer networks, and exclusive campus hubs you will access.
            </p>
            <div className="pt-6 border-t border-white/20 space-y-4">
              <div className="flex items-center space-x-3 opacity-60">
                <span className="material-symbols-outlined text-sm">lock</span>
                <span className="text-xs uppercase tracking-widest font-semibold">Institutional Security</span>
              </div>
            </div>
          </div>

          {/* Step 2: Degree */}
          <div className="col-span-12 md:col-span-6 space-y-6">
            <div className="flex items-center space-x-3">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${department ? "bg-primary text-white" : "bg-surface-container-highest text-on-surface"}`}>2</span>
              <h2 className={`font-headline text-xl font-semibold ${department ? "text-primary" : "text-on-surface-variant"}`}>Degree Program</h2>
            </div>
            <div className="relative">
              <select
                value={degree}
                onChange={(e) => setDegree(e.target.value)}
                disabled={!department}
                className="w-full bg-surface-container-lowest p-4 rounded-xl appearance-none font-body text-on-surface border border-outline-variant/20 focus:border-primary focus:ring-0 disabled:opacity-50"
              >
                <option value="">Select your degree...</option>
                {degrees.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <span className="material-symbols-outlined text-outline">expand_more</span>
              </div>
            </div>
          </div>

          {/* Step 3: Branch */}
          <div className="col-span-12 md:col-span-6 space-y-6">
            <div className="flex items-center space-x-3">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${degree ? "bg-primary text-white" : "bg-surface-container-highest text-on-surface"}`}>3</span>
              <h2 className={`font-headline text-xl font-semibold ${degree ? "text-primary" : "text-on-surface-variant"}`}>Specialization / Branch</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {branches.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBranch(b)}
                  disabled={!degree}
                  className={`px-5 py-2 rounded-full text-sm font-medium transition-all disabled:opacity-40 ${
                    branch === b
                      ? "border border-secondary bg-secondary/5 text-secondary font-semibold"
                      : "border border-outline-variant text-on-surface-variant hover:border-primary"
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          {/* Step 4: Academic Year */}
          <div className="col-span-12 space-y-6">
            <div className="flex items-center space-x-3">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${branch ? "bg-primary text-white" : "bg-surface-container-highest text-on-surface"}`}>4</span>
              <h2 className={`font-headline text-xl font-semibold ${branch ? "text-primary" : "text-on-surface-variant"}`}>Academic Year</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {ACADEMIC_YEARS.slice(0, 4).map((ay) => (
                <button
                  key={ay.value}
                  type="button"
                  onClick={() => setYear(ay.value)}
                  disabled={!branch}
                  className={`p-4 rounded-xl text-center cursor-pointer transition-all group disabled:opacity-40 ${
                    year === ay.value
                      ? "bg-primary text-white border-2 border-primary"
                      : "bg-surface-container-lowest border border-outline-variant/20 hover:bg-primary hover:text-white"
                  }`}
                >
                  <p className="font-headline font-bold text-lg">{ay.label}</p>
                  <p className={`text-xs ${year === ay.value ? "text-white/70" : "text-on-surface-variant group-hover:text-white/70"}`}>{ay.subtitle}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="col-span-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center space-x-2 text-on-surface-variant text-sm">
              <span className="material-symbols-outlined text-secondary">verified_user</span>
              <span>Your data remains encrypted and institutional only.</span>
            </div>
            {error && <p className="text-error text-sm font-medium">{error}</p>}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !department || !degree || !branch || !year}
              className="w-full md:w-auto px-12 py-4 bg-primary text-white rounded-xl font-headline font-bold text-lg hover:shadow-2xl hover:-translate-y-1 transition-all flex items-center justify-center space-x-3 disabled:opacity-50"
            >
              <span>{submitting ? "Setting up..." : "Initialize Profile"}</span>
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
