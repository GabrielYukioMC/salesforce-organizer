@IsTest
private class ApontamentoBuilderTest {

    // UTC: 12:00 = 09:00 BRT | 21:00 = 18:00 BRT
    private static final Datetime DIA_INI = Datetime.newInstanceGmt(2026, 6, 16, 12, 0, 0);
    private static final Datetime DIA_FIM = Datetime.newInstanceGmt(2026, 6, 16, 21, 0, 0);

    private static Tarefa__c novaT(String nome, Datetime inicio, Datetime fim) {
        return new Tarefa__c(
            Name                   = nome,
            InicioTarefa__c        = inicio,
            FimTarefa__c           = fim,
            UsuarioProprietario__c = UserInfo.getUserId(),
            Descricao__c           = 'desc'
        );
    }

    // ── arredondar ────────────────────────────────────────────────────────────

    @IsTest
    static void arredondar_minutosAte15_arredondaParaHora() {
        Datetime resultado = ApontamentoBuilder.arredondar(
            Datetime.newInstanceGmt(2026, 6, 16, 12, 10, 0)
        );
        System.assertEquals(Datetime.newInstanceGmt(2026, 6, 16, 12, 0, 0), resultado);
    }

    @IsTest
    static void arredondar_minutos16a39_arredondaParaMeiaHora() {
        Datetime resultado = ApontamentoBuilder.arredondar(
            Datetime.newInstanceGmt(2026, 6, 16, 12, 25, 0)
        );
        System.assertEquals(Datetime.newInstanceGmt(2026, 6, 16, 12, 30, 0), resultado);
    }

    @IsTest
    static void arredondar_minutosAcimaDe39_arredondaParaProximaHora() {
        Datetime resultado = ApontamentoBuilder.arredondar(
            Datetime.newInstanceGmt(2026, 6, 16, 12, 45, 0)
        );
        System.assertEquals(Datetime.newInstanceGmt(2026, 6, 16, 13, 0, 0), resultado);
    }

    // ── calcularDuracao ───────────────────────────────────────────────────────

    @IsTest
    static void calcularDuracao_umaHora_retornaUm() {
        Decimal d = ApontamentoBuilder.calcularDuracao(
            Datetime.newInstanceGmt(2026, 6, 16, 12, 0, 0),
            Datetime.newInstanceGmt(2026, 6, 16, 13, 0, 0)
        );
        System.assertEquals(1.0, d);
    }

    // ── buildFromTarefa ───────────────────────────────────────────────────────

    @IsTest
    static void buildFromTarefa_comDatas_geraDTO() {
        Test.startTest();
        ApontamentoDTO dto = ApontamentoBuilder.buildFromTarefa(novaT('Tarefa X', DIA_INI, DIA_FIM));
        Test.stopTest();

        System.assertEquals('Tarefa X', dto.name);
        System.assertEquals(UserInfo.getUserId(), dto.ownerId);
        System.assert(dto.duracaoHoras > 0);
        System.assertEquals('desc', dto.observacoes);
    }

    @IsTest
    static void buildFromTarefa_semDatas_usaFallback() {
        Tarefa__c t = new Tarefa__c(
            Name                   = 'Sem Data',
            UsuarioProprietario__c = UserInfo.getUserId()
        );

        Test.startTest();
        ApontamentoDTO dto = ApontamentoBuilder.buildFromTarefa(t);
        Test.stopTest();

        System.assertEquals('Sem Data', dto.name);
        System.assertNotEquals(null, dto.inicio);
    }

    // ── buildSObjectsFromTarefa ───────────────────────────────────────────────

    @IsTest
    static void buildSObjects_diaUnico_semExistentes_geraUmSegmento() {
        Test.startTest();
        List<ApontamentoDeHoras__c> r = ApontamentoBuilder.buildSObjectsFromTarefa(
            novaT('Reuniao', DIA_INI, DIA_FIM)
        );
        Test.stopTest();

        System.assertEquals(1, r.size());
        System.assertEquals('Reuniao', r[0].Name);
        System.assertEquals(DIA_INI, r[0].Inicio__c);
        System.assertEquals(DIA_FIM, r[0].Fim__c);
    }

    @IsTest
    static void buildSObjects_comExistenteMeio_geraDoisSlotsLivres() {
        // Existente ocupa 13:00–15:00 UTC (10:00–12:00 BRT)
        ApontamentoDeHoras__c ex = new ApontamentoDeHoras__c(
            Inicio__c = Datetime.newInstanceGmt(2026, 6, 16, 13, 0, 0),
            Fim__c    = Datetime.newInstanceGmt(2026, 6, 16, 15, 0, 0)
        );

        Test.startTest();
        List<ApontamentoDeHoras__c> r = ApontamentoBuilder.buildSObjectsFromTarefa(
            novaT('Task', DIA_INI, DIA_FIM),
            new List<ApontamentoDeHoras__c>{ ex }
        );
        Test.stopTest();

        System.assertEquals(2, r.size());
    }

