"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getDashboardData, getAdminDashboardData, updateTeamStatus, rolloverAcademicYear, toggleRegistrations, updateUserRole, addFacultyProfile, getAllAssignments, assignTeamToEvaluator, unassignTeam, autoAssignTeams, getEvaluations, type EvaluationRecord, type EvaluatorAssignment } from "@/app/actions/portal";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { StatusBadge } from "@/components/portal/StatusBadge";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { FileSpreadsheet, UserCheck, Shuffle, X, UserPlus } from "lucide-react";
import { exportAdminTeamFormationWorkbook } from "@/lib/excel-export";

import { toRomanYear } from "@/lib/utils";
import { StudentContactModal, StudentModalData } from "@/components/portal/StudentContactModal";
import { AdminTeamDetailsModal, AdminTeamDetailsData } from "@/components/portal/AdminTeamDetailsModal";

const TEAM_SIZE = 6;

type ProfileItem = {
  id: string;
  fullName: string;
  email: string | null;
  department: string | null;
  year: number | null;
  phone: string | null;
  role: string;
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

function AdminContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [data, setData] = useState<Awaited<ReturnType<typeof getAdminDashboardData>> | null>(null);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"teams" | "students" | "assignments">("teams");
  const [filterUnassigned, setFilterUnassigned] = useState(false);
  const [assignments, setAssignments] = useState<EvaluatorAssignment[]>([]);
  const [evaluations, setEvaluations] = useState<Record<string, EvaluationRecord>>({});
  const [assigningTeamId, setAssigningTeamId] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentModalData | null>(null);
  const [selectedTeamDetails, setSelectedTeamDetails] = useState<AdminTeamDetailsData | null>(null);
  const [isAddFacultyOpen, setIsAddFacultyOpen] = useState(false);

  async function loadData() {
    try {
      const [res, assignRes, evalRes] = await Promise.all([
        getAdminDashboardData(),
        getAllAssignments(),
        getEvaluations(),
      ]);
      setData(res);
      setAssignments(assignRes);
      setEvaluations(evalRes);
    } catch (e) {
      console.error(e);
      toast.error("Admin authorization failed.");
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
      const u = { id: session.user.id, email: session.user.email ?? "" };
      setUser(u);
      loadData();
    });
  }, [router]);

  if (loading || !user) {
    return <p className="p-8 text-sm text-muted-foreground">Checking access…</p>;
  }

  function openTeamDetails(team: any, members: ProfileItem[]) {
    const assignment = assignments.find((a) => a.teamId === team.id);
    const evalRec = evaluations[team.id];
    const evalProfile = assignment ? byId.get(assignment.evaluatorId) : null;
    setSelectedTeamDetails({
      team: {
        id: team.id,
        name: team.name,
        psNumber: team.psNumber,
        theme: team.theme,
        problemStatement: team.problemStatement,
        category: team.category,
        leaderId: team.leaderId,
        status: team.status,
      },
      members: members.map((m) => ({
        id: m.id,
        fullName: m.fullName,
        email: m.email,
        department: m.department,
        year: m.year,
        phone: m.phone,
        isLeader: m.id === team.leaderId,
      })),
      assignment: assignment ? {
        evaluatorId: assignment.evaluatorId,
        evaluatorName: evalProfile?.fullName || "Assigned Faculty",
        evaluatorEmail: evalProfile?.email || undefined,
        evaluatorDept: evalProfile?.department || undefined,
      } : null,
      evaluation: evalRec || null,
    });
  }

  if (!data?.isAdmin) {
    return (
      <div className="min-h-screen bg-surface-muted">
        <PortalHeader isAdmin={false} email={user.email} />
        <main className="mx-auto max-w-3xl px-5 py-16 text-center">
          <h1 className="text-2xl font-extrabold">Admin access required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This console is limited to Innovation Studio coordinators.
          </p>
        </main>
      </div>
    );
  }

  const allProfiles = data.profiles;
  const byId = new Map(allProfiles.map((p) => [p.id, p]));
  const allMemberships = data.memberships;
  const allTeams = data.teams;
  const teamByStudentId = new Map(
    allMemberships.map((m) => {
      const t = allTeams.find((tm) => tm.id === m.teamId);
      return [m.userId, t];
    })
  );

  const rows = allTeams.map((team) => {
    const members = allMemberships
      .filter((m) => m.teamId === team.id)
      .map((m) => byId.get(m.userId))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
    return { team, members, issues: teamIssues(members) };
  });

  const assignmentByTeam = new Map(assignments.map((a) => [a.teamId, a]));

  const filteredTeams = rows.filter(({ team, members }) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const assignment = assignmentByTeam.get(team.id);
    const assignedEval = assignment ? byId.get(assignment.evaluatorId) : null;
    const leader = byId.get(team.leaderId);

    return (
      team.name.toLowerCase().includes(q) ||
      (team.category ?? "").toLowerCase().includes(q) ||
      (team.psNumber ?? "").toLowerCase().includes(q) ||
      (team.theme ?? "").toLowerCase().includes(q) ||
      (team.problemStatement ?? "").toLowerCase().includes(q) ||
      Boolean(leader && (
        leader.fullName.toLowerCase().includes(q) ||
        (leader.email ?? "").toLowerCase().includes(q) ||
        (leader.department ?? "").toLowerCase().includes(q)
      )) ||
      Boolean(assignedEval && (
        assignedEval.fullName.toLowerCase().includes(q) ||
        (assignedEval.email ?? "").toLowerCase().includes(q)
      )) ||
      members.some((m) =>
        m.fullName.toLowerCase().includes(q) ||
        (m.email ?? "").toLowerCase().includes(q) ||
        (m.department ?? "").toLowerCase().includes(q)
      )
    );
  });

  const filteredStudents = allProfiles.filter((p) => {
    const isUnassigned = !allMemberships.some((m) => m.userId === p.id);
    if (filterUnassigned && !isUnassigned) return false;

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
  const unassignedCount = allProfiles.filter(
    (p) => !allMemberships.some((m) => m.userId === p.id),
  ).length;
  const evaluatorProfiles = allProfiles.filter(
    (p) => (p as ProfileItem).role === "evaluator",
  );
  const evaluatorCount = evaluatorProfiles.length;
  const assignedCount = assignments.length;
  const unassignedTeamCount = allTeams.length - assignedCount;
  const shortlistedCount = Object.values(evaluations).filter((e) => e.verdict === "shortlisted").length;

  const stats = activeTab === "assignments"
    ? [
        {
          label: "Valid teams",
          value: valid,
          active: false,
          color: "",
          onClick: () => { setActiveTab("teams"); setFilterUnassigned(false); },
        },
        {
          label: "Evaluators",
          value: evaluatorCount,
          active: true,
          color: "",
          onClick: () => { setActiveTab("assignments"); setFilterUnassigned(false); },
        },
        {
          label: "Teams Assigned",
          value: assignedCount,
          active: false,
          color: "text-emerald-600",
          onClick: () => { setActiveTab("assignments"); setFilterUnassigned(false); },
        },
        {
          label: "Unassigned Teams",
          value: unassignedTeamCount,
          active: false,
          color: "text-amber-600",
          onClick: () => { setActiveTab("assignments"); setFilterUnassigned(false); },
        },
        {
          label: "Shortlisted",
          value: shortlistedCount,
          active: false,
          color: "text-primary",
          onClick: () => { setActiveTab("assignments"); setFilterUnassigned(false); },
        },
      ]
    : [
        {
          label: "Valid teams",
          value: valid,
          active: activeTab === "teams",
          color: "",
          onClick: () => { setActiveTab("teams"); setFilterUnassigned(false); },
        },
        {
          label: "Students registered",
          value: allProfiles.length,
          active: activeTab === "students" && !filterUnassigned,
          color: "",
          onClick: () => { setActiveTab("students"); setFilterUnassigned(false); },
        },
        {
          label: "Faculties",
          value: unassignedCount,
          active: activeTab === "students" && filterUnassigned,
          color: "",
          onClick: () => { setActiveTab("students"); setFilterUnassigned(true); },
        },
        {
          label: "Evaluators",
          value: evaluatorCount,
          active: false,
          color: "",
          onClick: () => { setActiveTab("assignments"); setFilterUnassigned(false); },
        },
      ];

  async function handleSetStatus(teamId: string, status: "approved" | "rejected" | "locked" | "forming") {
    try {
      await updateTeamStatus(teamId, status);
      toast.success(`Team ${status}.`);
      loadData();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update team status");
    }
  }

  async function handleRoleChange(targetUserId: string, newRole: "admin" | "evaluator" | "student") {
    try {
      await updateUserRole(targetUserId, newRole);
      toast.success(`User role updated to ${newRole}.`);
      loadData();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update user role");
    }
  }

  async function handleAssign(teamId: string, evaluatorId: string) {
    setAssigningTeamId(teamId);
    try {
      await assignTeamToEvaluator(teamId, evaluatorId);
      toast.success("Team assigned successfully.");
      const updated = await getAllAssignments();
      setAssignments(updated);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Assignment failed");
    } finally {
      setAssigningTeamId(null);
    }
  }

  async function handleUnassign(teamId: string) {
    try {
      await unassignTeam(teamId);
      toast.success("Assignment removed.");
      const updated = await getAllAssignments();
      setAssignments(updated);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Unassign failed");
    }
  }

  async function handleAutoAssign() {
    try {
      const result = await autoAssignTeams();
      toast.success(`Auto-assigned ${result.assigned} teams across evaluators.`);
      const updated = await getAllAssignments();
      setAssignments(updated);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Auto-assign failed");
    }
  }

  function extractRollNumber(email: string | null): string {
    if (!email) return "-- NA --";
    const handle = email.split("@")[0] || "";
    const match = handle.match(/([0-9]{2}[a-z]{2,4}[0-9]{3,4})/i);
    if (match) {
      return match[1]!.toUpperCase();
    }
    return "-- NA --";
  }

  function formatDept(dept: string | null): string {
    if (!dept) return "-- NA --";
    const upper = dept.trim().toUpperCase();
    if (upper === "AIDS" || upper === "AI&DS" || upper === "AI & DS") return "AI & DS";
    if (upper === "AIML" || upper === "AI&ML" || upper === "AI & ML") return "AI & ML";
    return upper;
  }

  async function handleExportExcel() {
    try {
      await exportAdminTeamFormationWorkbook(
        filteredTeams,
        filteredStudents,
        teamByStudentId,
        byId
      );
      toast.success("Exported styled Cambria 12pt Excel sheet (.xlsx)");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Failed to export Excel report.");
    }
  }

  async function handleToggleRegistrations() {
    if (!data) return;
    const newStatus = !data.registrationsOpen;
    try {
      await toggleRegistrations(newStatus);
      toast.success(newStatus ? "Portal is now accepting responses." : "Portal responses have been stopped.");
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update portal status.");
    }
  }

  return (
    <div className="min-h-screen bg-surface-muted">
      <PortalHeader isAdmin email={user.email} />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-5 sm:py-8">

        {/* Stats Grid */}
        <div className={`mt-5 grid gap-2.5 sm:gap-3.5 ${activeTab === "assignments" ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" : "grid-cols-2 sm:grid-cols-4"}`}>
          {stats.map((s) => (
            <Card
              key={s.label}
              onClick={s.onClick}
              className={`shadow-card-soft cursor-pointer transition-all border-2 ${
                s.active
                  ? "border-navy bg-navy/5 shadow-sm ring-1 ring-navy/20"
                  : "border-border hover:border-navy/30 hover:bg-muted/30"
              }`}
            >
              <CardContent className="p-3 sm:p-4">
                <p className={`text-xl sm:text-2xl font-extrabold ${s.color ? s.color : s.active ? "text-navy" : "text-foreground"}`}>
                  {s.value}
                </p>
                <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wide text-muted-foreground mt-0.5">
                  {s.label}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search & Export Toolbar */}
        <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Viewing:{" "}
              <span className="text-foreground font-extrabold">
                {activeTab === "teams"
                  ? `Teams (${allTeams.length})`
                  : activeTab === "students" && !filterUnassigned
                  ? `All Students (${allProfiles.length})`
                  : activeTab === "students" && filterUnassigned
                  ? `Faculties / Without Team (${unassignedCount})`
                  : `Evaluator Assignments (${allTeams.length})`}
              </span>
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Input
              value={query}
              placeholder="Search student, department, team..."
              onChange={(e) => setQuery(e.target.value)}
              className="bg-background h-8 sm:h-9 text-xs w-full sm:w-64"
            />
            {activeTab === "students" && filterUnassigned && (
              <Button
                size="sm"
                onClick={() => setIsAddFacultyOpen(true)}
                className="bg-navy hover:bg-navy/90 text-white font-semibold text-xs gap-1.5 h-8 sm:h-9 px-3.5 shadow-xs w-full sm:w-auto justify-center"
              >
                <UserPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Add Faculty
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleExportExcel}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5 h-8 sm:h-9 px-3.5 shadow-xs w-full sm:w-auto justify-center"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Export Excel (.xlsx)
            </Button>
          </div>
        </div>

        {/* Content Views */}
        <div className="mt-5">
          {activeTab === "teams" ? (
            <Card className="shadow-card-soft overflow-hidden">
              {filteredTeams.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm font-medium text-muted-foreground">No teams created yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm min-w-[680px]">
                    <thead className="bg-muted/60 text-xs uppercase font-semibold text-muted-foreground border-b border-border">
                      <tr>
                        <th className="px-4 py-3">Team</th>
                        <th className="px-4 py-3">Members</th>
                        <th className="px-4 py-3">Validity</th>
                        <th className="px-4 py-3">Status</th>

                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredTeams.map(({ team, members, issues }) => (
                        <tr key={team.id} className="hover:bg-muted/30 transition-colors align-top">
                          {/* Team name + lead */}
                          <td className="px-4 py-3 min-w-[160px]">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                onClick={() => openTeamDetails(team, members)}
                                className="font-bold text-foreground hover:text-primary hover:underline cursor-pointer transition-colors"
                                title="Click to view full team details, score & evaluator remarks"
                              >
                                {team.name}
                              </span>
                              {team.category && (
                                <span className="text-[11px] font-normal text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                                  {team.category}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Lead: {byId.get(team.leaderId)?.fullName ?? "—"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {members.length}/{TEAM_SIZE} members
                            </p>
                          </td>

                          {/* Member chips */}
                          <td className="px-4 py-3 min-w-[260px]">
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
                                    title="Team Leader — Click to view contact details"
                                    className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-0.5 text-[11px] font-bold text-amber-950 dark:text-amber-100 cursor-pointer hover:border-amber-400 hover:bg-amber-100/70 transition-all shadow-xs ring-1 ring-amber-400/20"
                                  >
                                    <span className="inline-flex items-center justify-center rounded-full bg-amber-500 text-[9px] font-black text-white px-1.5 py-0.2 tracking-wider uppercase">
                                      LEAD
                                    </span>
                                    <span>{m.fullName}</span>
                                    {m.department && (
                                      <span className="text-amber-800/80 dark:text-amber-300/80 font-medium">· {m.department}</span>
                                    )}
                                    {m.year && (
                                      <span className="text-amber-800/80 dark:text-amber-300/80 font-medium">· {toRomanYear(m.year)}</span>
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
                                    title="Click to view contact details"
                                    className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-muted px-2.5 py-0.5 text-[11px] font-medium text-foreground cursor-pointer hover:border-navy/40 hover:bg-navy/5 transition-all shadow-2xs"
                                  >
                                    <span className="h-1.5 w-1.5 rounded-full flex-shrink-0 bg-blue-500" />
                                    {m.fullName}
                                    {m.department && (
                                      <span className="text-muted-foreground">· {m.department}</span>
                                    )}
                                    {m.year && (
                                      <span className="text-muted-foreground">· {toRomanYear(m.year)}</span>
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                          </td>

                          {/* Validity */}
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

                          {/* Status badge */}
                          <td className="px-4 py-3">
                            <StatusBadge status={team.status as "forming" | "submitted" | "approved" | "rejected" | "locked"} />
                          </td>


                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ) : activeTab === "students" ? (
            /* Registered Students / Faculties Table View */
            <Card className="shadow-card-soft overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/60 text-xs uppercase font-semibold text-muted-foreground border-b border-border">
                    <tr>
                      <th className="px-4 py-3">{filterUnassigned ? "Faculty / Staff Name" : "Student Name"}</th>
                      <th className="px-4 py-3">{filterUnassigned ? "Dept / Designation" : "Dept & Year"}</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3">Team Status</th>
                      {filterUnassigned && <th className="px-4 py-3">Role</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={filterUnassigned ? 5 : 4} className="px-4 py-8 text-center text-muted-foreground">
                          {filterUnassigned ? "No faculties or unassigned profiles match this filter." : "No registered students match this filter."}
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((s) => {
                        const team = teamByStudentId.get(s.id);
                        return (
                          <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-semibold text-foreground">
                              <div>{s.fullName}</div>
                              <div className="text-xs text-muted-foreground font-normal">{s.email}</div>
                            </td>
                            <td className="px-4 py-3">
                              {s.department ? `${s.department}${s.year ? ` · ${toRomanYear(s.year)}` : ""}` : "—"}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs">{s.phone || "—"}</td>
                            <td className="px-4 py-3">
                              {team ? (
                                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                                  In Team: {team.name}
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                                  Unassigned
                                </span>
                              )}
                            </td>
                            {filterUnassigned && (
                              <td className="px-4 py-3">
                                <select
                                  value={(s as ProfileItem).role || "student"}
                                  onChange={(e) => handleRoleChange(s.id, e.target.value as "admin" | "evaluator" | "student")}
                                  className="h-7 text-xs rounded border border-border bg-background px-2 font-semibold text-foreground cursor-pointer"
                                >
                                  <option value="student">Student / Staff</option>
                                  <option value="evaluator">Evaluator</option>
                                  <option value="admin">Admin</option>
                                </select>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}

          {/* Evaluator Assignments Tab */}
          {activeTab === "assignments" && (() => {
            const evaluatorProfiles = allProfiles.filter((p) => (p as ProfileItem).role === "evaluator");
            const assignmentByTeam = new Map(assignments.map((a) => [a.teamId, a]));

            return (
              <div className="space-y-4">
                {/* Teams assignment table */}
                <Card className="shadow-card-soft overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm min-w-[700px]">
                      <thead className="bg-muted/60 text-xs uppercase font-semibold text-muted-foreground border-b border-border">
                        <tr>
                          <th className="px-4 py-3">Team Name</th>
                          <th className="px-4 py-3">PS Number</th>
                          <th className="px-4 py-3">Team Lead</th>
                          <th className="px-4 py-3">Dept &amp; Year</th>
                          <th className="px-4 py-3">Assigned Evaluator</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredTeams.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                              No teams match this search query.
                            </td>
                          </tr>
                        ) : (
                          filteredTeams.map(({ team, members }) => {
                            const assignment = assignmentByTeam.get(team.id);
                            const leader = byId.get(team.leaderId);
                            return (
                              <tr key={team.id} className="hover:bg-muted/30 transition-colors">

                                {/* Team Name */}
                                <td className="px-4 py-3 font-semibold text-foreground">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                      onClick={() => openTeamDetails(team, members)}
                                      className="hover:text-primary hover:underline cursor-pointer transition-colors"
                                      title="Click to view full team details, score & evaluator remarks"
                                    >
                                      {team.name}
                                    </span>
                                    {team.category && (
                                      <span className="text-[11px] font-normal text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                                        {team.category}
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* PS Number */}
                                <td className="px-4 py-3">
                                  {team.psNumber ? (
                                    <span className="inline-flex font-mono text-xs font-bold text-navy bg-navy/10 px-2 py-0.5 rounded border border-navy/20 uppercase">
                                      {team.psNumber}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground/50 italic">—</span>
                                  )}
                                </td>

                                {/* Team Lead pill (opens contact/details modal) */}
                                <td className="px-4 py-3">
                                  {leader ? (
                                    <span
                                      onClick={() => setSelectedStudent({
                                        fullName: leader.fullName,
                                        email: leader.email ?? undefined,
                                        department: leader.department,
                                        year: leader.year,
                                        phone: leader.phone,
                                        isLeader: true,
                                      })}
                                      title="Team Leader — Click to view contact details"
                                      className="inline-flex items-center rounded-full bg-emerald-100 hover:bg-emerald-200 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 cursor-pointer transition-colors shadow-2xs"
                                    >
                                      {leader.fullName}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground italic">—</span>
                                  )}
                                </td>

                                {/* Dept & Year */}
                                <td className="px-4 py-3 text-sm text-foreground">
                                  {leader ? (
                                    <>
                                      <span className="font-medium">{formatDept(leader.department)}</span>
                                      {leader.year && (
                                        <span className="text-muted-foreground"> · {toRomanYear(leader.year)}</span>
                                      )}
                                    </>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>

                                {/* Assigned Evaluator dropdown */}
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <select
                                      value={assignment?.evaluatorId ?? ""}
                                      disabled={assigningTeamId === team.id}
                                      onChange={(e) => {
                                        if (e.target.value) handleAssign(team.id, e.target.value);
                                        else handleUnassign(team.id);
                                      }}
                                      className="h-7 text-xs rounded border border-border bg-background px-2 text-foreground cursor-pointer min-w-[170px]"
                                    >
                                      <option value="">— Not Assigned —</option>
                                      {evaluatorProfiles.map((ev) => (
                                        <option key={ev.id} value={ev.id}>{ev.fullName}</option>
                                      ))}
                                    </select>
                                    {assignment && (
                                      <button
                                        onClick={() => handleUnassign(team.id)}
                                        className="h-5 w-5 rounded-full bg-rose-100 text-rose-600 hover:bg-rose-200 flex items-center justify-center transition-colors shrink-0"
                                        title="Remove assignment"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    )}
                                  </div>
                                </td>

                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            );
          })()}
        </div>
      </main>

      <StudentContactModal
        student={selectedStudent}
        onClose={() => setSelectedStudent(null)}
      />

      <AdminTeamDetailsModal
        data={selectedTeamDetails}
        onClose={() => setSelectedTeamDetails(null)}
        onSelectStudent={(student) => setSelectedStudent(student)}
      />

      <AddFacultyModal
        isOpen={isAddFacultyOpen}
        onClose={() => setIsAddFacultyOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
}

function AddFacultyModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"evaluator" | "admin" | "student">("evaluator");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast.error("Please provide both full name and institutional email.");
      return;
    }
    setIsSubmitting(true);
    try {
      await addFacultyProfile({
        fullName: name.trim(),
        email: email.trim(),
        department: department.trim(),
        phone: phone.trim(),
        role,
      });
      toast.success("Faculty member registered successfully!");
      setName("");
      setEmail("");
      setDepartment("");
      setPhone("");
      setRole("evaluator");
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add faculty.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-background rounded-2xl border border-border shadow-2xl overflow-hidden p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-navy/10 text-navy flex items-center justify-center">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-foreground">Add New Faculty</h3>
              <p className="text-xs text-muted-foreground">Register faculty or evaluator account</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 pt-1">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dr. Ramesh Kumar"
              required
              className="text-xs h-9 bg-background"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Institutional Email <span className="text-rose-500">*</span>
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. ramesh.k@sece.ac.in"
              required
              className="text-xs h-9 bg-background"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Department / Cell
              </label>
              <Input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. CSE / Innovation"
                className="text-xs h-9 bg-background"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Contact Phone
              </label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                className="text-xs h-9 bg-background"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Assign Role <span className="text-rose-500">*</span>
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "evaluator" | "admin" | "student")}
              className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs font-semibold text-foreground cursor-pointer"
            >
              <option value="evaluator">Evaluator (can review &amp; score assigned teams)</option>
              <option value="admin">Admin (full console access)</option>
              <option value="student">Faculty / Staff</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border mt-4">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting} className="text-xs">
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting || !name.trim() || !email.trim()} className="bg-navy hover:bg-navy/90 text-white text-xs font-bold px-4">
              {isSubmitting ? "Adding…" : "Add Faculty"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted-foreground">Checking access…</p>}>
      <AdminContent />
    </Suspense>
  );
}
