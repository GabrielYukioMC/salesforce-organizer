import { LightningElement, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import criarProjeto from '@salesforce/apex/RepositorioTecnicoController.criarProjeto';

export default class RepositorioProjetoModal extends LightningElement {
    @api clienteId;
    @api clienteName;

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
            const record = await criarProjeto({
                projeto: {
                    sobjectType: 'ProjetoRepositorio__c',
                    Name: this.nome,
                    Cliente__c: this.clienteId,
                    Descricao__c: this.descricao,
                    Ativo__c: this.ativo
                }
            });
            this.dispatchEvent(new CustomEvent('created', { detail: { id: record.Id, record } }));
        } catch (error) {
            this.toast('Erro ao salvar projeto', this.getErrorMessage(error), 'error');
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
        return error && error.body && error.body.message  ? error.body.message : 'Não foi possível concluir a operação. Verifique os dados e tente novamente.';
    }

    toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}
