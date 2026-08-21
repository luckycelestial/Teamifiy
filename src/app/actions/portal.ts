"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import { sanitizeText, sanitizeEmail, sanitizeAlphanumericCode, sanitizePhone } from "@/lib/sanitize";

const TEAM_SIZE = 6;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://utmdlyfudvztbnwgnaye.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_ER1byfGlz5J9GT7BrZ9Gtw_bbccrCHO";
const supabaseFast = createClient(supabaseUrl, supabaseKey);

type ProfileData = {
  id: string;
  email: string;
  fullName: string;
  department: string | null;
  year: number | null;
  phone: string | null;
};

// ─── Read helpers ─────────────────────────────────────────────────────────────

export async function getProfile(userId: string) {
  try {
    const { data } = await supabaseFast.from("profiles").select("*").eq("id", userId).limit(1);
    if (data && data.length > 0) {
      const p = data[0]!;
      return {
        id: p.id,
        email: p.email,
        fullName: p.full_name,
        department: p.department,
        year: p.year,
        phone: p.phone,
        role: p.role,
      };
    }
  } catch (e) {
    console.warn("getProfile HTTPS fallback error:", e);
  }
  return await prisma.profile.findUnique({ where: { id: userId } });
}

export async function getUserRole(userId: string, email?: string): Promise<"admin" | "evaluator" | "student"> {
  const cleanEmail = (email || "").trim().toLowerCase().replace(/\s+/g, "");

  if (cleanEmail) {
    const { data: pEmail } = await supabaseFast.from("profiles").select("role").eq("email", cleanEmail).limit(1);
    if (pEmail && pEmail.length > 0 && pEmail[0]?.role) {
      return pEmail[0].role.toLowerCase() as "admin" | "evaluator" | "student";
    }
  }

  if (userId) {
    const { data: pId } = await supabaseFast.from("profiles").select("role").eq("id", userId).limit(1);
    if (pId && pId.length > 0 && pId[0]?.role) {
      return pId[0].role.toLowerCase() as "admin" | "evaluator" | "student";
    }
  }

  return "student";
}

export async function checkIsAdmin(userId: string, email?: string) {
  const role = await getUserRole(userId, email);
  return role === "admin";
}

export async function checkIsEvaluator(userId: string, email?: string) {
  const role = await getUserRole(userId, email);
  return role === "evaluator" || role === "admin";
}

export async function checkIsTeamLeader(userId: string, email?: string) {
  const role = await getUserRole(userId, email);
  if (role === "admin" || role === "evaluator") return true;

  const targetIds = Array.from(new Set([userId, email].filter(Boolean))) as string[];

  const { data } = await supabaseFast
    .from("team_members")
    .select("id")
    .in("user_id", targetIds)
    .eq("is_leader", true)
    .limit(1);

  return Boolean(data && data.length > 0);
}

export async function updateUserRole(targetUserId: string, newRole: "admin" | "evaluator" | "student") {
  const session = await requireAuth();
  const isAdmin = await checkIsAdmin(session.id, session.email);
  if (!isAdmin) {
    throw new Error("Unauthorized: admin access required to update user roles.");
  }

  await supabaseFast.from("profiles").update({ role: newRole }).eq("id", targetUserId);

  try {
    await prisma.profile.update({
      where: { id: targetUserId },
      data: { role: newRole },
    });
  } catch (err) {
    console.warn("updateUserRole prisma fallback:", err);
  }

  return { success: true };
}

