import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            });
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Unauthenticated user protection
  if (!user && (pathname.startsWith("/dashboard") || pathname.startsWith("/admin") || pathname.startsWith("/evaluator"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    return NextResponse.redirect(url);
  }

  // Database-driven role routing (Admin / Evaluator / Student)
  if (user) {
    const userEmail = (user.email ?? "").trim().toLowerCase().replace(/\s+/g, "");

    // Look up profile by email first, then by id
    let profileData: { role: string; id: string } | null = null;

    if (userEmail) {
      const { data: pByEmail } = await supabase
        .from("profiles")
        .select("role, id")
        .eq("email", userEmail)
        .limit(1);
      if (pByEmail && pByEmail.length > 0) profileData = pByEmail[0]!;
    }

    if (!profileData && user.id) {
      const { data: pById } = await supabase
        .from("profiles")
        .select("role, id")
        .eq("id", user.id)
        .limit(1);
      if (pById && pById.length > 0) profileData = pById[0]!;
    }

    const role = (profileData?.role ?? "student").toLowerCase();

    // Admin attempting to access student dashboard or evaluator page -> redirect to admin console
    if ((pathname.startsWith("/dashboard") || pathname.startsWith("/evaluator")) && role === "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }

    // Evaluator attempting to access admin page or student dashboard -> redirect to evaluator portal
    if ((pathname.startsWith("/admin") || pathname.startsWith("/dashboard")) && role === "evaluator") {
      const url = request.nextUrl.clone();
      url.pathname = "/evaluator";
      return NextResponse.redirect(url);
    }

    // Student attempting to access admin or evaluator page -> redirect to student dashboard
    if ((pathname.startsWith("/admin") || pathname.startsWith("/evaluator")) && role === "student") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    // Team Leader access control: Only Team Leaders can access student dashboard
    if (pathname.startsWith("/dashboard") && role === "student") {
      const targetIds = Array.from(new Set([user.id, profileData?.id].filter(Boolean))) as string[];

      // Check if any target ID is a team leader in team_members
      const { data: leaderMems } = await supabase
        .from("team_members")
        .select("id")
        .in("user_id", targetIds)
        .eq("is_leader", true)
        .limit(1);

      if (!leaderMems || leaderMems.length === 0) {
        const url = request.nextUrl.clone();
        url.pathname = "/auth";
        url.searchParams.set("error", "leader_only");
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/admin",
    "/admin/:path*",
    "/evaluator",
    "/evaluator/:path*",
  ],
};
