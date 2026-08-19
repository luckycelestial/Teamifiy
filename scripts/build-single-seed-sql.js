import fs from "fs";

const statements = JSON.parse(fs.readFileSync("statements.json", "utf8"));
const combinedSql = statements.join("\n\n");
fs.writeFileSync("seed_all.sql", combinedSql);
console.log(`Generated seed_all.sql with ${statements.length} statements (${combinedSql.length} bytes)!`);
