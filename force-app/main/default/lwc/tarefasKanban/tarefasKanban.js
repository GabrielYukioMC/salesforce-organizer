import { LightningElement, api } from 'lwc';

export default class TarefasKanban extends LightningElement {
    @api tarefas = [];
    @api statusOptions = [];

    get columns() {
        return this.statusOptions.map(status => ({
            status: status.value,
            label: status.label,
            tarefas: this.tarefas.filter(
                tarefa => tarefa.Status__c === status.value
            )
        }));
    }
}
