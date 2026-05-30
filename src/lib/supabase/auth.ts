import { getSupabaseClient, isSupabaseConfigured, warnSupabaseFallback, type SupabaseUser } from "./client";

export async function isSupabaseAuthAvailable(): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  return (await getSupabaseClient()) !== null;
}

export async function getCurrentUser() {
  const supabase = await getSupabaseClient();

  if (!supabase) {
    return null;
  }

  try {
    const timeout = new Promise<{ data: { user: null } }>((resolve) =>
      setTimeout(() => resolve({ data: { user: null } }), 3000)
    );
    const { data } = await Promise.race([
      supabase.auth.getUser() as Promise<{ data: { user: SupabaseUser | null } }>,
      timeout
    ]);
    return data.user;
  } catch (error) {
    warnSupabaseFallback("Benutzer konnte nicht geladen werden.", error);
    return null;
  }
}

export async function signInWithEmail(email: string, redirectPath = "/de/dashboard") {
  const supabase = await getSupabaseClient();

  if (!supabase) {
    return { error: "Supabase ist noch nicht konfiguriert." };
  }

  try {
    const emailRedirectTo = typeof window === "undefined" ? undefined : `${window.location.origin}${redirectPath}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo
      }
    });
    return { error: error?.message ?? null };
  } catch (error) {
    warnSupabaseFallback("Anmeldung konnte nicht ausgefuehrt werden.", error);
    return { error: "Anmeldung ist gerade nicht verfuegbar." };
  }
}

export async function signOut() {
  const supabase = await getSupabaseClient();

  if (!supabase) {
    return;
  }

  try {
    await supabase.auth.signOut();
  } catch (error) {
    warnSupabaseFallback("Abmeldung konnte nicht ausgefuehrt werden.", error);
  }
}
