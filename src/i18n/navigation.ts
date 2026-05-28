import { type Locale } from "./routing";

export type NavItem = {
  href: string;
  label: string;
};

export function createNavigation(locale: Locale): NavItem[] {
  const base = `/${locale}`;

  return [
    { href: `${base}/dashboard`, label: "Dashboard" },
    { href: `${base}/machines`, label: "Maschinen" },
    { href: `${base}/daily-usage`, label: "Tagesstand" },
    { href: `${base}/maintenance`, label: "Wartung" },
    { href: `${base}/costs`, label: "Kosten" },
    { href: `${base}/settings`, label: "Einstellungen" }
  ];
}
