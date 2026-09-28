public with sharing class CaseSLAStatusController {
    private static final Integer ATENDIMENTO_HORAS = 2;
    private static final String BUSINESS_HOURS_NAME = 'SLA Suporte 9x18';

    private static final Set<String> STATUS_PAUSADO = new Set<String>{
        'Aguardando Cliente',
        'Aguardando Terceiro',
        'Disponivel Homologacao',
        'Pendencia'
    };

    @AuraEnabled(cacheable=true)
    public static CaseSLAStatusDTO getStatus(Id recordId) {
        if (recordId == null) {
            throw new AuraHandledException('Informe o Case.');
        }

        Case caseRecord = [
            SELECT
                Id,
                CaseNumber,
                CreatedDate,
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
                SLATrabalhoHoras__c,
                SLAFase__c,
                SLAStatus__c
            FROM Case
            WHERE Id = :recordId
            LIMIT 1
        ];

        Id businessHoursId = getBusinessHoursId();
        Datetime nowValue = System.now();
        Datetime referenceDate = caseRecord.IsStopped && caseRecord.InicioPausaSLA__c != null
            ? caseRecord.InicioPausaSLA__c
            : nowValue;

        Decimal atendimentoTotal = caseRecord.SLAAtendimentoHoras__c == null
            ? ATENDIMENTO_HORAS
            : caseRecord.SLAAtendimentoHoras__c;
        Decimal trabalhoTotal = caseRecord.SLATrabalhoHoras__c == null
            ? getWorkHours(caseRecord.PrioridadeSLA__c)
            : caseRecord.SLATrabalhoHoras__c;

        Decimal atendimentoRestante = remainingHours(
            businessHoursId,
            referenceDate,
            caseRecord.SLAAtendimentoPrazo__c,
            caseRecord.PrimeiroAtendimentoEm__c != null || caseRecord.IsClosed
        );
        Decimal trabalhoRestante = remainingHours(
            businessHoursId,
            referenceDate,
            caseRecord.SLATrabalhoPrazo__c,
            caseRecord.FimTrabalhoSLA__c != null || caseRecord.IsClosed
        );
        Decimal atendimentoVencido = overdueHours(
            referenceDate,
            caseRecord.SLAAtendimentoPrazo__c,
            caseRecord.PrimeiroAtendimentoEm__c != null || caseRecord.IsClosed
        );
        Decimal trabalhoVencido = overdueHours(
            referenceDate,
            caseRecord.SLATrabalhoPrazo__c,
            caseRecord.FimTrabalhoSLA__c != null || caseRecord.IsClosed
        );
        Decimal atendimentoUsado = elapsedBusinessHours(
            businessHoursId,
            caseRecord.CreatedDate,
            caseRecord.PrimeiroAtendimentoEm__c
        );
        Decimal trabalhoUsado = elapsedBusinessHours(
            businessHoursId,
            caseRecord.InicioTrabalhoSLA__c,
            caseRecord.FimTrabalhoSLA__c
        );

        CaseSLAStatusDTO dto = new CaseSLAStatusDTO();
        dto.caseNumber = caseRecord.CaseNumber;
        dto.openedAt = caseRecord.CreatedDate;
        dto.status = caseRecord.Status;
        dto.priority = caseRecord.PrioridadeSLA__c;
        dto.phase = caseRecord.SLAFase__c;
        dto.slaStatus = caseRecord.SLAStatus__c;
        dto.firstResponseAt = caseRecord.PrimeiroAtendimentoEm__c;
        dto.workStartedAt = caseRecord.InicioTrabalhoSLA__c;
        dto.workFinishedAt = caseRecord.FimTrabalhoSLA__c;
        dto.attendanceDeadline = caseRecord.SLAAtendimentoPrazo__c;
        dto.workDeadline = caseRecord.SLATrabalhoPrazo__c;
        dto.attendanceTotalHours = atendimentoTotal;
        dto.workTotalHours = trabalhoTotal;
        dto.attendanceRemainingHours = atendimentoRestante;
        dto.workRemainingHours = trabalhoRestante;
        dto.attendanceOverdueHours = atendimentoVencido;
        dto.workOverdueHours = trabalhoVencido;
        dto.attendanceElapsedHours = atendimentoUsado;
        dto.workElapsedHours = trabalhoUsado;
        dto.activeRemainingHours = caseRecord.PrimeiroAtendimentoEm__c == null
            ? atendimentoRestante
            : trabalhoRestante;
        dto.activeOverdueHours = caseRecord.PrimeiroAtendimentoEm__c == null
            ? atendimentoVencido
            : trabalhoVencido;
        dto.activeTotalHours = caseRecord.PrimeiroAtendimentoEm__c == null
            ? atendimentoTotal
            : trabalhoTotal;
        dto.attendancePercentUsed = percentUsed(atendimentoTotal, atendimentoRestante);
        dto.workPercentUsed = percentUsed(trabalhoTotal, trabalhoRestante);
        dto.activePercentUsed = percentUsed(dto.activeTotalHours, dto.activeRemainingHours);
        dto.attendanceViolated = caseRecord.SLAAtendimentoViolado__c;
        dto.workViolated = caseRecord.SLATrabalhoViolado__c;
        dto.paused = caseRecord.IsStopped || STATUS_PAUSADO.contains(caseRecord.Status);
        dto.closed = caseRecord.IsClosed;
        dto.lastCalculatedAt = nowValue;
        return dto;
    }

    private static Decimal remainingHours(Id businessHoursId, Datetime referenceDate, Datetime deadline, Boolean completed) {
        if (completed) {
            return 0;
        }
        if (deadline == null) {
            return null;
        }
        Long diffMilliseconds = BusinessHours.diff(businessHoursId, referenceDate, deadline);
        if (diffMilliseconds == null || diffMilliseconds <= 0) {
            return 0;
        }
        return (Decimal.valueOf(diffMilliseconds) / (60 * 60 * 1000)).setScale(2);
    }

    private static Decimal overdueHours(Datetime referenceDate, Datetime deadline, Boolean completed) {
        if (completed || deadline == null || referenceDate <= deadline) {
            return 0;
        }

        Long elapsedMilliseconds = referenceDate.getTime() - deadline.getTime();
        return (Decimal.valueOf(elapsedMilliseconds) / (60 * 60 * 1000)).setScale(2);
    }

    private static Decimal elapsedBusinessHours(Id businessHoursId, Datetime startDate, Datetime endDate) {
        if (startDate == null || endDate == null) {
            return null;
        }

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

    public class CaseSLAStatusDTO {
        @AuraEnabled public String caseNumber { get; set; }
        @AuraEnabled public Datetime openedAt { get; set; }
        @AuraEnabled public String status { get; set; }
        @AuraEnabled public String priority { get; set; }
        @AuraEnabled public String phase { get; set; }
        @AuraEnabled public String slaStatus { get; set; }
        @AuraEnabled public Datetime firstResponseAt { get; set; }
        @AuraEnabled public Datetime workStartedAt { get; set; }
        @AuraEnabled public Datetime workFinishedAt { get; set; }
        @AuraEnabled public Datetime attendanceDeadline { get; set; }
        @AuraEnabled public Datetime workDeadline { get; set; }
        @AuraEnabled public Decimal attendanceTotalHours { get; set; }
        @AuraEnabled public Decimal workTotalHours { get; set; }
        @AuraEnabled public Decimal attendanceRemainingHours { get; set; }
        @AuraEnabled public Decimal workRemainingHours { get; set; }
        @AuraEnabled public Decimal attendanceOverdueHours { get; set; }
        @AuraEnabled public Decimal workOverdueHours { get; set; }
        @AuraEnabled public Decimal attendanceElapsedHours { get; set; }
        @AuraEnabled public Decimal workElapsedHours { get; set; }
        @AuraEnabled public Decimal activeRemainingHours { get; set; }
        @AuraEnabled public Decimal activeOverdueHours { get; set; }
        @AuraEnabled public Decimal activeTotalHours { get; set; }
        @AuraEnabled public Integer attendancePercentUsed { get; set; }
        @AuraEnabled public Integer workPercentUsed { get; set; }
        @AuraEnabled public Integer activePercentUsed { get; set; }
        @AuraEnabled public Boolean attendanceViolated { get; set; }
        @AuraEnabled public Boolean workViolated { get; set; }
        @AuraEnabled public Boolean paused { get; set; }
        @AuraEnabled public Boolean closed { get; set; }
        @AuraEnabled public Datetime lastCalculatedAt { get; set; }
    }
}