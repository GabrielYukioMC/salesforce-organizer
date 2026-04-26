public with sharing class CompradorSelector {
    public static List<Comprador__c> getByOportunidade(Id oportunidadeId) {
        return [
            SELECT
                Conta__c,
                Conta__r.Name,
                Conta__r.RendaMensal__c,
                Conta__r.Phone
            FROM Comprador__c
            WHERE Oportunidade__c = :oportunidadeId
            ORDER BY Conta__r.Name ASC
        ];
    }
}
