public without sharing class ApontamentoFixoSelector {

    public static List<ApontamentoFixo__c> buscarPorUsuario(Id usuarioId) {
        return [
            SELECT Id, Name, DiaDaSemana__c, HoraInicio__c, HoraFim__c,
                   Projeto__c, PerfilDeAlocacao__c
            FROM ApontamentoFixo__c
            WHERE OwnerId = :usuarioId
            ORDER BY HoraInicio__c ASC
        ];
    }
}
