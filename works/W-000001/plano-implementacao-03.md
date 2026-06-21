# Plano de implementacao 03

## Informacoes da execucao

- IA/agente usado: Codex
- Nivel/configuracao: Default
- Data de inicio: 2026-06-21 00:19:42 -03

## Objetivo

Ajustar o resumo do validate/deploy para exibir arquivos modificados por tipo, classes de teste e cobertura em formato simples para leitura na PR.

## Motivo deste plano

O resumo anterior existia, mas nao estava no formato esperado para leitura rapida do validate. A demanda pede uma secao `Resumo` com grupos como Apex Class, LWC, Flow, outros arquivos, classes de teste e cobertura com status.

## Etapas

- [x] Analisar o formato atual do resumo.
- [x] Ajustar o script de resumo para o formato solicitado.
- [x] Validar a saida localmente com artefatos simulados.
- [x] Registrar arquivos alterados.

## Validacao executada

- `node --check scripts/ci/summarize-salesforce-job.mjs`
- `node --check scripts/ci/check-apex-coverage.mjs`
- `ruby -e "require 'yaml'; YAML.load_file('.github/workflows/pr-main-validate.yml'); puts 'yaml ok'"`
- `GITHUB_STEP_SUMMARY=/private/tmp/W-000001-summary-format/summary.md node scripts/ci/summarize-salesforce-job.mjs --operation validate --out-dir /private/tmp/W-000001-summary-format --threshold 80 --auth-status success --salesforce-status success --coverage-status success`

## Resultado esperado no resumo

- `APEX CLASS`: nomes das classes/triggers modificadas.
- `LWC`: nomes dos bundles LWC modificados.
- `FLOW`: nomes dos flows modificados.
- `Outros tipos de arquivos`: demais metadados validados.
- `Classes teste`: classes de teste executadas e status.
- `Cobertura`: classe Apex, percentual, contagem de erros de teste e status.
