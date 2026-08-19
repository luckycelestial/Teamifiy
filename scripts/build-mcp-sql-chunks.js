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

// Admin profile
profilesMap.set("cfi@sece.ac.in", {
  id: "admin_cfi_coordinator",
  email: "cfi@sece.ac.in",
  name: "Centre for Innovation Coordinator",
  roll: null,
  dept: "Innovation Studio",
  year: "NULL",
  phone: null,
  role: "admin",
});

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
  if (!profilesMap.has(leaderEmail)) {
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
  }

  const activeLeader = profilesMap.get(leaderEmail);
  const teamId = `team_${i + 1}`;
  teams.push({ id: teamId, name: teamName, category, leaderId: activeLeader.id });
  memberships.push({ teamId, userId: activeLeader.id, isLeader: true });

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

const profiles = Array.from(profilesMap.values());

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

const profileChunks = chunkArray(profiles, 150);
const teamChunks = chunkArray(teams, 100);
const memChunks = chunkArray(memberships, 200);

let statements = [];

profileChunks.forEach((chunk) => {
  const vals = chunk.map(p =>
    `(${esc(p.id)}, ${esc(p.email)}, ${esc(p.name)}, ${esc(p.dept)}, ${p.year}, ${esc(p.phone)}, ${esc(p.role)}, ${esc(p.roll)})`
  ).join(",\n");

  statements.push(`INSERT INTO public.profiles (id, email, full_name, department, year, phone, role, roll_number)
VALUES
${vals}
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  department = EXCLUDED.department,
  year = EXCLUDED.year,
  phone = EXCLUDED.phone,
  role = EXCLUDED.role,
  roll_number = EXCLUDED.roll_number;`);
});

teamChunks.forEach((chunk) => {
  const vals = chunk.map(t =>
    `(${esc(t.id)}, ${esc(t.name)}, ${esc(t.category)}, ${esc(t.leaderId)}, 'submitted')`
  ).join(",\n");

  statements.push(`INSERT INTO public.teams (id, name, category, leader_id, status)
VALUES
${vals}
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  leader_id = EXCLUDED.leader_id,
  status = EXCLUDED.status;`);
});

memChunks.forEach((chunk, idx) => {
  const vals = chunk.map((m, i) =>
    `('mem_${idx}_${i}', ${esc(m.teamId)}, ${esc(m.userId)}, ${m.isLeader ? "true" : "false"})`
  ).join(",\n");

  statements.push(`INSERT INTO public.team_members (id, team_id, user_id, is_leader)
VALUES
${vals}
ON CONFLICT (user_id) DO UPDATE SET
  team_id = EXCLUDED.team_id,
  is_leader = EXCLUDED.is_leader;`);
});

fs.writeFileSync("statements.json", JSON.stringify(statements, null, 2));
console.log(`Generated ${statements.length} SQL statements in statements.json!`);
