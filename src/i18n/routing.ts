export const locales = ["de", "en", "it"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "de";

export function isLocale(value: string | undefined): value is Locale {
  return locales.includes(value as Locale);
}
