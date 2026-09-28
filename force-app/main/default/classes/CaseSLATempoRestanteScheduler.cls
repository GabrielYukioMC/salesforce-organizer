public with sharing class CaseSLATempoRestanteScheduler implements Schedulable {
    public void execute(SchedulableContext context) {
        CaseSLATriggerHandler.refreshOpenCases();
    }
}