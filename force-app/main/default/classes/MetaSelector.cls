public without sharing class MetaSelector {

    public static List<Meta__c> buscarMetasPorUsuario() {
        return [
            SELECT Id, Name, GastosFixos__c, ReservaEmergencia__c,
                   Investimentos__c, QualidadeDeVida__c,
                   DesenvolvimentoPessoal__c, Objetivos__c,
                   Ativa__c, Descricao__c, CreatedDate
            FROM Meta__c
            WHERE OwnerId = :UserInfo.getUserId()
            ORDER BY Ativa__c DESC, CreatedDate DESC
        ];
    }

    public static List<Meta__c> buscarMetaAtivaPorUsuario() {
        return [
            SELECT Id, Name, GastosFixos__c, ReservaEmergencia__c,
                   Investimentos__c, QualidadeDeVida__c,
                   DesenvolvimentoPessoal__c, Objetivos__c,
                   Ativa__c, Descricao__c
            FROM Meta__c
            WHERE OwnerId = :UserInfo.getUserId()
            AND Ativa__c = true
            LIMIT 1
        ];
    }
}
