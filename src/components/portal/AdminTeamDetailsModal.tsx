"use client";

import { X, Award, Star, User, Phone, Mail, FileText, CheckCircle2, Clock, AlertCircle, Sparkles, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toRomanYear } from "@/lib/utils";

export type AdminTeamDetailsData = {
  team: {
    id: string;
    name: string;
    psNumber?: string | null;
    theme?: string | null;
    techStack?: string | null;
    businessSector?: string | null;
    problemStatement?: string | null;
    category?: string | null;
    leaderId: string;
    status: string;
  };
  members: {
    id: string;
    fullName: string;
    email?: string | null;
    department?: string | null;
    year?: number | null;
    phone?: string | null;
    gender?: string | null;
    isLeader: boolean;
  }[];
  assignment?: {
    evaluatorId: string;
    evaluatorName: string;
    evaluatorEmail?: string;
    evaluatorDept?: string;
  } | null;
  evaluation?: {
    novelty: number;
    technical: number;
    impact: number;
    presentation: number;
    totalScore: number;
    verdict: "shortlisted" | "waitlist" | "rejected" | "reviewed" | "pending";
    remarks: string;
    waitlistReason?: string;
    updatedAt: string;
  } | null;
};

type Props = {
  data: AdminTeamDetailsData | null;
  onClose: () => void;
  onSelectStudent?: (student: {
    fullName: string;
    email?: string;
    department?: string | null;
    year?: number | null;
    phone?: string | null;
    isLeader?: boolean;
  }) => void;
};

