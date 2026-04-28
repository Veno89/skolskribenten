#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const projectId = process.env.SUPABASE_PROJECT_ID;
const dbUrl = process.env.SUPABASE_DB_URL;

if (!projectId && !dbUrl) {
  throw new Error("Set SUPABASE_PROJECT_ID or SUPABASE_DB_URL before running npm run db:types.");
}

const args = ["supabase", "gen", "types", "typescript", "--schema", "public"];

if (dbUrl) {
  args.push("--db-url", dbUrl);
} else {
  args.push("--project-id", projectId);
}

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(npx, args, {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
});

if (result.status !== 0) {
  throw new Error("Supabase type generation failed.");
}

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(rootDir, "types", "database.ts");

writeFileSync(outputPath, result.stdout);
console.log(`Generated ${outputPath}`);
