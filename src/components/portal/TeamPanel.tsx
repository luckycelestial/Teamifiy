import { useState } from "react";
import { toast } from "sonner";
import type { Invitation, Membership, Profile, Team } from "@/lib/portal";
import {
  TEAM_SIZE,
  teamIssues,
  useCancelInvite,
  useDisbandTeam,
  useLeaveTeam,
  useRemoveMember,
  useSendInvite,
  useUpdateTeam,
} from "@/lib/portal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/portal/StatusBadge";

type Props = {
  team: Team;
  members: Membership[];
  profiles: Profile[];
  teamInvites: Invitation[];
  allMemberships: Membership[];
  currentUserId: string;
};

export function TeamPanel({
  team,
  members,
  profiles,
  teamInvites,
  allMemberships,
  currentUserId,
}: Props) {
  const isLeader = team.leader_id === currentUserId;
  const open = team.status === "forming" || team.status === "rejected";
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const memberProfiles = members
    .map((m) => byId.get(m.user_id))
    .filter((p): p is Profile => Boolean(p));
  const issues = teamIssues(memberProfiles);

  const invite = useSendInvite();
  const cancelInvite = useCancelInvite();
  const removeMember = useRemoveMember();
  const leave = useLeaveTeam();
  const disband = useDisbandTeam();
  const updateTeam = useUpdateTeam();

  const [search, setSearch] = useState("");
  const takenIds = new Set(allMemberships.map((m) => m.user_id));
  const invitedIds = new Set(teamInvites.filter((i) => i.status === "pending").map((i) => i.invitee_id));
  const pendingInvites = teamInvites.filter((i) => i.status === "pending");

  const candidates = profiles
    .filter((p) => !takenIds.has(p.id) && !invitedIds.has(p.id))
    .filter((p) => {
      const q = search.trim().toLowerCase();
      if (!q) return false;
      return (
        p.full_name.toLowerCase().includes(q) ||
        (p.roll_no ?? "").toLowerCase().includes(q) ||
        (p.email ?? "").toLowerCase().includes(q) ||
        (p.department ?? "").toLowerCase().includes(q) ||
        p.skills.some((s) => s.toLowerCase().includes(q))
      );
    })
    .slice(0, 8);

  const slotsLeft = TEAM_SIZE - members.length;

  return (
    <div className="space-y-5">
      <Card className="shadow-card-soft">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl">{team.name}</CardTitle>
              <CardDescription>
                {team.category || "No theme set"}
                {team.problem_statement ? ` · ${team.problem_statement}` : ""}
              </CardDescription>
            </div>
            <StatusBadge status={team.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-navy transition-all"
                style={{ width: `${(members.length / TEAM_SIZE) * 100}%` }}
              />
            </div>
            <span className="text-sm font-semibold">
              {members.length}/{TEAM_SIZE}
            </span>
          </div>

          {team.admin_note && (
            <p className="rounded-md border border-border bg-muted p-3 text-sm">
              <strong>Reviewer note:</strong> {team.admin_note}
            </p>
          )}

          <ul className="divide-y divide-border rounded-lg border border-border">
            {members.map((m) => {
              const p = byId.get(m.user_id);
              return (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div>
                    <p className="font-semibold">
                      {p?.full_name || "Student"}
                      {m.is_leader && (
                        <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-[11px] font-bold uppercase text-accent-foreground">
                          Lead
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[p?.roll_no, p?.department, p?.year ? `Year ${p.year}` : null, p?.gender]
                        .filter(Boolean)
                        .join(" · ") || "Profile incomplete"}
                    </p>
                  </div>
                  {isLeader && open && !m.is_leader && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        removeMember.mutate(m.id, {
                          onSuccess: () => toast.success("Member removed."),
                          onError: (e) => toast.error(e.message),
                        })
                      }
                    >
                      Remove
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>

          {issues.length > 0 ? (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-4">
              <p className="text-sm font-bold">This team is not valid yet</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {issues.map((i) => (
                  <li key={i}>• {i}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="rounded-lg border border-success/40 bg-success/10 p-4 text-sm font-semibold text-foreground">
              All SIH rules satisfied — ready to submit.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {isLeader && open && (
              <Button
                disabled={issues.length > 0 || updateTeam.isPending}
                onClick={() =>
                  updateTeam.mutate(
                    { teamId: team.id, values: { status: "submitted" } },
                    {
                      onSuccess: () => toast.success("Team submitted for review."),
                      onError: (e) => toast.error(e.message),
                    },
                  )
                }
              >
                Submit team for review
              </Button>
            )}
            {isLeader && open && (
              <Button
                variant="outline"
                onClick={() => {
                  if (!confirm("Disband this team? All members will be released.")) return;
                  disband.mutate(team.id, {
                    onSuccess: () => toast.success("Team disbanded."),
                    onError: (e) => toast.error(e.message),
                  });
                }}
              >
                Disband team
              </Button>
            )}
            {!isLeader && open && (
              <Button
                variant="outline"
                onClick={() => {
                  if (!confirm("Leave this team?")) return;
                  leave.mutate(currentUserId, {
                    onSuccess: () => toast.success("You left the team."),
                    onError: (e) => toast.error(e.message),
                  });
                }}
              >
                Leave team
              </Button>
            )}
            {!open && (
              <p className="text-sm text-muted-foreground">
                This team is {team.status} — contact the Innovation Studio for any change.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {isLeader && open && (
        <Card className="shadow-card-soft">
          <CardHeader>
            <CardTitle className="text-base">Invite students</CardTitle>
            <CardDescription>
              {slotsLeft > 0
                ? `${slotsLeft} slot${slotsLeft > 1 ? "s" : ""} left. Search by name, roll number, department or skill.`
                : "Your team is full."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={search}
              placeholder="Search students…"
              disabled={slotsLeft <= 0}
              onChange={(e) => setSearch(e.target.value)}
            />
            <ul className="space-y-2">
              {search.trim() && candidates.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  No available students match that search. Students already in a team are hidden.
                </li>
              )}
              {candidates.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
                >
                  <div>
                    <p className="font-semibold">{p.full_name || p.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {[p.roll_no, p.department, p.gender].filter(Boolean).join(" · ")}
                      {p.skills.length > 0 ? ` · ${p.skills.join(", ")}` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    disabled={invite.isPending}
                    onClick={() =>
                      invite.mutate(
                        { teamId: team.id, inviteeId: p.id, inviterId: currentUserId },
                        {
                          onSuccess: () => toast.success(`Invite sent to ${p.full_name}.`),
                          onError: (e) => toast.error(e.message),
                        },
                      )
                    }
                  >
                    Invite
                  </Button>
                </li>
              ))}
            </ul>

            {pendingInvites.length > 0 && (
              <div>
                <p className="text-sm font-semibold">Pending invites sent</p>
                <ul className="mt-2 space-y-2">
                  {pendingInvites.map((i) => {
                    const p = byId.get(i.invitee_id);
                    return (
                      <li
                        key={i.id}
                        className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-sm"
                      >
                        <span>{p?.full_name || "Student"}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            cancelInvite.mutate(i.id, {
                              onSuccess: () => toast.success("Invite cancelled."),
                              onError: (e) => toast.error(e.message),
                            })
                          }
                        >
                          Cancel
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
