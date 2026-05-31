import { getSupabaseClient, runSupabaseQuery } from "@/lib/supabase/client";
import { getMachineById } from "./machines-database";
import { getCurrentFarm, type Farm } from "./farms-database";
import {
  createNextRecurringMaintenanceTask,
  placeholderMaintenanceTasks,
  type CompleteMaintenanceTaskInput,
  type CreateMaintenanceTaskInput,
  type MaintenanceTask,
  type UpdateMaintenanceTaskInput
} from "./maintenance";
import { placeholderFarmId } from "./machines";
import { scheduleReminderSync } from "./reminder-sync-scheduler";
import { deriveAppIntervalType, isExtendedMaintenanceType, mapMaintenanceTypeToDb, mapIntervalTypeStringToDb } from "./db-mappers";
import { buildMaintenanceTaskInsertPayload } from "./payload-builders";

export type CompleteMaintenanceTaskResult = {
  completedTask: MaintenanceTask | null;
  nextTask: MaintenanceTask | null;
};

type MaintenanceTaskRow = {
  id: string;
  farm_id: string;
  machine_id: string;
  title: string;
  type: MaintenanceTask["type"];
  custom_title: string | null;
  status: MaintenanceTask["status"];
  due_date: string | null;
  due_operating_hours: number | null;
  due_kilometers: number | null;
  interval_type: MaintenanceTask["intervalType"];
  interval_days: number | null;
  interval_months: number | null;
  interval_operating_hours: number | null;
  interval_kilometers: number | null;
  last_done_reading: number | null;
  estimated_cost: number;
  actual_cost: number | null;
  notes: string | null;
  completed_at: string | null;
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
};

type MaintenanceDataSource = {
  farm: Farm;
  table: SupabaseTableApi<MaintenanceTaskRow>;
};


let fallbackMaintenanceTasks = [...placeholderMaintenanceTasks];

export async function getMaintenanceTasks(): Promise<MaintenanceTask[]> {
  const source = await getMaintenanceDataSource();

  if (!source) {
    return fallbackMaintenanceTasks;
  }

  const result = await runSupabaseQuery(
    () => source.table.select("*").eq("farm_id", source.farm.id),
    "Wartungen konnten nicht geladen werden."
  );

  if (!result?.data) {
    return fallbackMaintenanceTasks;
  }

  fallbackMaintenanceTasks = result.data.map(mapMaintenanceTaskRowToTask);
  return fallbackMaintenanceTasks;
}

export async function getMaintenanceTasksByMachine(machineId: string): Promise<MaintenanceTask[]> {
  const tasks = await getMaintenanceTasks();
  return tasks.filter((task) => task.machineId === machineId);
}

export async function createMaintenanceTask(input: CreateMaintenanceTaskInput): Promise<MaintenanceTask> {
  const source = await getMaintenanceDataSource();
  const farmId = source?.farm.id ?? input.farmId;
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const fallbackTask: MaintenanceTask = {
    ...input,
    farmId,
    id,
    completedAt: null,
    lastDoneReading: null,
    createdAt: now,
    updatedAt: now
  };

  if (!source) {
    fallbackMaintenanceTasks = [fallbackTask, ...fallbackMaintenanceTasks];
    triggerReminderSync();
    return fallbackTask;
  }

  const { data, error } = await source.table
    .insert({ id, ...buildMaintenanceTaskInsertPayload(input, farmId) })
    .select("*")
    .single();

  if (error) {
    const e = error as { message?: string; code?: string; details?: string; hint?: string };
    console.error("[maintenance_tasks] INSERT failed:", { message: e.message, code: e.code, details: e.details, hint: e.hint, input, farmId });
    throw new Error(`Wartung konnte nicht angelegt werden: ${e.message ?? "Unbekannter Fehler"}`);
  }

  if (!data) {
    throw new Error("Wartung angelegt, aber keine Bestätigung vom Server erhalten.");
  }

  const createdTask = mapMaintenanceTaskRowToTask(data);
  fallbackMaintenanceTasks = [createdTask, ...fallbackMaintenanceTasks.filter((t) => t.id !== createdTask.id)];
  triggerReminderSync();
  return createdTask;
}

