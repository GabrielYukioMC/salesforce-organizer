Id businessHoursId = [SELECT Id FROM BusinessHours WHERE IsDefault = true LIMIT 1].Id;
Datetime openedAt = Datetime.newInstance(2026, 9, 1, 9, 0, 0);
Datetime firstResponseAt = Datetime.newInstance(2026, 9, 1, 9, 20, 0);
Datetime workStartedAt = Datetime.newInstance(2026, 9, 1, 9, 30, 0);
Datetime workFinishedAt = Datetime.newInstance(2026, 9, 1, 11, 0, 0);
Datetime attendanceDeadline = BusinessHours.add(businessHoursId, openedAt, 2 * 60 * 60 * 1000);
Datetime workDeadline = BusinessHours.add(businessHoursId, workStartedAt, 8 * 60 * 60 * 1000);

Case caseRecord = new Case(
    Subject = 'TESTE SLA - atendimento e trabalho dentro do prazo',
    Status = 'Working',
    Origin = 'Phone',
    PrioridadeSLA__c = 'P0',
    Description = 'Case de teste visual: atendimento dentro do prazo e trabalho concluido dentro do prazo. Datas simuladas nos campos de SLA.',
    PrimeiroAtendimentoEm__c = firstResponseAt,
    InicioTrabalhoSLA__c = workStartedAt,
    FimTrabalhoSLA__c = workFinishedAt,
    SLAAtendimentoPrazo__c = attendanceDeadline,
    SLATrabalhoPrazo__c = workDeadline,
    SLAAtendimentoViolado__c = false,
    SLATrabalhoViolado__c = false,
    SLAAtendimentoTempoRestanteUtilHoras__c = 0,
    SLATrabalhoTempoRestanteUtilHoras__c = 0,
    SLATempoRestanteUtilHoras__c = 0
);
insert caseRecord;

caseRecord = [
    SELECT
        Id,
        CaseNumber,
        Status,
        PrioridadeSLA__c,
        PrimeiroAtendimentoEm__c,
        InicioTrabalhoSLA__c,
        FimTrabalhoSLA__c,
        SLAAtendimentoPrazo__c,
        SLATrabalhoPrazo__c
    FROM Case
    WHERE Id = :caseRecord.Id
];

System.debug(
    'CASE_TRABALHO_OK|' +
    caseRecord.Id + '|' +
    caseRecord.CaseNumber + '|' +
    caseRecord.Status + '|' +
    caseRecord.PrioridadeSLA__c + '|' +
    caseRecord.PrimeiroAtendimentoEm__c + '|' +
    caseRecord.InicioTrabalhoSLA__c + '|' +
    caseRecord.FimTrabalhoSLA__c + '|' +
    caseRecord.SLAAtendimentoPrazo__c + '|' +
    caseRecord.SLATrabalhoPrazo__c
);
