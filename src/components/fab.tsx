"use client";

type FabProps = {
  icon?: string;
  label: string;
  onClick: () => void;
};

export function Fab({ icon = "+", label, onClick }: FabProps) {
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
