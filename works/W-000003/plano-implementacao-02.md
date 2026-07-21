# Plano de implementacao 02

## Informacoes da execucao

- IA/agente usado: Claude Code (Sonnet 5)
- Nivel/configuracao: modo plan mode, execucao direta na sessao principal
- Data de inicio: 2026-07-07

## Objetivo

Permitir que o usuario anexe ate 3 arquivos por registro do modulo Repositorio Tecnico (`RegistroRepositorio__c`), com secao de upload e visualizacao de anexos dentro do modal de detalhe (`repositorioRecordDetail`).

## Motivo deste plano

Usuario solicitou continuidade da Work W-000003 com uma funcionalidade nova (anexo de arquivos), distinta do objetivo do plano 01 (ajuste visual). Novo plano sequencial para manter rastreabilidade, conforme AGENTS.md.

## Etapas

- [x] Confirmar com usuario o nivel do anexo (por registro, nao por projeto)
- [x] Planejar arquitetura (sem objeto/campo novo, usando ContentVersion/ContentDocument/ContentDocumentLink nativos)
- [x] Criar `RegistroAnexoController.cls` (getAnexos, uploadAnexo, excluirAnexo) + `.cls-meta.xml`
- [x] Criar `RegistroAnexoControllerTest.cls` + `.cls-meta.xml`
- [x] Criar LWC `registroAnexos` (js/html/css/js-meta.xml)
- [x] Integrar `c-registro-anexos` em `repositorioRecordDetail.html`
- [x] Atualizar `manifest/package.xml` (novas ApexClass e LightningComponentBundle)
- [x] Atualizar `Repositorio_Tecnico_Admin.permissionset-meta.xml` (classAccesses aditivo)
- [x] Rodar lint/prettier local
- [x] Registrar arquivos alterados

## Observacoes

- Nao foi feito deploy nem commit (regra do CLAUDE.md). Codigo pronto para deploy granular a criterio do usuario.
- Testes Apex nao foram executados (sem conexao com dev-org nesta sessao) — comandos sugeridos no handoff para o usuario/proximo agente rodar.
- `npm install` foi executado nesta sessao para viabilizar lint/prettier (node_modules estava ausente, mesma limitacao ja registrada no plano 01).
- `npm run lint` no arquivo novo (`registroAnexos.js`) apontou 1 erro `no-alert` no uso de `window.confirm` — e o mesmo padrao ja usado em `repositorioTecnicoHome.js` (que tambem falha nessa regra hoje), entao foi mantido por consistencia arquitetural em vez de introduzir um padrao novo de confirmacao. Nenhum outro erro de lint no arquivo novo.
- `npm run prettier`/`prettier:verify` nao pode ser validado de forma confiavel: o repositorio nao tem arquivo de configuracao do Prettier (`.prettierrc`), entao `prettier --write` reformataria `.cls`/`.xml` para aspas duplas e estilo diferente do padrao atual do projeto (aspas simples, 4 espacos). Isso e uma lacuna pre-existente do projeto, nao relacionada a esta tarefa — nao foi corrigida para nao expandir o escopo. Os arquivos novos foram escritos manualmente seguindo o estilo observado nos arquivos vizinhos (aspas simples, indentacao de 4 espacos).
- Usuario testou em dev-org e reportou 2 problemas visuais/funcionais via print: (1) titulo do anexo duplicando a extensao (ex: "arquivo.png.png") e (2) fundo totalmente branco atras do modal de detalhe ao inves de transparente/dimmed.
- O problema (1) ja estava corrigido no codigo antes do deploy que o usuario testou (metodo `tituloSemExtensao` no `RegistroAnexoController.cls`, que grava o `Title` do `ContentVersion` sem a extensao); o print reflete uma versao antiga deployada. Precisa redeploy de `RegistroAnexoController.cls` para o usuario ver a correcao.
- O problema (2) foi corrigido nesta sessao: adicionada a regra `.slds-backdrop { background: transparent; }` em `repositorioRecordDetail.css`, escopada apenas a este componente (nao afeta os demais modais do modulo). Precisa redeploy de `repositorioRecordDetail` (LWC) para o usuario ver a correcao.
