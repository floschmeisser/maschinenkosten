type SupabaseQueryResult<T = unknown> = {
  data: T[] | null;
  error: Error | null;
};

export type SupabaseClientLike = {
  from: (table: string) => {
    select: (columns?: string) => Promise<SupabaseQueryResult>;
  };
  auth: {
    getUser: () => Promise<{ data: { user: unknown | null } }>;
    signInWithPassword: (credentials: { email: string; password: string }) => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
  };
};

let browserClient: SupabaseClientLike | null = null;

async function loadSupabaseCreateClient() {
  try {
    const packageName = "@supabase/supabase-js";
    const supabase = (await import(/* webpackIgnore: true */ packageName)) as {
      createClient: (url: string, key: string) => SupabaseClientLike;
    };
    return supabase.createClient;
  } catch {
    return null;
  }
}

export async function createSupabaseBrowserClient(): Promise<SupabaseClientLike | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  if (!browserClient) {
    const createClient = await loadSupabaseCreateClient();

    if (!createClient) {
      return null;
    }

    browserClient = createClient(supabaseUrl, supabaseAnonKey);
  }

  return browserClient;
}
