# Plano de implementacao 01

## Informacoes do trabalho

- Work ID: W-000002
- IA/agente usado: Codex
- Modo: Default
- Data de inicio: 2026-07-01 23:18:45 -03
- Solicitacao: evoluir a esteira Salesforce com gate de qualidade de codigo baseado no Salesforce Code Analyzer.

## Objetivo

Adicionar uma etapa de analise estatica para os arquivos Salesforce alterados na PR/deploy, gerando resultado JSON, SARIF e resumo Markdown. O gate deve bloquear a execucao quando encontrar violacao de severidade 1, 2 ou 3, regra de seguranca Apex, CRUD/FLS, vulnerabilidade de dependencia JS, duplicacao critica ou erro de analise.

## Premissas

- O workflow usa Salesforce Code Analyzer v5 via plugin `code-analyzer` do Salesforce CLI.
- O comando principal e `sf code-analyzer run`.
- O escopo analisado vem de `deploy-results/pr-changed-files.txt`, gerado pelo preparo da PR/deploy.
- O workspace padrao e a raiz do repositorio.
- O limite inicial de severidade bloqueante e `3`.
- O workflow instala as dependencias Node do projeto antes da analise para permitir que a engine ESLint carregue `eslint.config.js`.
- O JSON normalizado fica em `deploy-results/code-quality-results.json`.
- O SARIF fica em `deploy-results/code-quality-results.sarif`.
- O resumo amigavel fica em `deploy-results/code-quality-summary.md`.
- Quando nao houver arquivo Salesforce alterado, a etapa registra status `skipped` e nao bloqueia.

## Checklist

- [x] Registrar work e plano de implementacao.
- [x] Criar script `run-code-quality.mjs`.
- [x] Criar script `summarize-code-quality.mjs`.
- [x] Normalizar violacoes do Code Analyzer para formato estavel do projeto.
- [x] Gerar hash de violacao para futura importacao no Salesforce Organizer.
- [x] Classificar violacoes por severidade, engine, categoria e tipo de metadata.
- [x] Implementar regras iniciais de bloqueio do quality gate.
- [x] Gerar SARIF como artefato da esteira.
- [x] Integrar a etapa no workflow de PR.
- [x] Integrar a etapa no workflow de deploy da `main`.
- [x] Mostrar qualidade de codigo no resumo final do job.
- [x] Registrar arquivos criados/alterados.
- [x] Validar sintaxe local dos scripts e do workflow.

## Validacao local executada

- `node --check scripts/ci/run-code-quality.mjs`
- `node --check scripts/ci/summarize-code-quality.mjs`
- `node --check scripts/ci/summarize-salesforce-job.mjs`
- `ruby -e "require 'yaml'; YAML.load_file('.github/workflows/pr-main-validate.yml'); puts 'yaml ok'"`
- `node scripts/ci/run-code-quality.mjs --source-root force-app --changed-file /private/tmp/W-000002-missing-changed-files.txt --out-dir /private/tmp/W-000002-quality-empty --workspace . --severity-threshold 3`
- `node scripts/ci/summarize-code-quality.mjs --out-dir /private/tmp/W-000002-quality-empty`
- `node scripts/ci/summarize-salesforce-job.mjs --operation validate --out-dir /private/tmp/W-000002-quality-empty --threshold 80 --auth-status skipped --salesforce-status skipped --coverage-status skipped --quality-status success`
- Simulacao local com mock do comando `sf code-analyzer run`, retornando uma violacao `ApexCRUDViolation` de severidade 2. O script `run-code-quality.mjs` retornou erro esperado e gerou JSON normalizado.
- `node scripts/ci/summarize-code-quality.mjs --out-dir /private/tmp/W-000002-quality-blocking`
- `node scripts/ci/summarize-salesforce-job.mjs --operation validate --out-dir /private/tmp/W-000002-quality-blocking --threshold 80 --auth-status skipped --salesforce-status skipped --coverage-status skipped --quality-status failure`

## Resultado

- A PR/deploy agora tem gate de qualidade antes de autenticar e validar/publicar no Salesforce.
- O resultado do Code Analyzer e transformado em um JSON voltado ao Salesforce Organizer, com `hash`, componente, tipo de metadata, categoria e motivos de bloqueio.
- O resumo final do GitHub Actions passa a mostrar uma secao de qualidade de codigo com metricas e violacoes bloqueantes.
- A esteira preserva os artefatos `code-quality-results.json`, `code-quality-results.sarif`, `code-quality-summary.md` e `code-quality-analyzer.log`.

## Riscos e observacoes

- A execucao real no GitHub Actions depende da instalacao do plugin `code-analyzer@latest`.
- Algumas engines do Code Analyzer dependem de Java ou Python; o workflow prepara Java 17 e Python 3.12 antes de executar a analise.
- A instalacao de dependencias usa `npm install --no-audit --no-fund` porque o repositorio ainda nao possui arquivo de lock.
- O gate inicial e conservador e pode bloquear PRs em repositorios com divida tecnica antiga. Uma evolucao futura pode introduzir baseline para bloquear somente violacoes novas.
