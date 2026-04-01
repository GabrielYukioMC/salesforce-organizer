public class TarefaTriggerHandler {

    /**
     * Roda no before insert/update.
     * Quando a tarefa é criada ou movida para "Em andamento",
     * preenche InicioTarefa__c automaticamente (se ainda estiver vazio).
     */
    public static void beforeInsertUpdate(List<Tarefa__c> newList, Map<Id, Tarefa__c> oldMap) {
        Boolean isInsert = (oldMap == null);
        for (Tarefa__c t : newList) {
            String statusAnterior = isInsert ? null : oldMap.get(t.Id).Status__c;

            if (t.Status__c == 'Em andamento' && statusAnterior != 'Em andamento' && t.InicioTarefa__c == null) {
                t.InicioTarefa__c = DateTime.now();
            }

            if (t.Status__c == 'Concluído' && statusAnterior != 'Concluído' && t.FimTarefa__c == null) {
                t.FimTarefa__c = DateTime.now();
            }
        }
    }

    public static void afterUpdate(List<Tarefa__c> newList, Map<Id, Tarefa__c> oldMap) {
        List<ApontamentoDeHoras__c> toInsert = new List<ApontamentoDeHoras__c>();
        List<ApontamentoDTO>        dtos      = new List<ApontamentoDTO>();

        for (Tarefa__c t : newList) {
            if (t.Status__c == 'Concluído' && oldMap.get(t.Id).Status__c != 'Concluído') {
                toInsert.addAll(ApontamentoBuilder.buildSObjectsFromTarefa(t));
                dtos.add(ApontamentoBuilder.buildFromTarefa(t));
            }
        }

        if (!toInsert.isEmpty()) {
            insert toInsert;
            System.debug('### Apontamentos inseridos: ' + JSON.serialize(dtos));
            // TODO: ApontamentoService.enviarParaOrg(dtos);
        }
    }
}
