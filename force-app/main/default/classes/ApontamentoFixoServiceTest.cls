@IsTest
private class ApontamentoFixoServiceTest {

    // ── Helpers ──────────────────────────────────────────────────────────

    private static Datetime dt(Integer ano, Integer mes, Integer dia, Integer hora, Integer min) {
        // Cria datetime UTC diretamente para os testes
        return Datetime.newInstanceGmt(ano, mes, dia, hora, min, 0);
    }

    private static ApontamentoDeHoras__c ap(Datetime ini, Datetime fim) {
        return new ApontamentoDeHoras__c(
            Name      = 'Teste',
            Inicio__c = ini,
            Fim__c    = fim
        );
    }

    // ── parseHHMM ────────────────────────────────────────────────────────

    @IsTest
    static void parseHHMM_valido() {
        Integer[] r1 = ApontamentoFixoService.parseHHMM('09:00');
        Integer[] r2 = ApontamentoFixoService.parseHHMM('11:30');
        System.assertEquals(9,  r1[0]);
        System.assertEquals(0,  r1[1]);
        System.assertEquals(11, r2[0]);
        System.assertEquals(30, r2[1]);
    }

    @IsTest
    static void parseHHMM_formatoInvalido_lancaExcecao() {
        Boolean lancou = false;
        try {
            ApontamentoFixoService.parseHHMM('9');
        } catch (AuraHandledException e) {
            lancou = true;
        }
        System.assert(lancou, 'Deveria ter lançado AuraHandledException para formato inválido');
    }

    @IsTest
    static void parseHHMM_horaForaDoRange() {
        Boolean lancou = false;
        try {
            ApontamentoFixoService.parseHHMM('25:00');
        } catch (AuraHandledException e) {
            lancou = true;
        }
        System.assert(lancou, 'Deveria ter lançado AuraHandledException para hora > 23');
    }

    // ── salvarRotina — validações ────────────────────────────────────────

    @IsTest
    static void salvarRotina_semNome_lancaExcecao() {
        ApontamentoFixo__c r = new ApontamentoFixo__c(
            DiaDaSemana__c = 'Seg',
            HoraInicio__c  = '09:00',
            HoraFim__c     = '10:00'
        );
        Boolean lancou = false;
        try {
            ApontamentoFixoService.salvarRotina(r);
        } catch (AuraHandledException e) {
            lancou = true;
        }
        System.assert(lancou, 'Deveria exigir nome');
    }

    @IsTest
    static void salvarRotina_semDia_lancaExcecao() {
        ApontamentoFixo__c r = new ApontamentoFixo__c(
            Name           = 'Daily',
            HoraInicio__c  = '09:00',
            HoraFim__c     = '10:00'
        );
        Boolean lancou = false;
        try {
            ApontamentoFixoService.salvarRotina(r);
        } catch (AuraHandledException e) {
            lancou = true;
        }
        System.assert(lancou, 'Deveria exigir dia da semana');
    }

    @IsTest
    static void salvarRotina_fimMenorQueInicio_lancaExcecao() {
        ApontamentoFixo__c r = new ApontamentoFixo__c(
            Name           = 'Daily',
            DiaDaSemana__c = 'Seg',
            HoraInicio__c  = '10:00',
            HoraFim__c     = '09:00'
        );
        Boolean lancou = false;
        try {
            ApontamentoFixoService.salvarRotina(r);
        } catch (AuraHandledException e) {
            lancou = true;
        }
        System.assert(lancou, 'Deveria rejeitar fim <= início');
    }

    @IsTest
    static void salvarRotina_duracaoAbaixoDoMinimo_lancaExcecao() {
        ApontamentoFixo__c r = new ApontamentoFixo__c(
            Name           = 'Daily',
            DiaDaSemana__c = 'Seg',
            HoraInicio__c  = '09:00',
            HoraFim__c     = '09:10'
        );
        Boolean lancou = false;
        try {
            ApontamentoFixoService.salvarRotina(r);
        } catch (AuraHandledException e) {
            lancou = true;
        }
        System.assert(lancou, 'Deveria rejeitar duração < 15 min');
    }

