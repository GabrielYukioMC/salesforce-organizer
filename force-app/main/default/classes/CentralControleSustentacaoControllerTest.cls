@IsTest
private class CentralControleSustentacaoControllerTest {
    @IsTest
    static void retornaDashboardDaCentral() {
        Case newCase = new Case(
            Subject = 'Central Sustentacao New',
            Origin = 'Phone',
            Status = 'New',
            PrioridadeSLA__c = 'P0'
        );
        Case workingCase = new Case(
            Subject = 'Central Sustentacao Working',
            Origin = 'Phone',
            Status = 'Working',
            PrioridadeSLA__c = 'P1'
        );
        Case homologationCase = new Case(
            Subject = 'Central Sustentacao Homologacao',
            Origin = 'Phone',
            Status = 'Working',
            PrioridadeSLA__c = 'P2'
        );
        insert new List<Case>{ newCase, workingCase, homologationCase };

        homologationCase.Status = 'Disponivel Homologacao';
        update homologationCase;

        Date today = Date.today();
        Date monthStart = Date.newInstance(today.year(), today.month(), 1);

        Test.startTest();
        CentralControleSustentacaoController.DashboardDTO dashboard =
            CentralControleSustentacaoController.getDashboard(
                String.valueOf(monthStart),
                String.valueOf(today)
            );
        Test.stopTest();

        System.assertNotEquals(null, dashboard);
        System.assertNotEquals(null, dashboard.summary);
        System.assert(dashboard.summary.openedCases >= 2);
        System.assert(dashboard.summary.workingCases >= 1);

        Set<Id> newCaseIds = new Set<Id>();
        for (CentralControleSustentacaoController.CaseSlaRowDTO row : dashboard.newCases) {
            newCaseIds.add(row.id);
            System.assertEquals('New', row.status);
            System.assertEquals('Atendimento', row.slaType);
            System.assertNotEquals(null, row.percentUsed);
        }

        Set<Id> openCaseIds = new Set<Id>();
        for (CentralControleSustentacaoController.CaseSlaRowDTO row : dashboard.openCases) {
            openCaseIds.add(row.id);
            System.assertEquals('Trabalho', row.slaType);
            System.assertNotEquals(null, row.workStartedAt);
        }

        Set<Id> homologationCaseIds = new Set<Id>();
        for (CentralControleSustentacaoController.CaseSlaRowDTO row : dashboard.homologationCases) {
            homologationCaseIds.add(row.id);
            System.assertEquals('Disponivel Homologacao', row.status);
            System.assertEquals(true, row.paused);
        }

        System.assert(newCaseIds.contains(newCase.Id));
        System.assert(openCaseIds.contains(workingCase.Id));
        System.assert(homologationCaseIds.contains(homologationCase.Id));
    }
}