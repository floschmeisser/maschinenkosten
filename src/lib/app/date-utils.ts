export function safeDateParse(value: unknown): Date | null {
  if (!value || typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function safeDateOnly(value: unknown): Date | null {
  if (!value || typeof value !== "string") return null;
  const d = new Date(value.slice(0, 10) + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

export function safeDateFormat(
  value: unknown,
  fallback: string = "—",
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
  },
): string {
  const date = safeDateParse(value);
  if (!date) return fallback;
  return date.toLocaleDateString("de-AT", options);
}
