"use client";

import { CardGridSkeleton, PageSkeleton } from "@/components/boneyard/PageSkeletons";

export default function BoneyardCapturePage() {
  return (
    <main className="min-h-screen bg-surface p-4">
      <div className="mx-auto flex max-w-7xl flex-col gap-10">
        <section className="rounded-3xl border border-outline-variant/20 bg-surface-container-lowest p-6">
          <h1 className="text-xl font-bold text-on-surface">Boneyard Capture</h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            This route exists only for boneyard-js skeleton generation.
          </p>
        </section>

        <PageSkeleton name="home" variant="home" />
        <PageSkeleton name="hub" variant="hub" />
        <PageSkeleton name="search" variant="search" />
        <PageSkeleton name="tasks" variant="tasks" />
        <PageSkeleton name="dashboard" variant="deals" />
        <PageSkeleton name="messages" variant="messages" />
        <PageSkeleton name="notifications" variant="notifications" />
        <PageSkeleton name="post" variant="form" />
        <PageSkeleton name="profile" variant="profile" />
        <PageSkeleton name="item-detail" variant="item" />
        <PageSkeleton name="login" variant="auth" />
        <PageSkeleton name="onboarding" variant="form" />

        <CardGridSkeleton name="shared-card-grid" />
      </div>
    </main>
  );
}
