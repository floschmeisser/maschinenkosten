import { getSupabaseClient } from "@/lib/supabase/client";
import type { Machine } from "./machines";

export type MachineCostInput = {
  unit?: "hours" | "km";
  purchasePrice: number;
  currentValue: number;
  residualValue: number;
  expectedUsefulLifeYears: number;
  annualOperatingHours: number;
  currentOperatingHours: number;
  currentKilometers: number | null;
  hectaresPerHour: number | null;
  insurancePerYear: number;
  taxPerYear: number;
  storagePerYear: number;
  otherFixedCostsPerYear: number;
  maintenanceCostsPerYear: number;
  repairCostsPerYear: number;
  fuelCostsPerHour: number;
  operatorCostsPerHour: number;
  otherVariableCostsPerHour: number;
  annualKilometers: number | null;
};

export type FixedCostBreakdown = {
  annualDepreciation: number;
  insurancePerYear: number;
  taxPerYear: number;
  storagePerYear: number;
  otherFixedCostsPerYear: number;
  annualFixedCosts: number;
};

export type VariableCostBreakdown = {
  maintenanceCostsPerHour: number;
  repairCostsPerHour: number;
  fuelCostsPerHour: number;
  operatorCostsPerHour: number;
  otherVariableCostsPerHour: number;
  variableCostsPerHour: number;
  annualVariableCosts: number;
};

export type MachineCostResult = {
  fixedCosts: FixedCostBreakdown;
  variableCosts: VariableCostBreakdown;
  totalAnnualCosts: number;
  costPerOperatingHour: number | null;
  costPerHectare: number | null;
  costPerKilometer: number | null;
  warnings: string[];
};

export type CostInputs = MachineCostInput;
export type CostResult = MachineCostResult;

export function calculateAnnualDepreciation(input: MachineCostInput): number {
  if (input.expectedUsefulLifeYears <= 0) {
    return 0;
  }

  return roundMoney((input.purchasePrice - input.residualValue) / input.expectedUsefulLifeYears);
}

export function calculateFixedCostBreakdown(input: MachineCostInput): FixedCostBreakdown {
  const annualDepreciation = calculateAnnualDepreciation(input);
  const annualFixedCosts =
    annualDepreciation +
    input.insurancePerYear +
    input.taxPerYear +
    input.storagePerYear +
    input.otherFixedCostsPerYear;

  return {
    annualDepreciation,
    insurancePerYear: roundMoney(input.insurancePerYear),
    taxPerYear: roundMoney(input.taxPerYear),
    storagePerYear: roundMoney(input.storagePerYear),
    otherFixedCostsPerYear: roundMoney(input.otherFixedCostsPerYear),
    annualFixedCosts: roundMoney(annualFixedCosts)
  };
}

export function calculateVariableCostBreakdown(input: MachineCostInput): VariableCostBreakdown {
  const isKm = input.unit === "km";
  const annualUsage = isKm ? (input.annualKilometers ?? 0) : input.annualOperatingHours;
  const maintenanceCostsPerHour = divideOrZero(input.maintenanceCostsPerYear, annualUsage);
  const repairCostsPerHour = divideOrZero(input.repairCostsPerYear, annualUsage);
  const variableCostsPerHour =
    maintenanceCostsPerHour +
    repairCostsPerHour +
    input.fuelCostsPerHour +
    input.operatorCostsPerHour +
    input.otherVariableCostsPerHour;

  return {
    maintenanceCostsPerHour: roundRate(maintenanceCostsPerHour),
    repairCostsPerHour: roundRate(repairCostsPerHour),
    fuelCostsPerHour: roundRate(input.fuelCostsPerHour),
    operatorCostsPerHour: roundRate(input.operatorCostsPerHour),
    otherVariableCostsPerHour: roundRate(input.otherVariableCostsPerHour),
    variableCostsPerHour: roundRate(variableCostsPerHour),
    annualVariableCosts: roundMoney(variableCostsPerHour * Math.max(annualUsage, 0))
  };
}

