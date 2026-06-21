@IsTest
private class ApontamentoFixoControllerTest {

    private static ApontamentoFixo__c novaRotina(String nome, String diaDaSemana) {
        return new ApontamentoFixo__c(
            Name = nome,
            DiaDaSemana__c = diaDaSemana,
            HoraInicio__c = '11:00',
            HoraFim__c = '11:30'
        );
    }

    @IsTest
    static void buscarSalvarDeletarRotina_cobreController() {
        ApontamentoFixo__c rotina = novaRotina('Controller Daily', 'Seg');

        Test.startTest();
        ApontamentoFixoController.salvarRotina(rotina);
        List<ApontamentoFixo__c> rotinas = ApontamentoFixoController.buscarRotinas();
        ApontamentoFixoController.deletarRotina(rotina.Id);
        Test.stopTest();

        System.assertEquals(1, rotinas.size(), 'Deveria retornar a rotina salva pela controller.');
        System.assertEquals('Controller Daily', rotinas[0].Name);
        System.assertEquals(0, [SELECT COUNT() FROM ApontamentoFixo__c WHERE Id = :rotina.Id]);
    }

    @IsTest
    static void gerarApontamentosSemana_cobreController() {
        insert novaRotina('Controller Weekly', 'Qua');

        Test.startTest();
        ApontamentoFixoController.gerarApontamentosSemana('2026-03-22');
        Test.stopTest();

        List<ApontamentoDeHoras__c> apontamentos = [
            SELECT Name, Inicio__c, Fim__c
            FROM ApontamentoDeHoras__c
            WHERE Name = 'Controller Weekly'
        ];

        System.assertEquals(1, apontamentos.size(), 'Deveria gerar apontamento a partir da rotina fixa.');
    }
}
