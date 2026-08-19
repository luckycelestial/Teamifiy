import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  let next = searchParams.get("next");

  if (code) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data?.user) {
      const userEmail = (data.user.email ?? "").trim().toLowerCase();

      // Look up user role directly from database
      const { data: profile } = userEmail ? await supabase
        .from("profiles")
        .select("role")
        .or(`id.eq.${data.user.id},email.eq.${userEmail}`)
        .maybeSingle() : { data: null };

      const role = (profile?.role ?? "student").toLowerCase();

      if (!next) {
        if (role === "admin") {
          next = "/admin";
        } else if (role === "evaluator") {
          next = "/evaluator";
        } else {
          next = "/dashboard";
        }
      }

      const targetUrl = origin.includes("localhost")
        ? `${origin}${next}`
        : request.headers.get("x-forwarded-host")
        ? `https://${request.headers.get("x-forwarded-host")}${next}`
        : `${origin}${next}`;

      return NextResponse.redirect(targetUrl);
    }
  }

  return NextResponse.redirect(`${origin}/auth?error=auth_failed`);
}
