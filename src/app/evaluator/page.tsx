"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getEvaluatorDashboardData, getEvaluations, saveTeamEvaluation, type EvaluationRecord } from "@/app/actions/portal";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { FileSpreadsheet, Award, Star, CheckCircle, Clock, AlertTriangle, Sparkles, Search } from "lucide-react";
import { exportEvaluatorMasterReport } from "@/lib/excel-export";
import { toRomanYear } from "@/lib/utils";
import { StudentContactModal, StudentModalData } from "@/components/portal/StudentContactModal";
import { EvaluationModal, EvaluationTeamData } from "@/components/portal/EvaluationModal";

const TEAM_SIZE = 6;

function EvaluatorContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [data, setData] = useState<Awaited<ReturnType<typeof getEvaluatorDashboardData>> | null>(null);
  const [evaluations, setEvaluations] = useState<Record<string, EvaluationRecord>>({});
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [verdictFilter, setVerdictFilter] = useState<string>("ALL");
  const [selectedStudent, setSelectedStudent] = useState<StudentModalData | null>(null);
  const [selectedTeamForEval, setSelectedTeamForEval] = useState<EvaluationTeamData | null>(null);
  const [isSavingEval, setIsSavingEval] = useState(false);

  async function loadData() {
    try {
      const [dashData, evalData] = await Promise.all([
        getEvaluatorDashboardData(),
        getEvaluations(),
      ]);
      setData(dashData);
      setEvaluations(evalData || {});
    } catch (e) {
      console.error(e);
      toast.error("Failed to load evaluation portal.");
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
      setUser({ id: session.user.id, email: session.user.email ?? "" });
      loadData();
    });
  }, [router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-surface-muted flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-muted-foreground animate-pulse">
          <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span>Loading evaluation workspace…</span>
        </div>
      </div>
    );
  }

  if (!data?.isEvaluator) {
    return (
      <div className="min-h-screen bg-surface-muted">
        <PortalHeader isEvaluator={false} email={user.email} />
        <main className="mx-auto max-w-3xl px-5 py-16 text-center">
          <h1 className="text-2xl font-extrabold">Evaluator access required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This panel is reserved for authorized SIH Evaluators.
          </p>
        </main>
      </div>
    );
  }

  const allProfiles = data.profiles;
  const byId = new Map(allProfiles.map((p) => [p.id, p]));
  const allMemberships = data.memberships;
  const allTeams = data.teams;

  // Empty state — evaluator has no assignments yet
  const hasAssignments = (data as any).hasAssignments !== false;
  if (!hasAssignments) {
    return (
      <div className="min-h-screen bg-surface-muted">
        <PortalHeader isEvaluator role="evaluator" email={user.email} />
        <main className="mx-auto max-w-3xl px-5 py-20 text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-amber-100 flex items-center justify-center mb-5">
            <Clock className="h-8 w-8 text-amber-600" />
          </div>
          <h2 className="text-xl font-extrabold text-foreground">No Team Assignments Yet</h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
            The admin hasn&apos;t assigned any teams to you yet. You&apos;ll see your evaluation batch here once assignments are made.
          </p>
        </main>
      </div>
    );
  }

  const rows = allTeams.map((team) => {
    const members = allMemberships
      .filter((m) => m.teamId === team.id)
      .map((m) => byId.get(m.userId))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
    const evaluation = evaluations[team.id];
    return { team, members, evaluation };
  });

  // Calculate Evaluation Metrics
  const evaluatedTeamsCount = rows.filter((r) => r.evaluation && r.evaluation.verdict !== "pending").length;
  const pendingTeamsCount = allTeams.length - evaluatedTeamsCount;
  const shortlistedCount = rows.filter((r) => r.evaluation?.verdict === "shortlisted").length;
  const scoresArray = rows.map((r) => r.evaluation?.totalScore).filter((s): s is number => typeof s === "number");
  const avgScore = scoresArray.length > 0 ? Math.round(scoresArray.reduce((a, b) => a + b, 0) / scoresArray.length) : 0;

  // Filter Rows
  const filteredTeams = rows.filter(({ team, members, evaluation }) => {
    const q = query.trim().toLowerCase();
    
    // Search query filter
    const matchesQuery = !q || (
      team.name.toLowerCase().includes(q) ||
      (team.category ?? "").toLowerCase().includes(q) ||
      (team.psNumber ?? "").toLowerCase().includes(q) ||
      (team.theme ?? "").toLowerCase().includes(q) ||
      (team.problemStatement ?? "").toLowerCase().includes(q) ||
      members.some((m) => m.fullName.toLowerCase().includes(q) || (m.department ?? "").toLowerCase().includes(q))
    );

    // Category filter
    const matchesCategory = categoryFilter === "ALL" || (team.category || "GENERAL").toUpperCase() === categoryFilter;

    // Verdict / Evaluation status filter
    let matchesVerdict = true;
    if (verdictFilter === "EVALUATED") {
      matchesVerdict = Boolean(evaluation && evaluation.verdict !== "pending");
    } else if (verdictFilter === "PENDING") {
      matchesVerdict = !evaluation || evaluation.verdict === "pending";
    } else if (verdictFilter === "SHORTLISTED") {
      matchesVerdict = evaluation?.verdict === "shortlisted";
    }

    return matchesQuery && matchesCategory && matchesVerdict;
  });

  const handleSaveEvaluation = async (record: EvaluationRecord) => {
    setIsSavingEval(true);
    try {
      await saveTeamEvaluation(record);
      setEvaluations((prev) => ({ ...prev, [record.teamId]: record }));
      toast.success("Team evaluation recorded successfully!");
      setSelectedTeamForEval(null);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to save evaluation.");
    } finally {
      setIsSavingEval(false);
    }
  };

  async function handleExportExcel() {
    try {
      await exportEvaluatorMasterReport(rows);
      toast.success("Evaluation master spreadsheet exported!");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Failed to export Excel report.");
    }
  }

  const getScoreBadge = (score?: number) => {
    if (typeof score !== "number") return null;
    if (score >= 80) return "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border-emerald-300";
    if (score >= 65) return "bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-200 border-blue-300";
    if (score >= 50) return "bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 border-amber-300";
    return "bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border-rose-300";
  };

  return (
    <div className="min-h-screen bg-surface-muted">
      <PortalHeader isEvaluator role="evaluator" email={user.email} />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-5 sm:py-8 space-y-6">
        {/* Metric Cards Header */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <Card className="shadow-card-soft border-border/80">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">{allTeams.length}</p>
                <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground mt-0.5">
                  Total Teams
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-navy/10 text-navy dark:text-blue-400 flex items-center justify-center">
                <Award className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card-soft border-border/80">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-2xl sm:text-3xl font-black tracking-tight text-emerald-600">{evaluatedTeamsCount}</p>
                <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground mt-0.5">
                  Evaluated
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <CheckCircle className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card-soft border-border/80">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-2xl sm:text-3xl font-black tracking-tight text-amber-600">{pendingTeamsCount}</p>
                <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground mt-0.5">
                  Pending Review
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Clock className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card-soft border-border/80">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-2xl sm:text-3xl font-black tracking-tight text-primary">
                  {shortlistedCount} <span className="text-xs font-semibold text-muted-foreground">({avgScore ? `${avgScore} avg` : "—"})</span>
                </p>
                <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground mt-0.5">
                  Shortlisted
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Star className="h-5 w-5 fill-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Controls, Filter Pills & Search */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3.5 bg-background p-3.5 sm:p-4 rounded-xl border border-border shadow-xs">
          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border text-xs">
              <button
                onClick={() => setVerdictFilter("ALL")}
                className={`px-3 py-1.5 rounded-md font-bold transition-all ${
                  verdictFilter === "ALL" ? "bg-navy text-white shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All ({allTeams.length})
              </button>
              <button
                onClick={() => setVerdictFilter("EVALUATED")}
                className={`px-3 py-1.5 rounded-md font-bold transition-all ${
                  verdictFilter === "EVALUATED" ? "bg-navy text-white shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Evaluated ({evaluatedTeamsCount})
              </button>
              <button
                onClick={() => setVerdictFilter("PENDING")}
                className={`px-3 py-1.5 rounded-md font-bold transition-all ${
                  verdictFilter === "PENDING" ? "bg-navy text-white shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Pending ({pendingTeamsCount})
              </button>
              <button
                onClick={() => setVerdictFilter("SHORTLISTED")}
                className={`px-3 py-1.5 rounded-md font-bold transition-all ${
                  verdictFilter === "SHORTLISTED" ? "bg-navy text-white shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                ⭐ Shortlisted ({shortlistedCount})
              </button>
            </div>

            <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border text-xs">
              {["ALL", "SOFTWARE", "HARDWARE"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1.5 rounded-md font-bold text-[11px] uppercase transition-all ${
                    categoryFilter === cat ? "bg-background text-foreground shadow-2xs font-extrabold" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Search and Export */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Input
                value={query}
                placeholder="Search team, problem, student..."
                onChange={(e) => setQuery(e.target.value)}
                className="h-8 sm:h-9 text-xs pl-8 bg-surface-muted"
              />
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            </div>

            <Button
              size="sm"
              onClick={handleExportExcel}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 h-8 sm:h-9 px-3.5 shadow-xs whitespace-nowrap"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Export Sheet
            </Button>
          </div>
        </div>

        {/* Teams Evaluation Table */}
        <Card className="shadow-card-soft overflow-hidden border-border/80">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[850px]">
              <thead className="bg-muted/60 text-xs uppercase font-semibold text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-4 py-3">Team & Problem Statement</th>
                  <th className="px-4 py-3">Squad Roster</th>
                  <th className="px-4 py-3 text-center">Score</th>
                  <th className="px-4 py-3 text-center">Verdict</th>
                  <th className="px-4 py-3 text-right">Evaluation Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTeams.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                      <p className="font-semibold text-sm">No teams match your evaluation filter criteria.</p>
                      <p className="text-xs text-muted-foreground/80 mt-1">Try resetting the category or search filter above.</p>
                    </td>
                  </tr>
                ) : (
                  filteredTeams.map(({ team, members, evaluation }) => {
                    const isEvaluated = Boolean(evaluation && evaluation.verdict !== "pending");
                    return (
                      <tr key={team.id} className="hover:bg-muted/30 transition-colors align-top">
                        {/* Team & Problem Statement */}
                        <td className="px-4 py-3.5 min-w-[240px] max-w-[280px]">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="font-extrabold text-foreground text-sm">{team.name}</p>
                            {team.category && (
                              <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-bold text-muted-foreground uppercase">
                                {team.category}
                              </span>
                            )}
                            {team.psNumber && (
                              <span className="rounded bg-navy/10 font-mono px-1.5 py-0.2 text-[10px] font-bold text-navy uppercase">
                                {team.psNumber}
                              </span>
                            )}
                          </div>

                          {team.theme && (
                            <p className="text-[11px] font-semibold text-primary mt-1">
                              Theme: <span className="font-normal text-muted-foreground">{team.theme}</span>
                            </p>
                          )}

                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {team.problemStatement ? (
                              team.problemStatement
                            ) : (
                              <span className="italic text-muted-foreground/60">No description provided</span>
                            )}
                          </p>

                          <p className="text-[11px] text-muted-foreground/80 font-medium mt-1">
                            Lead: <span className="font-semibold text-foreground">{byId.get(team.leaderId)?.fullName ?? "—"}</span>
                          </p>
                        </td>

                        {/* Squad Roster */}
                        <td className="px-4 py-3.5 min-w-[280px]">
                          <div className="flex flex-wrap gap-1.5">
                            {members.map((m) => {
                              const isLeader = m.id === team.leaderId;
                              return isLeader ? (
                                <span
                                  key={m.id}
                                  onClick={() => setSelectedStudent({
                                    fullName: m.fullName,
                                    email: m.email ?? undefined,
                                    department: m.department,
                                    year: m.year,
                                    phone: m.phone,
                                  })}
                                  title="Team Leader — Click for contact"
                                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 text-[11px] font-bold text-amber-950 dark:text-amber-100 cursor-pointer hover:border-amber-400 shadow-2xs"
                                >
                                  <span className="rounded bg-amber-500 text-[8px] font-black text-white px-1 py-0.2 uppercase">
                                    LEAD
                                  </span>
                                  <span>{m.fullName}</span>
                                  {m.department && (
                                    <span className="text-amber-800/80 dark:text-amber-300/80 font-medium">· {m.department}</span>
                                  )}
                                </span>
                              ) : (
                                <span
                                  key={m.id}
                                  onClick={() => setSelectedStudent({
                                    fullName: m.fullName,
                                    email: m.email ?? undefined,
                                    department: m.department,
                                    year: m.year,
                                    phone: m.phone,
                                  })}
                                  title="Click for contact"
                                  className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-foreground cursor-pointer hover:border-navy/40"
                                >
                                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                                  <span>{m.fullName}</span>
                                  {m.department && <span className="text-muted-foreground">· {m.department}</span>}
                                </span>
                              );
                            })}
                          </div>
                        </td>

                        {/* Score Column */}
                        <td className="px-4 py-3.5 text-center whitespace-nowrap min-w-[100px]">
                          {typeof evaluation?.totalScore === "number" ? (
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black border ${getScoreBadge(evaluation.totalScore)}`}>
                              {evaluation.totalScore} / 100
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/60 italic">Not scored</span>
                          )}
                        </td>

                        {/* Verdict Column */}
                        <td className="px-4 py-3.5 text-center whitespace-nowrap min-w-[130px]">
                          {evaluation?.verdict === "shortlisted" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <Star className="h-3 w-3 fill-emerald-600" /> Shortlisted
                            </span>
                          )}
                          {evaluation?.verdict === "reviewed" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
                              <CheckCircle className="h-3 w-3" /> Reviewed
                            </span>
                          )}
                          {evaluation?.verdict === "rejected" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <AlertTriangle className="h-3 w-3" /> Rejected
                            </span>
                          )}
                          {(!evaluation || evaluation?.verdict === "pending") && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground">
                              <Clock className="h-3 w-3" /> Pending
                            </span>
                          )}
                        </td>

                        {/* Action Column */}
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <Button
                            size="sm"
                            onClick={() => setSelectedTeamForEval({ team, members, evaluation })}
                            className={`text-xs font-bold h-8 px-3.5 gap-1.5 shadow-xs ${
                              isEvaluated
                                ? "bg-background border border-border text-foreground hover:bg-muted"
                                : "bg-navy hover:bg-navy/90 text-white"
                            }`}
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            {isEvaluated ? "Edit Evaluation" : "Evaluate Team"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </main>

      {/* Student Contact Info Modal */}
      <StudentContactModal student={selectedStudent} onClose={() => setSelectedStudent(null)} />

      {/* Team Evaluation Scoring Modal */}
      <EvaluationModal
        data={selectedTeamForEval}
        onClose={() => setSelectedTeamForEval(null)}
        onSave={handleSaveEvaluation}
        isSaving={isSavingEval}
      />
    </div>
  );
}

export default function EvaluatorPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted-foreground">Loading evaluator portal…</p>}>
      <EvaluatorContent />
    </Suspense>
  );
}
