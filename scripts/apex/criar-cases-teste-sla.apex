String businessHoursName = 'SLA Suporte 9x18';
List<BusinessHours> configuredHours = [
    SELECT Id
    FROM BusinessHours
    WHERE Name = :businessHoursName AND IsActive = true
    LIMIT 1
];
Id businessHoursId = configuredHours.isEmpty()
    ? [SELECT Id FROM BusinessHours WHERE IsDefault = true LIMIT 1].Id
    : configuredHours[0].Id;

Datetime nowValue = System.now();

List<Map<String, Object>> scenarios = new List<Map<String, Object>>{
    new Map<String, Object>{
        'subject' => 'TESTE SLA - abertura simulada hoje 16h',
        'priority' => 'P0',
        'openedAt' => Datetime.newInstance(2026, 8, 31, 16, 0, 0)
    },
    new Map<String, Object>{
        'subject' => 'TESTE SLA - abertura simulada hoje 15h',
        'priority' => 'P1',
        'openedAt' => Datetime.newInstance(2026, 8, 31, 15, 0, 0)
    },
    new Map<String, Object>{
        'subject' => 'TESTE SLA - abertura simulada hoje 17h',
        'priority' => 'P2',
        'openedAt' => Datetime.newInstance(2026, 8, 31, 17, 0, 0)
    },
    new Map<String, Object>{
        'subject' => 'TESTE SLA - abertura simulada ontem 12h',
        'priority' => 'P3',
        'openedAt' => Datetime.newInstance(2026, 8, 30, 12, 0, 0)
    },
    new Map<String, Object>{
        'subject' => 'TESTE SLA - abertura simulada hoje 17h15',
        'priority' => 'P4',
        'openedAt' => Datetime.newInstance(2026, 8, 31, 17, 15, 0)
    }
};

List<Case> casesToInsert = new List<Case>();
for (Map<String, Object> scenario : scenarios) {
    Datetime openedAt = (Datetime) scenario.get('openedAt');
    Datetime attendanceDeadline = BusinessHours.add(businessHoursId, openedAt, 2 * 60 * 60 * 1000);
    Long remainingMilliseconds = BusinessHours.diff(businessHoursId, nowValue, attendanceDeadline);
    Decimal remainingHours = remainingMilliseconds == null || remainingMilliseconds <= 0
        ? 0
        : (Decimal.valueOf(remainingMilliseconds) / (60 * 60 * 1000)).setScale(2);

    casesToInsert.add(new Case(
        Subject = (String) scenario.get('subject'),
        Status = 'New',
        Origin = 'Phone',
        PrioridadeSLA__c = (String) scenario.get('priority'),
        Description = 'Case de teste para SLA. Abertura simulada: '
            + openedAt.format('dd/MM/yyyy HH:mm', 'America/Sao_Paulo')
            + ' America/Sao_Paulo. CreatedDate real nao foi alterado pela org.',
        SLAAtendimentoPrazo__c = attendanceDeadline,
        SLAAtendimentoViolado__c = nowValue > attendanceDeadline,
        SLAAtendimentoTempoRestanteUtilHoras__c = remainingHours,
        SLATempoRestanteUtilHoras__c = remainingHours
    ));
}

insert casesToInsert;

for (Case createdCase : [
    SELECT
        Id,
        CaseNumber,
        Subject,
        PrioridadeSLA__c,
        Status,
        SLAAtendimentoPrazo__c,
        SLAAtendimentoViolado__c,
        SLATempoRestanteUtilHoras__c
    FROM Case
    WHERE Id IN :casesToInsert
    ORDER BY CaseNumber
]) {
    System.debug(
        'CASE_TESTE_SLA|' +
        createdCase.Id + '|' +
        createdCase.CaseNumber + '|' +
        createdCase.PrioridadeSLA__c + '|' +
        createdCase.Status + '|' +
        createdCase.SLAAtendimentoPrazo__c + '|' +
        createdCase.SLAAtendimentoViolado__c + '|' +
        createdCase.SLATempoRestanteUtilHoras__c + '|' +
        createdCase.Subject
    );
}
