# Plano de implementacao 01

## Informacoes do trabalho
- Work ID: W-000001
- IA/agente usado: Codex
- Modo: Default
- Data de inicio: 2026-06-20 23:33:37 -03
- Solicitacao: criar uma esteira de deploy/validacao para PRs abertas contra `main`, obrigando cobertura Apex minima de 80%.

## Objetivo
Criar uma validacao automatizada de pull request que autentique em uma org Salesforce de referencia, execute uma validacao-only deploy com testes locais e bloqueie a PR quando a cobertura Apex consolidada ficar abaixo de 80%.

## Premissas
- A org alvo sera autenticada no GitHub Actions por um segredo `SF_MAIN_AUTH_URL` no formato Salesforce DX auth URL.
- A validacao sera feita contra PRs direcionadas para a branch `main`.
- O job deve fazer validacao, nao deploy efetivo.
- A cobertura sera validada por script local a partir dos artefatos JSON gerados pelo Salesforce CLI.
- Para impedir merge mesmo quando alguem tentar ignorar checks, a regra de protecao/ruleset da branch `main` deve exigir o check `Salesforce validation and coverage gate`.

## Checklist
- [x] Registrar work e plano de implementacao.
- [x] Criar workflow de PR para `main`.
- [x] Criar script de gate de cobertura Apex.
- [x] Registrar arquivos criados/alterados.
- [x] Validar sintaxe local do script.

## Validacao local executada
- `node --check scripts/ci/check-apex-coverage.mjs`
- `node scripts/ci/check-apex-coverage.mjs /private/tmp/W-000001-coverage 80`
- `node scripts/ci/check-apex-coverage.mjs /private/tmp/W-000001-coverage 85` retornou erro esperado para cobertura abaixo do limite.
- `ruby -e "require 'yaml'; YAML.load_file('.github/workflows/pr-main-validate.yml'); puts 'yaml ok'"`
- `sf project deploy validate --help | rg -n "source-dir|target-org|test-level|coverage-formatters|results-dir|junit|wait|api-version"`

## Riscos e observacoes
- Secrets do GitHub Actions normalmente nao sao expostos para PRs vindas de forks; nesse caso, o job pode falhar por falta de autenticacao.
- A validacao-only deploy com `RunLocalTests` pode ser demorada dependendo do volume de testes da org.
- A org Salesforce tambem aplica os criterios nativos de deploy; o gate de 80% e uma regra adicional do repositorio.
