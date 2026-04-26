import { LightningElement, api, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { formatarDataHora } from 'c/utils';
import atualizarTarefa from '@salesforce/apex/TarefaController.atualizarTarefa';
import buscarProjetos  from '@salesforce/apex/ProjetoController.buscarProjetos';

export default class TarefaKanbanCard extends LightningElement {
    @api tarefa;

    @track modalAberto = false;
    @track tarefaEditada = {};
    @track salvando = false;
    @track novoItemChecklist = '';

    // Partes separadas de data e hora para InicioTarefa__c e FimTarefa__c
    @track inicioDataStr = '';
    @track inicioHoraStr = '';
    @track fimDataStr = '';
    @track fimHoraStr = '';

    @track projetos = [];

    @wire(buscarProjetos)
    wiredProjetos({ data }) {
        if (data) this.projetos = data;
    }

    get projetosOptions() {
        return this.projetos.map(p => ({ label: p.Name, value: p.Id }));
    }

    get isTipoTrabalho() {
        return this.tarefaEditada.TipoTarefa__c === 'Trabalho';
    }

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

    // Opções de horário de 09:00 até 18:00 em intervalos de 30 min
    get horasOptions() {
        const options = [];
        for (let h = 9; h <= 18; h++) {
            const hh = String(h).padStart(2, '0');
            options.push({ label: `${hh}:00`, value: `${hh}:00` });
            if (h < 18) {
                options.push({ label: `${hh}:30`, value: `${hh}:30` });
            }
        }
        return options;
    }

    // Extrai "YYYY-MM-DD" (data local) de um campo DateTime ISO
    _extrairData(isoStr) {
        if (!isoStr) return '';
        const d = new Date(isoStr);
        const yyyy = d.getFullYear();
        const mm   = String(d.getMonth() + 1).padStart(2, '0');
        const dd   = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    // Extrai "HH:MM" (horário local) de um campo DateTime ISO
    _extrairHora(isoStr) {
        if (!isoStr) return '';
        const d = new Date(isoStr);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    // Combina "YYYY-MM-DD" + "HH:MM" em um ISO string usando horário local
    _combinarDatetime(dataStr, horaStr) {
        if (!dataStr || !horaStr) return null;
        const [h, m] = horaStr.split(':').map(Number);
        const d = new Date(`${dataStr}T00:00:00`);
        d.setHours(h, m, 0, 0);
        return d.toISOString();
    }

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

    // Exibe "DD/MM · HH:MM – HH:MM" no card (Fim omitido se ainda não preenchido)
    get periodoApontamento() {
        const inicio = this.tarefa?.InicioTarefa__c;
        if (!inicio) return null;

        const dInicio  = new Date(inicio);
        const data     = dInicio.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const hInicio  = `${String(dInicio.getHours()).padStart(2, '0')}:${String(dInicio.getMinutes()).padStart(2, '0')}`;

        const fim = this.tarefa?.FimTarefa__c;
        if (!fim) return `${data} · ${hInicio}`;

        const dFim = new Date(fim);
        const hFim = `${String(dFim.getHours()).padStart(2, '0')}:${String(dFim.getMinutes()).padStart(2, '0')}`;
        return `${data} · ${hInicio} – ${hFim}`;
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
        this.inicioDataStr = this._extrairData(this.tarefa.InicioTarefa__c);
        this.inicioHoraStr = this._extrairHora(this.tarefa.InicioTarefa__c);
        this.fimDataStr    = this._extrairData(this.tarefa.FimTarefa__c);
        this.fimHoraStr    = this._extrairHora(this.tarefa.FimTarefa__c);
        this.modalAberto   = true;
    }

    fecharModal() {
        this.modalAberto = false;
    }

    handleChange(event) {
        const field = event.target.dataset.field;
        const novaEditada = { ...this.tarefaEditada, [field]: event.target.value };
        // Ao mudar tipo para não-Trabalho, limpa o projeto
        if (field === 'TipoTarefa__c' && event.target.value !== 'Trabalho') {
            novaEditada.Projeto__c = null;
        }
        this.tarefaEditada = novaEditada;
    }

    handleDataChange(event) {
        const field   = event.target.dataset.field;
        const novaData = event.target.value;
        if (field === 'InicioTarefa__c') {
            this.inicioDataStr = novaData;
            this.tarefaEditada = { ...this.tarefaEditada, InicioTarefa__c: this._combinarDatetime(this.inicioDataStr, this.inicioHoraStr) };
        } else {
            this.fimDataStr = novaData;
            this.tarefaEditada = { ...this.tarefaEditada, FimTarefa__c: this._combinarDatetime(this.fimDataStr, this.fimHoraStr) };
        }
    }

    handleHoraChange(event) {
        const field    = event.target.dataset.field;
        const novaHora = event.target.value;
        if (field === 'InicioTarefa__c') {
            this.inicioHoraStr = novaHora;
            this.tarefaEditada = { ...this.tarefaEditada, InicioTarefa__c: this._combinarDatetime(this.inicioDataStr, this.inicioHoraStr) };
        } else {
            this.fimHoraStr = novaHora;
            this.tarefaEditada = { ...this.tarefaEditada, FimTarefa__c: this._combinarDatetime(this.fimDataStr, this.fimHoraStr) };
        }
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
