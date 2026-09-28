@IsTest
private class CaseSLATriggerHandlerTest {
    @IsTest
    static void criaCaseComPrazoDeAtendimento() {
        Case caseRecord = baseCase('New', 'P0');

        Test.startTest();
        insert caseRecord;
        Test.stopTest();

        Case dbCase = [
            SELECT
                SLAAtendimentoPrazo__c,
                SLATrabalhoPrazo__c,
                SLAAtendimentoViolado__c,
                SLAAtendimentoTempoRestanteUtilHoras__c,
                SLATempoRestanteUtilHoras__c
            FROM Case
            WHERE Id = :caseRecord.Id
        ];

        System.assertNotEquals(null, dbCase.SLAAtendimentoPrazo__c);
        System.assertEquals(null, dbCase.SLATrabalhoPrazo__c);
        System.assertEquals(false, dbCase.SLAAtendimentoViolado__c);
        System.assertEquals(Decimal.valueOf(2), dbCase.SLAAtendimentoTempoRestanteUtilHoras__c);
        System.assertEquals(Decimal.valueOf(2), dbCase.SLATempoRestanteUtilHoras__c);
    }

    @IsTest
    static void entradaEmTrabalhoPreencheMarcos() {
        Case caseRecord = baseCase('New', 'P1');
        insert caseRecord;

        Test.startTest();
        caseRecord.Status = 'Working';
        update caseRecord;
        Test.stopTest();

        Case dbCase = [
            SELECT
                PrimeiroAtendimentoEm__c,
                InicioTrabalhoSLA__c,
                SLATrabalhoPrazo__c,
                SLAAtendimentoTempoRestanteUtilHoras__c,
                SLATrabalhoTempoRestanteUtilHoras__c,
                SLATempoRestanteUtilHoras__c
            FROM Case
            WHERE Id = :caseRecord.Id
        ];

        System.assertNotEquals(null, dbCase.PrimeiroAtendimentoEm__c);
        System.assertNotEquals(null, dbCase.InicioTrabalhoSLA__c);
        System.assertNotEquals(null, dbCase.SLATrabalhoPrazo__c);
        System.assertEquals(Decimal.valueOf(0), dbCase.SLAAtendimentoTempoRestanteUtilHoras__c);
        System.assertEquals(Decimal.valueOf(16), dbCase.SLATrabalhoTempoRestanteUtilHoras__c);
        System.assertEquals(Decimal.valueOf(16), dbCase.SLATempoRestanteUtilHoras__c);
    }

    @IsTest
    static void resolucaoPreencheFimDoTrabalho() {
        Case caseRecord = baseCase('Working', 'P2');
        insert caseRecord;

        Test.startTest();
        caseRecord.Status = 'Closed';
        update caseRecord;
        Test.stopTest();

        Case dbCase = [
            SELECT FimTrabalhoSLA__c
            FROM Case
            WHERE Id = :caseRecord.Id
        ];

        System.assertNotEquals(null, dbCase.FimTrabalhoSLA__c);
    }

    @IsTest
    static void pausaMarcaCaseComoPausado() {
        Case pausedCase = baseCase('Aguardando Cliente', 'P3');

        Test.startTest();
        CaseSLATriggerHandler.beforeInsert(new List<Case>{ pausedCase });
        Test.stopTest();

        System.assertEquals(true, pausedCase.IsStopped);
        System.assertNotEquals(null, pausedCase.InicioPausaSLA__c);
        System.assertNotEquals(null, pausedCase.SLAAtendimentoPrazo__c);
        System.assertEquals(Decimal.valueOf(2), pausedCase.SLATempoRestanteUtilHoras__c);
    }

    @IsTest
    static void retornoDePausaLimpaMarcador() {
        Case insertedCase = baseCase('Working', 'P4');
        insert insertedCase;

        Case oldCase = insertedCase.clone(true, true, true, true);
        oldCase.Status = 'Aguardando Terceiro';

        Case newCase = insertedCase.clone(true, true, true, true);
        newCase.Status = 'Working';
        newCase.InicioPausaSLA__c = System.now().addHours(-1);
        newCase.SLATrabalhoPrazo__c = System.now().addHours(40);

        Test.startTest();
        CaseSLATriggerHandler.beforeUpdate(
            new List<Case>{ newCase },
            new Map<Id, Case>{ oldCase.Id => oldCase }
        );
        Test.stopTest();

        System.assertEquals(false, newCase.IsStopped);
        System.assertEquals(null, newCase.InicioPausaSLA__c);
        System.assertNotEquals(null, newCase.InicioTrabalhoSLA__c);
    }

    @IsTest
    static void cobrePrioridadesDeTrabalhoRestantes() {
        List<Case> caseRecords = new List<Case>{
            baseCase('Working', 'P0'),
            baseCase('Working', 'P1'),
            baseCase('Working', 'P3'),
            baseCase('Working', 'P4'),
            baseCase('Working', null)
        };

        Test.startTest();
        CaseSLATriggerHandler.beforeInsert(caseRecords);
        Test.stopTest();

        for (Case caseRecord : caseRecords) {
            System.assertNotEquals(null, caseRecord.SLATrabalhoPrazo__c);
        }
    }

    @IsTest
    static void schedulerAtualizaCasesAbertos() {
        Case caseRecord = baseCase('New', 'P0');
        insert caseRecord;

        Test.startTest();
        new CaseSLATempoRestanteScheduler().execute(null);
        Test.stopTest();

        Case dbCase = [
            SELECT SLATempoRestanteUtilHoras__c
            FROM Case
            WHERE Id = :caseRecord.Id
        ];
        System.assertEquals(Decimal.valueOf(2), dbCase.SLATempoRestanteUtilHoras__c);
    }

    private static Case baseCase(String statusValue, String prioridadeSla) {
        return new Case(
            Subject = 'Teste SLA',
            Origin = 'Phone',
            Status = statusValue,
            PrioridadeSLA__c = prioridadeSla
        );
    }
}