"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { TeamPanel } from "@/components/portal/TeamPanel";
import { getDashboardData } from "@/app/actions/portal";

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [data, setData] = useState<Awaited<ReturnType<typeof getDashboardData>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadData(u: { id: string; email: string }) {
    try {
      const res = await getDashboardData(u.id, u.email);
      setData(res);
    } catch (err: unknown) {
      console.error("Dashboard error:", err);
      setError(err instanceof Error ? err.message : "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: authData }) => {
      if (!mounted) return;
      const session = authData.session;
      if (!session) {
        router.push("/auth");
        return;
      }
      const u = { id: session.user.id, email: session.user.email ?? "" };
      setUser(u);
      loadData(u);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (!session) {
        router.push("/auth");
        return;
      }
      const u = { id: session.user.id, email: session.user.email ?? "" };
      setUser(u);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-surface-muted flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-muted-foreground animate-pulse">
          <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span>Loading student portal…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface-muted flex flex-col items-center justify-center p-4">
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 max-w-md text-center">
          <p className="text-sm text-destructive font-medium">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const profile = data?.profile;
  const isAdmin = data?.isAdmin ?? false;
  const isEvaluator = data?.isEvaluator ?? false;
  const role = data?.role ?? "student";

  const profiles = data?.profiles ?? [];
  const memberships = (data?.memberships ?? []).map((m: any) => ({
    id: m.id,
    team_id: m.teamId || m.team_id,
    user_id: m.userId || m.user_id,
    is_leader: m.isLeader ?? m.is_leader ?? false,
    joined_at: typeof m.joinedAt === "string" ? m.joinedAt : m.joinedAt?.toISOString?.() || new Date().toISOString(),
  }));

  const teams = (data?.teams ?? []).map((t: any) => ({
    id: t.id,
    name: t.name,
    problem_statement: t.problemStatement || t.problem_statement,
    category: t.category,
    leader_id: t.leaderId || t.leader_id,
    status: (t.status || "submitted") as "forming" | "submitted" | "approved" | "rejected" | "locked",
    created_at: typeof t.createdAt === "string" ? t.createdAt : t.createdAt?.toISOString?.() || new Date().toISOString(),
  }));

  const formattedProfile = profile
    ? {
        id: profile.id,
        full_name: profile.fullName || "",
        email: profile.email || user.email,
        department: profile.department,
        year: profile.year,
        phone: profile.phone,
      }
    : {
        id: user.id,
        full_name: "",
        email: user.email,
        department: null,
        year: null,
        phone: null,
      };

  const formattedProfiles = profiles.map((p: any) => ({
    id: p.id,
    full_name: p.fullName || p.full_name || "",
    email: p.email,
    department: p.department,
    year: p.year,
    phone: p.phone,
  }));

  const registrationsOpen = data?.registrationsOpen ?? true;
  const activeUserId = profile?.id || user.id;
  const myMembership = memberships.find((m: any) => m.user_id === user.id || m.user_id === activeUserId);
  const myTeam = myMembership ? teams.find((t: any) => t.id === myMembership.team_id) : undefined;
  const myTeamMembers = myTeam ? memberships.filter((m: any) => m.team_id === myTeam.id) : [];

  return (
    <div className="min-h-screen bg-surface-muted">
      <PortalHeader isAdmin={isAdmin} isEvaluator={isEvaluator} role={role} email={user.email} profile={formattedProfile} />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
              Welcome{formattedProfile.full_name ? `, ${formattedProfile.full_name.split(" ")[0]}` : ""}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              SIH 2026 Internal Hackathon — Team Leader Dashboard
            </p>
          </div>
        </div>

        {myTeam ? (
          <TeamPanel
            team={myTeam}
            members={myTeamMembers}
            profiles={formattedProfiles}
            currentUserId={activeUserId}
            registrationsOpen={registrationsOpen}
          />
        ) : (
          <div className="p-8 text-center bg-background border border-border rounded-xl shadow-xs">
            <h3 className="font-bold text-lg text-foreground">No Team Assigned</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Your profile is registered as a student. Only designated Team Leaders manage team submissions.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
