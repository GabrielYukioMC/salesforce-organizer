public with sharing class CompradorController {
    @AuraEnabled(cacheable=true)
    public static List<Comprador__c> getContasByOportunidade(Id oportunidadeId) {
        return CompradorSelector.getByOportunidade(oportunidadeId);
    }

    @AuraEnabled
    public static void saveContas(List<Account> contas) {
        update contas;
        
    }
}
