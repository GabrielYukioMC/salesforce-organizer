public without sharing class TransferenciaController {
    @AuraEnabled
    public static void realizarTransferencia(Transacao__c novaTransferencia) {
        TransferenciaService.realizarTransferencia(novaTransferencia);
    }


    @AuraEnabled 
    public static List<Transacao__c> getTransacoesPorUsuarioEData(String data) {
        return TransferenciaService.getTransacoesPorUsuarioEData(data);
    }
}