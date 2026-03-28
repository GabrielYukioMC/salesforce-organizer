public without sharing class MetaController {

    @AuraEnabled
    public static void criarMeta(Meta__c novaMeta) {
        MetaService.criarMeta(novaMeta);
    }

    @AuraEnabled
    public static void atualizarMeta(Meta__c meta) {
        MetaService.atualizarMeta(meta);
    }

    @AuraEnabled
    public static void deletarMeta(Id metaId) {
        MetaService.deletarMeta(metaId);
    }

    @AuraEnabled(cacheable=true)
    public static List<Meta__c> buscarMetasDoUsuario() {
        return MetaService.buscarMetasDoUsuario();
    }

    @AuraEnabled(cacheable=true)
    public static Meta__c buscarMetaAtiva() {
        return MetaService.buscarMetaAtiva();
    }

    @AuraEnabled
    public static void ativarMeta(Id metaId) {
        MetaService.ativarMeta(metaId);
    }
}
