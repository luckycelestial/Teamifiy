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
  console.log("Starting Excel team import...");
  const wb = XLSX.readFile("SIH 2026 Team Formation (Responses).xlsx");
  const sheet = wb.Sheets[wb.SheetNames[0]!];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet!);

  console.log(`Found ${rows.length} total team responses in Excel.`);

  let teamsCreated = 0;
  let profilesCreated = 0;
  let membersCreated = 0;

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

    if (!leaderEmail) {
      console.warn(`Row ${i + 2}: Skipping team '${teamName}' - missing leader email.`);
      continue;
    }

    // 1. Upsert Leader Profile
    let leaderProfile = await prisma.profile.findFirst({
      where: {
        OR: [{ email: leaderEmail }, ...(leaderRoll ? [{ rollNumber: leaderRoll }] : [])],
      },
    });

    if (leaderProfile) {
      leaderProfile = await prisma.profile.update({
        where: { id: leaderProfile.id },
        data: {
          email: leaderEmail,
          fullName: leaderName || leaderProfile.fullName,
          rollNumber: leaderRoll || leaderProfile.rollNumber,
          department: leaderDept || leaderProfile.department,
          year: leaderYear ?? leaderProfile.year,
          phone: leaderPhone || leaderProfile.phone,
        },
      });
    } else {
      leaderProfile = await prisma.profile.create({
        data: {
          id: `leader_${leaderRoll || Date.now()}_${i}`,
          email: leaderEmail,
          fullName: leaderName || "Team Leader",
          rollNumber: leaderRoll,
          department: leaderDept,
          year: leaderYear,
          phone: leaderPhone,
          role: "student",
        },
      });
      profilesCreated++;
    }

    // 2. Upsert Team
    let team = await prisma.team.findFirst({
      where: { leaderId: leaderProfile.id },
    });

    if (team) {
      team = await prisma.team.update({
        where: { id: team.id },
        data: {
          name: teamName,
          category: category || team.category,
          status: "submitted",
        },
      });
    } else {
      team = await prisma.team.create({
        data: {
          name: teamName,
          category: category,
          leaderId: leaderProfile.id,
          status: "submitted",
        },
      });
      teamsCreated++;
    }

    // 3. Process Leader Membership
    const existingLeaderMem = await prisma.teamMember.findFirst({
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
      membersCreated++;
    } else if (existingLeaderMem.teamId !== team.id) {
      await prisma.teamMember.update({
        where: { id: existingLeaderMem.id },
        data: { teamId: team.id, isLeader: true },
      });
    }

    // 4. Process Members 2..6
    for (let m = 2; m <= 6; m++) {
      const mName = cleanString(r[`Student Name (Member ${m})`]);
      const mRoll = cleanString(r[`Roll Number (Member ${m})`]).toUpperCase();
      const mDept = cleanString(r[`Department (Member ${m})`]);
      const mYear = parseYear(r[`Year of Study (Member ${m})`]);

      if (!mName && !mRoll) continue;

      const mEmail = mRoll ? `${mRoll.toLowerCase()}@sece.ac.in` : `member_${mRoll || i}_${m}@sece.ac.in`;

      let memberProfile = await prisma.profile.findFirst({
        where: {
          OR: [{ email: mEmail }, ...(mRoll ? [{ rollNumber: mRoll }] : [])],
        },
      });

      if (memberProfile) {
        memberProfile = await prisma.profile.update({
          where: { id: memberProfile.id },
          data: {
            fullName: mName || memberProfile.fullName,
            rollNumber: mRoll || memberProfile.rollNumber,
            department: mDept || memberProfile.department,
            year: mYear ?? memberProfile.year,
          },
        });
      } else {
        memberProfile = await prisma.profile.create({
          data: {
            id: `member_${mRoll || Date.now()}_${i}_${m}`,
            email: mEmail,
            fullName: mName || `Member ${m}`,
            rollNumber: mRoll,
            department: mDept,
            year: mYear,
            role: "student",
          },
        });
        profilesCreated++;
      }

      const existingMem = await prisma.teamMember.findFirst({
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
        membersCreated++;
      } else if (existingMem.teamId !== team.id) {
        await prisma.teamMember.update({
          where: { id: existingMem.id },
          data: { teamId: team.id, isLeader: false },
        });
      }
    }
  }

  console.log(`Import complete! Created ${teamsCreated} teams, ${profilesCreated} profiles, ${membersCreated} team memberships.`);
}

main()
  .catch((e) => {
    console.error("Import failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
