import { LightningElement, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getDashboard from '@salesforce/apex/CentralControleSustentacaoController.getDashboard';

const REFRESH_INTERVAL_MS = 30 * 1000;
const PRIORITY_ORDER = {
    P0: 0,
    P1: 1,
    P2: 2,
    P3: 3,
    P4: 4
};

export default class CentralControleSustentacao extends LightningElement {
    dashboard;
    errorMessage;
    wiredDashboard;
    refreshTimer;
    knownNewCaseIds = new Set();
    hasLoadedNewCases = false;
    audioContext;
    alarmEnabled = false;
    alarmBlocked = false;
    lastNewCaseMessage;
    searchTerm = '';
    priorityFilter = 'ALL';
    slaStateFilter = 'ALL';
    sortBy = 'deadline';
    startDate = this.firstDayOfMonth();
    endDate = this.today();
    summaryPeriod = 'CURRENT_MONTH';

    priorityOptions = [
        { label: 'Todas', value: 'ALL' },
        { label: 'P0', value: 'P0' },
        { label: 'P1', value: 'P1' },
        { label: 'P2', value: 'P2' },
        { label: 'P3', value: 'P3' },
        { label: 'P4', value: 'P4' }
    ];
    slaStateOptions = [
        { label: 'Todos', value: 'ALL' },
        { label: 'Dentro do prazo', value: 'IN_TIME' },
        { label: 'Vencidos', value: 'VIOLATED' }
    ];
    sortOptions = [
        { label: 'Prazo mais próximo', value: 'deadline' },
        { label: 'Prioridade', value: 'priority' },
        { label: 'Tempo restante crítico', value: 'remaining' },
        { label: 'Mais antigos', value: 'opened' }
    ];
    summaryPeriodOptions = [
        { label: 'Semana atual', value: 'CURRENT_WEEK' },
        { label: 'Semana passada', value: 'LAST_WEEK' },
        { label: 'Mês atual', value: 'CURRENT_MONTH' },
        { label: 'Mês passado', value: 'LAST_MONTH' },
        { label: 'Últimos 30 dias', value: 'LAST_30_DAYS' },
        { label: 'Últimos 15 dias', value: 'LAST_15_DAYS' },
        { label: 'Personalizado', value: 'CUSTOM' }
    ];

    @wire(getDashboard, { startDate: '$startDate', endDate: '$endDate' })
    wiredData(result) {
        this.wiredDashboard = result;
        const { data, error } = result;
        if (data) {
            this.detectNewCases(data.newCases || []);
            this.dashboard = data;
            this.errorMessage = undefined;
        } else if (error) {
            this.dashboard = undefined;
            this.errorMessage = this.errorText(error);
        }
    }

    connectedCallback() {
        this.refreshTimer = window.setInterval(() => {
            this.handleRefresh();
        }, REFRESH_INTERVAL_MS);
    }

    disconnectedCallback() {
        window.clearInterval(this.refreshTimer);
    }

    get loading() {
        return !this.dashboard && !this.errorMessage;
    }

    get alarmStatusLabel() {
        if (this.alarmEnabled) {
            return 'Alarme ativo';
        }
        if (this.alarmBlocked) {
            return 'Ativar alarme';
        }
        return 'Ativar alarme';
    }

    get alarmButtonVariant() {
        return this.alarmEnabled ? 'success' : 'neutral';
    }

    get showNewCaseAlert() {
        return Boolean(this.lastNewCaseMessage);
    }

    get newRows() {
        return this.decorateRows(this.dashboard?.newCases || []);
    }

    get openRows() {
        return this.decorateRows(this.dashboard?.openCases || []);
    }

    get pausedRows() {
        return this.decorateRows(this.dashboard?.pausedCases || []);
    }

    get homologationRows() {
        return this.decorateRows(this.dashboard?.homologationCases || []);
    }

    get closedRows() {
        return this.decorateRows(this.dashboard?.closedCases || []);
    }

    get filteredNewRows() {
        const search = this.searchTerm.trim().toLowerCase();
        const filtered = this.newRows.filter((caseRow) => {
            const matchesSearch =
                !search ||
                String(caseRow.caseNumber || '').toLowerCase().includes(search) ||
                String(caseRow.subject || '').toLowerCase().includes(search);
            const matchesPriority = this.priorityFilter === 'ALL' || caseRow.priority === this.priorityFilter;
            const matchesState =
                this.slaStateFilter === 'ALL' ||
                (this.slaStateFilter === 'VIOLATED' && caseRow.violated) ||
                (this.slaStateFilter === 'IN_TIME' && !caseRow.violated);
            return matchesSearch && matchesPriority && matchesState;
        });
        return this.sortRows(filtered);
    }

    get hasFilteredNewCases() {
        return this.filteredNewRows.length > 0;
    }

    get hasOpenCases() {
        return this.openRows.length > 0;
    }

    get hasPausedCases() {
        return this.pausedRows.length > 0;
    }

    get hasHomologationCases() {
        return this.homologationRows.length > 0;
    }

    get hasClosedCases() {
        return this.closedRows.length > 0;
    }

    get filteredNewCount() {
        return this.filteredNewRows.length;
    }

    get filteredNewViolatedCount() {
        return this.filteredNewRows.filter((caseRow) => caseRow.violated).length;
    }

    get filteredNewInTimeCount() {
        return this.filteredNewCount - this.filteredNewViolatedCount;
    }

    get activeSortLabel() {
        const selectedOption = this.sortOptions.find((option) => option.value === this.sortBy);
        return selectedOption ? selectedOption.label : 'Prazo mais próximo';
    }

    get summary() {
        const summary = this.dashboard?.summary || {};
        const lostAttendanceSla = summary.lostAttendanceSla || 0;
        const lostWorkSla = summary.lostWorkSla || 0;
        return {
            resolvedCases: summary.resolvedCases || 0,
            openedCases: summary.openedCases || 0,
            workingCases: summary.workingCases || 0,
            lostAttendanceSla,
            lostWorkSla,
            totalLostSla: lostAttendanceSla + lostWorkSla,
            monthOpenedCases: summary.monthOpenedCases || 0
        };
    }

    decorateRows(rows) {
        return rows.map((caseRecord) => {
            const priority = caseRecord.priority || 'Sem prioridade';
            const violated = Boolean(caseRecord.violated);
            const closed = Boolean(caseRecord.closed);
            const percentUsed = Number(caseRecord.percentUsed || 0);
            return {
                ...caseRecord,
                priority,
                violated,
                recordUrl: `/lightning/r/Case/${caseRecord.id}/view`,
                slaLabel: closed
                    ? this.closedSlaLabel(violated, caseRecord.overdueHours)
                    : violated
                    ? `${this.formatHours(caseRecord.overdueHours)} vencido`
                    : `${this.formatHours(caseRecord.remainingHours)} restantes`,
                slaStateLabel: violated ? 'Vencido' : 'No prazo',
                slaStateClass: violated ? 'sust-central__sla-state violated' : 'sust-central__sla-state',
                deadlineLabel: closed
                    ? 'Resultado SLA trabalho'
                    : caseRecord.slaType === 'Atendimento'
                    ? 'SLA atendimento'
                    : 'SLA trabalho',
                pauseLabel: caseRecord.pauseStartedAt ? this.formatDateTime(caseRecord.pauseStartedAt) : '--',
                cardClass: this.cardClass(closed, violated),
                slaPanelClass: this.slaPanelClass(closed, violated),
                priorityClass: `sust-central__priority ${String(priority).toLowerCase().replace(/\s+/g, '-')}`,
                progressClass: this.progressClass(percentUsed, violated),
                progressStyle: `width: ${Math.max(0, Math.min(100, percentUsed))}%`
            };
        });
    }

    sortRows(rows) {
        const sortedRows = [...rows];
        sortedRows.sort((left, right) => {
            if (this.sortBy === 'priority') {
                return (
                    this.priorityRank(left.priority) - this.priorityRank(right.priority) ||
                    this.deadlineTime(left) - this.deadlineTime(right) ||
                    this.openedTime(left) - this.openedTime(right)
                );
            }
            if (this.sortBy === 'remaining') {
                return (
                    this.slaCriticalRank(left) - this.slaCriticalRank(right) ||
                    this.priorityRank(left.priority) - this.priorityRank(right.priority) ||
                    this.deadlineTime(left) - this.deadlineTime(right)
                );
            }
            if (this.sortBy === 'opened') {
                return (
                    this.openedTime(left) - this.openedTime(right) ||
                    this.priorityRank(left.priority) - this.priorityRank(right.priority)
                );
            }
            return (
                this.deadlineTime(left) - this.deadlineTime(right) ||
                this.priorityRank(left.priority) - this.priorityRank(right.priority) ||
                this.openedTime(left) - this.openedTime(right)
            );
        });
        return sortedRows;
    }

    handleRefresh() {
        if (this.wiredDashboard) {
            refreshApex(this.wiredDashboard);
        }
    }

    async handleEnableAlarm() {
        this.alarmBlocked = false;
        try {
            this.ensureAudioContext();
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            this.alarmEnabled = true;
            this.playBell();
        } catch (error) {
            this.alarmEnabled = false;
            this.alarmBlocked = true;
        }
    }

    handleSearchChange(event) {
        this.searchTerm = event.target.value;
    }

    handlePriorityChange(event) {
        this.priorityFilter = event.detail.value;
    }

    handleSlaStateChange(event) {
        this.slaStateFilter = event.detail.value;
    }

    handleSortChange(event) {
        this.sortBy = event.detail.value;
    }

    handleStartDateChange(event) {
        this.startDate = event.target.value;
        this.summaryPeriod = 'CUSTOM';
    }

    handleEndDateChange(event) {
        this.endDate = event.target.value;
        this.summaryPeriod = 'CUSTOM';
    }

    handleSummaryPeriodChange(event) {
        this.summaryPeriod = event.detail.value;
        if (this.summaryPeriod === 'CUSTOM') {
            return;
        }

        const range = this.summaryDateRange(this.summaryPeriod);
        this.startDate = range.startDate;
        this.endDate = range.endDate;
    }

    progressClass(percent, violated) {
        let className = 'sust-central__progress';
        if (violated || percent >= 100) {
            return `${className} danger`;
        }
        if (percent >= 80) {
            return `${className} warning`;
        }
        return className;
    }

    cardClass(closed, violated) {
        if (closed && violated) {
            return 'sust-central__case closed violated';
        }
        if (closed) {
            return 'sust-central__case closed success';
        }
        return violated ? 'sust-central__case violated' : 'sust-central__case';
    }

    slaPanelClass(closed, violated) {
        if (!closed) {
            return 'sust-central__sla-panel';
        }
        return violated ? 'sust-central__sla-panel closed violated' : 'sust-central__sla-panel closed success';
    }

    closedSlaLabel(violated, overdueHours) {
        return violated ? `${this.formatHours(overdueHours)} vencido` : 'Fechado no prazo';
    }

    detectNewCases(newCases) {
        const currentIds = new Set(newCases.map((caseRecord) => caseRecord.id));
        if (!this.hasLoadedNewCases) {
            this.knownNewCaseIds = currentIds;
            this.hasLoadedNewCases = true;
            return;
        }

        const addedCases = newCases.filter((caseRecord) => !this.knownNewCaseIds.has(caseRecord.id));
        this.knownNewCaseIds = currentIds;
        if (addedCases.length === 0) {
            return;
        }

        const firstCase = addedCases[0];
        this.lastNewCaseMessage =
            addedCases.length === 1
                ? `Novo Case ${firstCase.caseNumber} entrou na fila.`
                : `${addedCases.length} novos Cases entraram na fila.`;

        if (this.alarmEnabled) {
            this.playBell();
        } else {
            this.alarmBlocked = true;
        }
    }

    ensureAudioContext() {
        if (!this.audioContext) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
        }
    }

    playBell() {
        this.ensureAudioContext();
        const startTime = this.audioContext.currentTime;
        this.playTone(startTime, 880, 0.14);
        this.playTone(startTime + 0.18, 1175, 0.22);
    }

    playTone(startTime, frequency, duration) {
        const oscillator = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, startTime);
        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.exponentialRampToValueAtTime(0.18, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
        oscillator.connect(gain);
        gain.connect(this.audioContext.destination);
        oscillator.start(startTime);
        oscillator.stop(startTime + duration + 0.02);
    }

    priorityRank(priority) {
        return PRIORITY_ORDER[priority] ?? 99;
    }

    slaCriticalRank(caseRow) {
        if (caseRow.violated) {
            return -1000000 - Number(caseRow.overdueHours || 0);
        }
        return Number(caseRow.remainingHours ?? 999999);
    }

    deadlineTime(caseRow) {
        return caseRow.deadline ? new Date(caseRow.deadline).getTime() : Number.MAX_SAFE_INTEGER;
    }

    openedTime(caseRow) {
        return caseRow.openedAt ? new Date(caseRow.openedAt).getTime() : Number.MAX_SAFE_INTEGER;
    }

    formatHours(value) {
        if (value === null || value === undefined) {
            return '--';
        }

        const numericValue = Number(value);
        if (numericValue <= 0) {
            return '0h';
        }

        const hours = Math.floor(numericValue);
        const minutes = Math.round((numericValue - hours) * 60);
        if (hours === 0) {
            return `${minutes}min`;
        }
        if (minutes === 0) {
            return `${hours}h`;
        }
        return `${hours}h ${minutes}min`;
    }

    formatDateTime(value) {
        if (!value) {
            return '--';
        }
        return new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(value));
    }

    firstDayOfMonth() {
        const today = new Date();
        return `${today.getFullYear()}-${this.pad(today.getMonth() + 1)}-01`;
    }

    today() {
        const today = new Date();
        return `${today.getFullYear()}-${this.pad(today.getMonth() + 1)}-${this.pad(today.getDate())}`;
    }

    summaryDateRange(period) {
        const today = new Date();
        const endDate = this.formatDateInput(today);
        if (period === 'CURRENT_WEEK') {
            const start = new Date(today);
            const dayOfWeek = start.getDay() || 7;
            start.setDate(start.getDate() - dayOfWeek + 1);
            return {
                startDate: this.formatDateInput(start),
                endDate
            };
        }
        if (period === 'LAST_WEEK') {
            const start = new Date(today);
            const dayOfWeek = start.getDay() || 7;
            start.setDate(start.getDate() - dayOfWeek - 6);
            const end = new Date(start);
            end.setDate(end.getDate() + 6);
            return {
                startDate: this.formatDateInput(start),
                endDate: this.formatDateInput(end)
            };
        }
        if (period === 'LAST_MONTH') {
            const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const end = new Date(today.getFullYear(), today.getMonth(), 0);
            return {
                startDate: this.formatDateInput(start),
                endDate: this.formatDateInput(end)
            };
        }
        if (period === 'LAST_30_DAYS') {
            return {
                startDate: this.daysAgo(29),
                endDate
            };
        }
        if (period === 'LAST_15_DAYS') {
            return {
                startDate: this.daysAgo(14),
                endDate
            };
        }
        return {
            startDate: this.firstDayOfMonth(),
            endDate
        };
    }

    daysAgo(days) {
        const date = new Date();
        date.setDate(date.getDate() - days);
        return this.formatDateInput(date);
    }

    formatDateInput(date) {
        return `${date.getFullYear()}-${this.pad(date.getMonth() + 1)}-${this.pad(date.getDate())}`;
    }

    pad(value) {
        return String(value).padStart(2, '0');
    }

    errorText(error) {
        return error && error.body && error.body.message
            ? error.body.message
            : 'Não foi possível carregar a central de Sustentacao.';
    }
}