import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  TEAM_SIZE,
  teamIssues,
  useIsAdmin,
  useMemberships,
  useProfiles,
  useTeams,
  useUpdateTeam,
  type Profile,
} from "@/lib/portal";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin Console — SIH Team Portal | Sri Eshwar Innovation Studio" },
      {
        name: "description",
        content:
          "Review, validate and approve Smart India Hackathon teams submitted through the Sri Eshwar Centre for Innovation portal.",
      },
      { property: "og:title", content: "Admin Console — SIH Team Portal" },
      {
        property: "og:description",
        content: "Validate SIH team submissions and track student participation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Admin,
});

function Admin() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin(user?.id);
  const profiles = useProfiles();
  const memberships = useMemberships();
  const teams = useTeams();
  const updateTeam = useUpdateTeam();
  const [query, setQuery] = useState("");

  if (isAdmin.isLoading) {
    return <p className="p-8 text-sm text-muted-foreground">Checking access…</p>;
  }

  if (!isAdmin.data) {
    return (
      <div className="min-h-screen bg-surface-muted">
        <PortalHeader isAdmin={false} email={user?.email ?? ""} />
        <main className="mx-auto max-w-3xl px-5 py-16 text-center">
          <h1 className="text-2xl font-extrabold">Admin access required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This console is limited to Innovation Studio coordinators.
          </p>
        </main>
      </div>
    );
  }

  const allProfiles = profiles.data ?? [];
  const byId = new Map(allProfiles.map((p) => [p.id, p]));
  const allMemberships = memberships.data ?? [];
  const allTeams = teams.data ?? [];

  const rows = allTeams.map((team) => {
    const members = allMemberships
      .filter((m) => m.team_id === team.id)
      .map((m) => byId.get(m.user_id))
      .filter((p): p is Profile => Boolean(p));
    return { team, members, issues: teamIssues(members) };
  });

  const filtered = rows.filter(({ team, members }) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      team.name.toLowerCase().includes(q) ||
      (team.category ?? "").toLowerCase().includes(q) ||
      members.some(
        (m) =>
          m.full_name.toLowerCase().includes(q) || (m.roll_no ?? "").toLowerCase().includes(q),
      )
    );
  });

  const valid = rows.filter((r) => r.issues.length === 0).length;
  const unassigned = allProfiles.filter(
    (p) => !allMemberships.some((m) => m.user_id === p.id),
  ).length;

  const stats = [
    { label: "Teams", value: allTeams.length },
    { label: "Valid teams", value: valid },
    { label: "Needs fixing", value: allTeams.length - valid },
    { label: "Students registered", value: allProfiles.length },
    { label: "Without a team", value: unassigned },
  ];

  function setStatus(teamId: string, status: "approved" | "rejected" | "locked" | "forming") {
    updateTeam.mutate(
      { teamId, values: { status } },
      {
        onSuccess: () => toast.success(`Team ${status}.`),
        onError: (e) => toast.error(e.message),
      },
    );
  }

  return (
    <div className="min-h-screen bg-surface-muted">
      <PortalHeader isAdmin email={user?.email ?? ""} />
      <main className="mx-auto max-w-6xl px-5 py-8">
        <h1 className="text-2xl font-extrabold tracking-tight">Admin console</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every team is validated against the SIH rules automatically.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((s) => (
            <Card key={s.label} className="shadow-card-soft">
              <CardContent className="p-4">
                <p className="text-2xl font-extrabold">{s.value}</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {s.label}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-6">
          <Input
            value={query}
            placeholder="Search team, theme, student or roll number…"
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-md bg-background"
          />
        </div>

        <div className="mt-4 space-y-4">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground">No teams match this search.</p>
          )}
          {filtered.map(({ team, members, issues }) => (
            <Card key={team.id} className="shadow-card-soft">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{team.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {team.category || "No theme"} · Lead:{" "}
                      {byId.get(team.leader_id)?.full_name ?? "—"} · {members.length}/{TEAM_SIZE}
                    </p>
                  </div>
                  <StatusBadge status={team.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {members.map((m) => (
                    <div key={m.id} className="rounded-md border border-border p-2 text-sm">
                      <p className="font-semibold">{m.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[m.roll_no, m.department, m.gender].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  ))}
                </div>

                {issues.length > 0 ? (
                  <ul className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
                    {issues.map((i) => (
                      <li key={i}>• {i}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-md border border-success/40 bg-success/10 p-3 text-sm font-semibold">
                    Valid team.
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={issues.length > 0} onClick={() => setStatus(team.id, "approved")}>
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setStatus(team.id, "rejected")}>
                    Send back
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setStatus(team.id, "locked")}>
                    Lock
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setStatus(team.id, "forming")}>
                    Reopen
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
