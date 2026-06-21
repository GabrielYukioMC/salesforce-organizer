#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

const options = parseArgs(process.argv.slice(2));
const sourceRoot = options["source-root"] ?? "force-app";
const testsFile = options["tests-file"] ?? ".github/salesforce-pr-test-classes.txt";
const outDir = options["out-dir"] ?? "deploy-results";
const base = options.base;
const head = options.head;

function fail(message, exitCode = 1) {
  console.error(message);
  process.exit(exitCode);
}

function parseArgs(args) {
  const parsed = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg.startsWith("--")) {
      fail(`Unexpected argument: ${arg}`, 2);
    }

    const key = arg.slice(2);
    const value = args[index + 1];

    if (!value || value.startsWith("--")) {
      fail(`Missing value for --${key}`, 2);
    }

    parsed[key] = value;
    index += 1;
  }

  return parsed;
}

function normalizePath(filePath) {
  return filePath.replaceAll("\\", "/");
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function runGitDiff(diffFilter) {
  const output = execFileSync(
    "git",
    ["diff", "--name-only", `--diff-filter=${diffFilter}`, base, head, "--", sourceRoot],
    { encoding: "utf8" },
  );

  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(normalizePath);
}

function pathExists(filePath) {
  return fs
    .access(filePath)
    .then(() => true)
    .catch(() => false);
}

function classSourcePath(filePath) {
  if (filePath.endsWith(".cls")) {
    return filePath;
  }

  if (filePath.endsWith(".cls-meta.xml")) {
    return filePath.slice(0, -"-meta.xml".length);
  }

  return filePath;
}

function triggerSourcePath(filePath) {
  if (filePath.endsWith(".trigger")) {
    return filePath;
  }

  if (filePath.endsWith(".trigger-meta.xml")) {
    return filePath.slice(0, -"-meta.xml".length);
  }

  return filePath;
}

function bundleRoot(filePath, metadataFolder) {
  const parts = normalizePath(filePath).split("/");
  const folderIndex = parts.indexOf(metadataFolder);

  if (folderIndex === -1 || parts.length <= folderIndex + 1) {
    return filePath;
  }

  return parts.slice(0, folderIndex + 2).join("/");
}

async function deploySourcePathFor(filePath) {
  const normalized = normalizePath(filePath);

  if (normalized.includes("/lwc/")) {
    return bundleRoot(normalized, "lwc");
  }

  if (normalized.includes("/aura/")) {
    return bundleRoot(normalized, "aura");
  }

  if (normalized.includes("/classes/")) {
    const sourcePath = classSourcePath(normalized);
    return (await pathExists(sourcePath)) ? sourcePath : normalized;
  }

  if (normalized.includes("/triggers/")) {
    const sourcePath = triggerSourcePath(normalized);
    return (await pathExists(sourcePath)) ? sourcePath : normalized;
  }

  return normalized;
}

function apexNameFromPath(filePath) {
  const normalized = normalizePath(filePath);
  const fileName = path.posix.basename(normalized);

  if (normalized.includes("/classes/")) {
    return fileName.replace(/\.cls(?:-meta\.xml)?$/, "");
  }

  if (normalized.includes("/triggers/")) {
    return fileName.replace(/\.trigger(?:-meta\.xml)?$/, "");
  }

  return null;
}

async function isApexTestClass(filePath, apexName) {
  if (!filePath.includes("/classes/")) {
    return false;
  }

  const sourcePath = classSourcePath(filePath);

  try {
    const contents = await fs.readFile(sourcePath, "utf8");
    return /@isTest\b/i.test(contents);
  } catch {
    return /(?:Test|Tests)$/i.test(apexName);
  }
}

async function collectApexCoverageTargets(changedFiles) {
  const targets = [];

  for (const filePath of changedFiles) {
    if (!filePath.includes("/classes/") && !filePath.includes("/triggers/")) {
      continue;
    }

    if (
      !filePath.endsWith(".cls") &&
      !filePath.endsWith(".cls-meta.xml") &&
      !filePath.endsWith(".trigger") &&
      !filePath.endsWith(".trigger-meta.xml")
    ) {
      continue;
    }

    const apexName = apexNameFromPath(filePath);
    if (!apexName) {
      continue;
    }

    if (await isApexTestClass(filePath, apexName)) {
      continue;
    }

    targets.push(apexName);
  }

  return uniqueSorted(targets);
}

async function readTestClasses() {
  let contents;

  try {
    contents = await fs.readFile(testsFile, "utf8");
  } catch (error) {
    fail(`Could not read test class file "${testsFile}": ${error.message}`);
  }

  const testClasses = contents
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  for (const testClass of testClasses) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(testClass)) {
      fail(`Invalid test class entry in "${testsFile}": ${testClass}. Use one Apex class name per line.`);
    }
  }

  return uniqueSorted(testClasses);
}

async function writeLines(filePath, lines) {
  const contents = lines.length > 0 ? `${lines.join("\n")}\n` : "";
  await fs.writeFile(filePath, contents, "utf8");
}

async function writeGithubOutputs(outputs) {
  if (!process.env.GITHUB_OUTPUT) {
    return;
  }

  const lines = Object.entries(outputs).map(([key, value]) => `${key}=${value}`);
  await fs.appendFile(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`, "utf8");
}

if (!base || !head) {
  fail("Both --base and --head are required.", 2);
}

await fs.mkdir(outDir, { recursive: true });

const changedFiles = runGitDiff("ACMRT");
const deletedFiles = runGitDiff("D");

if (deletedFiles.length > 0) {
  console.error("Deleted Salesforce metadata was detected in this PR:");
  for (const deletedFile of deletedFiles) {
    console.error(`- ${deletedFile}`);
  }
  fail("Incremental PR validation currently supports added, changed, renamed, copied, and type-changed files only. Add destructiveChanges support before deleting metadata.");
}

const deploySourcePaths = uniqueSorted(await Promise.all(changedFiles.map(deploySourcePathFor)));
const apexTargets = await collectApexCoverageTargets(changedFiles);
const testClasses = await readTestClasses();

if (deploySourcePaths.length > 0 && testClasses.length === 0) {
  fail(`No test classes were found in "${testsFile}". Add one Apex test class per line.`);
}

await writeLines(path.join(outDir, "pr-changed-files.txt"), changedFiles);
await writeLines(path.join(outDir, "pr-source-paths.txt"), deploySourcePaths);
await writeLines(path.join(outDir, "pr-apex-targets.txt"), apexTargets);
await writeLines(path.join(outDir, "pr-test-classes.txt"), testClasses);

await writeGithubOutputs({
  has_deployable_changes: String(deploySourcePaths.length > 0),
  has_apex_targets: String(apexTargets.length > 0),
  deploy_source_count: String(deploySourcePaths.length),
  apex_target_count: String(apexTargets.length),
  test_class_count: String(testClasses.length),
});

console.log(`Changed Salesforce files: ${changedFiles.length}`);
console.log(`Deploy source paths: ${deploySourcePaths.length}`);
for (const sourcePath of deploySourcePaths) {
  console.log(`- ${sourcePath}`);
}

console.log(`Apex coverage targets: ${apexTargets.length}`);
for (const apexTarget of apexTargets) {
  console.log(`- ${apexTarget}`);
}

console.log(`Configured test classes: ${testClasses.length}`);
for (const testClass of testClasses) {
  console.log(`- ${testClass}`);
}
