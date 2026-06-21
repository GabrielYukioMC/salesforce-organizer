@IsTest
private class ApontamentoControllerTest {

    @TestSetup
    static void setup() {
        insert new ApontamentoDeHoras__c(
            Name      = 'Reuniao planejamento',
            Inicio__c = Datetime.newInstance(Date.newInstance(2026, 6, 16), Time.newInstance(9, 0, 0, 0)),
            Fim__c    = Datetime.newInstance(Date.newInstance(2026, 6, 16), Time.newInstance(10, 0, 0, 0))
        );
    }

    @IsTest
    static void buscarPorSemana_retornaApontamentosDaSemana() {
        Test.startTest();
        List<ApontamentoDeHoras__c> resultado = ApontamentoController.buscarPorSemana('2026-06-16');
        Test.stopTest();

        System.assertEquals(1, resultado.size(), 'Deveria retornar o apontamento da semana.');
        System.assertEquals('Reuniao planejamento', resultado[0].Name);
    }

    @IsTest
    static void buscarPorSemana_foraDoIntervalo_retornaVazio() {
        Test.startTest();
        List<ApontamentoDeHoras__c> resultado = ApontamentoController.buscarPorSemana('2026-06-23');
        Test.stopTest();

        System.assertEquals(0, resultado.size(), 'Nao deve retornar apontamentos de outras semanas.');
    }

    @IsTest
    static void apontamentoDTO_cobreInstanciacao() {
        ApontamentoDTO dto        = new ApontamentoDTO();
        dto.name                  = 'DTO Teste';
        dto.ownerId               = UserInfo.getUserId();
        dto.inicio                = Datetime.now();
        dto.fim                   = Datetime.now().addHours(1);
        dto.duracaoHoras          = 1.0;
        dto.observacoes           = 'Observacao de teste';
        dto.projeto               = null;
        dto.perfilDeAlocacao      = null;

        System.assertEquals('DTO Teste', dto.name);
        System.assertEquals(1.0, dto.duracaoHoras);
    }
}
