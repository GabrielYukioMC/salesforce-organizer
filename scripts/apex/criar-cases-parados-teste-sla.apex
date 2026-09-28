List<Case> casesToInsert = new List<Case>{
    new Case(
        Subject = 'TESTE SLA PARADO - Pendencia',
        Origin = 'Phone',
        Status = 'Working',
        PrioridadeSLA__c = 'P1'
    ),
    new Case(
        Subject = 'TESTE SLA PARADO - Disponivel Homologacao',
        Origin = 'Phone',
        Status = 'Working',
        PrioridadeSLA__c = 'P2'
    )
};
insert casesToInsert;

casesToInsert[0].Status = 'Pendencia';
casesToInsert[1].Status = 'Disponivel Homologacao';
update casesToInsert;

for (Case caseRecord : [
    SELECT
        Id,
        CaseNumber,
        Subject,
        Status,
        InicioTrabalhoSLA__c,
        InicioPausaSLA__c,
        SLATrabalhoPrazo__c
    FROM Case
    WHERE Id IN :casesToInsert
    ORDER BY CaseNumber
]) {
    System.debug(
        'CASE_PARADO_TESTE|' +
        caseRecord.Id + '|' +
        caseRecord.CaseNumber + '|' +
        caseRecord.Status + '|' +
        caseRecord.InicioTrabalhoSLA__c + '|' +
        caseRecord.InicioPausaSLA__c + '|' +
        caseRecord.SLATrabalhoPrazo__c + '|' +
        caseRecord.Subject
    );
}