    @IsTest
    static void salvarRotina_valido_insereSemErro() {
        ApontamentoFixo__c r = new ApontamentoFixo__c(
            Name           = 'Daily',
            DiaDaSemana__c = 'Seg',
            HoraInicio__c  = '11:00',
            HoraFim__c     = '11:30'
        );
        Test.startTest();
        ApontamentoFixoService.salvarRotina(r);
        Test.stopTest();
        List<ApontamentoFixo__c> inseridos = [SELECT Id FROM ApontamentoFixo__c WHERE Name = 'Daily'];
        System.assertEquals(1, inseridos.size());
    }

    // ── abaixoDoMinimo ───────────────────────────────────────────────────

    @IsTest
    static void abaixoDoMinimo_menosde15min_retornaTrue() {
        Datetime ini = dt(2026,3,25,12,0);
        Datetime fim = dt(2026,3,25,12,10);
        System.assert(ApontamentoFixoService.abaixoDoMinimo(ini, fim));
    }

    @IsTest
    static void abaixoDoMinimo_exato15min_retornaFalse() {
        Datetime ini = dt(2026,3,25,12,0);
        Datetime fim = dt(2026,3,25,12,15);
        System.assert(!ApontamentoFixoService.abaixoDoMinimo(ini, fim));
    }

    // ── resolverSobreposicoes ────────────────────────────────────────────

    // Caso 0: sem sobreposição — E não é tocado
    @IsTest
    static void sobreposicao_caso0_semSobreposicao() {
        insert ap(dt(2026,3,25,9,0), dt(2026,3,25,10,0));
        ApontamentoDeHoras__c e = [SELECT Id,Name,Inicio__c,Fim__c,Projeto__c,PerfilDeAlocacao__c,Observacoes__c FROM ApontamentoDeHoras__c LIMIT 1];

        Map<Id,ApontamentoDeHoras__c> toUpdate = new Map<Id,ApontamentoDeHoras__c>();
        Set<Id> toDelete = new Set<Id>();
        List<ApontamentoDeHoras__c> toInsert = new List<ApontamentoDeHoras__c>();

        // F é DEPOIS de E → sem sobreposição
        ApontamentoFixoService.resolverSobreposicoes(
            dt(2026,3,25,11,0), dt(2026,3,25,12,0),
            new List<ApontamentoDeHoras__c>{ e },
            toUpdate, toDelete, toInsert
        );

        System.assertEquals(0, toUpdate.size());
        System.assertEquals(0, toDelete.size());
        System.assertEquals(0, toInsert.size());
    }

    // Caso 1: F contém E inteiro → E deve ser deletado
    @IsTest
    static void sobreposicao_caso1_FcontemE() {
        insert ap(dt(2026,3,25,10,0), dt(2026,3,25,11,0));
        ApontamentoDeHoras__c e = [SELECT Id,Name,Inicio__c,Fim__c,Projeto__c,PerfilDeAlocacao__c,Observacoes__c FROM ApontamentoDeHoras__c LIMIT 1];

        Map<Id,ApontamentoDeHoras__c> toUpdate = new Map<Id,ApontamentoDeHoras__c>();
        Set<Id> toDelete = new Set<Id>();
        List<ApontamentoDeHoras__c> toInsert = new List<ApontamentoDeHoras__c>();

        ApontamentoFixoService.resolverSobreposicoes(
            dt(2026,3,25,9,0), dt(2026,3,25,12,0),
            new List<ApontamentoDeHoras__c>{ e },
            toUpdate, toDelete, toInsert
        );

        System.assert(toDelete.contains(e.Id), 'E deveria estar na lista de delete');
    }

    // Caso 2: F corta início de E → E.Inicio avança para fFim
    @IsTest
    static void sobreposicao_caso2_FCortaInicioDeE() {
        insert ap(dt(2026,3,25,10,0), dt(2026,3,25,13,0));
        ApontamentoDeHoras__c e = [SELECT Id,Name,Inicio__c,Fim__c,Projeto__c,PerfilDeAlocacao__c,Observacoes__c FROM ApontamentoDeHoras__c LIMIT 1];

        Map<Id,ApontamentoDeHoras__c> toUpdate = new Map<Id,ApontamentoDeHoras__c>();
        Set<Id> toDelete = new Set<Id>();
        List<ApontamentoDeHoras__c> toInsert = new List<ApontamentoDeHoras__c>();

        // F: [09:00–11:00] — corta início de E [10:00–13:00]
        ApontamentoFixoService.resolverSobreposicoes(
            dt(2026,3,25,9,0), dt(2026,3,25,11,0),
            new List<ApontamentoDeHoras__c>{ e },
            toUpdate, toDelete, toInsert
        );

        System.assert(toUpdate.containsKey(e.Id), 'E deveria estar no toUpdate');
        System.assertEquals(dt(2026,3,25,11,0), toUpdate.get(e.Id).Inicio__c, 'E.Inicio deveria ser fFim');
    }

