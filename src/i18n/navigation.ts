import { type Locale } from "./routing";
import { getActiveFarmConfig, type FarmAppConfig } from "@/lib/app/farm-config";

export type NavItem = {
  href: string;
  label: string;
};

export function createNavigation(locale: Locale, farmConfig: FarmAppConfig = getActiveFarmConfig()): NavItem[] {
  const base = `/${locale}`;
  const { enabledModules } = farmConfig;

  return [
    { href: `${base}/dashboard`, label: "Dashboard" },
    enabledModules.machines ? { href: `${base}/machines`, label: "Maschinen" } : null,
    enabledModules.settings ? { href: `${base}/settings`, label: "Einstellungen" } : null
  ].filter((item): item is NavItem => item !== null);
}
