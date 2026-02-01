public without sharing class TarefaSelector {
    


    public static List<Tarefa__c> buscarTarefasPorUsuario(Id usuarioId) {
       return [SELECT
                Id,
                Name,
                Status__c,
                Prioridade__c,
                TipoTarefa__c,
                CloseDate__c,
                CreatedDate
            FROM Tarefa__c
            WHERE UsuarioProprietario__c = :usuarioId
            AND IsDeleted = false
           ORDER BY     HasCloseDate__c ASC,
    CloseDate__c ASC,
    PrioridadeNumber__c ASC
        ];
    }
}