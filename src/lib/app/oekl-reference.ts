import type { MachineCategory } from "./machines";

export type OeklCostInputs = {
  purchasePrice: number;
  residualValuePct: number;
  expectedUsefulLifeYears: number;
  annualOperatingHours: number;
  annualKilometers: number | null;
  insurancePerYear: number;
  taxPerYear: number;
  storagePerYear: number;
  otherFixedCostsPerYear: number;
  maintenanceCostsPerYear: number;
  repairCostsPerYear: number;
  fuelCostsPerHour: number;
  operatorCostsPerHour: number;
  otherVariableCostsPerHour: number;
  hectaresPerHour: number | null;
};

export type OeklCategoryReference = {
  label: string;
  unit: "hours" | "km";
  defaults: OeklCostInputs;
};

// ÖKL-Richtwert hier eintragen — Werte auf 0 belassen bis offizielle ÖKL-Tabellen vorliegen.
// Quelle: ÖKL-Richtwerte für Maschinenselbstkosten (jährlich aktualisiert, KFZ-Richtwerte separat).
const OEKL_CATEGORIES: Record<string, OeklCategoryReference> = {
  tractor_small: {
    label: "Traktor klein (bis 60 kW)",
    unit: "hours",
    defaults: {
      purchasePrice: 0, // ÖKL-Richtwert hier eintragen
      residualValuePct: 10,
      expectedUsefulLifeYears: 0, // ÖKL-Richtwert hier eintragen
      annualOperatingHours: 0, // ÖKL-Richtwert hier eintragen
      annualKilometers: null,
      insurancePerYear: 0, // ÖKL-Richtwert hier eintragen
      taxPerYear: 0, // ÖKL-Richtwert hier eintragen
      storagePerYear: 0, // ÖKL-Richtwert hier eintragen
      otherFixedCostsPerYear: 0, // ÖKL-Richtwert hier eintragen
      maintenanceCostsPerYear: 0, // ÖKL-Richtwert hier eintragen
      repairCostsPerYear: 0, // ÖKL-Richtwert hier eintragen
      fuelCostsPerHour: 0, // ÖKL-Richtwert hier eintragen
      operatorCostsPerHour: 0, // ÖKL-Richtwert hier eintragen
      otherVariableCostsPerHour: 0, // ÖKL-Richtwert hier eintragen
      hectaresPerHour: null
    }
  },
  tractor_medium: {
    label: "Traktor mittel (60–100 kW)",
    unit: "hours",
    defaults: {
      purchasePrice: 0, // ÖKL-Richtwert hier eintragen
      residualValuePct: 10,
      expectedUsefulLifeYears: 0, // ÖKL-Richtwert hier eintragen
      annualOperatingHours: 0, // ÖKL-Richtwert hier eintragen
      annualKilometers: null,
      insurancePerYear: 0, // ÖKL-Richtwert hier eintragen
      taxPerYear: 0, // ÖKL-Richtwert hier eintragen
      storagePerYear: 0, // ÖKL-Richtwert hier eintragen
      otherFixedCostsPerYear: 0, // ÖKL-Richtwert hier eintragen
      maintenanceCostsPerYear: 0, // ÖKL-Richtwert hier eintragen
      repairCostsPerYear: 0, // ÖKL-Richtwert hier eintragen
      fuelCostsPerHour: 0, // ÖKL-Richtwert hier eintragen
      operatorCostsPerHour: 0, // ÖKL-Richtwert hier eintragen
      otherVariableCostsPerHour: 0, // ÖKL-Richtwert hier eintragen
      hectaresPerHour: null
    }
  },
  tractor_large: {
    label: "Traktor groß (über 100 kW)",
    unit: "hours",
    defaults: {
      purchasePrice: 0, // ÖKL-Richtwert hier eintragen
      residualValuePct: 10,
      expectedUsefulLifeYears: 0, // ÖKL-Richtwert hier eintragen
      annualOperatingHours: 0, // ÖKL-Richtwert hier eintragen
      annualKilometers: null,
      insurancePerYear: 0, // ÖKL-Richtwert hier eintragen
      taxPerYear: 0, // ÖKL-Richtwert hier eintragen
      storagePerYear: 0, // ÖKL-Richtwert hier eintragen
      otherFixedCostsPerYear: 0, // ÖKL-Richtwert hier eintragen
      maintenanceCostsPerYear: 0, // ÖKL-Richtwert hier eintragen
      repairCostsPerYear: 0, // ÖKL-Richtwert hier eintragen
      fuelCostsPerHour: 0, // ÖKL-Richtwert hier eintragen
      operatorCostsPerHour: 0, // ÖKL-Richtwert hier eintragen
      otherVariableCostsPerHour: 0, // ÖKL-Richtwert hier eintragen
      hectaresPerHour: null
    }
  },
  loader: {
    label: "Hoflader / Teleskoplader",
    unit: "hours",
    defaults: {
      purchasePrice: 0, // ÖKL-Richtwert hier eintragen
      residualValuePct: 10,
      expectedUsefulLifeYears: 0, // ÖKL-Richtwert hier eintragen
      annualOperatingHours: 0, // ÖKL-Richtwert hier eintragen
      annualKilometers: null,
      insurancePerYear: 0, // ÖKL-Richtwert hier eintragen
      taxPerYear: 0, // ÖKL-Richtwert hier eintragen
      storagePerYear: 0, // ÖKL-Richtwert hier eintragen
      otherFixedCostsPerYear: 0, // ÖKL-Richtwert hier eintragen
      maintenanceCostsPerYear: 0, // ÖKL-Richtwert hier eintragen
      repairCostsPerYear: 0, // ÖKL-Richtwert hier eintragen
      fuelCostsPerHour: 0, // ÖKL-Richtwert hier eintragen
      operatorCostsPerHour: 0, // ÖKL-Richtwert hier eintragen
      otherVariableCostsPerHour: 0, // ÖKL-Richtwert hier eintragen
      hectaresPerHour: null
    }
  },
  mower: {
    label: "Mähwerk (Front- oder Heckmähwerk)",
    unit: "hours",
    defaults: {
      purchasePrice: 0, // ÖKL-Richtwert hier eintragen
      residualValuePct: 10,
      expectedUsefulLifeYears: 0, // ÖKL-Richtwert hier eintragen
      annualOperatingHours: 0, // ÖKL-Richtwert hier eintragen
      annualKilometers: null,
      insurancePerYear: 0, // ÖKL-Richtwert hier eintragen
      taxPerYear: 0, // ÖKL-Richtwert hier eintragen
      storagePerYear: 0, // ÖKL-Richtwert hier eintragen
      otherFixedCostsPerYear: 0, // ÖKL-Richtwert hier eintragen
      maintenanceCostsPerYear: 0, // ÖKL-Richtwert hier eintragen
      repairCostsPerYear: 0, // ÖKL-Richtwert hier eintragen
      fuelCostsPerHour: 0, // ÖKL-Richtwert hier eintragen
      operatorCostsPerHour: 0, // ÖKL-Richtwert hier eintragen
      otherVariableCostsPerHour: 0, // ÖKL-Richtwert hier eintragen
      hectaresPerHour: null
    }
  },
  sprayer: {
    label: "Feldspritze",
    unit: "hours",
    defaults: {
      purchasePrice: 0, // ÖKL-Richtwert hier eintragen
      residualValuePct: 10,
      expectedUsefulLifeYears: 0, // ÖKL-Richtwert hier eintragen
      annualOperatingHours: 0, // ÖKL-Richtwert hier eintragen
      annualKilometers: null,
      insurancePerYear: 0, // ÖKL-Richtwert hier eintragen
      taxPerYear: 0, // ÖKL-Richtwert hier eintragen
      storagePerYear: 0, // ÖKL-Richtwert hier eintragen
      otherFixedCostsPerYear: 0, // ÖKL-Richtwert hier eintragen
      maintenanceCostsPerYear: 0, // ÖKL-Richtwert hier eintragen
      repairCostsPerYear: 0, // ÖKL-Richtwert hier eintragen
      fuelCostsPerHour: 0, // ÖKL-Richtwert hier eintragen
      operatorCostsPerHour: 0, // ÖKL-Richtwert hier eintragen
      otherVariableCostsPerHour: 0, // ÖKL-Richtwert hier eintragen
      hectaresPerHour: null
    }
  },
  vehicle: {
    label: "PKW / Transporter",
    unit: "km",
    defaults: {
      purchasePrice: 0, // ÖKL-Richtwert hier eintragen
      residualValuePct: 15,
      expectedUsefulLifeYears: 0, // ÖKL-Richtwert hier eintragen
      annualOperatingHours: 0,
      annualKilometers: 0, // ÖKL-Richtwert hier eintragen
      insurancePerYear: 0, // ÖKL-Richtwert hier eintragen
      taxPerYear: 0, // ÖKL-Richtwert hier eintragen
      storagePerYear: 0, // ÖKL-Richtwert hier eintragen
      otherFixedCostsPerYear: 0, // ÖKL-Richtwert hier eintragen
      maintenanceCostsPerYear: 0, // ÖKL-Richtwert hier eintragen
      repairCostsPerYear: 0, // ÖKL-Richtwert hier eintragen
      fuelCostsPerHour: 0, // ÖKL-Richtwert hier eintragen (€/km)
      operatorCostsPerHour: 0, // ÖKL-Richtwert hier eintragen (€/km)
      otherVariableCostsPerHour: 0, // ÖKL-Richtwert hier eintragen (€/km)
      hectaresPerHour: null
    }
  },
  other: {
    label: "Sonstiges Gerät",
    unit: "hours",
    defaults: {
      purchasePrice: 0,
      residualValuePct: 10,
      expectedUsefulLifeYears: 0,
      annualOperatingHours: 0,
      annualKilometers: null,
      insurancePerYear: 0,
      taxPerYear: 0,
      storagePerYear: 0,
      otherFixedCostsPerYear: 0,
      maintenanceCostsPerYear: 0,
      repairCostsPerYear: 0,
      fuelCostsPerHour: 0,
      operatorCostsPerHour: 0,
      otherVariableCostsPerHour: 0,
      hectaresPerHour: null
    }
  }
};

export const oeklCategoryOptions = Object.entries(OEKL_CATEGORIES).map(([key, ref]) => ({
  key,
  label: ref.label,
  unit: ref.unit
}));

export function getOeklCategoryDefaults(categoryKey: string): OeklCostInputs | null {
  return OEKL_CATEGORIES[categoryKey]?.defaults ?? null;
}

export function getOeklCategoryLabel(categoryKey: string): string {
  return OEKL_CATEGORIES[categoryKey]?.label ?? categoryKey;
}

export function getDefaultOeklCategoryForMachineCategory(machineCategory: MachineCategory): string {
  const mapping: Partial<Record<MachineCategory, string>> = {
    tractor: "tractor_medium",
    loader: "loader",
    grassland: "mower",
    sprayer: "sprayer",
    vehicle: "vehicle"
  };
  return mapping[machineCategory] ?? "other";
}
