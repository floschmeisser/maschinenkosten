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
  return new Intl.DateTimeFormat(locale).format(new Date(value));
}
