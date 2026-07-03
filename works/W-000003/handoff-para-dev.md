# Handoff para Dev - W-000003

## Caso

Desenvolvimento da **Central De Conhecimento**, uma tab dentro do app **Gerenciador Geral**, contendo o módulo **Repositório Técnico**.

O módulo serve para devs Salesforce organizarem conhecimento técnico por **cliente** e **projeto**, com registros dos tipos:

- Caso recorrente
- Query SOQL
- Script Anonymous Apex
- Erro conhecido
- Procedimento

Importante: o MVP **não executa scripts Anonymous Apex**. Ele apenas cadastra, consulta, edita, arquiva e copia conteúdo técnico.

## Status Atual

Implementado e deployado na `dev-org`.

Deploys relevantes:

- Implementação base: `0AfgL00000QEBRFSA5`
- Ajuste visual: `0AfgL00000QECqLSAX`

Validações executadas:

- Dry-run da implementação base passou.
- Deploy real da implementação base passou.
- Dry-run dos ajustes visuais passou.
- Deploy real dos ajustes visuais passou.
- `RepositorioTecnicoControllerTest`: 3/3 testes passando.

Comando usado para teste pós-ajuste:

```bash
sf apex run test --target-org dev-org --tests RepositorioTecnicoControllerTest --result-format human --wait 10
```

## Checagem Prévia

Antes de criar os metadados, a `dev-org` foi consultada. Não existiam:

- `ClienteRepositorio__c`
- `ProjetoRepositorio__c`
- `RegistroRepositorio__c`
- `RepositorioTecnicoController`
- bundles LWC do repositório
- tab `Central_De_Conhecimento`

## Estrutura Criada

### Objetos

`ClienteRepositorio__c`

- `Name`
- `Ativo__c`
- `Descricao__c`
- `Observacoes__c`

`ProjetoRepositorio__c`

- `Name`
- `Cliente__c`
- `Ativo__c`
- `Descricao__c`

`RegistroRepositorio__c`

- Campos comuns: cliente, projeto, tipo, status, resumo, conteúdo, criticidade, risco, ambiente, tags, objeto Salesforce, classe/flow/componente e ordem.
- Campos específicos por tipo: sintoma, causa provável, investigação, resolução, validação, query SOQL, script Apex, rollback, mensagem de erro, passos, cuidados, resultado esperado etc.

### Apex

Arquivos:

- `force-app/main/default/classes/RepositorioTecnicoController.cls`
- `force-app/main/default/classes/RepositorioTecnicoControllerTest.cls`

Métodos principais:

- `getClientes`
- `getProjetosByCliente`
- `getRegistros`
- `criarCliente`
- `criarProjeto`
- `salvarRegistro`
- `arquivarRegistro`

Regras importantes:

- Busca principal não retorna registros com `Status__c = 'Arquivado'`.
- Clientes/projetos inativos não aparecem nos seletores principais.
- Validação de obrigatórios existe no LWC e no Apex.
- Arquivamento atualiza `Status__c` para `Arquivado`.

### LWCs

Arquivos principais:

- `repositorioTecnicoHome`: tela principal.
- `repositorioTabs`: tabs por tipo de registro.
- `repositorioCardList`: listagem, busca e filtro por status.
- `repositorioCard`: card individual.
- `repositorioClienteModal`: modal de novo cliente.
- `repositorioProjetoModal`: modal de novo projeto.
- `repositorioRecordForm`: formulário dinâmico por tipo.
- `repositorioRecordDetail`: detalhe dinâmico por tipo.
- `codeBlockViewer`: bloco de código com botão copiar.
- `repositorioConfig`: constantes compartilhadas de tipos, opções e obrigatórios.

### App e Permissão

Tab criada:

- `force-app/main/default/tabs/Central_De_Conhecimento.tab-meta.xml`
- Label: `Central De Conhecimento`
- Componente: `repositorioTecnicoHome`

App alterado:

- `force-app/main/default/applications/Gerenciador_Geral.app-meta.xml`
- Adicionada a tab `Central_De_Conhecimento`.

Permission set criada:

- `force-app/main/default/permissionsets/Repositorio_Tecnico_Admin.permissionset-meta.xml`

Ela foi atribuída ao usuário padrão da `dev-org`.

## Como Abrir

```bash
sf org open --target-org dev-org --path /lightning/app/c__Gerenciador_Geral
```

Não compartilhar URL gerada por `sf org open --url-only`, porque ela contém sessão sensível.

## Fluxo Manual Para Testar

1. Abrir o app **Gerenciador Geral**.
2. Entrar na tab **Central De Conhecimento**.
3. Criar um cliente.
4. Confirmar que o cliente aparece e fica selecionado.
5. Criar um projeto.
6. Confirmar que o projeto aparece e fica selecionado.
7. Criar um registro em cada aba:
   - Casos recorrentes
   - Queries SOQL
   - Scripts Apex
   - Erros conhecidos
   - Procedimentos
8. Validar que cada formulário mostra campos específicos do tipo.
9. Abrir detalhes de cada tipo.
10. Copiar uma Query SOQL.
11. Copiar um Script Apex.
12. Arquivar um registro.
13. Confirmar que o registro arquivado sai da listagem.
14. Testar busca textual e filtro por status.

## Dados Manuais Sugeridos

Cliente:

```txt
EMCCAMP
```

Projetos:

```txt
Sustentação
Oferta Ativa
```

Query SOQL:

```sql
SELECT Id, Name, Status, OwnerId, CreatedDate
FROM Lead
WHERE MobilePhone = '11999999999'
ORDER BY CreatedDate DESC
```

Script Apex:

```apex
List<Lead> leads = [
    SELECT Id, Status
    FROM Lead
    WHERE Status = 'Novo'
    LIMIT 10
];

for (Lead leadRecord : leads) {
    leadRecord.Status = 'Em atendimento';
}

update leads;
```

## Decisões Técnicas

- Um único objeto `RegistroRepositorio__c` guarda todos os tipos de conteúdo.
- O campo `Tipo__c` controla card, formulário e detalhe.
- A config compartilhada fica em `repositorioConfig` para reduzir duplicação.
- O botão de copiar usa Clipboard API, com fallback no componente principal.
- O layout foi refinado a partir dos mockups fornecidos, mas sem usar screenshot estático dentro da UI.
- Os prints foram usados como referência visual, não como assets de runtime.

## Observações

- O lint local não rodou porque as dependências npm não estavam instaladas no workspace no momento da implementação.
- A validação principal foi feita via deploy Salesforce, compilação LWC/Apex e testes Apex.
- O `git status` ainda mostra os arquivos da W-000003 como novos/não rastreados se nada foi commitado depois da implementação.

## Próximos Melhorias Possíveis

- Criar dados de exemplo via anonymous Apex ou script de seed.
- Adicionar list views para os três objetos.
- Adicionar page layouts customizados se os objetos forem usados fora do LWC.
- Adicionar confirmação customizada de arquivamento no lugar de `window.confirm`.
- Adicionar paginação ou lazy loading se o volume crescer.
- Adicionar ordenação na UI por criticidade, status ou última alteração.
- Criar testes Jest para os LWCs quando as dependências npm estiverem instaladas.
