#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";

const options = parseArgs(process.argv.slice(2));
const operation = options.operation ?? "validate";
const outDir = options["out-dir"] ?? "deploy-results";
const threshold = options.threshold ?? "80";
const authStatus = options["auth-status"] ?? "unknown";
const salesforceStatus = options["salesforce-status"] ?? "unknown";
const coverageStatus = options["coverage-status"] ?? "unknown";

if (!["validate", "deploy"].includes(operation)) {
  fail(`Invalid operation "${operation}". Expected "validate" or "deploy".`, 2);
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

function escapeGithubCommand(value) {
  return String(value).replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
}

function githubNotice(title, message) {
  console.log(`::notice title=${escapeGithubCommand(title)}::${escapeGithubCommand(message)}`);
}

function githubError(title, message) {
  console.error(`::error title=${escapeGithubCommand(title)}::${escapeGithubCommand(message)}`);
}

async function readListFile(fileName) {
  try {
    const contents = await fs.readFile(path.join(outDir, fileName), "utf8");

    return contents
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
  } catch {
    return [];
  }
}

async function readJsonFile(fileName) {
  try {
    const contents = await fs.readFile(path.join(outDir, fileName), "utf8");
    return JSON.parse(contents);
  } catch {
    return null;
  }
}

async function listFiles(directory) {
  let entries;

  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

function normalizePath(filePath) {
  return filePath.replaceAll("\\", "/");
}

function classifyPath(filePath) {
  const normalized = normalizePath(filePath);

  if (normalized.includes("/classes/") || normalized.includes("/triggers/")) {
    return "APEX CLASS";
  }

  if (normalized.includes("/flows/") || normalized.includes("/flowDefinitions/")) {
    return "FLOW";
  }

  if (normalized.includes("/lwc/")) {
    return "LWC";
  }

  if (normalized.includes("/aura/")) {
    return "Aura";
  }

  return "Outros";
}

function groupByType(paths) {
  const grouped = new Map([
    ["APEX CLASS", []],
    ["LWC", []],
    ["FLOW", []],
    ["Outros tipos de arquivos", []],
  ]);

  for (const filePath of paths) {
    const type = classifyPath(filePath);
    if (grouped.has(type)) {
      grouped.get(type).push(componentLabel(filePath, type));
    } else {
      grouped.get("Outros tipos de arquivos").push(componentLabel(filePath, type));
    }
  }

  for (const [type, items] of grouped.entries()) {
    grouped.set(type, uniqueSorted(items));
  }

  return grouped;
}

function uniqueSorted(items) {
  return [...new Set(items)].sort((a, b) => a.localeCompare(b));
}

function componentLabel(filePath, type) {
  const normalized = normalizePath(filePath);
  const fileName = path.posix.basename(normalized);

  if (type === "APEX CLASS") {
    return fileName
      .replace(/\.cls(?:-meta\.xml)?$/i, "")
      .replace(/\.trigger(?:-meta\.xml)?$/i, "");
  }

  if (type === "LWC") {
    const parts = normalized.split("/");
    const lwcIndex = parts.indexOf("lwc");
    return lwcIndex >= 0 && parts[lwcIndex + 1] ? parts[lwcIndex + 1] : fileName;
  }

  if (type === "FLOW") {
    return fileName
      .replace(/\.flow-meta\.xml$/i, "")
      .replace(/\.flowDefinition-meta\.xml$/i, "");
  }

  if (type === "Aura") {
    const parts = normalized.split("/");
    const auraIndex = parts.indexOf("aura");
    return auraIndex >= 0 && parts[auraIndex + 1] ? parts[auraIndex + 1] : fileName;
  }

  return normalized;
}

function formatBulletList(items, emptyText, itemStatus = null) {
  if (items.length === 0) {
    return `- ${emptyText}`;
  }

  const visible = items.slice(0, 20).map((item) => {
    const statusSuffix = itemStatus ? ` - ${itemStatus}` : "";
    return `- ${item}${statusSuffix}`;
  });
  const hiddenCount = items.length - visible.length;

  if (hiddenCount > 0) {
    visible.push(`- mais ${hiddenCount} item(ns) nos artefatos`);
  }

  return visible.join("\n");
}

function escapeTable(value) {
  return String(value).replaceAll("|", "\\|");
}

function statusText(status) {
  const normalized = String(status).toLowerCase();

  if (normalized === "success") {
    return "Sucesso";
  }

  if (normalized === "failure") {
    return "Falhou";
  }

  if (normalized === "skipped") {
    return "Nao executado";
  }

  if (normalized === "cancelled") {
    return "Cancelado";
  }

  return "Nao informado";
}

function operationWords() {
  return operation === "deploy"
    ? {
        title: "deploy",
        past: "deployado",
        pluralPast: "deployados",
        gerund: "deployando",
      }
    : {
        title: "validate",
        past: "validado",
        pluralPast: "validados",
        gerund: "validando",
      };
}

function inferOverallStatus({ hasDeployableChanges, hasApexTargets, coverageData, deletedFiles }) {
  if (deletedFiles.length > 0) {
    return {
      ok: false,
      label: "Remocao de metadata bloqueada",
      detail: "Ha arquivo removido em force-app, mas esta esteira incremental ainda nao publica destructiveChanges.",
    };
  }

  if (!hasDeployableChanges) {
    return {
      ok: true,
      label: "Sem alteracoes Salesforce",
      detail: "Nenhum item dentro de force-app precisou ser processado.",
    };
  }

  if (authStatus === "failure") {
    return {
      ok: false,
      label: "Falha de autenticacao",
      detail: "O secret SF_MAIN_AUTH_URL nao foi encontrado ou nao autenticou a org alvo.",
    };
  }

  if (salesforceStatus === "failure") {
    return {
      ok: false,
      label: operation === "deploy" ? "Deploy falhou" : "Validate falhou",
      detail: "O Salesforce CLI retornou erro. Veja os detalhes do comando e os artefatos do job.",
    };
  }

  if (hasApexTargets && coverageStatus === "failure") {
    const failures = coverageData?.failures?.length ? coverageData.failures.join("; ") : "Cobertura abaixo do minimo ou resultado nao encontrado.";

    return {
      ok: false,
      label: "Cobertura insuficiente",
      detail: failures,
    };
  }

  if (salesforceStatus === "success") {
    return {
      ok: true,
      label: operation === "deploy" ? "Deploy concluido" : "Validate aprovado",
      detail:
        operation === "deploy"
          ? "Os itens alterados foram publicados com sucesso na org alvo."
          : "Os itens alterados foram validados com sucesso na org alvo.",
    };
  }

  return {
    ok: false,
    label: "Resultado inconclusivo",
    detail: "Alguma etapa principal nao retornou status esperado. Veja os logs do job.",
  };
}

function coverageForTargets(coverageData) {
  const rows = coverageData?.rows ?? [];

  if (rows.length === 0) {
    return "Nao aplicavel";
  }

  const visible = rows.slice(0, 8).map((row) => {
    const coverage = typeof row.coverage === "number" ? `${row.coverage}%` : "nao encontrado";
    const status = row.ok ? "aprovado" : "reprovado";
    return `${row.name}: ${coverage} (${status})`;
  });
  const hiddenCount = rows.length - visible.length;

  if (hiddenCount > 0) {
    visible.push(`mais ${hiddenCount} alvo(s) nos artefatos`);
  }

  return visible.join("<br>");
}

function aggregateTestStats(junitResults) {
  const totals = {
    total: 0,
    failures: 0,
    errors: 0,
    skipped: 0,
  };

  for (const result of junitResults.values()) {
    totals.total += result.total;
    totals.failures += result.failures;
    totals.errors += result.errors;
    totals.skipped += result.skipped;
  }

  return totals;
}

function normalizeTestClassName(value, configuredTests) {
  const normalized = String(value ?? "").trim();
  const lower = normalized.toLowerCase();

  for (const testClass of configuredTests) {
    const testLower = testClass.toLowerCase();

    if (
      lower === testLower ||
      lower.endsWith(`.${testLower}`) ||
      lower.startsWith(`${testLower}.`) ||
      lower.includes(`.${testLower}.`)
    ) {
      return testClass;
    }
  }

  return null;
}

function parseXmlAttributes(attributes) {
  const parsed = {};
  const attrRegex = /([A-Za-z_:][-A-Za-z0-9_:.]*)="([^"]*)"/g;
  let match;

  while ((match = attrRegex.exec(attributes)) !== null) {
    parsed[match[1]] = match[2];
  }

  return parsed;
}

