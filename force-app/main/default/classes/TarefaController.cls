public without sharing class TarefaController {


    @AuraEnabled
    public static void criarTarefa(Tarefa__c novaTarefa) {
        TarefaService.criarTarefa(novaTarefa);
    }
   
}