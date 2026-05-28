import { createSupabaseBrowserClient, runSupabaseQuery } from "@/lib/supabase/client";
import { getCurrentFarm, type Farm } from "./farms-database";
import { getMachineSpareParts, updateMachineSparePart } from "./machine-spare-parts-database";
import { getMaintenanceTasksByMachine } from "./maintenance-database";
import { placeholderFarmId, type MachineSparePart } from "./machines";
import {
  placeholderMaintenanceUsedParts,
  type CreateMaintenanceUsedPartInput,
  type MaintenanceUsedPart
} from "./maintenance";

type MaintenanceUsedPartRow = {
  id: string;
  farm_id: string;
  maintenance_task_id: string;
  spare_part_id: string;
  machine_id: string;
  quantity_used: number;
  notes: string | null;
  created_at: string;
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
  delete: () => {
    eq: (column: string, value: string) => {
      eq: (column: string, value: string) => Promise<{ error: Error | null }>;
    };
  };
};

type UsedPartsDataSource = {
  farm: Farm;
  table: SupabaseTableApi<MaintenanceUsedPartRow>;
};

export type ApplyUsedPartsToStockResult = {
  success: boolean;
  warnings: string[];
  updatedParts: MachineSparePart[];
};

export type MachineUsedPartHistoryItem = MaintenanceUsedPart & {
  sparePartName: string | null;
  sparePartNumber: string | null;
  sparePartUnit: string | null;
  maintenanceTaskTitle: string | null;
};

export type MaintenanceTaskUsedPartHistoryItem = MaintenanceUsedPart & {
  sparePartName: string | null;
  sparePartNumber: string | null;
  sparePartUnit: string | null;
};

let fallbackUsedParts = [...placeholderMaintenanceUsedParts];

export async function getUsedPartsForMaintenanceTask(taskId: string): Promise<MaintenanceUsedPart[]> {
  const source = await getUsedPartsDataSource();

  if (!source) {
    return fallbackUsedParts.filter((part) => part.maintenanceTaskId === taskId);
  }

  const result = await runSupabaseQuery(
    () => source.table.select("*").eq("farm_id", source.farm.id),
    "Verwendete Ersatzteile konnten nicht geladen werden."
  );

  if (!result?.data) {
    return fallbackUsedParts.filter((part) => part.maintenanceTaskId === taskId);
  }

  fallbackUsedParts = result.data.map(mapUsedPartRowToUsedPart);
  return fallbackUsedParts.filter((part) => part.maintenanceTaskId === taskId);
}

export async function getUsedPartsForMachine(machineId: string): Promise<MachineUsedPartHistoryItem[]> {
  const [usedParts, spareParts, maintenanceTasks] = await Promise.all([
    getAllUsedPartsForMachine(machineId),
    getMachineSpareParts(machineId),
    getMaintenanceTasksByMachine(machineId)
  ]);

  return usedParts
    .map((usedPart) => {
      const sparePart = spareParts.find((part) => part.id === usedPart.sparePartId);
      const task = maintenanceTasks.find((item) => item.id === usedPart.maintenanceTaskId);

      return {
        ...usedPart,
        sparePartName: sparePart?.name ?? null,
        sparePartNumber: sparePart?.partNumber ?? null,
        sparePartUnit: sparePart?.unit ?? null,
        maintenanceTaskTitle: task?.title ?? null
      };
    })
    .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());
}

export async function getUsedPartHistoryForMaintenanceTask(taskId: string): Promise<MaintenanceTaskUsedPartHistoryItem[]> {
  const usedParts = await getUsedPartsForMaintenanceTask(taskId);
  const machineId = usedParts[0]?.machineId;

  if (!machineId) {
    return [];
  }

  const spareParts = await getMachineSpareParts(machineId);

  return usedParts.map((usedPart) => {
    const sparePart = spareParts.find((part) => part.id === usedPart.sparePartId);

    return {
      ...usedPart,
      sparePartName: sparePart?.name ?? null,
      sparePartNumber: sparePart?.partNumber ?? null,
      sparePartUnit: sparePart?.unit ?? null
    };
  });
}

export async function createMaintenanceUsedPart(input: CreateMaintenanceUsedPartInput): Promise<MaintenanceUsedPart> {
  const source = await getUsedPartsDataSource();
  const farmId = source?.farm.id ?? input.farmId;
  const fallbackPart: MaintenanceUsedPart = {
    ...input,
    farmId,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString()
  };

  if (!source) {
    fallbackUsedParts = [fallbackPart, ...fallbackUsedParts];
    return fallbackPart;
  }

  const result = await runSupabaseQuery(
    () => source.table.insert(mapUsedPartToRow(fallbackPart)).select("*").single(),
    "Verwendetes Ersatzteil konnte nicht gespeichert werden."
  );

  if (!result?.data) {
    fallbackUsedParts = [fallbackPart, ...fallbackUsedParts];
    return fallbackPart;
  }

  const createdPart = mapUsedPartRowToUsedPart(result.data);
  fallbackUsedParts = [createdPart, ...fallbackUsedParts.filter((part) => part.id !== createdPart.id)];
  return createdPart;
}

