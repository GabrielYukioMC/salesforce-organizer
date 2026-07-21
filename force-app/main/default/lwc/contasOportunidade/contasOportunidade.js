import { LightningElement, api, wire, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import getContasByOportunidade from '@salesforce/apex/CompradorController.getContasByOportunidade';
import saveContas from '@salesforce/apex/CompradorController.saveContas';

const COLUMNS = [
    { label: 'Nome', fieldName: 'Name', type: 'text', editable: false },
    { label: 'Renda Mensal', fieldName: 'RendaMensal__c', type: 'currency', editable: true,
      typeAttributes: { currencyCode: 'BRL', minimumFractionDigits: 2 } },
    { label: 'Telefone', fieldName: 'Phone', type: 'phone', editable: true }
];

export default class ContasOportunidade extends LightningElement {
    @api recordId;   
    @track contas = [];
    @track draftValues = [];
    @track isLoading = false;

    columns = COLUMNS;
    _wiredResult;

    @wire(getContasByOportunidade, { oportunidadeId: '$recordId' })
    wiredCompradores(result) {
        console.log(this.recordId);
        
        this._wiredResult = result;
        if (result.data) {
            this.contas = result.data.map(c => ({    id: c.Conta__c,    Name: c.Conta__r.Name,    RendaMensal__c: c.Conta__r.RendaMensal__c,  Phone: c.Conta__r.Phone
            }));
        }
    }

    get semContas() {
        return this.contas.length === 0;
    }

    handleSave(event) {
        const drafts = event.detail.draftValues;
        const contasToSave = drafts.map(d => ({
            Id: d.id,
            ...(d.RendaMensal__c !== undefined && { RendaMensal__c: d.RendaMensal__c }),
            ...(d.Phone !== undefined && { Phone: d.Phone })
        }));

        this.isLoading = true;
        saveContas({ contas: contasToSave })
            .then(() => {
                this.draftValues = [];
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Sucesso',
                    message: 'Contas atualizadas com sucesso.',
                    variant: 'success'
                }));
                return refreshApex(this._wiredResult);
            })
            .catch(error => {
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Erro ao salvar',
                    message: error.body?.message ?? 'Erro desconhecido.',
                    variant: 'error'
                }));
            })
            .finally(() => {
                this.isLoading = false;
            });
    }
}