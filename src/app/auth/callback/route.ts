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
      const userEmail = (data.user.email ?? "").trim().toLowerCase().replace(/\s+/g, "");

      // Look up user role directly from database
      let role = "student";

      if (userEmail) {
        const { data: pByEmail } = await supabase
          .from("profiles")
          .select("role")
          .eq("email", userEmail)
          .limit(1);
        if (pByEmail && pByEmail.length > 0 && pByEmail[0]?.role) {
          role = pByEmail[0].role.toLowerCase();
        }
      }

      if (role === "student" && data.user.id) {
        const { data: pById } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .limit(1);
        if (pById && pById.length > 0 && pById[0]?.role) {
          role = pById[0].role.toLowerCase();
        }
      }

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
