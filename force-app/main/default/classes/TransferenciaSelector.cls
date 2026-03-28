public without sharing class TransferenciaSelector {
   

    public static List<Transacao__c> buscarTransferenciasPorUsuario() {
        return [SELECT Id, Name, Valor__c, Data__c, Tipo__c, RecordTypeId FROM Transacao__c WHERE OwnerId = :UserInfo.getUserId()  ];
    }

    public static List<Transacao__c> buscarTransferenciasPorUsuarioEData(Date dataInicio, Date dataFim) {
        return [SELECT Id, Name, Valor__c, Data__c, Tipo__c, Categoria__c, Pago__c, Recorrente__c, Frequencia__c, RecordTypeId FROM Transacao__c WHERE OwnerId = :UserInfo.getUserId() AND Data__c >= :dataInicio AND Data__c <= :dataFim];
    }

    public static List<Transacao__c> buscarContasAPagar() {
        Date hoje = Date.today();
        Date limite = hoje.addDays(60);
        return [
            SELECT Id, Name, Valor__c, Data__c, Tipo__c, Categoria__c
            FROM Transacao__c
            WHERE OwnerId = :UserInfo.getUserId()
            AND Pago__c = false
            AND Tipo__c = 'Saída'
            AND Data__c >= :hoje
            AND Data__c <= :limite
            ORDER BY Data__c ASC
            LIMIT 200
        ];
    }
}