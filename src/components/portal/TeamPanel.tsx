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
  type EvaluationRecord,
} from "@/app/actions/portal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { toRomanYear } from "@/lib/utils";
import { StudentContactModal, StudentModalData } from "@/components/portal/StudentContactModal";
import { Lock, Sparkles, AlertCircle, CheckCircle2, Star, Clock, Award } from "lucide-react";

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

export const TECH_STACK_OPTIONS = [
  "AI & ML",
  "Data Science & Analytics",
  "Computer Vision, NLP & Generative AI",
  "SD (Web & Mobile)",
  "Cloud, DevOps & Cybersecurity",
  "Blockchain & Web3",
  "Immersive Tech & Game Development (AR / VR / XR)",
  "ES, IoT & Edge AI",
  "VLSI & Semiconductor Technology",
  "Robotics, Control & Automation",
  "Communication, Signal Processing & Networking",
  "Power Electronics & Electrical Drives",
  "Mechanical Design, Materials & Manufacturing",
  "Biomedical & Biotechnology",
  "Computational Modelling & Quantum Computing",
] as const;

export const BUSINESS_SECTOR_OPTIONS = [
  "Healthcare, MedTech & Life Sciences",
  "Assistive & Inclusive Technology",
  "Sports, Fitness & Wellness",
  "Agriculture, Food Technology & Rural Development",
  "Marine, Fisheries & Ocean Resources",
  "Energy, Renewables & CleanTech",
  "Environment, Climate, Water & Waste Management",
  "Manufacturing & Industry 4.0",
  "Automotive, Mobility & Transportation",
  "Logistics & Supply Chain",
  "Construction, Infrastructure & Smart Cities",
  "Mining, Metals, Materials & Textiles",
  "FinTech, Banking, Insurance & Retail",
  "Tourism, Media, Entertainment & Culture",
  "Education, EdTech & Skill Development",
  "Governance, Public Services & Social Impact",
  "Disaster Management & Emergency Response",
  "Defence, Security & Surveillance",
  "Space & Aerospace",
  "Campus & Institutional Innovation",
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
  tech_stack?: string | null;
  business_sector?: string | null;
  techStack?: string | null;
  businessSector?: string | null;
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
  evaluation?: EvaluationRecord | null;
};