    @IsTest
    static void buildSObjects_comProjetoEPerfil_preenchePerfilDeAlocacao() {
        Tarefa__c t = novaT('Com Perfil', DIA_INI, DIA_FIM);
        t.Projeto__r = new Projeto__c(Id_Perfil_Alocacao_Elera__c = 'PERFIL-ABC');

        Test.startTest();
        List<ApontamentoDeHoras__c> r = ApontamentoBuilder.buildSObjectsFromTarefa(t);
        Test.stopTest();

        System.assertEquals(1, r.size());
        System.assertEquals('PERFIL-ABC', r[0].PerfilDeAlocacao__c);
    }

    @IsTest
    static void buildSObjects_multiDia_geraSegmentoPorDia() {
        // 2026-06-16 09:00 BRT até 2026-06-17 18:00 BRT
        Datetime inicio = Datetime.newInstanceGmt(2026, 6, 16, 12, 0, 0);
        Datetime fim    = Datetime.newInstanceGmt(2026, 6, 17, 21, 0, 0);

        Test.startTest();
        List<ApontamentoDeHoras__c> r = ApontamentoBuilder.buildSObjectsFromTarefa(
            novaT('Multi', inicio, fim)
        );
        Test.stopTest();

        System.assertEquals(2, r.size());
    }

    // ── calcularSlotsLivres ───────────────────────────────────────────────────

    @IsTest
    static void calcularSlots_semExistentes_retornaSlotCompleto() {
        Datetime ini = Datetime.newInstanceGmt(2026, 6, 16, 12, 0, 0);
        Datetime fim = Datetime.newInstanceGmt(2026, 6, 16, 14, 0, 0);

        List<Datetime[]> slots = ApontamentoBuilder.calcularSlotsLivres(
            ini, fim, new List<ApontamentoDeHoras__c>()
        );

        System.assertEquals(1, slots.size());
        System.assertEquals(ini, slots[0][0]);
        System.assertEquals(fim, slots[0][1]);
    }

    @IsTest
    static void calcularSlots_sobreposicaoTotal_retornaVazio() {
        Datetime ini = Datetime.newInstanceGmt(2026, 6, 16, 12, 0, 0);
        Datetime fim = Datetime.newInstanceGmt(2026, 6, 16, 14, 0, 0);

        ApontamentoDeHoras__c ex = new ApontamentoDeHoras__c(
            Inicio__c = Datetime.newInstanceGmt(2026, 6, 16, 11, 0, 0),
            Fim__c    = Datetime.newInstanceGmt(2026, 6, 16, 15, 0, 0)
        );

        List<Datetime[]> slots = ApontamentoBuilder.calcularSlotsLivres(
            ini, fim, new List<ApontamentoDeHoras__c>{ ex }
        );

        System.assertEquals(0, slots.size());
    }

    @IsTest
    static void calcularSlots_multiplosExistentes_ordenaESubtrai() {
        Datetime ini = Datetime.newInstanceGmt(2026, 6, 16, 12, 0, 0);
        Datetime fim = Datetime.newInstanceGmt(2026, 6, 16, 17, 0, 0);

        // Propositalmente fora de ordem para exercitar o bubble sort
        ApontamentoDeHoras__c ap1 = new ApontamentoDeHoras__c(
            Inicio__c = Datetime.newInstanceGmt(2026, 6, 16, 14, 0, 0),
            Fim__c    = Datetime.newInstanceGmt(2026, 6, 16, 15, 0, 0)
        );
        ApontamentoDeHoras__c ap2 = new ApontamentoDeHoras__c(
            Inicio__c = Datetime.newInstanceGmt(2026, 6, 16, 13, 0, 0),
            Fim__c    = Datetime.newInstanceGmt(2026, 6, 16, 13, 30, 0)
        );

        List<Datetime[]> slots = ApontamentoBuilder.calcularSlotsLivres(
            ini, fim, new List<ApontamentoDeHoras__c>{ ap1, ap2 }
        );

        // Livre: 12:00-13:00, 13:30-14:00, 15:00-17:00
        System.assertEquals(3, slots.size());
    }

    // ── toJSON ────────────────────────────────────────────────────────────────

    @IsTest
    static void toJSON_serializa_retornaStringComNome() {
        ApontamentoDTO dto = new ApontamentoDTO();
        dto.name  = 'JSON Test';
        dto.inicio = Datetime.now();
        dto.fim    = Datetime.now().addHours(1);

        Test.startTest();
        String json = ApontamentoBuilder.toJSON(dto);
        Test.stopTest();

        System.assert(json.contains('JSON Test'), 'JSON deve conter o nome do apontamento.');
    }
}
