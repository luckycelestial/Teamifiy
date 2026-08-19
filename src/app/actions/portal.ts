"use server";

import { prisma } from "@/lib/prisma";
import { parseSeceEmail } from "@/lib/email-parser";
import { requireAuth } from "@/lib/supabase-server";

const TEAM_SIZE = 6;

type ProfileData = {
  id: string;
  email: string;
  fullName: string;
  department: string | null;
  year: number | null;
  gender: string | null;
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
    return parseSeceEmail(cleanEmail).role;
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
  // Verify the caller owns this profile
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
        gender: data.gender ?? existing.gender,
        phone: data.phone ?? existing.phone,
      },
    });
  }

  const parsed = parseSeceEmail(data.email ?? "");
  return await prisma.profile.create({
    data: {
      id: userId,
      email: data.email ?? "",
      fullName: data.fullName ?? "",
      department: data.department,
      year: data.year,
      gender: data.gender,
      phone: data.phone,
      role: parsed.role,
    },
  });
}

export async function ensureProfile(userId: string, email?: string) {
  let profile = await prisma.profile.findUnique({ where: { id: userId } });
  if (!profile) {
    const userEmail = email ?? `${userId}@sece.ac.in`;
    const parsed = parseSeceEmail(userEmail);
    const existingByEmail = await prisma.profile.findFirst({
      where: { email: userEmail },
    });
    if (existingByEmail) {
      profile = await prisma.profile.update({
        where: { id: existingByEmail.id },
        data: { id: userId },
      });
    } else {
      profile = await prisma.profile.create({
        data: {
          id: userId,
          email: userEmail,
          fullName: parsed.fullName,
          department: parsed.department,
          year: parsed.year,
          role: parsed.role,
        },
      });
    }
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
        status: "forming",
      },
    });

    await tx.teamMember.create({
      data: { teamId: team.id, userId: input.leaderId, isLeader: true },
    });

    return team;
  });
}

export async function sendInviteByEmail(input: {
  teamId: string;
  inviterId: string;
  inviteeEmail: string;
}) {
  try {
    const session = await requireAuth();
    if (session.id !== input.inviterId) {
      return { success: false, error: "Unauthorized: you can only send invites as yourself." };
    }
    await checkRegistrationsOpen(session.id, session.email);

    const cleanEmail = input.inviteeEmail.trim().toLowerCase();
    if (!cleanEmail) return { success: false, error: "Please enter a student email address." };

    const invitee = await prisma.profile.findFirst({ where: { email: cleanEmail } });
    if (!invitee) {
      return {
        success: false,
        error: `No registered student found for '${cleanEmail}'. Ask them to sign in to the portal first before inviting.`,
      };
    }
    if (invitee.id === input.inviterId) {
      return { success: false, error: "You cannot invite yourself to your team." };
    }

    const existingMembership = await prisma.teamMember.findFirst({
      where: { userId: invitee.id },
    });
    if (existingMembership) {
      return { success: false, error: `${invitee.fullName} is already a member of a team.` };
    }

    const existingInvite = await prisma.invitation.findFirst({
      where: { teamId: input.teamId, inviteeId: invitee.id, status: "pending" },
    });
    if (existingInvite) {
      return { success: false, error: `An invitation has already been sent to ${invitee.fullName}.` };
    }

    await prisma.invitation.create({
      data: {
        teamId: input.teamId,
        inviterId: input.inviterId,
        inviteeId: invitee.id,
        status: "pending",
      },
    });

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to send invite.",
    };
  }
}

export async function revokeInvite(inviteId: string) {
  const session = await requireAuth();
  await checkRegistrationsOpen(session.id, session.email);

  // Verify caller is the team leader for this invite
  const invite = await prisma.invitation.findUnique({
    where: { id: inviteId },
    include: { team: true },
  });
  if (!invite) throw new Error("Invitation not found.");
  if (invite.team.leaderId !== session.id) {
    throw new Error("Unauthorized: only the team leader can revoke invites.");
  }

  return await prisma.invitation.update({
    where: { id: inviteId },
    data: { status: "cancelled" },
  });
}

export async function acceptInvite(invitationId: string, userId: string) {
  const session = await requireAuth();
  if (session.id !== userId) {
    throw new Error("Unauthorized: you can only accept your own invitations.");
  }
  await checkRegistrationsOpen(session.id, session.email);

  await ensureProfile(userId);
  return await prisma.$transaction(async (tx) => {
    const invite = await tx.invitation.findUnique({
      where: { id: invitationId },
      include: { team: { include: { members: true } } },
    });

    if (!invite || invite.inviteeId !== userId) {
      throw new Error("Invalid invitation.");
    }
    if (invite.team.members.length >= TEAM_SIZE) {
      throw new Error("Team has already reached max size.");
    }

    await tx.teamMember.create({
      data: { teamId: invite.teamId, userId, isLeader: false },
    });
    await tx.invitation.update({
      where: { id: invitationId },
      data: { status: "accepted", respondedAt: new Date() },
    });
    await tx.invitation.updateMany({
      where: { inviteeId: userId, status: "pending" },
      data: { status: "cancelled" },
    });
  });
}

