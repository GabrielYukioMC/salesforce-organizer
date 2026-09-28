public with sharing class CentralControleSustentacaoController {
    private static final Integer ATENDIMENTO_HORAS = 2;
    private static final String BUSINESS_HOURS_NAME = 'SLA Suporte 9x18';

    private static final Set<String> STATUS_TRABALHO = new Set<String>{
        'Working',
        'Em Trabalho'
    };
    private static final Set<String> STATUS_HOMOLOGACAO = new Set<String>{
        'Disponivel Homologacao'
    };
    private static final Set<String> STATUS_PARADO = new Set<String>{
        'Aguardando Cliente',
        'Aguardando Terceiro',
        'Pendencia'
    };

    @AuraEnabled(cacheable=true)
    public static DashboardDTO getDashboard(String startDate, String endDate) {
        Id businessHoursId = getBusinessHoursId();
        Datetime nowValue = System.now();
        DateRange range = parseRange(startDate, endDate);

        DashboardDTO dashboard = new DashboardDTO();
        dashboard.newCases = buildRows(queryNewCases(), businessHoursId, nowValue, 'Atendimento');
        dashboard.openCases = buildRows(queryOpenCases(), businessHoursId, nowValue, 'Trabalho');
        dashboard.pausedCases = buildRows(queryPausedCases(), businessHoursId, nowValue, 'Trabalho');
        dashboard.homologationCases = buildRows(queryHomologationCases(), businessHoursId, nowValue, 'Trabalho');
        dashboard.closedCases = buildRows(queryClosedCases(range), businessHoursId, nowValue, 'Trabalho');
        dashboard.summary = buildSummary(range, businessHoursId);
        return dashboard;
    }

    @AuraEnabled(cacheable=true)
    public static List<CaseSlaRowDTO> getNewCases() {
        Id businessHoursId = getBusinessHoursId();
        return buildRows(queryNewCases(), businessHoursId, System.now(), 'Atendimento');
    }

    private static List<Case> queryNewCases() {
        return [
            SELECT
                Id,
                CaseNumber,
                Subject,
                CreatedDate,
                ClosedDate,
                Status,
                IsClosed,
                IsStopped,
                PrioridadeSLA__c,
                PrimeiroAtendimentoEm__c,
                InicioTrabalhoSLA__c,
                FimTrabalhoSLA__c,
                InicioPausaSLA__c,
                SLAAtendimentoPrazo__c,
                SLATrabalhoPrazo__c,
                SLAAtendimentoViolado__c,
                SLATrabalhoViolado__c,
                SLAAtendimentoHoras__c,
                SLATrabalhoHoras__c
            FROM Case
            WHERE Status = 'New'
            ORDER BY SLAAtendimentoViolado__c DESC, SLAAtendimentoPrazo__c ASC, CreatedDate ASC
            LIMIT 200
        ];
    }

    private static List<Case> queryOpenCases() {
        return [
            SELECT
                Id,
                CaseNumber,
                Subject,
                CreatedDate,
                ClosedDate,
                Status,
                IsClosed,
                IsStopped,
                PrioridadeSLA__c,
                PrimeiroAtendimentoEm__c,
                InicioTrabalhoSLA__c,
                FimTrabalhoSLA__c,
                InicioPausaSLA__c,
                SLAAtendimentoPrazo__c,
                SLATrabalhoPrazo__c,
                SLAAtendimentoViolado__c,
                SLATrabalhoViolado__c,
                SLAAtendimentoHoras__c,
                SLATrabalhoHoras__c
            FROM Case
            WHERE IsClosed = false
            AND Status IN :STATUS_TRABALHO
            AND InicioTrabalhoSLA__c != null
            ORDER BY SLATrabalhoViolado__c DESC, SLATrabalhoPrazo__c ASC, CreatedDate ASC
            LIMIT 200
        ];
    }

    private static List<Case> queryPausedCases() {
        return [
            SELECT
                Id,
                CaseNumber,
                Subject,
                CreatedDate,
                ClosedDate,
                Status,
                IsClosed,
                IsStopped,
                PrioridadeSLA__c,
                PrimeiroAtendimentoEm__c,
                InicioTrabalhoSLA__c,
                FimTrabalhoSLA__c,
                InicioPausaSLA__c,
                SLAAtendimentoPrazo__c,
                SLATrabalhoPrazo__c,
                SLAAtendimentoViolado__c,
                SLATrabalhoViolado__c,
                SLAAtendimentoHoras__c,
                SLATrabalhoHoras__c
            FROM Case
            WHERE IsClosed = false
            AND InicioTrabalhoSLA__c != null
            AND (Status IN :STATUS_PARADO OR (IsStopped = true AND Status NOT IN :STATUS_HOMOLOGACAO))
            ORDER BY InicioPausaSLA__c ASC, CreatedDate ASC
            LIMIT 200
        ];
    }

    private static List<Case> queryHomologationCases() {
        return [
            SELECT
                Id,
                CaseNumber,
                Subject,
                CreatedDate,
                ClosedDate,
                Status,
                IsClosed,
                IsStopped,
                PrioridadeSLA__c,
                PrimeiroAtendimentoEm__c,
                InicioTrabalhoSLA__c,
                FimTrabalhoSLA__c,
                InicioPausaSLA__c,
                SLAAtendimentoPrazo__c,
                SLATrabalhoPrazo__c,
                SLAAtendimentoViolado__c,
                SLATrabalhoViolado__c,
                SLAAtendimentoHoras__c,
                SLATrabalhoHoras__c
            FROM Case
            WHERE IsClosed = false
            AND InicioTrabalhoSLA__c != null
            AND Status IN :STATUS_HOMOLOGACAO
            ORDER BY InicioPausaSLA__c ASC, CreatedDate ASC
            LIMIT 200
        ];
    }

    private static List<Case> queryClosedCases(DateRange range) {
        return [
            SELECT
                Id,
                CaseNumber,
                Subject,
                CreatedDate,
                ClosedDate,
                Status,
                IsClosed,
                IsStopped,
                PrioridadeSLA__c,
                PrimeiroAtendimentoEm__c,
                InicioTrabalhoSLA__c,
                FimTrabalhoSLA__c,
                InicioPausaSLA__c,
                SLAAtendimentoPrazo__c,
                SLATrabalhoPrazo__c,
                SLAAtendimentoViolado__c,
                SLATrabalhoViolado__c,
                SLAAtendimentoHoras__c,
                SLATrabalhoHoras__c
            FROM Case
            WHERE IsClosed = true
            AND ClosedDate >= :range.startDateTime
            AND ClosedDate < :range.endDateTimeExclusive
            ORDER BY ClosedDate DESC
            LIMIT 200
        ];
    }

    private static List<CaseSlaRowDTO> buildRows(
        List<Case> caseRecords,
        Id businessHoursId,
        Datetime nowValue,
        String slaType
    ) {
        List<CaseSlaRowDTO> rows = new List<CaseSlaRowDTO>();
        for (Case caseRecord : caseRecords) {
            Datetime referenceDate = nowValue;
            if (caseRecord.IsClosed && caseRecord.FimTrabalhoSLA__c != null) {
                referenceDate = caseRecord.FimTrabalhoSLA__c;
            } else if (caseRecord.IsClosed && caseRecord.ClosedDate != null) {
                referenceDate = caseRecord.ClosedDate;
            } else if (caseRecord.IsStopped && caseRecord.InicioPausaSLA__c != null) {
                referenceDate = caseRecord.InicioPausaSLA__c;
            }
            Datetime deadline = slaType == 'Atendimento'
                ? caseRecord.SLAAtendimentoPrazo__c
                : caseRecord.SLATrabalhoPrazo__c;
            Decimal totalHours = slaType == 'Atendimento'
                ? (caseRecord.SLAAtendimentoHoras__c == null ? ATENDIMENTO_HORAS : caseRecord.SLAAtendimentoHoras__c)
                : (caseRecord.SLATrabalhoHoras__c == null ? getWorkHours(caseRecord.PrioridadeSLA__c) : caseRecord.SLATrabalhoHoras__c);
            Decimal remainingHours = remainingBusinessHours(businessHoursId, referenceDate, deadline);
            Decimal overdueHours = overdueHours(referenceDate, deadline);
            Boolean violated = slaType == 'Atendimento'
                ? caseRecord.SLAAtendimentoViolado__c || overdueHours > 0
                : caseRecord.SLATrabalhoViolado__c || overdueHours > 0;

            CaseSlaRowDTO row = new CaseSlaRowDTO();
            row.id = caseRecord.Id;
            row.caseNumber = caseRecord.CaseNumber;
            row.subject = caseRecord.Subject;
            row.openedAt = caseRecord.CreatedDate;
            row.closedAt = caseRecord.ClosedDate;
            row.closed = caseRecord.IsClosed;
            row.status = caseRecord.Status;
            row.priority = caseRecord.PrioridadeSLA__c;
            row.slaType = slaType;
            row.deadline = deadline;
            row.totalHours = totalHours;
            row.remainingHours = remainingHours;
            row.overdueHours = overdueHours;
            row.percentUsed = percentUsed(totalHours, remainingHours);
            row.violated = violated;
            row.paused = caseRecord.IsStopped || STATUS_PARADO.contains(caseRecord.Status);
            row.pauseStartedAt = caseRecord.InicioPausaSLA__c;
            row.workStartedAt = caseRecord.InicioTrabalhoSLA__c;
            row.workFinishedAt = caseRecord.FimTrabalhoSLA__c;
            rows.add(row);
        }
        return rows;
    }

    private static SummaryDTO buildSummary(DateRange range, Id businessHoursId) {
        SummaryDTO summary = new SummaryDTO();
        summary.startDate = range.startDate;
        summary.endDate = range.endDate;
        summary.resolvedCases = [
            SELECT count()
            FROM Case
            WHERE IsClosed = true
            AND ClosedDate >= :range.startDateTime
            AND ClosedDate < :range.endDateTimeExclusive
        ];
        summary.openedCases = [
            SELECT count()
            FROM Case
            WHERE CreatedDate >= :range.startDateTime
            AND CreatedDate < :range.endDateTimeExclusive
        ];
        summary.workingCases = [
            SELECT count()
            FROM Case
            WHERE IsClosed = false
            AND Status IN :STATUS_TRABALHO
            AND InicioTrabalhoSLA__c >= :range.startDateTime
            AND InicioTrabalhoSLA__c < :range.endDateTimeExclusive
        ];
        summary.lostAttendanceSla = [
            SELECT count()
            FROM Case
            WHERE SLAAtendimentoViolado__c = true
            AND CreatedDate >= :range.startDateTime
            AND CreatedDate < :range.endDateTimeExclusive
        ];
        summary.lostWorkSla = [
            SELECT count()
            FROM Case
            WHERE SLATrabalhoViolado__c = true
            AND CreatedDate >= :range.startDateTime
            AND CreatedDate < :range.endDateTimeExclusive
        ];
        summary.monthOpenedCases = [
            SELECT count()
            FROM Case
            WHERE CreatedDate >= :range.startDateTime
            AND CreatedDate < :range.endDateTimeExclusive
        ];
        summary.totalWorkedHours = calculateTotalWorkedHours(range, businessHoursId);
        return summary;
    }

    private static Decimal calculateTotalWorkedHours(DateRange range, Id businessHoursId) {
        Decimal total = 0;
        for (Case caseRecord : [
            SELECT InicioTrabalhoSLA__c, FimTrabalhoSLA__c
            FROM Case
            WHERE InicioTrabalhoSLA__c != null
            AND FimTrabalhoSLA__c != null
            AND FimTrabalhoSLA__c >= :range.startDateTime
            AND FimTrabalhoSLA__c < :range.endDateTimeExclusive
            LIMIT 2000
        ]) {
            total += elapsedBusinessHours(
                businessHoursId,
                caseRecord.InicioTrabalhoSLA__c,
                caseRecord.FimTrabalhoSLA__c
            );
        }
        return total.setScale(2);
    }

    private static DateRange parseRange(String startDate, String endDate) {
        Date today = Date.today();
        Date firstDay = Date.newInstance(today.year(), today.month(), 1);
        Date lastDay = firstDay.addMonths(1).addDays(-1);

        DateRange range = new DateRange();
        range.startDate = String.isBlank(startDate) ? firstDay : Date.valueOf(startDate);
        range.endDate = String.isBlank(endDate) ? lastDay : Date.valueOf(endDate);
        if (range.endDate < range.startDate) {
            Date originalStart = range.startDate;
            range.startDate = range.endDate;
            range.endDate = originalStart;
        }

        Date monthStart = Date.newInstance(today.year(), today.month(), 1);
        range.startDateTime = Datetime.newInstance(range.startDate, Time.newInstance(0, 0, 0, 0));
        range.endDateTimeExclusive = Datetime.newInstance(range.endDate.addDays(1), Time.newInstance(0, 0, 0, 0));
        range.monthStartDateTime = Datetime.newInstance(monthStart, Time.newInstance(0, 0, 0, 0));
        range.nextMonthStartDateTime = Datetime.newInstance(monthStart.addMonths(1), Time.newInstance(0, 0, 0, 0));
        return range;
    }

    private static Decimal remainingBusinessHours(Id businessHoursId, Datetime referenceDate, Datetime deadline) {
        if (deadline == null) {
            return null;
        }

        Long diffMilliseconds = BusinessHours.diff(businessHoursId, referenceDate, deadline);
        if (diffMilliseconds == null || diffMilliseconds <= 0) {
            return 0;
        }
        return (Decimal.valueOf(diffMilliseconds) / (60 * 60 * 1000)).setScale(2);
    }

    private static Decimal overdueHours(Datetime referenceDate, Datetime deadline) {
        if (deadline == null || referenceDate <= deadline) {
            return 0;
        }

        Long elapsedMilliseconds = referenceDate.getTime() - deadline.getTime();
        return (Decimal.valueOf(elapsedMilliseconds) / (60 * 60 * 1000)).setScale(2);
    }

    private static Decimal elapsedBusinessHours(Id businessHoursId, Datetime startDate, Datetime endDate) {
        Long elapsedMilliseconds = BusinessHours.diff(businessHoursId, startDate, endDate);
        if (elapsedMilliseconds == null || elapsedMilliseconds <= 0) {
            return 0;
        }
        return (Decimal.valueOf(elapsedMilliseconds) / (60 * 60 * 1000)).setScale(2);
    }

    private static Integer percentUsed(Decimal totalHours, Decimal remainingHours) {
        if (totalHours == null || totalHours <= 0 || remainingHours == null) {
            return 0;
        }

        Decimal used = ((totalHours - remainingHours) / totalHours) * 100;
        if (used < 0) {
            return 0;
        }
        if (used > 100) {
            return 100;
        }
        return Integer.valueOf(used.setScale(0));
    }

    private static Integer getWorkHours(String prioridadeSla) {
        switch on prioridadeSla {
            when 'P0' {
                return 8;
            }
            when 'P1' {
                return 16;
            }
            when 'P2' {
                return 24;
            }
            when 'P3' {
                return 32;
            }
            when 'P4' {
                return 40;
            }
            when else {
                return 24;
            }
        }
    }

    private static Id getBusinessHoursId() {
        List<BusinessHours> configuredHours = [
            SELECT Id
            FROM BusinessHours
            WHERE Name = :BUSINESS_HOURS_NAME AND IsActive = true
            LIMIT 1
        ];
        if (!configuredHours.isEmpty()) {
            return configuredHours[0].Id;
        }

        return [
            SELECT Id
            FROM BusinessHours
            WHERE IsDefault = true
            LIMIT 1
        ].Id;
    }

    private class DateRange {
        Date startDate;
        Date endDate;
        Datetime startDateTime;
        Datetime endDateTimeExclusive;
        Datetime monthStartDateTime;
        Datetime nextMonthStartDateTime;
    }

    public class DashboardDTO {
        @AuraEnabled public List<CaseSlaRowDTO> newCases { get; set; }
        @AuraEnabled public List<CaseSlaRowDTO> openCases { get; set; }
        @AuraEnabled public List<CaseSlaRowDTO> pausedCases { get; set; }
        @AuraEnabled public List<CaseSlaRowDTO> homologationCases { get; set; }
        @AuraEnabled public List<CaseSlaRowDTO> closedCases { get; set; }
        @AuraEnabled public SummaryDTO summary { get; set; }
    }

    public class SummaryDTO {
        @AuraEnabled public Date startDate { get; set; }
        @AuraEnabled public Date endDate { get; set; }
        @AuraEnabled public Integer resolvedCases { get; set; }
        @AuraEnabled public Integer openedCases { get; set; }
        @AuraEnabled public Integer workingCases { get; set; }
        @AuraEnabled public Integer lostAttendanceSla { get; set; }
        @AuraEnabled public Integer lostWorkSla { get; set; }
        @AuraEnabled public Integer monthOpenedCases { get; set; }
        @AuraEnabled public Decimal totalWorkedHours { get; set; }
    }

    public class CaseSlaRowDTO {
        @AuraEnabled public Id id { get; set; }
        @AuraEnabled public String caseNumber { get; set; }
        @AuraEnabled public String subject { get; set; }
        @AuraEnabled public Datetime openedAt { get; set; }
        @AuraEnabled public Datetime closedAt { get; set; }
        @AuraEnabled public Boolean closed { get; set; }
        @AuraEnabled public String status { get; set; }
        @AuraEnabled public String priority { get; set; }
        @AuraEnabled public String slaType { get; set; }
        @AuraEnabled public Datetime deadline { get; set; }
        @AuraEnabled public Decimal totalHours { get; set; }
        @AuraEnabled public Decimal remainingHours { get; set; }
        @AuraEnabled public Decimal overdueHours { get; set; }
        @AuraEnabled public Integer percentUsed { get; set; }
        @AuraEnabled public Boolean violated { get; set; }
        @AuraEnabled public Boolean paused { get; set; }
        @AuraEnabled public Datetime pauseStartedAt { get; set; }
        @AuraEnabled public Datetime workStartedAt { get; set; }
        @AuraEnabled public Datetime workFinishedAt { get; set; }
    }
}