public without sharing class ApontamentoSelector {

    public static List<ApontamentoDeHoras__c> buscarPorPeriodo(Id usuarioId, Datetime inicio, Datetime fim) {
        return [
            SELECT
                Id,
                Name,
                Inicio__c,
                Fim__c,
                DuracaoHoras__c,
                TempoMinutos__c,
                Projeto__c,
                PerfilDeAlocacao__c,
                Observacoes__c,
                OwnerId
            FROM ApontamentoDeHoras__c
            WHERE OwnerId = :usuarioId
            AND Fim__c >= :inicio
            AND Inicio__c < :fim
            ORDER BY Inicio__c ASC
        ];
    }

    public static List<ApontamentoDeHoras__c> buscarParaEnvio(Id usuarioId, Datetime inicio, Datetime fim) {
        return [
            SELECT
                Id,
                Name,
                Inicio__c,
                Fim__c,
                Observacoes__c,
                PerfilDeAlocacao__c,
                ProjetoLookup__c,
                ProjetoLookup__r.Id_Elera__c,
                ProjetoLookup__r.Id_Perfil_Alocacao_Elera__c
            FROM ApontamentoDeHoras__c
            WHERE OwnerId = :usuarioId
            AND Fim__c >= :inicio
            AND Inicio__c < :fim
            AND JaEnviado__c = false
            ORDER BY Inicio__c ASC
        ];
    }
}
