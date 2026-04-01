trigger TarefaTrigger on Tarefa__c (before insert, before update, after update) {
    if (Trigger.isBefore) {
        TarefaTriggerHandler.beforeInsertUpdate(Trigger.new, Trigger.oldMap);
    } else {
        TarefaTriggerHandler.afterUpdate(Trigger.new, Trigger.oldMap);
    }
}
