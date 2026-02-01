public without sharing class TarefaService {
// obj da tarefa Tarefa__c  -- usar a cunstom object criada

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

        novaTarefa.UsuarioProprietario__c = UserInfo.getUserId();


        insert novaTarefa;

        


    }


   
}