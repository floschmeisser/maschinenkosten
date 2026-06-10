"use client";

type SkeletonCardProps = {
  width?: string;
  height?: string;
};

export function SkeletonCard({ width = "100%", height = "80px" }: SkeletonCardProps) {
  return (
    <div
      className="skeleton-card"
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}
