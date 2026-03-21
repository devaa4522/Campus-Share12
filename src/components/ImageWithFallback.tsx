"use client";

import Image from "next/image";
import { useAppStore } from "@/lib/store";
import {
  Stethoscope,
  Wrench,
  Palette,
  FlaskConical,
  ImageIcon,
} from "lucide-react";

const ICON_MAP: Record<string, React.ElementType> = {
  Medical: Stethoscope,
  Engineering: Wrench,
  Arts: Palette,
  Science: FlaskConical,
};

interface ImageWithFallbackProps {
  src: string | null | undefined;
  alt: string;
  category?: string | null;
  width?: number;
  height?: number;
  fill?: boolean;
  className?: string;
  priority?: boolean;
}

export default function ImageWithFallback({
  src,
  alt,
  category,
  width,
  height,
  fill,
  className = "",
  priority = false,
}: ImageWithFallbackProps) {
  const lowBandwidth = useAppStore((s) => s.lowBandwidth);

  if (lowBandwidth || !src) {
    const Icon = (category && ICON_MAP[category]) || ImageIcon;
    return (
      <div
        className={`flex items-center justify-center bg-surface-container-low text-on-surface-variant ${className}`}
        style={!fill ? { width, height } : undefined}
      >
        <Icon className="w-12 h-12 opacity-40" />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={fill ? undefined : (width ?? 400)}
      height={fill ? undefined : (height ?? 300)}
      fill={fill}
      className={className}
      priority={priority}
    />
  );
}
