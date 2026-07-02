import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getClientes from '@salesforce/apex/RepositorioTecnicoController.getClientes';
import getProjetosByCliente from '@salesforce/apex/RepositorioTecnicoController.getProjetosByCliente';
import getRegistros from '@salesforce/apex/RepositorioTecnicoController.getRegistros';
import arquivarRegistro from '@salesforce/apex/RepositorioTecnicoController.arquivarRegistro';
import { TIPO_CASO, getTipoConfig } from 'c/repositorioConfig';

export default class RepositorioTecnicoHome extends LightningElement {
    @track clientes = [];
    @track projetos = [];
    @track registros = [];

    clienteId;
    projetoId;
    tipoAtivo = TIPO_CASO;
    selectedRecord;
    formMode = 'create';
    formTipo = TIPO_CASO;

    loadingClientes = false;
    loadingProjetos = false;
    loadingRegistros = false;
    showClienteModal = false;
    showProjetoModal = false;
    showFormModal = false;
    showDetailModal = false;

    connectedCallback() {
        this.loadClientes();
    }

    get clienteOptions() {
        return this.clientes.map((cliente) => ({ label: cliente.Name, value: cliente.Id }));
    }

    get projetoOptions() {
        return this.projetos.map((projeto) => ({ label: projeto.Name, value: projeto.Id }));
    }

    get clienteName() {
        const cliente = this.clientes.find((item) => item.Id === this.clienteId);
        return cliente ? cliente.Name : '';
    }

    get projetoDisabled() {
        return !this.clienteId || this.loadingProjetos;
    }

    get novoProjetoDisabled() {
        return !this.clienteId;
    }

    get clientesCount() {
        return this.clientes.length;
    }

    get projetosCount() {
        return this.projetos.length;
    }

    get registrosCount() {
        return this.registros.length;
    }

    async loadClientes(preferredClienteId) {
        this.loadingClientes = true;
        try {
            this.clientes = await getClientes();
            const selectedId = preferredClienteId || this.clienteId;
            this.clienteId = this.resolveSelectedId(this.clientes, selectedId);
            await this.loadProjetos();
        } catch (error) {
            this.handleError(error);
        } finally {
            this.loadingClientes = false;
        }
    }

    async loadProjetos(preferredProjetoId) {
        if (!this.clienteId) {
            this.projetos = [];
            this.projetoId = null;
            this.registros = [];
            return;
        }

        this.loadingProjetos = true;
        try {
            this.projetos = await getProjetosByCliente({ clienteId: this.clienteId });
            const selectedId = preferredProjetoId || this.projetoId;
            this.projetoId = this.resolveSelectedId(this.projetos, selectedId);
            await this.loadRegistros();
        } catch (error) {
            this.handleError(error);
        } finally {
            this.loadingProjetos = false;
        }
    }

    async loadRegistros() {
        if (!this.clienteId || !this.projetoId || !this.tipoAtivo) {
            this.registros = [];
            return;
        }

        this.loadingRegistros = true;
        try {
            this.registros = await getRegistros({
                clienteId: this.clienteId,
                projetoId: this.projetoId,
                tipo: this.tipoAtivo
            });
        } catch (error) {
            this.handleError(error);
        } finally {
            this.loadingRegistros = false;
        }
    }

    resolveSelectedId(records, preferredId) {
        if (preferredId && records.some((record) => record.Id === preferredId)) {
            return preferredId;
        }
        return records.length ? records[0].Id : null;
    }

    handleClienteChange(event) {
        this.clienteId = event.detail.value;
        this.projetoId = null;
        this.loadProjetos();
    }

    handleProjetoChange(event) {
        this.projetoId = event.detail.value;
        this.loadRegistros();
    }

    handleTipoChange(event) {
        this.tipoAtivo = event.detail.value;
        this.loadRegistros();
    }

    openClienteModal() {
        this.showClienteModal = true;
    }

    closeClienteModal() {
        this.showClienteModal = false;
    }

    async handleClienteCreated(event) {
        this.showClienteModal = false;
        await this.loadClientes(event.detail.id);
        this.showToast('Cliente criado', 'Cliente selecionado automaticamente.', 'success');
    }

    openProjetoModal() {
        this.showProjetoModal = true;
    }

    closeProjetoModal() {
        this.showProjetoModal = false;
    }

    async handleProjetoCreated(event) {
        this.showProjetoModal = false;
        await this.loadProjetos(event.detail.id);
        this.showToast('Projeto criado', 'Projeto selecionado automaticamente.', 'success');
    }

    openNewRecordForm() {
        this.selectedRecord = null;
        this.formMode = 'create';
        this.formTipo = this.tipoAtivo;
        this.showFormModal = true;
    }

    openEditForm(event) {
        const recordId = event.detail.id;
        this.selectedRecord = this.findRecord(recordId);
        this.formMode = 'edit';
        this.formTipo = this.selectedRecord ? this.selectedRecord.Tipo__c : this.tipoAtivo;
        this.showDetailModal = false;
        this.showFormModal = true;
    }

    closeFormModal() {
        this.showFormModal = false;
        this.selectedRecord = null;
    }

    async handleRecordSaved(event) {
        this.showFormModal = false;
        this.selectedRecord = event.detail.record;
        this.tipoAtivo = event.detail.record.Tipo__c || this.tipoAtivo;
        await this.loadRegistros();
        this.showToast('Registro salvo', 'O conteúdo técnico foi salvo.', 'success');
    }

    openDetail(event) {
        this.selectedRecord = this.findRecord(event.detail.id);
        this.showDetailModal = Boolean(this.selectedRecord);
    }

    closeDetailModal() {
        this.showDetailModal = false;
        this.selectedRecord = null;
    }

    async handleArchive(event) {
        const recordId = event.detail.id;
        const record = this.findRecord(recordId);
        if (!record || !window.confirm(`Arquivar "${record.Name}"?`)) {
            return;
        }

        try {
            await arquivarRegistro({ registroId: recordId });
            await this.loadRegistros();
            this.showToast('Registro arquivado', 'O registro saiu da listagem principal.', 'success');
        } catch (error) {
            this.handleError(error);
        }
    }

    async handleCopyText(event) {
        const { text, label } = event.detail;
        if (!text) {
            this.showToast('Nada para copiar', 'Este registro ainda não tem conteúdo preenchido.', 'warning');
            return;
        }

        try {
            await this.copyText(text);
            this.showToast('Copiado', `${label || 'Conteúdo'} copiado para a área de transferência.`, 'success');
        } catch (error) {
            this.showToast('Não foi possível copiar', 'Copie o conteúdo manualmente e tente novamente.', 'error');
        }
    }

    async copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return;
        }

        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.setAttribute('readonly', '');
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (!success) {
            throw new Error('Clipboard indisponível');
        }
    }

    findRecord(recordId) {
        return this.registros.find((record) => record.Id === recordId);
    }

    handleError(error) {
        const message = error && error.body && error.body.message ? error.body.message : 'Não foi possível concluir a operação. Verifique os dados e tente novamente.';
        this.showToast('Erro', message, 'error');
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    get newRecordLabel() {
        return getTipoConfig(this.tipoAtivo).newLabel;
    }
}
