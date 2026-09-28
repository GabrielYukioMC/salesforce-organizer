Id businessHoursId = [SELECT Id FROM BusinessHours WHERE IsDefault = true LIMIT 1].Id;
Datetime nowValue = System.now();

List<Map<String, Object>> scenarios = new List<Map<String, Object>>{
    new Map<String, Object>{
        'subject' => 'TESTE SLA TRABALHO - inicio hoje 10h',
        'priority' => 'P0',
        'openedAt' => Datetime.newInstance(2026, 8, 31, 9, 30, 0),
        'firstResponseAt' => Datetime.newInstance(2026, 8, 31, 9, 45, 0),
        'workStartedAt' => Datetime.newInstance(2026, 8, 31, 10, 0, 0),
        'workDeadline' => Datetime.newInstance(2026, 8, 31, 18, 0, 0)
    },
    new Map<String, Object>{
        'subject' => 'TESTE SLA TRABALHO - inicio hoje 16h',
        'priority' => 'P0',
        'openedAt' => Datetime.newInstance(2026, 8, 31, 15, 15, 0),
        'firstResponseAt' => Datetime.newInstance(2026, 8, 31, 15, 30, 0),
        'workStartedAt' => Datetime.newInstance(2026, 8, 31, 16, 0, 0),
        'workDeadline' => Datetime.newInstance(2026, 9, 1, 15, 0, 0)
    },
    new Map<String, Object>{
        'subject' => 'TESTE SLA TRABALHO - inicio hoje 15h',
        'priority' => 'P1',
        'openedAt' => Datetime.newInstance(2026, 8, 31, 14, 30, 0),
        'firstResponseAt' => Datetime.newInstance(2026, 8, 31, 14, 45, 0),
        'workStartedAt' => Datetime.newInstance(2026, 8, 31, 15, 0, 0),
        'workDeadline' => Datetime.newInstance(2026, 9, 2, 13, 0, 0)
    },
    new Map<String, Object>{
        'subject' => 'TESTE SLA TRABALHO - inicio ontem 12h',
        'priority' => 'P0',
        'openedAt' => Datetime.newInstance(2026, 8, 30, 11, 30, 0),
        'firstResponseAt' => Datetime.newInstance(2026, 8, 31, 9, 30, 0),
        'workStartedAt' => Datetime.newInstance(2026, 8, 31, 9, 0, 0),
        'workDeadline' => Datetime.newInstance(2026, 8, 31, 17, 0, 0)
    },
    new Map<String, Object>{
        'subject' => 'TESTE SLA TRABALHO - inicio hoje 17h15',
        'priority' => 'P2',
        'openedAt' => Datetime.newInstance(2026, 8, 31, 16, 45, 0),
        'firstResponseAt' => Datetime.newInstance(2026, 8, 31, 17, 0, 0),
        'workStartedAt' => Datetime.newInstance(2026, 8, 31, 17, 15, 0),
        'workDeadline' => Datetime.newInstance(2026, 9, 3, 14, 15, 0)
    }
};

List<Case> casesToInsert = new List<Case>();
for (Map<String, Object> scenario : scenarios) {
    Datetime openedAt = (Datetime) scenario.get('openedAt');
    Datetime firstResponseAt = (Datetime) scenario.get('firstResponseAt');
    Datetime workStartedAt = (Datetime) scenario.get('workStartedAt');
    Datetime workDeadline = (Datetime) scenario.get('workDeadline');
    Datetime attendanceDeadline = BusinessHours.add(businessHoursId, openedAt, 2 * 60 * 60 * 1000);

    Long workRemainingMilliseconds = BusinessHours.diff(businessHoursId, nowValue, workDeadline);
    Decimal workRemainingHours = workRemainingMilliseconds == null || workRemainingMilliseconds <= 0
        ? 0
        : (Decimal.valueOf(workRemainingMilliseconds) / (60 * 60 * 1000)).setScale(2);

    casesToInsert.add(new Case(
        Subject = (String) scenario.get('subject'),
        Status = 'Working',
        Origin = 'Phone',
        PrioridadeSLA__c = (String) scenario.get('priority'),
        Description = 'Case de teste em trabalho. Abertura simulada: '
            + openedAt.format('dd/MM/yyyy HH:mm', 'America/Sao_Paulo')
            + ', primeiro atendimento: '
            + firstResponseAt.format('dd/MM/yyyy HH:mm', 'America/Sao_Paulo')
            + ', inicio do trabalho: '
            + workStartedAt.format('dd/MM/yyyy HH:mm', 'America/Sao_Paulo')
            + '. CreatedDate real nao foi alterado pela org.',
        PrimeiroAtendimentoEm__c = firstResponseAt,
        InicioTrabalhoSLA__c = workStartedAt,
        SLAAtendimentoPrazo__c = attendanceDeadline,
        SLATrabalhoPrazo__c = workDeadline,
        SLAAtendimentoViolado__c = firstResponseAt > attendanceDeadline,
        SLATrabalhoViolado__c = nowValue > workDeadline,
        SLAAtendimentoTempoRestanteUtilHoras__c = 0,
        SLATrabalhoTempoRestanteUtilHoras__c = workRemainingHours,
        SLATempoRestanteUtilHoras__c = workRemainingHours
    ));
}

insert casesToInsert;

for (Case createdCase : [
    SELECT
        Id,
        CaseNumber,
        Subject,
        Status,
        PrioridadeSLA__c,
        PrimeiroAtendimentoEm__c,
        InicioTrabalhoSLA__c,
        SLATrabalhoPrazo__c,
        SLATrabalhoViolado__c,
        SLATempoRestanteUtilHoras__c
    FROM Case
    WHERE Id IN :casesToInsert
    ORDER BY CaseNumber
]) {
    System.debug(
        'CASE_TESTE_TRABALHO|' +
        createdCase.Id + '|' +
        createdCase.CaseNumber + '|' +
        createdCase.PrioridadeSLA__c + '|' +
        createdCase.Status + '|' +
        createdCase.InicioTrabalhoSLA__c + '|' +
        createdCase.SLATrabalhoPrazo__c + '|' +
        createdCase.SLATrabalhoViolado__c + '|' +
        createdCase.SLATempoRestanteUtilHoras__c + '|' +
        createdCase.Subject
    );
}
