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
        // Coletar apenas as tarefas recém-concluídas
        List<Tarefa__c> concluidas = new List<Tarefa__c>();
        for (Tarefa__c t : newList) {
            if (t.Status__c == 'Concluído' && oldMap.get(t.Id).Status__c != 'Concluído') {
                concluidas.add(t);
            }
        }
        if (concluidas.isEmpty()) return;

        // Determinar o intervalo de tempo coberto por todas as tarefas concluídas,
        // para buscar os apontamentos existentes em uma única query.
        Datetime periodoIni = null;
        Datetime periodoFim = null;
        for (Tarefa__c t : concluidas) {
            Datetime tIni = t.InicioTarefa__c != null ? t.InicioTarefa__c : DateTime.now().addHours(-1);
            Datetime tFim = t.FimTarefa__c    != null ? t.FimTarefa__c    : DateTime.now();
            if (periodoIni == null || tIni < periodoIni) periodoIni = tIni;
            if (periodoFim == null || tFim > periodoFim) periodoFim = tFim;
        }

        // Re-query para trazer Projeto__r com IDs da Elera (newList não carrega relacionamentos)
        Map<Id, Tarefa__c> concluidasComProjeto = new Map<Id, Tarefa__c>([
            SELECT Id, Name, InicioTarefa__c, FimTarefa__c, Descricao__c, UsuarioProprietario__c,
                   Projeto__c,
                   Projeto__r.Id_Elera__c,
                   Projeto__r.Id_Perfil_Alocacao_Elera__c
            FROM Tarefa__c
            WHERE Id IN :concluidas
        ]);

        // Apontamentos já persistidos que podem conflitar com os novos
        List<ApontamentoDeHoras__c> existentes =
            ApontamentoSelector.buscarPorPeriodo(UserInfo.getUserId(), periodoIni, periodoFim);

        List<ApontamentoDeHoras__c> toInsert = new List<ApontamentoDeHoras__c>();
        List<ApontamentoDTO>        dtos      = new List<ApontamentoDTO>();

        for (Tarefa__c t : concluidasComProjeto.values()) {
            // Incluir os já calculados neste batch como "ocupados" para as próximas tarefas
            List<ApontamentoDeHoras__c> todosExistentes = new List<ApontamentoDeHoras__c>(existentes);
            todosExistentes.addAll(toInsert);

            toInsert.addAll(ApontamentoBuilder.buildSObjectsFromTarefa(t, todosExistentes));
            dtos.add(ApontamentoBuilder.buildFromTarefa(t));
        }

        if (!toInsert.isEmpty()) {
            insert toInsert;
            System.debug('### Apontamentos inseridos: ' + JSON.serialize(dtos));
            // TODO: ApontamentoService.enviarParaOrg(dtos);
        }
    }
}
