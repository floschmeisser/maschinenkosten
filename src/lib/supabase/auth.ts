import { createSupabaseBrowserClient, warnSupabaseFallback } from "./client";

export async function getCurrentUser() {
  const supabase = await createSupabaseBrowserClient();

  if (!supabase) {
    return null;
  }

  try {
    const { data } = await supabase.auth.getUser();
    return data.user;
  } catch (error) {
    warnSupabaseFallback("Benutzer konnte nicht geladen werden.", error);
    return null;
  }
}

export async function signInWithEmail(email: string, password: string) {
  const supabase = await createSupabaseBrowserClient();

  if (!supabase) {
    return { error: "Supabase ist noch nicht konfiguriert." };
  }

  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  } catch (error) {
    warnSupabaseFallback("Anmeldung konnte nicht ausgefuehrt werden.", error);
    return { error: "Anmeldung ist gerade nicht verfuegbar." };
  }
}

export async function signOut() {
  const supabase = await createSupabaseBrowserClient();

  if (!supabase) {
    return;
  }

  try {
    await supabase.auth.signOut();
  } catch (error) {
    warnSupabaseFallback("Abmeldung konnte nicht ausgefuehrt werden.", error);
  }
}
