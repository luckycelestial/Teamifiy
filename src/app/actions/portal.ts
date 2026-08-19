"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/supabase-server";

const TEAM_SIZE = 6;

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
  return await prisma.profile.findUnique({ where: { id: userId } });
}

export async function getUserRole(userId: string, email?: string): Promise<"admin" | "evaluator" | "student"> {
  if (userId) {
    const profile = await prisma.profile.findUnique({ where: { id: userId } });
    if (profile && profile.role) {
      return profile.role as "admin" | "evaluator" | "student";
    }
  }
  if (email) {
    const cleanEmail = email.trim().toLowerCase();
    const profile = await prisma.profile.findUnique({ where: { email: cleanEmail } });
    if (profile && profile.role) {
      return profile.role as "admin" | "evaluator" | "student";
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

  if (userId) {
    const team = await prisma.team.findFirst({
      where: { leaderId: userId },
    });
    if (team) return true;
  }

  if (email) {
    const cleanEmail = email.trim().toLowerCase();
    const profile = await prisma.profile.findUnique({
      where: { email: cleanEmail },
      include: {
        memberships: {
          where: { isLeader: true },
        },
      },
    });
    if (profile && profile.memberships.length > 0) return true;
  }

  return false;
}

export async function updateUserRole(targetUserId: string, newRole: "admin" | "evaluator" | "student") {
  const session = await requireAuth();
  const isAdmin = await checkIsAdmin(session.id, session.email);
  if (!isAdmin) {
    throw new Error("Unauthorized: admin access required to update user roles.");
  }

  return await prisma.profile.update({
    where: { id: targetUserId },
    data: { role: newRole },
  });
}

// ─── Profile mutations ────────────────────────────────────────────────────────

export async function updateProfile(userId: string, data: Partial<ProfileData>) {
  const session = await requireAuth();
  if (session.id !== userId) {
    throw new Error("Unauthorized: you can only update your own profile.");
  }

  const existing = await prisma.profile.findFirst({
    where: {
      OR: [{ id: userId }, ...(data.email ? [{ email: data.email }] : [])],
    },
  });

  if (existing) {
    return await prisma.profile.update({
      where: { id: existing.id },
      data: {
        fullName: data.fullName ?? existing.fullName,
        department: data.department ?? existing.department,
        year: data.year ?? existing.year,
        phone: data.phone ?? existing.phone,
      },
    });
  }

  return await prisma.profile.create({
    data: {
      id: userId,
      email: data.email ?? "",
      fullName: data.fullName ?? "",
      department: data.department,
      year: data.year,
      phone: data.phone,
      role: (data.email ?? "").trim().toLowerCase() === "cfi@sece.ac.in" ? "admin" : "student",
    },
  });
}

export async function ensureProfile(userId: string, email?: string) {
  let profile = await prisma.profile.findUnique({ where: { id: userId } });
  if (!profile) {
    const userEmail = email ? email.trim().toLowerCase() : "";
    if (userEmail) {
      const existingByEmail = await prisma.profile.findFirst({
        where: { email: userEmail },
      });
      if (existingByEmail) {
        profile = await prisma.profile.update({
          where: { id: existingByEmail.id },
          data: { id: userId },
        });
        return profile;
      }
    }
    profile = await prisma.profile.create({
      data: {
        id: userId,
        email: userEmail,
        fullName: userEmail ? userEmail.split("@")[0]! : "User",
        role: userEmail === "cfi@sece.ac.in" ? "admin" : "student",
      },
    });
  }
  return profile;
}

async function checkRegistrationsOpen(userId: string, email: string) {
  const isAdmin = await checkIsAdmin(userId, email);
  if (isAdmin) return;
  const setting = await prisma.portalSetting.findUnique({ where: { key: "registrations_open" } });
  if (setting && setting.value === "false") {
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
  return await prisma.$transaction(async (tx) => {
    const existingMembership = await tx.teamMember.findFirst({
      where: { userId: input.leaderId },
    });
    if (existingMembership) {
      throw new Error("You are already a member of a team.");
    }

    const team = await tx.team.create({
      data: {
        name: input.name,
        problemStatement: input.problemStatement,
        category: input.category,
        leaderId: input.leaderId,
        status: "submitted",
      },
    });

    await tx.teamMember.create({
      data: { teamId: team.id, userId: input.leaderId, isLeader: true },
    });

    return team;
  });
}

export async function leaveTeam(userId: string) {
  const session = await requireAuth();
  if (session.id !== userId) {
    throw new Error("Unauthorized: you can only leave your own team.");
  }
  await checkRegistrationsOpen(session.id, session.email);
  return await prisma.teamMember.deleteMany({ where: { userId } });
}

export async function removeMember(memberId: string) {
  const session = await requireAuth();
  await checkRegistrationsOpen(session.id, session.email);

  const member = await prisma.teamMember.findUnique({ where: { id: memberId } });
  if (!member) throw new Error("Member not found.");

  const team = await prisma.team.findUnique({ where: { id: member.teamId } });
  if (!team || team.leaderId !== session.id) {
    throw new Error("Unauthorized: only the team leader can remove members.");
  }
  if (member.userId === session.id) {
    throw new Error("Use 'Leave team' to remove yourself.");
  }

  return await prisma.teamMember.delete({ where: { id: memberId } });
}

export async function disbandTeam(teamId: string) {
  const session = await requireAuth();
  await checkRegistrationsOpen(session.id, session.email);

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw new Error("Team not found.");
  if (team.leaderId !== session.id) {
    throw new Error("Unauthorized: only the team leader can disband the team.");
  }

  return await prisma.team.delete({ where: { id: teamId } });
}

// ─── Admin-only mutations ─────────────────────────────────────────────────────

export async function updateTeamStatus(teamId: string, status: string) {
  const session = await requireAuth();
  const isAdmin = await checkIsAdmin(session.id, session.email);
  if (!isAdmin) throw new Error("Unauthorized: admin access required.");

  return await prisma.team.update({ where: { id: teamId }, data: { status } });
}

export async function rolloverAcademicYear(input: {
  mode: "increment" | "set_base_year";
  baseYear?: number;
}) {
  const session = await requireAuth();
  const isAdmin = await checkIsAdmin(session.id, session.email);
  if (!isAdmin) throw new Error("Unauthorized: admin access required.");

  const profiles = await prisma.profile.findMany();
  let updatedCount = 0;

  for (const p of profiles) {
    if (p.role === "admin" || p.role === "evaluator") {
      continue;
    }

    if (input.mode === "increment") {
      if (p.year && p.year < 4) {
        await prisma.profile.update({
          where: { id: p.id },
          data: { year: p.year + 1 },
        });
        updatedCount++;
      }
    }
  }

  return { success: true, count: updatedCount };
}

// ─── Dashboard data ───────────────────────────────────────────────────────────

export async function getDashboardData(userId: string, email?: string) {
  let activeUserId = userId;
  let activeUserEmail = email ?? "";

  try {
    const session = await requireAuth();
    if (session.id) activeUserId = session.id;
    if (session.email) activeUserEmail = session.email;
  } catch (err) {
    console.warn("[getDashboardData] requireAuth warning, using client identity:", err);
  }

  const userEmail = activeUserEmail.trim().toLowerCase();

  let profile = await prisma.profile.findFirst({
    where: {
      OR: [
        { id: activeUserId },
        ...(userEmail ? [{ email: userEmail }] : []),
      ],
    },
  });

  if (!profile) {
    profile = await prisma.profile.create({
      data: {
        id: activeUserId,
        email: userEmail,
        fullName: userEmail ? userEmail.split("@")[0]! : "User",
        role: userEmail === "cfi@sece.ac.in" ? "admin" : "student",
      },
    });
  }

  let regSetting = null;
  try {
    regSetting = await prisma.portalSetting.findUnique({ where: { key: "registrations_open" } });
  } catch (err) {
    console.warn("portalSetting lookup fallback:", err);
  }

  const [userRole, profiles, memberships, teams] = await Promise.all([
    getUserRole(activeUserId, userEmail),
    prisma.profile.findMany({ orderBy: { fullName: "asc" } }),
    prisma.teamMember.findMany(),
    prisma.team.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  const registrationsOpen = regSetting ? regSetting.value === "true" : true;
  const isAdmin = userRole === "admin";
  const isEvaluator = userRole === "evaluator";

  return { profile, isAdmin, isEvaluator, role: userRole, profiles, memberships, teams, invitations: [], registrationsOpen };
}

export async function getAdminDashboardData() {
  const session = await requireAuth();
  const isAdmin = await checkIsAdmin(session.id, session.email);
  if (!isAdmin) {
    throw new Error("Unauthorized: admin access required.");
  }

  let regSetting = null;
  try {
    regSetting = await prisma.portalSetting.findUnique({ where: { key: "registrations_open" } });
  } catch (err) {
    console.warn("portalSetting lookup fallback:", err);
  }

  const [profiles, memberships, teams] = await Promise.all([
    prisma.profile.findMany({ orderBy: { fullName: "asc" } }),
    prisma.teamMember.findMany(),
    prisma.team.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  const profile = await ensureProfile(session.id, session.email);
  const registrationsOpen = regSetting ? regSetting.value === "true" : true;

  return { profile, isAdmin: true, role: "admin" as const, profiles, memberships, teams, invitations: [], registrationsOpen };
}

export async function getEvaluatorDashboardData() {
  const session = await requireAuth();
  const isEvaluator = await checkIsEvaluator(session.id, session.email);
  if (!isEvaluator) {
    throw new Error("Unauthorized: evaluator access required.");
  }

  let regSetting = null;
  try {
    regSetting = await prisma.portalSetting.findUnique({ where: { key: "registrations_open" } });
  } catch (err) {
    console.warn("portalSetting lookup fallback:", err);
  }

  const [profiles, memberships, teams] = await Promise.all([
    prisma.profile.findMany({ orderBy: { fullName: "asc" } }),
    prisma.teamMember.findMany(),
    prisma.team.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  const profile = await ensureProfile(session.id, session.email);
  const registrationsOpen = regSetting ? regSetting.value === "true" : true;

  return { profile, isEvaluator: true, role: profile.role || "evaluator", profiles, memberships, teams, invitations: [], registrationsOpen };
}

export async function toggleRegistrations(open: boolean) {
  const session = await requireAuth();
  const isAdmin = await checkIsAdmin(session.id, session.email);
  if (!isAdmin) throw new Error("Unauthorized: admin access required.");

  await prisma.portalSetting.upsert({
    where: { key: "registrations_open" },
    update: { value: open ? "true" : "false" },
    create: { key: "registrations_open", value: open ? "true" : "false" },
  });

  return { success: true, open };
}
