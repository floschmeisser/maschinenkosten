import { getSupabaseClient, runSupabaseQuery } from "@/lib/supabase/client";
import {
  placeholderFarmId,
  placeholderMachines,
  type CreateMachineInput,
  type Machine,
  type UpdateMachineInput
} from "./machines";
import { getCurrentFarm, type Farm } from "./farms-database";
import { scheduleReminderSync } from "./reminder-sync-scheduler";

type MachineRow = {
  id: string;
  farm_id: string;
  name: string;
  category: Machine["category"];
  unit: Machine["unit"];
  manufacturer: string;
  model: string;
  year_of_manufacture: number;
  purchase_date: string | null;
  purchase_price: number;
  new_price: number;
  current_value: number;
  residual_value: number;
  expected_useful_life_years: number;
  annual_operating_hours: number;
  current_operating_hours: number;
  current_kilometers: number | null;
  working_width_meters: number | null;
  hectares_per_hour: number | null;
  insurance_per_year?: number;
  tax_per_year?: number;
  storage_per_year?: number;
  other_fixed_costs_per_year?: number;
  maintenance_costs_per_year?: number;
  repair_costs_per_year?: number;
  fuel_costs_per_hour?: number;
  operator_costs_per_hour?: number;
  other_variable_costs_per_hour?: number;
  annual_kilometers?: number | null;
  status: Machine["status"];
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type SupabaseTableApi<T> = {
  select: (columns?: string) => {
    eq: (column: string, value: string) => Promise<{ data: T[] | null; error: Error | null }>;
  };
  insert: (input: Partial<T>) => {
    select: (columns?: string) => {
      single: () => Promise<{ data: T | null; error: Error | null }>;
    };
  };
  update: (input: Partial<T>) => {
    eq: (column: string, value: string) => {
      eq: (column: string, value: string) => {
        select: (columns?: string) => {
          single: () => Promise<{ data: T | null; error: Error | null }>;
        };
      };
    };
  };
  delete: () => {
    eq: (column: string, value: string) => {
      eq: (column: string, value: string) => Promise<{ error: Error | null }>;
    };
  };
};

type MachinesDataSource = {
  farm: Farm;
  table: SupabaseTableApi<MachineRow>;
};

let fallbackMachines = [...placeholderMachines];

export async function getMachines(): Promise<Machine[]> {
  const source = await getMachinesDataSource();

  if (!source) {
    return fallbackMachines;
  }

  const result = await runSupabaseQuery(
    () => source.table.select("*").eq("farm_id", source.farm.id),
    "Maschinen konnten nicht geladen werden."
  );

  if (!result?.data) {
    return fallbackMachines;
  }

  fallbackMachines = result.data.map(mapMachineRowToMachine);
  return fallbackMachines;
}

export async function getMachineById(id: string): Promise<Machine | null> {
  const machines = await getMachines();
  return machines.find((machine) => machine.id === id) ?? null;
}

export async function createMachine(input: CreateMachineInput): Promise<Machine> {
  const source = await getMachinesDataSource();
  const farmId = source?.farm.id ?? input.farmId;
  const now = new Date().toISOString();
  const fallbackMachine: Machine = {
    ...input,
    farmId,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now
  };

  if (!source) {
    fallbackMachines = [fallbackMachine, ...fallbackMachines];
    triggerReminderSync();
    return fallbackMachine;
  }

  const result = await runSupabaseQuery(
    () => source.table.insert(mapMachineToRow(fallbackMachine)).select("*").single(),
    "Maschine konnte nicht angelegt werden."
  );

  if (!result?.data) {
    fallbackMachines = [fallbackMachine, ...fallbackMachines];
    triggerReminderSync();
    return fallbackMachine;
  }

  const createdMachine = mapMachineRowToMachine(result.data);
  fallbackMachines = [createdMachine, ...fallbackMachines.filter((machine) => machine.id !== createdMachine.id)];
  triggerReminderSync();
  return createdMachine;
}

export async function updateMachine(id: string, input: UpdateMachineInput): Promise<Machine | null> {
  const existing = fallbackMachines.find((machine) => machine.id === id);
  const now = new Date().toISOString();
  const fallbackMachine = existing ? { ...existing, ...input, updatedAt: now } : null;
  const source = await getMachinesDataSource();

  if (!source) {
    if (fallbackMachine) {
      fallbackMachines = fallbackMachines.map((machine) => (machine.id === id ? fallbackMachine : machine));
      triggerReminderSync();
    }

    return fallbackMachine;
  }

  const result = await runSupabaseQuery(
    () => source.table.update(mapMachineInputToRow({ ...input, updatedAt: now })).eq("id", id).eq("farm_id", source.farm.id).select("*").single(),
    "Maschine konnte nicht aktualisiert werden."
  );

  if (!result?.data) {
    if (fallbackMachine) {
      triggerReminderSync();
    }

    return fallbackMachine;
  }

  const updatedMachine = mapMachineRowToMachine(result.data);
  fallbackMachines = fallbackMachines.map((machine) => (machine.id === id ? updatedMachine : machine));
  triggerReminderSync();
  return updatedMachine;
}

export async function deleteMachine(id: string): Promise<boolean> {
  const source = await getMachinesDataSource();

  if (!source) {
    const hadMachine = fallbackMachines.some((machine) => machine.id === id);
    fallbackMachines = fallbackMachines.filter((machine) => machine.id !== id);
    if (hadMachine) {
      triggerReminderSync();
    }
    return hadMachine;
  }

  const result = await runSupabaseQuery(
    () => source.table.delete().eq("id", id).eq("farm_id", source.farm.id),
    "Maschine konnte nicht geloescht werden."
  );

  if (!result) {
    const hadMachine = fallbackMachines.some((machine) => machine.id === id);
    fallbackMachines = fallbackMachines.filter((machine) => machine.id !== id);
    if (hadMachine) {
      triggerReminderSync();
    }
    return hadMachine;
  }

  fallbackMachines = fallbackMachines.filter((machine) => machine.id !== id);
  triggerReminderSync();
  return true;
}

async function getMachinesDataSource(): Promise<MachinesDataSource | null> {
  const [farm, table] = await Promise.all([getCurrentFarm(), getMachinesTable()]);

  if (!table || farm.id === placeholderFarmId) {
    return null;
  }

  return { farm, table };
}

async function getMachinesTable(): Promise<SupabaseTableApi<MachineRow> | null> {
  const supabase = await getSupabaseClient();

  if (!supabase) {
    return null;
  }

  return supabase.from("machines") as unknown as SupabaseTableApi<MachineRow>;
}

function mapMachineRowToMachine(row: MachineRow): Machine {
  return {
    id: row.id,
    farmId: row.farm_id,
    name: row.name,
    category: row.category,
    unit: row.unit ?? "hours",
    manufacturer: row.manufacturer,
    model: row.model,
    yearOfManufacture: row.year_of_manufacture,
    purchaseDate: row.purchase_date,
    purchasePrice: row.purchase_price,
    newPrice: row.new_price,
    currentValue: row.current_value,
    residualValue: row.residual_value,
    expectedUsefulLifeYears: row.expected_useful_life_years,
    annualOperatingHours: row.annual_operating_hours,
    currentOperatingHours: row.current_operating_hours,
    currentKilometers: row.current_kilometers,
    workingWidthMeters: row.working_width_meters,
    hectaresPerHour: row.hectares_per_hour,
    insurancePerYear: row.insurance_per_year,
    taxPerYear: row.tax_per_year,
    storagePerYear: row.storage_per_year,
    otherFixedCostsPerYear: row.other_fixed_costs_per_year,
    maintenanceCostsPerYear: row.maintenance_costs_per_year,
    repairCostsPerYear: row.repair_costs_per_year,
    fuelCostsPerHour: row.fuel_costs_per_hour,
    operatorCostsPerHour: row.operator_costs_per_hour,
    otherVariableCostsPerHour: row.other_variable_costs_per_hour,
    annualKilometers: row.annual_kilometers,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapMachineToRow(machine: Machine): MachineRow {
  return {
    id: machine.id,
    farm_id: machine.farmId,
    name: machine.name,
    category: machine.category,
    unit: machine.unit,
    manufacturer: machine.manufacturer,
    model: machine.model,
    year_of_manufacture: machine.yearOfManufacture,
    purchase_date: machine.purchaseDate,
    purchase_price: machine.purchasePrice,
    new_price: machine.newPrice,
    current_value: machine.currentValue,
    residual_value: machine.residualValue,
    expected_useful_life_years: machine.expectedUsefulLifeYears,
    annual_operating_hours: machine.annualOperatingHours,
    current_operating_hours: machine.currentOperatingHours,
    current_kilometers: machine.currentKilometers,
    working_width_meters: machine.workingWidthMeters,
    hectares_per_hour: machine.hectaresPerHour,
    insurance_per_year: machine.insurancePerYear,
    tax_per_year: machine.taxPerYear,
    storage_per_year: machine.storagePerYear,
    other_fixed_costs_per_year: machine.otherFixedCostsPerYear,
    maintenance_costs_per_year: machine.maintenanceCostsPerYear,
    repair_costs_per_year: machine.repairCostsPerYear,
    fuel_costs_per_hour: machine.fuelCostsPerHour,
    operator_costs_per_hour: machine.operatorCostsPerHour,
    other_variable_costs_per_hour: machine.otherVariableCostsPerHour,
    annual_kilometers: machine.annualKilometers,
    status: machine.status,
    notes: machine.notes,
    created_at: machine.createdAt,
    updated_at: machine.updatedAt
  };
}

function mapMachineInputToRow(input: Partial<CreateMachineInput & Pick<Machine, "updatedAt">>): Partial<MachineRow> {
  return {
    farm_id: input.farmId,
    name: input.name,
    category: input.category,
    unit: input.unit,
    manufacturer: input.manufacturer,
    model: input.model,
    year_of_manufacture: input.yearOfManufacture,
    purchase_date: input.purchaseDate,
    purchase_price: input.purchasePrice,
    new_price: input.newPrice,
    current_value: input.currentValue,
    residual_value: input.residualValue,
    expected_useful_life_years: input.expectedUsefulLifeYears,
    annual_operating_hours: input.annualOperatingHours,
    current_operating_hours: input.currentOperatingHours,
    current_kilometers: input.currentKilometers,
    working_width_meters: input.workingWidthMeters,
    hectares_per_hour: input.hectaresPerHour,
    insurance_per_year: input.insurancePerYear,
    tax_per_year: input.taxPerYear,
    storage_per_year: input.storagePerYear,
    other_fixed_costs_per_year: input.otherFixedCostsPerYear,
    maintenance_costs_per_year: input.maintenanceCostsPerYear,
    repair_costs_per_year: input.repairCostsPerYear,
    fuel_costs_per_hour: input.fuelCostsPerHour,
    operator_costs_per_hour: input.operatorCostsPerHour,
    other_variable_costs_per_hour: input.otherVariableCostsPerHour,
    annual_kilometers: input.annualKilometers,
    status: input.status,
    notes: input.notes,
    updated_at: input.updatedAt
  };
}

function triggerReminderSync(): void {
  scheduleReminderSync();
}
