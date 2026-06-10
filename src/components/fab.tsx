"use client";

type FabProps = {
  icon?: string;
  label: string;
  onClick: () => void;
  show?: boolean;
};

export function Fab({ icon = "+", label, onClick, show = true }: FabProps) {
  if (!show) return null;
  return (
    <button
      type="button"
      className="fab"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}
