# Contexto Tecnico - Apontamentos E Integracao Elera

Fonte: retrieve da org `dev-org` realizado em `2026-06-20 23:17:14 -03`, com API `65.0`. Antes desta analise, Apex Classes e Lightning Web Components foram recuperados da org para atualizar o workspace local.

## Escopo

Este documento consolida o tema de apontamentos de horas, rotinas fixas, projetos e envio para a org Elera.

Arquivos principais:

- `force-app/main/default/objects/ApontamentoDeHoras__c`
- `force-app/main/default/objects/ApontamentoFixo__c`
- `force-app/main/default/objects/Projeto__c`
- `force-app/main/default/objects/IntegracaoElera__c`
- `force-app/main/default/classes/ApontamentoBuilder.cls`
- `force-app/main/default/classes/ApontamentoController.cls`
- `force-app/main/default/classes/ApontamentoSelector.cls`
- `force-app/main/default/classes/ApontamentoFixoController.cls`
- `force-app/main/default/classes/ApontamentoFixoService.cls`
- `force-app/main/default/classes/ApontamentoFixoSelector.cls`
- `force-app/main/default/classes/EnvioApontamentoController.cls`
- `force-app/main/default/classes/EnvioApontamentoService.cls`
- `force-app/main/default/classes/ProjetoController.cls`
- `force-app/main/default/classes/ProjetoSelector.cls`
- `force-app/main/default/lwc/apontamentosTab`
- `force-app/main/default/lwc/rotinasFixas`
- `force-app/main/default/remoteSiteSettings/Elera_Org.remoteSite-meta.xml`

## Modelo De Dados

### `ApontamentoDeHoras__c`

Configuracao:

- Label: `Apontamento de Horas`
- Plural: `Apontamentos de Horas`
- Deployment: `Deployed`
- Sharing model: `ReadWrite`

Campos:

| Campo | Tipo | Uso tecnico |
|---|---|---|
| `Name` | Name | Titulo do apontamento, normalmente nome da tarefa ou rotina. |
| `Inicio__c` | DateTime obrigatorio | Inicio real do slot. |
| `Fim__c` | DateTime obrigatorio | Fim real do slot. |
| `DuracaoHoras__c` | Formula Number | `(Fim__c - Inicio__c) * 24`. |
| `TempoMinutos__c` | Formula Number | `(Fim__c - Inicio__c) * 24 * 60`. |
| `Data_Inicio__c` | Formula Date | `DATEVALUE(Inicio__c)`. |
| `HoraInicio__c` | Formula Text | Hora formatada a partir de `Inicio__c`. |
| `MesAno__c` | Formula Text | Mes/ano a partir de `Inicio__c`. |
| `Observacoes__c` | LongTextArea | Vem da descricao da tarefa ou rotina. |
| `ProjetoLookup__c` | Lookup `Projeto__c` | Caminho correto para resolver IDs Elera via relacionamento. |
| `Projeto__c` | Text | Campo legado/textual. |
| `PerfilDeAlocacao__c` | Text | Usado como fallback de perfil Elera no envio. |
| `DescricaoPerfilDeAlocacao__c` | Formula Text | Formula sobre `PerfilDeAlocacao__c`. |
| `JaEnviado__c` | Checkbox | Evita reenviar apontamentos ja enviados. |

### `ApontamentoFixo__c`

Configuracao:

- Label: `Apontamento Fixo`
- Plural: `Apontamentos Fixos`
- Deployment: `Deployed`
- Sharing model: `Private`

Campos:

| Campo | Tipo | Uso tecnico |
|---|---|---|
| `Name` | Name | Nome da rotina. |
| `DiaDaSemana__c` | Multiselect Picklist obrigatoria | Valores: `Seg`, `Ter`, `Qua`, `Qui`, `Sex`. |
| `HoraInicio__c` | Text obrigatorio | Horario `HH:MM`, normalizado no service. |
| `HoraFim__c` | Text obrigatorio | Horario `HH:MM`, normalizado no service. |
| `Projeto__c` | Text | LWC grava nome do projeto, nao Id. |
| `PerfilDeAlocacao__c` | Text | LWC preenche com `Projeto__c.Perfil_Alocacao__c`, nao com o Id Elera. |

### `Projeto__c`

Configuracao:

- Label: `Projeto`
- Plural: `Projetos`
- Deployment: `Deployed`
- Sharing model: `ReadWrite`

Campos:

| Campo | Tipo | Uso tecnico |
|---|---|---|
| `Name` | Name | Nome exibido em combos. |
| `Perfil_Alocacao__c` | Picklist | Valores: `Desenvolvedor`, `Tech Lead`, `QA`, `Design`, `Outro`. |
| `Id_Elera__c` | Text | Id do projeto na org Elera. |
| `Id_Perfil_Alocacao_Elera__c` | Text | Id do perfil de alocacao na org Elera. |

### `IntegracaoElera__c`

Custom Setting:

