@IsTest
private class WorkCommunicationControllerTest {
    @TestSetup
    static void setup() {
        Case origin = new Case(Subject = 'Comunicação teste', Status = 'New', Origin = 'Web', PrioridadeSLA__c = 'P2');
        insert origin;
        Projeto__c project = new Projeto__c(Name = 'Projeto comunicação');
        insert project;
        Work__c root = new Work__c(Titulo__c = 'Principal', Case__c = origin.Id, Project__c = project.Id);
        insert root;
        origin.Work__c = root.Id; update origin;
        Work__c child = new Work__c(Titulo__c = 'Filha', ParentWork__c = root.Id);
        insert child;
        insert new Work__c(Titulo__c = 'Neta', ParentWork__c = child.Id);
        insert new Work__c(Titulo__c = 'Outra demanda');
        insert new Task(Subject = 'Validar entrega', WhatId = child.Id, Status = 'Not Started', Priority = 'Normal');
        CriterioAceite__c criterion = new CriterioAceite__c(Titulo__c = 'Aceite', Work__c = child.Id);
        insert criterion;
        insert new CenarioTeste__c(Titulo__c = 'Cenário', Work__c = child.Id, CriterioAceite__c = criterion.Id);
    }
    private static Work__c work(String title) { return [SELECT Id, Case__c FROM Work__c WHERE Titulo__c = :title LIMIT 1]; }
    @IsTest
    static void resolvesHierarchyAndCountsFromCaseAndGrandchild() {
        Work__c root = work('Principal');
        CriterioAceite__c criterion = [SELECT Id FROM CriterioAceite__c LIMIT 1];
        CenarioTeste__c scenario = [SELECT Id FROM CenarioTeste__c LIMIT 1];
        Test.startTest();
        Map<String, Object> byCase = WorkCommunicationController.getContext(root.Case__c);
        Map<String, Object> byChild = WorkCommunicationController.getContext(work('Neta').Id);
        Map<String, Object> byCriterion = WorkCommunicationController.getContext(criterion.Id);
        Map<String, Object> byScenario = WorkCommunicationController.getContext(scenario.Id);
        Test.stopTest();
        Assert.areEqual(root.Id, byChild.get('rootId'));
        Assert.areEqual(root.Case__c, byChild.get('caseId'));
        Assert.areEqual(root.Id, byCriterion.get('rootId'));
        Assert.areEqual(root.Id, byScenario.get('rootId'));
        Assert.areEqual(2, byCase.get('subworks'));
        Assert.areEqual(1, byCase.get('tasks'));
        Assert.areEqual(1, byCase.get('criteria'));
        Assert.areEqual(1, byCase.get('scenarios'));
        Assert.areEqual(false, byCase.get('limited'));
    }
    @IsTest
    static void postsCommentsAndTaskContextRemainInNativeChatter() {
        Work__c root = work('Principal');
        Work__c child = work('Filha');
        Task task = [SELECT Id FROM Task LIMIT 1];
        Test.startTest();
        Id postId = WorkCommunicationController.publish(root.Id, child.Id, 'Decisão', 'Validar em QA', new List<Id>());
        Id replyId = WorkCommunicationController.comment(root.Id, postId, 'Cenário aprovado', new List<Id>());
        Id taskPost = WorkCommunicationController.publish(root.Id, task.Id, 'Atualização', 'Tarefa executada', new List<Id>());
        List<Map<String, Object>> replies = WorkCommunicationController.getComments(root.Id, postId);
        Map<String, Object> feed = WorkCommunicationController.getMessages(root.Case__c, child.Id, null, null);
        Test.stopTest();
        Assert.areEqual(replyId, replies[0].get('id'));
        Assert.areEqual(2, ((List<Map<String, Object>>)feed.get('items')).size());
        FeedItem stored = [SELECT Body, ParentId FROM FeedItem WHERE Id = :taskPost];
        Assert.areEqual(child.Id, stored.ParentId);
        Assert.isTrue(stored.Body.contains('Validar entrega'));
    }
    @IsTest
    static void paginationDoesNotRepeatMessages() {
        Work__c root = work('Principal');
        List<FeedItem> posts = new List<FeedItem>();
        for (Integer i = 0; i < 27; i++) posts.add(new FeedItem(ParentId = root.Id, Body = 'Publicação ' + i));
        insert posts;
        Test.startTest();
        Map<String, Object> first = WorkCommunicationController.getMessages(root.Id, root.Id, null, null);
        List<Map<String, Object>> items = (List<Map<String, Object>>)first.get('items');
        Map<String, Object> last = items[items.size()-1];
        Map<String, Object> second = WorkCommunicationController.getMessages(root.Id, root.Id, (Datetime)last.get('createdAt'), (Id)last.get('id'));
        Test.stopTest();
        Assert.areEqual(true, first.get('hasMore'));
        Assert.areEqual(25, items.size());
        Assert.areEqual(2, ((List<Map<String, Object>>)second.get('items')).size());
        Assert.areEqual(false, second.get('hasMore'));
    }
    @IsTest
    static void rejectsTargetsAndCommentsOutsideDemand() {
        Id root = work('Principal').Id;
        Id other = work('Outra demanda').Id;
        FeedItem foreignPost = new FeedItem(ParentId = other, Body = 'Outra demanda'); insert foreignPost;
        Test.startTest();
        try { WorkCommunicationController.publish(root, other, 'Decisão', 'Não deve publicar', new List<Id>()); Assert.fail('Esperado bloqueio'); }
        catch (AuraHandledException expected) { Assert.isTrue(expected.getMessage().contains('fora')); }
        try { WorkCommunicationController.comment(root, foreignPost.Id, 'Não deve comentar', new List<Id>()); Assert.fail('Esperado bloqueio'); }
        catch (AuraHandledException expected) { Assert.isTrue(expected.getMessage().contains('fora')); }
        try { WorkCommunicationController.getMessages(root, other, null, null); Assert.fail('Esperado bloqueio'); }
        catch (AuraHandledException expected) { Assert.isTrue(expected.getMessage().contains('fora')); }
        try { WorkCommunicationController.publish(root, root, 'Inválido', 'Texto', new List<Id>()); Assert.fail('Esperado bloqueio'); }
        catch (AuraHandledException expected) { Assert.isTrue(expected.getMessage().contains('tipo')); }
        try { WorkCommunicationController.comment(root, foreignPost.Id, '', new List<Id>()); Assert.fail('Esperado bloqueio'); }
        catch (AuraHandledException expected) { Assert.isTrue(expected.getMessage().contains('comentário')); }
        try { WorkCommunicationController.getContext(null); Assert.fail('Esperado bloqueio'); }
        catch (AuraHandledException expected) { Assert.isTrue(expected.getMessage().contains('Abra')); }
        Test.stopTest();
    }
    @IsTest
    static void privateWorkIsNotExposedToAnotherUser() {
        Profile profile = [SELECT Id FROM Profile WHERE UserType = 'Standard' AND UserLicense.Name = 'Salesforce' AND PermissionsModifyAllData = false AND PermissionsViewAllData = false LIMIT 1];
        User limited = new User(Alias = 'w6test', Email = 'w6@example.invalid', EmailEncodingKey = 'UTF-8', LastName = 'W6 teste',
            LanguageLocaleKey = 'pt_BR', LocaleSidKey = 'pt_BR', TimeZoneSidKey = 'America/Sao_Paulo', ProfileId = profile.Id,
            Username = 'w6.' + UserInfo.getOrganizationId() + '.' + System.now().getTime() + '@example.invalid');
        insert limited;
        insert new PermissionSetAssignment(AssigneeId = limited.Id, PermissionSetId = [SELECT Id FROM PermissionSet WHERE Name = 'Gestao_Works'].Id);
        Id root = work('Principal').Id;
        System.runAs(limited) {
            Test.startTest();
            try { WorkCommunicationController.getContext(root); Assert.fail('Work privada não pode aparecer'); }
            catch (AuraHandledException expected) { Assert.isTrue(expected.getMessage().contains('acesso')); }
            Test.stopTest();
        }
    }
    @IsTest
    static void independentWorkHasNoCaseAndNoChildren() {
        Test.startTest();
        Map<String, Object> data = WorkCommunicationController.getContext(work('Outra demanda').Id);
        Test.stopTest();
        Assert.isNull(data.get('caseId'));
        Assert.areEqual(0, data.get('subworks'));
        Assert.areEqual(0, data.get('tasks'));
    }
    @IsTest
    static void attachedFilesAreReturnedWithMessages() {
        Work__c root = work('Principal');
        ContentVersion version = new ContentVersion(
            Title = 'Evidencia QA',
            PathOnClient = 'evidencia.png',
            VersionData = Blob.valueOf('imagem fake')
        );
        insert version;
        Id documentId = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :version.Id].ContentDocumentId;
        Test.startTest();
        Id postId = WorkCommunicationController.publish(root.Id, root.Id, 'Atualização', 'Com evidencia', new List<Id>{documentId});
        Map<String, Object> feed = WorkCommunicationController.getMessages(root.Id, root.Id, null, null);
        Test.stopTest();
        List<Map<String, Object>> items = (List<Map<String, Object>>)feed.get('items');
        Map<String, Object> item;
        for (Map<String, Object> candidate : items) {
            if ((Id)candidate.get('id') == postId) item = candidate;
        }
        Assert.isNotNull(item);
        List<Map<String, Object>> attachments = (List<Map<String, Object>>)item.get('attachments');
        Assert.areEqual(1, attachments.size());
        Assert.areEqual(documentId, attachments[0].get('documentId'));
        Assert.areEqual(true, attachments[0].get('isImage'));
    }
    @IsTest
    static void commentsCanReceiveAttachedFiles() {
        Work__c root = work('Principal');
        ContentVersion version = new ContentVersion(
            Title = 'Comentario QA',
            PathOnClient = 'comentario.pdf',
            VersionData = Blob.valueOf('pdf fake')
        );
        insert version;
        Id documentId = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :version.Id].ContentDocumentId;
        Test.startTest();
        Id postId = WorkCommunicationController.publish(root.Id, root.Id, 'Atualização', 'Comentar com arquivo', new List<Id>());
        Id replyId = WorkCommunicationController.comment(root.Id, postId, 'Segue evidencia', new List<Id>{documentId});
        Test.stopTest();
        FeedComment reply = [SELECT CommentBody, RelatedRecordId FROM FeedComment WHERE Id = :replyId];
        List<Map<String, Object>> replies = WorkCommunicationController.getComments(root.Id, postId);
        List<Map<String, Object>> attachments = (List<Map<String, Object>>)replies[0].get('attachments');
        Assert.isTrue(reply.CommentBody.contains('Arquivos anexados'));
        Assert.isTrue(reply.CommentBody.contains((String)documentId));
        Assert.isNotNull(reply.RelatedRecordId);
        Assert.areEqual(1, attachments.size());
        Assert.areEqual(documentId, attachments[0].get('documentId'));
    }
    @IsTest
    static void criteriaAndScenariosCanPublishInTheirOwnFeeds() {
        Work__c root = work('Principal');
        CriterioAceite__c criterion = [SELECT Id FROM CriterioAceite__c LIMIT 1];
        CenarioTeste__c scenario = [SELECT Id FROM CenarioTeste__c LIMIT 1];
        Test.startTest();
        Id criterionPostId = WorkCommunicationController.publish(criterion.Id, criterion.Id, 'Dúvida', 'Validar aceite', new List<Id>());
        Id scenarioPostId = WorkCommunicationController.publish(scenario.Id, scenario.Id, 'Atualização', 'Executado', new List<Id>());
        Map<String, Object> criterionFeed = WorkCommunicationController.getMessages(root.Id, criterion.Id, null, null);
        Map<String, Object> scenarioFeed = WorkCommunicationController.getMessages(root.Id, scenario.Id, null, null);
        Test.stopTest();
        Assert.areEqual(criterion.Id, [SELECT ParentId FROM FeedItem WHERE Id = :criterionPostId].ParentId);
        Assert.areEqual(scenario.Id, [SELECT ParentId FROM FeedItem WHERE Id = :scenarioPostId].ParentId);
        Assert.areEqual(1, ((List<Map<String, Object>>)criterionFeed.get('items')).size());
        Assert.areEqual(1, ((List<Map<String, Object>>)scenarioFeed.get('items')).size());
    }
}
