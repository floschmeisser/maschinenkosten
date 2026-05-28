import { createSupabaseBrowserClient } from "./client";

export async function getCurrentUser() {
  const supabase = await createSupabaseBrowserClient();

  if (!supabase) {
    return null;
  }

  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function signInWithEmail(email: string, password: string) {
  const supabase = await createSupabaseBrowserClient();

  if (!supabase) {
    return { error: "Supabase ist noch nicht konfiguriert." };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error: error?.message ?? null };
}

export async function signOut() {
  const supabase = await createSupabaseBrowserClient();

  if (!supabase) {
    return;
  }

  await supabase.auth.signOut();
}
