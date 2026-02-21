public without sharing class TransferenciaSelector {
   

    public static List<Transacao__c> buscarTransferenciasPorUsuario() {
        return [SELECT Id, Name, Valor__c, Data__c, Tipo__c, RecordTypeId FROM Transacao__c WHERE OwnerId = :UserInfo.getUserId()  ];
    }

    public static List<Transacao__c> buscarTransferenciasPorUsuarioEData(Date dataInicio, Date dataFim) {
        return [SELECT Id, Name, Valor__c, Data__c, Tipo__c,Categoria__c,  RecordTypeId FROM Transacao__c WHERE OwnerId = :UserInfo.getUserId() AND Data__c >= :dataInicio AND Data__c <= :dataFim];
    }
}