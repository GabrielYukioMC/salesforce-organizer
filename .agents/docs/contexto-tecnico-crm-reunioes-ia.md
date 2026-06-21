# Contexto Tecnico - CRM, Reunioes E IA

Fonte: retrieve da org `dev-org` realizado em `2026-06-20 23:17:14 -03`, com API `65.0`. Antes desta analise, Apex Classes e Lightning Web Components foram recuperados da org para atualizar o workspace local.

## Escopo

Este documento consolida os metadados de CRM e automacoes de IA recuperados da org: Account/Opportunity, compradores, atas de reuniao, geracao de tasks, user stories e test reports.

Arquivos principais:

- `force-app/main/default/objects/Account`
- `force-app/main/default/objects/Opportunity`
- `force-app/main/default/objects/Task`
- `force-app/main/default/objects/Comprador__c`
- `force-app/main/default/objects/MeetingMinutes__c`
- `force-app/main/default/objects/UserStory__c`
- `force-app/main/default/objects/TestReport__c`
- `force-app/main/default/classes/MeetingTranscriptHandler.cls`
- `force-app/main/default/classes/MeetingTranscriptPayload.cls`
- `force-app/main/default/classes/MeetingMinutesService.cls`
- `force-app/main/default/classes/MeetingTaskService.cls`
- `force-app/main/default/classes/UserStoryParser.cls`
- `force-app/main/default/classes/TestRunnerHandler.cls`
- `force-app/main/default/classes/TestRunnerService.cls`
- `force-app/main/default/classes/CompradorController.cls`
- `force-app/main/default/classes/CompradorSelector.cls`
- `force-app/main/default/lwc/contasOportunidade`
- `force-app/main/default/aura/meetingMinutesViewer`
- `force-app/main/default/flows/Flow_api_url.flow-meta.xml`
- `force-app/main/default/flows/Account_Executar_Testes_de_IA.flow-meta.xml`

## Modelo De Dados

### Account

Campos custom/relevantes recuperados:

| Campo | Tipo | Uso tecnico |
|---|---|---|
| `RendaMensal__c` | Currency | Usado em contexto financeiro/CRM. |
| `Anotacoes__c` | LongTextArea | Usado pelo Flow de IA como anotacoes da reuniao. |
| `Transcricao_Reuniao__c` | LongTextArea | Usado pelo Flow de IA como transcricao. |
| `Tactiq_URL__c` | Url | Possivel fonte de transcricao externa. |

Tambem foram recuperados campos padrao de Account e record type `Banco`.

### Opportunity

Objeto padrao recuperado porque `Comprador__c` se relaciona com Opportunity.

Campos padrao e custom recuperados incluem `AccountId`, `Amount`, `CloseDate`, `StageName`, `Type` e exemplos custom de org (`CurrentGenerators__c`, `DeliveryInstallationStatus__c`, `MainCompetitors__c`, `OrderNumber__c`, `TrackingNumber__c`).

### `Comprador__c`

Configuracao:

- Label: `Comprador`
- Plural: `Compradores`
- Deployment: `Deployed`
- Sharing model: `ReadWrite`

Campos:

| Campo | Tipo | Destino | Observacao |
|---|---|---|---|
| `Conta__c` | Lookup obrigatorio | `Account` | Delete constraint `Restrict`. |
| `Oportunidade__c` | Lookup obrigatorio | `Opportunity` | Delete constraint `Restrict`. |
| `Papel__c` | Picklist | - | Papel do comprador na oportunidade. |

### `MeetingMinutes__c`

Objeto de ata de reuniao gerada por IA.

Campos recuperados:

| Campo | Tipo | Uso tecnico |
|---|---|---|
| `Account__c` | Lookup `Account` | Vincula a ata ao cliente/conta. |
| `Conteudo_Ata__c` | LongTextArea | Conteudo final gerado pela IA. |
| `Transcricao__c` | LongTextArea | Transcricao de origem. |
| `Data_Reuniao__c` | Date | Data da reuniao. |

FlexiPage:

