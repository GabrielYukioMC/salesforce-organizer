#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";

const options = parseArgs(process.argv.slice(2));
const outDir = options["out-dir"] ?? "deploy-results";
const resultFile = path.join(outDir, "code-quality-results.json");
const summaryFile = path.join(outDir, "code-quality-summary.md");

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

async function readJson(filePath) {
  try {
    const contents = await fs.readFile(filePath, "utf8");
    return JSON.parse(contents);
  } catch {
    return null;
  }
}

function tableCell(value) {
  return String(value ?? "").replaceAll("|", "\\|");
}

function countValue(counts, key) {
  return Number(counts?.[key] ?? 0);
}

function statusLabel(result) {
  if (!result) {
    return "NAO EXECUTADA";
  }

  if (result.status === "skipped") {
    return "NAO APLICAVEL";
  }

  if (result.gate?.ok) {
    return "SUCESSO";
  }

  return "ERRO";
}

function severityText(value) {
  return value == null ? "Nao informado" : String(value);
}

function formatReason(reason) {
  const labels = {
    "analysis-error": "Erro de analise",
    "blocking-violations": "Violacao bloqueante",
    "severity<=3": "Severidade 1-3",
    "severity<=2": "Severidade 1-2",
    "severity<=1": "Severidade 1",
    "apex-security": "Seguranca Apex",
    "crud-fls": "CRUD/FLS",
    "js-dependency-vulnerability": "Dependencia JS vulneravel",
    "critical-duplication": "Duplicacao critica",
  };

  return labels[reason] ?? reason;
}

function buildCountRows(title, counts) {
  const entries = Object.entries(counts ?? {});

  if (entries.length === 0) {
    return [`### ${title}`, "", "Nenhum dado encontrado."].join("\n");
  }

  return [
    `### ${title}`,
    "",
    "| Item | Quantidade |",
    "| --- | ---: |",
    ...entries.map(([key, value]) => `| ${tableCell(key)} | ${value} |`),
  ].join("\n");
}

function buildTopProblems(result) {
  const violations = result?.violations ?? [];
  const ordered = [...violations]
    .sort(
      (a, b) =>
        b.blockingReasons.length - a.blockingReasons.length ||
        (a.severity ?? 99) - (b.severity ?? 99) ||
        String(a.file).localeCompare(String(b.file)),
    )
    .slice(0, 10);

  if (ordered.length === 0) {
    return ["### Top problemas", "", "Nenhuma violacao encontrada."].join("\n");
  }

  return [
    "### Top problemas",
    "",
    "| Arquivo | Regra | Engine | Severidade | Linha |",
    "| --- | --- | --- | ---: | ---: |",
    ...ordered.map(
      (violation) =>
        `| \`${tableCell(violation.file || "Nao informado")}\` | ${tableCell(violation.rule)} | ${tableCell(
          violation.engine,
        )} | ${severityText(violation.severity)} | ${violation.line ?? "-"} |`,
    ),
  ].join("\n");
}

function buildBlockingSection(result) {
  const violations = (result?.violations ?? []).filter((violation) => violation.blockingReasons.length > 0);

  if (violations.length === 0) {
    return ["### Violacoes bloqueantes", "", "Nenhuma violacao bloqueante pelo gate atual."].join("\n");
  }

  return [
    "### Violacoes bloqueantes",
    "",
    "| Arquivo | Regra | Severidade | Linha | Motivo |",
    "| --- | --- | ---: | ---: | --- |",
    ...violations.slice(0, 20).map((violation) => {
      const reasons = violation.blockingReasons.map(formatReason).join(", ");
      return `| \`${tableCell(violation.file || "Nao informado")}\` | ${tableCell(violation.rule)} | ${severityText(
        violation.severity,
      )} | ${violation.line ?? "-"} | ${tableCell(reasons)} |`;
    }),
    violations.length > 20 ? `| mais ${violations.length - 20} item(ns) |  |  |  | Veja o JSON completo |` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildAnalysisErrors(result) {
  const errors = result?.summary?.analysisErrors ?? [];

  if (errors.length === 0) {
    return "";
  }

  return [
    "### Erros de analise",
    "",
    ...errors.map((error) => `- ${error}`),
  ].join("\n");
}

function buildSummary(result) {
  if (!result) {
    return [
      "## Qualidade de codigo - NAO EXECUTADA",
      "",
      "Nao encontrei `code-quality-results.json` nos artefatos desta execucao.",
    ].join("\n");
  }

  const summary = result.summary ?? {};
  const metadataCounts = summary.countsByMetadataType ?? {};
  const status = statusLabel(result);

  return [
    `## Qualidade de codigo - ${status}`,
    "",
    result.status === "skipped"
      ? "Nenhum arquivo Salesforce alterado precisou ser analisado."
      : result.gate?.ok
        ? "Nenhuma violacao bloqueante foi encontrada pelo gate atual."
        : "O gate encontrou violacoes bloqueantes ou erro de analise.",
    "",
    "| Metrica | Quantidade |",
    "| --- | ---: |",
    `| Violacoes totais | ${summary.totalViolations ?? 0} |`,
    `| Violacoes bloqueantes | ${summary.blockingViolations ?? 0} |`,
    `| Seguranca | ${summary.securityViolations ?? 0} |`,
    `| Performance | ${summary.performanceViolations ?? 0} |`,
    `| Apex | ${countValue(metadataCounts, "Apex")} |`,
    `| LWC | ${countValue(metadataCounts, "LWC")} |`,
    `| Aura | ${countValue(metadataCounts, "Aura")} |`,
    `| Flow | ${countValue(metadataCounts, "Flow")} |`,
    "",
    buildTopProblems(result),
    "",
    buildBlockingSection(result),
    "",
    buildCountRows("Violacoes por severidade", summary.countsBySeverity),
    "",
    buildCountRows("Violacoes por engine", summary.countsByEngine),
    "",
    buildCountRows("Violacoes por tipo de metadata", summary.countsByMetadataType),
    "",
    buildAnalysisErrors(result),
  ]
    .filter((section) => section !== "")
    .join("\n");
}

async function appendSummary(markdown) {
  console.log(markdown);

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(summaryFile, `${markdown}\n`, "utf8");

  if (process.env.GITHUB_STEP_SUMMARY) {
    await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`, "utf8");
  }
}

const result = await readJson(resultFile);
await appendSummary(buildSummary(result));
