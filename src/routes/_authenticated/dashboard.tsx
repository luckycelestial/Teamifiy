import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import {
  useIsAdmin,
  useMemberships,
  useMyInvites,
  useProfile,
  useProfiles,
  useTeams,
} from "@/lib/portal";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { ProfileForm } from "@/components/portal/ProfileForm";
import { InvitesPanel } from "@/components/portal/InvitesPanel";
import { CreateTeamCard } from "@/components/portal/CreateTeamCard";
import { TeamPanel } from "@/components/portal/TeamPanel";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Student Dashboard — SIH Team Portal | Sri Eshwar Innovation Studio" },
      {
        name: "description",
        content:
          "Form your Smart India Hackathon team, send invites and track validation from the Sri Eshwar Centre for Innovation portal.",
      },
      { property: "og:title", content: "Student Dashboard — SIH Team Portal" },
      {
        property: "og:description",
        content: "Create teams, invite members and submit your SIH team for review.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const userId = user?.id;
  const profile = useProfile(userId);
  const isAdmin = useIsAdmin(userId);
  const profiles = useProfiles();
  const memberships = useMemberships();
  const teams = useTeams();
  const invites = useMyInvites(userId);

  const loading =
    profile.isLoading || profiles.isLoading || memberships.isLoading || teams.isLoading;

  const allMemberships = memberships.data ?? [];
  const myMembership = allMemberships.find((m) => m.user_id === userId);
  const myTeam = myMembership ? (teams.data ?? []).find((t) => t.id === myMembership.team_id) : undefined;
  const myTeamMembers = myTeam ? allMemberships.filter((m) => m.team_id === myTeam.id) : [];
  const myInvites = (invites.data ?? []).filter(
    (i) => i.invitee_id === userId && i.status === "pending",
  );
  const teamInvites = myTeam ? (invites.data ?? []).filter((i) => i.team_id === myTeam.id) : [];
  const leadsAnotherTeam = (teams.data ?? []).some((t) => t.leader_id === userId);

  return (
    <div className="min-h-screen bg-surface-muted">
      <PortalHeader isAdmin={!!isAdmin.data} email={user?.email ?? ""} />
      <main className="mx-auto max-w-6xl px-5 py-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
          Welcome{profile.data?.full_name ? `, ${profile.data.full_name.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Build a valid SIH team: 6 members, at least one female member, one team per student.
        </p>

        {loading ? (
          <p className="mt-8 text-sm text-muted-foreground">Loading your portal…</p>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.25fr_1fr]">
            <div className="space-y-6">
              {myTeam && myMembership ? (
                <TeamPanel
                  team={myTeam}
                  members={myTeamMembers}
                  profiles={profiles.data ?? []}
                  teamInvites={teamInvites}
                  allMemberships={allMemberships}
                  currentUserId={userId!}
                />
              ) : (
                <CreateTeamCard disabled={leadsAnotherTeam} />
              )}
              <InvitesPanel
                invites={myInvites}
                teams={teams.data ?? []}
                profiles={profiles.data ?? []}
                inTeam={!!myMembership}
              />
            </div>
            <div className="space-y-6">
              {profile.data && <ProfileForm profile={profile.data} />}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
