import { getMaintenanceStatus, type StatusTone } from "./status";

export type MachineCategory =
  | "tractor"
  | "loader"
  | "harvester"
  | "grassland"
  | "tillage"
  | "transport"
  | "sprayer"
  | "slurry"
  | "trailer"
  | "press"
  | "chainsaw"
  | "vehicle"
  | "other";

export type MachineStatus = "active" | "maintenance" | "inactive" | "sold";

export type MachineUnit = "hours" | "km";

export type UsageUnit = "operating_hours" | "kilometers" | "hectares";

export type MachineSparePartCategory =
  | "filter"
  | "belt"
  | "bearing"
  | "blade"
  | "hydraulic"
  | "electrical"
  | "wear_part"
  | "fluid"
  | "other";

export type MachineSparePartStockStatus = "ok" | "low" | "critical" | "empty";
export type MachineDocumentType = "invoice" | "service_report" | "inspection" | "manual" | "warranty" | "photo" | "other";

export type Machine = {
  id: string;
  farmId: string;
  name: string;
  category: MachineCategory;
  unit: MachineUnit;
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

export type MachineSparePart = {
  id: string;
  farmId: string;
  machineId: string;
  name: string;
  category: MachineSparePartCategory;
  partNumber: string | null;
  originalPartNumber: string | null;
  manufacturer: string | null;
  supplier: string | null;
  stockQuantity: number;
  minimumStockQuantity: number;
  unit: string;
  storageLocation: string | null;
  purchasePrice: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MachineDocument = {
  id: string;
  farmId: string;
  machineId: string;
  title: string;
  type: MachineDocumentType;
  fileName: string;
  filePath: string | null;
  fileSize: number | null;
  mimeType: string | null;
  uploadedAt: string | null;
  notes: string | null;
  publicUrl?: string | null;
  signedUrl?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateMachineInput = Omit<Machine, "id" | "createdAt" | "updatedAt">;
export type UpdateMachineInput = Partial<CreateMachineInput>;
export type CreateMachineSparePartInput = Omit<MachineSparePart, "id" | "createdAt" | "updatedAt">;
export type UpdateMachineSparePartInput = Partial<CreateMachineSparePartInput>;
export type CreateMachineDocumentInput = Omit<MachineDocument, "id" | "createdAt" | "updatedAt">;
export type UpdateMachineDocumentInput = Partial<CreateMachineDocumentInput>;
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

export const placeholderMachineSpareParts: MachineSparePart[] = [
  {
    id: "spare-1111-4111-8111-111111111111",
    farmId: placeholderFarmId,
    machineId: "11111111-1111-4111-8111-111111111111",
    name: "Ölfilter",
    category: "filter",
    partNumber: "OF-120",
    originalPartNumber: "FDT-742120",
    manufacturer: "Mann",
    supplier: "Lagerhaus",
    stockQuantity: 2,
    minimumStockQuantity: 1,
    unit: "Stk.",
    storageLocation: "Regal A2",
    purchasePrice: 18.9,
    notes: null,
    createdAt: "2026-05-01T08:00:00.000Z",
    updatedAt: "2026-05-01T08:00:00.000Z"
  },
  {
    id: "spare-2222-4222-8222-222222222222",
    farmId: placeholderFarmId,
    machineId: "33333333-3333-4333-8333-333333333333",
    name: "Mähklinge links",
    category: "blade",
    partNumber: "MK-L-301",
    originalPartNumber: null,
    manufacturer: "Pöttinger",
    supplier: "Landtechnik",
    stockQuantity: 4,
    minimumStockQuantity: 4,
    unit: "Stk.",
    storageLocation: "Werkstatt Kiste 3",
    purchasePrice: 7.5,
    notes: "Vor Schnitt prüfen.",
    createdAt: "2026-05-01T08:00:00.000Z",
    updatedAt: "2026-05-01T08:00:00.000Z"
  }
];

export const placeholderMachineDocuments: MachineDocument[] = [
  {
    id: "document-1111-4111-8111-111111111111",
    farmId: placeholderFarmId,
    machineId: "11111111-1111-4111-8111-111111111111",
    title: "Kaufrechnung",
    type: "invoice",
    fileName: "rechnung-fendt-512.pdf",
    filePath: null,
    fileSize: null,
    mimeType: "application/pdf",
    uploadedAt: null,
    notes: "Metadaten-Beispiel. Datei kann später in Supabase Storage liegen.",
    createdAt: "2026-05-01T08:00:00.000Z",
    updatedAt: "2026-05-01T08:00:00.000Z"
  },
  {
    id: "document-2222-4222-8222-222222222222",
    farmId: placeholderFarmId,
    machineId: "11111111-1111-4111-8111-111111111111",
    title: "Servicezettel 2500 h",
    type: "service_report",
    fileName: "service-2500h-foto.jpg",
    filePath: null,
    fileSize: null,
    mimeType: "image/jpeg",
    uploadedAt: null,
    notes: null,
    createdAt: "2026-05-10T08:00:00.000Z",
    updatedAt: "2026-05-10T08:00:00.000Z"
  }
];

export const placeholderMachines: Machine[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    farmId: placeholderFarmId,
    name: "Traktor 120 PS",
    category: "tractor",
    unit: "hours",
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
    notes: "Haupttraktor für Feldarbeit und Transport.",
    createdAt: "2026-05-01T08:00:00.000Z",
    updatedAt: "2026-05-01T08:00:00.000Z"
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    farmId: placeholderFarmId,
    name: "Hoflader",
    category: "loader",
    unit: "hours",
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
    notes: "Tägliche Stall- und Hofarbeiten.",
    createdAt: "2026-05-01T08:00:00.000Z",
    updatedAt: "2026-05-01T08:00:00.000Z"
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    farmId: placeholderFarmId,
    name: "Frontmähwerk",
    category: "grassland",
    unit: "hours",
    manufacturer: "Pöttinger",
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
  grassland: "Grünland",
  tillage: "Bodenbearbeitung",
  transport: "Transport",
  sprayer: "Spritze",
  slurry: "Gülletechnik",
  trailer: "Anhänger",
  press: "Presse",
  chainsaw: "Motorsäge",
  vehicle: "PKW/Transporter",
  other: "Sonstige"
};

const unitLabels: Record<MachineUnit, string> = {
  hours: "h",
  km: "km"
};

const sparePartCategoryLabels: Record<MachineSparePartCategory, string> = {
  filter: "Filter",
  belt: "Riemen",
  bearing: "Lager",
  blade: "Klinge",
  hydraulic: "Hydraulik",
  electrical: "Elektrik",
  wear_part: "Verschleißteil",
  fluid: "Flüssigkeit",
  other: "Sonstiges"
};

const documentTypeLabels: Record<MachineDocumentType, string> = {
  invoice: "Rechnung",
  service_report: "Service",
  inspection: "Pickerl/TÜV",
  manual: "Anleitung",
  warranty: "Garantie",
  photo: "Foto",
  other: "Sonstiges"
};

const documentTypePriority: Record<MachineDocumentType, number> = {
  invoice: 0,
  service_report: 1,
  inspection: 2,
  manual: 3,
  warranty: 4,
  photo: 5,
  other: 6
};

export function getMachineCategoryLabel(category: MachineCategory): string {
  return categoryLabels[category];
}

export function getMachineUnitLabel(unit: MachineUnit): string {
  return unitLabels[unit];
}

export function getMachineCurrentReading(machine: Machine): number {
  return machine.unit === "km" ? (machine.currentKilometers ?? 0) : machine.currentOperatingHours;
}

export function formatMachineReading(machine: Machine, value?: number): string {
  const reading = value ?? getMachineCurrentReading(machine);
  const label = getMachineUnitLabel(machine.unit);
  return `${reading.toLocaleString("de-DE", { maximumFractionDigits: 0 })} ${label}`;
}

export function getMachineAnnualUsage(machine: Machine): number {
  return machine.unit === "km" ? (machine.annualKilometers ?? 0) : machine.annualOperatingHours;
}

export function getMachineSparePartCategoryLabel(category: MachineSparePartCategory): string {
  return sparePartCategoryLabels[category];
}

export function getMachineDocumentTypeLabel(type: MachineDocumentType): string {
  return documentTypeLabels[type];
}

export function sortMachineDocumentsByRelevance(documents: MachineDocument[]): MachineDocument[] {
  return [...documents].sort((first, second) => {
    const priorityDifference = documentTypePriority[first.type] - documentTypePriority[second.type];

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
  });
}

export function isMachineSparePartLowStock(part: MachineSparePart): boolean {
  return part.stockQuantity <= part.minimumStockQuantity;
}

export function getMachineSparePartStockStatus(part: MachineSparePart): MachineSparePartStockStatus {
  if (part.stockQuantity <= 0) {
    return "empty";
  }

  if (part.minimumStockQuantity > 0 && part.stockQuantity <= part.minimumStockQuantity / 2) {
    return "critical";
  }

  if (part.stockQuantity <= part.minimumStockQuantity) {
    return "low";
  }

  return "ok";
}

export function getMachineSparePartStockStatusLabel(status: MachineSparePartStockStatus): string {
  const labels: Record<MachineSparePartStockStatus, string> = {
    ok: "Lagerbestand ausreichend",
    low: "Niedriger Bestand",
    critical: "Kritisch niedrig",
    empty: "Nachbestellen"
  };

  return labels[status];
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
    messages.push("Betriebsstunden dürfen nicht niedriger sein als der aktuelle Stand.");
  }

  if (
    input.currentKilometers !== undefined &&
    input.currentKilometers !== null &&
    currentMachine.currentKilometers !== null &&
    input.currentKilometers < currentMachine.currentKilometers
  ) {
    messages.push("Kilometer dürfen nicht niedriger sein als der aktuelle Stand.");
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
