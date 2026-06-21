# Dependencias do pacote

## Incluido no pacote

- `AGENTS.md`
- `CLAUDE.md`
- `.agents/rules/salesforce-agent.md`
- `.env.example`
- `.gitignore`
- `.vscode/tasks.json`
- `PORTABLE-INSTALL.md`
- `DEPENDENCIES.md`

## Necessario no ambiente destino

- Ferramentas padrao do projeto Salesforce destino, conforme a necessidade da demanda.
- Autenticacoes, chaves e acessos devem ser configurados fora deste pacote e nunca versionados.

## Itens que ficam fora do pacote

- `.key`, `.pem`, `.p12` ou `.jks` reais.
- `.env` real.
- `.sf/` ou `.sfdx/`.
- `node_modules/`.
- Senhas, tokens, refresh tokens, client secrets ou chaves privadas.

Esses itens devem ser configurados localmente fora do repositorio.