export function calculateWarnings(input: MachineCostInput): string[] {
  const warnings: string[] = [];

  if (input.purchasePrice <= 0) {
    warnings.push("Anschaffungspreis fehlt oder ist 0.");
  }

  if (input.expectedUsefulLifeYears <= 0) {
    warnings.push("Nutzungsdauer muss größer als 0 sein.");
  }

  if (input.unit !== "km" && input.annualOperatingHours <= 0) {
    warnings.push("Jährliche Betriebsstunden fehlen. Kosten je Stunde sind nicht berechenbar.");
  }

  if (input.unit === "km" && (input.annualKilometers === null || input.annualKilometers <= 0)) {
    warnings.push("Jährliche Kilometer fehlen. Kosten je Kilometer sind nicht berechenbar.");
  }

  if (input.residualValue > input.purchasePrice) {
    warnings.push("Restwert ist höher als Anschaffungspreis.");
  }

  if (input.hectaresPerHour !== null && input.hectaresPerHour <= 0) {
    warnings.push("Hektarleistung muss größer als 0 sein.");
  }

  if (input.annualKilometers !== null && input.annualKilometers <= 0) {
    warnings.push("Jährliche Kilometer müssen größer als 0 sein.");
  }

  if (input.currentValue > input.purchasePrice * 1.25) {
    warnings.push("Aktueller Wert wirkt ungewöhnlich hoch.");
  }

  if (input.currentOperatingHours < 0 || (input.currentKilometers !== null && input.currentKilometers < 0)) {
    warnings.push("Aktuelle Nutzung darf nicht negativ sein.");
  }

  return warnings;
}

export function divideOrNull(numerator: number, denominator: number | null): number | null {
  if (denominator === null || denominator <= 0) {
    return null;
  }

  return numerator / denominator;
}

export function divideOrZero(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return numerator / denominator;
}

export function roundMoney(value: number): number {
  return roundTo(value, 2);
}

export function roundRate(value: number): number {
  return roundTo(value, 2);
}

function roundTo(value: number, decimals: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export type LiveCostBreakdown = {
  fuelPerUnit: number;
  maintenancePerUnit: number;
  sparePartsPerUnit: number;
  totalPerUnit: number;
};

type FilterChain<T> = Promise<{ data: T[] | null; error: unknown }> & {
  eq(col: string, val: string): FilterChain<T>;
  gte(col: string, val: string): FilterChain<T>;
  not(col: string, op: string, val: null): FilterChain<T>;
};

type SelectableTable<T> = {
  select(cols: string): FilterChain<T>;
};

const ZERO_BREAKDOWN: LiveCostBreakdown = {
  fuelPerUnit: 0,
  maintenancePerUnit: 0,
  sparePartsPerUnit: 0,
  totalPerUnit: 0,
};

export async function calculateVariableCosts(
  machine: Machine,
  options?: { months?: number }
): Promise<LiveCostBreakdown> {
  const months = options?.months ?? 12;
  const since = new Date();
  since.setMonth(since.getMonth() - months);
  const sinceIso = since.toISOString();

  const supabase = await getSupabaseClient();
  if (!supabase) {
    return { ...ZERO_BREAKDOWN, fuelPerUnit: machine.fuelCostsPerHour ?? 0, totalPerUnit: machine.fuelCostsPerHour ?? 0 };
  }

  const fuelPerUnit = machine.fuelCostsPerHour ?? 0;

  const { data: tasks } = await (supabase.from("maintenance_tasks") as unknown as SelectableTable<{ actual_cost: number | null }>)
    .select("actual_cost")
    .eq("farm_id", machine.farmId)
    .eq("machine_id", machine.id)
    .gte("completed_at", sinceIso)
    .not("actual_cost", "is", null);

  const maintenanceTotal = (tasks ?? []).reduce((sum, t) => sum + (t.actual_cost ?? 0), 0);

  const { data: consumptions } = await (supabase.from("spare_part_consumptions") as unknown as SelectableTable<{ quantity: number; unit_cost_at_time: number | null }>)
    .select("quantity, unit_cost_at_time")
    .eq("farm_id", machine.farmId)
    .eq("machine_id", machine.id)
    .gte("consumed_at", sinceIso)
    .not("unit_cost_at_time", "is", null);

  const sparePartsTotal = (consumptions ?? []).reduce(
    (sum, c) => sum + c.quantity * (c.unit_cost_at_time ?? 0),
    0
  );

  const isKm = machine.unit === "km";
  const annualUsage = isKm ? (machine.annualKilometers ?? 0) : machine.annualOperatingHours;
  const usageInWindow = (months / 12) * (annualUsage > 0 ? annualUsage : 1);
  const safeWindow = usageInWindow > 0 ? usageInWindow : 1;

  const maintenancePerUnit = roundRate(maintenanceTotal / safeWindow);
  const sparePartsPerUnit = roundRate(sparePartsTotal / safeWindow);

  return {
    fuelPerUnit,
    maintenancePerUnit,
    sparePartsPerUnit,
    totalPerUnit: roundRate(fuelPerUnit + maintenancePerUnit + sparePartsPerUnit),
  };
}
