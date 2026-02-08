import { LightningElement, api, track } from 'lwc';
import { formatarDataHora } from 'c/utils';
export default class TarefaKanbanCard extends LightningElement {
    @api tarefa;

    @track modalAberto = false;
    @track tarefaEditada = {};

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

    formatosPermitidos = [
    'bold',
    'italic',
    'underline',
    'strike',
    'list',
    'indent',
    'align',
    'link',
    'clean',
    'font',
    'size',
    'color'
];


    handleDragStart(event) {
        event.dataTransfer.setData('tarefaId', this.tarefa.Id);
    }
    get dataEntregaFormatada() {
        return formatarDataHora(this.tarefa?.CloseDate__c);
    }

    cancelarDrag(event) {
        event.stopPropagation();
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
        
        this.tarefaEditada = {
            ...this.tarefaEditada,
            [field]: event.target.value
        };
    }


    salvarTarefa() {

        const eventoSalvar = new CustomEvent('editartarefa', {
            detail: this.tarefaEditada
        });
        this.dispatchEvent(eventoSalvar);
        this.fecharModal();
    }
    
}