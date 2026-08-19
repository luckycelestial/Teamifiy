"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import { getDashboardData } from "@/app/actions/portal";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { ProfileForm } from "@/components/portal/ProfileForm";
import { InvitesPanel } from "@/components/portal/InvitesPanel";
import { CreateTeamCard } from "@/components/portal/CreateTeamCard";
import { TeamPanel } from "@/components/portal/TeamPanel";

function DashboardContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [data, setData] = useState<Awaited<ReturnType<typeof getDashboardData>> | null>(null);

  async function loadData(userId: string, email?: string) {
    try {
      const res = await getDashboardData(userId, email);
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: authData }) => {
      const session = authData.session;
      if (!session) {
        router.push("/auth");
        return;
      }
      if (session.user.email && !session.user.email.endsWith("@sece.ac.in")) {
        supabase.auth.signOut().then(() => {
          router.push("/auth?error=invalid_domain");
        });
        return;
      }
      const u = { id: session.user.id, email: session.user.email ?? "" };
      setUser(u);
      loadData(u.id, u.email);
    });
  }, [router]);

  useEffect(() => {
    if (data?.isAdmin) {
      router.push("/admin");
    }
  }, [data?.isAdmin, router]);

  if (loading || !user || data?.isAdmin) {
    if (data?.isAdmin) {
      return (
        <div className="min-h-screen bg-surface-muted flex flex-col items-center justify-center p-8">
          <p className="text-sm font-semibold text-navy">Redirecting to Admin Console…</p>
        </div>
      );
    }
    return <p className="p-8 text-sm text-muted-foreground">Loading your portal…</p>;
  }

  const profile = data?.profile;
  const isAdmin = data?.isAdmin ?? false;
  const profiles = data?.profiles ?? [];
  const memberships = (data?.memberships ?? []).map((m) => ({
    id: m.id,
    team_id: m.teamId,
    user_id: m.userId,
    is_leader: m.isLeader,
    joined_at: m.joinedAt.toISOString(),
  }));
  const teams = (data?.teams ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    problem_statement: t.problemStatement,
    category: t.category,
    leader_id: t.leaderId,
    status: t.status as "forming" | "submitted" | "approved" | "rejected" | "locked",
    admin_note: t.adminNote,
    created_at: t.createdAt.toISOString(),
  }));
  const invitations = (data?.invitations ?? []).map((i) => ({
    id: i.id,
    team_id: i.teamId,
    invitee_id: i.inviteeId,
    inviter_id: i.inviterId,
    status: i.status as "pending" | "accepted" | "declined" | "cancelled",
    message: i.message,
    created_at: i.createdAt.toISOString(),
  }));

  const formattedProfile = profile
    ? {
        id: profile.id,
        full_name: profile.fullName,
        email: profile.email,
        department: profile.department,
        year: profile.year,
        gender: profile.gender,
        phone: profile.phone,
      }
    : {
        id: user.id,
        full_name: "",
        email: user.email,
        department: null,
        year: null,
        gender: null,
        phone: null,
      };

  const formattedProfiles = profiles.map((p) => ({
    id: p.id,
    full_name: p.fullName,
    email: p.email,
    department: p.department,
    year: p.year,
    gender: p.gender,
    phone: p.phone,
  }));

  const registrationsOpen = data?.registrationsOpen ?? true;
  const myMembership = memberships.find((m) => m.user_id === user.id);
  const myTeam = myMembership ? teams.find((t) => t.id === myMembership.team_id) : undefined;
  const myTeamMembers = myTeam ? memberships.filter((m) => m.team_id === myTeam.id) : [];
  const myInvites = invitations.filter((i) => i.invitee_id === user.id && i.status === "pending");
  const teamInvites = myTeam ? invitations.filter((i) => i.team_id === myTeam.id) : [];
  const leadsAnotherTeam = teams.some((t) => t.leader_id === user.id);

  return (
    <div className="min-h-screen bg-surface-muted">
      <PortalHeader isAdmin={isAdmin} email={user.email} profile={formattedProfile} />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
          Welcome{formattedProfile.full_name ? `, ${formattedProfile.full_name.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
          Build a valid SIH team: 6 members, at least one female member, one team per student.
        </p>

        {!registrationsOpen && (
          <div className="mt-5 rounded-xl border border-rose-300/80 bg-rose-50/90 p-4 sm:p-6 text-center shadow-card-soft">
            <h2 className="text-base sm:text-xl font-extrabold text-rose-950 tracking-tight">
              Registrations for SIH 2026 Internal Hackathon is Closed.
            </h2>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 md:grid-cols-5 gap-6 items-start">
          {/* Left col — 3/5 on desktop, 1/1 on mobile */}
          <div className="col-span-1 md:col-span-3 space-y-6">
            {myTeam && myMembership ? (
              <TeamPanel
                team={myTeam}
                members={myTeamMembers}
                profiles={formattedProfiles}
                teamInvites={teamInvites}
                allMemberships={memberships}
                currentUserId={user.id}
                registrationsOpen={registrationsOpen}
              />
            ) : !registrationsOpen ? (
              <div className="rounded-xl border border-border bg-card p-6 sm:p-8 text-center shadow-card-soft">
                <p className="text-sm sm:text-base font-bold text-foreground">
                  Registrations for SIH 2026 Internal Hackathon is Closed.
                </p>
              </div>
            ) : (
              <CreateTeamCard disabled={leadsAnotherTeam} />
            )}
          </div>

          {/* Right col — 2/5 on desktop, 1/1 on mobile */}
          <div className="col-span-1 md:col-span-2">
            <InvitesPanel
              invites={registrationsOpen ? myInvites : []}
              teams={teams}
              profiles={formattedProfiles}
              inTeam={!!myMembership}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted-foreground">Checking access...</p>}>
      <DashboardContent />
    </Suspense>
  );
}
