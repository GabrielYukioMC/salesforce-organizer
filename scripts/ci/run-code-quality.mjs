#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const options = parseArgs(process.argv.slice(2));
const sourceRoot = normalizePath(options["source-root"] ?? "force-app");
const changedFile = options["changed-file"] ?? "deploy-results/pr-changed-files.txt";
const outDir = options["out-dir"] ?? "deploy-results";
const workspace = options.workspace ?? ".";
const severityThreshold = Number(options["severity-threshold"] ?? "3");
const rawJsonFile = path.join(outDir, "code-analyzer-results.raw.json");
const sarifFile = path.join(outDir, "code-quality-results.sarif");
const resultFile = path.join(outDir, "code-quality-results.json");
const logFile = path.join(outDir, "code-quality-analyzer.log");

if (!Number.isFinite(severityThreshold) || severityThreshold < 1 || severityThreshold > 5) {
  fail(`Invalid --severity-threshold "${options["severity-threshold"]}". Expected a number from 1 to 5.`, 2);
}

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
  return String(filePath).replaceAll("\\", "/");
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function escapeGithubCommand(value) {
  return String(value).replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
}

function githubNotice(title, message) {
  console.log(`::notice title=${escapeGithubCommand(title)}::${escapeGithubCommand(message)}`);
}

function githubError(title, message) {
  console.error(`::error title=${escapeGithubCommand(title)}::${escapeGithubCommand(message)}`);
}

async function pathExists(filePath) {
  return fs
    .access(filePath)
    .then(() => true)
    .catch(() => false);
}

