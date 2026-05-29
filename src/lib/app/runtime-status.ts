import { getCurrentUser, isSupabaseAuthAvailable } from "@/lib/supabase/auth";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { getOrCreateDefaultFarmForUser, type Farm } from "./farms-database";
import { placeholderFarmId } from "./machines";
import type { SupabaseUser } from "@/lib/supabase/client";

export type RuntimeDataMode = "supabase" | "fallback";
export type RuntimeStorageMode = "active" | "login_required" | "farm_missing" | "unavailable";

export type RuntimeStatus = {
  authAvailable: boolean;
  currentFarm: Farm | null;
  currentUser: SupabaseUser | null;
  dataMode: RuntimeDataMode;
  storageMode: RuntimeStorageMode;
  supabaseClientAvailable: boolean;
  supabaseConfigured: boolean;
};

export async function getRuntimeStatus(): Promise<RuntimeStatus> {
  const supabaseConfigured = isSupabaseConfigured();
  const supabaseClient = await getSupabaseClient();
  const supabaseClientAvailable = supabaseClient !== null;
  const authAvailable = supabaseConfigured && supabaseClientAvailable && (await isSupabaseAuthAvailable());

  if (!supabaseConfigured || !supabaseClientAvailable || !authAvailable) {
    return {
      authAvailable,
      currentFarm: null,
      currentUser: null,
      dataMode: "fallback",
      storageMode: "unavailable",
      supabaseClientAvailable,
      supabaseConfigured
    };
  }

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      authAvailable,
      currentFarm: null,
      currentUser: null,
      dataMode: "fallback",
      storageMode: "login_required",
      supabaseClientAvailable,
      supabaseConfigured
    };
  }

  const currentFarm = await getOrCreateDefaultFarmForUser(currentUser.id, currentUser.email);

  if (currentFarm.id === placeholderFarmId) {
    return {
      authAvailable,
      currentFarm: null,
      currentUser,
      dataMode: "fallback",
      storageMode: "farm_missing",
      supabaseClientAvailable,
      supabaseConfigured
    };
  }

  return {
    authAvailable,
    currentFarm,
    currentUser,
    dataMode: "supabase",
    storageMode: "active",
    supabaseClientAvailable,
    supabaseConfigured
  };
}
