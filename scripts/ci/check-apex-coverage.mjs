#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";

const [, , resultsDirArg, thresholdArg = "80"] = process.argv;

function fail(message, exitCode = 1) {
  console.error(message);
  process.exit(exitCode);
}

if (!resultsDirArg) {
  fail("Usage: node scripts/ci/check-apex-coverage.mjs <results-dir> [threshold]", 2);
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

function collectCoverageCandidates(json, file) {
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

function rankCandidate(candidate) {
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

async function main() {
  let jsonFiles;

  try {
    jsonFiles = await listJsonFiles(resultsDirArg);
  } catch (error) {
    fail(`Could not read coverage results directory "${resultsDirArg}": ${error.message}`);
  }

  const candidates = [];

  for (const file of jsonFiles) {
    try {
      const contents = await fs.readFile(file, "utf8");
      const json = JSON.parse(contents);
      candidates.push(...collectCoverageCandidates(json, file));
    } catch (error) {
      console.warn(`Skipping JSON file that could not be parsed as coverage output: ${file} (${error.message})`);
    }
  }

  if (candidates.length === 0) {
    fail(`No Apex coverage summary was found in "${resultsDirArg}".`);
  }

  candidates.sort((a, b) => rankCandidate(b) - rankCandidate(a));

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

await main();
