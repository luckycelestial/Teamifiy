"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";

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

// ─── Profile mutations ────────────────────────────────────────────────────────

export async function updateProfile(userId: string, data: Partial<ProfileData>) {
  const session = await requireAuth();
  if (session.id !== userId) {
    throw new Error("Unauthorized: you can only update your own profile.");
  }

  await supabaseFast
    .from("profiles")
    .update({
      full_name: data.fullName,
      department: data.department,
      year: data.year,
      phone: data.phone,
    })
    .eq("id", userId);

  try {
    return await prisma.profile.update({
      where: { id: userId },
      data: {
        fullName: data.fullName,
        department: data.department,
        year: data.year,
        phone: data.phone,
      },
    });
  } catch (err) {
    console.warn("updateProfile prisma fallback:", err);
  }

  return { id: userId, ...data };
}

export async function ensureProfile(userId: string, email?: string) {
  const cleanEmail = (email || "").trim().toLowerCase().replace(/\s+/g, "");

  const { data: existing } = await supabaseFast
    .from("profiles")
    .select("*")
    .or(`id.eq.${userId},email.eq.${cleanEmail}`)
    .limit(1);

  if (existing && existing.length > 0) {
    const p = existing[0]!;
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
    id: userId,
    email: cleanEmail,
    full_name: cleanEmail ? cleanEmail.split("@")[0]! : "User",
    role: "student",
  };

  await supabaseFast.from("profiles").insert(newProfile);

  return {
    id: userId,
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
  await supabaseFast.from("teams").insert({
    id: teamId,
    name: input.name,
    problem_statement: input.problemStatement,
    category: input.category,
    leader_id: input.leaderId,
    status: "submitted",
  });

  await supabaseFast.from("team_members").insert({
    id: `mem_${input.leaderId}`,
    team_id: teamId,
    user_id: input.leaderId,
    is_leader: true,
  });

  return { id: teamId, ...input };
}

export async function leaveTeam(userId: string) {
  const session = await requireAuth();
  if (session.id !== userId) {
    throw new Error("Unauthorized: you can only leave your own team.");
  }
  await checkRegistrationsOpen(session.id, session.email);
  return await supabaseFast.from("team_members").delete().eq("user_id", userId);
}

export async function removeMember(memberId: string) {
  const session = await requireAuth();
  await checkRegistrationsOpen(session.id, session.email);
  return await supabaseFast.from("team_members").delete().eq("id", memberId);
}

export async function disbandTeam(teamId: string) {
  const session = await requireAuth();
  await checkRegistrationsOpen(session.id, session.email);
  await supabaseFast.from("team_members").delete().eq("team_id", teamId);
  return await supabaseFast.from("teams").delete().eq("id", teamId);
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

  // 2. Fetch profiles, memberships, teams, portal_settings over HTTPS Port 443
  const [pRes, mRes, tRes, sRes] = await Promise.all([
    supabaseFast.from("profiles").select("id, full_name, email, department, year, phone, role").order("full_name").range(0, 5000),
    supabaseFast.from("team_members").select("id, team_id, user_id, is_leader, joined_at").range(0, 5000),
    supabaseFast.from("teams").select("id, name, problem_statement, category, leader_id, status, created_at").order("created_at", { ascending: false }).range(0, 5000),
    supabaseFast.from("portal_settings").select("key, value").eq("key", "registrations_open").maybeSingle(),
  ]);

  const rawProfiles = pRes.data || [];
  const rawMemberships = mRes.data || [];
  const rawTeams = tRes.data || [];

  const profiles = rawProfiles.map((p) => ({
    id: p.id,
    fullName: p.full_name,
    email: p.email,
    department: p.department,
    year: p.year,
    phone: p.phone,
    role: p.role || "student",
  }));

  const memberships = rawMemberships.map((m) => ({
    id: m.id,
    teamId: m.team_id,
    userId: m.user_id,
    isLeader: m.is_leader,
    joinedAt: m.joined_at,
  }));

  const teams = rawTeams.map((t) => ({
    id: t.id,
    name: t.name,
    problemStatement: t.problem_statement,
    category: t.category,
    leaderId: t.leader_id,
    status: t.status || "submitted",
    createdAt: t.created_at,
  }));

  const userRole = (profileData?.role || "student").toLowerCase();
  const isAdmin = userRole === "admin";
  const isEvaluator = userRole === "evaluator";
  const registrationsOpen = sRes.data ? sRes.data.value === "true" : true;

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

  return {
    profile,
    isAdmin,
    isEvaluator,
    role: userRole,
    profiles,
    memberships,
    teams,
    invitations: [],
    registrationsOpen,
  };
}

export async function getAdminDashboardData() {
  const session = await requireAuth();
  return await getDashboardData(session.id, session.email);
}

export async function getEvaluatorDashboardData() {
  const session = await requireAuth();
  return await getDashboardData(session.id, session.email);
}

export async function toggleRegistrations(open: boolean) {
  const session = await requireAuth();
  const isAdmin = await checkIsAdmin(session.id, session.email);
  if (!isAdmin) throw new Error("Unauthorized: admin access required.");

  await supabaseFast.from("portal_settings").upsert({ key: "registrations_open", value: open ? "true" : "false" });
  return { success: true, open };
}
