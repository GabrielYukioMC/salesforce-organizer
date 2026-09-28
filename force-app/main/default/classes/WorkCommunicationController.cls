/** Chatter remains the source of truth. Every read and write uses user access. */
public with sharing class WorkCommunicationController {
    private static final Integer MAX_WORKS = 500;
    private static final Integer MAX_DEPTH = 12;
    private static final Set<String> KINDS = new Set<String>{'Atualização', 'Dúvida', 'Impedimento', 'Decisão'};
    private class Scope {
        Map<Id, Work__c> works = new Map<Id, Work__c>();
        Map<Id, String> labels = new Map<Id, String>();
        Map<Id, Id> destinations = new Map<Id, Id>();
        Id caseId;
        Id rootId;
        Boolean limited = false;
        Integer taskCount = 0;
        Integer criterionCount = 0;
        Integer scenarioCount = 0;
        List<Map<String, Object>> targets = new List<Map<String, Object>>();
        void add(Id id, String label, Id destination) {
            if (destinations.containsKey(id)) return;
            labels.put(id, label);
            destinations.put(id, destination);
            targets.add(new Map<String, Object>{'value' => id, 'label' => label, 'destination' => destination});
        }
    }
    private static AuraHandledException denied(String message) {
        AuraHandledException error = new AuraHandledException(message);
        error.setMessage(message);
        return error;
    }
    private static List<Work__c> readWorks(Set<Id> ids, Boolean children, Integer maximum) {
        if (children) {
            return [SELECT Id, Name, Titulo__c, ParentWork__c, Case__c, Project__c, Status__c, Etapa__c
                    FROM Work__c WHERE ParentWork__c IN :ids WITH USER_MODE ORDER BY Id LIMIT :maximum];
        }
        return [SELECT Id, Name, Titulo__c, ParentWork__c, Case__c, Project__c, Status__c, Etapa__c
                FROM Work__c WHERE Id IN :ids WITH USER_MODE ORDER BY Id LIMIT :maximum];
    }
    private static Scope context(Id recordId) {
        if (recordId == null || (recordId.getSObjectType() != Case.SObjectType && recordId.getSObjectType() != Work__c.SObjectType
            && recordId.getSObjectType() != CriterioAceite__c.SObjectType && recordId.getSObjectType() != CenarioTeste__c.SObjectType)) {
            throw denied('Abra o comunicador em um Case, Work, Critério de Aceite ou Cenário de Teste.');
        }
        Scope s = new Scope();
        Id startId = recordId;
        if (recordId.getSObjectType() == Case.SObjectType) {
            List<Case> cases = [SELECT Id, CaseNumber, Work__c FROM Case WHERE Id = :recordId WITH USER_MODE];
            if (cases.isEmpty()) throw denied('Você não tem acesso a este Case.');
            s.caseId = recordId;
            s.add(recordId, 'Case ' + cases[0].CaseNumber, recordId);
            startId = cases[0].Work__c;
        }
        if (recordId.getSObjectType() == CriterioAceite__c.SObjectType) {
            List<CriterioAceite__c> criteria = [SELECT Id, Titulo__c, Work__c FROM CriterioAceite__c WHERE Id = :recordId WITH USER_MODE];
            if (criteria.isEmpty()) throw denied('Você não tem acesso a este Critério de Aceite.');
            s.add(recordId, 'Critério · ' + criteria[0].Titulo__c, recordId);
            startId = criteria[0].Work__c;
        }
        if (recordId.getSObjectType() == CenarioTeste__c.SObjectType) {
            List<CenarioTeste__c> scenarios = [SELECT Id, Titulo__c, Work__c FROM CenarioTeste__c WHERE Id = :recordId WITH USER_MODE];
            if (scenarios.isEmpty()) throw denied('Você não tem acesso a este Cenário de Teste.');
            s.add(recordId, 'Cenário · ' + scenarios[0].Titulo__c, recordId);
            startId = scenarios[0].Work__c;
        }
        if (startId != null) {
            List<Work__c> initial = readWorks(new Set<Id>{startId}, false, 1);
            if (initial.isEmpty()) {
                if (s.caseId == null) throw denied('Você não tem acesso a esta Work.');
                s.limited = true;
            } else {
                Work__c root = initial[0];
                Set<Id> visited = new Set<Id>{root.Id};
                // Bounded breadth/ancestor reads: at most 24 hierarchy queries, never one per child.
                for (Integer depth = 0; root.ParentWork__c != null && depth < MAX_DEPTH; depth++) {
                    if (visited.contains(root.ParentWork__c)) { s.limited = true; break; }
                    List<Work__c> parents = readWorks(new Set<Id>{root.ParentWork__c}, false, 1);
                    if (parents.isEmpty()) { s.limited = true; break; }
                    root = parents[0]; visited.add(root.Id);
                }
                if (root.ParentWork__c != null) s.limited = true;
                s.rootId = root.Id;
                s.works.put(root.Id, root);
                Set<Id> frontier = new Set<Id>{root.Id};
                for (Integer depth = 0; !frontier.isEmpty() && depth < MAX_DEPTH; depth++) {
                    List<Work__c> children = readWorks(frontier, true, MAX_WORKS - s.works.size() + 1);
                    frontier = new Set<Id>();
                    for (Work__c child : children) {
                        if (s.works.containsKey(child.Id)) continue;
                        if (s.works.size() == MAX_WORKS) { s.limited = true; break; }
                        s.works.put(child.Id, child); frontier.add(child.Id);
                    }
                    if (s.limited && s.works.size() == MAX_WORKS) break;
                }
                if (!frontier.isEmpty()) s.limited = true;
                if (s.caseId == null && root.Case__c != null) {
                    List<Case> origins = [SELECT Id, CaseNumber FROM Case WHERE Id = :root.Case__c WITH USER_MODE];
                    if (!origins.isEmpty()) { s.caseId = origins[0].Id; s.add(s.caseId, 'Case ' + origins[0].CaseNumber, s.caseId); }
                }
            }
        }
        Set<Id> projectIds = new Set<Id>();
        for (Work__c work : s.works.values()) {
            s.add(work.Id, work.Name + ' · ' + work.Titulo__c, work.Id);
            if (work.Project__c != null) projectIds.add(work.Project__c);
        }
        Set<Id> workIds = s.works.keySet();
        if (!workIds.isEmpty()) {
            s.taskCount = [SELECT COUNT() FROM Task WHERE WhatId IN :workIds WITH USER_MODE];
            s.criterionCount = [SELECT COUNT() FROM CriterioAceite__c WHERE Work__c IN :workIds WITH USER_MODE];
            s.scenarioCount = [SELECT COUNT() FROM CenarioTeste__c WHERE Work__c IN :workIds WITH USER_MODE];
            for (Task task : [SELECT Id, Subject, WhatId FROM Task WHERE WhatId IN :workIds WITH USER_MODE ORDER BY Id LIMIT 200]) {
                s.add(task.Id, 'Tarefa · ' + task.Subject, task.WhatId);
            }
            for (CriterioAceite__c criterion : [SELECT Id, Titulo__c FROM CriterioAceite__c WHERE Work__c IN :workIds WITH USER_MODE ORDER BY Id LIMIT 500]) {
                s.add(criterion.Id, 'Critério · ' + criterion.Titulo__c, criterion.Id);
            }
            for (CenarioTeste__c scenario : [SELECT Id, Titulo__c FROM CenarioTeste__c WHERE Work__c IN :workIds WITH USER_MODE ORDER BY Id LIMIT 500]) {
                s.add(scenario.Id, 'Cenário · ' + scenario.Titulo__c, scenario.Id);
            }
            s.limited = s.limited || s.taskCount > 200 || s.criterionCount > 500 || s.scenarioCount > 500;
        }
        if (!projectIds.isEmpty()) {
            for (Projeto__c project : [SELECT Id, Name FROM Projeto__c WHERE Id IN :projectIds WITH USER_MODE]) s.add(project.Id, 'Projeto · ' + project.Name, project.Id);
        }
        return s;
    }
    @AuraEnabled
    public static Map<String, Object> getContext(Id recordId) {
        Scope s = context(recordId);
        return new Map<String, Object>{'caseId' => s.caseId, 'rootId' => s.rootId, 'targets' => s.targets,
            'works' => s.works.values(), 'subworks' => Math.max(0, s.works.size() - 1),
            'tasks' => s.taskCount, 'criteria' => s.criterionCount, 'scenarios' => s.scenarioCount, 'limited' => s.limited};
    }
    @AuraEnabled
    public static Map<String, Object> getMessages(Id recordId, Id targetId, Datetime beforeDate, Id beforeId) {
        Scope s = context(recordId);
        Set<Id> parents = new Set<Id>(s.destinations.values());
        if (targetId != null) {
            if (!s.destinations.containsKey(targetId)) throw denied('Registro fora desta demanda ou sem acesso.');
            parents = new Set<Id>{s.destinations.get(targetId)};
        }
        List<FeedItem> posts;
        if (beforeDate == null || beforeId == null) {
            posts = [SELECT Id, ParentId, Body, IsRichText, Type, CreatedDate, CreatedBy.Name, CommentCount
                     FROM FeedItem WHERE ParentId IN :parents AND Type != 'TrackedChange' WITH USER_MODE
                     ORDER BY CreatedDate DESC, Id DESC LIMIT 26];
        } else {
            posts = [SELECT Id, ParentId, Body, IsRichText, Type, CreatedDate, CreatedBy.Name, CommentCount
                     FROM FeedItem WHERE ParentId IN :parents AND Type != 'TrackedChange'
                     AND (CreatedDate < :beforeDate OR (CreatedDate = :beforeDate AND Id < :beforeId)) WITH USER_MODE
                     ORDER BY CreatedDate DESC, Id DESC LIMIT 26];
        }
        Boolean hasMore = posts.size() > 25;
        if (hasMore) posts.remove(25);
        Set<Id> postIds = new Set<Id>();
        for (FeedItem post : posts) postIds.add(post.Id);
        Map<Id, List<Map<String, Object>>> attachmentsByPost = attachmentsByPost(postIds);
        List<Map<String, Object>> items = new List<Map<String, Object>>();
        for (FeedItem post : posts) items.add(new Map<String, Object>{'id' => post.Id, 'parentId' => post.ParentId,
            'origin' => s.labels.get(post.ParentId), 'body' => post.Body, 'rich' => post.IsRichText,
            'author' => post.CreatedBy.Name, 'createdAt' => post.CreatedDate, 'comments' => post.CommentCount,
            'attachments' => attachmentsByPost.containsKey(post.Id) ? attachmentsByPost.get(post.Id) : new List<Map<String, Object>>()});
        return new Map<String, Object>{'items' => items, 'hasMore' => hasMore};
    }
    private static Map<Id, List<Map<String, Object>>> attachmentsByPost(Set<Id> postIds) {
        Map<Id, List<Map<String, Object>>> result = new Map<Id, List<Map<String, Object>>>();
        if (postIds.isEmpty()) return result;
        Set<String> imageTypes = new Set<String>{'BMP', 'GIF', 'JPG', 'JPEG', 'PNG', 'SVG', 'TIF', 'TIFF', 'WEBP'};
        Set<Id> versionIds = new Set<Id>();
        Map<Id, List<Id>> versionsByPost = new Map<Id, List<Id>>();
        for (FeedAttachment attachment : [
            SELECT FeedEntityId, RecordId
            FROM FeedAttachment
            WHERE FeedEntityId IN :postIds AND Type = 'Content'
            WITH USER_MODE
        ]) {
            if (attachment.RecordId == null || attachment.RecordId.getSObjectType() != ContentVersion.SObjectType) continue;
            versionIds.add(attachment.RecordId);
            if (!versionsByPost.containsKey(attachment.FeedEntityId)) versionsByPost.put(attachment.FeedEntityId, new List<Id>());
            versionsByPost.get(attachment.FeedEntityId).add(attachment.RecordId);
        }
        if (versionIds.isEmpty()) return result;
        Map<Id, ContentVersion> versions = new Map<Id, ContentVersion>([
            SELECT Id, ContentDocumentId, Title, FileType, FileExtension, ContentSize
            FROM ContentVersion
            WHERE Id IN :versionIds
            WITH USER_MODE
            ORDER BY Title
        ]);
        for (Id postId : versionsByPost.keySet()) {
            for (Id versionId : versionsByPost.get(postId)) {
                ContentVersion version = versions.get(versionId);
                if (version == null) continue;
                if (!result.containsKey(postId)) result.put(postId, new List<Map<String, Object>>());
                String fileType = version.FileType == null ? '' : version.FileType.toUpperCase();
                result.get(postId).add(new Map<String, Object>{
                'documentId' => version.ContentDocumentId,
                'versionId' => version.Id,
                'title' => version.Title,
                'fileType' => version.FileType,
                'extension' => version.FileExtension,
                'size' => version.ContentSize,
                'isImage' => imageTypes.contains(fileType)
            });
            }
        }
        return result;
    }
    @AuraEnabled
    public static Id publish(Id recordId, Id targetId, String kind, String body, List<Id> documentIds) {
        if (!KINDS.contains(kind) || String.isBlank(body) || body.length() > 9000) throw denied('Escolha um tipo e escreva uma mensagem de até 9.000 caracteres.');
        Scope s = context(recordId);
        if (!s.destinations.containsKey(targetId)) throw denied('Registro fora desta demanda ou sem acesso.');
        String prefix = '[' + kind + '] ';
        if (targetId.getSObjectType() == Task.SObjectType) prefix += '[' + s.labels.get(targetId) + '] ';
        FeedItem post = new FeedItem(ParentId = s.destinations.get(targetId), Body = prefix + body.trim(), Type = 'TextPost');
        insert as user post;
        attachDocumentsToFeed(post.Id, documentIds);
        return post.Id;
    }
    private static void attachDocumentsToFeed(Id feedEntityId, List<Id> documentIds) {
        if (documentIds == null || documentIds.isEmpty()) return;
        Map<Id, ContentDocument> documents = documentsById(documentIds);
        List<FeedAttachment> attachments = new List<FeedAttachment>();
        for (Id documentId : new Set<Id>(documentIds)) {
            ContentDocument document = documents.get(documentId);
            attachments.add(new FeedAttachment(FeedEntityId = feedEntityId, RecordId = document.LatestPublishedVersionId, Type = 'Content'));
        }
        insert as user attachments;
    }
    private static Map<Id, ContentDocument> documentsById(List<Id> documentIds) {
        Set<Id> uniqueDocumentIds = new Set<Id>(documentIds);
        for (Id documentId : uniqueDocumentIds) {
            if (documentId == null || documentId.getSObjectType() != ContentDocument.SObjectType) {
                throw denied('Arquivo inválido para publicação.');
            }
        }
        Map<Id, ContentDocument> documents = new Map<Id, ContentDocument>([
            SELECT Id, Title, LatestPublishedVersionId
            FROM ContentDocument
            WHERE Id IN :uniqueDocumentIds
            WITH USER_MODE
        ]);
        for (Id documentId : uniqueDocumentIds) {
            ContentDocument document = documents.get(documentId);
            if (document == null) throw denied('Arquivo fora do seu acesso.');
        }
        return documents;
    }
    private static FeedItem accessiblePost(Id recordId, Id postId) {
        Scope s = context(recordId);
        Set<Id> parents = new Set<Id>(s.destinations.values());
        List<FeedItem> posts = [SELECT Id FROM FeedItem WHERE Id = :postId AND ParentId IN :parents WITH USER_MODE];
        if (posts.isEmpty()) throw denied('Publicação fora desta demanda ou sem acesso.');
        return posts[0];
    }
    @AuraEnabled
    public static List<Map<String, Object>> getComments(Id recordId, Id postId) {
        accessiblePost(recordId, postId);
        List<FeedComment> comments = [
            SELECT Id, CommentBody, IsRichText, RelatedRecordId, CreatedBy.Name, CreatedDate
            FROM FeedComment
            WHERE FeedItemId = :postId
            WITH USER_MODE
            ORDER BY CreatedDate DESC, Id DESC
            LIMIT 50
        ];
        Set<Id> versionIds = new Set<Id>();
        for (FeedComment reply : comments) {
            if (reply.RelatedRecordId != null && reply.RelatedRecordId.getSObjectType() == ContentVersion.SObjectType) {
                versionIds.add(reply.RelatedRecordId);
            }
        }
        Map<Id, ContentVersion> versions = versionIds.isEmpty() ? new Map<Id, ContentVersion>() : new Map<Id, ContentVersion>([
            SELECT Id, ContentDocumentId, Title, FileType, FileExtension, ContentSize
            FROM ContentVersion
            WHERE Id IN :versionIds
            WITH USER_MODE
        ]);
        Set<String> imageTypes = new Set<String>{'BMP', 'GIF', 'JPG', 'JPEG', 'PNG', 'SVG', 'TIF', 'TIFF', 'WEBP'};
        List<Map<String, Object>> result = new List<Map<String, Object>>();
        for (FeedComment reply : comments) {
            List<Map<String, Object>> attachments = new List<Map<String, Object>>();
            ContentVersion version = versions.get(reply.RelatedRecordId);
            if (version != null) {
                String fileType = version.FileType == null ? '' : version.FileType.toUpperCase();
                attachments.add(new Map<String, Object>{
                    'documentId' => version.ContentDocumentId,
                    'versionId' => version.Id,
                    'title' => version.Title,
                    'fileType' => version.FileType,
                    'extension' => version.FileExtension,
                    'size' => version.ContentSize,
                    'isImage' => imageTypes.contains(fileType)
                });
            }
            result.add(new Map<String, Object>{
                'id' => reply.Id,
                'body' => reply.CommentBody,
                'rich' => reply.IsRichText,
                'author' => reply.CreatedBy.Name,
                'createdAt' => reply.CreatedDate,
                'attachments' => attachments
            });
        }
        return result;
    }
    @AuraEnabled
    public static Id comment(Id recordId, Id postId, String body, List<Id> documentIds) {
        if (String.isBlank(body) || body.length() > 9000) throw denied('Escreva um comentário de até 9.000 caracteres.');
        accessiblePost(recordId, postId);
        String commentBody = body.trim();
        Id relatedVersionId;
        if (documentIds != null && !documentIds.isEmpty()) {
            Map<Id, ContentDocument> documents = documentsById(documentIds);
            List<String> links = new List<String>();
            for (ContentDocument document : documents.values()) {
                if (relatedVersionId == null) relatedVersionId = document.LatestPublishedVersionId;
                links.add(document.Title + ': /lightning/r/ContentDocument/' + document.Id + '/view');
            }
            commentBody += '\n\nArquivos anexados:\n' + String.join(links, '\n');
            if (commentBody.length() > 10000) throw denied('A resposta com links dos arquivos ultrapassa 10.000 caracteres.');
        }
        FeedComment reply = new FeedComment(FeedItemId = postId, CommentBody = commentBody);
        if (relatedVersionId != null) reply.RelatedRecordId = relatedVersionId;
        insert as user reply;
        return reply.Id;
    }
}
