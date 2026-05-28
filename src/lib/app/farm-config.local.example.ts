import type { FarmAppConfigOverride } from "./farm-config";

// Copy this file to `src/lib/app/farm-config.local.ts` for a sold customer app.
// The copied file is ignored by Git, so customer-specific branding stays local to that project.
//
// Change only customer-facing branding, colors, enabled modules, dashboard focus and labels here.
// Do not put business rules, database access, secrets, API keys or farm data in this file.
// Keep core logic in `src/lib/app` and keep customer-specific assets under `public/assets`.
export const localFarmConfigOverride: FarmAppConfigOverride = {
  branding: {
    appName: "MaschinenKosten Musterhof",
    farmName: "Musterhof Familie Bauer",
    // Replace with a customer logo, for example `/assets/musterhof-logo.svg`.
    logoPath: "/assets/logo.svg",
    // Use strong outdoor-readable colors. Primary should stay a field/dark green.
    primaryColor: "#2f7d32",
    accentColor: "#f4b942",
    backgroundColor: "#fff8e8",
    welcomeTitle: "Heute",
    welcomeSubtitle: "Musterhof. Maschinen. Wartung."
  },
  // Keep the dashboard short. Use only the most important modules for this farm.
  dashboardFocus: ["dailyUsage", "maintenance", "machines", "costs"],
  // Disable modules only if the sold app should not show them at all.
  enabledModules: {
    machines: true,
    maintenance: true,
    dailyUsage: true,
    costs: true,
    settings: true
  },
  // Labels may be adapted to the wording used on that farm.
  customLabels: {
    machinesLabel: "Fuhrpark",
    maintenanceLabel: "Service",
    dailyUsageLabel: "Tagesstand",
    costsLabel: "Kosten"
  }
};
