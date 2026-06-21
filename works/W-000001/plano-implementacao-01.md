# Plano de implementacao 01

## Informacoes do trabalho
- Work ID: W-000001
- IA/agente usado: Codex
- Modo: Default
- Data de inicio: 2026-06-20 23:33:37 -03
- Solicitacao: criar uma esteira de deploy/validacao para PRs abertas contra `main`, obrigando cobertura Apex minima de 80%.

## Objetivo
Criar uma validacao automatizada de pull request que autentique em uma org Salesforce de referencia, valide somente o conteudo alterado na PR, execute classes de teste configuradas em arquivo `.txt`, bloqueie a PR quando qualquer classe Apex alterada ficar abaixo de 80% de cobertura e, apos merge na `main`, publique automaticamente somente os arquivos alterados.

## Premissas
- A org alvo sera autenticada no GitHub Actions por um segredo `SF_MAIN_AUTH_URL` no formato Salesforce DX auth URL.
- A validacao sera feita contra PRs direcionadas para a branch `main`.
- O job deve fazer validacao, nao deploy efetivo.
- O deploy validation usa somente arquivos alterados na PR dentro de `force-app`.
- As classes de teste executadas ficam em `.github/salesforce-pr-test-classes.txt`, uma classe por linha.
- O Salesforce CLI roda `RunSpecifiedTests`, nao `RunLocalTests`.
- A cobertura sera validada por script local a partir dos artefatos JSON gerados pelo Salesforce CLI, filtrando os Apex targets alterados na PR.
- Para impedir merge mesmo quando alguem tentar ignorar checks, a regra de protecao/ruleset da branch `main` deve exigir o check `Validate PR changes`.
- Remocoes de metadata ainda nao geram `destructiveChanges`; se houver arquivo removido em `force-app`, a pipeline falha com mensagem explicita.
- O deploy automatico roda em `push` para `main`, interpretando PR aprovada como PR mergeada na branch principal.
- O workflow escreve resumos amigaveis no `GITHUB_STEP_SUMMARY` para escopo, cobertura, secret ausente, validacao aprovada e deploy concluido.
- O workflow tambem escreve uma secao final `Resumo` no validate e no deploy com itens por tipo, classes de teste, cobertura e status final.

## Checklist
- [x] Registrar work e plano de implementacao.
- [x] Criar workflow de PR para `main`.
- [x] Ajustar workflow para validar somente o conteudo da PR.
- [x] Criar arquivo `.txt` com classes de teste especificadas por linha.
- [x] Criar script de preparacao do escopo incremental da PR.
- [x] Criar script de gate de cobertura Apex.
- [x] Ajustar gate de cobertura para conferir classes Apex alteradas na PR.
- [x] Adicionar mensagens amigaveis em annotations e resumos do GitHub Actions.
- [x] Adicionar secao final `Resumo` para validate e deploy.
- [x] Adicionar deploy automatico dos arquivos alterados apos merge na `main`.
- [x] Registrar arquivos criados/alterados.
- [x] Validar sintaxe local do script.

## Validacao local executada
- `node --check scripts/ci/check-apex-coverage.mjs`
- `node --check scripts/ci/prepare-pr-validation.mjs`
- `node --check scripts/ci/summarize-salesforce-job.mjs`
- `node scripts/ci/prepare-pr-validation.mjs --base HEAD --head HEAD --source-root force-app --tests-file .github/salesforce-pr-test-classes.txt --out-dir /private/tmp/W-000001-pr-scope`
- `GITHUB_STEP_SUMMARY=/private/tmp/W-000001-summary/summary.md node scripts/ci/prepare-pr-validation.mjs --base HEAD --head HEAD --source-root force-app --tests-file .github/salesforce-pr-test-classes.txt --out-dir /private/tmp/W-000001-summary/deploy-scope --operation deploy`
- `node scripts/ci/check-apex-coverage.mjs /private/tmp/W-000001-coverage 80`
- `node scripts/ci/check-apex-coverage.mjs /private/tmp/W-000001-coverage 85` retornou erro esperado para cobertura abaixo do limite.
- `node scripts/ci/check-apex-coverage.mjs /private/tmp/W-000001-coverage-target 80 /private/tmp/W-000001-coverage-target/pr-apex-targets.txt`
- `node scripts/ci/check-apex-coverage.mjs /private/tmp/W-000001-coverage-target 85 /private/tmp/W-000001-coverage-target/pr-apex-targets.txt` retornou erro esperado para classe Apex abaixo do limite.
- `GITHUB_STEP_SUMMARY=/private/tmp/W-000001-summary/summary.md node scripts/ci/check-apex-coverage.mjs /private/tmp/W-000001-coverage-target 80 /private/tmp/W-000001-coverage-target/pr-apex-targets.txt`
- `GITHUB_STEP_SUMMARY=/private/tmp/W-000001-summary/final-summary.md node scripts/ci/summarize-salesforce-job.mjs --operation validate --out-dir /private/tmp/W-000001-coverage-target --threshold 80 --auth-status success --salesforce-status success --coverage-status success`
- `GITHUB_STEP_SUMMARY=/private/tmp/W-000001-summary/failure-summary.md node scripts/ci/summarize-salesforce-job.mjs --operation deploy --out-dir /private/tmp/W-000001-coverage-target --threshold 85 --auth-status success --salesforce-status success --coverage-status failure`
- `ruby -e "require 'yaml'; YAML.load_file('.github/workflows/pr-main-validate.yml'); puts 'yaml ok'"`
- `sf project deploy validate --help | rg -n "source-dir|target-org|test-level|coverage-formatters|results-dir|junit|wait|api-version"`
- `sf project deploy start --help | rg -n "source-dir|target-org|test-level|coverage-formatters|results-dir|junit|wait|api-version|tests"`

## Riscos e observacoes
- Secrets do GitHub Actions normalmente nao sao expostos para PRs vindas de forks; nesse caso, o job pode falhar por falta de autenticacao.
- A validacao-only deploy com `RunSpecifiedTests` depende da manutencao de `.github/salesforce-pr-test-classes.txt`.
- A org Salesforce tambem aplica os criterios nativos de deploy; o gate de 80% por classe Apex alterada e uma regra adicional do repositorio.
- Alteracoes nao Apex, como LWC, serao validadas como source da PR, mas a etapa de cobertura so roda quando houver classe ou trigger Apex alterado.
- O deploy automatico pressupoe protecao da branch `main`; pushes diretos na `main` tambem dispararao deploy dos arquivos alterados.