    // Caso 3: F corta fim de E → E.Fim recua para fIni
    @IsTest
    static void sobreposicao_caso3_FCortaFimDeE() {
        insert ap(dt(2026,3,25,9,0), dt(2026,3,25,12,0));
        ApontamentoDeHoras__c e = [SELECT Id,Name,Inicio__c,Fim__c,Projeto__c,PerfilDeAlocacao__c,Observacoes__c FROM ApontamentoDeHoras__c LIMIT 1];

        Map<Id,ApontamentoDeHoras__c> toUpdate = new Map<Id,ApontamentoDeHoras__c>();
        Set<Id> toDelete = new Set<Id>();
        List<ApontamentoDeHoras__c> toInsert = new List<ApontamentoDeHoras__c>();

        // F: [11:00–13:00] — corta fim de E [09:00–12:00]
        ApontamentoFixoService.resolverSobreposicoes(
            dt(2026,3,25,11,0), dt(2026,3,25,13,0),
            new List<ApontamentoDeHoras__c>{ e },
            toUpdate, toDelete, toInsert
        );

        System.assert(toUpdate.containsKey(e.Id), 'E deveria estar no toUpdate');
        System.assertEquals(dt(2026,3,25,11,0), toUpdate.get(e.Id).Fim__c, 'E.Fim deveria ser fIni');
    }

    // Caso 4: E contém F inteiro → E partido em dois
    @IsTest
    static void sobreposicao_caso4_EcontemF() {
        insert ap(dt(2026,3,25,9,0), dt(2026,3,25,13,0));
        ApontamentoDeHoras__c e = [SELECT Id,Name,Inicio__c,Fim__c,Projeto__c,PerfilDeAlocacao__c,Observacoes__c FROM ApontamentoDeHoras__c LIMIT 1];

        Map<Id,ApontamentoDeHoras__c> toUpdate = new Map<Id,ApontamentoDeHoras__c>();
        Set<Id> toDelete = new Set<Id>();
        List<ApontamentoDeHoras__c> toInsert = new List<ApontamentoDeHoras__c>();

        // F: [11:00–11:30] — dentro de E [09:00–13:00]
        ApontamentoFixoService.resolverSobreposicoes(
            dt(2026,3,25,11,0), dt(2026,3,25,11,30),
            new List<ApontamentoDeHoras__c>{ e },
            toUpdate, toDelete, toInsert
        );

        System.assert(toUpdate.containsKey(e.Id), 'Lado esquerdo: E deveria estar no toUpdate');
        System.assertEquals(dt(2026,3,25,11,0), toUpdate.get(e.Id).Fim__c, 'E.Fim deveria ser fIni');
        System.assertEquals(1, toInsert.size(), 'Deveria ter criado segmento direito (E2)');
        System.assertEquals(dt(2026,3,25,11,30), toInsert[0].Inicio__c);
        System.assertEquals(dt(2026,3,25,13,0),  toInsert[0].Fim__c);
    }

    // Guard: remanescente < 15 min → deletar em vez de atualizar
    @IsTest
    static void sobreposicao_guardMinimo_deleteEmVezDeUpdate() {
        // E: 11:00–11:10 (10 min) — bem pequeno
        insert ap(dt(2026,3,25,11,0), dt(2026,3,25,11,10));
        ApontamentoDeHoras__c e = [SELECT Id,Name,Inicio__c,Fim__c,Projeto__c,PerfilDeAlocacao__c,Observacoes__c FROM ApontamentoDeHoras__c LIMIT 1];

        Map<Id,ApontamentoDeHoras__c> toUpdate = new Map<Id,ApontamentoDeHoras__c>();
        Set<Id> toDelete = new Set<Id>();
        List<ApontamentoDeHoras__c> toInsert = new List<ApontamentoDeHoras__c>();

        // F: [11:05–12:00] — corta início de E, deixando 5 min de remanescente
        ApontamentoFixoService.resolverSobreposicoes(
            dt(2026,3,25,10,0), dt(2026,3,25,11,5),
            new List<ApontamentoDeHoras__c>{ e },
            toUpdate, toDelete, toInsert
        );

        System.assert(toDelete.contains(e.Id), 'Remanescente < 15 min deveria ser deletado');
        System.assertEquals(0, toUpdate.size());
    }

