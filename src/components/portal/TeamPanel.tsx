"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  sendInviteByEmail,
  revokeInvite,
  leaveTeam,
  removeMember,
  disbandTeam,
  updateTeamStatus,
} from "@/app/actions/portal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { toRomanYear } from "@/lib/utils";
import { StudentContactModal, StudentModalData } from "@/components/portal/StudentContactModal";

export const TEAM_SIZE = 6;

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  department: string | null;
  year: number | null;
  gender: string | null;
  phone: string | null;
};

export type Team = {
  id: string;
  name: string;
  problem_statement: string | null;
  category: string | null;
  leader_id: string;
  status: "forming" | "submitted" | "approved" | "rejected" | "locked";
  admin_note: string | null;
  created_at: string;
};

export type Membership = {
  id: string;
  team_id: string;
  user_id: string;
  is_leader: boolean;
  joined_at: string;
};

export type Invitation = {
  id: string;
  team_id: string;
  invitee_id: string;
  inviter_id: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  message: string | null;
  created_at: string;
};

function teamIssues(members: Profile[]): string[] {
  const issues: string[] = [];
  if (members.length !== TEAM_SIZE) {
    issues.push(`${members.length}/${TEAM_SIZE} members — a SIH team needs exactly ${TEAM_SIZE}.`);
  }
  if (!members.some((m) => (m.gender ?? "").toLowerCase() === "female")) {
    issues.push("At least one female member is required.");
  }
  if (members.some((m) => !m.department)) {
    issues.push("Every member must have a valid department.");
  }
  return issues;
}

type Props = {
  team: Team;
  members: Membership[];
  profiles: Profile[];
  teamInvites: Invitation[];
  allMemberships: Membership[];
  currentUserId: string;
  registrationsOpen?: boolean;
};