- `Meeting_Minutes_Record_Page` para `MeetingMinutes__c`.
- Inclui componente Aura `meetingMinutesViewer`.

### `UserStory__c`

Objeto gerado a partir das atas.

Campos:

| Campo | Tipo | Uso tecnico |
|---|---|---|
| `Account__c` | Lookup `Account` | Conta relacionada. |
| `Ata_de_Reuniao__c` | Lookup `MeetingMinutes__c` | Ata de origem. |
| `Perfil__c` | Text | Perfil extraido da estrutura "EU, COMO". |
| `Funcionalidade__c` | LongText/Text | Funcionalidade desejada. |
| `Beneficio__c` | Text | Beneficio esperado. |
| `Criterios_Gherkin__c` | LongTextArea | Criterios extraidos. |
| `Status__c` | Picklist/Text | Criado como `Backlog`. |
| `Prioridade__c` | Picklist/Text | `Alta`, `Média`, `Baixa`; default `Média`. |
| `Reuniao__c` | Text | Titulo da reuniao. |

### `TestReport__c`

Objeto de relatorio de validacao gerado pelo Test Runner.

Campos:

| Campo | Tipo | Uso tecnico |
|---|---|---|
| `Account__c` | Lookup `Account` | Conta validada. |
| `MeetingMinutes__c` | Lookup `MeetingMinutes__c` | Ata validada. |
| `Resultado__c` | LongTextArea | Relatorio formatado. |
| `Total_Cenarios__c` | Number | Total de cenarios avaliados. |
| `Cenarios_OK__c` | Number | Cenarios aprovados. |
| `Cenarios_Falhos__c` | Number | Cenarios falhos. |
| `Status_Geral__c` | Picklist/Text | `Aprovado`, `Parcial`, `Reprovado`. |

### Task

Usado por `MeetingTaskService` para criar action items a partir da ata.

Campos usados:

- `Subject`
- `Description`
- `Status`
- `Priority`
- `ActivityDate`
- `WhatId`

## Relacionamentos

| Origem | Destino | Uso |
|---|---|---|
| `Comprador__c.Conta__c` | `Account` | Lista compradores/contas numa oportunidade. |
| `Comprador__c.Oportunidade__c` | `Opportunity` | Base do LWC `contasOportunidade`. |
| `MeetingMinutes__c.Account__c` | `Account` | Ata pertence a uma conta. |
| `UserStory__c.Account__c` | `Account` | User story gerada para a conta. |
| `UserStory__c.Ata_de_Reuniao__c` | `MeetingMinutes__c` | Rastreabilidade da user story. |
| `TestReport__c.Account__c` | `Account` | Relatorio da conta. |
| `TestReport__c.MeetingMinutes__c` | `MeetingMinutes__c` | Relatorio da ata. |
| `Task.WhatId` | `Account` | Action items gerados vinculados a Account. |

## CRM E Opportunity

`contasOportunidade`:

- LWC exposto para `lightning__RecordPage`.
- Esta em `Opportunity_Record_Page` e `Opportunity_Record_Page1`.
- Recebe `recordId` da Opportunity.
- Chama `CompradorController.getContasByOportunidade(recordId)`.
- Exibe `Conta__r.Name`, `Conta__r.RendaMensal__c` e `Conta__r.Phone`.
- Salva atualizacoes chamando `CompradorController.saveContas(List<Account>)`, que faz `update contas`.

Risco:

- `saveContas` atualiza a lista de `Account` recebida diretamente. Deve-se controlar quais campos o LWC envia e garantir FLS/CRUD se evoluir para uso amplo.

## Reunioes E IA

### Payload

`MeetingTranscriptPayload` carrega dados de entrada para geracao:

- `accountId`
- `meetingTitle`
- `meetingDate`
- `transcriptText`
- `transcriptUrl`
- `participants`
- `anotacoes`

### Entrada Via Flow Ou REST

`MeetingTranscriptHandler`:

