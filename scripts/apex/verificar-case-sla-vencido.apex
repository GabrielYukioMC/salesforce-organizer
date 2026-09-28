CaseSLAStatusController.CaseSLAStatusDTO dto = CaseSLAStatusController.getStatus('500gL00001VtfWPQAZ');
System.debug(
    'OVERDUE_CHECK|' +
    dto.caseNumber + '|' +
    dto.activeRemainingHours + '|' +
    dto.activeOverdueHours + '|' +
    dto.workOverdueHours
);