    // ── gerarApontamentosSemana end-to-end ───────────────────────────────

    @IsTest
    static void gerarSemana_criaApontamentos() {
        // Rotina: Daily, Qua, 11:00-11:30 (local BRT → UTC +3h = 14:00–14:30)
        ApontamentoFixo__c fixo = new ApontamentoFixo__c(
            Name           = 'Daily',
            DiaDaSemana__c = 'Qua',
            HoraInicio__c  = '11:00',
            HoraFim__c     = '11:30'
        );
        insert fixo;

        // Domingo da semana de 22/03/2026 (semanaInicio agora é sempre domingo)
        String semana = '2026-03-22'; // Domingo

        Test.startTest();
        ApontamentoFixoService.gerarApontamentosSemana(semana);
        Test.stopTest();

        // Qua = offset 2 → 25/03/2026
        // Local 11:00 BRT → UTC 14:00
        Datetime expectedIni = dt(2026, 3, 25, 14, 0);
        Datetime expectedFim = dt(2026, 3, 25, 14, 30);

        List<ApontamentoDeHoras__c> gerados = [
            SELECT Name, Inicio__c, Fim__c
            FROM ApontamentoDeHoras__c
            WHERE Name = 'Daily'
        ];
        System.assertEquals(1, gerados.size(), 'Deveria ter gerado 1 apontamento');
        System.assertEquals(expectedIni, gerados[0].Inicio__c);
        System.assertEquals(expectedFim, gerados[0].Fim__c);
    }

    @IsTest
    static void gerarSemana_particionaApontamentoExistente() {
        // Apontamento existente: Work011 09:00–12:00 BRT na Qua 25/03/2026
        // BRT 09:00 → UTC 12:00 / BRT 12:00 → UTC 15:00
        insert new ApontamentoDeHoras__c(
            Name      = 'Work011',
            Inicio__c = dt(2026, 3, 25, 12, 0),  // 09:00 BRT
            Fim__c    = dt(2026, 3, 25, 15, 0)   // 12:00 BRT
        );

        // Rotina: Daily, Qua, 11:00–11:30 BRT → UTC 14:00–14:30
        insert new ApontamentoFixo__c(
            Name           = 'Daily',
            DiaDaSemana__c = 'Qua',
            HoraInicio__c  = '11:00',
            HoraFim__c     = '11:30'
        );

        Test.startTest();
        ApontamentoFixoService.gerarApontamentosSemana('2026-03-22');
        Test.stopTest();

        // Work011 deve ter sido partido em dois:
        //   Work011 09:00–11:00 BRT (UTC 12:00–14:00)
        //   Work011 11:30–12:00 BRT (UTC 14:30–15:00)
        // + Daily 11:00–11:30 BRT (UTC 14:00–14:30)
        List<ApontamentoDeHoras__c> aps = [
            SELECT Name, Inicio__c, Fim__c
            FROM ApontamentoDeHoras__c
            ORDER BY Inicio__c
        ];

        System.assertEquals(3, aps.size(), 'Deveria ter 3 apontamentos após particionamento');

        System.assertEquals('Work011', aps[0].Name);
        System.assertEquals(dt(2026,3,25,12,0), aps[0].Inicio__c); // 09:00 BRT
        System.assertEquals(dt(2026,3,25,14,0), aps[0].Fim__c);    // 11:00 BRT

        System.assertEquals('Daily', aps[1].Name);
        System.assertEquals(dt(2026,3,25,14,0),  aps[1].Inicio__c);
        System.assertEquals(dt(2026,3,25,14,30), aps[1].Fim__c);

        System.assertEquals('Work011', aps[2].Name);
        System.assertEquals(dt(2026,3,25,14,30), aps[2].Inicio__c); // 11:30 BRT
        System.assertEquals(dt(2026,3,25,15,0),  aps[2].Fim__c);    // 12:00 BRT
    }
}