async function collectJUnitResults(configuredTests) {
  const files = (await listFiles(outDir)).filter((filePath) => filePath.endsWith(".xml"));
  const results = new Map();

  for (const filePath of files) {
    const contents = await fs.readFile(filePath, "utf8");
    const testcaseRegex = /<testcase\b([^>]*)\/>|<testcase\b([^>]*)>([\s\S]*?)<\/testcase>/g;
    let match;

    while ((match = testcaseRegex.exec(contents)) !== null) {
      const attributes = parseXmlAttributes(match[1] ?? match[2] ?? "");
      const body = match[3] ?? "";
      const testClass =
        normalizeTestClassName(attributes.classname, configuredTests) ??
        normalizeTestClassName(attributes.name, configuredTests);

      if (!testClass) {
        continue;
      }

      const current = results.get(testClass) ?? {
        total: 0,
        failures: 0,
        errors: 0,
        skipped: 0,
      };

      current.total += 1;

      if (/<failure\b/i.test(body)) {
        current.failures += 1;
      }

      if (/<error\b/i.test(body)) {
        current.errors += 1;
      }

      if (/<skipped\b/i.test(body)) {
        current.skipped += 1;
      }

      results.set(testClass, current);
    }
  }

  return results;
}

function testStatusFor(testClass, junitResults, hasDeployableChanges) {
  const result = junitResults.get(testClass);

  if (result) {
    if (result.failures > 0 || result.errors > 0) {
      return `Falhou (${result.failures + result.errors}/${result.total})`;
    }

    if (result.skipped === result.total) {
      return "Nao executado";
    }

    return `Sucesso (${result.total} metodo(s))`;
  }

  if (!hasDeployableChanges) {
    return "Nao executado";
  }

  if (salesforceStatus === "success") {
    return "Sucesso (sem detalhe por metodo)";
  }

  if (salesforceStatus === "failure") {
    return "Falha ou nao concluido";
  }

  return "Nao encontrado";
}

