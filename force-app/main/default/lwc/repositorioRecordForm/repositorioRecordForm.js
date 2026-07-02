import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import salvarRegistro from '@salesforce/apex/RepositorioTecnicoController.salvarRegistro';
import {
    AMBIENTE_OPTIONS,
    CRITICIDADE_OPTIONS,
    REQUIRED_BY_TYPE,
    RISCO_OPTIONS,
    STATUS_OPTIONS,
    TIPO_CASO,
    TIPO_ERRO,
    TIPO_PROCEDIMENTO,
    TIPO_QUERY,
    TIPO_SCRIPT,
    getTipoConfig,
    normalizeRecord
} from 'c/repositorioConfig';

export default class RepositorioRecordForm extends LightningElement {
    @api mode = 'create';
    @api record;
    @api clienteId;
    @api projetoId;
    @api tipo;

    @track draft = {};
    saving = false;

    statusOptions = STATUS_OPTIONS;
    criticidadeOptions = CRITICIDADE_OPTIONS;
    riscoOptions = RISCO_OPTIONS;
    ambienteOptions = AMBIENTE_OPTIONS;

    connectedCallback() {
        this.initializeDraft();
    }

    initializeDraft() {
        const base = normalizeRecord(this.record);
        this.draft = {
            sobjectType: 'RegistroRepositorio__c',
            Status__c: 'Ativo',
            ExigeBackup__c: false,
            ExigeAprovacao__c: false,
            ...base,
            Cliente__c: base.Cliente__c || this.clienteId,
            Projeto__c: base.Projeto__c || this.projetoId,
            Tipo__c: base.Tipo__c || this.tipo
        };
    }

    get modalTitle() {
        const prefix = this.mode === 'edit' ? 'Editar' : 'Novo';
        return `${prefix} ${getTipoConfig(this.draft.Tipo__c || this.tipo).formLabel}`;
    }

    get iconName() {
        return getTipoConfig(this.draft.Tipo__c || this.tipo).iconName;
    }

    get isCaso() {
        return this.draft.Tipo__c === TIPO_CASO;
    }

    get isQuery() {
        return this.draft.Tipo__c === TIPO_QUERY;
    }

    get isScript() {
        return this.draft.Tipo__c === TIPO_SCRIPT;
    }

    get isErro() {
        return this.draft.Tipo__c === TIPO_ERRO;
    }

    get isProcedimento() {
        return this.draft.Tipo__c === TIPO_PROCEDIMENTO;
    }

    handleFieldChange(event) {
        const field = event.target.dataset.field;
        const value = event.target.type === 'checkbox' ? event.target.checked : event.detail.value;
        this.draft = { ...this.draft, [field]: value };
    }

    handleCancel() {
        this.dispatchEvent(new CustomEvent('cancel'));
    }

    async handleSave() {
        if (!this.validateForm()) {
            return;
        }

        this.saving = true;
        try {
            const record = await salvarRegistro({ registro: this.draft });
            this.dispatchEvent(new CustomEvent('saved', { detail: { record } }));
        } catch (error) {
            this.toast('Erro ao salvar registro', this.getErrorMessage(error), 'error');
        } finally {
            this.saving = false;
        }
    }

    validateForm() {
        const inputsValid = [...this.template.querySelectorAll('lightning-input, lightning-textarea, lightning-combobox')].reduce(
            (valid, field) => {
                field.reportValidity();
                return valid && field.checkValidity();
            },
            true
        );
        const requiredFields = REQUIRED_BY_TYPE[this.draft.Tipo__c] || [];
        const dataValid = requiredFields.every((field) => !this.isBlank(this.draft[field]));

        if (!dataValid) {
            this.toast('Campos obrigatórios', 'Preencha os campos obrigatórios antes de salvar.', 'warning');
        }
        return inputsValid && dataValid;
    }

    isBlank(value) {
        return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
    }

    getErrorMessage(error) {
        return error && error.body && error.body.message
            ? error.body.message
            : 'Não foi possível concluir a operação. Verifique os dados e tente novamente.';
    }

    toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}
