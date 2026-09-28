@IsTest
private class WorkRelationshipHandlerTest {
    @IsTest
    static void protectsPrimaryRelationshipsInBulkAndAllowsUnlinking() {
        List<Case> cases = new List<Case>();
        for (Integer i = 0; i < 200; i++) cases.add(new Case(Subject = 'Work bulk ' + i, Status = 'New', Origin = 'Web', PrioridadeSLA__c = 'P2'));
        insert cases;
        List<Work__c> works = new List<Work__c>();
        for (Case origin : cases) works.add(new Work__c(Titulo__c = 'Principal', Case__c = origin.Id));
        insert works;
        for (Integer i = 0; i < cases.size(); i++) cases[i].Work__c = works[i].Id;
        update cases;
        Work__c parent = new Work__c(Titulo__c = 'Pai independente'); insert parent;
        Test.startTest();
        for (Work__c work : works) work.ParentWork__c = parent.Id;
        Database.SaveResult[] results = Database.update(works, false);
        for (Database.SaveResult result : results) Assert.isFalse(result.isSuccess());
        works[0].ParentWork__c = null; works[0].Case__c = null;
        Assert.isFalse(Database.update(works[0], false).isSuccess());
        for (Case origin : cases) origin.Work__c = null;
        update cases;
        for (Work__c work : works) { work.ParentWork__c = parent.Id; work.Case__c = null; }
        update works;
        parent.Titulo__c = 'Título atualizado'; update parent;
        Test.stopTest();
        Assert.areEqual(200, [SELECT COUNT() FROM Work__c WHERE ParentWork__c = :parent.Id]);
    }
}
