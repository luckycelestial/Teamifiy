"use client";

import { useState, useEffect } from "react";
import { X, Award, Star, CheckCircle, AlertTriangle, FileText, Users, Sparkles, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toRomanYear } from "@/lib/utils";
import type { EvaluationRecord } from "@/app/actions/portal";

export type EvaluationTeamData = {
  team: {
    id: string;
    name: string;
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
  const [verdict, setVerdict] = useState<"shortlisted" | "reviewed" | "rejected" | "pending">("pending");
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    if (data) {
      if (data.evaluation) {
        setNovelty(data.evaluation.novelty ?? 15);
        setTechnical(data.evaluation.technical ?? 15);
        setImpact(data.evaluation.impact ?? 15);
        setPresentation(data.evaluation.presentation ?? 15);
        setVerdict(data.evaluation.verdict ?? "pending");
        setRemarks(data.evaluation.remarks ?? "");
      } else {
        setNovelty(15);
        setTechnical(15);
        setImpact(15);
        setPresentation(15);
        setVerdict("pending");
        setRemarks("");
      }
    }
  }, [data]);

  if (!data) return null;

  const totalScore = Number(novelty || 0) + Number(technical || 0) + Number(impact || 0) + Number(presentation || 0);

  const getScoreBadge = (score: number) => {
    if (score >= 80) return "bg-emerald-500 text-white";
    if (score >= 65) return "bg-blue-600 text-white";
    if (score >= 50) return "bg-amber-500 text-white";
    return "bg-rose-500 text-white";
  };

  const handleSave = async () => {
    await onSave({
      teamId: data.team.id,
      novelty: Number(novelty),
      technical: Number(technical),
      impact: Number(impact),
      presentation: Number(presentation),
      totalScore,
      verdict,
      remarks,
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
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
                  <span className="rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 px-2 py-0.5 text-[10px] font-bold uppercase">
                    {data.team.category}
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
          <div className="rounded-xl border border-border bg-surface-muted p-4 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <FileText className="h-3.5 w-3.5 text-primary" />
              Problem Statement
            </div>
            <p className="text-sm font-medium text-foreground leading-relaxed">
              {data.team.problemStatement || "No specific problem statement provided by team leader."}
            </p>
          </div>

          {/* Members Breakdown */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-primary" />
                Team Roster ({data.members.length} Members)
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {data.members.map((m) => {
                const isLeader = m.id === data.team.leaderId;
                return (
                  <div
                    key={m.id}
                    className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                      isLeader
                        ? "bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800"
                        : "bg-background border-border"
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        {isLeader && (
                          <span className="rounded bg-amber-500 text-white font-black text-[9px] px-1 py-0.2 uppercase">
                            LEAD
                          </span>
                        )}
                        <span className="font-semibold text-foreground truncate">{m.fullName}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {m.department || "General"}{m.year ? ` · ${toRomanYear(m.year)}` : ""}
                      </p>
                    </div>
                    {m.phone && <span className="font-mono text-[10px] text-muted-foreground shrink-0">{m.phone}</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scoring Rubrics Grid */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <Sparkles className="h-3.5 w-3.5 text-gold" />
                Evaluation Rubrics (0 - 25 pts each)
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-semibold">Total Score:</span>
                <span className={`px-2.5 py-0.5 rounded-full font-black text-sm ${getScoreBadge(totalScore)}`}>
                  {totalScore} / 100
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/20 p-4 rounded-xl border border-border">
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
                  <span className="font-semibold text-foreground">3. Societal Impact & Viability</span>
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

          {/* Verdict Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
              Recommendation Verdict
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setVerdict("shortlisted")}
                className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                  verdict === "shortlisted"
                    ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                    : "bg-background border-border text-foreground hover:bg-muted"
                }`}
              >
                <Star className="h-3.5 w-3.5 fill-current" /> Shortlist
              </button>

              <button
                type="button"
                onClick={() => setVerdict("reviewed")}
                className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                  verdict === "reviewed"
                    ? "bg-blue-600 text-white border-blue-700 shadow-xs"
                    : "bg-background border-border text-foreground hover:bg-muted"
                }`}
              >
                <CheckCircle className="h-3.5 w-3.5" /> Reviewed
              </button>

              <button
                type="button"
                onClick={() => setVerdict("rejected")}
                className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                  verdict === "rejected"
                    ? "bg-rose-600 text-white border-rose-700 shadow-xs"
                    : "bg-background border-border text-foreground hover:bg-muted"
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5" /> Reject
              </button>

              <button
                type="button"
                onClick={() => setVerdict("pending")}
                className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                  verdict === "pending"
                    ? "bg-muted-foreground text-white border-muted-foreground shadow-xs"
                    : "bg-background border-border text-foreground hover:bg-muted"
                }`}
              >
                Pending
              </button>
            </div>
          </div>

          {/* Remarks Textarea */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
              Evaluator Feedback & Remarks
            </label>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Add key observations, strengths, weaknesses, and improvement suggestions..."
              className="w-full text-xs rounded-lg border border-border bg-background p-3 focus:outline-none focus:ring-2 focus:ring-navy/40 placeholder:text-muted-foreground/60 resize-none"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/30">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSaving} className="text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="bg-navy hover:bg-navy/90 text-white text-xs font-bold gap-1.5 px-5 shadow-xs"
          >
            <Send className="h-3.5 w-3.5" />
            {isSaving ? "Saving Evaluation…" : "Submit Evaluation"}
          </Button>
        </div>
      </div>
    </div>
  );
}
