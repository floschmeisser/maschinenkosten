import { getSupabaseClient, runSupabaseQuery } from "@/lib/supabase/client";
import { getCurrentFarm, type Farm } from "./farms-database";
import { placeholderFarmId } from "./machines";
import {
  createReminderKey,
  isReminderOpen,
  placeholderReminders,
  sortRemindersByPriority,
  type CreateReminderInput,
  type Reminder,
  type ReminderStatus,
  type UpdateReminderInput
} from "./reminders";
import { buildReminderInsertPayload } from "./payload-builders";

type ReminderRow = {
  id: string;
  farm_id: string;
  reminder_key: string;
  type: Reminder["type"];
  source_type: Reminder["sourceType"];
  source_id: string;
  machine_id: string | null;
  title: string;
  message: string | null;
  due_date: string | null;
  priority: Reminder["priority"];
  status: ReminderStatus;
  acknowledged_at: string | null;
  dismissed_at: string | null;
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

type ReminderDataSource = {
  farm: Farm;
  table: SupabaseTableApi<ReminderRow>;
};

let fallbackReminders = [...placeholderReminders];

export async function getReminders(): Promise<Reminder[]> {
  const source = await getReminderDataSource();

  if (!source) {
    return sortRemindersByPriority(fallbackReminders);
  }

  const result = await runSupabaseQuery(
    () => source.table.select("*").eq("farm_id", source.farm.id),
    "Erinnerungen konnten nicht geladen werden."
  );

  if (!result?.data) {
    return sortRemindersByPriority(fallbackReminders);
  }

  fallbackReminders = result.data.map(mapReminderRowToReminder);
  return sortRemindersByPriority(fallbackReminders);
}

export async function getOpenReminders(): Promise<Reminder[]> {
  return sortRemindersByPriority((await getReminders()).filter(isReminderOpen));
}

export async function createReminder(input: CreateReminderInput): Promise<Reminder> {
  const source = await getReminderDataSource();
  const now = new Date().toISOString();
  const farmId = source?.farm.id ?? input.farmId;
  const reminder: Reminder = {
    ...input,
    farmId,
    reminderKey: input.reminderKey ?? createReminderKey(input),
    status: "open",
    acknowledgedAt: null,
    dismissedAt: null,
    completedAt: null,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now
  };

  if (!source) {
    fallbackReminders = [reminder, ...fallbackReminders];
    return reminder;
  }

  const result = await runSupabaseQuery(
    () => source.table.insert(buildReminderInsertPayload(reminder)).select("*").single(),
    "Erinnerung konnte nicht angelegt werden."
  );

  if (!result?.data) {
    console.warn("[reminders] INSERT failed or returned no data", { reminderKey: reminder.reminderKey, type: reminder.type });
    const existingReminder = (await getReminders()).find((item) => item.reminderKey === reminder.reminderKey);

    if (existingReminder) {
      return existingReminder;
    }

    fallbackReminders = [reminder, ...fallbackReminders];
    return reminder;
  }

  const createdReminder = mapReminderRowToReminder(result.data);
  fallbackReminders = [createdReminder, ...fallbackReminders.filter((item) => item.id !== createdReminder.id)];
  return createdReminder;
}

export async function upsertReminder(input: CreateReminderInput): Promise<Reminder> {
  const reminderKey = input.reminderKey ?? createReminderKey(input);
  const existing = (await getReminders()).find((reminder) => reminder.reminderKey === reminderKey);

  if (existing) {
    if (existing.status === "dismissed" || existing.status === "completed") {
      return existing;
    }

    return updateReminder(existing.id, {
      ...input,
      reminderKey,
      status: existing.status
    }) as Promise<Reminder>;
  }

  return createReminder({ ...input, reminderKey });
}

export async function acknowledgeReminder(id: string): Promise<Reminder | null> {
  return updateReminderStatus(id, "acknowledged", { acknowledgedAt: new Date().toISOString() });
}

export async function dismissReminder(id: string): Promise<Reminder | null> {
  return updateReminderStatus(id, "dismissed", { dismissedAt: new Date().toISOString() });
}

export async function completeReminder(id: string): Promise<Reminder | null> {
  return updateReminderStatus(id, "completed", { completedAt: new Date().toISOString() });
}

async function updateReminderStatus(id: string, status: ReminderStatus, dates: Partial<Reminder>): Promise<Reminder | null> {
  return updateReminder(id, { ...dates, status });
}

async function updateReminder(id: string, input: UpdateReminderInput & { reminderKey?: string }): Promise<Reminder | null> {
  const existing = fallbackReminders.find((reminder) => reminder.id === id);
  const now = new Date().toISOString();
  const fallbackReminder = existing ? { ...existing, ...input, updatedAt: now } : null;
  const source = await getReminderDataSource();

  if (!source) {
    if (fallbackReminder) {
      fallbackReminders = fallbackReminders.map((reminder) => (reminder.id === id ? fallbackReminder : reminder));
    }

    return fallbackReminder;
  }

  const result = await runSupabaseQuery(
    () =>
      source.table
        .update(mapReminderInputToRow({ ...input, updatedAt: now }))
        .eq("id", id)
        .eq("farm_id", source.farm.id)
        .select("*")
        .single(),
    "Erinnerung konnte nicht aktualisiert werden."
  );

  if (!result?.data) {
    return fallbackReminder;
  }

  const updatedReminder = mapReminderRowToReminder(result.data);
  fallbackReminders = fallbackReminders.map((reminder) => (reminder.id === id ? updatedReminder : reminder));
  return updatedReminder;
}

async function getReminderDataSource(): Promise<ReminderDataSource | null> {
  const [farm, table] = await Promise.all([getCurrentFarm(), getReminderTable()]);

  if (!table || farm.id === placeholderFarmId) {
    return null;
  }

  return { farm, table };
}

async function getReminderTable(): Promise<SupabaseTableApi<ReminderRow> | null> {
  const supabase = await getSupabaseClient();

  if (!supabase) {
    return null;
  }

  return supabase.from("reminders") as unknown as SupabaseTableApi<ReminderRow>;
}

function mapReminderRowToReminder(row: ReminderRow): Reminder {
  return {
    id: row.id,
    farmId: row.farm_id,
    reminderKey: row.reminder_key,
    type: row.type,
    sourceType: row.source_type,
    sourceId: row.source_id,
    machineId: row.machine_id,
    title: row.title,
    message: row.message,
    dueDate: row.due_date,
    priority: row.priority,
    status: row.status,
    acknowledgedAt: row.acknowledged_at,
    dismissedAt: row.dismissed_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapReminderToRow(reminder: Reminder): ReminderRow {
  return {
    id: reminder.id,
    farm_id: reminder.farmId,
    reminder_key: reminder.reminderKey,
    type: reminder.type,
    source_type: reminder.sourceType,
    source_id: reminder.sourceId,
    machine_id: reminder.machineId ?? null,
    title: reminder.title,
    message: reminder.message,
    due_date: reminder.dueDate ?? null,
    priority: reminder.priority,
    status: reminder.status,
    acknowledged_at: reminder.acknowledgedAt ?? null,
    dismissed_at: reminder.dismissedAt ?? null,
    completed_at: reminder.completedAt ?? null,
    created_at: reminder.createdAt,
    updated_at: reminder.updatedAt
  };
}

function mapReminderInputToRow(input: Partial<UpdateReminderInput & Pick<Reminder, "updatedAt" | "reminderKey">>): Partial<ReminderRow> {
  return {
    reminder_key: input.reminderKey,
    type: input.type,
    source_type: input.sourceType,
    source_id: input.sourceId,
    machine_id: input.machineId ?? undefined,
    title: input.title,
    message: input.message,
    due_date: input.dueDate,
    priority: input.priority,
    status: input.status,
    acknowledged_at: input.acknowledgedAt,
    dismissed_at: input.dismissedAt,
    completed_at: input.completedAt,
    updated_at: input.updatedAt
  };
}
