import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
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
    const userEmail = (user.email ?? "").trim().toLowerCase();
    
    // Look up profile by user.id OR user.email directly
    const { data: profileData } = await supabase
      .from("profiles")
      .select("role, id")
      .or(`id.eq.${user.id},email.eq.${userEmail}`)
      .maybeSingle();

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
      // Check if user ID is a team leader
      const { data: isLeaderMem } = await supabase
        .from("team_members")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_leader", true)
        .maybeSingle();

      // Check if user email belongs to a team leader profile
      const targetProfileId = profileData?.id;
      const { data: leaderProfile } = !isLeaderMem && targetProfileId ? await supabase
        .from("team_members")
        .select("id")
        .eq("user_id", targetProfileId)
        .eq("is_leader", true)
        .maybeSingle() : { data: null };

      if (!isLeaderMem && !leaderProfile) {
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
