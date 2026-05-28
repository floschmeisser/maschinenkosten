"use client";

type GlobalSearchProps = {
  placeholder: string;
};

export function GlobalSearch({ placeholder }: GlobalSearchProps) {
  return (
    <label className="search">
      <span className="sr-only">Suche</span>
      <input type="search" placeholder={placeholder} />
    </label>
  );
}