export function TeamPanel({
  team,
  members,
  profiles,
  currentUserId,
  registrationsOpen = true,
  evaluation,
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
  const [psDigits, setPsDigits] = useState(
    team.ps_number ? team.ps_number.replace(/^SIH26/i, "").replace(/^SIH/i, "").slice(0, 3) : ""
  );
  const [theme, setTheme] = useState(team.theme || "");
  const [techStack, setTechStack] = useState(team.tech_stack || team.techStack || "");
  const [businessSector, setBusinessSector] = useState(team.business_sector || team.businessSector || "");
  const [category, setCategory] = useState(team.category || "Software");
  const [psError, setPsError] = useState("");
  const [isSubmittingPs, setIsSubmittingPs] = useState(false);

  const handleSubmitPs = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanDigits = psDigits.replace(/\D/g, "").trim();
    if (!cleanDigits) {
      setPsError("Please enter the 3-digit PS number.");
      toast.error("Please enter the 3-digit PS number.");
      return;
    }
    if (cleanDigits.length < 3) {
      setPsError("PS number must be exactly 3 digits (e.g. 042).");
      toast.error("PS number must be exactly 3 digits (e.g. 042).");
      return;
    }
    if (!theme.trim()) {
      toast.error("Please select a Theme.");
      return;
    }
    if (!techStack.trim()) {
      toast.error("Please select a Technology Stack.");
      return;
    }
    if (!businessSector.trim()) {
      toast.error("Please select a Business Sector.");
      return;
    }
    if (!category.trim()) {
      toast.error("Please select a Category.");
      return;
    }

    const fullPsNumber = `SIH26${cleanDigits}`;

    setIsSubmittingPs(true);
    try {
      await submitProblemStatement(team.id, {
        psNumber: fullPsNumber,
        theme: theme.trim(),
        category: category.trim(),
        techStack: techStack.trim(),
        businessSector: businessSector.trim(),
      });
      toast.success(`Problem statement ${fullPsNumber} submitted successfully! Details are now locked.`);
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
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Members</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {members.map((m) => {
                const p = memberProfiles.find((mp) => mp.id === m.user_id);
                return (
                  <div
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background p-3.5 hover:border-navy/40 transition-all shadow-2xs"
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
                      <p className="font-bold text-foreground group-hover:text-navy dark:group-hover:text-sky-400 group-hover:underline transition-colors flex items-center gap-2 text-sm">
                        <span>{p?.full_name?.toUpperCase() || "STUDENT"}</span>
                        {m.is_leader && (
                          <span className="rounded-md bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/60 px-2 py-0.5 text-[10px] font-black uppercase">
                            Lead
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                        {[p?.department, toRomanYear(p?.year)]
                          .filter(Boolean)
                          .join(" · ") || "Profile incomplete"}
                      </p>
                    </div>
                    {isLeader && open && !m.is_leader && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-7 text-xs font-semibold"
                        disabled={isPending}
                        onClick={() => {
                          if (confirm(`Remove ${p?.full_name} from team?`)) {
                            startTransition(async () => {
                              try {
                                await removeMember(m.id);
                                toast.success("Member removed.");
                                router.refresh();
                              } catch (err: unknown) {
                                toast.error(err instanceof Error ? err.message : "Failed to remove member.");
                              }
                            });
                          }
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
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900 space-y-1">
              <p className="font-semibold">Team Composition Guidance:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {issues.map((i, idx) => (
                  <li key={idx}>{i}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Leader and Member Team Action Controls */}
          {open && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
              {isLeader ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs"
                    disabled={isPending}
                    onClick={() => {
                      if (confirm("Disband team? All members will be unassigned.")) {
                        startTransition(async () => {
                          try {
                            await disbandTeam(team.id);
                            toast.success("Team disbanded");
                            router.refresh();
                          } catch (err: unknown) {
                            toast.error(err instanceof Error ? err.message : "Failed to disband");
                          }
                        });
                      }
                    }}
                  >
                    Disband Team
                  </Button>

                  {team.status === "forming" && members.length === TEAM_SIZE && (
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                      disabled={isPending}
                      onClick={() => {
                        startTransition(async () => {
                          try {
                            await updateTeamStatus(team.id, "submitted");
                            toast.success("Team formation submitted!");
                            router.refresh();
                          } catch (err: unknown) {
                            toast.error(err instanceof Error ? err.message : "Submission failed");
                          }
                        });
                      }}
                    >
                      Submit Team Formation
                    </Button>
                  )}
                </>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs"
                  disabled={isPending}
                  onClick={() => {
                    if (confirm("Leave this team?")) {
                      startTransition(async () => {
                        try {
                          await leaveTeam(team.id);
                          toast.success("You left the team");
                          router.refresh();
                        } catch (err: unknown) {
                          toast.error(err instanceof Error ? err.message : "Failed to leave");
                        }
                      });
                    }
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
            <div className="rounded-xl bg-muted/40 border border-border p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">TECHNOLOGY STACK</p>
                  <p className="mt-1 text-sm font-semibold text-foreground bg-background px-3 py-1.5 rounded-lg border border-border">
                    {team.tech_stack || team.techStack || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">BUSINESS SECTOR ADDRESSED</p>
                  <p className="mt-1 text-sm font-semibold text-foreground bg-background px-3 py-1.5 rounded-lg border border-border">
                    {team.business_sector || team.businessSector || "—"}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5 text-amber-600" />
                <span>Problem statement locked for Round 1 evaluation. Contact admin for any discrepancies.</span>
              </div>
            </div>
          ) : isLeader ? (
            /* Submission Form for Team Leader */
            <form onSubmit={handleSubmitPs} className="space-y-4">
              {/* Row 1: PS Number, Theme, Category */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* PS NUMBER (Fixed Prefix SIH26 + 3 Digits) */}
                <div>
                  <label htmlFor="psDigits" className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    PS NUMBER <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center rounded-md border border-border bg-background focus-within:ring-2 focus-within:ring-navy/40 overflow-hidden shadow-2xs">
                    <span className="px-3 py-2 bg-muted/80 text-foreground font-mono font-black text-sm border-r border-border select-none tracking-wider">
                      SIH26
                    </span>
                    <input
                      id="psDigits"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={3}
                      value={psDigits}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "").slice(0, 3);
                        setPsDigits(digits);
                        if (psError) setPsError("");
                      }}
                      placeholder="042"
                      className="w-full px-3 py-1.5 font-mono font-bold tracking-wider text-sm bg-transparent border-0 focus:outline-none placeholder:text-muted-foreground/40 text-foreground"
                      required
                    />
                  </div>
                  {psError && (
                    <p className="mt-1 text-xs text-rose-600 font-medium">{psError}</p>
                  )}
                  <p className="mt-1 text-[10px] text-muted-foreground font-medium">
                    Enter the 3-digit problem ID (e.g. 042 → SIH26042)
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

              {/* Row 2: Technology Stack & Business Sector Addressed */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* TECHNOLOGY STACK dropdown */}
                <div>
                  <label htmlFor="techStack" className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    TECHNOLOGY STACK <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="techStack"
                    value={techStack}
                    onChange={(e) => setTechStack(e.target.value)}
                    className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm font-semibold text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-navy/40"
                    required
                  >
                    <option value="" disabled className="text-muted-foreground">
                      Select Technology Stack...
                    </option>
                    {TECH_STACK_OPTIONS.map((tech) => (
                      <option key={tech} value={tech} className="text-foreground bg-background py-1">
                        {tech}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[10px] text-muted-foreground font-medium">
                    Core technical architecture / domains used
                  </p>
                </div>

                {/* BUSINESS SECTOR ADDRESSED dropdown */}
                <div>
                  <label htmlFor="businessSector" className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    BUSINESS SECTOR ADDRESSED <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="businessSector"
                    value={businessSector}
                    onChange={(e) => setBusinessSector(e.target.value)}
                    className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm font-semibold text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-navy/40"
                    required
                  >
                    <option value="" disabled className="text-muted-foreground">
                      Select Business Sector...
                    </option>
                    {BUSINESS_SECTOR_OPTIONS.map((sec) => (
                      <option key={sec} value={sec} className="text-foreground bg-background py-1">
                        {sec}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[10px] text-muted-foreground font-medium">
                    Industry or societal sector your solution impacts
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  type="submit"
                  disabled={
                    isSubmittingPs ||
                    psDigits.replace(/\D/g, "").length !== 3 ||
                    !theme.trim() ||
                    !techStack.trim() ||
                    !businessSector.trim()
                  }
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

      {/* Round 1 Evaluation Results Section */}
      {evaluation ? (
        <Card className="shadow-card-soft border-border overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-navy/10 dark:bg-sky-950/60 text-navy dark:text-sky-300 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-gold" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg font-bold text-foreground">
                    Round 1 Evaluation Results
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Assessment &amp; Feedback from Official SIH Evaluator
                  </CardDescription>
                </div>
              </div>

              {/* Recommendation Verdict Badge */}
              <div>
                {evaluation.verdict === "shortlisted" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 shadow-2xs">
                    <Star className="h-3.5 w-3.5 fill-emerald-600" /> Recommended
                  </span>
                )}
                {evaluation.verdict === "waitlist" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 shadow-2xs">
                    <Clock className="h-3.5 w-3.5 text-amber-600" /> May be Considered
                  </span>
                )}
                {evaluation.verdict === "rejected" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 shadow-2xs">
                    <AlertCircle className="h-3.5 w-3.5 text-rose-600" /> Not Recommended
                  </span>
                )}
                {evaluation.verdict === "reviewed" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 shadow-2xs">
                    <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" /> Reviewed
                  </span>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-5 sm:p-6 space-y-5">
            {/* Total Score Banner & Rubric Breakdown Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div className="sm:col-span-1 rounded-xl bg-card border border-border p-4 flex flex-col items-center justify-center text-center shadow-2xs">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Score</p>
                <div className="mt-1">
                  <span className="text-3xl font-black text-navy dark:text-sky-400">
                    {evaluation.totalScore}
                  </span>
                  <span className="text-xs font-bold text-muted-foreground ml-1">/ 100</span>
                </div>
              </div>

              <div className="sm:col-span-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Novelty</p>
                  <p className="text-base font-extrabold text-foreground mt-0.5">
                    {evaluation.novelty} <span className="text-[10px] text-muted-foreground">/ 25</span>
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Technical</p>
                  <p className="text-base font-extrabold text-foreground mt-0.5">
                    {evaluation.technical} <span className="text-[10px] text-muted-foreground">/ 25</span>
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Impact</p>
                  <p className="text-base font-extrabold text-foreground mt-0.5">
                    {evaluation.impact} <span className="text-[10px] text-muted-foreground">/ 25</span>
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Presentation</p>
                  <p className="text-base font-extrabold text-foreground mt-0.5">
                    {evaluation.presentation} <span className="text-[10px] text-muted-foreground">/ 25</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Evaluator Remarks */}
            {evaluation.remarks && (
              <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <span>💬</span> Evaluator Remarks &amp; Feedback
                </p>
                <p className="text-xs text-foreground/90 leading-relaxed font-medium whitespace-pre-wrap bg-background p-3 rounded-lg border border-border">
                  {evaluation.remarks}
                </p>
              </div>
            )}

            {/* May be Considered Reason */}
            {evaluation.waitlistReason && (
              <div className="rounded-xl border border-amber-300 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 p-4 space-y-1.5">
                <p className="text-xs font-bold text-amber-950 dark:text-amber-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-amber-600" /> &quot;May be Considered&quot; — Reason &amp; Criteria
                </p>
                <p className="text-xs text-amber-900 dark:text-amber-100 leading-relaxed font-medium bg-background/80 p-3 rounded-lg border border-amber-200/80 dark:border-amber-800/80">
                  {evaluation.waitlistReason}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : team.ps_number ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-5 text-center text-muted-foreground space-y-1.5 shadow-2xs">
          <div className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-amber-500/10 text-amber-600 mb-1">
            <Clock className="h-4 w-4" />
          </div>
          <h3 className="font-bold text-sm text-foreground">Round 1 Evaluation in Progress</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Your problem statement ({team.ps_number}) is under review by the assigned evaluation panel. Results and rubric feedback will be published here once finalized.
          </p>
        </div>
      ) : null}

      <StudentContactModal
        student={selectedStudent}
        onClose={() => setSelectedStudent(null)}
      />
    </div>
  );
}