- Tipo: Hierarchy
- Label: `Integração Elera`
- Visibilidade: Public

Campos:

- `Endpoint__c`
- `Token1__c`
- `Token2__c`

O service concatena `Token1__c` e `Token2__c` para montar o Bearer token.

## Relacionamentos

| Origem | Destino | Observacao |
|---|---|---|
| `ApontamentoDeHoras__c.ProjetoLookup__c` | `Projeto__c` | Lookup correto para buscar `Id_Elera__c` e `Id_Perfil_Alocacao_Elera__c`. |
| `Tarefa__c.Projeto__c` | `Projeto__c` | Usado pelo trigger de tarefas para preencher `ProjetoLookup__c` e perfil. |
| `ApontamentoFixo__c.Projeto__c` | Texto | Nao e lookup; perde relacionamento tecnico com `Projeto__c`. |

## Camada Apex

### Consulta E Visualizacao

`ApontamentoController.buscarPorSemana(String semanaInicioISO)`:

- Recebe data ISO de inicio da semana.
- Converte para intervalo `[semanaInicio, semanaInicio + 7 dias)`.
- Chama `ApontamentoSelector.buscarPorPeriodo(UserInfo.getUserId(), inicio, fim)`.

`ApontamentoSelector.buscarPorPeriodo`:

- Filtra por `OwnerId`.
- Busca apontamentos que sobrepoem o periodo: `Fim__c >= inicio` e `Inicio__c < fim`.
- Ordena por `Inicio__c ASC`.

### Geracao A Partir De Tarefa

`TarefaTriggerHandler.afterUpdate` chama `ApontamentoBuilder.buildSObjectsFromTarefa`.

Regras do builder:

- Arredonda inicio/fim para meia hora.
- Usa expediente local 09:00-18:00 com `UTC_OFFSET = -3`.
- Divide tarefas multi-dia em segmentos por dia.
- Busca slots livres subtraindo apontamentos existentes.
- Nao altera apontamentos existentes.
- Cria apenas segmentos com duracao minima de 15 minutos.
- Preenche:
  - `Name`
  - `OwnerId`
  - `Inicio__c`
  - `Fim__c`
  - `Observacoes__c`
  - `ProjetoLookup__c`
  - `PerfilDeAlocacao__c` se `Projeto__r.Id_Perfil_Alocacao_Elera__c` existir

### Rotinas Fixas

`ApontamentoFixoService.salvarRotina`:

- Valida nome, dias, hora inicio e hora fim.
- Garante `HoraFim__c > HoraInicio__c`.
- Garante duracao minima de 15 minutos.
- Normaliza horarios para `HH:MM`.
- Insere ou atualiza `ApontamentoFixo__c`.

`ApontamentoFixoService.gerarApontamentosSemana`:

- Semana inicia no domingo.
- Dias uteis usam offsets: `Seg=1`, `Ter=2`, `Qua=3`, `Qui=4`, `Sex=5`.
- Busca rotinas do usuario e apontamentos existentes da semana.
- Resolve sobreposicoes com apontamentos existentes.
- Insere apontamentos das rotinas.

Algoritmo de sobreposicao das rotinas:

- Se a rotina cobre um apontamento existente inteiro, deleta o existente.
- Se um existente cobre a rotina inteira, divide o existente em antes/depois.
- Se a rotina corta o inicio ou fim do existente, ajusta o existente.
- Segmentos menores que 15 minutos sao descartados.
- Usa savepoint e rollback em erro.

Importante: o algoritmo considera os apontamentos existentes carregados no inicio do processo. Ele nao trata claramente sobreposicao entre duas rotinas fixas novas geradas na mesma execucao, porque os novos inserts de rotinas nao sao adicionados como ocupados para as proximas rotinas.

### Envio Para Elera

`EnvioApontamentoService.enviarSemana`:

- Le `IntegracaoElera__c.getOrgDefaults()`.
- Exige `Endpoint__c` e `Token1__c`.
- Endpoint final: `{Endpoint__c}/services/data/v65.0/composite/sobjects`.
- Metodo HTTP: `POST`.
- Header `Authorization: Bearer ...`.
- Body usa `allOrNone = false`.
- Envia records do tipo `ApontamentoDeHoras__c`.
- Marca `JaEnviado__c = true` nos registros enviados com sucesso.

Campos enviados para Elera:

- `Name`
- `Inicio__c`
- `Fim__c`
- `Observacoes__c`
- `PerfilDeAlocacao__c`
- `Projeto__c`, somente se houver `ProjetoLookup__r.Id_Elera__c`

Campos nao enviados porque sao formulas na Elera:

- `DuracaoHoras__c`
- `TempoMinutos__c`
- `HoraInicio__c`
- `Data_Inicio__c`
- `MesAno__c`
- `DescricaoPerfilDeAlocacao__c`

Resolucao de perfil/projeto:

