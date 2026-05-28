import { getMaintenanceStatus, type StatusTone } from "./status";

export type MachineCategory =
  | "tractor"
  | "loader"
  | "harvester"
  | "grassland"
  | "tillage"
  | "transport"
  | "other";

export type MachineStatus = "active" | "maintenance" | "inactive" | "sold";

export type UsageUnit = "operating_hours" | "kilometers" | "hectares";

export type Machine = {
  id: string;
  farmId: string;
  name: string;
  category: MachineCategory;
  manufacturer: string;
  model: string;
  yearOfManufacture: number;
  purchaseDate: string | null;
  purchasePrice: number;
  newPrice: number;
  currentValue: number;
  residualValue: number;
  expectedUsefulLifeYears: number;
  annualOperatingHours: number;
  currentOperatingHours: number;
  currentKilometers: number | null;
  workingWidthMeters: number | null;
  hectaresPerHour: number | null;
  insurancePerYear?: number;
  taxPerYear?: number;
  storagePerYear?: number;
  otherFixedCostsPerYear?: number;
  maintenanceCostsPerYear?: number;
  repairCostsPerYear?: number;
  fuelCostsPerHour?: number;
  operatorCostsPerHour?: number;
  otherVariableCostsPerHour?: number;
  annualKilometers?: number | null;
  status: MachineStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateMachineInput = Omit<Machine, "id" | "createdAt" | "updatedAt">;
export type UpdateMachineInput = Partial<CreateMachineInput>;
export type MachineUsageUpdateInput = {
  currentOperatingHours?: number | null;
  currentKilometers?: number | null;
};

export type MachineSummary = Machine & {
  displayCategory: string;
  serviceStatus: StatusTone;
  nextServiceHours: number;
  year: number;
  operatingHours: number;
};

export const placeholderFarmId = "00000000-0000-4000-8000-000000000001";

export const placeholderMachines: Machine[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    farmId: placeholderFarmId,
    name: "Traktor 120 PS",
    category: "tractor",
    manufacturer: "Fendt",
    model: "Favorit 512",
    yearOfManufacture: 2018,
    purchaseDate: "2018-03-15",
    purchasePrice: 84000,
    newPrice: 104000,
    currentValue: 61000,
    residualValue: 22000,
    expectedUsefulLifeYears: 12,
    annualOperatingHours: 450,
    currentOperatingHours: 2450,
    currentKilometers: null,
    workingWidthMeters: null,
    hectaresPerHour: 2.4,
    insurancePerYear: 850,
    taxPerYear: 420,
    storagePerYear: 600,
    otherFixedCostsPerYear: 300,
    maintenanceCostsPerYear: 2200,
    repairCostsPerYear: 1600,
    fuelCostsPerHour: 24,
    operatorCostsPerHour: 22,
    otherVariableCostsPerHour: 3,
    annualKilometers: null,
    status: "active",
    notes: "Haupttraktor fuer Feldarbeit und Transport.",
    createdAt: "2026-05-01T08:00:00.000Z",
    updatedAt: "2026-05-01T08:00:00.000Z"
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    farmId: placeholderFarmId,
    name: "Hoflader",
    category: "loader",
    manufacturer: "Weidemann",
    model: "1160",
    yearOfManufacture: 2021,
    purchaseDate: "2021-09-10",
    purchasePrice: 42000,
    newPrice: 48000,
    currentValue: 35500,
    residualValue: 12000,
    expectedUsefulLifeYears: 10,
    annualOperatingHours: 320,
    currentOperatingHours: 870,
    currentKilometers: null,
    workingWidthMeters: null,
    hectaresPerHour: null,
    insurancePerYear: 420,
    taxPerYear: 120,
    storagePerYear: 300,
    otherFixedCostsPerYear: 150,
    maintenanceCostsPerYear: 900,
    repairCostsPerYear: 700,
    fuelCostsPerHour: 8,
    operatorCostsPerHour: 20,
    otherVariableCostsPerHour: 2,
    annualKilometers: null,
    status: "active",
    notes: "Taegliche Stall- und Hofarbeiten.",
    createdAt: "2026-05-01T08:00:00.000Z",
    updatedAt: "2026-05-01T08:00:00.000Z"
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    farmId: placeholderFarmId,
    name: "Frontmaehwerk",
    category: "grassland",
    manufacturer: "Poettinger",
    model: "Novacat 301",
    yearOfManufacture: 2020,
    purchaseDate: "2020-04-20",
    purchasePrice: 18500,
    newPrice: 22500,
    currentValue: 14200,
    residualValue: 4500,
    expectedUsefulLifeYears: 9,
    annualOperatingHours: 120,
    currentOperatingHours: 310,
    currentKilometers: null,
    workingWidthMeters: 3,
    hectaresPerHour: 3.2,
    insurancePerYear: 120,
    taxPerYear: 0,
    storagePerYear: 180,
    otherFixedCostsPerYear: 80,
    maintenanceCostsPerYear: 350,
    repairCostsPerYear: 250,
    fuelCostsPerHour: 0,
    operatorCostsPerHour: 18,
    otherVariableCostsPerHour: 1,
    annualKilometers: null,
    status: "active",
    notes: "Erster Schnitt und Nachmahd.",
    createdAt: "2026-05-01T08:00:00.000Z",
    updatedAt: "2026-05-01T08:00:00.000Z"
  }
];

const categoryLabels: Record<MachineCategory, string> = {
  tractor: "Traktor",
  loader: "Lader",
  harvester: "Ernte",
  grassland: "Gruenland",
  tillage: "Bodenbearbeitung",
  transport: "Transport",
  other: "Sonstige"
};

export function getMachineCategoryLabel(category: MachineCategory): string {
  return categoryLabels[category];
}

export function toMachineSummary(machine: Machine): MachineSummary {
  const nextServiceHours = Math.ceil((machine.currentOperatingHours + 1) / 100) * 100;

  return {
    ...machine,
    displayCategory: getMachineCategoryLabel(machine.category),
    serviceStatus: getMaintenanceStatus(nextServiceHours, machine.currentOperatingHours),
    nextServiceHours,
    year: machine.yearOfManufacture,
    operatingHours: machine.currentOperatingHours
  };
}

export function getMachines(): MachineSummary[] {
  return placeholderMachines.map(toMachineSummary);
}

export function getMachineById(machineId: string): MachineSummary | undefined {
  return getMachines().find((machine) => machine.id === machineId);
}

export function validateMachineUsageUpdate(input: MachineUsageUpdateInput, currentMachine: Machine): string[] {
  const messages: string[] = [];

  if (
    input.currentOperatingHours !== undefined &&
    input.currentOperatingHours !== null &&
    input.currentOperatingHours < currentMachine.currentOperatingHours
  ) {
    messages.push("Betriebsstunden duerfen nicht niedriger sein als der aktuelle Stand.");
  }

  if (
    input.currentKilometers !== undefined &&
    input.currentKilometers !== null &&
    currentMachine.currentKilometers !== null &&
    input.currentKilometers < currentMachine.currentKilometers
  ) {
    messages.push("Kilometer duerfen nicht niedriger sein als der aktuelle Stand.");
  }

  return messages;
}

export function mergeMachineNotes(existingNotes: string | null, newNotes: string | null | undefined): string | null {
  if (!newNotes) {
    return existingNotes;
  }

  if (!existingNotes) {
    return newNotes;
  }

  if (existingNotes.includes(newNotes)) {
    return existingNotes;
  }

  return `${existingNotes}\n${newNotes}`;
}
