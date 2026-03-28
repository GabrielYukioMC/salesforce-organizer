import { LightningElement, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import atualizarStatusTarefa from '@salesforce/apex/TarefaController.atualizarStatusTarefa';

const STATUS_CSS = {
    'Não iniciado': 'nao-iniciado',
    'Em andamento': 'em-andamento',
    'Concluído':    'concluido',
    'Em espera':    'em-espera',
    'Cancelado':    'cancelado'
};

export default class TarefasKanban extends LightningElement {
    @api tarefas = [];
    @api statusOptions = [];

    allowDrop(event) {
        event.preventDefault();
        event.currentTarget.classList.add('drag-over');
    }

    handleDragLeave(event) {
        event.currentTarget.classList.remove('drag-over');
    }

    handleDrop(event) {
        event.preventDefault();
        event.currentTarget.classList.remove('drag-over');

        const tarefaId = event.dataTransfer.getData('tarefaId');
        const novoStatus = event.currentTarget.dataset.status;
        const tarefa = this.tarefas.find(t => t.Id === tarefaId);

        if (!tarefa || tarefa.Status__c === novoStatus) return;

        atualizarStatusTarefa({ tarefaId, novoStatus })
            .then(() => {
                this.dispatchEvent(new CustomEvent('tarefasatualizada', { bubbles: true, composed: true }));
            })
            .catch(error => {
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Erro',
                    message: error?.body?.message || 'Erro ao mover tarefa.',
                    variant: 'error'
                }));
            });
    }

    get columns() {
        return this.statusOptions.map(status => {
            const tarefas = this.tarefas.filter(t => t.Status__c === status.value);
            return {
                status: status.value,
                label: status.label,
                tarefas,
                count: tarefas.length,
                columnClass: `kanban-column col-${STATUS_CSS[status.value] || 'default'}`
            };
        });
    }
}
