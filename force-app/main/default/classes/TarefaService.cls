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

        if (!novaTarefa.Recorrente__c || novaTarefa.FrequenciaTarefa__c == null) {
            insert novaTarefa;
            return;
        }

        Integer quantidade = 1;
        Integer diasIncremento = 0;
        Integer mesesIncremento = 0;

        if (novaTarefa.FrequenciaTarefa__c == 'Semanal') {
            quantidade = 12;
            diasIncremento = 7;
        } else if (novaTarefa.FrequenciaTarefa__c == 'Quinzenal') {
            quantidade = 6;
            diasIncremento = 14;
        } else if (novaTarefa.FrequenciaTarefa__c == 'Mensal') {
            quantidade = 6;
            mesesIncremento = 1;
        }

        List<Tarefa__c> lista = new List<Tarefa__c>();
        for (Integer i = 0; i < quantidade; i++) {
            Tarefa__c copia = novaTarefa.clone(false, true, false, false);
            if (copia.CloseDate__c != null) {
                if (mesesIncremento > 0) {
                    copia.CloseDate__c = novaTarefa.CloseDate__c.addMonths(i * mesesIncremento);
                } else {
                    copia.CloseDate__c = novaTarefa.CloseDate__c.addDays(i * diasIncremento);
                }
            }
            lista.add(copia);
        }
        insert lista;
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
        update new Tarefa__c(Id = tarefaId, Status__c = novoStatus);
    }


    public static void atualizarTarefa(Tarefa__c tarefa) {
        if(tarefa == null || tarefa.Id == null) {
            throw new AuraHandledException('Tarefa inválida para atualização.');
        }
        if(tarefa.Name == null || tarefa.Name.trim() == '') {
            throw new AuraHandledException('O nome da tarefa é obrigatório.');
        }
        if(tarefa.Descricao__c != null && tarefa.Descricao__c.length() > 2000) {
            throw new AuraHandledException('A descrição está muito longa. Utilize no máximo 2000 caracteres.');
        }

        Tarefa__c atualizar = new Tarefa__c(
            Id            = tarefa.Id,
            Name          = tarefa.Name,
            Descricao__c  = tarefa.Descricao__c,
            Prioridade__c = tarefa.Prioridade__c,
            TipoTarefa__c = tarefa.TipoTarefa__c,
            Status__c     = tarefa.Status__c,
            CloseDate__c  = tarefa.CloseDate__c,
            Checklist__c  = tarefa.Checklist__c,
            InicioTarefa__c = tarefa.InicioTarefa__c,
            FimTarefa__c    = tarefa.FimTarefa__c,
            Projeto__c      = tarefa.Projeto__c
        );
        update atualizar;
    }


    public static Integer apagarTarefasAntigas(Id usuarioId) {
        List<Tarefa__c> tarefas = TarefaSelector.buscarTarefasParaApagar(usuarioId);
        if(!tarefas.isEmpty()) {
            for (Tarefa__c t : tarefas) {
                t.Arquivada__c = true;
            }
            update tarefas;
        }
        return tarefas.size();
    }

    public static List<Tarefa__c> buscarTarefasArquivadas(Id usuarioId) {
        return TarefaSelector.buscarTarefasArquivadas(usuarioId);
    }


    public static void deletarTarefa(Id tarefaId) {
        if(tarefaId == null) {
            throw new AuraHandledException('ID da tarefa não informado.');
        }
        delete new Tarefa__c(Id = tarefaId);
    }
}
