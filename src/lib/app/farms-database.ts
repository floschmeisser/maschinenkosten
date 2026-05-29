import { getCurrentUser } from "@/lib/supabase/auth";
import { getSupabaseClient, runSupabaseQuery } from "@/lib/supabase/client";
import { placeholderFarmId } from "./machines";

export type Farm = {
  id: string;
  ownerId: string | null;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type FarmRow = {
  id: string;
  owner_id: string | null;
  name: string;
  created_at: string;
  updated_at: string;
};

type SupabaseFarmTableApi = {
  select: (columns?: string) => {
    eq: (column: string, value: string) => {
      limit: (count: number) => Promise<{ data: FarmRow[] | null; error: Error | null }>;
    };
  };
  insert: (input: Partial<FarmRow>) => {
    select: (columns?: string) => {
      single: () => Promise<{ data: FarmRow | null; error: Error | null }>;
    };
  };
};

export const placeholderFarm: Farm = {
  id: placeholderFarmId,
  ownerId: null,
  name: "Demo-Betrieb",
  createdAt: "2026-05-01T08:00:00.000Z",
  updatedAt: "2026-05-01T08:00:00.000Z"
};

let fallbackFarm = placeholderFarm;

export async function getCurrentFarm(): Promise<Farm> {
  const user = await getCurrentUser();

  if (!user) {
    return fallbackFarm;
  }

  return getOrCreateDefaultFarmForUser(user.id, user.email);
}

export async function getOrCreateDefaultFarmForUser(userId: string, email?: string): Promise<Farm> {
  const table = await getFarmsTable();

  if (!table) {
    return fallbackFarm;
  }

  const existingFarm = await runSupabaseQuery(
    () => table.select("*").eq("owner_id", userId).limit(1),
    "Betrieb konnte nicht geladen werden."
  );

  if (existingFarm?.data?.[0]) {
    fallbackFarm = mapFarmRowToFarm(existingFarm.data[0]);
    return fallbackFarm;
  }

  const now = new Date().toISOString();
  const result = await runSupabaseQuery(
    () =>
      table
        .insert({
          owner_id: userId,
          name: getDefaultFarmName(email),
          created_at: now,
          updated_at: now
        })
        .select("*")
        .single(),
    "Betrieb konnte nicht angelegt werden."
  );

  if (!result?.data) {
    return fallbackFarm;
  }

  fallbackFarm = mapFarmRowToFarm(result.data);
  return fallbackFarm;
}

async function getFarmsTable(): Promise<SupabaseFarmTableApi | null> {
  const supabase = await getSupabaseClient();

  if (!supabase) {
    return null;
  }

  return supabase.from("farms") as unknown as SupabaseFarmTableApi;
}

function getDefaultFarmName(email?: string): string {
  if (!email) {
    return "Mein Betrieb";
  }

  return email.split("@")[0] || "Mein Betrieb";
}

function mapFarmRowToFarm(row: FarmRow): Farm {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
