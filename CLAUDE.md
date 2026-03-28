# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Deploy

Sempre que alterar qualquer arquivo do projeto, atualizar `manifest/package.xml` com os metadados modificados.

Para fazer deploy na org conectada:
```bash
sf project deploy start --manifest manifest/package.xml --target-org gabrielyukiomibecoca903@agentforce.com --api-version 59.0
```

Para verificar orgs conectadas:
```bash
sf org list
```

## Arquitetura

Aplicação Salesforce de gestão pessoal com dois módulos: **Tarefas** e **Financeiro**.

### Padrão de camadas (Apex)

Todos os módulos seguem o mesmo padrão:

```
LWC → Controller → Service → Selector → SObject
```

- **Controller**: expõe `@AuraEnabled`, sem lógica de negócio
- **Service**: validações e regras de negócio, atribui `UsuarioProprietario__c = UserInfo.getUserId()`
- **Selector**: SOQL isolado, filtra sempre por usuário dono

### Módulo de Tarefas

**Objeto:** `Tarefa__c`
Campos relevantes: `Status__c`, `Prioridade__c`, `PrioridadeNumber__c` (numérico para ordenação), `CloseDate__c`, `HasCloseDate__c` (flag para ordenar nulls por último), `TipoTarefa__c`, `Descricao__c` (max 2000 chars), `UsuarioProprietario__c`.

**Ordenação padrão no selector:** `HasCloseDate__c ASC, CloseDate__c ASC, PrioridadeNumber__c ASC`

**Valores de picklist Status__c** (usar exatamente assim — case sensitive):
- `Não iniciado`, `Em andamento`, `Concluído`, `Em espera`, `Cancelado`

**Componentes:**
- `centralTarefas` — container com tabs; ouve evento `tarefacriada` e chama `exibirTarefasTab.refreshData()`
- `criarTarefasTab` — formulário de criação; dispara `tarefacriada` (bubbles+composed) ao salvar
- `exibirTarefasTab` — alterna entre lista (`lightning-datatable`) e kanban; expõe `@api refreshData()` que chama `refreshApex`
- `tarefasKanban` — board com drag-and-drop entre colunas de status
- `tarefaKanbanCard` — card individual com modal de edição inline

### Módulo Financeiro

**Objeto:** `Transacao__c`
Campos: `Tipo__c` (Entrada/Saída), `Categoria__c`, `Valor__c`, `Data__c`, `Pago__c`, `Recorrente__c`, `Frequencia__c` (Mensal/Semestral/Anual).

**Lógica de recorrência** (em `TransferenciaService`): transações recorrentes são clonadas automaticamente — Mensal gera 12 cópias, Semestral 2, Anual 3.

**Componentes:**
- `calendarioFinanceiro` — visão calendário por mês com totais de entrada/saída e modal de lançamento
- `orcamentoMensal` — planejamento orçamentário com gráficos doughnut via Chart.js (`@salesforce/resourceUrl/chart`)
- `dashboardFinanceiro` — placeholder, ainda não implementado

### Utilitários

`c/utils` — módulo compartilhado com funções de formatação (`formatarDataHora`, `formatarData`, `formatarMoeda`, `formatarPercentual`, etc.). Locale padrão: `pt-BR`, moeda: `BRL`.

## Estrutura de metadados relevantes

```
force-app/main/default/
├── classes/          # TarefaController, TarefaService, TarefaSelector
│                     # TransferenciaController, TransferenciaService, TransferenciaSelector
├── lwc/              # Componentes LWC
├── objects/          # Tarefa__c, Transacao__c e campos customizados
└── staticresources/  # chart.min.js

manifest/
└── package.xml       # Manifest de deploy — manter sempre atualizado
```

## Tipos de metadados para package.xml

| O que alterar | `<name>` no package.xml |
|---|---|
| LWC component | `LightningComponentBundle` |
| Apex class | `ApexClass` |
| Custom object | `CustomObject` |
| Custom field | `CustomField` |
| Static resource | `StaticResource` |