function buildModifiedFilesSection(grouped, itemStatus) {
  const lines = ["### Arquivos modificados"];

  for (const [group, items] of grouped.entries()) {
    lines.push("");
    lines.push(`#### ${group}`);
    lines.push(formatBulletList(items, "Nenhum", items.length > 0 ? itemStatus : null));
  }

  return lines.join("\n");
}

function buildTestClassesSection(testClasses, junitResults, hasDeployableChanges) {
  const lines = ["### Classes teste"];

  if (testClasses.length === 0) {
    lines.push("", "Nenhuma classe de teste configurada.");
    return lines.join("\n");
  }

  lines.push("", "| Classe | Status |", "| --- | --- |");

  for (const testClass of testClasses) {
    lines.push(`| \`${testClass}\` | ${testStatusFor(testClass, junitResults, hasDeployableChanges)} |`);
  }

  return lines.join("\n");
}

function extractRawCoverage(rawCoverage, className) {
  if (!rawCoverage || typeof rawCoverage !== "object") return null;

  for (const [key, value] of Object.entries(rawCoverage)) {
    if (key === "total") continue;
    const baseName = path.posix
      .basename(key.replaceAll("\\", "/"))
      .replace(/\.cls(-meta\.xml)?$/i, "");
    if (baseName.toLowerCase() === className.toLowerCase()) {
      const pct = value?.lines?.pct ?? value?.statements?.pct ?? null;
      return pct != null ? Number(Number(pct).toFixed(2)) : null;
    }
  }

  const directValue = rawCoverage[className] ?? rawCoverage[className.toLowerCase()];
  if (directValue) {
    const pct = directValue?.lines?.pct ?? directValue?.statements?.pct ?? null;
    return pct != null ? Number(Number(pct).toFixed(2)) : null;
  }

  return null;
}

