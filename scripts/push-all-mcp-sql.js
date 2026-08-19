import fs from "fs";

const statements: string[] = JSON.parse(fs.readFileSync("statements.json", "utf8"));
console.log(`Loaded ${statements.length} SQL statements to execute on Supabase Cloud.`);
