import { LightningElement } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import criarCliente from '@salesforce/apex/RepositorioTecnicoController.criarCliente';

export default class RepositorioClienteModal extends LightningElement {
    nome = '';
    descricao = '';
    ativo = true;
    saving = false;

    handleNomeChange(event) {
        this.nome = event.detail.value;
    }

    handleDescricaoChange(event) {
        this.descricao = event.detail.value;
    }

    handleAtivoChange(event) {
        this.ativo = event.target.checked;
    }

    handleCancel() {
        this.dispatchEvent(new CustomEvent('cancel'));
    }

    async handleSave() {
        if (!this.reportValidity()) {
            return;
        }

        this.saving = true;
        try {
            const record = await criarCliente({
                cliente: {
                    sobjectType: 'ClienteRepositorio__c',
                    Name: this.nome,
                    Descricao__c: this.descricao,
                    Ativo__c: this.ativo
                }
            });
            this.dispatchEvent(new CustomEvent('created', { detail: { id: record.Id, record } }));
        } catch (error) {
            this.toast('Erro ao salvar cliente', this.getErrorMessage(error), 'error');
        } finally {
            this.saving = false;
        }
    }

    reportValidity() {
        return [...this.template.querySelectorAll('lightning-input, lightning-textarea')].reduce((valid, field) => {
            field.reportValidity();
            return valid && field.checkValidity();
        }, true);
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
