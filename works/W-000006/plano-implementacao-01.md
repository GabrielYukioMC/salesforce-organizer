# Plano de implementacao 01

## Informacoes da execucao

- IA/agente usado: Codex
- Nivel/configuracao: Default
- Data de inicio: 2026-09-05

## Objetivo

Implementar a estrutura operacional de Case, Work, Projeto, tarefas, critérios de aceite, cenários de teste e Chatter descrita no anexo.

## Motivo deste plano

Nova demanda autorizada pelo usuário. Projeto__c, Tarefa__c e Task já existem; Work__c, CriterioAceite__c e CenarioTeste__c não existem no repositório nem na consulta EntityDefinition da dev-org.

## Decisoes

- Reutilizar Projeto__c e Task.WhatId, habilitando atividades em Work__c. Tarefa__c possui outro uso existente e permanece intacta. As tarefas criadas na Work recebem o vínculo nativo; não tornar todas as Tasks da organização dependentes de Work.
- Case.Work__c identifica a principal; ação no Case cria e associa uma Work sob demanda, sem criar registros retroativamente.
- Work.Case__c registra origem, Project__c contextualiza projeto e ParentWork__c permite hierarquia.
- Critérios e cenários pertencem à Work por master-detail, herdando compartilhamento. Cenário pode apontar para um critério da mesma Work. Files registra evidências.
- Work privada, permission set sem View All/Modify All. Chatter nativo preserva autoria, comentários, menções e arquivos.
- Comunicação consolidada será avaliada e registrada neste plano; o pedido não exige substituir os feeds nativos.
- Não executar deploy, dry run ou testes. Classes de teste ficam para a etapa de deploy, por instrução explícita do usuário.

## Etapas

- [x] Inventariar objetos, padrões e alterações preexistentes.
- [x] Criar objetos, campos, relacionamentos e validações.
- [x] Preparar página Work, layouts, ação de criação pelo Case e permissões.
- [x] Avaliar comunicação consolidada e documentar validação futura.
- [x] Atualizar manifest e relação de arquivos; revisar estaticamente sem testes ou deploy.


## Implementacao e limites

- A ação Criar Work principal consulta novamente o Case após a confirmação, reutilizando a associação existente quando houver. As duas gravações ficam na mesma transação, sem telas intermediárias nem tratamento que permita confirmar somente a criação em caso de falha na associação.
- Para associar uma Work existente pelo lookup, definir antes seu Case de origem. Work independente continua permitida, inclusive com projeto sem Case. A associação não é obrigatória para salvar Cases legados ou recém-abertos.
- WorkRelationshipHandler/WorkTrigger protegem o lado inverso da associação: uma principal vinculada não pode virar filha nem mudar sua origem. A leitura sem sharing é restrita à integridade referencial, não retorna registros ao usuário e não realiza DML. Uma consulta para todos os registros alterados do lote, somente quando o relacionamento muda.
- A validação declarativa bloqueia Work como pai de si própria. Não foi implementada detecção de ciclos indiretos entre múltiplas Works.
- Case e projeto das filhas são preenchidos explicitamente; não há sincronização automática com o pai.
- Os layouts Case receberam o campo e a ação, com ações básicas e publicações Chatter explícitas. Na revisão de deploy, comparar também as ações efetivas e eventuais Dynamic Actions da org para preservar personalizações não presentes no repositório.
- Chatter precisa estar habilitado na organização. O compartilhamento privado exige compartilhar cada Work com os participantes; o campo Responsável por si só não concede acesso. Critérios e cenários herdam o acesso da respectiva Work.
- Task usa WhatId e os campos nativos de responsável, assunto, status, prioridade, vencimento e conclusão. A ação Nova tarefa na Work preenche o vínculo; tarefas de outros módulos continuam permitidas. Permissões de atividades permanecem as do perfil/permissões existentes.
- Não foram criadas ou executadas classes de teste, conforme solicitado. O Apex novo ainda requer classe de teste e compilação na etapa de deploy.

## Avaliacao da comunicacao consolidada

Viável como componente separado no Case/Work principal, consultando as Works descendentes e seus FeedItems em contexto do usuário, com paginação e identificação da origem. Comentários, menções, anexos e publicação devem continuar no feed original, sem copiar mensagens. Exige tratamento de hierarquias extensas e autorização por Work/arquivo. Nesta entrega foi mantido o Chatter nativo em cada Work; a visão agregada não foi implementada, pois o escopo pede sua avaliação.

Referências consultadas: [atividades em objetos customizados](https://help.salesforce.com/s/articleView?id=sf.tracking_activities_for_custom_objects.htm&language=en_US&type=5) e [feed Chatter nativo](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/forceChatter-feed.html).

## Revisao local realizada

- XMLs da demanda lidos pelo parser sem erros de sintaxe.
- Conversão local Salesforce DX para Metadata API concluída com status 0. Isso valida a conversão dos arquivos, não a compilação Apex ou a aceitação dos componentes pela org.
- git diff --check sem erros.
- Nenhum deploy, dry run, teste Apex, alteração de dados da org ou commit. Alterações de SLA preexistentes preservadas.

## Validacao futura, na etapa de deploy

1. Comparar somente os componentes listados em arquivos-alterados-01.md com a org de destino. O manifest principal também contém outras demandas e não deve ser usado como origem de deploy completo.
2. Criar WorkRelationshipHandlerTest antes do deploy de produção: permitir atualização comum e de Work independente; bloquear principal virando filha ou mudando/removendo origem; permitir desvincular o Case antes de alterar; cobrir lote de 200 Works, ausência de Case principal e integridade mesmo sem acesso ao Case associado. Sem SeeAllData; meta de cobertura de pelo menos 80%.
3. Atribuir Gestao_Works ao usuário de execução; verificar acesso a Case, Projeto e atividades. Validar também um usuário sem acesso à Work e outro com acesso somente de leitura.
4. No Case, usar Criar Work principal; conferir ambos os vínculos. Repetir a ação e confirmar que não cria outra Work quando já existe associação. Conferir rollback em falha de atualização do Case e revisar concorrência de duas sessões antes da liberação.
5. Associar projeto, criar filha, tarefa aberta e tarefa concluída; conferir listas e timeline. Criar Work independente com projeto e sem Case.
6. Criar critério e cenário; tentar cenário apontando para critério de outra Work e confirmar bloqueio. Anexar evidência por Files, preencher resultado e data de execução.
7. Publicar, comentar, mencionar usuário e anexar arquivo no Chatter da principal e da filha; confirmar isolamento dos feeds e respeito ao compartilhamento.
8. Conferir o botão nos quatro layouts Case e a página padrão Work desktop. Se a org usar Dynamic Actions, incluir a ação também nessa configuração durante a revisão final. Não houve ativação ou atribuição na org nesta etapa.
