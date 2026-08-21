/**
 * ARCHIVED: Evaluator Assignments Tab — Admin Console
 *
 * Archived from: src/app/admin/page.tsx
 * Archived on:   2026-08-21
 *
 * To restore:
 *  1. In admin/page.tsx imports — add back:
 *       import { ..., getAllAssignments, assignTeamToEvaluator, unassignTeam, autoAssignTeams,
 *                getEvaluations, type EvaluationRecord, type EvaluatorAssignment } from "@/app/actions/portal";
 *       import { ..., UserCheck, Shuffle, X } from "lucide-react";
 *
 *  2. In AdminContent state — add back:
 *       const [activeTab, setActiveTab] = useState<"teams" | "students" | "assignments">("teams");
 *       const [assignments, setAssignments] = useState<EvaluatorAssignment[]>([]);
 *       const [evaluations, setEvaluations] = useState<Record<string, EvaluationRecord>>({});
 *       const [assigningTeamId, setAssigningTeamId] = useState<string | null>(null);
 *
 *  3. In loadData() — add back parallel fetches:
 *       const [res, assignRes, evalRes] = await Promise.all([
 *         getAdminDashboardData(),
 *         getAllAssignments(),
 *         getEvaluations(),
 *       ]);
 *       setAssignments(assignRes);
 *       setEvaluations(evalRes);
 *
 *  4. Add back handler functions (handleAssign, handleUnassign, handleAutoAssign).
 *
 *  5. Add tab button in nav bar:
 *       <Button variant={activeTab === "assignments" ? "default" : "outline"} size="sm"
 *         onClick={() => { setActiveTab("assignments"); setFilterUnassigned(false); }}
 *         className={`... ${activeTab === "assignments" ? "bg-navy text-white" : ""}`}>
 *         <UserCheck className="h-3.5 w-3.5" /> Evaluator Assignments
 *       </Button>
 *
 *  6. Paste JSX block below into content area after students table.
 */

// ─── Handler Functions ────────────────────────────────────────────────────────
// (paste inside AdminContent function body)

/*
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
*/

// ─── JSX Tab Content Block ────────────────────────────────────────────────────
// (paste after the students table block, inside {/* Content Views */} div)

/*
{activeTab === "assignments" && (() => {
  const evaluatorProfiles = allProfiles.filter((p) => (p as ProfileItem).role === "evaluator");
  const assignmentByTeam = new Map(assignments.map((a) => [a.teamId, a]));
  const assignedCount = assignments.length;
  const unassignedTeamCount = allTeams.length - assignedCount;
  const shortlistedCount = Object.values(evaluations).filter((e) => e.verdict === "shortlisted").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="shadow-card-soft">
          <CardContent className="p-3 sm:p-4">
            <p className="text-xl font-extrabold">{evaluatorProfiles.length}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mt-0.5">Evaluators</p>
          </CardContent>
        </Card>
        <Card className="shadow-card-soft">
          <CardContent className="p-3 sm:p-4">
            <p className="text-xl font-extrabold text-emerald-600">{assignedCount}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mt-0.5">Teams Assigned</p>
          </CardContent>
        </Card>
        <Card className="shadow-card-soft">
          <CardContent className="p-3 sm:p-4">
            <p className="text-xl font-extrabold text-amber-600">{unassignedTeamCount}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mt-0.5">Unassigned Teams</p>
          </CardContent>
        </Card>
        <Card className="shadow-card-soft">
          <CardContent className="p-3 sm:p-4">
            <p className="text-xl font-extrabold text-primary">{shortlistedCount}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mt-0.5">Shortlisted</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3">
        <div>
          <p className="text-sm font-bold text-foreground">Auto-Distribute Unassigned Teams</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Round-robin: {unassignedTeamCount} unassigned teams to {evaluatorProfiles.length} evaluators
          </p>
        </div>
        <Button size="sm" onClick={handleAutoAssign}
          disabled={unassignedTeamCount === 0 || evaluatorProfiles.length === 0}
          className="bg-navy hover:bg-navy/90 text-white text-xs font-bold gap-1.5 px-4 shadow-xs">
          <Shuffle className="h-3.5 w-3.5" />
          Auto-Assign
        </Button>
      </div>

      <Card className="shadow-card-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[600px]">
            <thead className="bg-muted/60 text-xs uppercase font-semibold text-muted-foreground border-b border-border">
              <tr>
                <th className="px-4 py-3">Team Name</th>
                <th className="px-4 py-3">Team Lead</th>
                <th className="px-4 py-3">Dept & Year</th>
                <th className="px-4 py-3">Assigned Evaluator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {allTeams.map((team) => {
                const assignment = assignmentByTeam.get(team.id);
                const leader = byId.get(team.leaderId);
                return (
                  <tr key={team.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-bold text-foreground">{team.name}</span>
                      {team.category && (
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase">
                          {team.category}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {leader ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-navy/10 border border-navy/20 px-2.5 py-1 text-xs font-semibold text-navy">
                          <span className="h-1.5 w-1.5 rounded-full bg-navy shrink-0" />
                          {leader.fullName}
                        </span>
                      ) : <span className="text-xs text-muted-foreground italic">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {leader ? (
                        <>
                          <span className="font-medium">{formatDept(leader.department)}</span>
                          {leader.year && <span className="text-muted-foreground"> · {toRomanYear(leader.year)}</span>}
                        </>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <select value={assignment?.evaluatorId ?? ""} disabled={assigningTeamId === team.id}
                          onChange={(e) => { if (e.target.value) handleAssign(team.id, e.target.value); else handleUnassign(team.id); }}
                          className="h-7 text-xs rounded border border-border bg-background px-2 text-foreground cursor-pointer min-w-[170px]">
                          <option value="">— Not Assigned —</option>
                          {evaluatorProfiles.map((ev) => <option key={ev.id} value={ev.id}>{ev.fullName}</option>)}
                        </select>
                        {assignment && (
                          <button onClick={() => handleUnassign(team.id)}
                            className="h-5 w-5 rounded-full bg-rose-100 text-rose-600 hover:bg-rose-200 flex items-center justify-center transition-colors shrink-0"
                            title="Remove assignment">
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
})()}
*/