1. Usa `ProjetoLookup__r.Id_Perfil_Alocacao_Elera__c`, se houver.
2. Usa `ProjetoLookup__r.Id_Elera__c` para preencher `Projeto__c`, se houver.
3. Se nao houver perfil pelo lookup, usa fallback `ApontamentoDeHoras__c.PerfilDeAlocacao__c`.
4. Se nao houver perfil, pula o apontamento e incrementa `pulados`.

## Lightning Web Components

### `apontamentosTab`

Funcao:

- Grade semanal 09:00-18:00.
- Navegacao por semana.
- Botao `Gerar Semana`.
- Botao `Rotinas`.
- Botao `Enviar para Elera`.
- Total de horas por dia e por semana.

Dependencias Apex:

- `ApontamentoController.buscarPorSemana`
- `ApontamentoFixoController.gerarApontamentosSemana`
- `EnvioApontamentoController.enviarSemana`

### `rotinasFixas`

Funcao:

- CRUD visual de `ApontamentoFixo__c`.
- Seleciona dias uteis.
- Seleciona horario inicio/fim.
- Seleciona projeto por nome.
- Preenche perfil de alocacao a partir do projeto selecionado.

Dependencias Apex:

- `ApontamentoFixoController.buscarRotinas`
- `ApontamentoFixoController.salvarRotina`
- `ApontamentoFixoController.deletarRotina`
- `ProjetoController.buscarProjetos`

## Exposicao

Tabs/apps:

- `ApontamentoDeHoras__c` possui Custom Tab.
- `Projeto__c` possui Custom Tab.
- App `Gerenciador_Geral` inclui `Projeto__c` e `ApontamentoDeHoras__c`.
- App `GerenciadorFinanceiro` tambem inclui `Projeto__c` e `ApontamentoDeHoras__c`.
- App Sales/Service padrao tambem recebeu esses tabs pelo retrieve.

Permission Set:

- `view_all` concede permissao ampla para `ApontamentoDeHoras__c`, `Projeto__c` e `Tarefa__c`.
- Para `Projeto__c`, `allowCreate=false`, mas `allowEdit=true`, `allowDelete=true`, `modifyAllRecords=true`.

Remote Site:

- `Elera_Org`: `https://elera2.my.salesforce.com`, ativo.

## Cenarios Para Orquestracao Tecnica

Criacao via tarefa concluida:

- Garantir que a tarefa tenha `Projeto__c` preenchido com um `Projeto__c` que possua IDs Elera.
- Ao mudar status para `Concluído`, o trigger cria os apontamentos.
- Verificar os slots criados antes de enviar para Elera.

Criacao via rotina fixa:

- Criar `ApontamentoFixo__c` via `salvarRotina`.
- Acionar `gerarApontamentosSemana`.
- Validar sobreposicoes e campos Elera antes do envio.

Atualizacao:

- Nao ha controller CRUD direto para editar `ApontamentoDeHoras__c` manualmente no modulo atual.
- Rotinas fixas podem ser atualizadas por Id.

Validacao:

- Horarios de rotina devem estar em `HH:MM`.
- Duracao minima: 15 minutos.
- Dias validos: `Seg`, `Ter`, `Qua`, `Qui`, `Sex`.
- Envio exige `Endpoint__c` e token no Custom Setting.

Deduplicacao:

- Tarefas concluidas evitam sobreposicao com apontamentos existentes e com apontamentos calculados no mesmo batch.
- Rotinas fixas ajustam/deletam/splitam existentes, mas podem sobrepor entre si se houver duas rotinas novas no mesmo horario.
- `JaEnviado__c` impede reenvio pela query de envio, mas nao impede duplicidade local.

Integracao:

- O envio para Elera e feito via REST Composite.
- Nao ha Named Credential; usa Remote Site + token em Custom Setting.
- Nao armazena Id retornado pela Elera.
- Em erro parcial, apenas os sucessos sao marcados como enviados.

## Riscos E Pontos De Atencao

- Tokens de integracao estao modelados em Custom Setting publico (`IntegracaoElera__c`). Recomenda-se migrar para Named Credential/External Credential ou Protected Custom Metadata.
- `ApontamentoFixo__c.Projeto__c` e texto, nao lookup. Isso quebra a resolucao automatica de `ProjetoLookup__r.Id_Elera__c` no envio.
- `rotinasFixas` usa `Projeto__c.Perfil_Alocacao__c` para preencher `PerfilDeAlocacao__c`; esse campo e label/perfil local, nao necessariamente `Id_Perfil_Alocacao_Elera__c`.
- Fuso UTC-3 esta hardcoded em `ApontamentoBuilder` e `ApontamentoFixoService`.
- A org destino Elera recebe `Projeto__c` como Id externo/texto vindo de `Id_Elera__c`; qualquer mudanca de API name na org destino quebra o envio.
- Nao ha retry/backoff para callout Elera.
- `EnvioApontamentoService` aceita HTTP 200/201, mas composite sobjects normalmente pode retornar 200 com erros por registro; isso ja e tratado parcialmente pelo corpo.

