List<BusinessHours> configuredHours = [
    SELECT Id
    FROM BusinessHours
    WHERE Name = 'SLA Suporte 9x18' AND IsActive = true
    LIMIT 1
];
Id businessHoursId = configuredHours.isEmpty()
    ? [SELECT Id FROM BusinessHours WHERE IsDefault = true LIMIT 1].Id
    : configuredHours[0].Id;

Datetime openedAt = Datetime.newInstance(Date.today().addDays(-7), Time.newInstance(9, 0, 0, 0));
Datetime workStartedAt = BusinessHours.add(businessHoursId, openedAt, 60 * 60 * 1000);

List<Map<String, Object>> scenarios = new List<Map<String, Object>>{
    new Map<String, Object>{
        'subject' => 'TESTE FECHADO SLA - P0 usando 25% do prazo',
        'priority' => 'P0',
        'workHours' => 8,
        'usedPercent' => 25,
        'attendanceLate' => false,
        'workLateHours' => 0
    },
    new Map<String, Object>{
        'subject' => 'TESTE FECHADO SLA - P1 usando 50% do prazo',
        'priority' => 'P1',
        'workHours' => 16,
        'usedPercent' => 50,
        'attendanceLate' => false,
        'workLateHours' => 0
    },
    new Map<String, Object>{
        'subject' => 'TESTE FECHADO SLA - P2 usando 90% do prazo',
        'priority' => 'P2',
        'workHours' => 24,
        'usedPercent' => 90,
        'attendanceLate' => false,
        'workLateHours' => 0
    },
    new Map<String, Object>{
        'subject' => 'TESTE FECHADO SLA - P3 quase vencendo 99%',
        'priority' => 'P3',
        'workHours' => 32,
        'usedPercent' => 99,
        'attendanceLate' => false,
        'workLateHours' => 0
    },
    new Map<String, Object>{
        'subject' => 'TESTE FECHADO SLA - P4 trabalho vencido em 3h',
        'priority' => 'P4',
        'workHours' => 40,
        'usedPercent' => 100,
        'attendanceLate' => false,
        'workLateHours' => 3
    },
    new Map<String, Object>{
        'subject' => 'TESTE FECHADO SLA - P0 atendimento e trabalho vencidos',
        'priority' => 'P0',
        'workHours' => 8,
        'usedPercent' => 100,
        'attendanceLate' => true,
        'workLateHours' => 2
    }
};

List<Case> casesToInsert = new List<Case>();
for (Map<String, Object> scenario : scenarios) {
    Integer workHours = (Integer) scenario.get('workHours');
    Integer usedPercent = (Integer) scenario.get('usedPercent');
    Integer workLateHours = (Integer) scenario.get('workLateHours');
    Boolean attendanceLate = (Boolean) scenario.get('attendanceLate');

    Datetime attendanceDeadline = BusinessHours.add(businessHoursId, openedAt, 2 * 60 * 60 * 1000);
    Datetime firstResponseAt = attendanceLate
        ? BusinessHours.add(businessHoursId, attendanceDeadline, 30 * 60 * 1000)
        : BusinessHours.add(businessHoursId, openedAt, 30 * 60 * 1000);
    Datetime workDeadline = BusinessHours.add(businessHoursId, workStartedAt, workHours * 60 * 60 * 1000);

    Decimal usedMillisecondsDecimal = Decimal.valueOf(workHours) * Decimal.valueOf(usedPercent) / 100 * 60 * 60 * 1000;
    Datetime workFinishedAt = workLateHours > 0
        ? BusinessHours.add(businessHoursId, workDeadline, workLateHours * 60 * 60 * 1000)
        : BusinessHours.add(businessHoursId, workStartedAt, usedMillisecondsDecimal.longValue());

    casesToInsert.add(new Case(
        Subject = (String) scenario.get('subject'),
        Origin = 'Phone',
        Status = 'Closed',
        PrioridadeSLA__c = (String) scenario.get('priority'),
        Description = 'Massa de teste para aba Casos Fechados da Central de controle de Sustentacao.',
        PrimeiroAtendimentoEm__c = firstResponseAt,
        InicioTrabalhoSLA__c = workStartedAt,
        FimTrabalhoSLA__c = workFinishedAt,
        SLAAtendimentoPrazo__c = attendanceDeadline,
        SLATrabalhoPrazo__c = workDeadline,
        SLAAtendimentoViolado__c = attendanceLate,
        SLATrabalhoViolado__c = workLateHours > 0,
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
        SLAAtendimentoPrazo__c,
        SLATrabalhoPrazo__c,
        SLAAtendimentoViolado__c,
        SLATrabalhoViolado__c
    FROM Case
    WHERE Id IN :casesToInsert
    ORDER BY CaseNumber
]) {
    System.debug(
        'CASE_FECHADO_PERCENTUAL|' +
        caseRecord.Id + '|' +
        caseRecord.CaseNumber + '|' +
        caseRecord.Status + '|' +
        caseRecord.PrioridadeSLA__c + '|' +
        caseRecord.SLAAtendimentoViolado__c + '|' +
        caseRecord.SLATrabalhoViolado__c + '|' +
        caseRecord.InicioTrabalhoSLA__c + '|' +
        caseRecord.FimTrabalhoSLA__c + '|' +
        caseRecord.SLATrabalhoPrazo__c + '|' +
        caseRecord.Subject
    );
}
