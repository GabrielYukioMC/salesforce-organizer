public without sharing class TarefaService {

    public static void criarTarefa(Tarefa__c novaTarefa) {
        System.debug('Criando tarefa: ' + novaTarefa);

        if(novaTarefa == null) {
            throw new AuraHandledException('A tarefa não pode ser nula.');
        }

        if(novaTarefa.Name == null || novaTarefa.Name.trim() == '') {
            throw new AuraHandledException('O nome da tarefa é obrigatório.');
        }

        if(novaTarefa.Prioridade__c == null || novaTarefa.Prioridade__c.trim() == '') {
            throw new AuraHandledException('A prioridade da tarefa é obrigatória.');
        }

        if(novaTarefa.Descricao__c != null && novaTarefa.Descricao__c.length() > 2000) {
            throw new AuraHandledException('A descrição da tarefa está muito longa. Utilize descrições mais curtas e diretas.');
        }

        novaTarefa.UsuarioProprietario__c = UserInfo.getUserId();
        insert novaTarefa;
    }


    public static List<Tarefa__c> buscarTarefasPorUsuario(ID idUser) {

        idUser = idUser == null ? UserInfo.getUserId() : idUser;
        return TarefaSelector.buscarTarefasPorUsuario(idUser);
    }


    public static void atualizarStatusTarefa(Id tarefaId, String novoStatus) {
        if(tarefaId == null) {
            throw new AuraHandledException('O ID da tarefa é obrigatório para atualização.');
        }
        if(novoStatus == null || novoStatus.trim() == '') {
            throw new AuraHandledException('O novo status da tarefa é obrigatório.');
        }

        Tarefa__c tarefaParaAtualizar = new Tarefa__c(Id = tarefaId);

        tarefaParaAtualizar.Status__c = novoStatus;
        update tarefaParaAtualizar;
    }





   
}