export async function updateMaintenanceTask(id: string, input: UpdateMaintenanceTaskInput): Promise<MaintenanceTask | null> {
  const existing = fallbackMaintenanceTasks.find((task) => task.id === id);
  const now = new Date().toISOString();
  const fallbackTask = existing ? { ...existing, ...input, updatedAt: now } : null;
  const source = await getMaintenanceDataSource();

  if (!source) {
    if (fallbackTask) {
      fallbackMaintenanceTasks = fallbackMaintenanceTasks.map((task) => (task.id === id ? fallbackTask : task));
      triggerReminderSync();
    }

    return fallbackTask;
  }

  const result = await runSupabaseQuery(
    () =>
      source.table
        .update(mapMaintenanceTaskInputToRow({ ...input, updatedAt: now }))
        .eq("id", id)
        .eq("farm_id", source.farm.id)
        .select("*")
        .single(),
    "Wartung konnte nicht aktualisiert werden."
  );

  if (!result?.data) {
    if (fallbackTask) {
      triggerReminderSync();
    }

    return fallbackTask;
  }

  const updatedTask = mapMaintenanceTaskRowToTask(result.data);
  fallbackMaintenanceTasks = fallbackMaintenanceTasks.map((task) => (task.id === id ? updatedTask : task));
  triggerReminderSync();
  return updatedTask;
}

export async function completeMaintenanceTask(
  id: string,
  completionData: CompleteMaintenanceTaskInput = {}
): Promise<CompleteMaintenanceTaskResult> {
  const completedAt = completionData.completedAt ?? new Date().toISOString();
  const existing = (await getMaintenanceTasks()).find((task) => task.id === id);
  const wasAlreadyCompleted = existing?.status === "completed";
  const notes = mergeCompletionNotes(existing?.notes ?? null, completionData.notes);
  const updateInput: UpdateMaintenanceTaskInput = {
    status: "completed",
    completedAt
  };

  if (completionData.actualCost !== undefined) {
    updateInput.actualCost = completionData.actualCost;
  }

  if (completionData.notes !== undefined) {
    updateInput.notes = notes;
  }

  if (completionData.currentReading !== undefined && completionData.currentReading !== null) {
    updateInput.lastDoneReading = completionData.currentReading;
  }

  const completedTask = await updateMaintenanceTask(id, updateInput);

  if (!completedTask || wasAlreadyCompleted) {
    return { completedTask, nextTask: null };
  }

  const machine = await getMachineById(completedTask.machineId);
  const nextInput = createNextRecurringMaintenanceTask(completedTask, machine);

  if (!nextInput) {
    return { completedTask, nextTask: null };
  }

  const tasks = await getMaintenanceTasks();

  if (hasDuplicateRecurringTask(nextInput, tasks)) {
    return { completedTask, nextTask: null };
  }

  try {
    const nextTask = await createMaintenanceTask(nextInput);
    return { completedTask, nextTask };
  } catch (error) {
    console.error("[maintenance] Folgeaufgabe konnte nicht angelegt werden:", error);
    return { completedTask, nextTask: null };
  }
}

function mergeCompletionNotes(existingNotes: string | null, completionNotes: string | null | undefined): string | null {
  if (completionNotes === undefined) {
    return existingNotes;
  }

  const cleanCompletionNotes = completionNotes?.trim() ?? "";

  if (!existingNotes) {
    return cleanCompletionNotes || null;
  }

  if (!cleanCompletionNotes || existingNotes.includes(cleanCompletionNotes)) {
    return existingNotes;
  }

  return `${existingNotes}\n${cleanCompletionNotes}`;
}