export async function declineInvite(invitationId: string) {
  const session = await requireAuth();
  await checkRegistrationsOpen(session.id, session.email);

  const invite = await prisma.invitation.findUnique({ where: { id: invitationId } });
  if (!invite) throw new Error("Invitation not found.");
  if (invite.inviteeId !== session.id) {
    throw new Error("Unauthorized: you can only decline your own invitations.");
  }

  return await prisma.invitation.update({
    where: { id: invitationId },
    data: { status: "declined", respondedAt: new Date() },
  });
}

export async function cancelInvite(invitationId: string) {
  const session = await requireAuth();
  await checkRegistrationsOpen(session.id, session.email);

  const invite = await prisma.invitation.findUnique({
    where: { id: invitationId },
    include: { team: true },
  });
  if (!invite) throw new Error("Invitation not found.");
  if (invite.team.leaderId !== session.id) {
    throw new Error("Unauthorized: only the team leader can cancel invites.");
  }

  return await prisma.invitation.delete({ where: { id: invitationId } });
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

  // Verify caller is the team leader
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

  const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "").trim().toLowerCase();
  const profiles = await prisma.profile.findMany();
  let updatedCount = 0;

  for (const p of profiles) {
    if (
      p.email.trim().toLowerCase() === adminEmail ||
      p.email.toLowerCase().startsWith("admin")
    ) {
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
    } else if (input.mode === "set_base_year" && input.baseYear) {
      const parsed = parseSeceEmail(p.email, input.baseYear);
      if (parsed.year !== null && !parsed.isAdmin) {
        await prisma.profile.update({
          where: { id: p.id },
          data: { year: parsed.year },
        });
        updatedCount++;
      }
    }
  }

  return { success: true, count: updatedCount };
}

// ─── Dashboard data (read, called on page load) ───────────────────────────────

export async function getDashboardData(userId: string, email?: string) {
  const t0 = performance.now();
  console.log(`[PERF] getDashboardData START for ${userId} (${email})`);

  let activeUserId = userId;
  let activeUserEmail = email ?? "";

  try {
    const session = await requireAuth();
    if (session.id) activeUserId = session.id;
    if (session.email) activeUserEmail = session.email;
  } catch (err) {
    console.warn("[getDashboardData] requireAuth warning, using client identity:", err);
  }

  const userEmail = (activeUserEmail && activeUserEmail.trim() !== "")
    ? activeUserEmail.trim()
    : `${activeUserId}@sece.ac.in`;
  const parsed = parseSeceEmail(userEmail);

  let profile = await prisma.profile.findFirst({
    where: { OR: [{ id: activeUserId }, { email: userEmail }] },
  });

  if (!profile) {
    profile = await prisma.profile.create({
      data: {
        id: activeUserId,
        email: userEmail,
        fullName: parsed.fullName,
        department: parsed.department,
        year: parsed.year,
        gender: null,
        phone: null,
      },
    });
  } else {
    const updateData: {
      fullName?: string;
      department?: string;
      year?: number | null;
      email?: string;
    } = {};
    if (!profile.fullName && parsed.fullName) updateData.fullName = parsed.fullName;
    if (!profile.department && parsed.department)
      updateData.department = parsed.department;
    if (profile.year === null && parsed.year !== null) updateData.year = parsed.year;
    if (profile.email !== userEmail) {
      const existingEmailOwner = await prisma.profile.findUnique({
        where: { email: userEmail },
      });
      if (!existingEmailOwner) updateData.email = userEmail;
    }
    if (Object.keys(updateData).length > 0) {
      profile = await prisma.profile.update({
        where: { id: profile.id },
        data: updateData,
      });
    }
  }

  let regSetting = null;
  try {
    regSetting = await prisma.portalSetting.findUnique({ where: { key: "registrations_open" } });
  } catch (err) {
    console.warn("portalSetting lookup fallback:", err);
  }

  const [userRole, profiles, memberships, teams, invitations] = await Promise.all([
    getUserRole(activeUserId, userEmail),
    prisma.profile.findMany({ orderBy: { fullName: "asc" } }),
    prisma.teamMember.findMany(),
    prisma.team.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.invitation.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  const registrationsOpen = regSetting ? regSetting.value === "true" : true;
  const isAdmin = userRole === "admin";
  const isEvaluator = userRole === "evaluator";

  return { profile, isAdmin, isEvaluator, role: userRole, profiles, memberships, teams, invitations, registrationsOpen };
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

  const [profiles, memberships, teams, invitations] = await Promise.all([
    prisma.profile.findMany({ orderBy: { fullName: "asc" } }),
    prisma.teamMember.findMany(),
    prisma.team.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.invitation.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  const profile = await ensureProfile(session.id, session.email);
  const registrationsOpen = regSetting ? regSetting.value === "true" : true;

  return { profile, isAdmin: true, role: "admin" as const, profiles, memberships, teams, invitations, registrationsOpen };
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

  const [profiles, memberships, teams, invitations] = await Promise.all([
    prisma.profile.findMany({ orderBy: { fullName: "asc" } }),
    prisma.teamMember.findMany(),
    prisma.team.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.invitation.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  const profile = await ensureProfile(session.id, session.email);
  const registrationsOpen = regSetting ? regSetting.value === "true" : true;

  return { profile, isEvaluator: true, role: profile.role || "evaluator", profiles, memberships, teams, invitations, registrationsOpen };
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
