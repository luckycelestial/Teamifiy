"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getEvaluatorDashboardData } from "@/app/actions/portal";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { StatusBadge } from "@/components/portal/StatusBadge";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { FileSpreadsheet } from "lucide-react";
import XLSX from "xlsx-js-style";

import { toRomanYear } from "@/lib/utils";
import { StudentContactModal, StudentModalData } from "@/components/portal/StudentContactModal";

const TEAM_SIZE = 6;

type ProfileItem = {
  id: string;
  fullName: string;
  email: string | null;
  department: string | null;
  year: number | null;
  phone: string | null;
};

function teamIssues(members: ProfileItem[]): string[] {
  const issues: string[] = [];
  if (members.length !== TEAM_SIZE) {
    issues.push(`${members.length}/${TEAM_SIZE} members — a SIH team needs exactly ${TEAM_SIZE}.`);
  }
  if (members.some((m) => !m.department)) {
    issues.push("Every member must have a valid department.");
  }
  return issues;
}

function EvaluatorContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [data, setData] = useState<Awaited<ReturnType<typeof getEvaluatorDashboardData>> | null>(null);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"teams" | "students">("teams");
  const [selectedStudent, setSelectedStudent] = useState<StudentModalData | null>(null);

  async function loadData() {
    try {
      const res = await getEvaluatorDashboardData();
      setData(res);
    } catch (e) {
      console.error(e);
      toast.error("Evaluator authorization failed.");
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
    return <p className="p-8 text-sm text-muted-foreground">Checking evaluator access…</p>;
  }

  if (!data?.isEvaluator) {
    return (
      <div className="min-h-screen bg-surface-muted">
        <PortalHeader isEvaluator={false} email={user.email} />
        <main className="mx-auto max-w-3xl px-5 py-16 text-center">
          <h1 className="text-2xl font-extrabold">Evaluator access required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This panel is reserved for SIH Evaluation Panel members.
          </p>
        </main>
      </div>
    );
  }

  const allProfiles = data.profiles;
  const byId = new Map(allProfiles.map((p) => [p.id, p]));
  const allMemberships = data.memberships;
  const allTeams = data.teams;

  const rows = allTeams.map((team) => {
    const members = allMemberships
      .filter((m) => m.teamId === team.id)
      .map((m) => byId.get(m.userId))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
    return { team, members, issues: teamIssues(members) };
  });

  const filteredTeams = rows.filter(({ team, members }) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      team.name.toLowerCase().includes(q) ||
      (team.category ?? "").toLowerCase().includes(q) ||
      (team.problemStatement ?? "").toLowerCase().includes(q) ||
      members.some((m) => m.fullName.toLowerCase().includes(q))
    );
  });

  const filteredStudents = allProfiles.filter((p) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      p.fullName.toLowerCase().includes(q) ||
      (p.email ?? "").toLowerCase().includes(q) ||
      (p.department ?? "").toLowerCase().includes(q) ||
      (p.phone ?? "").toLowerCase().includes(q)
    );
  });

  const valid = rows.filter((r) => r.issues.length === 0).length;

  const stats = [
    { label: "Total Teams", value: allTeams.length },
    { label: "Valid SIH Teams", value: valid },
    { label: "Needs Correction", value: allTeams.length - valid },
    { label: "Total Students", value: allProfiles.length },
  ];

  function handleExportExcel() {
    try {
      const exportRows = rows.map(({ team, members, issues }, index) => {
        const leader = members.find((m) => m.id === team.leaderId) || members[0];
        return {
          "S.No": index + 1,
          "Team Name": team.name,
          "Category": team.category || "General",
          "Problem Statement": team.problemStatement || "N/A",
          "Members Count": `${members.length}/${TEAM_SIZE}`,
          "Team Leader": leader?.fullName || "—",
          "Leader Email": leader?.email || "—",
          "SIH Status": issues.length === 0 ? "Valid" : "Incomplete",
          "Team Status": team.status.toUpperCase(),
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "SIH Evaluation Teams");
      XLSX.writeFile(workbook, "SIH_2026_Evaluator_Report.xlsx");
      toast.success("Excel report exported successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export Excel report.");
    }
  }

  return (
    <div className="min-h-screen bg-surface-muted">
      <PortalHeader isEvaluator role="evaluator" email={user.email} />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-5 sm:py-8">
        {/* Banner */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm">
          <h2 className="text-sm font-bold text-emerald-950">SIH 2026 Evaluation Panel</h2>
          <p className="text-xs text-emerald-800 mt-0.5">
            Evaluate team compositions, problem statements, and SIH compliance status across registered teams.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          {stats.map((s) => (
            <Card key={s.label} className="shadow-card-soft">
              <CardContent className="p-3 sm:p-4">
                <p className="text-xl sm:text-2xl font-extrabold">{s.value}</p>
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-0.5">
                  {s.label}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Navigation & Controls */}
        <div className="mt-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5 border-b border-border/60 pb-4">
          <div className="flex gap-2">
            <Button
              variant={activeTab === "teams" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("teams")}
              className={`text-xs h-8 sm:h-9 px-3.5 ${activeTab === "teams" ? "bg-navy text-white" : ""}`}
            >
              Teams ({allTeams.length})
            </Button>
            <Button
              variant={activeTab === "students" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("students")}
              className={`text-xs h-8 sm:h-9 px-3.5 ${activeTab === "students" ? "bg-navy text-white" : ""}`}
            >
              Registered Students ({allProfiles.length})
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Input
              value={query}
              placeholder="Search team, category, student..."
              onChange={(e) => setQuery(e.target.value)}
              className="bg-background h-8 sm:h-9 text-xs w-full sm:w-60"
            />
            <Button
              size="sm"
              onClick={handleExportExcel}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5 h-8 sm:h-9 px-3.5 shadow-xs w-full sm:w-auto justify-center"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Export Evaluation Sheet
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="mt-5">
          {activeTab === "teams" ? (
            <Card className="shadow-card-soft overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[680px]">
                  <thead className="bg-muted/60 text-xs uppercase font-semibold text-muted-foreground border-b border-border">
                    <tr>
                      <th className="px-4 py-3">Team Name</th>
                      <th className="px-4 py-3">Members</th>
                      <th className="px-4 py-3">SIH Compliance</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredTeams.map(({ team, members, issues }) => (
                      <tr key={team.id} className="hover:bg-muted/30 transition-colors align-top">
                        <td className="px-4 py-3 min-w-[180px]">
                          <p className="font-bold text-foreground">{team.name}</p>
                          {team.category && (
                            <span className="inline-block mt-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                              {team.category}
                            </span>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            Lead: {byId.get(team.leaderId)?.fullName ?? "—"}
                          </p>
                        </td>

                        <td className="px-4 py-3 min-w-[260px]">
                          <div className="flex flex-wrap gap-1.5">
                            {members.map((m) => (
                              <span
                                key={m.id}
                                onClick={() => setSelectedStudent({
                                  fullName: m.fullName,
                                  email: m.email ?? undefined,
                                  department: m.department,
                                  year: m.year,
                                  phone: m.phone,
                                })}
                                title="Click to view contact"
                                className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-muted px-2.5 py-0.5 text-[11px] font-medium text-foreground cursor-pointer hover:border-navy/40"
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                {m.fullName}
                                {m.department && <span className="text-muted-foreground">· {m.department}</span>}
                              </span>
                            ))}
                          </div>
                        </td>

                        <td className="px-4 py-3 min-w-[200px]">
                          {issues.length > 0 ? (
                            <ul className="space-y-0.5">
                              {issues.map((i) => (
                                <li key={i} className="text-xs text-amber-700 font-medium">
                                  ⚠ {i}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-200 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                              ✓ Valid SIH Team
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <StatusBadge status={team.status as "forming" | "submitted" | "approved" | "rejected" | "locked"} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <Card className="shadow-card-soft overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[600px]">
                  <thead className="bg-muted/60 text-xs uppercase font-semibold text-muted-foreground border-b border-border">
                    <tr>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Dept & Year</th>
                      <th className="px-4 py-3">Phone</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredStudents.map((s) => (
                      <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-semibold text-foreground">
                          <div>{s.fullName}</div>
                          <div className="text-xs text-muted-foreground font-normal">{s.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          {s.department ? `${s.department} ${s.year ? `(Yr ${s.year})` : ""}` : "—"}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{s.phone || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </main>

      <StudentContactModal student={selectedStudent} onClose={() => setSelectedStudent(null)} />
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
