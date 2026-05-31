import { getSupabaseClient, runSupabaseQuery } from "@/lib/supabase/client";
import { getCurrentFarm, type Farm } from "./farms-database";
import { placeholderFarmId } from "./machines";
import {
  placeholderCalendarEvents,
  type CalendarEvent,
  type CreateCalendarEventInput,
  type UpdateCalendarEventInput
} from "./calendar-events";
import { scheduleReminderSync } from "./reminder-sync-scheduler";
import { buildCalendarEventInsertPayload } from "./payload-builders";

type CalendarEventRow = {
  id: string;
  farm_id: string;
  machine_id: string | null;
  title: string;
  event_date: string;
  event_time: string | null;
  note: string | null;
  source: CalendarEvent["source"];
  reminder_key: string | null;
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

type DataSource = {
  farm: Farm;
  table: SupabaseTableApi<CalendarEventRow>;
};

let fallbackEvents = [...placeholderCalendarEvents];

export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  const source = await getDataSource();

  if (!source) {
    return fallbackEvents;
  }

  const result = await runSupabaseQuery(
    () => source.table.select("*").eq("farm_id", source.farm.id),
    "Kalendereinträge konnten nicht geladen werden."
  );

  if (!result?.data) {
    return fallbackEvents;
  }

  fallbackEvents = result.data.map(mapRowToEvent);
  return fallbackEvents;
}

export async function createCalendarEvent(input: CreateCalendarEventInput): Promise<CalendarEvent> {
  const source = await getDataSource();
  const farmId = source?.farm.id ?? input.farmId;
  const now = new Date().toISOString();
  const fallback: CalendarEvent = { ...input, farmId, id: crypto.randomUUID(), createdAt: now, updatedAt: now };

  if (!source) {
    fallbackEvents = [fallback, ...fallbackEvents];
    return fallback;
  }

  const { data, error } = await source.table
    .insert(buildCalendarEventInsertPayload(fallback))
    .select("*")
    .single();

  if (error) {
    const e = error as { message?: string; code?: string; details?: string; hint?: string };
    console.error("[calendar_events] INSERT failed:", { message: e.message, code: e.code, details: e.details, hint: e.hint, title: input.title });
    throw new Error(`Kalendereintrag konnte nicht angelegt werden: ${e.message ?? "Unbekannter Fehler"}`);
  }

  if (!data) {
    throw new Error("Kalendereintrag angelegt, aber keine Bestätigung vom Server erhalten.");
  }

  const created = mapRowToEvent(data);
  fallbackEvents = [created, ...fallbackEvents.filter((e) => e.id !== created.id)];
  return created;
}

export async function updateCalendarEvent(id: string, input: UpdateCalendarEventInput): Promise<CalendarEvent | null> {
  const existing = fallbackEvents.find((e) => e.id === id);
  const now = new Date().toISOString();
  const fallback = existing ? { ...existing, ...input, updatedAt: now } : null;
  const source = await getDataSource();

  if (!source) {
    if (fallback) {
      fallbackEvents = fallbackEvents.map((e) => (e.id === id ? fallback : e));
    }
    return fallback;
  }

  const result = await runSupabaseQuery(
    () =>
      source.table
        .update({ ...mapEventToRow({ ...fallback! }), updated_at: now })
        .eq("id", id)
        .eq("farm_id", source.farm.id)
        .select("*")
        .single(),
    "Kalendereintrag konnte nicht aktualisiert werden."
  );

  if (!result?.data) {
    return fallback;
  }

  const updated = mapRowToEvent(result.data);
  fallbackEvents = fallbackEvents.map((e) => (e.id === id ? updated : e));
  return updated;
}

export async function deleteCalendarEvent(id: string): Promise<boolean> {
  const source = await getDataSource();

  if (!source) {
    const had = fallbackEvents.some((e) => e.id === id);
    fallbackEvents = fallbackEvents.filter((e) => e.id !== id);
    return had;
  }

  const result = await runSupabaseQuery(
    () => source.table.delete().eq("id", id).eq("farm_id", source.farm.id),
    "Kalendereintrag konnte nicht gelöscht werden."
  );

  if (!result) {
    const had = fallbackEvents.some((e) => e.id === id);
    fallbackEvents = fallbackEvents.filter((e) => e.id !== id);
    return had;
  }

  fallbackEvents = fallbackEvents.filter((e) => e.id !== id);
  scheduleReminderSync();
  return true;
}

async function getDataSource(): Promise<DataSource | null> {
  const [farm, table] = await Promise.all([getCurrentFarm(), getTable()]);

  if (!table || farm.id === placeholderFarmId) {
    return null;
  }

  return { farm, table };
}

async function getTable(): Promise<SupabaseTableApi<CalendarEventRow> | null> {
  const supabase = await getSupabaseClient();
  if (!supabase) return null;
  return supabase.from("calendar_events") as unknown as SupabaseTableApi<CalendarEventRow>;
}

function mapRowToEvent(row: CalendarEventRow): CalendarEvent {
  return {
    id: row.id,
    farmId: row.farm_id,
    machineId: row.machine_id,
    title: row.title,
    eventDate: row.event_date,
    eventTime: row.event_time,
    note: row.note,
    source: row.source,
    reminderKey: row.reminder_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapEventToRow(event: CalendarEvent): CalendarEventRow {
  return {
    id: event.id,
    farm_id: event.farmId,
    machine_id: event.machineId,
    title: event.title,
    event_date: event.eventDate,
    event_time: event.eventTime,
    note: event.note,
    source: event.source,
    reminder_key: event.reminderKey,
    created_at: event.createdAt,
    updated_at: event.updatedAt
  };
}
