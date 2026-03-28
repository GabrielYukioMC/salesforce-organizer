@isTest
private class MetaServiceTest {

    @TestSetup
    static void setup() {
        User u = new User(
            Alias = 'metatst',
            Email = 'metatest@test.com',
            EmailEncodingKey = 'UTF-8',
            LastName = 'Test',
            LanguageLocaleKey = 'pt_BR',
            LocaleSidKey = 'pt_BR',
            ProfileId = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1].Id,
            TimeZoneSidKey = 'America/Sao_Paulo',
            UserName = 'metatest@test.uniqueorg.com'
        );
        insert u;
    }

    static User getUser() {
        return [SELECT Id FROM User WHERE UserName = 'metatest@test.uniqueorg.com' LIMIT 1];
    }

    static Meta__c buildMeta(String name, Boolean ativa) {
        return new Meta__c(
            Name = name,
            GastosFixos__c = 30,
            ReservaEmergencia__c = 10,
            Investimentos__c = 20,
            QualidadeDeVida__c = 20,
            DesenvolvimentoPessoal__c = 10,
            Objetivos__c = 10,
            Ativa__c = ativa
        );
    }

    @isTest
    static void testCriarMeta_somaValida() {
        User u = getUser();
        System.runAs(u) {
            Meta__c m = buildMeta('Meta Válida', false);
            Test.startTest();
            MetaService.criarMeta(m);
            Test.stopTest();
            List<Meta__c> result = [SELECT Id FROM Meta__c WHERE OwnerId = :u.Id];
            System.assertEquals(1, result.size());
        }
    }

    @isTest
    static void testCriarMeta_somaInvalida() {
        User u = getUser();
        System.runAs(u) {
            Meta__c m = buildMeta('Meta Inválida', false);
            m.GastosFixos__c = 50; // soma > 100
            Test.startTest();
            try {
                MetaService.criarMeta(m);
                System.assert(false, 'Deveria lançar exceção');
            } catch (AuraHandledException e) {
                System.assert(e.getMessage().contains('100'));
            }
            Test.stopTest();
        }
    }

    @isTest
    static void testAtivarMeta_desativaOutras() {
        User u = getUser();
        System.runAs(u) {
            Meta__c m1 = buildMeta('Meta 1', true);
            Meta__c m2 = buildMeta('Meta 2', false);
            insert new List<Meta__c>{ m1, m2 };
            Test.startTest();
            MetaService.ativarMeta(m2.Id);
            Test.stopTest();
            Meta__c meta1 = [SELECT Ativa__c FROM Meta__c WHERE Id = :m1.Id];
            Meta__c meta2 = [SELECT Ativa__c FROM Meta__c WHERE Id = :m2.Id];
            System.assertEquals(false, meta1.Ativa__c, 'Meta 1 deve ser desativada');
            System.assertEquals(true, meta2.Ativa__c, 'Meta 2 deve ser ativada');
        }
    }

    @isTest
    static void testDeletarMeta() {
        User u = getUser();
        System.runAs(u) {
            Meta__c m = buildMeta('Para Deletar', false);
            insert m;
            Test.startTest();
            MetaService.deletarMeta(m.Id);
            Test.stopTest();
            List<Meta__c> result = [SELECT Id FROM Meta__c WHERE Id = :m.Id];
            System.assertEquals(0, result.size());
        }
    }

    @isTest
    static void testBuscarMetaAtiva() {
        User u = getUser();
        System.runAs(u) {
            Meta__c m = buildMeta('Ativa', true);
            insert m;
            Test.startTest();
            Meta__c result = MetaService.buscarMetaAtiva();
            Test.stopTest();
            System.assertNotEquals(null, result);
            System.assertEquals(m.Id, result.Id);
        }
    }

    @isTest
    static void testCriarMeta_semNome() {
        User u = getUser();
        System.runAs(u) {
            Meta__c m = buildMeta('', false);
            Test.startTest();
            try {
                MetaService.criarMeta(m);
                System.assert(false, 'Deveria lançar exceção');
            } catch (AuraHandledException e) {
                System.assert(e.getMessage() != null);
            }
            Test.stopTest();
        }
    }
}
