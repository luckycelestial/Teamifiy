import fs from "fs";

const mcpFiles = [
  "mcp_part_1.sql",
  "mcp_part_2.sql",
  "mcp_part_3.sql",
  "mcp_part_4.sql",
  "mcp_part_5.sql",
  "mcp_part_6.sql",
];

let allProfileLines = [];
mcpFiles.forEach((file) => {
  if (fs.existsSync(file)) {
    const text = fs.readFileSync(file, "utf8");
    const lines = text.split("\n").filter((l) => l.trim().startsWith("("));
    allProfileLines.push(...lines);
  }
});

console.log("Total profile lines parsed:", allProfileLines.length);

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

const profileChunks = chunkArray(allProfileLines, 250);

profileChunks.forEach((chk, i) => {
  let valStr = chk.join("\n");
  if (valStr.endsWith(",")) valStr = valStr.slice(0, -1);
  const sql = `INSERT INTO public.profiles (id, email, full_name, department, year, phone, role, roll_number)
VALUES
${valStr}
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  department = EXCLUDED.department,
  year = EXCLUDED.year,
  phone = EXCLUDED.phone,
  role = EXCLUDED.role,
  roll_number = EXCLUDED.roll_number;`;
  fs.writeFileSync(`run_profile_${i + 1}.sql`, sql);
});

console.log(`Generated ${profileChunks.length} profile execution files!`);
