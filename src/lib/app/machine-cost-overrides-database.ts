import { getSupabaseClient, runSupabaseQuery } from "@/lib/supabase/client";
import { getCurrentFarm, type Farm } from "./farms-database";
import { placeholderFarmId } from "./machines";

export type MachineCostOverride = {
  id: string;
  farmId: string;
  machineId: string;
  oeklCategory: string | null;
  purchasePrice: number | null;
  residualValue: number | null;
  expectedUsefulLifeYears: number | null;
  annualOperatingHours: number | null;
  annualKilometers: number | null;
  insurancePerYear: number | null;
  taxPerYear: number | null;
  storagePerYear: number | null;
  otherFixedCostsPerYear: number | null;
  maintenanceCostsPerYear: number | null;
  repairCostsPerYear: number | null;
  fuelCostsPerHour: number | null;
  operatorCostsPerHour: number | null;
  otherVariableCostsPerHour: number | null;
  hectaresPerHour: number | null;
  createdAt: string;
  updatedAt: string;
};

export type UpsertMachineCostOverrideInput = Omit<MachineCostOverride, "id" | "createdAt" | "updatedAt">;

type OverrideRow = {
  id: string;
  farm_id: string;
  machine_id: string;
  oekl_category: string | null;
  purchase_price: number | null;
  residual_value: number | null;
  expected_useful_life_years: number | null;
  annual_operating_hours: number | null;
  annual_kilometers: number | null;
  insurance_per_year: number | null;
  tax_per_year: number | null;
  storage_per_year: number | null;
  other_fixed_costs_per_year: number | null;
  maintenance_costs_per_year: number | null;
  repair_costs_per_year: number | null;
  fuel_costs_per_hour: number | null;
  operator_costs_per_hour: number | null;
  other_variable_costs_per_hour: number | null;
  hectares_per_hour: number | null;
  created_at: string;
  updated_at: string;
};

type SupabaseUpsertApi<T> = {
  select: (columns?: string) => {
    eq: (column: string, value: string) => Promise<{ data: T[] | null; error: Error | null }>;
  };
  upsert: (input: Partial<T>, options?: { onConflict?: string }) => {
    select: (columns?: string) => {
      single: () => Promise<{ data: T | null; error: Error | null }>;
    };
  };
};

type DataSource = {
  farm: Farm;
  table: SupabaseUpsertApi<OverrideRow>;
};

const fallbackOverrides = new Map<string, MachineCostOverride>();

export async function getMachineCostOverride(machineId: string): Promise<MachineCostOverride | null> {
  const cached = fallbackOverrides.get(machineId);
  if (cached) return cached;

  const source = await getDataSource();
  if (!source) return null;

  const result = await runSupabaseQuery(
    () => source.table.select("*").eq("machine_id", machineId),
    "Kosteneinstellungen konnten nicht geladen werden."
  );

  if (!result?.data?.[0]) return null;

  const override = mapRowToOverride(result.data[0]);
  fallbackOverrides.set(machineId, override);
  return override;
}

export async function upsertMachineCostOverride(input: UpsertMachineCostOverrideInput): Promise<MachineCostOverride> {
  const source = await getDataSource();
  const now = new Date().toISOString();
  const existing = fallbackOverrides.get(input.machineId);
  const fallback: MachineCostOverride = {
    ...input,
    id: existing?.id ?? crypto.randomUUID(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };

  if (!source) {
    fallbackOverrides.set(input.machineId, fallback);
    return fallback;
  }

  const result = await runSupabaseQuery(
    () =>
      source.table
        .upsert(mapToRow(fallback), { onConflict: "machine_id" })
        .select("*")
        .single(),
    "Kosteneinstellungen konnten nicht gespeichert werden."
  );

  if (!result?.data) {
    fallbackOverrides.set(input.machineId, fallback);
    return fallback;
  }

  const saved = mapRowToOverride(result.data);
  fallbackOverrides.set(input.machineId, saved);
  return saved;
}

async function getDataSource(): Promise<DataSource | null> {
  const [farm, table] = await Promise.all([getCurrentFarm(), getTable()]);

  if (!table || farm.id === placeholderFarmId) {
    return null;
  }

  return { farm, table };
}

async function getTable(): Promise<SupabaseUpsertApi<OverrideRow> | null> {
  const supabase = await getSupabaseClient();
  if (!supabase) return null;
  return supabase.from("machine_cost_overrides") as unknown as SupabaseUpsertApi<OverrideRow>;
}

function mapRowToOverride(row: OverrideRow): MachineCostOverride {
  return {
    id: row.id,
    farmId: row.farm_id,
    machineId: row.machine_id,
    oeklCategory: row.oekl_category,
    purchasePrice: row.purchase_price,
    residualValue: row.residual_value,
    expectedUsefulLifeYears: row.expected_useful_life_years,
    annualOperatingHours: row.annual_operating_hours,
    annualKilometers: row.annual_kilometers,
    insurancePerYear: row.insurance_per_year,
    taxPerYear: row.tax_per_year,
    storagePerYear: row.storage_per_year,
    otherFixedCostsPerYear: row.other_fixed_costs_per_year,
    maintenanceCostsPerYear: row.maintenance_costs_per_year,
    repairCostsPerYear: row.repair_costs_per_year,
    fuelCostsPerHour: row.fuel_costs_per_hour,
    operatorCostsPerHour: row.operator_costs_per_hour,
    otherVariableCostsPerHour: row.other_variable_costs_per_hour,
    hectaresPerHour: row.hectares_per_hour,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapToRow(override: MachineCostOverride): OverrideRow {
  return {
    id: override.id,
    farm_id: override.farmId,
    machine_id: override.machineId,
    oekl_category: override.oeklCategory,
    purchase_price: override.purchasePrice,
    residual_value: override.residualValue,
    expected_useful_life_years: override.expectedUsefulLifeYears,
    annual_operating_hours: override.annualOperatingHours,
    annual_kilometers: override.annualKilometers,
    insurance_per_year: override.insurancePerYear,
    tax_per_year: override.taxPerYear,
    storage_per_year: override.storagePerYear,
    other_fixed_costs_per_year: override.otherFixedCostsPerYear,
    maintenance_costs_per_year: override.maintenanceCostsPerYear,
    repair_costs_per_year: override.repairCostsPerYear,
    fuel_costs_per_hour: override.fuelCostsPerHour,
    operator_costs_per_hour: override.operatorCostsPerHour,
    other_variable_costs_per_hour: override.otherVariableCostsPerHour,
    hectares_per_hour: override.hectaresPerHour,
    created_at: override.createdAt,
    updated_at: override.updatedAt
  };
}
