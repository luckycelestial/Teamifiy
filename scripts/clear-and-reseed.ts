import XLSX from "xlsx";
import { prisma } from "../src/lib/prisma";

function parseYear(yearStr: string | number | null | undefined): number | null {
  if (!yearStr) return null;
  const s = String(yearStr).trim().toUpperCase();
  if (s === "IV" || s === "4") return 4;
  if (s === "III" || s === "3") return 3;
  if (s === "II" || s === "2") return 2;
  if (s === "I" || s === "1") return 1;
  return null;
}

function cleanString(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

async function main() {
  console.log("1. Clearing database tables completely...");
  await prisma.invitation.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.team.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.portalSetting.deleteMany();
  console.log("Database cleared successfully!");

  console.log("2. Inserting Admin profile (cfi@sece.ac.in)...");
  await prisma.profile.create({
    data: {
      id: "admin_cfi_coordinator",
      email: "cfi@sece.ac.in",
      fullName: "Centre for Innovation Coordinator",
      department: "Innovation Studio",
      role: "admin",
    },
  });

  console.log("3. Reading SIH 2026 Team Formation (Responses).xlsx...");
  const wb = XLSX.readFile("SIH 2026 Team Formation (Responses).xlsx");
  const sheet = wb.Sheets[wb.SheetNames[0]!];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet!);

  console.log(`Processing ${rows.length} team responses...`);

  let teamsCount = 0;
  let profilesCount = 1; // Admin profile
  let membersCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    const teamName = cleanString(r["Team Name"]);
    if (!teamName) continue;

    const category = cleanString(r["SIH Interested Category"]);
    const leaderEmail = cleanString(r["Team Leader College Mail ID (Member 1)"] || r["Email Address"]).toLowerCase();
    const leaderName = cleanString(r["Team Leader Name (Member 1)"]);
    const leaderRoll = cleanString(r["Team Leader Roll Number (Member 1)"]).toUpperCase();
    const leaderDept = cleanString(r["Team Leader Department (Member 1)"]);
    const leaderYear = parseYear(r["Team Leader Year of Study (Member 1)"]);
    const leaderPhone = cleanString(r["Team Leader Contact Number (Member 1)"]);

    if (!leaderEmail) continue;

    // Leader profile
    let leaderProfile = await prisma.profile.findFirst({
      where: {
        OR: [{ email: leaderEmail }, ...(leaderRoll ? [{ rollNumber: leaderRoll }] : [])],
      },
    });

    if (!leaderProfile) {
      leaderProfile = await prisma.profile.create({
        data: {
          id: `leader_${leaderRoll || i}_${i}`,
          email: leaderEmail,
          fullName: leaderName || "Team Leader",
          rollNumber: leaderRoll,
          department: leaderDept,
          year: leaderYear,
          phone: leaderPhone,
          role: leaderEmail === "cfi@sece.ac.in" ? "admin" : "student",
        },
      });
      profilesCount++;
    }

    // Create Team
    const team = await prisma.team.create({
      data: {
        id: `team_${i + 1}`,
        name: teamName,
        category: category || "General",
        leaderId: leaderProfile.id,
        status: "submitted",
      },
    });
    teamsCount++;

    // Add Leader membership
    const existingLeaderMem = await prisma.teamMember.findUnique({
      where: { userId: leaderProfile.id },
    });
    if (!existingLeaderMem) {
      await prisma.teamMember.create({
        data: {
          teamId: team.id,
          userId: leaderProfile.id,
          isLeader: true,
        },
      });
      membersCount++;
    }

    // Process Members 2..6
    for (let m = 2; m <= 6; m++) {
      const mName = cleanString(r[`Student Name (Member ${m})`]);
      const mRoll = cleanString(r[`Roll Number (Member ${m})`]).toUpperCase();
      const mDept = cleanString(r[`Department (Member ${m})`]);
      const mYear = parseYear(r[`Year of Study (Member ${m})`]);

      if (!mName && !mRoll) continue;

      const mEmail = mRoll ? `${mRoll.toLowerCase()}@sece.ac.in` : `member_${i}_${m}@sece.ac.in`;

      let memberProfile = await prisma.profile.findFirst({
        where: {
          OR: [{ email: mEmail }, ...(mRoll ? [{ rollNumber: mRoll }] : [])],
        },
      });

      if (!memberProfile) {
        memberProfile = await prisma.profile.create({
          data: {
            id: `member_${mRoll || i}_${m}_${i}`,
            email: mEmail,
            fullName: mName || `Member ${m}`,
            rollNumber: mRoll,
            department: mDept,
            year: mYear,
            role: "student",
          },
        });
        profilesCount++;
      }

      const existingMem = await prisma.teamMember.findUnique({
        where: { userId: memberProfile.id },
      });

      if (!existingMem) {
        await prisma.teamMember.create({
          data: {
            teamId: team.id,
            userId: memberProfile.id,
            isLeader: false,
          },
        });
        membersCount++;
      }
    }
  }

  console.log(`Reseed complete! Inserted ${teamsCount} teams, ${profilesCount} profiles, and ${membersCount} team memberships.`);
}

main()
  .catch((e) => {
    console.error("Reseed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
