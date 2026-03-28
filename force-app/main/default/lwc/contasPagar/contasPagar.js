import { LightningElement, wire, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getContasAPagar from '@salesforce/apex/TransferenciaController.getContasAPagar';
import atualizarTransacao from '@salesforce/apex/TransferenciaController.atualizarTransacao';

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default class ContasPagar extends LightningElement {
    @track contas = [];
    @track carregando = true;

    @wire(getContasAPagar)
    wiredContas({ data, error }) {
        this.carregando = false;
        if (data) {
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            const em7 = new Date(hoje);
            em7.setDate(hoje.getDate() + 7);

            this.contas = data.map(c => {
                const dataVenc = new Date(c.Data__c);
                dataVenc.setHours(0, 0, 0, 0);
                let grupo;
                if (dataVenc.getTime() === hoje.getTime()) grupo = 'hoje';
                else if (dataVenc <= em7) grupo = 'semana';
                else grupo = 'futuras';
                return {
                    ...c,
                    valorFormatado: fmt.format(c.Valor__c),
                    grupo
                };
            });
        } else if (error) {
            this._toast('Erro', error?.body?.message || 'Erro ao buscar contas.', 'error');
        }
    }

    get hoje() { return this.contas.filter(c => c.grupo === 'hoje'); }
    get semana() { return this.contas.filter(c => c.grupo === 'semana'); }
    get futuras() { return this.contas.filter(c => c.grupo === 'futuras'); }
    get totalHoje() { return fmt.format(this.hoje.reduce((s, c) => s + c.Valor__c, 0)); }
    get totalSemana() { return fmt.format(this.semana.reduce((s, c) => s + c.Valor__c, 0)); }
    get totalFuturas() { return fmt.format(this.futuras.reduce((s, c) => s + c.Valor__c, 0)); }
    get temHoje() { return this.hoje.length > 0; }
    get temSemana() { return this.semana.length > 0; }
    get temFuturas() { return this.futuras.length > 0; }
    get semContas() { return !this.carregando && this.contas.length === 0; }

    handleMarcarPago(event) {
        const id = event.currentTarget.dataset.id;
        atualizarTransacao({ transacao: { Id: id, Pago__c: true } })
            .then(() => {
                this._toast('Sucesso', 'Marcada como paga!', 'success');
                this.contas = this.contas.filter(c => c.Id !== id);
            })
            .catch(err => { this._toast('Erro', err?.body?.message || 'Erro ao atualizar.', 'error'); });
    }

    _toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}
