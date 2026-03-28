public without sharing class TarefaController {

    @AuraEnabled
    public static void criarTarefa(Tarefa__c novaTarefa) {
        TarefaService.criarTarefa(novaTarefa);
    }

    @AuraEnabled(cacheable=true)
    public static List<Tarefa__c> buscarTarefasPorUsuarioKanban() {
        return TarefaService.buscarTarefasPorUsuario(UserInfo.getUserId());
    }

    @AuraEnabled
    public static void atualizarStatusTarefa(Id tarefaId, String novoStatus) {
        TarefaService.atualizarStatusTarefa(tarefaId, novoStatus);
    }

    @AuraEnabled
    public static void atualizarTarefa(Tarefa__c tarefa) {
        TarefaService.atualizarTarefa(tarefa);
    }

    @AuraEnabled
    public static Integer apagarTarefasAntigas() {
        return TarefaService.apagarTarefasAntigas(UserInfo.getUserId());
    }

    @AuraEnabled
    public static void deletarTarefa(Id tarefaId) {
        TarefaService.deletarTarefa(tarefaId);
    }

    @AuraEnabled(cacheable=true)
    public static List<Tarefa__c> buscarTarefasArquivadas() {
        return TarefaService.buscarTarefasArquivadas(UserInfo.getUserId());
    }
}