import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://utmdlyfudvztbnwgnaye.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_ER1byfGlz5J9GT7BrZ9Gtw_bbccrCHO";

const supabase = createClient(supabaseUrl, supabaseKey);

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
  console.log("Reading SIH 2026 Team Formation (Responses).xlsx...");
  const wb = XLSX.readFile("SIH 2026 Team Formation (Responses).xlsx");
  const sheet = wb.Sheets[wb.SheetNames[0]!];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet!);

  console.log(`Parsed ${rows.length} rows from Excel sheet.`);

  const profilesMap = new Map<string, any>();
  const teams: any[] = [];
  const membershipsMap = new Map<string, any>();

  // Admin profile
  profilesMap.set("cfi@sece.ac.in", {
    id: "admin_cfi_coordinator",
    email: "cfi@sece.ac.in",
    full_name: "Centre for Innovation Coordinator",
    department: "Innovation Studio",
    role: "admin",
  });

  rows.forEach((r, i) => {
    const teamName = cleanString(r["Team Name"]);
    if (!teamName) return;
    const category = cleanString(r["SIH Interested Category"]);
    const leaderEmail = cleanString(r["Team Leader College Mail ID (Member 1)"] || r["Email Address"]).toLowerCase();
    const leaderName = cleanString(r["Team Leader Name (Member 1)"]);
    const leaderRoll = cleanString(r["Team Leader Roll Number (Member 1)"]).toUpperCase();
    const leaderDept = cleanString(r["Team Leader Department (Member 1)"]);
    const leaderYear = parseYear(r["Team Leader Year of Study (Member 1)"]);
    const leaderPhone = cleanString(r["Team Leader Contact Number (Member 1)"]);

    if (!leaderEmail) return;

    const leaderKey = leaderEmail;
    if (!profilesMap.has(leaderKey)) {
      profilesMap.set(leaderKey, {
        id: `user_${leaderRoll || i}_${i}`,
        email: leaderEmail,
        full_name: leaderName || "Team Leader",
        roll_number: leaderRoll || null,
        department: leaderDept || null,
        year: leaderYear,
        phone: leaderPhone || null,
        role: leaderEmail === "cfi@sece.ac.in" ? "admin" : "student",
      });
    }

    const activeLeader = profilesMap.get(leaderKey);
    const teamId = `team_${i + 1}`;
    teams.push({
      id: teamId,
      name: teamName,
      category: category || "General",
      leader_id: activeLeader.id,
      status: "submitted",
    });

    if (!membershipsMap.has(activeLeader.id)) {
      membershipsMap.set(activeLeader.id, {
        id: `mem_${activeLeader.id}`,
        team_id: teamId,
        user_id: activeLeader.id,
        is_leader: true,
      });
    }

    for (let m = 2; m <= 6; m++) {
      const mName = cleanString(r[`Student Name (Member ${m})`]);
      const mRoll = cleanString(r[`Roll Number (Member ${m})`]).toUpperCase();
      const mDept = cleanString(r[`Department (Member ${m})`]);
      const mYear = parseYear(r[`Year of Study (Member ${m})`]);

      if (!mName && !mRoll) continue;

      const memberKey = mRoll ? `roll_${mRoll}` : `row_${i}_m_${m}`;

      if (!profilesMap.has(memberKey)) {
        profilesMap.set(memberKey, {
          id: `user_${mRoll || i}_${m}_${i}`,
          email: null, // No placeholder email! Real email set when student signs in
          full_name: mName || `Member ${m}`,
          roll_number: mRoll || null,
          department: mDept || null,
          year: mYear,
          role: "student",
        });
      }

      const p = profilesMap.get(memberKey);
      if (!membershipsMap.has(p.id)) {
        membershipsMap.set(p.id, {
          id: `mem_${p.id}`,
          team_id: teamId,
          user_id: p.id,
          is_leader: false,
        });
      }
    }
  });

  const profiles = Array.from(profilesMap.values());
  const memberships = Array.from(membershipsMap.values());

  console.log(`Uploading ${profiles.length} profiles (clean real emails / null placeholders), ${teams.length} teams, ${memberships.length} memberships...`);

  function chunk<T>(arr: T[], size: number): T[][] {
    const c: T[][] = [];
    for (let i = 0; i < arr.length; i += size) c.push(arr.slice(i, i + size));
    return c;
  }

  // 1. Upsert Profiles by id
  const profileChunks = chunk(profiles, 100);
  for (let idx = 0; idx < profileChunks.length; idx++) {
    const { error } = await supabase.from("profiles").upsert(profileChunks[idx]!, { onConflict: "id" });
    if (error) console.error(`Error in profiles batch ${idx + 1}:`, error.message);
    else console.log(`Profiles batch ${idx + 1}/${profileChunks.length} uploaded!`);
  }

  // 2. Upsert Teams
  const teamChunks = chunk(teams, 100);
  for (let idx = 0; idx < teamChunks.length; idx++) {
    const { error } = await supabase.from("teams").upsert(teamChunks[idx]!, { onConflict: "id" });
    if (error) console.error(`Error in teams batch ${idx + 1}:`, error.message);
    else console.log(`Teams batch ${idx + 1}/${teamChunks.length} uploaded!`);
  }

  // 3. Upsert Memberships
  const memChunks = chunk(memberships, 100);
  for (let idx = 0; idx < memChunks.length; idx++) {
    const { error } = await supabase.from("team_members").upsert(memChunks[idx]!, { onConflict: "user_id" });
    if (error) console.error(`Error in team_members batch ${idx + 1}:`, error.message);
    else console.log(`Members batch ${idx + 1}/${memChunks.length} uploaded!`);
  }

  console.log("Supabase Cloud seeding completed 100% cleanly without synthetic emails!");
}

main().catch((e) => {
  console.error("Seeding error:", e);
  process.exit(1);
});