- `@InvocableMethod` com label `Gerar Ata de Reunião`.
- `@RestResource(urlMapping='/meeting-transcript/*')`.
- Gera conteudo da ata.
- Cria `MeetingMinutes__c`.
- Cria `Task` para proximos passos.
- Parseia e cria `UserStory__c`.
- Retorna status, Id da ata, quantidade de tasks e user stories.

### Geracao Da Ata

`MeetingMinutesService.generateMinutes`:

1. Usa `payload.transcriptText` ou busca texto via `payload.transcriptUrl`.
2. Se nao houver anotacoes textuais e houver `accountId`, tenta buscar a imagem mais recente anexada na Account.
3. Usa Gemini Vision para extrair texto da imagem.
4. Chama Gemini para gerar ata base com:
   - participantes;
   - assuntos discutidos;
   - pontos principais;
   - resumo final;
   - blocos tematicos;
   - gaps;
   - proximos passos;
   - user stories com criterios Gherkin.
5. Se houver anotacoes, faz segunda chamada para enriquecer a ata.
6. Se nao houver anotacoes, faz chamada para gerar consolidado final.
7. Cria header final e retorna conteudo.

`createMeetingMinutes`:

- Exige `accountId`.
- Cria `MeetingMinutes__c` com `Name = 'Ata - ' + title`.
- Preenche `Account__c`, `Conteudo_Ata__c`, `Transcricao__c` e `Data_Reuniao__c`.

### Criacao De Tasks

`MeetingTaskService.createTasksFromMinutes`:

- Extrai secao `PROXIMOS PASSOS` ou `PRÓXIMOS PASSOS`.
- Espera tabela em Markdown com colunas acao/responsavel/prazo.
- Cria `Task` com:
  - `Subject`: acao.
  - `Description`: responsavel, prazo e marcador de geracao automatica.
  - `Status = 'Not Started'`.
  - `Priority = 'Normal'`.
  - `ActivityDate = Date.today().addDays(7)`.
  - `WhatId = accountId`.

### Criacao De User Stories

`UserStoryParser`:

- Localiza secao de user stories por marcadores (`USER STORIES`, `US-01`, etc.).
- Extrai linhas `US-XX | Titulo | Prioridade: ...`.
- Extrai estrutura `EU, COMO ... QUERO ... PARA ...`.
- Captura criterios Gherkin.
- Cria `UserStory__c` com status `Backlog` e prioridade default `Média`.

### Test Runner

`TestRunnerHandler`:

- Invocable `Executar Testes da Ata`.
- Recebe lista de Account Ids.
- Busca a ultima `MeetingMinutes__c` da Account.
- Chama `TestRunnerService.runTests`.
- Salva `TestReport__c`.

`TestRunnerService` valida:

- Ata criada e vinculada a Account.
- Conteudo da ata maior que 100 caracteres.
- Transcricao salva.
- User Stories criadas.
- User Stories com status e prioridade.
- Tasks criadas hoje para a Account.
- Tasks com responsavel no `Description`.
- Usa Gemini para analise textual dos resultados.

## Componentes De UI

### Aura `meetingMinutesViewer`

Recuperado como `AuraDefinitionBundle`.

Funcao:

- Disponivel para record home (`flexipage:availableForRecordHome`) e recebe `recordId`.
- Usa `force:recordData` para carregar `Name`, `Conteudo_Ata__c`, `Data_Reuniao__c`.
- Parseia conteudo da ata em temas, contexto, gaps, proximos passos e user stories.
- Renderiza blocos tematicos.
- Possui botao `Baixar TXT`.
- Fallback: mostra conteudo bruto se nao conseguir parsear temas.

### `contasOportunidade`

LWC em paginas de Opportunity para listar e editar contas relacionadas via `Comprador__c`.

## Flows

### `Flow_api_url`

Status: `Active`

Tipo: `Flow`

Comportamento recuperado:

- Busca Account por Id.
- Usa campos `Account.Anotacoes__c` e `Account.Transcricao_Reuniao__c`.
- Chama action invocable `MeetingTranscriptHandler`.
- Mostra tela de sucesso/erro.

