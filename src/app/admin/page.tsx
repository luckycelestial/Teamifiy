"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getDashboardData, getAdminDashboardData, updateTeamStatus, rolloverAcademicYear, toggleRegistrations, updateUserRole } from "@/app/actions/portal";
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
  const [activeTab, setActiveTab] = useState<"teams" | "students">("teams");
  const [filterUnassigned, setFilterUnassigned] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentModalData | null>(null);

  async function loadData() {
    try {
      const res = await getAdminDashboardData();
      setData(res);
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

  const filteredTeams = rows.filter(({ team, members }) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      team.name.toLowerCase().includes(q) ||
      (team.category ?? "").toLowerCase().includes(q) ||
      members.some((m) => m.fullName.toLowerCase().includes(q))
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

  const stats = [
    { label: "Teams", value: allTeams.length, onClick: () => { setActiveTab("teams"); setFilterUnassigned(false); } },
    { label: "Valid teams", value: valid, onClick: () => { setActiveTab("teams"); setFilterUnassigned(false); } },
    { label: "Needs fixing", value: allTeams.length - valid, onClick: () => { setActiveTab("teams"); setFilterUnassigned(false); } },
    { label: "Students registered", value: allProfiles.length, onClick: () => { setActiveTab("students"); setFilterUnassigned(false); } },
    { label: "Without a team", value: unassignedCount, onClick: () => { setActiveTab("students"); setFilterUnassigned(true); } },
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

  function applyWorksheetStyles(worksheet: XLSX.WorkSheet) {
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");

    const headerStyle = {
      font: { name: "Cambria", sz: 12, bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "1D4ED8" } }, // Royal Blue
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: {
        top: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } },
      },
    };

    const leaderRoleStyle = {
      font: { name: "Cambria", sz: 12, bold: true, color: { rgb: "000000" } },
      fill: { fgColor: { rgb: "EAB308" } }, // Brand Yellow
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "999999" } },
        bottom: { style: "thin", color: { rgb: "999999" } },
        left: { style: "thin", color: { rgb: "999999" } },
        right: { style: "thin", color: { rgb: "999999" } },
      },
    };

    const regularStyle = {
      font: { name: "Cambria", sz: 12, color: { rgb: "000000" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "CCCCCC" } },
        bottom: { style: "thin", color: { rgb: "CCCCCC" } },
        left: { style: "thin", color: { rgb: "CCCCCC" } },
        right: { style: "thin", color: { rgb: "CCCCCC" } },
      },
    };

    const boldCenterStyle = {
      font: { name: "Cambria", sz: 12, bold: true, color: { rgb: "000000" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "CCCCCC" } },
        bottom: { style: "thin", color: { rgb: "CCCCCC" } },
        left: { style: "thin", color: { rgb: "CCCCCC" } },
        right: { style: "thin", color: { rgb: "CCCCCC" } },
      },
    };

    for (let r = range.s.r; r <= range.e.r; ++r) {
      for (let c = range.s.c; c <= range.e.c; ++c) {
        const cellAddress = XLSX.utils.encode_cell({ r, c });
        if (!worksheet[cellAddress]) continue;

        if (r === 0) {
          worksheet[cellAddress].s = headerStyle;
        } else {
          const cellValue = String(worksheet[cellAddress].v || "");
          if (cellValue === "Team Leader") {
            worksheet[cellAddress].s = leaderRoleStyle;
          } else if (c === 0 || c === 1) {
            worksheet[cellAddress].s = boldCenterStyle;
          } else {
            worksheet[cellAddress].s = regularStyle;
          }
        }
      }
    }
  }

  function handleExportExcel() {
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Official SIH 2026 Team Formation Sheet (No Roll Number column)
    const rows: (string | number)[][] = [
      [
        "S.No",
        "Team Name",
        "Members",
        "Name of the Student",
        "Year of Study",
        "Department",
        "Contact Number",
        "Email ID",
      ],
    ];

    const merges: XLSX.Range[] = [];

    filteredTeams.forEach(({ team, members }, teamIdx) => {
      const sno = teamIdx + 1;
      const teamNameUpper = team.name.toUpperCase();
      const leader = byId.get(team.leaderId);

      const nonLeaderMembers = members.filter((m) => m.id !== team.leaderId);
      const sortedMembers: (ProfileItem | undefined)[] = [
        leader || members.find((m) => m.id === team.leaderId),
        ...nonLeaderMembers,
      ];

      while (sortedMembers.length < 6) {
        sortedMembers.push(undefined);
      }

      const startRowIndex = 1 + teamIdx * 6;

      sortedMembers.slice(0, 6).forEach((m, memberIdx) => {
        const memberRole = memberIdx === 0 ? "Team Leader" : `Member ${memberIdx + 1}`;

        rows.push([
          memberIdx === 0 ? sno : "",
          memberIdx === 0 ? teamNameUpper : "",
          memberRole,
          m ? m.fullName.toUpperCase() : "-- NA --",
          m ? toRomanYear(m.year) || "-- NA --" : "-- NA --",
          m ? formatDept(m.department) : "-- NA --",
          m ? m.phone || "-- NA --" : "-- NA --",
          m ? m.email || "-- NA --" : "-- NA --",
        ]);
      });

      merges.push({
        s: { r: startRowIndex, c: 0 },
        e: { r: startRowIndex + 5, c: 0 },
      });
      merges.push({
        s: { r: startRowIndex, c: 1 },
        e: { r: startRowIndex + 5, c: 1 },
      });
    });

    const worksheet = XLSX.utils.aoa_to_sheet(rows);

    worksheet["!merges"] = merges;
    worksheet["!cols"] = [
      { wch: 8 },  // S.No
      { wch: 24 }, // Team Name
      { wch: 16 }, // Members
      { wch: 32 }, // Name of the Student
      { wch: 16 }, // Year of Study
      { wch: 16 }, // Department
      { wch: 18 }, // Contact Number
      { wch: 38 }, // Email ID
    ];

    applyWorksheetStyles(worksheet);

    XLSX.utils.book_append_sheet(workbook, worksheet, "SIH 2026 Team Formation");

    // Sheet 2: Registered Students Overview
    const studentRows: (string | number)[][] = [
      [
        "S.No",
        "Student Name",
        "Year of Study",
        "Department",
        "Gender",
        "Contact Number",
        "Email ID",
        "Assigned Team",
        "Team Status",
      ],
    ];

    filteredStudents.forEach((s, idx) => {
      const team = teamByStudentId.get(s.id);
      studentRows.push([
        idx + 1,
        s.fullName.toUpperCase(),
        toRomanYear(s.year) || "-- NA --",
        formatDept(s.department),
        s.phone || "-- NA --",
        s.email || "-- NA --",
        team ? team.name.toUpperCase() : "UNASSIGNED",
        team ? team.status.toUpperCase() : "NO TEAM",
      ]);
    });

    const studentsSheet = XLSX.utils.aoa_to_sheet(studentRows);
    studentsSheet["!cols"] = [
      { wch: 8 },  // S.No
      { wch: 32 }, // Student Name
      { wch: 16 }, // Year of Study
      { wch: 16 }, // Department
      { wch: 12 }, // Gender
      { wch: 18 }, // Contact Number
      { wch: 38 }, // Email ID
      { wch: 24 }, // Assigned Team
      { wch: 16 }, // Team Status
    ];

    applyWorksheetStyles(studentsSheet);

    XLSX.utils.book_append_sheet(workbook, studentsSheet, "Registered Students");

    XLSX.writeFile(workbook, `SIH_2026_Team_Formation_(Responses).xlsx`);
    toast.success(`Exported styled Cambria 12pt Excel sheet (.xlsx)`);
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
        {/* Portal Registration Response Control Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start sm:items-center gap-3">
            <div className={`mt-1 sm:mt-0 h-3.5 w-3.5 rounded-full shrink-0 ${data.registrationsOpen ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
            <div>
              <p className="text-xs sm:text-sm font-bold text-foreground">
                SIH 2026 Portal Status:{" "}
                <span className={data.registrationsOpen ? "text-emerald-700 font-extrabold" : "text-rose-700 font-extrabold"}>
                  {data.registrationsOpen ? "Accepting Responses (OPEN)" : "Registrations Closed (STOPPED)"}
                </span>
              </p>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                {data.registrationsOpen
                  ? "Students can register, create teams, and accept team invitations."
                  : "Student page displays: 'Registrations for SIH 2026 Internal Hackathon is Closed.'"}
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant={data.registrationsOpen ? "destructive" : "default"}
            onClick={handleToggleRegistrations}
            className={`w-full sm:w-auto text-xs font-semibold ${data.registrationsOpen ? "" : "bg-emerald-600 hover:bg-emerald-700 text-white"}`}
          >
            {data.registrationsOpen ? "Stop Receiving Responses" : "Resume Receiving Responses"}
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
          {stats.map((s) => (
            <Card
              key={s.label}
              onClick={s.onClick}
              className="shadow-card-soft cursor-pointer hover:border-navy/40 transition-colors"
            >
              <CardContent className="p-3 sm:p-4">
                <p className="text-xl sm:text-2xl font-extrabold">{s.value}</p>
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-0.5">
                  {s.label}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs & Search Navigation */}
        <div className="mt-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5 border-b border-border/60 pb-4">
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            <Button
              variant={activeTab === "teams" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setActiveTab("teams");
                setFilterUnassigned(false);
              }}
              className={`text-xs h-8 sm:h-9 px-2.5 sm:px-3.5 ${activeTab === "teams" ? "bg-navy text-white" : ""}`}
            >
              Teams ({allTeams.length})
            </Button>
            <Button
              variant={activeTab === "students" && !filterUnassigned ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setActiveTab("students");
                setFilterUnassigned(false);
              }}
              className={`text-xs h-8 sm:h-9 px-2.5 sm:px-3.5 ${activeTab === "students" && !filterUnassigned ? "bg-navy text-white" : ""}`}
            >
              All Students ({allProfiles.length})
            </Button>
            <Button
              variant={activeTab === "students" && filterUnassigned ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setActiveTab("students");
                setFilterUnassigned(true);
              }}
              className={`text-xs h-8 sm:h-9 px-2.5 sm:px-3.5 ${activeTab === "students" && filterUnassigned ? "bg-navy text-white" : ""}`}
            >
              Without Team ({unassignedCount})
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Input
              value={query}
              placeholder="Search student, department, team..."
              onChange={(e) => setQuery(e.target.value)}
              className="bg-background h-8 sm:h-9 text-xs w-full sm:w-60"
            />
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
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredTeams.map(({ team, members, issues }) => (
                        <tr key={team.id} className="hover:bg-muted/30 transition-colors align-top">
                          {/* Team name + lead */}
                          <td className="px-4 py-3 min-w-[160px]">
                            <p className="font-bold text-foreground">{team.name}</p>
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

                          {/* Action buttons */}
                          <td className="px-4 py-3 min-w-[220px]">
                            <div className="flex flex-wrap gap-1.5">
                              <Button
                                size="sm"
                                disabled={issues.length > 0}
                                onClick={() => handleSetStatus(team.id, "approved")}
                                className="h-7 px-2.5 text-xs"
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSetStatus(team.id, "rejected")}
                                className="h-7 px-2.5 text-xs"
                              >
                                Send back
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSetStatus(team.id, "locked")}
                                className="h-7 px-2.5 text-xs"
                              >
                                Lock
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleSetStatus(team.id, "forming")}
                                className="h-7 px-2.5 text-xs"
                              >
                                Reopen
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ) : (
            /* Registered Students Table View */
            <Card className="shadow-card-soft overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/60 text-xs uppercase font-semibold text-muted-foreground border-b border-border">
                    <tr>
                      <th className="px-4 py-3">Student Name</th>
                      <th className="px-4 py-3">Dept & Year</th>
                      <th className="px-4 py-3">Gender</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3">Team Status</th>
                      <th className="px-4 py-3">Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                          No registered students match this filter.
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
                              {s.department ? `${s.department} ${s.year ? `(Yr ${s.year})` : ""}` : "—"}
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
                            <td className="px-4 py-3">
                              <select
                                value={(s as ProfileItem).role || "student"}
                                onChange={(e) => handleRoleChange(s.id, e.target.value as "admin" | "evaluator" | "student")}
                                className="h-7 text-xs rounded border border-border bg-background px-2 font-semibold text-foreground cursor-pointer"
                              >
                                <option value="student">Student</option>
                                <option value="evaluator">Evaluator</option>
                                <option value="admin">Admin</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </main>

      <StudentContactModal
        student={selectedStudent}
        onClose={() => setSelectedStudent(null)}
      />
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
