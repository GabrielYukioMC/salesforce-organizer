import { LightningElement, api } from 'lwc';
import atualizarStatusTarefa from '@salesforce/apex/TarefaController.atualizarStatusTarefa';

export default class TarefasKanban extends LightningElement {
    @api tarefas = [];
    @api statusOptions = [];

    allowDrop(event) {
        event.preventDefault();
    }

    handleDrop(event) {
        event.preventDefault();

        const tarefaId = event.dataTransfer.getData('tarefaId');
        const novoStatus = event.currentTarget.dataset.status;

        const tarefa = this.tarefas.find(t => t.Id === tarefaId);
        if (tarefa.Status__c === novoStatus) {
            return;  
        }
        this.atualizarStatusTarefa(tarefaId, novoStatus);

       
    }

    get columns() {
        return this.statusOptions.map(status => ({
            status: status.value,
            label: status.label,
            tarefas: this.tarefas.filter(
                tarefa => tarefa.Status__c === status.value
            )
        }));
    }

    handleEditarTarefa(event) {
    const tarefaAtualizada = event.detail;

    const status = tarefaAtualizada.Status__c
                ? tarefaAtualizada.Status__c.toLowerCase().replace(/\s+/g, '-')
                : 'sem-status';

            const prioridade = tarefaAtualizada.PrioridadeNumber__c != null
                ? 'prioridade-'+tarefaAtualizada.PrioridadeNumber__c 
                : 'sem-prioridade';

            const tipo = tarefaAtualizada.TipoTarefa__c
                ? tarefaAtualizada.TipoTarefa__c.toLowerCase().replace(/\s+/g, '-')
                : 'sem-tipo';


    console.log('chamou chamou');
    console.log('tarefa para atualizar: ', tarefaAtualizada);
    
    tarefaAtualizada.classCard = `kanban-card ${status} ${prioridade} ${tipo}`;

    this.tarefas = this.tarefas.map(t =>
        t.Id === tarefaAtualizada.Id ? tarefaAtualizada : t
    );
}


    atualizarStatusTarefa(tarefaId, novoStatus) {
        atualizarStatusTarefa({ tarefaId, novoStatus })
            .then(() => {
                console.log('Status da tarefa atualizado com sucesso.');
                 this.tarefas = this.tarefas.map(tarefa => {
                    if (tarefa.Id === tarefaId) {
                        return {
                            ...tarefa,
                            Status__c: novoStatus
                        };
                    }
                    return tarefa;
                });
            })
            .catch(error => {
                console.error('Erro ao atualizar o status da tarefa: ', error);
            });
    }

}
