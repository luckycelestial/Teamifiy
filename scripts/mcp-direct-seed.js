import fs from "fs";

const pBatches = JSON.parse(fs.readFileSync("sql_batches.json", "utf8"));
console.log(`Loaded ${pBatches.length} batch SQL queries ready for Supabase execution.`);
