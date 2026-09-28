import { api, LightningElement, wire } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';
import USER_ID from '@salesforce/user/Id';
import DISPONIVEL_FIELD from '@salesforce/schema/User.DisponivelPraSustentacao__c';
import getNewCases from '@salesforce/apex/CentralControleSustentacaoController.getNewCases';

const REFRESH_INTERVAL_MS = 30 * 1000;
const USER_FIELDS = [DISPONIVEL_FIELD];

export default class SlaNewCaseBell extends LightningElement {
    @api label = 'Sino SLA';

    refreshTimer;
    audioContext;
    alarmEnabled = false;
    alarmBlocked = false;
    hasLoaded = false;
    knownCaseIds = new Set();
    newCaseCount = 0;
    lastNewCaseMessage;
    bellClickCount = 0;
    bellClickTimer;

    @wire(getRecord, { recordId: USER_ID, fields: USER_FIELDS })
    wiredUser({ data }) {
        const userIsAvailable = Boolean(data?.fields?.DisponivelPraSustentacao__c?.value);
        if (userIsAvailable) {
            this.enableAlarmFromUserPreference();
        } else {
            this.alarmEnabled = false;
        }
    }

    connectedCallback() {
        this.loadNewCases();
        this.refreshTimer = window.setInterval(() => {
            this.loadNewCases();
        }, REFRESH_INTERVAL_MS);
    }

    disconnectedCallback() {
        window.clearInterval(this.refreshTimer);
        window.clearTimeout(this.bellClickTimer);
    }

    get statusLabel() {
        if (this.alarmEnabled) {
            return 'Ativo';
        }
        if (this.alarmBlocked) {
            return 'Aguardando ativação';
        }
        return 'Inativo';
    }

    get statusClass() {
        return this.alarmEnabled ? 'sla-bell__status active' : 'sla-bell__status';
    }

    get alarmButtonLabel() {
        return this.alarmEnabled ? 'Sino ativo' : 'Ativar sino';
    }

    get alarmButtonVariant() {
        return this.alarmEnabled ? 'success' : 'brand';
    }

    async handleEnableAlarm() {
        this.alarmBlocked = false;
        try {
            this.ensureAudioContext();
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            this.alarmEnabled = true;
            if (this.registerBellClick()) {
                this.playBellBurst();
            } else {
                this.playBell();
            }
        } catch (error) {
            this.alarmEnabled = false;
            this.alarmBlocked = true;
        }
    }

    registerBellClick() {
        window.clearTimeout(this.bellClickTimer);
        this.bellClickCount += 1;
        this.bellClickTimer = window.setTimeout(() => {
            this.bellClickCount = 0;
        }, 1600);

        if (this.bellClickCount < 3) {
            return false;
        }

        this.bellClickCount = 0;
        window.clearTimeout(this.bellClickTimer);
        return true;
    }

    enableAlarmFromUserPreference() {
        this.alarmEnabled = true;
        this.alarmBlocked = false;
        try {
            this.ensureAudioContext();
        } catch (error) {
            this.alarmBlocked = true;
        }
    }

    async loadNewCases() {
        try {
            const rows = await getNewCases();
            this.newCaseCount = rows.length;
            this.detectAddedCases(rows);
        } catch (error) {
            this.lastNewCaseMessage = 'Não foi possível consultar novos casos.';
        }
    }

    detectAddedCases(rows) {
        const currentIds = new Set(rows.map((caseRecord) => caseRecord.id));
        if (!this.hasLoaded) {
            this.knownCaseIds = currentIds;
            this.hasLoaded = true;
            return;
        }

        const addedCases = rows.filter((caseRecord) => !this.knownCaseIds.has(caseRecord.id));
        this.knownCaseIds = currentIds;
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
        this.playTone(startTime + 0.46, 988, 0.18);
    }

    playBellBurst() {
        this.ensureAudioContext();
        const startTime = this.audioContext.currentTime;
        this.playTone(startTime, 880, 0.12);
        this.playTone(startTime + 0.16, 1175, 0.16);
        this.playTone(startTime + 0.38, 988, 0.14);
        this.playTone(startTime + 0.58, 1320, 0.22);
    }

    playTone(startTime, frequency, duration, type = 'sine', volume = 0.18) {
        const oscillator = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, startTime);
        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
        oscillator.connect(gain);
        gain.connect(this.audioContext.destination);
        oscillator.start(startTime);
        oscillator.stop(startTime + duration + 0.02);
    }
}
