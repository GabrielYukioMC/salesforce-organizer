import { LightningElement, wire, track } from 'lwc';
import buscarMinhasTarefas from '@salesforce/apex/TarefaController.buscarTarefasPorUsuarioKanban';

export default class ExibirTarefasTab extends LightningElement {

    @track tarefas = [];
    @track viewMode = 'list';

    statusOptions = [
        { label: 'Não Iniciado', value: 'Não iniciado' },
        { label: 'Em andamento', value: 'Em andamento' },
        { label: 'Concluído', value: 'Concluído' },
        { label: 'Em espera', value: 'Em espera' },
        { label: 'Cancelado', value: 'Cancelado' }
    ];
columns = [
    { label: 'Nome', fieldName: 'Name' },
    { label: 'Status', fieldName: 'Status__c' },
    { label: 'Prioridade', fieldName: 'Prioridade__c' },
    { label: 'Tipo', fieldName: 'TipoTarefa__c' },
{
    label: 'Data de Prazo de entrega',
    fieldName: 'CloseDate__c',
    type: 'date',
    typeAttributes: {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }, 
  
}

];

    viewOptions = [
        { label: 'Lista', value: 'list' },
        { label: 'Kanban', value: 'kanban' }
    ];

    @wire(buscarMinhasTarefas)
    wiredTarefas({ data, error }) {
        if (data) {
            this.tarefas = data;
        } else if (error) {
            console.error(error);
        }
    }

    handleViewChange(event) {
        this.viewMode = event.detail.value;
    }

    get kanbanColumns() {
        return this.statusOptions.map(status => ({
            status: status.value,
            label: status.label,
            tarefas: this.tarefas.filter(
                tarefa => tarefa.Status__c === status.value
            )
        }));
    }

    get isListView() {
        return this.viewMode === 'list';
    }

    get isKanbanView() {
        return this.viewMode === 'kanban';
    }


    showList() {
    this.viewMode = 'list';
    }

    showKanban() {
        this.viewMode = 'kanban';
    }

    get listVariant() {
        return this.viewMode === 'list' ? 'brand' : 'neutral';
    }

    get kanbanVariant() {
        return this.viewMode === 'kanban' ? 'brand' : 'neutral';
    }

}