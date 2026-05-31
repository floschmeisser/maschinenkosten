import { getSupabaseClient } from "@/lib/supabase/client";

const REQUIRED_TABLES = [
  "farms",
  "machines",
  "maintenance_tasks",
  "calendar_events",
  "reminders",
  "machine_cost_overrides",
  "machine_spare_parts",
] as const;

const REQUIRED_COLUMNS: Array<{ table: string; column: string; migration: string }> = [
  { table: "machines", column: "unit", migration: "ALTER TABLE machines ADD COLUMN IF NOT EXISTS unit text DEFAULT 'hours';" },
  { table: "machines", column: "annual_kilometers", migration: "ALTER TABLE machines ADD COLUMN IF NOT EXISTS annual_kilometers numeric;" },
  { table: "maintenance_tasks", column: "interval_months", migration: "ALTER TABLE maintenance_tasks ADD COLUMN IF NOT EXISTS interval_months integer;" },
  { table: "maintenance_tasks", column: "custom_title", migration: "ALTER TABLE maintenance_tasks ADD COLUMN IF NOT EXISTS custom_title text;" },
  { table: "maintenance_tasks", column: "last_done_reading", migration: "ALTER TABLE maintenance_tasks ADD COLUMN IF NOT EXISTS last_done_reading numeric;" },
];

export type DbHealthResult = {
  ok: boolean;
  missing: string[];
  errors: string[];
  missingColumns: Array<{ table: string; column: string; migration: string }>;
};

export async function checkDatabaseHealth(): Promise<DbHealthResult> {
  const supabase = await getSupabaseClient();

  if (!supabase) {
    return { ok: false, missing: [], errors: ["Supabase nicht konfiguriert."], missingColumns: [] };
  }

  const missing: string[] = [];
  const errors: string[] = [];

  for (const table of REQUIRED_TABLES) {
    try {
      const { error } = await supabase.from(table).select("id").limit(0);
      const e = error as { code?: string; message?: string } | null;

      if (e?.code === "42P01") {
        missing.push(table);
      } else if (e) {
        errors.push(`${table}: ${e.message ?? "Unbekannter Fehler"}`);
      }
    } catch (caught) {
      errors.push(`${table}: ${String(caught)}`);
    }
  }

  const missingColumns: Array<{ table: string; column: string; migration: string }> = [];

  for (const { table, column, migration } of REQUIRED_COLUMNS) {
    if (missing.includes(table)) continue;

    try {
      const { error } = await supabase.from(table).select(column).limit(0);
      const e = error as { code?: string; message?: string } | null;

      if (e?.code === "42703") {
        missingColumns.push({ table, column, migration });
      } else if (e) {
        errors.push(`${table}.${column}: ${e.message ?? "Fehler"}`);
      }
    } catch (caught) {
      errors.push(`${table}.${column}: ${String(caught)}`);
    }
  }

  return {
    ok: missing.length === 0 && errors.length === 0 && missingColumns.length === 0,
    missing,
    errors,
    missingColumns,
  };
}
