@isTest
private class TransferenciaServiceTest {

    @TestSetup
    static void setup() {
        User u = new User(
            Alias = 'trftest',
            Email = 'transferenciatest@test.com',
            EmailEncodingKey = 'UTF-8',
            LastName = 'Test',
            LanguageLocaleKey = 'pt_BR',
            LocaleSidKey = 'pt_BR',
            ProfileId = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1].Id,
            TimeZoneSidKey = 'America/Sao_Paulo',
            UserName = 'transferenciatest@test.uniqueorg.com'
        );
        insert u;
    }

    static User getUser() {
        return [SELECT Id FROM User WHERE UserName = 'transferenciatest@test.uniqueorg.com' LIMIT 1];
    }

    @isTest
    static void testRealizarTransferencia_simples() {
        User u = getUser();
        System.runAs(u) {
            Transacao__c t = new Transacao__c(
                Name = 'Salário',
                Tipo__c = 'Entrada',
                Valor__c = 5000,
                Data__c = Date.today(),
                Recorrente__c = false
            );
            Test.startTest();
            TransferenciaService.realizarTransferencia(t);
            Test.stopTest();
            List<Transacao__c> result = [SELECT Id FROM Transacao__c WHERE OwnerId = :u.Id];
            System.assertEquals(1, result.size());
        }
    }

    @isTest
    static void testRealizarTransferencia_mensal() {
        User u = getUser();
        System.runAs(u) {
            Transacao__c t = new Transacao__c(
                Name = 'Aluguel',
                Tipo__c = 'Saída',
                Valor__c = 1500,
                Data__c = Date.today(),
                Recorrente__c = true,
                Frequencia__c = 'Mensal'
            );
            Test.startTest();
            TransferenciaService.realizarTransferencia(t);
            Test.stopTest();
            List<Transacao__c> result = [SELECT Id FROM Transacao__c WHERE OwnerId = :u.Id];
            System.assertEquals(12, result.size(), 'Deve criar 12 cópias mensais');
        }
    }

    @isTest
    static void testRealizarTransferencia_semestral() {
        User u = getUser();
        System.runAs(u) {
            Transacao__c t = new Transacao__c(
                Name = 'Seguro',
                Tipo__c = 'Saída',
                Valor__c = 800,
                Data__c = Date.today(),
                Recorrente__c = true,
                Frequencia__c = 'Semestral'
            );
            Test.startTest();
            TransferenciaService.realizarTransferencia(t);
            Test.stopTest();
            List<Transacao__c> result = [SELECT Id FROM Transacao__c WHERE OwnerId = :u.Id];
            System.assertEquals(2, result.size());
        }
    }

    @isTest
    static void testRealizarTransferencia_anual() {
        User u = getUser();
        System.runAs(u) {
            Transacao__c t = new Transacao__c(
                Name = 'IPTU',
                Tipo__c = 'Saída',
                Valor__c = 2000,
                Data__c = Date.today(),
                Recorrente__c = true,
                Frequencia__c = 'Anual'
            );
            Test.startTest();
            TransferenciaService.realizarTransferencia(t);
            Test.stopTest();
            List<Transacao__c> result = [SELECT Id FROM Transacao__c WHERE OwnerId = :u.Id];
            System.assertEquals(3, result.size());
        }
    }

    @isTest
    static void testDeletarTransacao() {
        User u = getUser();
        System.runAs(u) {
            Transacao__c t = new Transacao__c(
                Name = 'Para Deletar',
                Tipo__c = 'Saída',
                Valor__c = 100,
                Data__c = Date.today(),
                Recorrente__c = false
            );
            insert t;
            Test.startTest();
            TransferenciaService.deletarTransacao(t.Id);
            Test.stopTest();
            List<Transacao__c> result = [SELECT Id FROM Transacao__c WHERE Id = :t.Id];
            System.assertEquals(0, result.size());
        }
    }

    @isTest
    static void testAtualizarTransacao() {
        User u = getUser();
        System.runAs(u) {
            Transacao__c t = new Transacao__c(
                Name = 'Original',
                Tipo__c = 'Entrada',
                Valor__c = 200,
                Data__c = Date.today(),
                Recorrente__c = false
            );
            insert t;
            t.Valor__c = 300;
            t.Pago__c = true;
            Test.startTest();
            TransferenciaService.atualizarTransacao(t);
            Test.stopTest();
            Transacao__c updated = [SELECT Valor__c, Pago__c FROM Transacao__c WHERE Id = :t.Id];
            System.assertEquals(300, updated.Valor__c);
            System.assertEquals(true, updated.Pago__c);
        }
    }

    @isTest
    static void testGetContasAPagar() {
        User u = getUser();
        System.runAs(u) {
            Transacao__c t = new Transacao__c(
                Name = 'Conta Futura',
                Tipo__c = 'Saída',
                Valor__c = 500,
                Data__c = Date.today().addDays(5),
                Pago__c = false,
                Recorrente__c = false
            );
            insert t;
            Test.startTest();
            List<Transacao__c> result = TransferenciaService.getContasAPagar();
            Test.stopTest();
            System.assertNotEquals(0, result.size());
        }
    }
}