function buildCoverageSection(coverageData, junitResults, apexTargets, rawCoverage) {
  const rows = coverageData?.rows ?? [];
  const testStats = aggregateTestStats(junitResults);
  const totalErrors = testStats.failures + testStats.errors;
  const totalTests = testStats.total || 0;
  const minThreshold = Number(threshold);
  const lines = ["### Cobertura"];

  const testSummaryLine =
    totalTests > 0
      ? `> ${totalTests} teste(s) executado(s) — ${totalErrors} erro(s) nos testes`
      : null;

  if (rows.length === 0) {
    const productionTargets = apexTargets.filter((t) => !/test$/i.test(t));

    if (productionTargets.length > 0 && (salesforceStatus === "failure" || coverageStatus === "failure")) {
      if (testSummaryLine) lines.push("", testSummaryLine);
      lines.push("", "| Classe | Cobertura | Status |", "| --- | ---: | --- |");

      for (const target of productionTargets) {
        const pct = extractRawCoverage(rawCoverage, target);
        const pctText = pct != null ? `${pct}%` : "—";
        const status =
          pct == null
            ? "nao encontrada"
            : pct < minThreshold
              ? `insuficiente (minimo ${minThreshold}%)`
              : "ok — validate falhou por outras classes";
        lines.push(`| \`${target}\` | ${pctText} | ${status} |`);
      }

      return lines.join("\n");
    }

    if (testSummaryLine) lines.push("", testSummaryLine);
    const reason = salesforceStatus === "failure" ? "validate falhou" : "sem classes Apex alteradas neste escopo";
    lines.push("", `Nao aplicavel — ${reason}.`);
    return lines.join("\n");
  }

  if (testSummaryLine) lines.push("", testSummaryLine);
  lines.push("", "| Classe | Cobertura | Status |", "| --- | ---: | --- |");

  for (const row of rows) {
    const coverage = typeof row.coverage === "number" ? `${row.coverage}%` : "—";
    const status = row.ok && totalErrors === 0 && coverageStatus !== "failure" ? "sucesso" : "falhou";
    lines.push(`| \`${row.name}\` | ${coverage} | ${status} |`);
  }

  return lines.join("\n");
}

function buildFinalNotes(overall, coverageData, hasApexTargets, deletedFiles) {
  const lines = ["### Resultado final"];

  lines.push(`- Status: ${overall.label}`);
  lines.push(`- Detalhe: ${overall.detail}`);

  if (deletedFiles.length > 0) {
    lines.push("- Remocoes bloqueadas:");

    for (const deletedFile of deletedFiles) {
      lines.push(`  - ${deletedFile}`);
    }
  }

  if (hasApexTargets && coverageData?.failures?.length > 0) {
    lines.push("- Pontos de cobertura a corrigir:");

    for (const failure of coverageData.failures) {
      lines.push(`  - ${failure}`);
    }
  }

  if (authStatus === "failure") {
    lines.push("- Acao: configurar ou corrigir o secret `SF_MAIN_AUTH_URL` em GitHub Actions.");
  }

  return lines.join("\n");
}

async function appendSummary(markdown) {
  console.log(markdown);

  if (process.env.GITHUB_STEP_SUMMARY) {
    await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`, "utf8");
  }
}

const operationCopy = operationWords();
const changedFiles = await readListFile("pr-changed-files.txt");
const sourcePaths = await readListFile("pr-source-paths.txt");
const apexTargets = await readListFile("pr-apex-targets.txt");
const testClasses = await readListFile("pr-test-classes.txt");
const deletedFiles = await readListFile("pr-deleted-files.txt");
const coverageData = await readJsonFile("apex-coverage-results.json");
const rawCoverage = await readJsonFile("coverage/coverage-summary.json");
const junitResults = await collectJUnitResults(testClasses);
const hasDeployableChanges = sourcePaths.length > 0;
const hasApexTargets = apexTargets.length > 0;
const overall = inferOverallStatus({ hasDeployableChanges, hasApexTargets, coverageData, deletedFiles });
const grouped = groupByType(sourcePaths);
const itemStatus = hasDeployableChanges
  ? salesforceStatus === "success"
    ? `${operationCopy.past} com sucesso`
    : salesforceStatus === "failure"
      ? `${operationCopy.title} falhou`
      : `${operationCopy.title} nao concluido`
  : "Nao executado";

const summary = [
  "## RESUMO GERAL",
  "",
  operation === "deploy"
    ? "Resumo do deploy automatico apos merge/push na `main`."
    : "Resumo do validate executado para a PR.",
  "",
  "| Etapa | Status |",
  "| --- | --- |",
  `| Autenticacao Salesforce | ${statusText(authStatus)} |`,
  `| ${operation === "deploy" ? "Deploy" : "Validate"} Salesforce | ${statusText(salesforceStatus)} |`,
  `| Gate de cobertura | ${hasApexTargets ? statusText(coverageStatus) : "Nao aplicavel"} |`,
  "",
  buildModifiedFilesSection(grouped, itemStatus),
  "",
  buildTestClassesSection(testClasses, junitResults, hasDeployableChanges),
  "",
  buildCoverageSection(coverageData, junitResults, apexTargets, rawCoverage),
  "",
  buildFinalNotes(overall, coverageData, hasApexTargets, deletedFiles),
].join("\n");

await appendSummary(summary);

if (overall.ok) {
  githubNotice("Resumo Salesforce", overall.detail);
} else {
  githubError("Resumo Salesforce", overall.detail);
}
