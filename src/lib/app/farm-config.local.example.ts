import type { FarmAppConfigOverride } from "./farm-config";

// Copy this file to `src/lib/app/farm-config.local.ts` for a sold customer app.
// The copied file is ignored by Git, so customer-specific branding stays local to that project.
export const localFarmConfigOverride: FarmAppConfigOverride = {
  branding: {
    appName: "MaschinenKosten Musterhof",
    farmName: "Musterhof Familie Bauer",
    logoPath: "/assets/logo.svg",
    primaryColor: "#2f7d32",
    accentColor: "#f4b942",
    backgroundColor: "#fff8e8",
    welcomeTitle: "Heute am Musterhof",
    welcomeSubtitle: "Maschinen, Wartung und Kosten fuer den Betrieb."
  },
  dashboardFocus: ["dailyUsage", "maintenance", "machines", "costs"],
  enabledModules: {
    machines: true,
    maintenance: true,
    dailyUsage: true,
    costs: true,
    settings: true
  },
  customLabels: {
    machinesLabel: "Maschinen",
    maintenanceLabel: "Wartung",
    dailyUsageLabel: "Tagesstand",
    costsLabel: "Kosten"
  }
};
