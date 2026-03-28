@isTest
private class TarefaServiceTest {

    @TestSetup
    static void setup() {
        User u = new User(
            Alias = 'tstuser',
            Email = 'tarefatest@test.com',
            EmailEncodingKey = 'UTF-8',
            LastName = 'Test',
            LanguageLocaleKey = 'pt_BR',
            LocaleSidKey = 'pt_BR',
            ProfileId = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1].Id,
            TimeZoneSidKey = 'America/Sao_Paulo',
            UserName = 'tarefatest@test.uniqueorg.com'
        );
        insert u;
    }

    static User getUser() {
        return [SELECT Id FROM User WHERE UserName = 'tarefatest@test.uniqueorg.com' LIMIT 1];
    }

    @isTest
    static void testCriarTarefa_sucesso() {
        User u = getUser();
        System.runAs(u) {
            Tarefa__c t = new Tarefa__c(
                Name = 'Tarefa Teste',
                Prioridade__c = 'Alta',
                Status__c = 'Não iniciado',
                TipoTarefa__c = 'Outros'
            );
            Test.startTest();
            TarefaService.criarTarefa(t);
            Test.stopTest();
            List<Tarefa__c> result = [SELECT Id FROM Tarefa__c WHERE UsuarioProprietario__c = :u.Id];
            System.assertEquals(1, result.size(), 'Deve criar 1 tarefa');
        }
    }

    @isTest
    static void testCriarTarefa_semNome() {
        User u = getUser();
        System.runAs(u) {
            Tarefa__c t = new Tarefa__c(Prioridade__c = 'Alta');
            Test.startTest();
            try {
                TarefaService.criarTarefa(t);
                System.assert(false, 'Deveria lançar exceção');
            } catch (AuraHandledException e) {
                System.assert(e.getMessage() != null);
            }
            Test.stopTest();
        }
    }

    @isTest
    static void testCriarTarefa_semPrioridade() {
        User u = getUser();
        System.runAs(u) {
            Tarefa__c t = new Tarefa__c(Name = 'Tarefa');
            Test.startTest();
            try {
                TarefaService.criarTarefa(t);
                System.assert(false, 'Deveria lançar exceção');
            } catch (AuraHandledException e) {
                System.assert(e.getMessage() != null);
            }
            Test.stopTest();
        }
    }

    @isTest
    static void testCriarTarefa_recorrente() {
        User u = getUser();
        System.runAs(u) {
            Tarefa__c t = new Tarefa__c(
                Name = 'Tarefa Recorrente',
                Prioridade__c = 'Média',
                Status__c = 'Não iniciado',
                TipoTarefa__c = 'Outros',
                Recorrente__c = true,
                FrequenciaTarefa__c = 'Semanal',
                CloseDate__c = Datetime.now().addDays(1)
            );
            Test.startTest();
            TarefaService.criarTarefa(t);
            Test.stopTest();
            List<Tarefa__c> result = [SELECT Id FROM Tarefa__c WHERE UsuarioProprietario__c = :u.Id];
            System.assertEquals(12, result.size(), 'Deve criar 12 tarefas semanais');
        }
    }

    @isTest
    static void testAtualizarTarefa_sucesso() {
        User u = getUser();
        System.runAs(u) {
            Tarefa__c t = new Tarefa__c(
                Name = 'Original',
                Prioridade__c = 'Baixa',
                Status__c = 'Não iniciado',
                UsuarioProprietario__c = u.Id
            );
            insert t;
            t.Name = 'Atualizado';
            Test.startTest();
            TarefaService.atualizarTarefa(t);
            Test.stopTest();
            Tarefa__c updated = [SELECT Name FROM Tarefa__c WHERE Id = :t.Id];
            System.assertEquals('Atualizado', updated.Name);
        }
    }

    @isTest
    static void testDeletarTarefa() {
        User u = getUser();
        System.runAs(u) {
            Tarefa__c t = new Tarefa__c(
                Name = 'Para Deletar',
                Prioridade__c = 'Baixa',
                Status__c = 'Não iniciado',
                UsuarioProprietario__c = u.Id
            );
            insert t;
            Test.startTest();
            TarefaService.deletarTarefa(t.Id);
            Test.stopTest();
            List<Tarefa__c> result = [SELECT Id FROM Tarefa__c WHERE Id = :t.Id];
            System.assertEquals(0, result.size());
        }
    }

    @isTest
    static void testApagarTarefasAntigas_arquiva() {
        User u = getUser();
        System.runAs(u) {
            Tarefa__c t = new Tarefa__c(
                Name = 'Antiga',
                Prioridade__c = 'Baixa',
                Status__c = 'Concluído',
                UsuarioProprietario__c = u.Id
            );
            insert t;
            Test.setCreatedDate(t.Id, Datetime.now().addDays(-25));
            Test.startTest();
            Integer count = TarefaService.apagarTarefasAntigas(u.Id);
            Test.stopTest();
            Tarefa__c arquivada = [SELECT Arquivada__c FROM Tarefa__c WHERE Id = :t.Id];
            System.assertEquals(true, arquivada.Arquivada__c, 'Deve arquivar a tarefa');
        }
    }

    @isTest
    static void testBuscarTarefasArquivadas() {
        User u = getUser();
        System.runAs(u) {
            Tarefa__c t = new Tarefa__c(
                Name = 'Arquivada',
                Prioridade__c = 'Baixa',
                Status__c = 'Concluído',
                Arquivada__c = true,
                UsuarioProprietario__c = u.Id
            );
            insert t;
            Test.startTest();
            List<Tarefa__c> result = TarefaService.buscarTarefasArquivadas(u.Id);
            Test.stopTest();
            System.assertEquals(1, result.size());
        }
    }
}
