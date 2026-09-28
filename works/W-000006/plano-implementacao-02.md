# Plano de implementacao 02

## Informacoes da execucao

- IA/agente usado: Codex
- Nivel/configuracao: Default
- Data de inicio: 2026-09-05

## Objetivo

Corrigir os erros de deploy informados, executar deploy granular e implementar comunicador LWC em Case e Work com comunicação contextual, SLA, etapa e contadores.

## Motivo deste plano

Retorno de erros reais da org e ampliação expressamente autorizada para comunicação consolidada. O pedido atual autoriza deploy; testes serão restritos ao novo código necessário.

## Etapas

- [x] Corrigir causas de metadados e comparar os componentes existentes com a org.
- [x] Executar deploy granular da estrutura corrigida.
- [x] Implementar comunicação compartilhada, informações úteis e etapas da Work.
- [x] Adicionar o LWC às páginas de Case e Work e preparar segurança/testes.
- [x] Validar e publicar os componentes da comunicação; registrar resultados e arquivos.

## Premissas

- Chatter continua sendo a origem das publicações. Tipos de mensagem: atualização, dúvida, impedimento e decisão.
- O contexto abrange Case, Works da demanda, critérios e cenários; tarefas são contexto operacional e podem ser referenciadas, com mensagens publicadas na Work.
- Só registros acessíveis entram na visualização. Projeto agrupa demandas, mas suas mensagens não serão automaticamente expostas a outros Cases sem acesso.

## Deploy da estrutura

- dev-org (Developer Edition), deploy granular por --source-dir, NoTestRun: 0AfgL00000WlmrZSAR, Succeeded.
- Comparação prévia com a org: layouts Case não tinham campos exclusivos ausentes localmente; única adição de campo é Work__c.
- Corrigidos SetNull nos lookups User/self, motif Custom19: Wrench, componente não disponível e lista legada Solutions.


## Resultado da comunicação

- LWC workCommunicator inserido em Work_Record_Page e na Case_Record_Page recuperada da org. A página Case já estava ativa para desktop e mobile; os componentes existentes foram preservados.
- Work.Etapa__c: Aguardando desenvolvimento, Em desenvolvimento, Aguardando deploy, Em QA, Aguardando cliente, Bloqueado e Concluído. Edição via Lightning Data Service, com CRUD/FLS.
- Chatter consolidado: atualização, dúvida, impedimento e decisão; filtro por origem; publicação no registro escolhido; comentários no FeedItem original e paginação de 25 publicações com cursor por data/Id.
- Destinos: Case de origem, Works da hierarquia, projetos, critérios e cenários acessíveis. Tarefas publicam na Work vinculada com identificação da tarefa. Upload nativo vincula Files ao destino e inclui links no rascunho; usuário confirma a publicação.
- Menções e visualização completa de arquivos/publicações permanecem disponíveis no Chatter nativo, acessível pelos links do comunicador.
- Contadores abrangem a hierarquia acessível. Limites de exibição: 500 Works, 12 níveis em cada direção, 200 tarefas e 500 critérios/cenários como destinos; aviso de visão parcial quando excedidos. Contagem de tarefas/critérios/cenários usa COUNT e permanece total para as Works carregadas.
- Busca de hierarquia faz leituras limitadas por nível, sem consulta por filho; nenhuma consulta sem limite à coleção inteira da organização. Leituras e gravações da comunicação usam USER_MODE, além de with sharing e validação de pertencimento ao contexto.
- SLA usa campos existentes, com campos opcionais via UI API; exibe saldo útil registrado, status, fase e prazos. Não recalcula nem altera a regra de SLA. O monitor existente do Case foi mantido.
- Projeto__c teve somente enableFeeds habilitado entre suas configurações de objeto, comparadas previamente com a org. O empacotamento incluiu seus três campos e a list view All; comparação canônica confirmou que eram idênticos à versão recuperada da org.
- Gestao_Works recebeu acesso ao controller, etapa e leitura dos campos de SLA utilizados, sem View All/Modify All.

## Correção do Flow reportada durante a execução

O deploy havia criado Case.Work__c, mas o usuário conectado não tinha Gestao_Works atribuído. Atribuído o permission set ao usuário da dev-org que reportou o problema. A consulta SELECT Id, Work__c do Case 500gL00001VteqUQAR, antes rejeitada, passou a retornar o registro. O Flow continua no contexto do usuário, sem bypass de segurança.

## Validacao realizada

- Primeiro deploy da comunicação: compilação aprovada; 1 falha na massa do teste de acesso, pois o perfil encontrado era de licença Analytics. Corrigido o seletor para licença Salesforce.
- Deploy final 0AfgL00000WlouzSAB: Succeeded, RunSpecifiedTests com WorkCommunicationControllerTest e WorkRelationshipHandlerTest, 7 testes e zero falhas. Cobertura WorkCommunicationController: 99,25%.
- Testes cobrem hierarquia neta/principal/Case, contadores, publicações e comentários Chatter, contexto da tarefa, paginação sem repetição, bloqueio de destinos externos à demanda, entradas inválidas, Work independente, usuário sem acesso e proteção de principal em lote de 200 Works.
- Verificação adicional somente de leitura pelo controller no Case informado: contexto e 3 publicações retornados, sem erro e sem mutações.
- git diff --check sem erros. Nenhum commit. Não foi realizada inspeção visual em navegador nesta sessão.

## Como usar

1. Atualizar a página e reabrir o Flow caso uma entrevista antiga ainda esteja aberta.
2. Em Case ou Work, localizar Comunicação da demanda. Escolher o registro de destino, o tipo e publicar.
3. Filtrar por origem, responder na publicação original ou abrir no Chatter para menções e a conversa completa.
4. Escolher a Work em acompanhamento e salvar sua etapa. Os indicadores mostram a hierarquia acessível e o SLA do Case de origem acessível.
5. Para outros integrantes, atribuir Gestao_Works e compartilhar as Works apropriadas. A atribuição por si só não concede acesso a todos os registros.

## Rollback

Restaurar as versões anteriores dos componentes específicos das páginas/controller se necessário. Não remover objetos ou campos que já contenham dados. As alterações preexistentes de SLA e de outras Works não foram incluídas como origem do deploy.