function hasDuplicateRecurringTask(input: CreateMaintenanceTaskInput, tasks: MaintenanceTask[]): boolean {
  return tasks.some(
    (task) =>
      task.machineId === input.machineId &&
      task.title === input.title &&
      task.type === input.type &&
      task.status !== "completed" &&
      task.status !== "cancelled" &&
      task.dueDate === input.dueDate &&
      task.dueOperatingHours === input.dueOperatingHours &&
      task.dueKilometers === input.dueKilometers
  );
}

async function getMaintenanceDataSource(): Promise<MaintenanceDataSource | null> {
  const [farm, table] = await Promise.all([getCurrentFarm(), getMaintenanceTasksTable()]);

  if (!table || farm.id === placeholderFarmId) {
    return null;
  }

  return { farm, table };
}

async function getMaintenanceTasksTable(): Promise<SupabaseTableApi<MaintenanceTaskRow> | null> {
  const supabase = await getSupabaseClient();

  if (!supabase) {
    return null;
  }

  return supabase.from("maintenance_tasks") as unknown as SupabaseTableApi<MaintenanceTaskRow>;
}

function mapMaintenanceTaskRowToTask(row: MaintenanceTaskRow): MaintenanceTask {
  const storedCustomTitle = row.custom_title;
  const isExtendedTypeStored = storedCustomTitle !== null && isExtendedMaintenanceType(storedCustomTitle);
  const logicalType = isExtendedTypeStored ? (storedCustomTitle as MaintenanceTask["type"]) : row.type;
  const logicalCustomTitle = isExtendedTypeStored ? null : storedCustomTitle;

  return {
    id: row.id,
    farmId: row.farm_id,
    machineId: row.machine_id,
    title: row.title,
    type: logicalType,
    customTitle: logicalCustomTitle,
    status: row.status,
    dueDate: row.due_date,
    dueOperatingHours: row.due_operating_hours,
    dueKilometers: row.due_kilometers,
    intervalType: deriveAppIntervalType(row),
    intervalDays: row.interval_days,
    intervalMonths: row.interval_months,
    intervalOperatingHours: row.interval_operating_hours,
    intervalKilometers: row.interval_kilometers,
    lastDoneReading: row.last_done_reading,
    estimatedCost: row.estimated_cost,
    actualCost: row.actual_cost,
    notes: row.notes,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapMaintenanceTaskInputToRow(
  input: Partial<CreateMaintenanceTaskInput & Pick<MaintenanceTask, "completedAt" | "lastDoneReading" | "updatedAt">>
): Partial<MaintenanceTaskRow> {
  const rawType = input.type;
  const rawIntervalType = input.intervalType;
  const isMonthsInterval = rawIntervalType === "months";
  const isCombinedInterval = rawIntervalType === "combined";

  return {
    farm_id: input.farmId,
    machine_id: input.machineId,
    title: input.title,
    type: rawType ? (mapMaintenanceTypeToDb(rawType) as MaintenanceTask["type"]) : undefined,
    custom_title: rawType && isExtendedMaintenanceType(rawType) ? rawType : input.customTitle,
    status: input.status,
    due_date: input.dueDate,
    due_operating_hours: input.dueOperatingHours,
    due_kilometers: input.dueKilometers,
    interval_type: rawIntervalType ? mapIntervalTypeStringToDb(rawIntervalType) : undefined,
    interval_days: isMonthsInterval ? ((input.intervalMonths ?? 0) * 30 || null) : input.intervalDays,
    interval_months: (isMonthsInterval || isCombinedInterval) ? (input.intervalMonths ?? null) : input.intervalMonths,
    interval_operating_hours: input.intervalOperatingHours,
    interval_kilometers: input.intervalKilometers,
    last_done_reading: input.lastDoneReading,
    estimated_cost: input.estimatedCost,
    actual_cost: input.actualCost,
    notes: input.notes,
    completed_at: input.completedAt,
    updated_at: input.updatedAt
  };
}

function triggerReminderSync(): void {
  scheduleReminderSync();
}
