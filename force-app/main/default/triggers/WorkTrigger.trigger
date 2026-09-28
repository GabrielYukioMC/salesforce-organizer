trigger WorkTrigger on Work__c (before update) {
    WorkRelationshipHandler.beforeUpdate(Trigger.new, Trigger.oldMap);
}