export async function addFacultyProfile(data: {
  fullName: string;
  email: string;
  department?: string;
  phone?: string;
  role?: "evaluator" | "admin" | "student";
}) {
  const session = await requireAuth();
  const isAdmin = await checkIsAdmin(session.id, session.email);
  if (!isAdmin) {
    throw new Error("Unauthorized: admin access required to add faculty.");
  }

  const cleanEmail = sanitizeEmail(data.email);
  const cleanName = sanitizeText(data.fullName, 100);
  if (!cleanEmail || !cleanName) {
    throw new Error("Valid full name and institutional email are required.");
  }

  const { data: existing } = await supabaseFast
    .from("profiles")
    .select("id, email")
    .eq("email", cleanEmail)
    .maybeSingle();

  if (existing) {
    throw new Error(`A profile with email ${cleanEmail} already exists.`);
  }

  const newId = `faculty_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const role = data.role === "admin" || data.role === "student" ? data.role : "evaluator";

  const { error } = await supabaseFast.from("profiles").insert({
    id: newId,
    full_name: cleanName,
    email: cleanEmail,
    department: sanitizeText(data.department, 100) || null,
    phone: sanitizePhone(data.phone),
    role: role,
    year: null,
  });

  if (error) throw new Error(`Failed to create faculty: ${error.message}`);
  return { success: true, id: newId };
}

// ─── Profile mutations ────────────────────────────────────────────────────────

export async function updateProfile(userId: string, data: Partial<ProfileData>) {
  const session = await requireAuth();
  if (session.id !== userId) {
    throw new Error("Unauthorized: you can only update your own profile.");
  }

  const sanitizedFullName = sanitizeText(data.fullName, 100);
  const sanitizedDept = sanitizeText(data.department, 100) || null;
  const sanitizedPhone = sanitizePhone(data.phone);

  await supabaseFast
    .from("profiles")
    .update({
      full_name: sanitizedFullName,
      department: sanitizedDept,
      year: data.year,
      phone: sanitizedPhone,
    })
    .eq("id", userId);

  try {
    return await prisma.profile.update({
      where: { id: userId },
      data: {
        fullName: sanitizedFullName,
        department: sanitizedDept,
        year: data.year,
        phone: sanitizedPhone,
      },
    });
  } catch (err) {
    console.warn("updateProfile prisma fallback:", err);
  }

  return { id: userId, fullName: sanitizedFullName, department: sanitizedDept, phone: sanitizedPhone, year: data.year };
}

export async function ensureProfile(userId: string, email?: string) {
  const cleanEmail = sanitizeEmail(email || "");
  const cleanUserId = sanitizeAlphanumericCode(userId, 100);

  // Safe parameterized queries preventing PostgREST string injection
  let existingProfile = null;
  if (cleanUserId) {
    const { data } = await supabaseFast.from("profiles").select("*").eq("id", cleanUserId).limit(1);
    if (data && data.length > 0) existingProfile = data[0];
  }
  if (!existingProfile && cleanEmail) {
    const { data } = await supabaseFast.from("profiles").select("*").eq("email", cleanEmail).limit(1);
    if (data && data.length > 0) existingProfile = data[0];
  }

  if (existingProfile) {
    const p = existingProfile;
    return {
      id: p.id,
      email: p.email,
      fullName: p.full_name,
      department: p.department,
      year: p.year,
      phone: p.phone,
      role: p.role || "student",
    };
  }

  const newProfile = {
    id: cleanUserId || userId,
    email: cleanEmail,
    full_name: cleanEmail ? cleanEmail.split("@")[0]! : "User",
    role: "student",
  };

  await supabaseFast.from("profiles").insert(newProfile);

  return {
    id: newProfile.id,
    email: cleanEmail,
    fullName: newProfile.full_name,
    department: null,
    year: null,
    phone: null,
    role: "student",
  };
}

async function checkRegistrationsOpen(userId: string, email: string) {
  const isAdmin = await checkIsAdmin(userId, email);
  if (isAdmin) return;
  const { data } = await supabaseFast
    .from("portal_settings")
    .select("value")
    .eq("key", "registrations_open")
    .maybeSingle();

  if (data && data.value === "false") {
    throw new Error("Registrations for SIH 2026 Internal Hackathon is Closed.");
  }
}

// ─── Team mutations ───────────────────────────────────────────────────────────

export async function createTeam(input: {
  leaderId: string;
  name: string;
  problemStatement: string;
  category: string;
}) {
  const session = await requireAuth();
  if (session.id !== input.leaderId) {
    throw new Error("Unauthorized: you can only create a team as yourself.");
  }
  await checkRegistrationsOpen(session.id, session.email);

  await ensureProfile(input.leaderId);

  const teamId = `team_${Date.now()}`;
  const sanitizedName = sanitizeText(input.name, 100);
  const sanitizedProblem = sanitizeText(input.problemStatement, 3000);
  const sanitizedCategory = sanitizeText(input.category, 50);

  await supabaseFast.from("teams").insert({
    id: teamId,
    name: sanitizedName,
    problem_statement: sanitizedProblem,
    category: sanitizedCategory,
    leader_id: input.leaderId,
    status: "submitted",
  });

  await supabaseFast.from("team_members").insert({
    id: `mem_${input.leaderId}`,
    team_id: teamId,
    user_id: input.leaderId,
    is_leader: true,
  });

  return { id: teamId, name: sanitizedName, problemStatement: sanitizedProblem, category: sanitizedCategory, leaderId: input.leaderId };
}

export async function leaveTeam(userId: string) {
  const session = await requireAuth();
  const cleanEmail = (session.email || "").trim().toLowerCase().replace(/\s+/g, "");
  let activeProfileId = session.id;
  if (cleanEmail) {
    const { data: pEmail } = await supabaseFast.from("profiles").select("id").eq("email", cleanEmail).limit(1);
    if (pEmail && pEmail.length > 0 && pEmail[0]?.id) {
      activeProfileId = pEmail[0].id;
    }
  }

  const isAdmin = await checkIsAdmin(session.id, session.email);
  if (session.id !== userId && activeProfileId !== userId && !isAdmin) {
    throw new Error("Unauthorized: you can only leave your own team.");
  }
  await checkRegistrationsOpen(session.id, session.email);
  return await supabaseFast.from("team_members").delete().in("user_id", [userId, activeProfileId]);
}

export async function removeMember(memberId: string) {
  const session = await requireAuth();
  await checkRegistrationsOpen(session.id, session.email);

  const isAdmin = await checkIsAdmin(session.id, session.email);

  const { data: memberRecord } = await supabaseFast
    .from("team_members")
    .select("id, team_id, user_id, is_leader")
    .eq("id", memberId)
    .maybeSingle();

  if (!memberRecord) {
    throw new Error("Team member not found.");
  }

  if (!isAdmin) {
    const cleanEmail = (session.email || "").trim().toLowerCase().replace(/\s+/g, "");
    let activeProfileId = session.id;
    if (cleanEmail) {
      const { data: pEmail } = await supabaseFast.from("profiles").select("id").eq("email", cleanEmail).limit(1);
      if (pEmail && pEmail.length > 0 && pEmail[0]?.id) {
        activeProfileId = pEmail[0].id;
      }
    }

    const { data: teamLeaderCheck } = await supabaseFast
      .from("team_members")
      .select("id")
      .eq("team_id", memberRecord.team_id)
      .in("user_id", [session.id, activeProfileId])
      .eq("is_leader", true)
      .limit(1);

    const isSelf = memberRecord.user_id === session.id || memberRecord.user_id === activeProfileId;
    const isLeaderOfThisTeam = Boolean(teamLeaderCheck && teamLeaderCheck.length > 0);

    if (!isSelf && !isLeaderOfThisTeam) {
      throw new Error("Unauthorized: Only the team leader or admin can remove members from this team.");
    }
  }

  return await supabaseFast.from("team_members").delete().eq("id", memberId);
}

export async function disbandTeam(teamId: string) {
  const session = await requireAuth();
  await checkRegistrationsOpen(session.id, session.email);

  const isAdmin = await checkIsAdmin(session.id, session.email);
  if (!isAdmin) {
    const cleanEmail = (session.email || "").trim().toLowerCase().replace(/\s+/g, "");
    let activeProfileId = session.id;
    if (cleanEmail) {
      const { data: pEmail } = await supabaseFast.from("profiles").select("id").eq("email", cleanEmail).limit(1);
      if (pEmail && pEmail.length > 0 && pEmail[0]?.id) {
        activeProfileId = pEmail[0].id;
      }
    }

    const { data: teamData } = await supabaseFast
      .from("teams")
      .select("leader_id")
      .eq("id", teamId)
      .maybeSingle();

    const isLeaderDirect = teamData && (teamData.leader_id === session.id || teamData.leader_id === activeProfileId);

    let isLeaderMembership = false;
    if (!isLeaderDirect) {
      const { data: mem } = await supabaseFast
        .from("team_members")
        .select("id")
        .eq("team_id", teamId)
        .in("user_id", [session.id, activeProfileId])
        .eq("is_leader", true)
        .limit(1);
      isLeaderMembership = Boolean(mem && mem.length > 0);
    }

    if (!isLeaderDirect && !isLeaderMembership) {
      throw new Error("Unauthorized: Only the team leader or admin can disband the team.");
    }
  }

  await supabaseFast.from("evaluator_assignments").delete().eq("team_id", teamId);
  await supabaseFast.from("team_members").delete().eq("team_id", teamId);
  return await supabaseFast.from("teams").delete().eq("id", teamId);
}

export async function submitProblemStatement(teamId: string, data: { psNumber: string; theme: string; category: string }) {
  const session = await requireAuth();

  const { data: teamData, error: teamErr } = await supabaseFast
    .from("teams")
    .select("leader_id, ps_number")
    .eq("id", teamId)
    .maybeSingle();

  if (teamErr || !teamData) throw new Error("Team not found.");

  const isAdmin = await checkIsAdmin(session.id, session.email);

  if (!isAdmin) {
    const cleanEmail = (session.email || "").trim().toLowerCase().replace(/\s+/g, "");
    let activeProfileId = session.id;
    if (cleanEmail) {
      const { data: pEmail } = await supabaseFast.from("profiles").select("id").eq("email", cleanEmail).limit(1);
      if (pEmail && pEmail.length > 0 && pEmail[0]?.id) {
        activeProfileId = pEmail[0].id;
      }
    }

    const isLeaderDirect = teamData.leader_id === session.id || teamData.leader_id === activeProfileId;

    let isLeaderMembership = false;
    if (!isLeaderDirect) {
      const { data: mem } = await supabaseFast
        .from("team_members")
        .select("id")
        .eq("team_id", teamId)
        .in("user_id", [session.id, activeProfileId])
        .eq("is_leader", true)
        .limit(1);
      isLeaderMembership = Boolean(mem && mem.length > 0);
    }

    if (!isLeaderDirect && !isLeaderMembership) {
      throw new Error("Unauthorized: Only the team leader can submit the problem statement.");
    }
  }

  // If already submitted and not admin, prevent change
  if (teamData.ps_number && !isAdmin) {
    throw new Error("Problem statement has already been submitted and cannot be modified.");
  }

  const psNumber = sanitizeAlphanumericCode(data.psNumber, 30);
  const theme = sanitizeText(data.theme, 200);
  const category = sanitizeText(data.category, 50);

  if (!psNumber) {
    throw new Error("Valid alphanumeric PS Number is required.");
  }
  if (!theme) {
    throw new Error("Theme is required.");
  }
  if (!category) {
    throw new Error("Category is required.");
  }

  const { error: updateErr } = await supabaseFast
    .from("teams")
    .update({
      ps_number: psNumber,
      theme: theme,
      category: category,
    })
    .eq("id", teamId);

  if (updateErr) throw new Error(`Submission failed: ${updateErr.message}`);
  return { success: true };
}

// ─── Admin-only mutations ─────────────────────────────────────────────────────

export async function updateTeamStatus(teamId: string, status: string) {
  const session = await requireAuth();
  const isAdmin = await checkIsAdmin(session.id, session.email);
  if (!isAdmin) throw new Error("Unauthorized: admin access required.");

  return await supabaseFast.from("teams").update({ status }).eq("id", teamId);
}

export async function rolloverAcademicYear(input: {
  mode: "increment" | "set_base_year";
  baseYear?: number;
}) {
  const session = await requireAuth();
  const isAdmin = await checkIsAdmin(session.id, session.email);
  if (!isAdmin) throw new Error("Unauthorized: admin access required.");

  const { data: profiles } = await supabaseFast.from("profiles").select("id, year, role");
  let updatedCount = 0;

  if (profiles) {
    for (const p of profiles) {
      if (p.role === "admin" || p.role === "evaluator") continue;
      if (input.mode === "increment" && p.year && p.year < 4) {
        await supabaseFast.from("profiles").update({ year: p.year + 1 }).eq("id", p.id);
        updatedCount++;
      }
    }
  }

  return { success: true, count: updatedCount };
}

// ─── Paginated fetch helper (bypasses Supabase 1000-row cap) ─────────────────

async function fetchAll(table: string, select: string, orderBy?: { column: string; ascending?: boolean }) {
  const PAGE_SIZE = 1000;
  let allData: any[] = [];
  let from = 0;
  while (true) {
    let query = supabaseFast.from(table).select(select).range(from, from + PAGE_SIZE - 1);
    if (orderBy) query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
    const { data, error } = await query;
    if (error) { console.warn(`fetchAll ${table} error:`, error); break; }
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return allData;
}

// ─── Fast HTTPS Dashboard data loader ───────────────────────────────────────

export async function getDashboardData(userId: string, email?: string) {
  let activeUserId = userId;
  let activeUserEmail = email ?? "";

  try {
    const session = await requireAuth();
    if (session.id) activeUserId = session.id;
    if (session.email) activeUserEmail = session.email;
  } catch (err) {
    console.warn("[getDashboardData] requireAuth warning:", err);
  }

  const cleanEmail = activeUserEmail.trim().toLowerCase().replace(/\s+/g, "");

  // 1. Fetch user's profile
  let profileData: any = null;

  if (cleanEmail) {
    const { data: pEmail } = await supabaseFast.from("profiles").select("*").eq("email", cleanEmail).limit(1);
    if (pEmail && pEmail.length > 0) profileData = pEmail[0];
  }

  if (!profileData && activeUserId) {
    const { data: pId } = await supabaseFast.from("profiles").select("*").eq("id", activeUserId).limit(1);
    if (pId && pId.length > 0) profileData = pId[0];
  }

  const userRole = (profileData?.role || "student").toLowerCase();
  const isAdmin = userRole === "admin";
  const isEvaluator = userRole === "evaluator";

  const { data: sRes } = await supabaseFast.from("portal_settings").select("key, value").eq("key", "registrations_open").maybeSingle();
  const registrationsOpen = sRes ? sRes.value === "true" : true;

  const profile = profileData
    ? {
        id: profileData.id,
        email: profileData.email || cleanEmail,
        fullName: profileData.full_name || "",
        department: profileData.department,
        year: profileData.year,
        phone: profileData.phone,
        role: profileData.role || "student",
      }
    : {
        id: activeUserId,
        email: cleanEmail,
        fullName: cleanEmail ? cleanEmail.split("@")[0]! : "User",
        department: null,
        year: null,
        phone: null,
        role: "student",
      };

  // 2. For student dashboard: fetch ONLY their team data (no 1000-row cap problem)
  if (!isAdmin && !isEvaluator) {
    const dbProfileId = profileData?.id || activeUserId;

    // Find this user's team membership
    const { data: myMems } = await supabaseFast.from("team_members").select("*").eq("user_id", dbProfileId);
    const myMembership = myMems && myMems.length > 0 ? myMems[0] : null;

    if (!myMembership) {
      return {
        profile, isAdmin, isEvaluator, role: userRole,
        profiles: [profile], memberships: [], teams: [], invitations: [], registrationsOpen,
      };
    }

    // Fetch the team
    const { data: teamRows } = await supabaseFast.from("teams").select("*").eq("id", myMembership.team_id);
    const team = teamRows && teamRows.length > 0 ? teamRows[0] : null;

    // Fetch all members of this team
    const { data: teamMems } = await supabaseFast.from("team_members").select("*").eq("team_id", myMembership.team_id);
    const memberUserIds = (teamMems || []).map((m: any) => m.user_id);

    // Fetch profiles of team members
    const { data: memberProfiles } = memberUserIds.length > 0
      ? await supabaseFast.from("profiles").select("id, full_name, email, department, year, phone, role").in("id", memberUserIds)
      : { data: [] };

    const profiles = (memberProfiles || []).map((p: any) => ({
      id: p.id, fullName: p.full_name, email: p.email,
      department: p.department, year: p.year, phone: p.phone, role: p.role || "student",
    }));

    const memberships = (teamMems || []).map((m: any) => ({
      id: m.id, teamId: m.team_id, userId: m.user_id, isLeader: m.is_leader, joinedAt: m.joined_at,
    }));

    const teams = team ? [{
      id: team.id, name: team.name, psNumber: team.ps_number, theme: team.theme, problemStatement: team.problem_statement,
      category: team.category, leaderId: team.leader_id, status: team.status || "submitted", createdAt: team.created_at,
    }] : [];

    return {
      profile, isAdmin, isEvaluator, role: userRole,
      profiles, memberships, teams, invitations: [], registrationsOpen,
    };
  }

  // 3. For admin/evaluator: paginate to fetch ALL records
  const [rawProfiles, rawMemberships, rawTeams] = await Promise.all([
    fetchAll("profiles", "id, full_name, email, department, year, phone, role", { column: "full_name", ascending: true }),
    fetchAll("team_members", "id, team_id, user_id, is_leader, joined_at"),
    fetchAll("teams", "id, name, ps_number, theme, problem_statement, category, leader_id, status, created_at", { column: "created_at", ascending: false }),
  ]);

  const profiles = rawProfiles.map((p: any) => ({
    id: p.id, fullName: p.full_name, email: p.email,
    department: p.department, year: p.year, phone: p.phone, role: p.role || "student",
  }));

  const memberships = rawMemberships.map((m: any) => ({
    id: m.id, teamId: m.team_id, userId: m.user_id, isLeader: m.is_leader, joinedAt: m.joined_at,
  }));

  const teams = rawTeams.map((t: any) => ({
    id: t.id, name: t.name, psNumber: t.ps_number, theme: t.theme, problemStatement: t.problem_statement,
    category: t.category, leaderId: t.leader_id, status: t.status || "submitted", createdAt: t.created_at,
  }));

  return {
    profile, isAdmin, isEvaluator, role: userRole,
    profiles, memberships, teams, invitations: [], registrationsOpen,
  };
}

export async function getAdminDashboardData() {
  const session = await requireAuth();
  const isAdmin = await checkIsAdmin(session.id, session.email);
  if (!isAdmin) {
    throw new Error("Unauthorized: admin access required.");
  }
  return await getDashboardData(session.id, session.email);
}

export async function getEvaluatorDashboardData() {
  const session = await requireAuth();
  const isEval = await checkIsEvaluator(session.id, session.email);
  if (!isEval) {
    throw new Error("Unauthorized: evaluator access required.");
  }

  // Get base dashboard data (all records, admin-style fetch)
  const base = await getDashboardData(session.id, session.email);

  // If not an evaluator (or is admin), return as-is
  if (!base.isEvaluator || base.isAdmin) return base;

  // Get the team IDs assigned to this evaluator
  const assignedTeamIds = await getMyAssignedTeamIds(session.id);

  // Return empty-state data if no assignments yet
  if (assignedTeamIds.length === 0) {
    return {
      ...base,
      teams: [],
      memberships: [],
      profiles: [base.profile],
      hasAssignments: false,
    };
  }

  const assignedSet = new Set(assignedTeamIds);

  // Filter teams to only assigned ones
  const filteredTeams = base.teams.filter((t) => assignedSet.has(t.id));

  // Filter memberships to only those in assigned teams
  const filteredMemberships = base.memberships.filter((m) => assignedSet.has(m.teamId));

  // Filter profiles to only members of assigned teams + the evaluator themselves
  const relevantUserIds = new Set(filteredMemberships.map((m) => m.userId));
  const filteredProfiles = base.profiles.filter((p) => relevantUserIds.has(p.id));

  return {
    ...base,
    teams: filteredTeams,
    memberships: filteredMemberships,
    profiles: filteredProfiles,
    hasAssignments: true,
  };
}

export async function toggleRegistrations(open: boolean) {
  const session = await requireAuth();
  const isAdmin = await checkIsAdmin(session.id, session.email);
  if (!isAdmin) throw new Error("Unauthorized: admin access required.");

  await supabaseFast.from("portal_settings").upsert({ key: "registrations_open", value: open ? "true" : "false" });
  return { success: true, open };
}

// ─── Evaluation Management ──────────────────────────────────────────────────

export type EvaluationRecord = {
  teamId: string;
  evaluatorId?: string;
  evaluatorEmail?: string;
  novelty: number;        // 0 - 25
  technical: number;      // 0 - 25
  impact: number;         // 0 - 25
  presentation: number;   // 0 - 25
  totalScore: number;     // 0 - 100
  verdict: "shortlisted" | "reviewed" | "rejected" | "pending";
  remarks: string;
  updatedAt: string;
};

export async function getEvaluations(): Promise<Record<string, EvaluationRecord>> {
  const session = await requireAuth();
  const isAuthorized = await checkIsEvaluator(session.id, session.email);
  if (!isAuthorized) {
    throw new Error("Unauthorized: evaluator or admin access required.");
  }

  const { data, error } = await supabaseFast
    .from("evaluations")
    .select("team_id, evaluator_id, evaluator_email, novelty, technical, impact, presentation, total_score, verdict, remarks, updated_at");

  if (error) {
    console.warn("getEvaluations error:", error);
    return {};
  }

  const map: Record<string, EvaluationRecord> = {};
  for (const r of (data || [])) {
    map[r.team_id] = {
      teamId: r.team_id,
      evaluatorId: r.evaluator_id,
      evaluatorEmail: r.evaluator_email,
      novelty: r.novelty,
      technical: r.technical,
      impact: r.impact,
      presentation: r.presentation,
      totalScore: r.total_score,
      verdict: r.verdict as any,
      remarks: r.remarks || "",
      updatedAt: r.updated_at,
    };
  }
  return map;
}

export async function saveTeamEvaluation(evalRecord: EvaluationRecord) {
  const session = await requireAuth();
  const isAdmin = await checkIsAdmin(session.id, session.email);
  const isEval = await checkIsEvaluator(session.id, session.email);
  if (!isEval) throw new Error("Unauthorized: evaluator access required.");

  // Security: Prevent IDOR by ensuring non-admin evaluators can only evaluate assigned teams
  const cleanEmail = (session.email || "").trim().toLowerCase().replace(/\s+/g, "");
  let activeProfileId = session.id;
  if (cleanEmail) {
    const { data: pEmail } = await supabaseFast.from("profiles").select("id").eq("email", cleanEmail).limit(1);
    if (pEmail && pEmail.length > 0 && pEmail[0]?.id) {
      activeProfileId = pEmail[0].id;
    }
  }

  if (!isAdmin) {
    const { data: assignment } = await supabaseFast
      .from("evaluator_assignments")
      .select("id")
      .eq("team_id", evalRecord.teamId)
      .in("evaluator_id", [session.id, activeProfileId])
      .limit(1);

    if (!assignment || assignment.length === 0) {
      throw new Error("Unauthorized: you are not assigned to evaluate this team.");
    }
  }

  // Security: Defensive score sanitization & range clamping (0 - 25 each)
  const novelty = Math.max(0, Math.min(25, Number(evalRecord.novelty) || 0));
  const technical = Math.max(0, Math.min(25, Number(evalRecord.technical) || 0));
  const impact = Math.max(0, Math.min(25, Number(evalRecord.impact) || 0));
  const presentation = Math.max(0, Math.min(25, Number(evalRecord.presentation) || 0));
  const totalScore = novelty + technical + impact + presentation;

  const validVerdicts = ["shortlisted", "reviewed", "rejected", "pending"] as const;
  const verdict = validVerdicts.includes(evalRecord.verdict) ? evalRecord.verdict : "reviewed";
  const sanitizedRemarks = sanitizeText(evalRecord.remarks, 1000);

  const evaluationPayload = {
    team_id: evalRecord.teamId,
    evaluator_id: activeProfileId || session.id,
    evaluator_email: session.email,
    novelty,
    technical,
    impact,
    presentation,
    total_score: totalScore,
    verdict,
    remarks: sanitizedRemarks,
    updated_at: new Date().toISOString(),
  };

  const { error: upsertErr } = await supabaseFast
    .from("evaluations")
    .upsert(evaluationPayload, { onConflict: "team_id,evaluator_id" });

  if (upsertErr) {
    throw new Error(`Evaluation save failed: ${upsertErr.message}`);
  }

  return { success: true };
}

// ─── Evaluator Assignment Management ─────────────────────────────────────────

export type EvaluatorAssignment = {
  id: string;
  teamId: string;
  evaluatorId: string;
  assignedBy: string | null;
  assignedAt: string;
};

/** Returns all assignments — used by admin to build the assignments overview */
export async function getAllAssignments(): Promise<EvaluatorAssignment[]> {
  const session = await requireAuth();
  const isAuthorized = await checkIsEvaluator(session.id, session.email);
  if (!isAuthorized) {
    throw new Error("Unauthorized: evaluator or admin access required.");
  }

  const { data, error } = await supabaseFast
    .from("evaluator_assignments")
    .select("id, team_id, evaluator_id, assigned_by, assigned_at");
  if (error) { console.warn("getAllAssignments error:", error); return []; }
  return (data || []).map((r: any) => ({
    id: r.id,
    teamId: r.team_id,
    evaluatorId: r.evaluator_id,
    assignedBy: r.assigned_by,
    assignedAt: r.assigned_at,
  }));
}

/** Returns only the team IDs assigned to a specific evaluator */
export async function getMyAssignedTeamIds(evaluatorId: string): Promise<string[]> {
  const session = await requireAuth();
  const isAdmin = await checkIsAdmin(session.id, session.email);
  const cleanEmail = (session.email || "").trim().toLowerCase().replace(/\s+/g, "");
  let activeProfileId = session.id;
  if (cleanEmail) {
    const { data: pEmail } = await supabaseFast.from("profiles").select("id").eq("email", cleanEmail).limit(1);
    if (pEmail && pEmail.length > 0 && pEmail[0]?.id) {
      activeProfileId = pEmail[0].id;
    }
  }

  if (session.id !== evaluatorId && activeProfileId !== evaluatorId && !isAdmin) {
    throw new Error("Unauthorized: you can only query your own assignments.");
  }

  const { data, error } = await supabaseFast
    .from("evaluator_assignments")
    .select("team_id")
    .in("evaluator_id", [evaluatorId, session.id, activeProfileId]);
  if (error) { console.warn("getMyAssignedTeamIds error:", error); return []; }
  return (data || []).map((r: any) => r.team_id as string);
}

/** Admin: assign a single team to an evaluator (upserts — replaces existing assignment) */
export async function assignTeamToEvaluator(teamId: string, evaluatorId: string) {
  const session = await requireAuth();
  const isAdmin = await checkIsAdmin(session.id, session.email);
  if (!isAdmin) throw new Error("Unauthorized: admin access required.");

  const { error } = await supabaseFast
    .from("evaluator_assignments")
    .upsert(
      { team_id: teamId, evaluator_id: evaluatorId, assigned_by: session.id },
      { onConflict: "team_id" }
    );
  if (error) throw new Error(`Assignment failed: ${error.message}`);
  return { success: true };
}

/** Admin: remove assignment for a team */
export async function unassignTeam(teamId: string) {
  const session = await requireAuth();
  const isAdmin = await checkIsAdmin(session.id, session.email);
  if (!isAdmin) throw new Error("Unauthorized: admin access required.");

  const { error } = await supabaseFast
    .from("evaluator_assignments")
    .delete()
    .eq("team_id", teamId);
  if (error) throw new Error(`Unassign failed: ${error.message}`);
  return { success: true };
}

/** Admin: auto-distribute all unassigned teams round-robin across evaluators */
export async function autoAssignTeams() {
  const session = await requireAuth();
  const isAdmin = await checkIsAdmin(session.id, session.email);
  if (!isAdmin) throw new Error("Unauthorized: admin access required.");

  // Get all evaluator profiles
  const { data: evaluators } = await supabaseFast
    .from("profiles")
    .select("id")
    .eq("role", "evaluator");
  if (!evaluators || evaluators.length === 0) throw new Error("No evaluators found.");

  // Get already-assigned team IDs
  const existingAssignments = await getAllAssignments();
  const assignedTeamIds = new Set(existingAssignments.map((a) => a.teamId));

  // Get all teams NOT yet assigned
  const allTeams = await fetchAll("teams", "id", { column: "created_at", ascending: true });
  const unassigned = allTeams.filter((t: any) => !assignedTeamIds.has(t.id));

  if (unassigned.length === 0) return { success: true, assigned: 0 };

  // Round-robin distribute
  const inserts = unassigned.map((team: any, i: number) => ({
    team_id: team.id,
    evaluator_id: evaluators[i % evaluators.length]!.id,
    assigned_by: session.id,
  }));

  const { error } = await supabaseFast
    .from("evaluator_assignments")
    .upsert(inserts, { onConflict: "team_id" });
  if (error) throw new Error(`Auto-assign failed: ${error.message}`);
  return { success: true, assigned: inserts.length };
}
