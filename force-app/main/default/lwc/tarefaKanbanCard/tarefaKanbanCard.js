import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { formatarDataHora } from 'c/utils';
import atualizarTarefa from '@salesforce/apex/TarefaController.atualizarTarefa';

export default class TarefaKanbanCard extends LightningElement {
    @api tarefa;

    @track modalAberto = false;
    @track tarefaEditada = {};
    @track salvando = false;
    @track novoItemChecklist = '';

    prioridades = [
        { label: 'Alta', value: 'Alta' },
        { label: 'Média', value: 'Média' },
        { label: 'Baixa', value: 'Baixa' }
    ];

    tipos = [
        { label: 'Trabalho', value: 'Trabalho' },
        { label: 'Estudos', value: 'Estudos' },
        { label: 'Pessoal', value: 'Pessoal' },
        { label: 'Outros', value: 'Outros' }
    ];

    statusOptions = [
        { label: 'Não Iniciado', value: 'Não iniciado' },
        { label: 'Em andamento', value: 'Em andamento' },
        { label: 'Concluído', value: 'Concluído' },
        { label: 'Em espera', value: 'Em espera' },
        { label: 'Cancelado', value: 'Cancelado' }
    ];

    get checklist() {
        try {
            return JSON.parse(this.tarefaEditada.Checklist__c || '[]');
        } catch(e) {
            return [];
        }
    }

    get checklistProgresso() {
        const lista = this.checklist;
        if (!lista.length) return '';
        const feitos = lista.filter(i => i.feito).length;
        return `${feitos}/${lista.length}`;
    }

    get checklistProgressoCard() {
        try {
            const lista = JSON.parse(this.tarefa?.Checklist__c || '[]');
            if (!lista.length) return '';
            return `${lista.filter(i => i.feito).length}/${lista.length}`;
        } catch(e) {
            return '';
        }
    }

    handleNovoItemChange(event) {
        this.novoItemChecklist = event.target.value;
    }

    handleAddItem() {
        const texto = this.novoItemChecklist.trim();
        if (!texto) return;
        const lista = [...this.checklist, { id: Date.now(), texto, feito: false }];
        this.tarefaEditada = { ...this.tarefaEditada, Checklist__c: JSON.stringify(lista) };
        this.novoItemChecklist = '';
    }

    handleToggleItem(event) {
        const id = Number(event.currentTarget.dataset.id);
        const lista = this.checklist.map(i => i.id === id ? { ...i, feito: !i.feito } : i);
        this.tarefaEditada = { ...this.tarefaEditada, Checklist__c: JSON.stringify(lista) };
    }

    handleRemoveItem(event) {
        const id = Number(event.currentTarget.dataset.id);
        const lista = this.checklist.filter(i => i.id !== id);
        this.tarefaEditada = { ...this.tarefaEditada, Checklist__c: JSON.stringify(lista) };
    }

    handleDragStart(event) {
        event.dataTransfer.setData('tarefaId', this.tarefa.Id);
    }

    cancelarDrag(event) {
        event.stopPropagation();
    }

    get dataEntregaFormatada() {
        return formatarDataHora(this.tarefa?.CloseDate__c);
    }

    get isAtrasada() {
        if (!this.tarefa?.CloseDate__c) return false;
        const s = this.tarefa.Status__c;
        if (s === 'Concluído' || s === 'Cancelado') return false;
        return new Date(this.tarefa.CloseDate__c) < new Date();
    }

    get cardClass() {
        return (this.tarefa?.classCard || 'kanban-card') + (this.isAtrasada ? ' atrasada' : '');
    }

    abrirModal() {
        this.tarefaEditada = { ...this.tarefa };
        this.modalAberto = true;
    }

    fecharModal() {
        this.modalAberto = false;
    }

    handleChange(event) {
        const field = event.target.dataset.field;
        this.tarefaEditada = { ...this.tarefaEditada, [field]: event.target.value };
    }

    salvarTarefa() {
        this.salvando = true;
        atualizarTarefa({ tarefa: this.tarefaEditada })
            .then(() => {
                this.dispatchEvent(new ShowToastEvent({ title: 'Sucesso', message: 'Tarefa atualizada!', variant: 'success' }));
                this.dispatchEvent(new CustomEvent('tarefasalva', { bubbles: true, composed: true }));
                this.fecharModal();
            })
            .catch(error => {
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Erro',
                    message: error?.body?.message || 'Erro ao salvar tarefa.',
                    variant: 'error'
                }));
            })
            .finally(() => { this.salvando = false; });
    }
}
