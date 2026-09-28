Id businessHoursId = [SELECT Id FROM BusinessHours WHERE IsDefault = true LIMIT 1].Id;
Datetime openedAt = System.now();
Datetime firstResponseAt = openedAt.addMinutes(15);
Datetime workStartedAt = openedAt.addMinutes(20);
Datetime attendanceDeadline = BusinessHours.add(businessHoursId, openedAt, 2 * 60 * 60 * 1000);
Datetime workDeadline = BusinessHours.add(businessHoursId, workStartedAt, 8 * 60 * 60 * 1000);
Long workRemainingMilliseconds = BusinessHours.diff(businessHoursId, System.now(), workDeadline);
Decimal workRemainingHours = workRemainingMilliseconds == null || workRemainingMilliseconds <= 0
    ? 0
    : (Decimal.valueOf(workRemainingMilliseconds) / (60 * 60 * 1000)).setScale(2);

Case caseRecord = new Case(
    Subject = 'TESTE SLA - atendimento dentro do prazo e trabalho iniciado',
    Status = 'Working',
    Origin = 'Phone',
    PrioridadeSLA__c = 'P0',
    Description = 'Case de teste: atendimento feito dentro do prazo e trabalho iniciado. Como CreatedDate nao pode ser editado, os tempos foram simulados nos campos de SLA.',
    PrimeiroAtendimentoEm__c = firstResponseAt,
    InicioTrabalhoSLA__c = workStartedAt,
    SLAAtendimentoPrazo__c = attendanceDeadline,
    SLATrabalhoPrazo__c = workDeadline,
    SLAAtendimentoViolado__c = false,
    SLATrabalhoViolado__c = false,
    SLAAtendimentoTempoRestanteUtilHoras__c = 0,
    SLATrabalhoTempoRestanteUtilHoras__c = workRemainingHours,
    SLATempoRestanteUtilHoras__c = workRemainingHours
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
        SLAAtendimentoPrazo__c,
        SLATrabalhoPrazo__c,
        SLATempoRestanteUtilHoras__c
    FROM Case
    WHERE Id = :caseRecord.Id
];

System.debug(
    'CASE_ATENDIMENTO_OK|' +
    caseRecord.Id + '|' +
    caseRecord.CaseNumber + '|' +
    caseRecord.Status + '|' +
    caseRecord.PrioridadeSLA__c + '|' +
    caseRecord.PrimeiroAtendimentoEm__c + '|' +
    caseRecord.InicioTrabalhoSLA__c + '|' +
    caseRecord.SLAAtendimentoPrazo__c + '|' +
    caseRecord.SLATrabalhoPrazo__c + '|' +
    caseRecord.SLATempoRestanteUtilHoras__c
);
