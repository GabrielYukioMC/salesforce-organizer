# W-000003 - Central De Conhecimento / Repositório Técnico

## Entrega

- Criados os objetos `ClienteRepositorio__c`, `ProjetoRepositorio__c` e `RegistroRepositorio__c`.
- Criados campos comuns e campos específicos para casos recorrentes, queries SOQL, scripts Anonymous Apex, erros conhecidos e procedimentos.
- Criado o controller `RepositorioTecnicoController` com busca, criação, edição e arquivamento.
- Criado o teste `RepositorioTecnicoControllerTest`.
- Criados os LWCs do módulo:
  - `repositorioTecnicoHome`
  - `repositorioClienteModal`
  - `repositorioProjetoModal`
  - `repositorioTabs`
  - `repositorioCardList`
  - `repositorioCard`
  - `repositorioRecordForm`
  - `repositorioRecordDetail`
  - `codeBlockViewer`
  - `repositorioConfig`
- Criada a tab `Central_De_Conhecimento` com label `Central De Conhecimento`.
- Adicionada a tab ao app `Gerenciador_Geral`.
- Criada a permission set `Repositorio_Tecnico_Admin`.

## Validação

- Antes da criação, a org `dev-org` foi consultada e não havia objetos, classe, LWCs ou tab com estes nomes.
- Dry-run de deploy executado com sucesso.
- Deploy real executado com sucesso na `dev-org`.
- Testes Apex pós-deploy:
  - `RepositorioTecnicoControllerTest`: 3/3 testes passando.
- Confirmado via SOQL/Tooling API:
  - objetos `ClienteRepositorio__c`, `ProjetoRepositorio__c`, `RegistroRepositorio__c`;
  - tab `Central_De_Conhecimento`.
- Permission set `Repositorio_Tecnico_Admin` atribuída ao usuário padrão da `dev-org`.

## Ajuste visual

- Tela principal refinada usando os mockups fornecidos como referência:
  - header com visual de console Salesforce;
  - métricas de clientes, projetos e registros;
  - tabs coloridas por tipo;
  - toolbar com busca e filtro de status;
  - cards com faixa de cor, ícone por tipo, campos resumidos e melhor hierarquia visual;
  - modais e detalhe com acabamento visual consistente;
  - bloco de código mais legível.
- Deploy visual executado na `dev-org`.
