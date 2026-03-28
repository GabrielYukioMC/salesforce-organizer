public without sharing class TarefaSelector {

    public static List<Tarefa__c> buscarTarefasPorUsuario(Id usuarioId) {
        return [
            SELECT
                Id,
                Name,
                Status__c,
                Prioridade__c,
                TipoTarefa__c,
                CloseDate__c,
                PrioridadeNumber__c,
                Descricao__c,
                Checklist__c,
                CreatedDate
            FROM Tarefa__c
            WHERE UsuarioProprietario__c = :usuarioId
            AND IsDeleted = false
            AND Arquivada__c = false
            ORDER BY HasCloseDate__c ASC,
                     CloseDate__c ASC,
                     PrioridadeNumber__c ASC
        ];
    }

    public static List<Tarefa__c> buscarTarefasArquivadas(Id usuarioId) {
        return [
            SELECT
                Id,
                Name,
                Status__c,
                Prioridade__c,
                TipoTarefa__c,
                CloseDate__c,
                Descricao__c,
                LastModifiedDate
            FROM Tarefa__c
            WHERE UsuarioProprietario__c = :usuarioId
            AND Arquivada__c = true
            ORDER BY LastModifiedDate DESC
            LIMIT 200
        ];
    }

    public static List<Tarefa__c> buscarTarefasParaApagar(Id usuarioId) {
        Datetime limite = Datetime.now().addDays(-20);
        return [
            SELECT Id
            FROM Tarefa__c
            WHERE UsuarioProprietario__c = :usuarioId
            AND (Status__c = 'Concluído' OR Status__c = 'Cancelado')
            AND LastModifiedDate < :limite
            AND Arquivada__c = false
        ];
    }
}
