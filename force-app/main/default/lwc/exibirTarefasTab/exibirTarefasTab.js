import { LightningElement, wire, track, api } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import buscarMinhasTarefas     from '@salesforce/apex/TarefaController.buscarTarefasPorUsuarioKanban';
import buscarTarefasArquivadas from '@salesforce/apex/TarefaController.buscarTarefasArquivadas';
import apagarTarefasAntigas    from '@salesforce/apex/TarefaController.apagarTarefasAntigas';
import atualizarTarefa         from '@salesforce/apex/TarefaController.atualizarTarefa';
import deletarTarefa           from '@salesforce/apex/TarefaController.deletarTarefa';
import buscarProjetos          from '@salesforce/apex/ProjetoController.buscarProjetos';

const COLUMNS = [
    { label: 'Título', fieldName: 'Name', type: 'text', sortable: true, wrapText: true },
    { label: 'Status', fieldName: 'Status__c', type: 'text', sortable: true },
    { label: 'Prioridade', fieldName: 'Prioridade__c', type: 'text', sortable: true },
    { label: 'Tipo', fieldName: 'TipoTarefa__c', type: 'text' },
    { label: 'Projeto', fieldName: 'projetoNome', type: 'text' },
    {
        label: 'Prazo',
        fieldName: 'CloseDate__c',
        type: 'date',
        sortable: true,
        typeAttributes: { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
    },
    {
        type: 'action',
        typeAttributes: {
            rowActions: [
                { label: 'Editar', name: 'edit', iconName: 'utility:edit' },
                { label: 'Excluir', name: 'delete', iconName: 'utility:delete' }
            ]
        }
    }
];

export default class ExibirTarefasTab extends LightningElement {
    @track tarefas = [];
    @track viewMode = 'kanban';
    @track limpando = false;
    @track modalEditarAberto = false;
    @track tarefaEditada = {};
    @track salvando = false;
    @track filtroBusca    = '';
    @track filtroTipo     = '';
    @track filtroPrioridade = '';
    @track filtroProjeto  = '';
    @track projetos       = [];
    @track exibeHistorico = false;
    @track tarefasArquivadas = [];
    _wiredTarefasResult;

    columns = COLUMNS;

    statusOptions = [
        { label: 'Não Iniciado', value: 'Não iniciado' },
        { label: 'Em andamento', value: 'Em andamento' },
        { label: 'Concluído', value: 'Concluído' },
        { label: 'Em espera', value: 'Em espera' },
        { label: 'Cancelado', value: 'Cancelado' }
    ];

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

    @wire(buscarProjetos)
    wiredProjetos({ data }) {
        if (data) this.projetos = data;
    }

    get projetosOptions() {
        return [
            { label: 'Todos', value: '' },
            ...this.projetos.map(p => ({ label: p.Name, value: p.Id }))
        ];
    }

    @wire(buscarMinhasTarefas)
    wiredTarefas(result) {
        this._wiredTarefasResult = result;
        const { data, error } = result;
        if (data) {
            this.tarefas = data.map(tarefa => ({
                ...tarefa,
                projetoNome: tarefa.Projeto__r ? tarefa.Projeto__r.Name : '',
                classCard: this._buildClassCard(tarefa)
            }));
        } else if (error) {
            console.error(error);
        }
    }

    _buildClassCard(tarefa) {
        const status = tarefa.Status__c
            ? tarefa.Status__c.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')
            : 'sem-status';
        const prioridade = tarefa.PrioridadeNumber__c != null
            ? 'prioridade-' + tarefa.PrioridadeNumber__c
            : 'sem-prioridade';
        const tipo = tarefa.TipoTarefa__c
            ? tarefa.TipoTarefa__c.toLowerCase().replace(/\s+/g, '-')
            : 'sem-tipo';
        return `kanban-card ${status} ${prioridade} ${tipo}`;
    }

    @api
    refreshData() {
        return refreshApex(this._wiredTarefasResult);
    }

    showList() { this.viewMode = 'list'; }
    showKanban() { this.viewMode = 'kanban'; }

    get isListView() { return this.viewMode === 'list'; }
    get isKanbanView() { return this.viewMode === 'kanban'; }
    get listVariant() { return this.viewMode === 'list' ? 'brand' : 'neutral'; }
    get kanbanVariant() { return this.viewMode === 'kanban' ? 'brand' : 'neutral'; }
    get labelHistorico() { return this.exibeHistorico ? 'Ocultar Histórico' : 'Ver Histórico'; }
    get temFiltroAtivo() { return !!(this.filtroBusca || this.filtroTipo || this.filtroPrioridade || this.filtroProjeto); }

    get tarefasFiltradas() {
        let lista = this.tarefas;
        if (this.filtroBusca) {
            const busca = this.filtroBusca.toLowerCase();
            lista = lista.filter(t => t.Name && t.Name.toLowerCase().includes(busca));
        }
        if (this.filtroTipo) {
            lista = lista.filter(t => t.TipoTarefa__c === this.filtroTipo);
        }
        if (this.filtroPrioridade) {
            lista = lista.filter(t => t.Prioridade__c === this.filtroPrioridade);
        }
        if (this.filtroProjeto) {
            lista = lista.filter(t => t.Projeto__c === this.filtroProjeto);
        }
        return lista;
    }

    handleFiltroChange(event) {
        const field = event.target.dataset.field;
        this[field] = event.target.value;
    }

    handleLimparFiltros() {
        this.filtroBusca    = '';
        this.filtroTipo     = '';
        this.filtroPrioridade = '';
        this.filtroProjeto  = '';
    }

    handleToggleHistorico() {
        this.exibeHistorico = !this.exibeHistorico;
        if (this.exibeHistorico && this.tarefasArquivadas.length === 0) {
            buscarTarefasArquivadas()
                .then(data => { this.tarefasArquivadas = data || []; })
                .catch(err => { this._toast('Erro', err?.body?.message || 'Erro ao buscar histórico.', 'error'); });
        }
    }

    handleTarefaSalva() {
        this.refreshData();
    }

    handleLimparAntigas() {
        this.limpando = true;
        apagarTarefasAntigas()
            .then(count => {
                const msg = count > 0
                    ? `${count} tarefa(s) antiga(s) removida(s).`
                    : 'Nenhuma tarefa para limpar.';
                this._toast('Limpeza concluída', msg, count > 0 ? 'success' : 'info');
                this.refreshData();
            })
            .catch(err => {
                this._toast('Erro', err?.body?.message || 'Erro ao limpar tarefas.', 'error');
            })
            .finally(() => { this.limpando = false; });
    }

    handleRowAction(event) {
        const { action, row } = event.detail;
        if (action.name === 'edit') {
            this.tarefaEditada = { ...row };
            this.modalEditarAberto = true;
        } else if (action.name === 'delete') {
            deletarTarefa({ tarefaId: row.Id })
                .then(() => {
                    this._toast('Sucesso', 'Tarefa excluída.', 'success');
                    this.refreshData();
                })
                .catch(err => {
                    this._toast('Erro', err?.body?.message || 'Erro ao excluir.', 'error');
                });
        }
    }

    fecharModal() {
        this.modalEditarAberto = false;
    }

    handleChangeEdit(event) {
        const field = event.target.dataset.field;
        this.tarefaEditada = { ...this.tarefaEditada, [field]: event.target.value };
    }

    salvarEdicao() {
        this.salvando = true;
        atualizarTarefa({ tarefa: this.tarefaEditada })
            .then(() => {
                this._toast('Sucesso', 'Tarefa atualizada!', 'success');
                this.fecharModal();
                this.refreshData();
            })
            .catch(err => {
                this._toast('Erro', err?.body?.message || 'Erro ao salvar.', 'error');
            })
            .finally(() => { this.salvando = false; });
    }

    _toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}
