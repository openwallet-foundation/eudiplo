#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const base = process.argv[2] || "HEAD";
if (!/^[A-Za-z0-9_./-]+$/.test(base) || base.startsWith("-"))
  throw new Error("Invalid base revision");
const git = (...args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" });
const files = git("ls-tree", "-r", "--name-only", base, "--", "schemas")
  .split("\n")
  .filter((name) => /^schemas\/v[1-9][0-9]*\/.*\.schema\.json$/.test(name));
for (const file of files) {
  if (
    readFileSync(resolve(root, file), "utf8") !== git("show", `${base}:${file}`)
  )
    throw new Error(
      `Published schema changed: ${file}. Add a new version instead.`,
    );
}
console.log(
  `Preserved ${files.length} existing schema snapshots from ${base}.`,
);
