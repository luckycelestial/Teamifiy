import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const supabase = createClient(url, key);

  console.log("Seeding Supabase Cloud database...");

  const wb = XLSX.readFile("SIH 2026 Team Formation (Responses).xlsx");
  const sheet = wb.Sheets[wb.SheetNames[0]!];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet!);

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
    const leaderId = `leader_${leaderRoll || Date.now()}_${i}`;
    const { data: existingLeader } = await supabase
      .from("profiles")
      .select("id")
      .or(`email.eq.${leaderEmail},roll_number.eq.${leaderRoll}`)
      .maybeSingle();

    const activeLeaderId = existingLeader?.id || leaderId;

    await supabase.from("profiles").upsert({
      id: activeLeaderId,
      email: leaderEmail,
      full_name: leaderName || "Team Leader",
      roll_number: leaderRoll,
      department: leaderDept,
      year: leaderYear,
      phone: leaderPhone,
      role: "student",
    });

    // Team
    const { data: existingTeam } = await supabase
      .from("teams")
      .select("id")
      .eq("leader_id", activeLeaderId)
      .maybeSingle();

    const teamId = existingTeam?.id || `team_${i + 1}_${Date.now()}`;

    await supabase.from("teams").upsert({
      id: teamId,
      name: teamName,
      category: category,
      leader_id: activeLeaderId,
      status: "submitted",
    });

    // Leader membership
    await supabase.from("team_members").upsert({
      team_id: teamId,
      user_id: activeLeaderId,
      is_leader: true,
    }, { onConflict: "user_id" });

    // Members 2..6
    for (let m = 2; m <= 6; m++) {
      const mName = cleanString(r[`Student Name (Member ${m})`]);
      const mRoll = cleanString(r[`Roll Number (Member ${m})`]).toUpperCase();
      const mDept = cleanString(r[`Department (Member ${m})`]);
      const mYear = parseYear(r[`Year of Study (Member ${m})`]);

      if (!mName && !mRoll) continue;

      const mEmail = mRoll ? `${mRoll.toLowerCase()}@sece.ac.in` : `member_${mRoll || i}_${m}@sece.ac.in`;

      const { data: existingMember } = await supabase
        .from("profiles")
        .select("id")
        .or(`email.eq.${mEmail},roll_number.eq.${mRoll}`)
        .maybeSingle();

      const memberId = existingMember?.id || `member_${mRoll || Date.now()}_${i}_${m}`;

      await supabase.from("profiles").upsert({
        id: memberId,
        email: mEmail,
        full_name: mName || `Member ${m}`,
        roll_number: mRoll,
        department: mDept,
        year: mYear,
        role: "student",
      });

      await supabase.from("team_members").upsert({
        team_id: teamId,
        user_id: memberId,
        is_leader: false,
      }, { onConflict: "user_id" });
    }
  }

  console.log("Supabase Cloud seeding completed successfully!");
}

main().catch(console.error);
