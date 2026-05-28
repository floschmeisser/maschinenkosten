export type FarmBrandingConfig = {
  appName: string;
  farmName: string;
  logoPath: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  welcomeTitle: string;
  welcomeSubtitle: string;
};

export type FarmModuleConfig = {
  machines: boolean;
  maintenance: boolean;
  dailyUsage: boolean;
  costs: boolean;
  settings: boolean;
};

export type FarmAppConfig = {
  branding: FarmBrandingConfig;
  dashboardFocus: Array<"today" | "maintenance" | "dailyUsage" | "machines" | "costs">;
  enabledModules: FarmModuleConfig;
  customLabels: {
    machinesLabel: string;
    maintenanceLabel: string;
    dailyUsageLabel: string;
    costsLabel: string;
  };
};

export const defaultFarmConfig: FarmAppConfig = {
  branding: {
    appName: "MaschinenKosten",
    farmName: "Mein Betrieb",
    logoPath: "/assets/logo.svg",
    primaryColor: "#2f7d32",
    accentColor: "#f4b942",
    backgroundColor: "#fff8e8",
    welcomeTitle: "Heute am Betrieb",
    welcomeSubtitle: "Die wichtigsten Maschinen, Wartungen und Kosten auf einen Blick."
  },
  dashboardFocus: ["today", "maintenance", "dailyUsage", "machines", "costs"],
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

export function getFarmConfig(): FarmAppConfig {
  return defaultFarmConfig;
}
