export function formatCurrency(value: number, locale = "de-DE", currency = "EUR"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(value);
}

export function formatNumber(value: number, locale = "de-DE"): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1
  }).format(value);
}

export function formatDate(value: string, locale = "de-DE"): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "–";
  return new Intl.DateTimeFormat(locale).format(d);
}

export function formatLongDate(value: string, locale = "de-DE"): string {
  const d = new Date(value.slice(0, 10) + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "–";
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(d);
}
