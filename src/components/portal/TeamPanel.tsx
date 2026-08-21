"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  leaveTeam,
  removeMember,
  disbandTeam,
  updateTeamStatus,
  submitProblemStatement,
} from "@/app/actions/portal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { toRomanYear } from "@/lib/utils";
import { StudentContactModal, StudentModalData } from "@/components/portal/StudentContactModal";
import { Lock, Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";

export const TEAM_SIZE = 6;

export const SIH_THEMES = [
  "Smart Automation",
  "Fitness & Sports",
  "Heritage & Culture",
  "MedTech / BioTech / HealthTech",
  "Agriculture, FoodTech & Rural Development",
  "Smart Vehicles",
  "Transportation & Logistics",
  "Robotics and Drones",
  "Clean & Green Technology",
  "Tourism",
  "Renewable / Sustainable Energy",
  "Blockchain & Cybersecurity",
  "Smart Education",
  "Disaster Management",
  "Toys and Games",
  "Space Technology",
  "Miscellaneous",
] as const;

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  department: string | null;
  year: number | null;
  phone: string | null;
};

export type Team = {
  id: string;
  name: string;
  ps_number?: string | null;
  theme?: string | null;
  problem_statement: string | null;
  category: string | null;
  leader_id: string;
  status: "forming" | "submitted" | "approved" | "rejected" | "locked";
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
  if (members.some((m) => !m.department)) {
    issues.push("Every member must have a valid department.");
  }
  return issues;
}

type Props = {
  team: Team;
  members: Membership[];
  profiles: Profile[];
  teamInvites?: Invitation[];
  allMemberships?: Membership[];
  currentUserId: string;
  registrationsOpen?: boolean;
};

export function TeamPanel({
  team,
  members,
  profiles,
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

  const [selectedStudent, setSelectedStudent] = useState<StudentModalData | null>(null);

  // Problem Statement Submission State
  const [psNumber, setPsNumber] = useState(team.ps_number || "");
  const [theme, setTheme] = useState(team.theme || "");
  const [category, setCategory] = useState(team.category || "Software");
  const [psError, setPsError] = useState("");
  const [isSubmittingPs, setIsSubmittingPs] = useState(false);

  const handleSubmitPs = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPs = psNumber.trim().toUpperCase();
    if (!cleanPs) {
      setPsError("PS NUMBER is required.");
      toast.error("PS NUMBER is required.");
      return;
    }
    // Client side check: must be in all caps
    if (cleanPs !== cleanPs.toUpperCase()) {
      setPsError("PS NUMBER must be in ALL CAPS.");
      toast.error("PS NUMBER must be in ALL CAPS.");
      return;
    }
    if (!theme.trim()) {
      toast.error("Please enter the Theme.");
      return;
    }
    if (!category.trim()) {
      toast.error("Please select a Category.");
      return;
    }

    setIsSubmittingPs(true);
    try {
      await submitProblemStatement(team.id, {
        psNumber: cleanPs,
        theme: theme.trim(),
        category: category.trim(),
      });
      toast.success("Problem statement submitted successfully! Details are now locked.");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to submit problem statement.");
    } finally {
      setIsSubmittingPs(false);
    }
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
                        {[p?.department, toRomanYear(p?.year)]
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

          {issues.length > 0 && (
            <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
              <p className="font-semibold text-amber-900">Validation Status</p>
              <ul className="mt-1 space-y-1 text-xs text-amber-800">
                {issues.map((i) => (
                  <li key={i}>• {i}</li>
                ))}
              </ul>
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

      {/* Problem Statement Submission Section */}
      <Card className="shadow-card-soft border-border">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg font-bold text-foreground">Problem Statement Submission</CardTitle>
              {team.ps_number && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                  <CheckCircle2 className="h-3 w-3" /> Submitted
                </span>
              )}
            </div>
            <p className="text-xs font-semibold text-rose-600 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              Once submitted, you cannot change the problem statement
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {team.ps_number ? (
            /* Locked View State */
            <div className="rounded-xl bg-muted/40 border border-border p-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">PS NUMBER</p>
                  <p className="mt-1 font-mono text-base font-bold text-foreground bg-background px-3 py-1.5 rounded-lg border border-border inline-block">
                    {team.ps_number}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">THEME</p>
                  <p className="mt-1 text-sm font-semibold text-foreground bg-background px-3 py-1.5 rounded-lg border border-border">
                    {team.theme || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">CATEGORY</p>
                  <p className="mt-1 text-sm font-semibold text-foreground bg-background px-3 py-1.5 rounded-lg border border-border">
                    {team.category || "—"}
                  </p>
                </div>
              </div>
              <div className="mt-3.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5 text-amber-600" />
                <span>Problem statement locked for Round 1 evaluation. Contact admin for any discrepancies.</span>
              </div>
            </div>
          ) : isLeader ? (
            /* Submission Form for Team Leader */
            <form onSubmit={handleSubmitPs} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* PS NUMBER input */}
                <div>
                  <label htmlFor="psNumber" className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    PS NUMBER <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    id="psNumber"
                    value={psNumber}
                    onChange={(e) => {
                      // Client-side auto-uppercase validation
                      const upper = e.target.value.toUpperCase().replace(/\s+/g, "");
                      setPsNumber(upper);
                      if (psError) setPsError("");
                    }}
                    placeholder="E.G. SIH1540"
                    className="font-mono uppercase font-bold tracking-wider text-sm bg-background border-border"
                    required
                  />
                  {psError && (
                    <p className="mt-1 text-xs text-rose-600 font-medium">{psError}</p>
                  )}
                  <p className="mt-1 text-[10px] text-muted-foreground font-medium">
                    Must be in ALL CAPS (e.g. SIH1540 / PS102)
                  </p>
                </div>

                {/* THEME dropdown */}
                <div>
                  <label htmlFor="theme" className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    THEME <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="theme"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm font-semibold text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-navy/40"
                    required
                  >
                    <option value="" disabled className="text-muted-foreground">
                      Select Theme...
                    </option>
                    {SIH_THEMES.map((t) => (
                      <option key={t} value={t} className="text-foreground bg-background py-1">
                        {t}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[10px] text-muted-foreground font-medium">
                    Primary focus area of your solution
                  </p>
                </div>

                {/* CATEGORY input / dropdown */}
                <div>
                  <label htmlFor="category" className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    CATEGORY <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm font-semibold text-foreground cursor-pointer"
                    required
                  >
                    <option value="Software">Software</option>
                    <option value="Hardware">Hardware</option>
                  </select>
                  <p className="mt-1 text-[10px] text-muted-foreground font-medium">
                    Project domain track
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  type="submit"
                  disabled={isSubmittingPs || !psNumber.trim() || !theme.trim()}
                  className="bg-navy hover:bg-navy/90 text-white font-bold text-xs px-5 shadow-xs"
                >
                  {isSubmittingPs ? "Submitting…" : "Submit Problem Statement"}
                </Button>
              </div>
            </form>
          ) : (
            /* Non-leader pending state */
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground bg-muted/20">
              <p className="text-sm font-medium">Problem Statement not yet submitted.</p>
              <p className="text-xs mt-1">Only the designated Team Leader ({byId.get(team.leader_id)?.full_name || "Team Lead"}) can submit this.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <StudentContactModal
        student={selectedStudent}
        onClose={() => setSelectedStudent(null)}
      />
    </div>
  );
}
