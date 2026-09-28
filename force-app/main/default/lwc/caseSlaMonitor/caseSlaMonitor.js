import { LightningElement, api, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getStatus from '@salesforce/apex/CaseSLAStatusController.getStatus';

const REFRESH_INTERVAL_MS = 60 * 1000;

export default class CaseSlaMonitor extends LightningElement {
    @api recordId;

    sla;
    errorMessage;
    wiredStatus;
    refreshTimer;

    @wire(getStatus, { recordId: '$recordId' })
    wiredSlaStatus(result) {
        this.wiredStatus = result;
        const { data, error } = result;
        if (data) {
            this.sla = data;
            this.errorMessage = undefined;
        } else if (error) {
            this.sla = undefined;
            this.errorMessage = this.errorText(error);
        }
    }

    connectedCallback() {
        this.refreshTimer = window.setInterval(() => {
            if (this.wiredStatus) {
                refreshApex(this.wiredStatus);
            }
        }, REFRESH_INTERVAL_MS);
    }

    disconnectedCallback() {
        window.clearInterval(this.refreshTimer);
    }

    get loading() {
        return !this.sla && !this.errorMessage;
    }

    get activePhaseLabel() {
        if (!this.sla) {
            return '';
        }
        if (this.sla.paused) {
            return 'Pausado';
        }
        return this.sla.firstResponseAt ? 'SLA de trabalho' : 'SLA de atendimento';
    }

    get activeRemainingLabel() {
        if (!this.sla) {
            return '';
        }
        if (this.activeViolated) {
            return `${this.formatHours(this.sla.activeOverdueHours)} vencido`;
        }
        return `${this.formatHours(this.sla.activeRemainingHours)} restantes`;
    }

    get attendanceRemainingLabel() {
        if (this.sla.attendanceViolated && !this.sla.firstResponseAt) {
            return `${this.formatHours(this.sla.attendanceOverdueHours)} vencido`;
        }
        if (this.sla.firstResponseAt) {
            return `${this.formatHours(this.sla.attendanceElapsedHours)} usados`;
        }
        return `${this.formatHours(this.sla.attendanceRemainingHours)} restantes`;
    }

    get workRemainingLabel() {
        if (!this.sla.workStartedAt) {
            return 'Aguardando início';
        }
        if (this.sla.workViolated && !this.sla.workFinishedAt) {
            return `${this.formatHours(this.sla.workOverdueHours)} vencido`;
        }
        if (this.sla.workFinishedAt) {
            return `${this.formatHours(this.sla.workElapsedHours)} usados`;
        }
        return `${this.formatHours(this.sla.workRemainingHours)} restantes`;
    }

    get attendanceTotalLabel() {
        return this.formatHours(this.sla.attendanceTotalHours);
    }

    get workTotalLabel() {
        return this.formatHours(this.sla.workTotalHours);
    }

    get firstResponseLabel() {
        return this.formatDateTime(this.sla.firstResponseAt);
    }

    get workStartedLabel() {
        return this.formatDateTime(this.sla.workStartedAt);
    }

    get workDeadlineLabel() {
        return this.formatDateTime(this.sla.workDeadline);
    }

    get badgeClass() {
        return `sla-monitor__priority ${String(this.sla.priority || 'sem-prioridade').toLowerCase()}`;
    }

    get activeViolated() {
        if (!this.sla) {
            return false;
        }
        return this.sla.firstResponseAt ? this.sla.workViolated : this.sla.attendanceViolated;
    }

    get attendanceClass() {
        return this.stageClass(!this.sla.firstResponseAt, this.sla.attendanceViolated, this.attendanceCompletedInTime);
    }

    get workClass() {
        return this.stageClass(
            Boolean(this.sla.firstResponseAt && !this.sla.workFinishedAt),
            this.sla.workViolated,
            this.workCompletedInTime
        );
    }

    get activeProgressClass() {
        return this.progressClass(this.sla.activePercentUsed, this.sla.attendanceViolated || this.sla.workViolated);
    }

    get attendanceProgressClass() {
        return this.progressClass(this.sla.attendancePercentUsed, this.sla.attendanceViolated, this.attendanceCompletedInTime);
    }

    get workProgressClass() {
        return this.progressClass(this.sla.workPercentUsed, this.sla.workViolated, this.workCompletedInTime);
    }

    get activeProgressStyle() {
        return this.progressStyle(this.sla.activePercentUsed);
    }

    get attendanceProgressStyle() {
        return this.progressStyle(this.sla.attendancePercentUsed);
    }

    get workProgressStyle() {
        return this.progressStyle(this.sla.workPercentUsed);
    }

    get attendanceCompletedInTime() {
        return Boolean(this.sla.firstResponseAt && !this.sla.attendanceViolated);
    }

    get workCompletedInTime() {
        return Boolean(this.sla.workFinishedAt && !this.sla.workViolated);
    }

    stageClass(active, violated, completedInTime) {
        let className = 'sla-monitor__stage';
        if (completedInTime) {
            className += ' success';
        }
        if (active) {
            className += ' active';
        }
        if (violated) {
            className += ' violated';
        }
        return className;
    }

    progressClass(percent, violated, completedInTime) {
        let className = 'sla-monitor__progress';
        if (completedInTime) {
            return `${className} success`;
        }
        if (violated || percent >= 100) {
            return `${className} danger`;
        }
        if (percent >= 80) {
            return `${className} warning`;
        }
        return className;
    }

    progressStyle(percent) {
        const value = Math.max(0, Math.min(100, Number(percent || 0)));
        return `width: ${value}%`;
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

    errorText(error) {
        return error && error.body && error.body.message ? error.body.message : 'Não foi possível carregar o SLA.';
    }
}