export async function deleteMaintenanceUsedPart(id: string): Promise<boolean> {
  const source = await getUsedPartsDataSource();

  if (!source) {
    const hadPart = fallbackUsedParts.some((part) => part.id === id);
    fallbackUsedParts = fallbackUsedParts.filter((part) => part.id !== id);
    return hadPart;
  }

  const result = await runSupabaseQuery(
    () => source.table.delete().eq("id", id).eq("farm_id", source.farm.id),
    "Verwendetes Ersatzteil konnte nicht geloescht werden."
  );

  if (!result) {
    const hadPart = fallbackUsedParts.some((part) => part.id === id);
    fallbackUsedParts = fallbackUsedParts.filter((part) => part.id !== id);
    return hadPart;
  }

  fallbackUsedParts = fallbackUsedParts.filter((part) => part.id !== id);
  return true;
}

export async function applyUsedPartsToStock(taskId: string): Promise<ApplyUsedPartsToStockResult> {
  const usedParts = await getUsedPartsForMaintenanceTask(taskId);
  const warnings: string[] = [];
  const updatedParts: MachineSparePart[] = [];

  for (const usedPart of usedParts) {
    const spareParts = await getMachineSpareParts(usedPart.machineId);
    const sparePart = spareParts.find((part) => part.id === usedPart.sparePartId);

    if (!sparePart) {
      warnings.push("Ersatzteil nicht gefunden.");
      continue;
    }

    const nextQuantity = sparePart.stockQuantity - usedPart.quantityUsed;
    const stockQuantity = Math.max(0, nextQuantity);

    if (nextQuantity < 0) {
      warnings.push(`Nicht genug auf Lager: ${sparePart.name}`);
    }

    const updatedPart = await updateMachineSparePart(sparePart.id, { stockQuantity });

    if (!updatedPart) {
      warnings.push(`Lager konnte nicht aktualisiert werden: ${sparePart.name}`);
      continue;
    }

    updatedParts.push(updatedPart);
  }

  return {
    success: warnings.length === 0,
    warnings,
    updatedParts
  };
}

async function getAllUsedPartsForMachine(machineId: string): Promise<MaintenanceUsedPart[]> {
  const source = await getUsedPartsDataSource();

  if (!source) {
    return fallbackUsedParts.filter((part) => part.machineId === machineId);
  }

  const result = await runSupabaseQuery(
    () => source.table.select("*").eq("farm_id", source.farm.id),
    "Ersatzteil-Verbrauch konnte nicht geladen werden."
  );

  if (!result?.data) {
    return fallbackUsedParts.filter((part) => part.machineId === machineId);
  }

  fallbackUsedParts = result.data.map(mapUsedPartRowToUsedPart);
  return fallbackUsedParts.filter((part) => part.machineId === machineId);
}

async function getUsedPartsDataSource(): Promise<UsedPartsDataSource | null> {
  const [farm, table] = await Promise.all([getCurrentFarm(), getUsedPartsTable()]);

  if (!table || farm.id === placeholderFarmId) {
    return null;
  }

  return { farm, table };
}

async function getUsedPartsTable(): Promise<SupabaseTableApi<MaintenanceUsedPartRow> | null> {
  const supabase = await createSupabaseBrowserClient();

  if (!supabase) {
    return null;
  }

  return supabase.from("maintenance_used_parts") as unknown as SupabaseTableApi<MaintenanceUsedPartRow>;
}

function mapUsedPartRowToUsedPart(row: MaintenanceUsedPartRow): MaintenanceUsedPart {
  return {
    id: row.id,
    farmId: row.farm_id,
    maintenanceTaskId: row.maintenance_task_id,
    sparePartId: row.spare_part_id,
    machineId: row.machine_id,
    quantityUsed: row.quantity_used,
    notes: row.notes,
    createdAt: row.created_at
  };
}

function mapUsedPartToRow(part: MaintenanceUsedPart): MaintenanceUsedPartRow {
  return {
    id: part.id,
    farm_id: part.farmId,
    maintenance_task_id: part.maintenanceTaskId,
    spare_part_id: part.sparePartId,
    machine_id: part.machineId,
    quantity_used: part.quantityUsed,
    notes: part.notes,
    created_at: part.createdAt
  };
}
