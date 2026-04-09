"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { createClient } from "@/utils/supabase/client";
import { postItemSchema, type PostItemFormData } from "@/lib/types";
import { getCategoriesForDepartment, getConditionsForDepartment, LOAN_DURATIONS, type CollegeType, type CategoryItem } from "@/lib/college-utils";
import imageCompression from "browser-image-compression";

const STEPS = [
  { id: "details", label: "Details", sublabel: "Step 1" },
  { id: "classification", label: "Classification", sublabel: "Step 2" },
  { id: "pricing", label: "Pricing & Value", sublabel: "Step 3" },
  { id: "media", label: "Media Upload", sublabel: "Step 4" },
] as const;

export default function PostPage() {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(0);
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [collegeType, setCollegeType] = useState<CollegeType>("GENERAL");
  const [collegeDomain, setCollegeDomain] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PostItemFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(postItemSchema) as any,
    defaultValues: {
      price_type: "Free",
      price_amount: 0,
    },
  });

  const priceType = watch("price_type");
  const categories = getCategoriesForDepartment(collegeType);
  const conditions = getConditionsForDepartment(collegeType === "GENERAL" ? "" : collegeType);

  // Auth + profile check
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      const { data: profile } = await supabase
        .from("profiles")
        .select("college_domain, college_type")
        .eq("id", user.id)
        .single();
      if (!profile?.college_domain) { router.push("/onboarding"); return; }
      setCollegeDomain(profile.college_domain);
      setCollegeType((profile.college_type as CollegeType) ?? "GENERAL");
      setAuthChecked(true);
    });
  }, [router]);

  // Intersection Observer for scroll-linked stepper
  useEffect(() => {
    if (!authChecked) return;
    const observers: IntersectionObserver[] = [];
    sectionRefs.current.forEach((section, index) => {
      if (!section) return;
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setActiveStep(index);
            }
          });
        },
        { threshold: 0.1, rootMargin: "-20% 0px -50% 0px" }
      );
      observer.observe(section);
      observers.push(observer);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, [authChecked]);

  function scrollToSection(index: number) {
    sectionRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleImageAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const remaining = 4 - images.length;
    const toAdd = files.slice(0, remaining);
    const compressed = await Promise.all(
      toAdd.map((f) => imageCompression(f, { maxSizeMB: 0.2, maxWidthOrHeight: 1200, useWebWorker: true }))
    );
    setImages((prev) => [...prev, ...compressed]);
    setImagePreviews((prev) => [...prev, ...compressed.map((f) => URL.createObjectURL(f))]);
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSubmit(data: PostItemFormData) {
    setSubmitting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const imageUrls: string[] = [];
    for (const file of images) {
      const filePath = `items/${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.webp`;
      const { error } = await supabase.storage.from("item-images").upload(filePath, file);
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from("item-images").getPublicUrl(filePath);
        imageUrls.push(publicUrl);
      }
    }

    const { error: insertError } = await supabase.from("items").insert({
      user_id: user.id,
      title: data.title,
      description: data.description,
      category: data.category,
      condition: data.condition,
      price_type: data.price_type,
      price_amount: data.price_type === "Free" ? 0 : (data.price_amount ?? 0),
      status: "available",
      images: imageUrls,
      college_domain: collegeDomain,
    });

    if (insertError) {
      console.error("Insert error:", insertError);
      setSubmitting(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  function handleCategorySelect(cat: CategoryItem) {
    setSelectedCategory(cat.id);
    setValue("category", cat.label);
  }

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center min-h-full">
        <div className="animate-pulse text-on-surface-variant">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto flex flex-col lg:flex-row">
      {/* ─── Desktop Sidebar Stepper ─── */}
      <aside className="sticky top-16 max-h-[calc(100vh-4rem)] w-72 hidden lg:flex flex-col flex-shrink-0 p-8 border-r border-slate-200/30 bg-slate-50 overflow-y-auto">
        <div className="mb-10">
          <h2 className="font-headline italic text-secondary text-2xl leading-tight">Create Listing</h2>
          <p className="text-xs uppercase tracking-[0.2em] text-outline font-bold mt-1">Institutional Marketplace</p>
        </div>
        <nav className="flex flex-col gap-6">
          {STEPS.map((step, index) => (
            <button
              key={step.id}
              type="button"
              onClick={() => scrollToSection(index)}
              className={`flex items-center gap-4 p-3 rounded-lg transition-all duration-200 hover:translate-x-1 group text-left ${
                activeStep === index
                  ? "bg-white shadow-sm font-bold text-primary"
                  : "text-slate-500 hover:bg-slate-200/50"
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                activeStep === index ? "border-2 border-primary text-primary" : "border border-outline-variant text-on-surface-variant"
              }`}>
                {index + 1}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-tighter text-outline font-medium">{step.sublabel}</span>
                <span className="text-sm">{step.label}</span>
              </div>
            </button>
          ))}
        </nav>
        <div className="mt-auto pt-8">
          <div className="p-4 bg-primary-container rounded-xl text-white">
            <p className="text-xs opacity-70 mb-2">Listing Quality</p>
            <div className="h-1 bg-white/20 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-secondary"
                animate={{ width: `${((activeStep + 1) / 4) * 100}%` }}
              />
            </div>
            <p className="text-[10px] mt-2 font-medium">Complete more steps to increase visibility.</p>
          </div>
        </div>
      </aside>

      {/* ─── Mobile Segment Bar ─── */}
      <div className="lg:hidden fixed top-16 left-0 w-full z-40 bg-surface-container-lowest border-b border-outline-variant/10">
        <div className="flex w-full h-12">
          {STEPS.map((step, index) => (
            <button
              key={step.id}
              type="button"
              onClick={() => scrollToSection(index)}
              className={`flex-1 flex flex-col items-center justify-center border-b-2 ${
                activeStep === index ? "border-secondary" : "border-outline-variant/20"
              }`}
            >
              <span className={`text-[10px] font-bold tracking-widest uppercase ${
                activeStep === index ? "text-secondary" : "text-outline"
              }`}>
                {step.sublabel}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Form Canvas ─── */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex-grow p-6 md:p-12 lg:max-w-4xl space-y-16 pt-40 lg:pt-12"
      >
        {/* Step 1: Essentials */}
        <section ref={(el) => { sectionRefs.current[0] = el; }} className="scroll-mt-32" id="step-1">
          <div className="mb-8">
            <h3 className="font-headline text-3xl tracking-tight text-primary">Essentials</h3>
            <p className="text-on-surface-variant mt-2">Define the core identity of your item with precision.</p>
          </div>
          <div className="grid grid-cols-1 gap-6 bg-surface-container-lowest p-8 rounded-xl shadow-[0_12px_32px_rgba(0,10,30,0.04)] border border-outline-variant/10">
            <div className="space-y-2">
              <label className="font-headline text-sm font-semibold text-primary block">Item Title</label>
              <input
                {...register("title")}
                className="w-full bg-surface-container-low border border-outline-variant/20 focus:border-primary focus:ring-0 rounded-lg px-4 py-3 text-on-surface transition-all"
                placeholder="e.g. Organic Chemistry 8th Edition"
              />
              {errors.title && <p className="text-error text-xs font-medium">{errors.title.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="font-headline text-sm font-semibold text-primary block">Detailed Description</label>
              <textarea
                {...register("description")}
                className="w-full bg-surface-container-low border border-outline-variant/20 focus:border-primary focus:ring-0 rounded-lg px-4 py-3 text-on-surface transition-all"
                placeholder="Highlight key features, specific use-cases, or any minor imperfections..."
                rows={5}
              />
              {errors.description && <p className="text-error text-xs font-medium">{errors.description.message}</p>}
            </div>
          </div>
        </section>

        {/* Step 2: Classification (Adaptive Category Grid) */}
        <section ref={(el) => { sectionRefs.current[1] = el; }} className="scroll-mt-32" id="step-2">
          <div className="mb-8">
            <div className="flex items-center gap-3">
              <h3 className="font-headline text-3xl tracking-tight text-primary">Classification</h3>
              <span className="px-2 py-0.5 rounded bg-secondary-container/30 text-secondary text-[10px] font-bold uppercase tracking-widest">Adaptive</span>
            </div>
            <p className="text-on-surface-variant mt-2">Help the right students find your listing faster.</p>
          </div>

          {/* Category Bento Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategorySelect(cat)}
                className={`p-6 rounded-xl transition-all flex flex-col items-center justify-center text-center gap-3 h-36 ${
                  selectedCategory === cat.id
                    ? "bg-primary text-white shadow-xl"
                    : "bg-surface-container-low hover:bg-white hover:shadow-lg"
                }`}
              >
                <span
                  className={`material-symbols-outlined text-3xl ${
                    selectedCategory === cat.id ? "text-white" : "text-secondary"
                  }`}
                  style={selectedCategory === cat.id ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {cat.icon}
                </span>
                <p className="font-headline font-bold text-sm">{cat.label}</p>
                {cat.description && (
                  <p className={`text-[10px] ${selectedCategory === cat.id ? "text-white/70" : "text-on-surface-variant"}`}>
                    {cat.description}
                  </p>
                )}
              </button>
            ))}
          </div>
          <input type="hidden" {...register("category")} />
          {errors.category && <p className="text-error text-xs font-medium mb-4">{errors.category.message}</p>}

          {/* Condition */}
          <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10">
            <label className="font-headline text-sm font-semibold text-primary mb-3 block">Condition</label>
            <select
              {...register("condition")}
              className="w-full bg-surface-container-low border-none rounded-lg px-4 py-3 text-on-surface text-sm appearance-none"
            >
              <option value="">Select condition...</option>
              {conditions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {errors.condition && <p className="text-error text-xs font-medium mt-1">{errors.condition.message}</p>}
          </div>
        </section>

        {/* Step 3: Pricing & Value */}
        <section ref={(el) => { sectionRefs.current[2] = el; }} className="scroll-mt-32" id="step-3">
          <div className="mb-8">
            <h3 className="font-headline text-3xl tracking-tight text-primary">Pricing & Value</h3>
            <p className="text-on-surface-variant mt-2">Set your terms. Choose between karma or currency.</p>
          </div>
          <div className="bg-surface-container-lowest p-8 rounded-xl border border-outline-variant/10">
            {/* Pill Toggle */}
            <div className="flex flex-wrap gap-4 mb-8">
              {(["Free", "Karma", "Rental"] as const).map((pt) => (
                <label
                  key={pt}
                  className={`flex-1 min-w-[120px] px-6 py-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col items-center gap-1 ${
                    priceType === pt
                      ? "border-primary bg-primary text-white font-bold"
                      : "border-outline-variant bg-white text-on-surface hover:border-primary"
                  }`}
                >
                  <input type="radio" {...register("price_type")} value={pt} className="hidden" />
                  <span className="material-symbols-outlined">
                    {pt === "Free" ? "volunteer_activism" : pt === "Karma" ? "stars" : "payments"}
                  </span>
                  <span className="text-sm">{pt}</span>
                </label>
              ))}
            </div>

            {/* Conditional Input */}
            <div className="bg-surface-container-low p-8 rounded-xl flex items-center justify-center min-h-[140px]">
              {priceType === "Free" && (
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="inline-flex items-center gap-2 bg-secondary/10 text-secondary px-6 py-2 rounded-full font-bold text-sm tracking-wide">
                    <span className="material-symbols-outlined text-lg">verified</span>
                    COMMUNITY CONTRIBUTION
                  </div>
                  <p className="text-sm text-outline max-w-xs">
                    Sharing for free boosts your trust score and earns you a &lsquo;Donor&rsquo; badge.
                  </p>
                </div>
              )}
              {priceType === "Rental" && (
                <div className="w-full max-w-sm space-y-4">
                  <label className="font-headline text-sm font-semibold text-primary block text-center">Rental Amount (Daily)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-bold">$</span>
                    <input
                      type="number"
                      {...register("price_amount")}
                      className="w-full bg-white border-none rounded-lg pl-10 pr-4 py-4 text-xl font-bold focus:ring-2 ring-primary/20"
                      placeholder="0.00"
                    />
                  </div>
                  {errors.price_amount && <p className="text-error text-xs font-medium">{errors.price_amount.message}</p>}
                </div>
              )}
              {priceType === "Karma" && (
                <div className="w-full max-w-sm space-y-4">
                  <label className="font-headline text-sm font-semibold text-primary block text-center">Karma Points Required</label>
                  <input
                    type="number"
                    {...register("price_amount")}
                    className="w-full bg-white border-none rounded-lg px-4 py-4 text-xl font-bold text-center focus:ring-2 ring-primary/20"
                    placeholder="Points Amount"
                  />
                  {errors.price_amount && <p className="text-error text-xs font-medium">{errors.price_amount.message}</p>}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Step 4: Media Upload */}
        <section ref={(el) => { sectionRefs.current[3] = el; }} className="scroll-mt-32 pb-20" id="step-4">
          <div className="mb-8">
            <h3 className="font-headline text-3xl tracking-tight text-primary">Media Upload</h3>
            <p className="text-on-surface-variant mt-2">Visual clarity increases transaction speed by 40%.</p>
          </div>

          {imagePreviews.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {imagePreviews.map((src, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden group">
                  <img src={src} alt={`Upload ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute inset-0 bg-primary/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <span className="material-symbols-outlined text-white">delete</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {images.length < 4 && (
            <label className="group relative bg-surface-container-lowest p-2 rounded-2xl border border-outline-variant/10 block cursor-pointer">
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageAdd} />
              <div className="border-2 border-dashed border-outline-variant/50 rounded-xl p-16 flex flex-col items-center justify-center text-center transition-all group-hover:border-primary/40 group-hover:bg-primary/5">
                <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mb-6 text-primary group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-4xl">cloud_upload</span>
                </div>
                <h4 className="text-xl font-bold text-primary mb-2">Drag and drop high-res images</h4>
                <p className="text-on-surface-variant text-sm max-w-sm">
                  Recommended: 4 photos from multiple angles ({4 - images.length} remaining)
                </p>
              </div>
            </label>
          )}

          <div className="mt-12 flex justify-end gap-4">
            <button
              type="submit"
              disabled={submitting}
              className="px-10 py-3 rounded-lg font-bold text-white bg-gradient-to-r from-primary to-primary-container shadow-xl hover:shadow-2xl transition-all active:scale-95 disabled:opacity-50"
            >
              {submitting ? "Publishing..." : "Publish Listing"}
            </button>
          </div>
        </section>
      </form>
    </div>
  );
}
