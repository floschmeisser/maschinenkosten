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

export type DbHealthResult = {
  ok: boolean;
  missing: string[];
  errors: string[];
};

export async function checkDatabaseHealth(): Promise<DbHealthResult> {
  const supabase = await getSupabaseClient();

  if (!supabase) {
    return { ok: false, missing: [], errors: ["Supabase nicht konfiguriert."] };
  }

  const missing: string[] = [];
  const errors: string[] = [];

  for (const table of REQUIRED_TABLES) {
    try {
      const { error } = await supabase.from(table).select("id");
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

  return { ok: missing.length === 0 && errors.length === 0, missing, errors };
}
