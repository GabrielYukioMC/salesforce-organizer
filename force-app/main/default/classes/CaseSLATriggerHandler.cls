public with sharing class CaseSLATriggerHandler {
    private static final Integer ATENDIMENTO_HORAS = 2;
    private static final String BUSINESS_HOURS_NAME = 'SLA Suporte 9x18';

    private static final Set<String> STATUS_TRABALHO = new Set<String>{
        'Working',
        'Em Trabalho'
    };
    private static final Set<String> STATUS_PAUSADO = new Set<String>{
        'Aguardando Cliente',
        'Aguardando Terceiro',
        'Disponivel Homologacao',
        'Pendencia'
    };
    private static final Set<String> STATUS_RESOLVIDO = new Set<String>{
        'Resolved',
        'Resolvido',
        'Closed',
        'Fechado'
    };

    private static Id cachedBusinessHoursId;

    public static void beforeInsert(List<Case> newCases) {
        Id businessHoursId = getBusinessHoursId();
        Datetime nowValue = System.now();

        for (Case caseRecord : newCases) {
            initializeAtendimento(caseRecord, businessHoursId, nowValue);

            if (isPausedStatus(caseRecord.Status)) {
                caseRecord.IsStopped = true;
                caseRecord.InicioPausaSLA__c = nowValue;
            } else {
                caseRecord.IsStopped = false;
            }

            if (isWorkingStatus(caseRecord.Status)) {
                startWork(caseRecord, businessHoursId, nowValue);
            }

            if (isResolvedStatus(caseRecord.Status)) {
                finishWork(caseRecord, nowValue);
            }

            syncRemainingHours(caseRecord, businessHoursId, nowValue);
        }
    }

    public static void beforeUpdate(List<Case> newCases, Map<Id, Case> oldMap) {
        Id businessHoursId = getBusinessHoursId();
        Datetime nowValue = System.now();

        for (Case caseRecord : newCases) {
            Case oldRecord = oldMap.get(caseRecord.Id);
            updateViolationFlags(caseRecord, nowValue);

            if (caseRecord.SLAAtendimentoPrazo__c == null) {
                initializeAtendimento(caseRecord, businessHoursId, nowValue);
            }

            Boolean statusChanged = oldRecord.Status != caseRecord.Status;
            if (!statusChanged) {
                syncRemainingHours(caseRecord, businessHoursId, nowValue);
                continue;
            }

            if (isPausedStatus(caseRecord.Status)) {
                caseRecord.IsStopped = true;
                if (caseRecord.InicioPausaSLA__c == null) {
                    caseRecord.InicioPausaSLA__c = nowValue;
                }
                syncRemainingHours(caseRecord, businessHoursId, nowValue);
                continue;
            }

            if (isPausedStatus(oldRecord.Status) && isWorkingStatus(caseRecord.Status)) {
                extendWorkDeadlineAfterPause(caseRecord, businessHoursId, nowValue);
                caseRecord.IsStopped = false;
                caseRecord.InicioPausaSLA__c = null;
            } else if (!isPausedStatus(caseRecord.Status)) {
                caseRecord.IsStopped = false;
                caseRecord.InicioPausaSLA__c = null;
            }

            if (isWorkingStatus(caseRecord.Status)) {
                startWork(caseRecord, businessHoursId, nowValue);
            }

            if (isResolvedStatus(caseRecord.Status) || caseRecord.IsClosed) {
                finishWork(caseRecord, nowValue);
            }

            syncRemainingHours(caseRecord, businessHoursId, nowValue);
        }
    }

    public static void refreshOpenCases() {
        Id businessHoursId = getBusinessHoursId();
        Datetime nowValue = System.now();
        List<Case> casesToUpdate = [
            SELECT
                Id,
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
                SLAAtendimentoTempoRestanteUtilHoras__c,
                SLATrabalhoTempoRestanteUtilHoras__c,
                SLATempoRestanteUtilHoras__c
            FROM Case
            WHERE IsClosed = false
            AND PrioridadeSLA__c != null
            AND (
                PrimeiroAtendimentoEm__c = null
                OR FimTrabalhoSLA__c = null
            )
        ];

        for (Case caseRecord : casesToUpdate) {
            updateViolationFlags(caseRecord, nowValue);
            syncRemainingHours(caseRecord, businessHoursId, nowValue);
        }

        if (!casesToUpdate.isEmpty()) {
            update casesToUpdate;
        }
    }

    private static void initializeAtendimento(Case caseRecord, Id businessHoursId, Datetime startDate) {
        if (caseRecord.SLAAtendimentoPrazo__c == null) {
            caseRecord.SLAAtendimentoPrazo__c = BusinessHours.add(
                businessHoursId,
                startDate,
                hoursToMilliseconds(ATENDIMENTO_HORAS)
            );
        }
    }

    private static void startWork(Case caseRecord, Id businessHoursId, Datetime startDate) {
        if (caseRecord.PrimeiroAtendimentoEm__c == null) {
            caseRecord.PrimeiroAtendimentoEm__c = startDate;
        }
        if (caseRecord.InicioTrabalhoSLA__c == null) {
            caseRecord.InicioTrabalhoSLA__c = startDate;
        }
        if (caseRecord.SLATrabalhoPrazo__c == null) {
            caseRecord.SLATrabalhoPrazo__c = BusinessHours.add(
                businessHoursId,
                caseRecord.InicioTrabalhoSLA__c,
                hoursToMilliseconds(getWorkHours(caseRecord.PrioridadeSLA__c))
            );
        }
        updateViolationFlags(caseRecord, startDate);
    }

    private static void finishWork(Case caseRecord, Datetime finishDate) {
        if (caseRecord.FimTrabalhoSLA__c == null) {
            caseRecord.FimTrabalhoSLA__c = finishDate;
        }
        updateViolationFlags(caseRecord, finishDate);
    }

    private static void extendWorkDeadlineAfterPause(Case caseRecord, Id businessHoursId, Datetime resumeDate) {
        if (caseRecord.InicioPausaSLA__c == null || caseRecord.SLATrabalhoPrazo__c == null) {
            return;
        }

        Long pausedBusinessMilliseconds = BusinessHours.diff(
            businessHoursId,
            caseRecord.InicioPausaSLA__c,
            resumeDate
        );
        if (pausedBusinessMilliseconds > 0) {
            caseRecord.SLATrabalhoPrazo__c = BusinessHours.add(
                businessHoursId,
                caseRecord.SLATrabalhoPrazo__c,
                pausedBusinessMilliseconds
            );
        }
    }

    private static void updateViolationFlags(Case caseRecord, Datetime referenceDate) {
        if (
            caseRecord.PrimeiroAtendimentoEm__c == null &&
            caseRecord.SLAAtendimentoPrazo__c != null &&
            referenceDate > caseRecord.SLAAtendimentoPrazo__c
        ) {
            caseRecord.SLAAtendimentoViolado__c = true;
        }

        if (
            !caseRecord.IsStopped &&
            caseRecord.FimTrabalhoSLA__c == null &&
            caseRecord.SLATrabalhoPrazo__c != null &&
            referenceDate > caseRecord.SLATrabalhoPrazo__c
        ) {
            caseRecord.SLATrabalhoViolado__c = true;
        }
    }

    private static void syncRemainingHours(Case caseRecord, Id businessHoursId, Datetime nowValue) {
        Datetime referenceDate = caseRecord.IsStopped && caseRecord.InicioPausaSLA__c != null
            ? caseRecord.InicioPausaSLA__c
            : nowValue;

        Decimal atendimentoRestante = null;
        if (caseRecord.PrimeiroAtendimentoEm__c == null && caseRecord.SLAAtendimentoPrazo__c != null) {
            atendimentoRestante = millisecondsToHours(
                BusinessHours.diff(businessHoursId, referenceDate, caseRecord.SLAAtendimentoPrazo__c)
            );
        } else if (caseRecord.PrimeiroAtendimentoEm__c != null) {
            atendimentoRestante = 0;
        }

        Decimal trabalhoRestante = null;
        if (
            caseRecord.InicioTrabalhoSLA__c != null &&
            caseRecord.FimTrabalhoSLA__c == null &&
            caseRecord.SLATrabalhoPrazo__c != null
        ) {
            trabalhoRestante = millisecondsToHours(
                BusinessHours.diff(businessHoursId, referenceDate, caseRecord.SLATrabalhoPrazo__c)
            );
        } else if (caseRecord.FimTrabalhoSLA__c != null || caseRecord.IsClosed) {
            trabalhoRestante = 0;
        }

        caseRecord.SLAAtendimentoTempoRestanteUtilHoras__c = atendimentoRestante;
        caseRecord.SLATrabalhoTempoRestanteUtilHoras__c = trabalhoRestante;
        caseRecord.SLATempoRestanteUtilHoras__c = caseRecord.PrimeiroAtendimentoEm__c == null
            ? atendimentoRestante
            : trabalhoRestante;
    }

    private static Decimal millisecondsToHours(Long milliseconds) {
        if (milliseconds == null || milliseconds <= 0) {
            return 0;
        }
        return (Decimal.valueOf(milliseconds) / (60 * 60 * 1000)).setScale(2);
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

    private static Long hoursToMilliseconds(Integer hours) {
        return Long.valueOf(String.valueOf(hours)) * 60 * 60 * 1000;
    }

    private static Boolean isWorkingStatus(String statusValue) {
        return STATUS_TRABALHO.contains(statusValue);
    }

    private static Boolean isPausedStatus(String statusValue) {
        return STATUS_PAUSADO.contains(statusValue);
    }

    private static Boolean isResolvedStatus(String statusValue) {
        return STATUS_RESOLVIDO.contains(statusValue);
    }

    private static Id getBusinessHoursId() {
        if (cachedBusinessHoursId != null) {
            return cachedBusinessHoursId;
        }

        List<BusinessHours> configuredHours = [
            SELECT Id
            FROM BusinessHours
            WHERE Name = :BUSINESS_HOURS_NAME AND IsActive = true
            LIMIT 1
        ];
        if (!configuredHours.isEmpty()) {
            cachedBusinessHoursId = configuredHours[0].Id;
            return cachedBusinessHoursId;
        }

        cachedBusinessHoursId = [
            SELECT Id
            FROM BusinessHours
            WHERE IsDefault = true
            LIMIT 1
        ].Id;
        return cachedBusinessHoursId;
    }
}