async function readListFile(filePath) {
  try {
    const contents = await fs.readFile(filePath, "utf8");
    return contents
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map(normalizePath);
  } catch {
    return [];
  }
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

async function analyzerTargetFor(filePath) {
  const normalized = normalizePath(filePath);

  if (!normalized.startsWith(`${sourceRoot}/`)) {
    return null;
  }

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

  return (await pathExists(normalized)) ? normalized : null;
}

function metadataTypeFromPath(filePath) {
  const normalized = normalizePath(filePath ?? "");

  if (normalized.includes("/classes/") || normalized.includes("/triggers/") || /\.(cls|trigger)$/i.test(normalized)) {
    return "Apex";
  }

  if (normalized.includes("/lwc/")) {
    return "LWC";
  }

  if (normalized.includes("/aura/")) {
    return "Aura";
  }

  if (normalized.includes("/flows/") || normalized.includes("/flowDefinitions/") || /\.flow-meta\.xml$/i.test(normalized)) {
    return "Flow";
  }

  if (/\.xml$/i.test(normalized)) {
    return "XML";
  }

  return "Outros";
}

function componentFromPath(filePath, metadataType) {
  const normalized = normalizePath(filePath ?? "");
  const fileName = path.posix.basename(normalized);

  if (metadataType === "Apex") {
    return fileName
      .replace(/\.cls(?:-meta\.xml)?$/i, "")
      .replace(/\.trigger(?:-meta\.xml)?$/i, "");
  }

  if (metadataType === "LWC") {
    const parts = normalized.split("/");
    const index = parts.indexOf("lwc");
    return index >= 0 && parts[index + 1] ? parts[index + 1] : fileName;
  }

  if (metadataType === "Aura") {
    const parts = normalized.split("/");
    const index = parts.indexOf("aura");
    return index >= 0 && parts[index + 1] ? parts[index + 1] : fileName;
  }

  if (metadataType === "Flow") {
    return fileName
      .replace(/\.flow-meta\.xml$/i, "")
      .replace(/\.flowDefinition-meta\.xml$/i, "");
  }

  return normalized || "Nao informado";
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags.map((tag) => String(tag)).filter(Boolean);
}

function categoryFor(violation) {
  const engine = String(violation.engine ?? "").toLowerCase();
  const rule = String(violation.rule ?? "").toLowerCase();
  const message = String(violation.message ?? "").toLowerCase();
  const tags = normalizeTags(violation.tags).map((tag) => tag.toLowerCase());

  if (tags.includes("security") || rule.includes("security") || message.includes("security")) {
    return "Seguranca";
  }

  if (tags.includes("performance") || rule.includes("performance")) {
    return "Performance";
  }

  if (engine === "cpd" || tags.includes("duplication") || rule.includes("duplicate")) {
    return "Duplicacao";
  }

  if (tags.includes("errorprone") || tags.includes("bug") || rule.includes("bug")) {
    return "Bug";
  }

  if (tags.includes("code-style") || tags.includes("style") || rule.includes("style")) {
    return "Estilo";
  }

  return "Qualidade";
}

function primaryLocationFor(violation) {
  const locations = Array.isArray(violation.locations) ? violation.locations : [];
  const primaryIndex = Number.isInteger(violation.primaryLocationIndex) ? violation.primaryLocationIndex : 0;

  return locations[primaryIndex] ?? locations[0] ?? {};
}

function hashViolation({ rule, engine, file, line, message }) {
  return createHash("sha256")
    .update([rule, engine, file, line, String(message).trim().replace(/\s+/g, " ")].join("|"))
    .digest("hex");
}

function normalizeViolation(violation) {
  const location = primaryLocationFor(violation);
  const file = normalizePath(location.file ?? "");
  const metadataType = metadataTypeFromPath(file);
  const rule = String(violation.rule ?? "Regra nao informada");
  const engine = String(violation.engine ?? "engine-nao-informada");
  const severity = Number(violation.severity);
  const message = String(violation.message ?? "");

  const normalized = {
    rule,
    engine,
    severity: Number.isFinite(severity) ? severity : null,
    category: categoryFor(violation),
    file,
    line: Number.isInteger(location.startLine) ? location.startLine : null,
    column: Number.isInteger(location.startColumn) ? location.startColumn : null,
    endLine: Number.isInteger(location.endLine) ? location.endLine : null,
    endColumn: Number.isInteger(location.endColumn) ? location.endColumn : null,
    component: componentFromPath(file, metadataType),
    metadataType,
    message,
    tags: normalizeTags(violation.tags),
    resources: Array.isArray(violation.resources) ? violation.resources : [],
  };

  normalized.blockingReasons = blockingReasonsFor(normalized);
  normalized.hash = hashViolation(normalized);

  return normalized;
}

function blockingReasonsFor(violation) {
  const reasons = [];
  const engine = String(violation.engine ?? "").toLowerCase();
  const rule = String(violation.rule ?? "").toLowerCase();
  const message = String(violation.message ?? "").toLowerCase();
  const tags = normalizeTags(violation.tags).map((tag) => tag.toLowerCase());
  const isSecurity = violation.category === "Seguranca" || tags.includes("security");

  if (typeof violation.severity === "number" && violation.severity <= severityThreshold) {
    reasons.push(`severity<=${severityThreshold}`);
  }

  if (violation.metadataType === "Apex" && isSecurity) {
    reasons.push("apex-security");
  }

  if (/(crud|fls|field.?level.?security|object.?permission|apexcrud|apexsharing)/i.test(`${rule} ${message}`)) {
    reasons.push("crud-fls");
  }

  if (engine === "retire-js") {
    reasons.push("js-dependency-vulnerability");
  }

  if (engine === "cpd" && typeof violation.severity === "number" && violation.severity <= severityThreshold) {
    reasons.push("critical-duplication");
  }

  return uniqueSorted(reasons);
}

function countBy(items, field) {
  const counts = {};

  for (const item of items) {
    const key = item[field] ?? "Nao informado";
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function topFiles(violations) {
  const grouped = new Map();

  for (const violation of violations) {
    const key = violation.file || "Nao informado";
    const current = grouped.get(key) ?? {
      file: key,
      total: 0,
      blocking: 0,
      minSeverity: null,
    };

    current.total += 1;
    if (violation.blockingReasons.length > 0) {
      current.blocking += 1;
    }

    if (typeof violation.severity === "number") {
      current.minSeverity =
        current.minSeverity == null ? violation.severity : Math.min(current.minSeverity, violation.severity);
    }

    grouped.set(key, current);
  }

  return [...grouped.values()]
    .sort((a, b) => b.blocking - a.blocking || b.total - a.total || (a.minSeverity ?? 99) - (b.minSeverity ?? 99))
    .slice(0, 10);
}

function buildSummary({ raw, violations, analysisErrors }) {
  const blockingViolations = violations.filter((violation) => violation.blockingReasons.length > 0);
  const severityValues = violations
    .map((violation) => violation.severity)
    .filter((severity) => typeof severity === "number");

  return {
    totalViolations: violations.length,
    blockingViolations: blockingViolations.length,
    securityViolations: violations.filter((violation) => violation.category === "Seguranca").length,
    performanceViolations: violations.filter((violation) => violation.category === "Performance").length,
    minimumSeverity: severityValues.length > 0 ? Math.min(...severityValues) : null,
    countsBySeverity: countBy(violations, "severity"),
    countsByEngine: countBy(violations, "engine"),
    countsByCategory: countBy(violations, "category"),
    countsByMetadataType: countBy(violations, "metadataType"),
    topFiles: topFiles(violations),
    versions: raw?.versions ?? {},
    analysisErrors,
  };
}

function buildGate({ summary, analysisErrors }) {
  const reasons = [];

  if (analysisErrors.length > 0) {
    reasons.push("analysis-error");
  }

  if (summary.blockingViolations > 0) {
    reasons.push("blocking-violations");
  }

  return {
    ok: reasons.length === 0,
    severityThreshold,
    blockingViolations: summary.blockingViolations,
    reasons,
  };
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeGithubOutputs(result) {
  if (!process.env.GITHUB_OUTPUT) {
    return;
  }

  const lines = [
    `quality_ok=${result.gate.ok}`,
    `analysis_status=${result.status}`,
    `total_violations=${result.summary.totalViolations}`,
    `blocking_violations=${result.summary.blockingViolations}`,
  ];

  await fs.appendFile(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`, "utf8");
}

async function writeEmptySarif(filePath, { executionSuccessful, message }) {
  if (await pathExists(filePath)) {
    return;
  }

  await writeJson(filePath, {
    version: "2.1.0",
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    runs: [
      {
        tool: {
          driver: {
            name: "Salesforce Code Analyzer",
            informationUri: "https://developer.salesforce.com/docs/platform/salesforce-code-analyzer/guide/code-analyzer.html",
            rules: [],
          },
        },
        invocations: [
          {
            executionSuccessful,
            toolExecutionNotifications: message
              ? [
                  {
                    message: {
                      text: message,
                    },
                  },
                ]
              : [],
          },
        ],
        results: [],
      },
    ],
  });
}

function shellQuote(value) {
  if (/^[A-Za-z0-9_./:=@-]+$/.test(value)) {
    return value;
  }

  return `'${value.replaceAll("'", "'\\''")}'`;
}

async function runAnalyzer(targets) {
  const args = [
    "code-analyzer",
    "run",
    "--workspace",
    workspace,
    "--view",
    "detail",
    "--severity-threshold",
    String(severityThreshold),
    "--output-file",
    rawJsonFile,
    "--output-file",
    sarifFile,
  ];

  for (const target of targets) {
    args.push("--target", target);
  }

  const result = spawnSync("sf", args, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });

  const log = [
    `$ ${["sf", ...args].map(shellQuote).join(" ")}`,
    "",
    "--- stdout ---",
    result.stdout ?? "",
    "",
    "--- stderr ---",
    result.stderr ?? "",
    "",
    `exitCode=${result.status ?? "null"}`,
    result.error ? `error=${result.error.message}` : "",
  ]
    .filter((line) => line !== "")
    .join("\n");

  await fs.writeFile(logFile, `${log}\n`, "utf8");

  return {
    command: ["sf", ...args],
    exitCode: result.status,
    error: result.error?.message ?? null,
  };
}

async function readRawResults(filePath) {
  const contents = await fs.readFile(filePath, "utf8");
  return JSON.parse(contents);
}

async function buildResult({ changedFiles, targets, analyzer, raw, analysisErrors, status }) {
  const violations = Array.isArray(raw?.violations) ? raw.violations.map(normalizeViolation) : [];
  const summary = buildSummary({ raw, violations, analysisErrors });
  const gate = buildGate({ summary, analysisErrors });

  return {
    status: status ?? (gate.ok ? "success" : "failed"),
    ok: gate.ok,
    generatedAt: new Date().toISOString(),
    sourceRoot,
    changedFile,
    outDir,
    workspace,
    severityThreshold,
    files: {
      changed: changedFiles,
      targets,
      metadataCounts: countBy(
        targets.map((target) => ({
          metadataType: metadataTypeFromPath(target),
        })),
        "metadataType",
      ),
    },
    codeAnalyzer: {
      command: analyzer?.command ?? [],
      exitCode: analyzer?.exitCode ?? null,
      logFile,
      rawJsonFile,
      sarifFile,
      versions: raw?.versions ?? {},
    },
    summary,
    gate,
    violations,
  };
}

await fs.mkdir(outDir, { recursive: true });

const changedFiles = await readListFile(changedFile);
const targetCandidates = await Promise.all(changedFiles.map(analyzerTargetFor));
const targets = uniqueSorted(targetCandidates.filter(Boolean));

if (targets.length === 0) {
  const result = await buildResult({
    changedFiles,
    targets,
    analyzer: null,
    raw: {
      violationCounts: {
        total: 0,
        sev1: 0,
        sev2: 0,
        sev3: 0,
        sev4: 0,
        sev5: 0,
      },
      versions: {},
      violations: [],
    },
    analysisErrors: [],
    status: "skipped",
  });

  await writeJson(resultFile, result);
  await writeEmptySarif(sarifFile, {
    executionSuccessful: true,
    message: "No changed Salesforce files were available for Code Analyzer.",
  });
  await writeGithubOutputs(result);
  githubNotice("Qualidade de codigo", "Nenhum arquivo Salesforce alterado para analisar.");
  process.exit(0);
}

const analyzer = await runAnalyzer(targets);
let raw = null;
const analysisErrors = [];

try {
  raw = await readRawResults(rawJsonFile);
} catch (error) {
  analysisErrors.push(`Nao foi possivel ler o JSON do Code Analyzer: ${error.message}`);
}

if (analyzer.error) {
  analysisErrors.push(`Falha ao executar sf code-analyzer run: ${analyzer.error}`);
}

let preliminaryResult = await buildResult({
  changedFiles,
  targets,
  analyzer,
  raw,
  analysisErrors,
  status: analysisErrors.length > 0 ? "error" : null,
});

if (analyzer.exitCode !== 0 && preliminaryResult.gate.blockingViolations === 0) {
  preliminaryResult.summary.analysisErrors.push(
    `Code Analyzer retornou exit code ${analyzer.exitCode ?? "desconhecido"} sem violacao bloqueante parseavel. Consulte ${logFile}.`,
  );
  preliminaryResult.gate = buildGate({
    summary: preliminaryResult.summary,
    analysisErrors: preliminaryResult.summary.analysisErrors,
  });
  preliminaryResult.status = "error";
  preliminaryResult.ok = preliminaryResult.gate.ok;
}

await writeJson(resultFile, preliminaryResult);
await writeEmptySarif(sarifFile, {
  executionSuccessful: preliminaryResult.gate.ok,
  message: preliminaryResult.summary.analysisErrors.join(" "),
});
await writeGithubOutputs(preliminaryResult);

if (preliminaryResult.gate.ok) {
  githubNotice(
    "Qualidade de codigo",
    `${preliminaryResult.summary.totalViolations} violacao(oes), nenhuma bloqueante pelo gate atual.`,
  );
  process.exit(0);
}

githubError(
  "Qualidade de codigo",
  `${preliminaryResult.summary.blockingViolations} violacao(oes) bloqueante(s) ou erro de analise encontrado(s).`,
);
process.exit(1);