export function AdminTeamDetailsModal({ data, onClose, onSelectStudent }: Props) {
  if (!data) return null;

  const { team, members, assignment, evaluation } = data;
  const leader = members.find((m) => m.id === team.leaderId || m.isLeader);

  const getVerdictBadge = (verdict?: string) => {
    switch (verdict) {
      case "shortlisted":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 px-3 py-1 text-xs font-bold border border-emerald-300">
            <Award className="h-3.5 w-3.5" /> Shortlisted
          </span>
        );
      case "waitlist":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 px-3 py-1 text-xs font-bold border border-amber-300">
            <Clock className="h-3.5 w-3.5" /> Waitlist
          </span>
        );
      case "reviewed":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 px-3 py-1 text-xs font-bold border border-blue-300">
            <CheckCircle2 className="h-3.5 w-3.5" /> Reviewed
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 px-3 py-1 text-xs font-bold border border-rose-300">
            <AlertCircle className="h-3.5 w-3.5" /> Not Shortlisted
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 px-3 py-1 text-xs font-bold border border-slate-300">
            <Clock className="h-3.5 w-3.5" /> Evaluation Pending
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl rounded-2xl bg-card border border-border p-5 sm:p-7 shadow-2xl space-y-6 my-8 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors z-10"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Top Header: Team Title & Metadata */}
        <div className="border-b border-border pb-5 space-y-2">
          <div className="flex flex-wrap items-center gap-2.5 pr-8">
            <h2 className="text-2xl font-extrabold text-foreground tracking-tight">
              {team.name}
            </h2>
            {team.category && (
              <span className="text-xs font-normal text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {team.category}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {team.psNumber ? (
              <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-navy bg-navy/10 dark:text-sky-300 dark:bg-sky-950/50 px-2.5 py-0.5 rounded border border-navy/20 uppercase">
                <FileText className="h-3 w-3" /> PS: {team.psNumber}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground italic">No PS Number Submitted</span>
            )}

            {team.theme && (
              <span className="text-xs text-muted-foreground bg-muted px-2.5 py-0.5 rounded font-medium truncate max-w-[280px]">
                Theme: {team.theme}
              </span>
            )}

            {team.techStack && (
              <span className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 px-2.5 py-0.5 rounded font-medium border border-blue-200/60 truncate max-w-[280px]">
                Tech: {team.techStack}
              </span>
            )}

            {team.businessSector && (
              <span className="text-xs text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 px-2.5 py-0.5 rounded font-medium border border-purple-200/60 truncate max-w-[280px]">
                Sector: {team.businessSector}
              </span>
            )}

            <span className="rounded-full bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 px-2.5 py-0.5 text-xs font-semibold border border-emerald-200">
              {members.length}/6 Members
            </span>
          </div>
        </div>

        {/* Evaluator Score & Comments Section */}
        <div className="rounded-xl border border-border/80 bg-surface-muted p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-gold" />
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                Evaluation & Assessment
              </h3>
            </div>
            {getVerdictBadge(evaluation?.verdict)}
          </div>

          {evaluation ? (
            <div className="space-y-4">
              {/* Total Score Metric Card */}
              <div className="flex items-center justify-between rounded-xl bg-card border border-border p-4 shadow-xs">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Score</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Evaluated by <strong className="text-foreground">{assignment?.evaluatorName || "Assigned Faculty"}</strong>
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-black text-navy dark:text-sky-400">
                    {evaluation.totalScore}
                  </span>
                  <span className="text-xs font-bold text-muted-foreground ml-1">/ 100</span>
                </div>
              </div>

              {/* Rubric Breakdown Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="rounded-lg border border-border/60 bg-card p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Novelty</p>
                  <p className="text-base font-extrabold text-foreground mt-0.5">{evaluation.novelty} <span className="text-[10px] text-muted-foreground">/ 25</span></p>
                </div>
                <div className="rounded-lg border border-border/60 bg-card p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Technical</p>
                  <p className="text-base font-extrabold text-foreground mt-0.5">{evaluation.technical} <span className="text-[10px] text-muted-foreground">/ 25</span></p>
                </div>
                <div className="rounded-lg border border-border/60 bg-card p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Impact</p>
                  <p className="text-base font-extrabold text-foreground mt-0.5">{evaluation.impact} <span className="text-[10px] text-muted-foreground">/ 25</span></p>
                </div>
                <div className="rounded-lg border border-border/60 bg-card p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Presentation</p>
                  <p className="text-base font-extrabold text-foreground mt-0.5">{evaluation.presentation} <span className="text-[10px] text-muted-foreground">/ 25</span></p>
                </div>
              </div>

              {/* Waitlist Reason (if present) */}
              {evaluation.waitlistReason && (
                <div className="rounded-lg border border-amber-300 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 p-3.5 space-y-1">
                  <p className="text-xs font-bold text-amber-950 dark:text-amber-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-amber-600" /> Waitlist Reason & Criteria
                  </p>
                  <p className="text-xs text-amber-900 dark:text-amber-100 leading-relaxed font-medium mt-0.5">
                    {evaluation.waitlistReason}
                  </p>
                </div>
              )}

              {/* Evaluator Remarks */}
              <div className="rounded-lg border border-border/60 bg-card p-3.5 space-y-1">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Evaluator Comments & Feedback</p>
                {evaluation.remarks ? (
                  <p className="text-xs text-foreground leading-relaxed italic bg-muted/30 p-2.5 rounded border border-border/40 mt-1">
                    "{evaluation.remarks}"
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No specific comments recorded.</p>
                )}
                {evaluation.updatedAt && (
                  <p className="text-[10px] text-muted-foreground/70 text-right pt-1">
                    Updated: {new Date(evaluation.updatedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-card p-4 text-center space-y-1">
              <p className="text-xs font-semibold text-foreground">
                {assignment ? `Assigned to ${assignment.evaluatorName}` : "Not Assigned to any Evaluator yet"}
              </p>
              <p className="text-xs text-muted-foreground">
                {assignment ? "Evaluation score and remarks will appear here once submitted by the evaluator." : "Assign an evaluator from the Evaluator Assignments tab to begin assessment."}
              </p>
            </div>
          )}
        </div>

        {/* Problem Statement Details (if submitted) */}
        {team.problemStatement && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-navy dark:text-sky-400" /> Proposed Problem Statement / Solution
            </h4>
            <div className="rounded-xl border border-border bg-surface-muted p-3.5 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
              {team.problemStatement}
            </div>
          </div>
        )}

        {/* Team Members Squad List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-navy dark:text-sky-400" /> Team Squad ({members.length} Members)
            </h4>
            <span className="text-[11px] text-muted-foreground font-medium">Click member to view contact details</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {members.map((m) => {
              const isLeader = m.id === team.leaderId || m.isLeader;
              return (
                <div
                  key={m.id}
                  onClick={() => onSelectStudent && onSelectStudent({
                    fullName: m.fullName,
                    email: m.email ?? undefined,
                    department: m.department,
                    year: m.year,
                    phone: m.phone,
                    isLeader: isLeader,
                  })}
                  className={`rounded-xl border p-3 cursor-pointer transition-all shadow-2xs hover:shadow-sm flex items-start gap-3 ${
                    isLeader
                      ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 hover:border-amber-400"
                      : "border-border bg-card hover:border-primary/50 hover:bg-muted/30"
                  }`}
                >
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                    isLeader ? "bg-amber-500 text-white" : "bg-muted text-foreground"
                  }`}>
                    {m.fullName.charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-bold text-foreground truncate">{m.fullName}</p>
                      {isLeader && (
                        <span className="rounded-full bg-amber-500 text-white text-[9px] font-extrabold px-1.5 py-0.2 uppercase tracking-wider">
                          LEAD
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {[m.department, toRomanYear(m.year)].filter(Boolean).join(" · ") || "SECE Student"}
                    </p>

                    <div className="flex items-center gap-3 mt-1.5 text-[11px]">
                      {m.phone && (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                          <Phone className="h-3 w-3" /> {m.phone}
                        </span>
                      )}
                      {m.email && (
                        <span className="inline-flex items-center gap-1 text-muted-foreground truncate max-w-[140px]">
                          <Mail className="h-3 w-3 shrink-0" /> {m.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-2 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose} className="px-5 font-semibold">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
