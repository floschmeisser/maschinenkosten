type SupabaseQueryResult<T = unknown> = {
  data: T[] | null;
  error: Error | null;
};

export type SupabaseUser = {
  id: string;
  email?: string;
};

export type SupabaseClientLike = {
  from: (table: string) => {
    select: (columns?: string) => Promise<SupabaseQueryResult>;
  };
  auth: {
    getUser: () => Promise<{ data: { user: SupabaseUser | null } }>;
    signInWithOtp: (options: { email: string; options?: { emailRedirectTo?: string } }) => Promise<{ error: Error | null }>;
    signInWithPassword: (credentials: { email: string; password: string }) => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
  };
};

let browserClient: SupabaseClientLike | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function warnSupabaseFallback(message: string, error?: unknown): void {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  if (error) {
    console.warn(`[MaschinenKosten] Supabase fallback: ${message}`, error);
    return;
  }

  console.warn(`[MaschinenKosten] Supabase fallback: ${message}`);
}

export async function runSupabaseQuery<T>(
  query: () => Promise<{ data?: T | null; error: Error | null }>,
  fallbackMessage: string
): Promise<{ data?: T | null; error: Error | null } | null> {
  try {
    const result = await query();

    if (result.error) {
      warnSupabaseFallback(fallbackMessage, result.error);
      return null;
    }

    return result;
  } catch (error) {
    warnSupabaseFallback(fallbackMessage, error);
    return null;
  }
}

async function loadSupabaseCreateClient() {
  try {
    const packageName = "@supabase/supabase-js";
    const supabase = (await import(/* webpackIgnore: true */ packageName)) as {
      createClient: (url: string, key: string) => SupabaseClientLike;
    };
    return supabase.createClient;
  } catch (error) {
    warnSupabaseFallback("Paket @supabase/supabase-js nicht verfuegbar.", error);
    return null;
  }
}

export async function createSupabaseBrowserClient(): Promise<SupabaseClientLike | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!isSupabaseConfigured() || !supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  if (!browserClient) {
    const createClient = await loadSupabaseCreateClient();

    if (!createClient) {
      return null;
    }

    try {
      browserClient = createClient(supabaseUrl, supabaseAnonKey);
    } catch (error) {
      warnSupabaseFallback("Client konnte nicht erstellt werden.", error);
      return null;
    }
  }

  return browserClient;
}
