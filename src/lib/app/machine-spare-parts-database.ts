import { getSupabaseClient, runSupabaseQuery } from "@/lib/supabase/client";
import { getCurrentFarm, type Farm } from "./farms-database";
import {
  isMachineSparePartLowStock,
  placeholderFarmId,
  placeholderMachineSpareParts,
  type CreateMachineSparePartInput,
  type MachineSparePart,
  type UpdateMachineSparePartInput
} from "./machines";
import { scheduleReminderSync } from "./reminder-sync-scheduler";
import { buildSparePartInsertPayload } from "./payload-builders";

type MachineSparePartRow = {
  id: string;
  farm_id: string;
  machine_id: string;
  name: string;
  category: MachineSparePart["category"];
  part_number: string | null;
  original_part_number: string | null;
  manufacturer: string | null;
  supplier: string | null;
  stock_quantity: number;
  minimum_stock_quantity: number;
  unit: string;
  storage_location: string | null;
  purchase_price: number | null;
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

type SparePartsDataSource = {
  farm: Farm;
  table: SupabaseTableApi<MachineSparePartRow>;
};

let fallbackSpareParts = [...placeholderMachineSpareParts];

export async function getMachineSpareParts(machineId: string): Promise<MachineSparePart[]> {
  const source = await getSparePartsDataSource();

  if (!source) {
    return fallbackSpareParts.filter((part) => part.machineId === machineId);
  }

  const result = await runSupabaseQuery(
    () => source.table.select("*").eq("farm_id", source.farm.id),
    "Ersatzteile konnten nicht geladen werden."
  );

  if (!result?.data) {
    return fallbackSpareParts.filter((part) => part.machineId === machineId);
  }

  fallbackSpareParts = result.data.map(mapSparePartRowToSparePart);
  return fallbackSpareParts.filter((part) => part.machineId === machineId);
}

export async function createMachineSparePart(input: CreateMachineSparePartInput): Promise<MachineSparePart> {
  const source = await getSparePartsDataSource();
  const farmId = source?.farm.id ?? input.farmId;
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const fallbackPart: MachineSparePart = { ...input, farmId, id, createdAt: now, updatedAt: now };

  if (!source) {
    fallbackSpareParts = [fallbackPart, ...fallbackSpareParts];
    triggerReminderSync();
    return fallbackPart;
  }

  const { data, error } = await source.table
    .insert({ id, ...buildSparePartInsertPayload(input, farmId) })
    .select("*")
    .single();

  if (error) {
    const e = error as { message?: string; code?: string; details?: string; hint?: string };
    console.error("[machine_spare_parts] INSERT failed:", { message: e.message, code: e.code, details: e.details, hint: e.hint, input, farmId });
    throw new Error(`Ersatzteil konnte nicht angelegt werden: ${e.message ?? "Unbekannter Fehler"}`);
  }

  if (!data) {
    throw new Error("Ersatzteil angelegt, aber keine Bestätigung vom Server erhalten.");
  }

  const createdPart = mapSparePartRowToSparePart(data);
  fallbackSpareParts = [createdPart, ...fallbackSpareParts.filter((p) => p.id !== createdPart.id)];
  triggerReminderSync();
  return createdPart;
}

export async function updateMachineSparePart(id: string, input: UpdateMachineSparePartInput): Promise<MachineSparePart | null> {
  const existing = fallbackSpareParts.find((part) => part.id === id);
  const now = new Date().toISOString();
  const fallbackPart = existing ? { ...existing, ...input, updatedAt: now } : null;
  const source = await getSparePartsDataSource();

  if (!source) {
    if (fallbackPart) {
      fallbackSpareParts = fallbackSpareParts.map((part) => (part.id === id ? fallbackPart : part));
      triggerReminderSync();
    }

    return fallbackPart;
  }

  const result = await runSupabaseQuery(
    () =>
      source.table
        .update(mapSparePartInputToRow({ ...input, updatedAt: now }))
        .eq("id", id)
        .eq("farm_id", source.farm.id)
        .select("*")
        .single(),
    "Ersatzteil konnte nicht aktualisiert werden."
  );

  if (!result?.data) {
    if (fallbackPart) {
      triggerReminderSync();
    }

    return fallbackPart;
  }

  const updatedPart = mapSparePartRowToSparePart(result.data);
  fallbackSpareParts = fallbackSpareParts.map((part) => (part.id === id ? updatedPart : part));
  triggerReminderSync();
  return updatedPart;
}

export async function deleteMachineSparePart(id: string): Promise<boolean> {
  const source = await getSparePartsDataSource();

  if (!source) {
    const hadPart = fallbackSpareParts.some((part) => part.id === id);
    fallbackSpareParts = fallbackSpareParts.filter((part) => part.id !== id);
    if (hadPart) {
      triggerReminderSync();
    }
    return hadPart;
  }

  const result = await runSupabaseQuery(
    () => source.table.delete().eq("id", id).eq("farm_id", source.farm.id),
    "Ersatzteil konnte nicht gelöscht werden."
  );

  if (!result) {
    const hadPart = fallbackSpareParts.some((part) => part.id === id);
    fallbackSpareParts = fallbackSpareParts.filter((part) => part.id !== id);
    if (hadPart) {
      triggerReminderSync();
    }
    return hadPart;
  }

  fallbackSpareParts = fallbackSpareParts.filter((part) => part.id !== id);
  triggerReminderSync();
  return true;
}

export async function getLowStockSpareParts(machineId?: string): Promise<MachineSparePart[]> {
  const source = await getSparePartsDataSource();

  if (!source) {
    return fallbackSpareParts.filter((part) => (!machineId || part.machineId === machineId) && isMachineSparePartLowStock(part));
  }

  const result = await runSupabaseQuery(
    () => source.table.select("*").eq("farm_id", source.farm.id),
    "Niedrige Ersatzteilbestaende konnten nicht geladen werden."
  );

  if (!result?.data) {
    return fallbackSpareParts.filter((part) => (!machineId || part.machineId === machineId) && isMachineSparePartLowStock(part));
  }

  fallbackSpareParts = result.data.map(mapSparePartRowToSparePart);
  return fallbackSpareParts.filter((part) => (!machineId || part.machineId === machineId) && isMachineSparePartLowStock(part));
}

async function getSparePartsDataSource(): Promise<SparePartsDataSource | null> {
  const [farm, table] = await Promise.all([getCurrentFarm(), getSparePartsTable()]);

  if (!table || farm.id === placeholderFarmId) {
    return null;
  }

  return { farm, table };
}

async function getSparePartsTable(): Promise<SupabaseTableApi<MachineSparePartRow> | null> {
  const supabase = await getSupabaseClient();

  if (!supabase) {
    return null;
  }

  return supabase.from("machine_spare_parts") as unknown as SupabaseTableApi<MachineSparePartRow>;
}

function mapSparePartRowToSparePart(row: MachineSparePartRow): MachineSparePart {
  return {
    id: row.id,
    farmId: row.farm_id,
    machineId: row.machine_id,
    name: row.name,
    category: row.category,
    partNumber: row.part_number,
    originalPartNumber: row.original_part_number,
    manufacturer: row.manufacturer,
    supplier: row.supplier,
    stockQuantity: row.stock_quantity,
    minimumStockQuantity: row.minimum_stock_quantity,
    unit: row.unit,
    storageLocation: row.storage_location,
    purchasePrice: row.purchase_price,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSparePartToRow(part: MachineSparePart): MachineSparePartRow {
  return {
    id: part.id,
    farm_id: part.farmId,
    machine_id: part.machineId,
    name: part.name,
    category: part.category,
    part_number: part.partNumber,
    original_part_number: part.originalPartNumber,
    manufacturer: part.manufacturer,
    supplier: part.supplier,
    stock_quantity: part.stockQuantity,
    minimum_stock_quantity: part.minimumStockQuantity,
    unit: part.unit,
    storage_location: part.storageLocation,
    purchase_price: part.purchasePrice,
    notes: part.notes,
    created_at: part.createdAt,
    updated_at: part.updatedAt
  };
}

function mapSparePartInputToRow(
  input: Partial<CreateMachineSparePartInput & Pick<MachineSparePart, "updatedAt">>
): Partial<MachineSparePartRow> {
  return {
    farm_id: input.farmId,
    machine_id: input.machineId,
    name: input.name,
    category: input.category,
    part_number: input.partNumber,
    original_part_number: input.originalPartNumber,
    manufacturer: input.manufacturer,
    supplier: input.supplier,
    stock_quantity: input.stockQuantity,
    minimum_stock_quantity: input.minimumStockQuantity,
    unit: input.unit,
    storage_location: input.storageLocation,
    purchase_price: input.purchasePrice,
    notes: input.notes,
    updated_at: input.updatedAt
  };
}

function triggerReminderSync(): void {
  scheduleReminderSync();
}
