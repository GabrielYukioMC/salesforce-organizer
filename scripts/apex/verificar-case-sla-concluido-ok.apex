CaseSLAStatusController.CaseSLAStatusDTO dto = CaseSLAStatusController.getStatus('500gL00001VtgFZQAZ');
System.debug(
    'SUCCESS_CHECK|' +
    dto.caseNumber + '|' +
    dto.attendanceElapsedHours + '|' +
    dto.workElapsedHours + '|' +
    dto.attendanceViolated + '|' +
    dto.workViolated
);
