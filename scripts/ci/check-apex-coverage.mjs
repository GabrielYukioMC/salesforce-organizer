#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";

const [, , resultsDirArg, thresholdArg = "80", targetsFileArg] = process.argv;

function fail(message, exitCode = 1) {
  console.error(message);
  process.exit(exitCode);
}

if (!resultsDirArg) {
  fail("Usage: node scripts/ci/check-apex-coverage.mjs <results-dir> [threshold] [targets-file]", 2);
}

const threshold = Number(thresholdArg);

if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
  fail(`Invalid coverage threshold: ${thresholdArg}. Expected a number between 0 and 100.`, 2);
}

async function listJsonFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listJsonFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(entryPath);
    }
  }

  return files;
}

async function readListFile(filePath) {
  if (!filePath) {
    return [];
  }

  const contents = await fs.readFile(filePath, "utf8");

  return contents
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

function toPercent(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value <= 1 ? value * 100 : value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const match = value.trim().match(/^(\d+(?:\.\d+)?)%?$/);
  if (!match) {
    return null;
  }

  return Number(match[1]);
}

function normalizeApexName(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const normalized = value.trim().replaceAll("\\", "/");
  const fileName = path.posix.basename(normalized);

  return fileName
    .replace(/\.cls(?:-meta\.xml)?$/i, "")
    .replace(/\.trigger(?:-meta\.xml)?$/i, "");
}

function addPercent(candidates, file, label, value) {
  const percent = toPercent(value);

  if (percent === null || percent < 0 || percent > 100) {
    return;
  }

  candidates.push({ file, label, percent });
}

function addRatio(candidates, file, label, coveredValue, totalValue) {
  const covered = Number(coveredValue);
  const total = Number(totalValue);

  if (!Number.isFinite(covered) || !Number.isFinite(total) || total <= 0) {
    return;
  }

  candidates.push({
    file,
    label,
    percent: (covered / total) * 100,
  });
}

function addNamedPercent(candidates, file, name, label, value) {
  const percent = toPercent(value);

  if (!name || percent === null || percent < 0 || percent > 100) {
    return;
  }

  candidates.push({ file, name, label, percent });
}

function addNamedRatio(candidates, file, name, label, coveredValue, totalValue) {
  const covered = Number(coveredValue);
  const total = Number(totalValue);

  if (!name || !Number.isFinite(covered) || !Number.isFinite(total) || total <= 0) {
    return;
  }

  candidates.push({
    file,
    name,
    label,
    percent: (covered / total) * 100,
  });
}

function inferNameFromObject(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const nameFields = [
    "name",
    "className",
    "apexClassName",
    "apexClassOrTriggerName",
    "ApexClassOrTriggerName",
  ];

  for (const field of nameFields) {
    const name = normalizeApexName(value[field]);
    if (name) {
      return name;
    }
  }

  const nestedCandidates = [
    value.ApexClassOrTrigger?.Name,
    value.apexClassOrTrigger?.name,
    value.apexClass?.name,
    value.ApexClass?.Name,
  ];

  for (const candidate of nestedCandidates) {
    const name = normalizeApexName(candidate);
    if (name) {
      return name;
    }
  }

  return null;
}

function collectAggregateCoverageCandidates(json, file) {
  const candidates = [];

  addPercent(candidates, file, "total.lines.pct", json?.total?.lines?.pct);
  addRatio(candidates, file, "total.lines.covered/total", json?.total?.lines?.covered, json?.total?.lines?.total);
  addPercent(candidates, file, "total.statements.pct", json?.total?.statements?.pct);
  addRatio(
    candidates,
    file,
    "total.statements.covered/total",
    json?.total?.statements?.covered,
    json?.total?.statements?.total,
  );

  const targetedKeys = new Set(["testRunCoverage", "orgWideCoverage", "apexCoverage"]);
  const stack = [{ value: json, label: "root" }];

  while (stack.length > 0) {
    const { value, label } = stack.pop();

    if (!value || typeof value !== "object") {
      continue;
    }

    for (const [key, child] of Object.entries(value)) {
      const childLabel = `${label}.${key}`;

      if (targetedKeys.has(key)) {
        addPercent(candidates, file, childLabel, child);
      }

      if (child && typeof child === "object") {
        if ("coveredLines" in child && "totalLines" in child) {
          addRatio(candidates, file, `${childLabel}.coveredLines/totalLines`, child.coveredLines, child.totalLines);
        }

        if ("numLocations" in child && "numLocationsNotCovered" in child) {
          const totalLocations = Number(child.numLocations);
          const uncoveredLocations = Number(child.numLocationsNotCovered);

          if (Number.isFinite(totalLocations) && Number.isFinite(uncoveredLocations) && totalLocations > 0) {
            addRatio(
              candidates,
              file,
              `${childLabel}.locationsCovered/numLocations`,
              totalLocations - uncoveredLocations,
              totalLocations,
            );
          }
        }

        stack.push({ value: child, label: childLabel });
      }
    }
  }

  return candidates;
}

function collectNamedCoverageCandidates(json, file) {
  const candidates = [];

  if (json && typeof json === "object") {
    for (const [key, child] of Object.entries(json)) {
      const name = normalizeApexName(key);

      if (!name || !child || typeof child !== "object") {
        continue;
      }

      addNamedPercent(candidates, file, name, `${key}.lines.pct`, child.lines?.pct);
      addNamedRatio(candidates, file, name, `${key}.lines.covered/total`, child.lines?.covered, child.lines?.total);
      addNamedPercent(candidates, file, name, `${key}.statements.pct`, child.statements?.pct);
      addNamedRatio(
        candidates,
        file,
        name,
        `${key}.statements.covered/total`,
        child.statements?.covered,
        child.statements?.total,
      );
    }
  }

  const stack = [{ value: json, label: "root" }];

  while (stack.length > 0) {
    const { value, label } = stack.pop();

    if (!value || typeof value !== "object") {
      continue;
    }

    const name = inferNameFromObject(value);

    if (name) {
      addNamedPercent(candidates, file, name, `${label}.coveredPercent`, value.coveredPercent);
      addNamedPercent(candidates, file, name, `${label}.coveragePercent`, value.coveragePercent);
      addNamedPercent(candidates, file, name, `${label}.percentCovered`, value.percentCovered);
      addNamedPercent(candidates, file, name, `${label}.lines.pct`, value.lines?.pct);
      addNamedRatio(candidates, file, name, `${label}.lines.covered/total`, value.lines?.covered, value.lines?.total);
      addNamedRatio(candidates, file, name, `${label}.coveredLines/totalLines`, value.coveredLines, value.totalLines);
      addNamedRatio(
        candidates,
        file,
        name,
        `${label}.NumLinesCovered/(covered+uncovered)`,
        value.NumLinesCovered,
        Number(value.NumLinesCovered) + Number(value.NumLinesUncovered),
      );
      addNamedRatio(
        candidates,
        file,
        name,
        `${label}.numLinesCovered/(covered+uncovered)`,
        value.numLinesCovered,
        Number(value.numLinesCovered) + Number(value.numLinesUncovered),
      );

      if ("numLocations" in value && "numLocationsNotCovered" in value) {
        const totalLocations = Number(value.numLocations);
        const uncoveredLocations = Number(value.numLocationsNotCovered);

        if (Number.isFinite(totalLocations) && Number.isFinite(uncoveredLocations) && totalLocations > 0) {
          addNamedRatio(
            candidates,
            file,
            name,
            `${label}.locationsCovered/numLocations`,
            totalLocations - uncoveredLocations,
            totalLocations,
          );
        }
      }
    }

    for (const [key, child] of Object.entries(value)) {
      if (child && typeof child === "object") {
        stack.push({ value: child, label: `${label}.${key}` });
      }
    }
  }

  return candidates;
}

function rankAggregateCandidate(candidate) {
  const normalizedFile = candidate.file.replaceAll(path.sep, "/");
  let score = 0;

  if (normalizedFile.endsWith("coverage-summary.json")) {
    score += 100;
  }

  if (candidate.label === "total.lines.pct") {
    score += 50;
  }

  if (candidate.label === "total.lines.covered/total") {
    score += 45;
  }

  if (candidate.label.includes("testRunCoverage")) {
    score += 30;
  }

  if (candidate.label.includes("orgWideCoverage")) {
    score += 20;
  }

  return score;
}

function rankNamedCandidate(candidate) {
  const normalizedFile = candidate.file.replaceAll(path.sep, "/");
  let score = 0;

  if (normalizedFile.endsWith("coverage-summary.json")) {
    score += 100;
  }

  if (candidate.label.includes(".lines.pct")) {
    score += 50;
  }

  if (candidate.label.includes(".lines.covered/total")) {
    score += 45;
  }

  if (candidate.label.includes("NumLinesCovered") || candidate.label.includes("numLinesCovered")) {
    score += 35;
  }

  if (candidate.label.includes("coveredPercent") || candidate.label.includes("coveragePercent")) {
    score += 30;
  }

  return score;
}

async function readCoverageFiles() {
  let jsonFiles;

  try {
    jsonFiles = await listJsonFiles(resultsDirArg);
  } catch (error) {
    fail(`Could not read coverage results directory "${resultsDirArg}": ${error.message}`);
  }

  const parsedFiles = [];

  for (const file of jsonFiles) {
    try {
      const contents = await fs.readFile(file, "utf8");
      parsedFiles.push({ file, json: JSON.parse(contents) });
    } catch (error) {
      console.warn(`Skipping JSON file that could not be parsed as coverage output: ${file} (${error.message})`);
    }
  }

  return parsedFiles;
}

async function checkAggregateCoverage(parsedFiles) {
  const candidates = parsedFiles.flatMap(({ file, json }) => collectAggregateCoverageCandidates(json, file));

  if (candidates.length === 0) {
    fail(`No Apex coverage summary was found in "${resultsDirArg}".`);
  }

  candidates.sort((a, b) => rankAggregateCandidate(b) - rankAggregateCandidate(a));

  const selected = candidates[0];
  const coverage = Number(selected.percent.toFixed(2));

  console.log(`Apex coverage source: ${selected.file} (${selected.label})`);
  console.log(`Apex coverage: ${coverage}%`);
  console.log(`Required coverage: ${threshold}%`);

  if (coverage < threshold) {
    fail(`::error title=Apex coverage below threshold::Apex coverage ${coverage}% is below ${threshold}%.`);
  }

  console.log("Apex coverage gate passed.");
}

async function checkTargetCoverage(parsedFiles) {
  const targets = await readListFile(targetsFileArg);

  if (targets.length === 0) {
    console.log(`No Apex coverage targets found in "${targetsFileArg}". Skipping target coverage gate.`);
    return;
  }

  const namedCandidates = parsedFiles.flatMap(({ file, json }) => collectNamedCoverageCandidates(json, file));
  const byName = new Map();

  for (const candidate of namedCandidates) {
    const key = candidate.name.toLowerCase();
    const existing = byName.get(key) ?? [];
    existing.push(candidate);
    byName.set(key, existing);
  }

  const failures = [];

  for (const target of targets) {
    const candidates = byName.get(target.toLowerCase()) ?? [];

    if (candidates.length === 0) {
      failures.push(`${target}: coverage result not found`);
      continue;
    }

    candidates.sort((a, b) => rankNamedCandidate(b) - rankNamedCandidate(a));

    const selected = candidates[0];
    const coverage = Number(selected.percent.toFixed(2));

    console.log(`${target}: ${coverage}% from ${selected.file} (${selected.label})`);

    if (coverage < threshold) {
      failures.push(`${target}: ${coverage}% is below ${threshold}%`);
    }
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`::error title=Apex coverage target failed::${failure}`);
    }

    fail(`Apex coverage gate failed for ${failures.length} target(s).`);
  }

  console.log(`Apex coverage gate passed for ${targets.length} target(s).`);
}

const parsedFiles = await readCoverageFiles();

if (targetsFileArg) {
  await checkTargetCoverage(parsedFiles);
} else {
  await checkAggregateCoverage(parsedFiles);
}
