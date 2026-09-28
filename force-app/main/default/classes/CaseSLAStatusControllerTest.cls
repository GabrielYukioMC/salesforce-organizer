@IsTest
private class CaseSLAStatusControllerTest {
    @IsTest
    static void retornaSlaDeAtendimentoAtivo() {
        Case caseRecord = new Case(
            Subject = 'LWC SLA Atendimento',
            Origin = 'Phone',
            Status = 'New',
            PrioridadeSLA__c = 'P0'
        );
        insert caseRecord;

        Test.startTest();
        CaseSLAStatusController.CaseSLAStatusDTO dto = CaseSLAStatusController.getStatus(caseRecord.Id);
        Test.stopTest();

        System.assertEquals('P0', dto.priority);
        System.assertEquals(Decimal.valueOf(2), dto.attendanceTotalHours);
        System.assert(dto.activeRemainingHours > Decimal.valueOf('1.95'));
        System.assert(dto.activeRemainingHours <= Decimal.valueOf('2'));
        System.assertEquals(Decimal.valueOf(0), dto.activeOverdueHours);
        System.assertEquals(0, dto.activePercentUsed);
        System.assertEquals(false, dto.closed);
    }

    @IsTest
    static void retornaSlaDeTrabalhoAtivo() {
        Case caseRecord = new Case(
            Subject = 'LWC SLA Trabalho',
            Origin = 'Phone',
            Status = 'Working',
            PrioridadeSLA__c = 'P1'
        );
        insert caseRecord;

        Test.startTest();
        CaseSLAStatusController.CaseSLAStatusDTO dto = CaseSLAStatusController.getStatus(caseRecord.Id);
        Test.stopTest();

        System.assertEquals('P1', dto.priority);
        System.assertEquals(Decimal.valueOf(16), dto.workTotalHours);
        System.assert(dto.activeRemainingHours > Decimal.valueOf('15.95'));
        System.assert(dto.activeRemainingHours <= Decimal.valueOf('16'));
        System.assertEquals(dto.workRemainingHours, dto.activeRemainingHours);
        System.assertEquals(null, dto.workElapsedHours);
        System.assertNotEquals(null, dto.workStartedAt);
    }

    @IsTest
    static void retornaTempoVencidoQuandoPrazoPassou() {
        Case caseRecord = new Case(
            Subject = 'LWC SLA Vencido',
            Origin = 'Phone',
            Status = 'New',
            PrioridadeSLA__c = 'P0',
            SLAAtendimentoPrazo__c = System.now().addHours(-3),
            SLAAtendimentoViolado__c = true
        );
        insert caseRecord;

        Test.startTest();
        CaseSLAStatusController.CaseSLAStatusDTO dto = CaseSLAStatusController.getStatus(caseRecord.Id);
        Test.stopTest();

        System.assertEquals(true, dto.attendanceViolated);
        System.assert(dto.activeOverdueHours >= Decimal.valueOf('2.9'));
        System.assertEquals(dto.attendanceOverdueHours, dto.activeOverdueHours);
        System.assertEquals(0, dto.activeRemainingHours);
    }

    @IsTest
    static void retornaTempoUsadoQuandoConcluidoDentroDoPrazo() {
        Case caseRecord = new Case(
            Subject = 'LWC SLA Concluido',
            Origin = 'Phone',
            Status = 'Working',
            PrioridadeSLA__c = 'P0'
        );
        insert caseRecord;

        caseRecord = [
            SELECT
                Id,
                CreatedDate,
                PrimeiroAtendimentoEm__c,
                InicioTrabalhoSLA__c,
                SLATrabalhoPrazo__c
            FROM Case
            WHERE Id = :caseRecord.Id
        ];
        caseRecord.PrimeiroAtendimentoEm__c = System.now();
        caseRecord.InicioTrabalhoSLA__c = System.now();
        caseRecord.FimTrabalhoSLA__c = System.now().addMinutes(30);
        caseRecord.SLATrabalhoPrazo__c = System.now().addHours(8);
        caseRecord.SLATrabalhoViolado__c = false;
        update caseRecord;

        Test.startTest();
        CaseSLAStatusController.CaseSLAStatusDTO dto = CaseSLAStatusController.getStatus(caseRecord.Id);
        Test.stopTest();

        System.assertEquals(false, dto.workViolated);
        System.assert(dto.attendanceElapsedHours >= 0);
        System.assert(dto.workElapsedHours >= 0);
    }
}