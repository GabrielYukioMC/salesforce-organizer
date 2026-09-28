Id businessHoursId = [SELECT Id FROM BusinessHours WHERE IsDefault = true LIMIT 1].Id;

List<Map<String, Object>> scenarios = new List<Map<String, Object>>{
    new Map<String, Object>{
        'subject' => 'TESTE SLA FECHADO OK - P0',
        'priority' => 'P0',
        'openedAt' => Datetime.newInstance(2026, 9, 1, 9, 0, 0),
        'firstResponseAt' => Datetime.newInstance(2026, 9, 1, 9, 20, 0),
        'workStartedAt' => Datetime.newInstance(2026, 9, 1, 9, 30, 0),
        'workFinishedAt' => Datetime.newInstance(2026, 9, 1, 12, 0, 0),
        'workHours' => 8
    },
    new Map<String, Object>{
        'subject' => 'TESTE SLA FECHADO OK - P1',
        'priority' => 'P1',
        'openedAt' => Datetime.newInstance(2026, 9, 1, 10, 0, 0),
        'firstResponseAt' => Datetime.newInstance(2026, 9, 1, 10, 45, 0),
        'workStartedAt' => Datetime.newInstance(2026, 9, 1, 11, 0, 0),
        'workFinishedAt' => Datetime.newInstance(2026, 9, 1, 15, 30, 0),
        'workHours' => 16
    },
    new Map<String, Object>{
        'subject' => 'TESTE SLA FECHADO OK - P2',
        'priority' => 'P2',
        'openedAt' => Datetime.newInstance(2026, 9, 1, 14, 0, 0),
        'firstResponseAt' => Datetime.newInstance(2026, 9, 1, 14, 30, 0),
        'workStartedAt' => Datetime.newInstance(2026, 9, 1, 15, 0, 0),
        'workFinishedAt' => Datetime.newInstance(2026, 9, 2, 11, 0, 0),
        'workHours' => 24
    }
};

List<Case> casesToInsert = new List<Case>();
for (Map<String, Object> scenario : scenarios) {
    Datetime openedAt = (Datetime) scenario.get('openedAt');
    Datetime firstResponseAt = (Datetime) scenario.get('firstResponseAt');
    Datetime workStartedAt = (Datetime) scenario.get('workStartedAt');
    Datetime workFinishedAt = (Datetime) scenario.get('workFinishedAt');
    Integer workHours = (Integer) scenario.get('workHours');

    casesToInsert.add(new Case(
        Subject = (String) scenario.get('subject'),
        Origin = 'Phone',
        Status = 'Closed',
        PrioridadeSLA__c = (String) scenario.get('priority'),
        Description = 'Case fechado de teste com atendimento e trabalho dentro do SLA. Datas de SLA simuladas nos campos customizados.',
        PrimeiroAtendimentoEm__c = firstResponseAt,
        InicioTrabalhoSLA__c = workStartedAt,
        FimTrabalhoSLA__c = workFinishedAt,
        SLAAtendimentoPrazo__c = BusinessHours.add(businessHoursId, openedAt, 2 * 60 * 60 * 1000),
        SLATrabalhoPrazo__c = BusinessHours.add(businessHoursId, workStartedAt, workHours * 60 * 60 * 1000),
        SLAAtendimentoViolado__c = false,
        SLATrabalhoViolado__c = false,
        SLAAtendimentoTempoRestanteUtilHoras__c = 0,
        SLATrabalhoTempoRestanteUtilHoras__c = 0,
        SLATempoRestanteUtilHoras__c = 0
    ));
}

insert casesToInsert;

for (Case caseRecord : [
    SELECT
        Id,
        CaseNumber,
        Subject,
        Status,
        PrioridadeSLA__c,
        PrimeiroAtendimentoEm__c,
        InicioTrabalhoSLA__c,
        FimTrabalhoSLA__c,
        SLAAtendimentoViolado__c,
        SLATrabalhoViolado__c
    FROM Case
    WHERE Id IN :casesToInsert
    ORDER BY CaseNumber
]) {
    System.debug(
        'CASE_FECHADO_OK|' +
        caseRecord.Id + '|' +
        caseRecord.CaseNumber + '|' +
        caseRecord.Status + '|' +
        caseRecord.PrioridadeSLA__c + '|' +
        caseRecord.PrimeiroAtendimentoEm__c + '|' +
        caseRecord.InicioTrabalhoSLA__c + '|' +
        caseRecord.FimTrabalhoSLA__c + '|' +
        caseRecord.SLAAtendimentoViolado__c + '|' +
        caseRecord.SLATrabalhoViolado__c + '|' +
        caseRecord.Subject
    );
}
