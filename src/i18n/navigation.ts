import { type Locale } from "./routing";
import { getActiveFarmConfig, type FarmAppConfig } from "@/lib/app/farm-config";

export type NavItem = {
  href: string;
  label: string;
};

export function createNavigation(locale: Locale, farmConfig: FarmAppConfig = getActiveFarmConfig()): NavItem[] {
  const base = `/${locale}`;
  const { customLabels, enabledModules } = farmConfig;

  return [
    { href: `${base}/dashboard`, label: "Dashboard" },
    enabledModules.machines ? { href: `${base}/machines`, label: customLabels.machinesLabel } : null,
    enabledModules.dailyUsage ? { href: `${base}/daily-usage`, label: customLabels.dailyUsageLabel } : null,
    enabledModules.maintenance ? { href: `${base}/maintenance`, label: customLabels.maintenanceLabel } : null,
    enabledModules.costs ? { href: `${base}/costs`, label: customLabels.costsLabel } : null,
    enabledModules.settings ? { href: `${base}/settings`, label: "Einstellungen" } : null
  ].filter((item): item is NavItem => item !== null);
}
