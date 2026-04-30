"use client";

import type { ReactNode } from "react";
import { Skeleton } from "boneyard-js/react";

interface BoneyardSkeletonProps {
  name: string;
  loading?: boolean;
  children: ReactNode;
  fixture?: ReactNode;
  fallback?: ReactNode;
  className?: string;
  stagger?: number | boolean;
  transition?: number | boolean;
}

export function BoneyardSkeleton({
  name,
  loading = true,
  children,
  fixture,
  fallback,
  className,
  stagger = 45,
  transition = 180,
}: BoneyardSkeletonProps) {
  const placeholder = fallback ?? children;

  return (
    <Skeleton
      name={name}
      loading={loading}
      fixture={fixture ?? placeholder}
      fallback={placeholder}
      animate="shimmer"
      stagger={stagger}
      transition={transition}
      className={className}
    >
      {children}
    </Skeleton>
  );
}
