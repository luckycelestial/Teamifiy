import fs from "fs";

const pBatches = JSON.parse(fs.readFileSync("sql_batches.json", "utf8"));

// 1. Profiles SQL (Batches 1 to 9)
const profilesSql = pBatches.slice(0, 9).join("\n\n");
fs.writeFileSync("supabase_part1_profiles.sql", profilesSql);

// 2. Teams SQL (Batches 10 to 12)
const teamsSql = pBatches.slice(9, 12).join("\n\n");
fs.writeFileSync("supabase_part2_teams.sql", teamsSql);

// 3. Memberships SQL (Batches 13 to 21)
const memSql = pBatches.slice(12).join("\n\n");
fs.writeFileSync("supabase_part3_members.sql", memSql);

console.log("Created 3 partition files successfully!");
