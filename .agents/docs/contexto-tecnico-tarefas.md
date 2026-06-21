# Contexto Tecnico - Tarefas

Fonte: retrieve da org `dev-org` realizado em `2026-06-20 23:17:14 -03`, com API `65.0`. Antes desta analise, Apex Classes e Lightning Web Components foram recuperados da org para atualizar o workspace local.

## Escopo

Este documento consolida o modulo de tarefas do projeto Salesforce Organizer, incluindo `Tarefa__c`, seus LWCs, Apex, automacoes e o ponto de integracao com apontamentos de horas.

Arquivos principais:

- `force-app/main/default/objects/Tarefa__c`
- `force-app/main/default/classes/TarefaController.cls`
- `force-app/main/default/classes/TarefaService.cls`
- `force-app/main/default/classes/TarefaSelector.cls`
- `force-app/main/default/classes/TarefaTriggerHandler.cls`
- `force-app/main/default/triggers/TarefaTrigger.trigger`
- `force-app/main/default/lwc/centralTarefas`
- `force-app/main/default/lwc/criarTarefasTab`
- `force-app/main/default/lwc/exibirTarefasTab`
- `force-app/main/default/lwc/tarefasKanban`
- `force-app/main/default/lwc/tarefaKanbanCard`
- `force-app/main/default/tabs/Central_de_Tarefas.tab-meta.xml`

## Modelo De Dados

Objeto principal: `Tarefa__c`

Configuracao:

- Label: `Tarefa`
- Plural: `Tarefas`
- Deployment: `Deployed`
- Sharing model: `ReadWrite`

Campos funcionais:

| Campo | Tipo | Uso tecnico |
|---|---|---|
| `Name` | Name | Titulo obrigatorio validado em Apex e LWC. |
| `Status__c` | Picklist obrigatoria | Kanban, fluxo de vida e trigger. Valores: `Não iniciado`, `Em andamento`, `Concluído`, `Em espera`, `Cancelado`. |
| `Prioridade__c` | Picklist | Valores: `Alta`, `Média`, `Baixa`. Obrigatoria na criacao. |
| `PrioridadeNumber__c` | Formula Number | Ordenacao numerica: Alta = 0, Media = 1, Baixa = 2. |
| `TipoTarefa__c` | Picklist | Valores: `Estudos`, `Outros`, `Trabalho`, `Pessoal`. Se nao for `Trabalho`, o LWC limpa `Projeto__c`. |
| `CloseDate__c` | DateTime | Prazo da tarefa e base para ordenacao/recorrencia. |
| `HasCloseDate__c` | Formula Number | `IF(ISBLANK(CloseDate__c), 1, 0)`, usado para jogar tarefas sem prazo para o fim. |
| `InicioTarefa__c` | DateTime | Preenchido pelo trigger quando status entra em `Em andamento`. |
| `FimTarefa__c` | DateTime | Preenchido pelo trigger quando status entra em `Concluído`. |
| `Descricao__c` | LongTextArea | Limitado em Apex a 2000 caracteres. |
| `Checklist__c` | LongTextArea | Editado no card/modal. |
| `Recorrente__c` | Checkbox | Ativa geracao de copias na criacao. |
| `FrequenciaTarefa__c` | Picklist | `Semanal`, `Quinzenal`, `Mensal`. |
| `Arquivada__c` | Checkbox | Usado para limpeza logica/historico. Default `false`. |

Relacionamentos:

| Campo | Relaciona com | Comportamento |
|---|---|---|
| `UsuarioProprietario__c` | `User` | Preenchido em `TarefaService.criarTarefa` com `UserInfo.getUserId()`. |
| `Projeto__c` | `Projeto__c` | Lookup opcional. Usado para gerar apontamentos com IDs Elera. Delete constraint `SetNull`. |
| `ContaReferencia__c` | `Account` | Lookup opcional. Hoje nao aparece nos selectors principais. |

Record Types ativos:

- `Pessoal`
- `ProjetosPessoais`
- `Trabalho`

