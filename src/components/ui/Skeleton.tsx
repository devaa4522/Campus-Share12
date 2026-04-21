import React from "react";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className = "", ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-surface-container-high rounded-md ${className}`}
      {...props}
    >
      <div className="w-full h-full shimmer rounded-md" />
    </div>
  );
}
