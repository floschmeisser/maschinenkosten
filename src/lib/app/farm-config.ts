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

export type FarmProfileKey = "default" | "dairy" | "arable";
export type DashboardFocusItem = "today" | "maintenance" | "dailyUsage" | "machines" | "costs" | "hectares";

export type FarmAppConfig = {
  branding: FarmBrandingConfig;
  dashboardFocus: DashboardFocusItem[];
  enabledModules: FarmModuleConfig;
  customLabels: {
    machinesLabel: string;
    maintenanceLabel: string;
    dailyUsageLabel: string;
    costsLabel: string;
  };
};

export type FarmAppConfigOverride = {
  branding?: Partial<FarmBrandingConfig>;
  dashboardFocus?: DashboardFocusItem[];
  enabledModules?: Partial<FarmModuleConfig>;
  customLabels?: Partial<FarmAppConfig["customLabels"]>;
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

export const demoDairyFarmConfig: FarmAppConfig = {
  branding: {
    appName: "MaschinenKosten Milch",
    farmName: "Milchhof Demo",
    logoPath: "/assets/logo.svg",
    primaryColor: "#2f7d32",
    accentColor: "#f4b942",
    backgroundColor: "#fff8e8",
    welcomeTitle: "Heute im Stall und am Hof",
    welcomeSubtitle: "Tagesstand, Wartung und aktive Maschinen zuerst."
  },
  dashboardFocus: ["dailyUsage", "today", "maintenance", "machines"],
  enabledModules: {
    machines: true,
    maintenance: true,
    dailyUsage: true,
    costs: true,
    settings: true
  },
  customLabels: {
    machinesLabel: "Hofmaschinen",
    maintenanceLabel: "Service",
    dailyUsageLabel: "Tagesstand",
    costsLabel: "Kosten"
  }
};

export const demoArableFarmConfig: FarmAppConfig = {
  branding: {
    appName: "MaschinenKosten Acker",
    farmName: "Ackerbau Demo",
    logoPath: "/assets/logo.svg",
    primaryColor: "#3f7f2f",
    accentColor: "#d9a441",
    backgroundColor: "#fff5dc",
    welcomeTitle: "Heute am Feld",
    welcomeSubtitle: "Maschinen, Kosten und Hektarleistung im Blick."
  },
  dashboardFocus: ["machines", "costs", "hectares", "maintenance", "dailyUsage"],
  enabledModules: {
    machines: true,
    maintenance: true,
    dailyUsage: true,
    costs: true,
    settings: true
  },
  customLabels: {
    machinesLabel: "Fuhrpark",
    maintenanceLabel: "Wartung",
    dailyUsageLabel: "Feldstand",
    costsLabel: "Kosten"
  }
};

export function getFarmConfig(farmKey: FarmProfileKey = "default", override?: FarmAppConfigOverride): FarmAppConfig {
  const baseConfig = getBaseFarmConfig(farmKey);
  return override ? mergeFarmConfig(baseConfig, override) : baseConfig;
}

export function getActiveFarmConfig(farmKey: FarmProfileKey = "default", override?: FarmAppConfigOverride): FarmAppConfig {
  return getFarmConfig(farmKey, override);
}

export function mergeFarmConfig(baseConfig: FarmAppConfig, override: FarmAppConfigOverride): FarmAppConfig {
  return {
    branding: {
      ...baseConfig.branding,
      ...override.branding
    },
    dashboardFocus: override.dashboardFocus ?? baseConfig.dashboardFocus,
    enabledModules: {
      ...baseConfig.enabledModules,
      ...override.enabledModules
    },
    customLabels: {
      ...baseConfig.customLabels,
      ...override.customLabels
    }
  };
}

function getBaseFarmConfig(farmKey: FarmProfileKey): FarmAppConfig {
  if (farmKey === "dairy") {
    return demoDairyFarmConfig;
  }

  if (farmKey === "arable") {
    return demoArableFarmConfig;
  }

  return defaultFarmConfig;
}