Todos os record types carregam os mesmos valores de `Status__c`, `Prioridade__c`, `TipoTarefa__c` e `FrequenciaTarefa__c`.

## Camada Apex

Padrao encontrado:

`LWC -> TarefaController -> TarefaService -> TarefaSelector -> Tarefa__c`

Classes:

- `TarefaController`: expoe metodos `@AuraEnabled` para os LWCs.
- `TarefaService`: contem validacoes, criacao recorrente, update, delete e arquivamento.
- `TarefaSelector`: centraliza queries filtradas por usuario em listagem/historico.
- `TarefaTriggerHandler`: controla timestamps e geracao de apontamentos.
- `TarefaTrigger`: roda em `before insert`, `before update` e `after update`.

Metodos expostos:

| Metodo | Tipo | Comportamento |
|---|---|---|
| `criarTarefa(Tarefa__c)` | DML insert | Valida nome, prioridade e descricao. Preenche `UsuarioProprietario__c`. Cria copias se recorrente. |
| `buscarTarefasPorUsuarioKanban()` | cacheable | Retorna tarefas do usuario atual, nao arquivadas, ordenadas por prazo e prioridade. |
| `atualizarStatusTarefa(Id, String)` | DML update | Atualiza apenas `Status__c`. Aciona trigger se virar `Em andamento` ou `Concluído`. |
| `atualizarTarefa(Tarefa__c)` | DML update | Atualiza campos permitidos no service. |
| `apagarTarefasAntigas()` | DML update | Marca como `Arquivada__c = true` tarefas concluidas/canceladas modificadas ha mais de 20 dias. |
| `buscarTarefasArquivadas()` | cacheable | Retorna ate 200 arquivadas por `LastModifiedDate DESC`. |
| `deletarTarefa(Id)` | DML delete | Deleta diretamente por Id. |

Recorrencia de tarefas:

- `Semanal`: cria 12 registros, incrementando 7 dias.
- `Quinzenal`: cria 6 registros, incrementando 14 dias.
- `Mensal`: cria 6 registros, incrementando 1 mes.
- A recorrencia so desloca `CloseDate__c`; os demais campos sao clonados.

Ordenacao padrao:

```soql
ORDER BY HasCloseDate__c ASC,
         CloseDate__c ASC,
         PrioridadeNumber__c ASC
```

## Trigger E Apontamentos

`TarefaTrigger` delega para `TarefaTriggerHandler`.

Before insert/update:

- Ao entrar em `Em andamento`, se `InicioTarefa__c` estiver vazio, preenche com `DateTime.now()`.
- Ao entrar em `Concluído`, se `FimTarefa__c` estiver vazio, preenche com `DateTime.now()`.

After update:

- Detecta tarefas que acabaram de entrar em `Concluído`.
- Reconsulta `Projeto__r.Id_Elera__c` e `Projeto__r.Id_Perfil_Alocacao_Elera__c`.
- Busca apontamentos existentes no periodo via `ApontamentoSelector.buscarPorPeriodo`.
- Usa `ApontamentoBuilder.buildSObjectsFromTarefa` para criar `ApontamentoDeHoras__c` sem sobrepor horarios ja ocupados.
- Insere os apontamentos locais.

Deduplicacao de apontamentos gerados por tarefa:

- O builder arredonda inicio/fim para meia hora.
- Considera expediente fixo 09:00-18:00 no fuso UTC-3.
- Divide tarefas multi-dia em segmentos diarios.
- Subtrai apontamentos existentes que se sobrepoem.
- Nao altera apontamentos existentes; cria apenas slots livres.
- Ignora slots menores que 15 minutos.
- No mesmo batch, os apontamentos recem-calculados entram na lista de ocupados para as proximas tarefas concluidas.

## Lightning Web Components

Componentes do modulo:

