import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Creates a Supabase client that reads cookies from the incoming request.
 * Used ONLY in server actions / route handlers — never on the client.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component — safe to ignore
          }
        },
      },
    }
  );
}

/**
 * Resolves the currently authenticated user from cookies.
 * Throws "Unauthorized" if no valid session exists.
 */
export async function requireAuth(): Promise<{ id: string; email: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return { id: user.id, email: user.email ?? "" };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.user) {
    return { id: session.user.id, email: session.user.email ?? "" };
  }

  throw new Error("Unauthorized: no active session.");
}
