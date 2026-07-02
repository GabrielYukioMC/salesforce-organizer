import { LightningElement, api } from 'lwc';
import { getTipoConfig } from 'c/repositorioConfig';

export default class RepositorioCardList extends LightningElement {
    @api loading = false;
    @api clienteId;
    @api projetoId;
    @api tipoAtivo;
    @api registros = [];

    searchTerm = '';
    statusFilter = 'Todos';

    statusOptions = [
        { label: 'Todos os status', value: 'Todos' },
        { label: 'Ativo', value: 'Ativo' },
        { label: 'Em revisão', value: 'Em revisão' },
        { label: 'Obsoleto', value: 'Obsoleto' }
    ];

    get semCliente() {
        return !this.clienteId;
    }

    get semProjeto() {
        return Boolean(this.clienteId) && !this.projetoId;
    }

    get temContexto() {
        return Boolean(this.clienteId && this.projetoId);
    }

    get semRegistros() {
        return !this.registros || this.registros.length === 0;
    }

    get semResultadoFiltrado() {
        return !this.semRegistros && this.filteredRegistros.length === 0;
    }

    get tipoLabel() {
        return getTipoConfig(this.tipoAtivo).label;
    }

    get filteredRegistros() {
        const records = this.registros || [];
        const search = (this.searchTerm || '').trim().toLowerCase();
        return records.filter((record) => {
            const matchesStatus = this.statusFilter === 'Todos' || record.Status__c === this.statusFilter;
            const matchesSearch = !search || this.recordSearchText(record).includes(search);
            return matchesStatus && matchesSearch;
        });
    }

    get recordCountLabel() {
        const total = this.registros ? this.registros.length : 0;
        const filtered = this.filteredRegistros.length;
        if (total === filtered) {
            return total === 1 ? '1 registro ativo' : `${total} registros ativos`;
        }
        return `${filtered} de ${total} registros`;
    }

    get newRecordLabel() {
        return getTipoConfig(this.tipoAtivo).newLabel;
    }

    handleNewRecord() {
        this.dispatchEvent(new CustomEvent('newrecord'));
    }

    handleSearchChange(event) {
        this.searchTerm = event.detail.value;
    }

    handleStatusChange(event) {
        this.statusFilter = event.detail.value;
    }

    clearFilters() {
        this.searchTerm = '';
        this.statusFilter = 'Todos';
    }

    recordSearchText(record) {
        return [
            record.Name,
            record.Resumo__c,
            record.Sintoma__c,
            record.Objetivo__c,
            record.QuerySOQL__c,
            record.ScriptApex__c,
            record.MensagemErro__c,
            record.ObjetoSalesforce__c,
            record.Tags__c
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
    }

    forwardEvent(event) {
        this.dispatchEvent(
            new CustomEvent(event.type, {
                detail: event.detail,
                bubbles: true,
                composed: true
            })
        );
    }
}