### `Account_Executar_Testes_de_IA`

Status: `Active`

Tipo: `Flow`

Comportamento:

- Chama action invocable `TestRunnerHandler`.
- Mostra mensagem de sucesso informando que o relatorio ficou na related list `Test Reports`.

### Outros flows recuperados

- `teste_scanner`: active, record-triggered after save em Account; cria `Transacao__c` de teste e atualiza Account. Parece artefato experimental.
- `sfdc_default_ReportExport_Protection_Flow`: draft, Transaction Security Flow padrao.
- `criar_taks_de_visita`: existe localmente, active no XML, trigger em Lead e Task, mas o retrieve da org informou que `Flow:criar_taks_de_visita` nao existe em `dev-org`.

## Integracoes Externas

Remote Sites:

| Remote Site | URL | Uso esperado |
|---|---|---|
| `Gemini_API` | `https://generativelanguage.googleapis.com` | Callouts para Gemini. |
| `Tactiq_API` | `https://app.tactiq.io` | Possivel fonte externa de transcricao. |
| `ApexDevNet` | `http://www.apexdevnet.com` | Recuperado, sem uso direto encontrado nas classes analisadas. |

Seguranca:

- `MeetingMinutesService` contem uma chave Gemini hardcoded em Apex. O valor nao deve ser propagado em documentacao, logs ou prompts.
- Recomendacao tecnica: mover para Named Credential/External Credential ou Protected Custom Metadata.

## Cenarios Para Orquestracao Tecnica

Criacao de ata:

- Usar Flow `Flow_api_url`, invocable `MeetingTranscriptHandler` ou REST `/services/apexrest/meeting-transcript/*`.
- Fornecer `accountId`, titulo, data e transcricao por texto ou URL.
- Opcionalmente fornecer anotacoes para enriquecer a ata.
- Verificar criacao de `MeetingMinutes__c`, `Task` e `UserStory__c`.

Atualizacao:

- O fluxo principal cria registros; nao ha camada Apex dedicada para editar atas ou user stories.
- Edicoes manuais devem respeitar relacionamentos `Account__c` e `Ata_de_Reuniao__c`.

Validacao:

- Rodar `Account_Executar_Testes_de_IA` para criar `TestReport__c`.
- Validar se a ata tem conteudo suficiente, se transcricao foi salva, se user stories/tasks foram geradas.

Deduplicacao:

- Nao ha deduplicacao de `MeetingMinutes__c`; rodar a geracao varias vezes cria varias atas.
- `MeetingTaskService` cria tasks sempre que executado; nao busca tasks existentes equivalentes.
- `UserStoryParser.createUserStories` insere sempre novos registros; nao ha chave externa ou comparacao por titulo/ata.

Integracao:

- Gemini e chamado diretamente por HTTP.
- Tactiq pode ser usado indiretamente por URL de transcricao, mas a classe nao possui cliente especifico Tactiq.
- O REST resource permite integracao externa enviando JSON do payload.

## Riscos E Pontos De Atencao

- Chave Gemini hardcoded em Apex e um risco alto. Deve ser removida do codigo versionado.
- Nao ha Named Credential para Gemini/Tactiq.
- `fetchTranscript(String url)` aceita URL recebida no payload e faz callout direto; validar allowlist se exposto a usuarios externos.
- `MeetingTaskService` depende fortemente do formato Markdown da ata. Mudanca no prompt pode quebrar criacao de tasks.
- `UserStoryParser` tambem depende do formato textual `US-XX | ...` e `EU, COMO ...`.
- `TestRunnerService` avalia tasks criadas `TODAY`, entao resultados podem mudar conforme horario/data de execucao.
- `teste_scanner` parece artefato experimental ativo e pode criar `Transacao__c` em eventos de Account.
- `Flow_api_url` usa campos de Account como entrada; se `Anotacoes__c`/`Transcricao_Reuniao__c` nao tiverem FLS adequada, o Flow pode falhar para usuarios finais.

