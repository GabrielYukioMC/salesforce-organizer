/**
 * Validates the inverse side of Case.Work__c when a Work is edited.
 * System visibility is intentional: an inaccessible Case must still protect
 * its principal Work. No records or field values are returned to the caller.
 * User CRUD/FLS remains enforced by the record editing entry point.
 */
public without sharing class WorkRelationshipHandler {
    public static void beforeUpdate(List<Work__c> works, Map<Id, Work__c> oldMap) {
        Map<Id, Work__c> changed = new Map<Id, Work__c>();
        for (Work__c work : works) {
            Work__c previous = oldMap.get(work.Id);
            if (work.ParentWork__c != previous.ParentWork__c || work.Case__c != previous.Case__c) {
                changed.put(work.Id, work);
            }
        }
        if (changed.isEmpty()) {
            return;
        }

        for (Case origin : [SELECT Id, Work__c FROM Case WHERE Work__c IN :changed.keySet()]) {
            Work__c work = changed.get(origin.Work__c);
            if (work.ParentWork__c != null || work.Case__c != origin.Id) {
                work.addError('Esta Work é principal de um Case. Remova primeiro o vínculo Work principal no Case para alterar sua origem ou definir uma Work pai.');
            }
        }
    }
}
