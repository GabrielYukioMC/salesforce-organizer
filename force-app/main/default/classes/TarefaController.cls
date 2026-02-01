public without sharing class TarefaController {


    @AuraEnabled
    public static void criarTarefa(Tarefa__c novaTarefa) {
        TarefaService.criarTarefa(novaTarefa);
    }

    @AuraEnabled(cacheable=true)
    public static List<Tarefa__c> buscarTarefasPorUsuarioKanban() {
        return TarefaService.buscarTarefasPorUsuario(UserInfo.getUserId());

    }
   
}