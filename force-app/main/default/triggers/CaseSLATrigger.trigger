trigger CaseSLATrigger on Case(before insert, before update) {
    if (Trigger.isBefore) {
        if (Trigger.isInsert) {
            CaseSLATriggerHandler.beforeInsert(Trigger.new);
        }
        if (Trigger.isUpdate) {
            CaseSLATriggerHandler.beforeUpdate(Trigger.new, Trigger.oldMap);
        }
    }
}