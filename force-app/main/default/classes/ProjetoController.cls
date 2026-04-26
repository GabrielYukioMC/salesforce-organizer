public without sharing class ProjetoController {

    @AuraEnabled(cacheable=true)
    public static List<Projeto__c> buscarProjetos() {
        return ProjetoSelector.buscarTodos();
    }
}