export function TeamPanel({
  team,
  members,
  profiles,
  teamInvites,
  allMemberships,
  currentUserId,
  registrationsOpen = true,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isLeader = team.leader_id === currentUserId;
  const open = (team.status === "forming" || team.status === "rejected") && registrationsOpen;
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const memberProfiles = members
    .map((m) => byId.get(m.user_id))
    .filter((p): p is Profile => Boolean(p));
  const issues = teamIssues(memberProfiles);

  const [inviteEmail, setInviteEmail] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentModalData | null>(null);
  const pendingInvites = teamInvites.filter((i) => i.status === "pending");
  const slotsLeft = TEAM_SIZE - members.length;
  
  const handleSendEmailInvite = () => {
    if (!inviteEmail.trim()) {
      toast.error("Please enter a valid student email address.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await sendInviteByEmail({
          teamId: team.id,
          inviterId: currentUserId,
          inviteeEmail: inviteEmail,
        });
        if (res && !res.success) {
          toast.error(res.error || "Failed to send invite.");
          return;
        }
        toast.success(`Invitation sent to ${inviteEmail.trim()}!`);
        setInviteEmail("");
        window.location.reload();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to send invite.");
      }
    });
  };

  const handleRevokeInvite = (inviteId: string) => {
    startTransition(async () => {
      try {
        await revokeInvite(inviteId);
        toast.success("Invitation revoked.");
        window.location.reload();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to revoke invite.");
      }
    });
  };

  return (
    <div className="space-y-5">
      <Card className="shadow-card-soft">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl">{team.name}</CardTitle>
              <CardDescription>Team Roster ({members.length}/{TEAM_SIZE} members)</CardDescription>
            </div>
            <StatusBadge status={team.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {team.problem_statement && (
            <div className="rounded-md bg-surface-muted p-3 text-sm">
              <p className="font-semibold">Problem Statement</p>
              <p className="text-muted-foreground">{team.problem_statement}</p>
            </div>
          )}
          {team.category && (
            <p className="text-xs text-muted-foreground">Category: {team.category}</p>
          )}

          <div className="space-y-2">
            <p className="text-sm font-semibold">Members</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {members.map((m) => {
                const p = memberProfiles.find((mp) => mp.id === m.user_id);
                return (
                  <div
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
                  >
                    <div
                      onClick={() => p && setSelectedStudent({
                        fullName: p.full_name,
                        email: p.email,
                        department: p.department,
                        year: p.year,
                        gender: p.gender,
                        phone: p.phone,
                        isLeader: m.is_leader,
                      })}
                      title="Click to view contact details"
                      className="cursor-pointer group flex-1"
                    >
                      <p className="font-semibold group-hover:text-navy group-hover:underline transition-colors flex items-center gap-1">
                        {p?.full_name || "Student"}
                        {m.is_leader && (
                          <span className="ml-1 rounded-full bg-gold/20 px-2 py-0.5 text-xs font-bold text-navy">
                            Lead
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[p?.department, toRomanYear(p?.year), p?.gender]
                          .filter(Boolean)
                          .join(" · ") || "Profile incomplete"}
                      </p>
                    </div>
                    {isLeader && open && !m.is_leader && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isPending}
                        onClick={() => {
                          startTransition(async () => {
                            try {
                              await removeMember(m.id);
                              toast.success("Member removed.");
                              router.refresh();
                            } catch (err: unknown) {
                              toast.error(err instanceof Error ? err.message : "Failed to remove member.");
                            }
                          });
                        }}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {issues.length > 0 ? (
            <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
              <p className="font-semibold text-amber-900">Validation Status</p>
              <ul className="mt-1 space-y-1 text-xs text-amber-800">
                {issues.map((i) => (
                  <li key={i}>• {i}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              ✓ All SIH team rules met! Ready for submission.
            </div>
          )}

          {open && (
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {isLeader && team.status === "forming" && (
                <Button
                  disabled={isPending || issues.length > 0}
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await updateTeamStatus(team.id, "submitted");
                        toast.success("Team submitted for CFI review!");
                        router.refresh();
                      } catch (err: unknown) {
                        toast.error(err instanceof Error ? err.message : "Failed to submit.");
                      }
                    });
                  }}
                >
                  Submit Team
                </Button>
              )}
              {isLeader ? (
                <Button
                  variant="destructive"
                  disabled={isPending}
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await disbandTeam(team.id);
                        toast.success("Team disbanded.");
                        router.refresh();
                      } catch (err: unknown) {
                        toast.error(err instanceof Error ? err.message : "Failed to disband.");
                      }
                    });
                  }}
                >
                  Disband Team
                </Button>
              ) : (
                <Button
                  variant="outline"
                  disabled={isPending}
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await leaveTeam(currentUserId);
                        toast.success("You left the team.");
                        router.refresh();
                      } catch (err: unknown) {
                        toast.error(err instanceof Error ? err.message : "Failed to leave.");
                      }
                    });
                  }}
                >
                  Leave Team
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {isLeader && open && (
        <Card className="shadow-card-soft">
          <CardHeader>
            <CardTitle className="text-lg">Invite Teammate by Email</CardTitle>
            <CardDescription>
              Enter the official college email (@sece.ac.in) of a registered student to send them an invitation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                type="email"
                value={inviteEmail}
                placeholder="student.name2025aids@sece.ac.in"
                disabled={slotsLeft <= 0 || isPending}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSendEmailInvite();
                  }
                }}
              />
              <Button
                disabled={slotsLeft <= 0 || isPending || !inviteEmail.trim()}
                onClick={handleSendEmailInvite}
              >
                {isPending ? "Sending..." : "Send Invite"}
              </Button>
            </div>

            {pendingInvites.length > 0 && (
              <div className="pt-2">
                <p className="text-sm font-semibold text-foreground mb-2">Sent Pending Invites</p>
                <ul className="space-y-2">
                  {pendingInvites.map((i) => {
                    const p = byId.get(i.invitee_id);
                    return (
                      <li
                        key={i.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-muted/50 px-3.5 py-2.5 text-sm"
                      >
                        <div>
                          <p className="font-semibold text-xs">{p?.full_name || "Student"}</p>
                          <p className="text-xs text-muted-foreground">{p?.email || i.invitee_id}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isPending}
                          onClick={() => handleRevokeInvite(i.id)}
                          className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          Revoke
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

      <StudentContactModal
        student={selectedStudent}
        onClose={() => setSelectedStudent(null)}
      />
    </div>
  );
}
