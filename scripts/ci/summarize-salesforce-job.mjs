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
    return "Apex";
  }

  if (normalized.includes("/flows/") || normalized.includes("/flowDefinitions/")) {
    return "Flow";
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
    ["Arquivos", paths],
    ["Apex", []],
    ["Flow", []],
    ["LWC", []],
    ["Aura", []],
    ["Outros", []],
  ]);

  for (const filePath of paths) {
    const type = classifyPath(filePath);
    grouped.get(type).push(filePath);
  }

  return grouped;
}

function compactList(items, emptyText) {
  if (items.length === 0) {
    return emptyText;
  }

  const visible = items.slice(0, 20).map((item) => `\`${escapeTable(item)}\``);
  const hiddenCount = items.length - visible.length;

  if (hiddenCount > 0) {
    visible.push(`mais ${hiddenCount} item(ns) nos artefatos`);
  }

  return visible.join("<br>");
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

function buildItemsTable(grouped, itemStatus) {
  const lines = [
    "| Grupo | Quantidade | Itens | Status |",
    "| --- | ---: | --- | --- |",
  ];

  for (const [group, items] of grouped.entries()) {
    lines.push(
      `| ${group} | ${items.length} | ${compactList(items, "Nenhum")} | ${itemStatus} |`,
    );
  }

  return lines.join("\n");
}

function buildTestsTable(testClasses, junitResults, coverageData, hasDeployableChanges) {
  const coverageText = coverageForTargets(coverageData);
  const lines = [
    "| Classe de teste | Cobertura considerada | Rodou com sucesso? |",
    "| --- | --- | --- |",
  ];

  if (testClasses.length === 0) {
    lines.push("| Nenhuma | Nao aplicavel | Nao executado |");
    return lines.join("\n");
  }

  for (const testClass of testClasses) {
    lines.push(
      `| \`${escapeTable(testClass)}\` | ${coverageText} | ${testStatusFor(testClass, junitResults, hasDeployableChanges)} |`,
    );
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
  if (!process.env.GITHUB_STEP_SUMMARY) {
    console.log(markdown);
    return;
  }

  await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`, "utf8");
}

const operationCopy = operationWords();
const changedFiles = await readListFile("pr-changed-files.txt");
const sourcePaths = await readListFile("pr-source-paths.txt");
const apexTargets = await readListFile("pr-apex-targets.txt");
const testClasses = await readListFile("pr-test-classes.txt");
const deletedFiles = await readListFile("pr-deleted-files.txt");
const coverageData = await readJsonFile("apex-coverage-results.json");
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
  "## Resumo",
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
  "### Itens processados",
  buildItemsTable(grouped, itemStatus),
  "",
  "### Classes de teste",
  buildTestsTable(testClasses, junitResults, coverageData, hasDeployableChanges),
  "",
  "### Cobertura Apex",
  coverageForTargets(coverageData),
  "",
  buildFinalNotes(overall, coverageData, hasApexTargets, deletedFiles),
].join("\n");

await appendSummary(summary);

if (overall.ok) {
  githubNotice("Resumo Salesforce", overall.detail);
} else {
  githubError("Resumo Salesforce", overall.detail);
}
