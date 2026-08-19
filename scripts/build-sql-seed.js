import XLSX from "xlsx";
import fs from "fs";

function parseYear(yearStr) {
  if (!yearStr) return "NULL";
  const s = String(yearStr).trim().toUpperCase();
  if (s === "IV" || s === "4") return 4;
  if (s === "III" || s === "3") return 3;
  if (s === "II" || s === "2") return 2;
  if (s === "I" || s === "1") return 1;
  return "NULL";
}

function esc(val) {
  if (val === null || val === undefined) return "NULL";
  const s = String(val).trim().replace(/'/g, "''");
  return s ? `'${s}'` : "NULL";
}

const wb = XLSX.readFile("SIH 2026 Team Formation (Responses).xlsx");
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet);

const profilesMap = new Map();
const teams = [];
const memberships = [];

rows.forEach((r, i) => {
  const teamName = r["Team Name"];
  if (!teamName) return;
  const category = r["SIH Interested Category"];
  const leaderEmail = String(r["Team Leader College Mail ID (Member 1)"] || r["Email Address"] || "").trim().toLowerCase();
  const leaderName = r["Team Leader Name (Member 1)"];
  const leaderRoll = String(r["Team Leader Roll Number (Member 1)"] || "").trim().toUpperCase();
  const leaderDept = r["Team Leader Department (Member 1)"];
  const leaderYear = parseYear(r["Team Leader Year of Study (Member 1)"]);
  const leaderPhone = r["Team Leader Contact Number (Member 1)"];

  if (!leaderEmail) return;

  const leaderId = `leader_${leaderRoll || i}_${i}`;
  profilesMap.set(leaderEmail, {
    id: leaderId,
    email: leaderEmail,
    name: leaderName || "Team Leader",
    roll: leaderRoll,
    dept: leaderDept,
    year: leaderYear,
    phone: leaderPhone,
    role: leaderEmail === "cfi@sece.ac.in" ? "admin" : "student"
  });

  const teamId = `team_${i + 1}`;
  teams.push({ id: teamId, name: teamName, category, leaderId });
  memberships.push({ teamId, userId: leaderId, isLeader: true });

  for (let m = 2; m <= 6; m++) {
    const mName = r[`Student Name (Member ${m})`];
    const mRoll = String(r[`Roll Number (Member ${m})`] || "").trim().toUpperCase();
    const mDept = r[`Department (Member ${m})`];
    const mYear = parseYear(r[`Year of Study (Member ${m})`]);

    if (!mName && !mRoll) continue;

    const mEmail = mRoll ? `${mRoll.toLowerCase()}@sece.ac.in` : `member_${i}_${m}@sece.ac.in`;
    const memberId = `member_${mRoll || i}_${m}_${i}`;

    if (!profilesMap.has(mEmail)) {
      profilesMap.set(mEmail, {
        id: memberId,
        email: mEmail,
        name: mName || `Member ${m}`,
        roll: mRoll,
        dept: mDept,
        year: mYear,
        phone: null,
        role: "student"
      });
    }

    const p = profilesMap.get(mEmail);
    memberships.push({ teamId, userId: p.id, isLeader: false });
  }
});

console.log("Total profiles:", profilesMap.size);
console.log("Total teams:", teams.length);
console.log("Total memberships:", memberships.length);

const profileValues = Array.from(profilesMap.values()).map(p =>
  `(${esc(p.id)}, ${esc(p.email)}, ${esc(p.name)}, ${esc(p.dept)}, ${p.year}, ${esc(p.phone)}, ${esc(p.role)}, ${esc(p.roll)})`
).join(",\n");

const teamValues = teams.map(t =>
  `(${esc(t.id)}, ${esc(t.name)}, ${esc(t.category)}, ${esc(t.leaderId)}, 'submitted')`
).join(",\n");

const memValues = memberships.map((m, idx) =>
  `('mem_${idx + 1}', ${esc(m.teamId)}, ${esc(m.userId)}, ${m.isLeader ? "true" : "false"})`
).join(",\n");

fs.writeFileSync("seed_profiles.sql", `
INSERT INTO public.profiles (id, email, full_name, department, year, phone, role, roll_number)
VALUES
${profileValues}
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  department = EXCLUDED.department,
  year = EXCLUDED.year,
  phone = EXCLUDED.phone,
  role = EXCLUDED.role,
  roll_number = EXCLUDED.roll_number;
`);

fs.writeFileSync("seed_teams.sql", `
INSERT INTO public.teams (id, name, category, leader_id, status)
VALUES
${teamValues}
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  leader_id = EXCLUDED.leader_id,
  status = EXCLUDED.status;

INSERT INTO public.team_members (id, team_id, user_id, is_leader)
VALUES
${memValues}
ON CONFLICT (user_id) DO UPDATE SET
  team_id = EXCLUDED.team_id,
  is_leader = EXCLUDED.is_leader;
`);

console.log("Generated seed_profiles.sql and seed_teams.sql successfully!");