| LWC | Exposto | Funcao |
|---|---:|---|
| `centralTarefas` | Sim | Container principal em tab/app page. |
| `criarTarefasTab` | Nao | Formulario de criacao. Dispara evento `tarefacriada`. |
| `exibirTarefasTab` | Nao | Lista/Kanban, filtros, historico, edicao e exclusao. Expoe `@api refreshData()`. |
| `tarefasKanban` | Nao | Drag-and-drop entre colunas de status. |
| `tarefaKanbanCard` | Nao | Card individual com modal de edicao inline. |
| `gerenciadorDeTarefas` | Sim | Bundle recuperado da org, mas HTML esta vazio. |

`centralTarefas` possui tres abas:

- `Criar Task` -> `c-criar-tarefas-tab`
- `Ver Tasks` -> `c-exibir-tarefas-tab`
- `Apontamentos` -> `c-apontamentos-tab`

Eventos relevantes:

- `criarTarefasTab` dispara `tarefacriada` com `bubbles: true, composed: true`.
- `centralTarefas` muda para aba de visualizacao e chama `exibirTarefasTab.refreshData()`.
- `tarefasKanban` dispara `tarefasatualizada` apos atualizar status.
- `tarefaKanbanCard` dispara `tarefasalva` apos salvar edicao.

Exposicao:

- Custom Tab `Central_de_Tarefas` aponta para `centralTarefas`.
- Custom Tab `Gerenciador_de_Tarefas` aponta para `gerenciadorDeTarefas`, porem o componente esta vazio.
- App `Gerenciador_Geral` inclui `Central_de_Tarefas`.

## Cenarios Para Orquestracao Tecnica

Criacao:

- Criar via `TarefaController.criarTarefa`.
- Garantir `Name`, `Prioridade__c` e `Status__c` valido.
- Para tarefas de trabalho, preencher `Projeto__c` com Id de `Projeto__c`.
- Se `Recorrente__c = true`, escolher `FrequenciaTarefa__c` entre `Semanal`, `Quinzenal` e `Mensal`.

Atualizacao:

- Para mudanca simples de status/Kanban, preferir `atualizarStatusTarefa`.
- Para edicao completa, enviar payload compativel com os campos whitelisted em `TarefaService.atualizarTarefa`.
- Mudar status para `Concluído` tem efeito colateral: cria apontamentos.

Validacao:

- Picklists sao case-sensitive e devem usar exatamente os valores do metadata.
- `Descricao__c` nao pode passar de 2000 caracteres pela regra Apex.
- O service valida nome e prioridade, mas nao valida se `Projeto__c` e obrigatorio para `TipoTarefa__c = Trabalho`.

Deduplicacao:

- Tarefas em si nao possuem chave unica nem deduplicacao de titulo/prazo.
- A deduplicacao relevante ocorre nos apontamentos gerados ao concluir tarefas.
- Para evitar apontamentos duplicados, nao reabrir e concluir novamente a mesma tarefa sem verificar se ja existem apontamentos no periodo.

Integracao:

- O modulo de tarefas integra indiretamente com Elera via `ApontamentoDeHoras__c`.
- Para envio externo funcionar bem, `Projeto__c` da tarefa deve apontar para projeto com `Id_Elera__c` e `Id_Perfil_Alocacao_Elera__c` preenchidos.

## Riscos E Pontos De Atencao

- `TarefaController`, `TarefaService` e `TarefaSelector` estao `without sharing`. As queries principais filtram usuario, mas `atualizarStatusTarefa`, `atualizarTarefa` e `deletarTarefa` atualizam/deletam por Id sem revalidar ownership.
- `UsuarioProprietario__c` e `OwnerId` podem divergir se o dono do registro for alterado; selectors de tarefas usam `UsuarioProprietario__c`.
- Ao concluir tarefa sem `InicioTarefa__c`/`FimTarefa__c`, o builder usa fallback de `now - 1h` e `now`.
- Fuso UTC-3 esta hardcoded no builder de apontamentos.
- `gerenciadorDeTarefas` esta exposto, mas vazio.
- O Flow local `criar_taks_de_visita.flow-meta.xml` existe no workspace, mas o retrieve da org retornou que `Flow:criar_taks_de_visita` nao existe em `dev-org`. Ele atua sobre `Lead` e `Task`, nao sobre `Tarefa__c`.

