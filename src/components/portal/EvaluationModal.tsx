"use client";

import { useState, useEffect } from "react";
import { X, Award, Star, Clock, AlertTriangle, FileText, Users, Sparkles, Send, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toRomanYear } from "@/lib/utils";
import type { EvaluationRecord } from "@/app/actions/portal";

export type EvaluationTeamData = {
  team: {
    id: string;
    name: string;
    psNumber?: string | null;
    theme?: string | null;
    category: string | null;
    problemStatement: string | null;
    status: string;
    leaderId: string;
  };
  members: {
    id: string;
    fullName: string;
    email: string | null;
    department: string | null;
    year: number | null;
    phone: string | null;
  }[];
  evaluation?: EvaluationRecord;
};

export function EvaluationModal({
  data,
  onClose,
  onSave,
  isSaving,
}: {
  data: EvaluationTeamData | null;
  onClose: () => void;
  onSave: (record: EvaluationRecord) => Promise<void>;
  isSaving: boolean;
}) {
  const [novelty, setNovelty] = useState(15);
  const [technical, setTechnical] = useState(15);
  const [impact, setImpact] = useState(15);
  const [presentation, setPresentation] = useState(15);
  const [verdict, setVerdict] = useState<"shortlisted" | "waitlist" | "rejected">("shortlisted");
  const [remarks, setRemarks] = useState("");
  const [waitlistReason, setWaitlistReason] = useState("");

  useEffect(() => {
    if (data) {
      if (data.evaluation) {
        setNovelty(data.evaluation.novelty ?? 15);
        setTechnical(data.evaluation.technical ?? 15);
        setImpact(data.evaluation.impact ?? 15);
        setPresentation(data.evaluation.presentation ?? 15);
        // Map legacy values if present
        const v = data.evaluation.verdict;
        if (v === "shortlisted" || v === "waitlist" || v === "rejected") {
          setVerdict(v);
        } else if (v === "reviewed") {
          setVerdict("shortlisted");
        } else {
          setVerdict("shortlisted");
        }
        setRemarks(data.evaluation.remarks ?? "");
        setWaitlistReason(data.evaluation.waitlistReason ?? "");
      } else {
        setNovelty(15);
        setTechnical(15);
        setImpact(15);
        setPresentation(15);
        setVerdict("shortlisted");
        setRemarks("");
        setWaitlistReason("");
      }
    }
  }, [data]);

  if (!data) return null;

  const totalScore = novelty + technical + impact + presentation;

  // Validation logic:
  // - If waitlist: both waitlistReason and remarks must be non-empty
  // - Otherwise: remarks must be non-empty
  const isWaitlist = verdict === "waitlist";
  const isWaitlistValid = !isWaitlist || Boolean(waitlistReason.trim());
  const isRemarksValid = Boolean(remarks.trim());
  const isFormValid = isWaitlistValid && isRemarksValid;

  const handleSave = async () => {
    if (!isFormValid) return;
    await onSave({
      teamId: data.team.id,
      novelty,
      technical,
      impact,
      presentation,
      totalScore,
      verdict,
      remarks: remarks.trim(),
      waitlistReason: isWaitlist ? waitlistReason.trim() : undefined,
      updatedAt: new Date().toISOString(),
    });
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return "bg-emerald-500 text-white";
    if (score >= 65) return "bg-blue-600 text-white";
    if (score >= 50) return "bg-amber-500 text-white";
    return "bg-rose-500 text-white";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-background rounded-2xl border border-border shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-navy text-white flex items-center justify-center shadow-xs">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-foreground">{data.team.name}</h3>
                {data.team.category && (
                  <span className="text-[11px] font-normal text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                    {data.team.category}
                  </span>
                )}
                {data.team.psNumber && (
                  <span className="rounded-full bg-navy/10 text-navy dark:text-sky-300 dark:bg-sky-950/50 px-2 py-0.5 text-[10px] font-mono font-bold uppercase">
                    {data.team.psNumber}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">SIH 2026 Evaluation Form</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Problem Statement Card */}
          <div className="rounded-xl border border-border bg-surface-muted p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <FileText className="h-3.5 w-3.5 text-primary" />
                Problem Statement Details
              </div>
              {data.team.psNumber && (
                <span className="font-mono text-xs font-bold text-foreground bg-background px-2.5 py-0.5 rounded border border-border">
                  PS: {data.team.psNumber}
                </span>
              )}
            </div>
            {data.team.theme && (
              <div className="text-xs">
                <span className="font-bold text-muted-foreground uppercase">Theme:</span>{" "}
                <span className="font-semibold text-foreground">{data.team.theme}</span>
              </div>
            )}
            {data.team.problemStatement && (
              <div className="text-xs text-foreground bg-background p-3 rounded-lg border border-border/80 leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap">
                {data.team.problemStatement}
              </div>
            )}
          </div>

          {/* Scoring Rubric (4 Parameters x 25 = 100) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-gold" />
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Rubric Scoring (Max 100)
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-semibold">Total:</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${getScoreBadge(totalScore)}`}>
                  {totalScore} / 100
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Criteria 1 */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-foreground">1. Novelty & Originality</span>
                  <span className="font-mono font-bold text-primary">{novelty} / 25</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={25}
                  value={novelty}
                  onChange={(e) => setNovelty(Number(e.target.value))}
                  className="w-full accent-navy cursor-pointer"
                />
              </div>

              {/* Criteria 2 */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-foreground">2. Technical Feasibility</span>
                  <span className="font-mono font-bold text-primary">{technical} / 25</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={25}
                  value={technical}
                  onChange={(e) => setTechnical(Number(e.target.value))}
                  className="w-full accent-navy cursor-pointer"
                />
              </div>

              {/* Criteria 3 */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-foreground">3. Societal & Market Impact</span>
                  <span className="font-mono font-bold text-primary">{impact} / 25</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={25}
                  value={impact}
                  onChange={(e) => setImpact(Number(e.target.value))}
                  className="w-full accent-navy cursor-pointer"
                />
              </div>

              {/* Criteria 4 */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-foreground">4. Presentation & Readiness</span>
                  <span className="font-mono font-bold text-primary">{presentation} / 25</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={25}
                  value={presentation}
                  onChange={(e) => setPresentation(Number(e.target.value))}
                  className="w-full accent-navy cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Verdict Selection: 3 Options with specific hover & active states */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
              Recommendation Verdict
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Option 1: Shortlisted (onhover = green) */}
              <button
                type="button"
                onClick={() => setVerdict("shortlisted")}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  verdict === "shortlisted"
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-sm ring-2 ring-emerald-400/30"
                    : "bg-background border-border text-foreground hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
                }`}
              >
                <Star className={`h-4 w-4 ${verdict === "shortlisted" ? "fill-current" : ""}`} />
                <span>Shortlisted</span>
              </button>

              {/* Option 2: Not Shortlisted (onhover = red) */}
              <button
                type="button"
                onClick={() => setVerdict("rejected")}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  verdict === "rejected"
                    ? "bg-rose-600 text-white border-rose-600 shadow-sm ring-2 ring-rose-400/30"
                    : "bg-background border-border text-foreground hover:border-rose-500 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
                }`}
              >
                <AlertTriangle className="h-4 w-4" />
                <span>Not Shortlisted</span>
              </button>

              {/* Option 3: Waitlist (onhover = yellow) */}
              <button
                type="button"
                onClick={() => setVerdict("waitlist")}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  verdict === "waitlist"
                    ? "bg-amber-500 text-white border-amber-500 shadow-sm ring-2 ring-amber-400/30"
                    : "bg-background border-border text-foreground hover:border-amber-500 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/40 dark:hover:text-amber-300"
                }`}
              >
                <Clock className="h-4 w-4" />
                <span>Waitlist</span>
              </button>
            </div>
          </div>

          {/* Waitlist Reason Field (Visible only when Waitlist is selected) */}
          {verdict === "waitlist" && (
            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-150 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-900/60 p-3.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-amber-950 dark:text-amber-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-amber-600" />
                  Reason for Waitlist <span className="text-rose-500 font-black">*</span>
                </label>
                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                  Required to Submit
                </span>
              </div>
              <textarea
                rows={2}
                value={waitlistReason}
                onChange={(e) => setWaitlistReason(e.target.value)}
                placeholder="Mention why this team is placed on the waitlist (e.g. pending prototype demo, requires second review, tiebreaker condition)..."
                className="w-full text-xs rounded-lg border border-amber-300 dark:border-amber-800 bg-background p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-muted-foreground/60 resize-none text-foreground"
              />
            </div>
          )}

          {/* Remarks Textarea (Always required) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Evaluator Feedback & Remarks <span className="text-rose-500 font-black">*</span>
              </label>
              {!remarks.trim() && (
                <span className="text-[10px] font-semibold text-rose-500">Required</span>
              )}
            </div>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Add key observations, strengths, weaknesses, and improvement suggestions..."
              className="w-full text-xs rounded-lg border border-border bg-background p-3 focus:outline-none focus:ring-2 focus:ring-navy/40 placeholder:text-muted-foreground/60 resize-none text-foreground"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/30">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSaving} className="text-xs">
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            {!isFormValid && (
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium hidden sm:inline">
                {isWaitlist && (!waitlistReason.trim() || !remarks.trim())
                  ? "Fill both Waitlist Reason & Feedback"
                  : "Feedback remarks required"}
              </span>
            )}

            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !isFormValid}
              className={`text-xs font-bold gap-1.5 px-5 shadow-xs transition-all ${
                isFormValid
                  ? "bg-navy hover:bg-navy/90 text-white cursor-pointer"
                  : "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
              }`}
            >
              <Send className="h-3.5 w-3.5" />
              {isSaving ? "Saving Evaluation…" : "Submit Evaluation"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
