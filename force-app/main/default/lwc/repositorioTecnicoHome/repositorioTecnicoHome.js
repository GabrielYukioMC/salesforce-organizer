import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getClientes from '@salesforce/apex/RepositorioTecnicoController.getClientes';
import getProjetosByCliente from '@salesforce/apex/RepositorioTecnicoController.getProjetosByCliente';
import getRegistros from '@salesforce/apex/RepositorioTecnicoController.getRegistros';
import getRegistrosTodos from '@salesforce/apex/RepositorioTecnicoController.getRegistrosTodos';
import arquivarRegistro from '@salesforce/apex/RepositorioTecnicoController.arquivarRegistro';
import { TIPO_CASO, getTipoConfig } from 'c/repositorioConfig';

const TODOS_CLIENTES_VALUE = '__TODOS_CLIENTES__';

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
        this.loadClientes(TODOS_CLIENTES_VALUE);
    }

    get clienteOptions() {
        return [
            { label: 'Todos', value: TODOS_CLIENTES_VALUE },
            ...this.clientes.map((cliente) => ({ label: cliente.Name, value: cliente.Id }))
        ];
    }

    get projetoOptions() {
        return this.projetos.map((projeto) => ({ label: projeto.Name, value: projeto.Id }));
    }

    get clienteName() {
        if (this.isTodosClientes) {
            return 'Todos';
        }
        const cliente = this.clientes.find((item) => item.Id === this.clienteId);
        return cliente ? cliente.Name : '';
    }

    get isTodosClientes() {
        return this.clienteId === TODOS_CLIENTES_VALUE;
    }

    get readOnlyMode() {
        return this.isTodosClientes;
    }
 
    get projetoDisabled() {
        return this.isTodosClientes || !this.clienteId || this.loadingProjetos;
    }

    get projetoPlaceholder() {
        return this.isTodosClientes ? 'Todos os projetos' : 'Selecione um projeto';
    }

    get novoClienteDisabled() {
        return false;
    }

    get novoProjetoDisabled() {
        return this.readOnlyMode || !this.clienteId;
    }

    get clientesCount() {
        return this.clientes.length;
    }

    get projetosCount() {
        if (this.isTodosClientes) {
            return new Set((this.registros || []).map((registro) => registro.Projeto__c).filter(Boolean)).size;
        }
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
            this.clienteId = this.resolveSelectedClienteId(selectedId);
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

        if (this.isTodosClientes) {
            this.projetos = [];
            this.projetoId = null;
            await this.loadRegistros();
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
        if (!this.tipoAtivo || (!this.isTodosClientes && (!this.clienteId || !this.projetoId))) {
            this.registros = [];
            return;
        }

        this.loadingRegistros = true;
        try {
            this.registros = this.isTodosClientes
                ? await getRegistrosTodos({ tipo: this.tipoAtivo })
                : await getRegistros({
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

    resolveSelectedClienteId(preferredId) {
        if (preferredId === TODOS_CLIENTES_VALUE) {
            return TODOS_CLIENTES_VALUE;
        }
        return this.resolveSelectedId(this.clientes, preferredId);
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

    async handleRefresh() {
        if (this.loadingClientes || this.loadingProjetos || this.loadingRegistros) {
            return;
        }

        if (!this.clienteId) {
            await this.loadClientes();
            return;
        }

        if (this.isTodosClientes) {
            await this.loadClientes(TODOS_CLIENTES_VALUE);
            return;
        }

        await this.loadClientes(this.clienteId);
    }

    openClienteModal() {
        if (this.readOnlyMode) {
            this.showReadOnlyToast();
            return;
        }
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
        if (this.readOnlyMode) {
            this.showReadOnlyToast();
            return;
        }
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
        if (this.readOnlyMode) {
            this.showReadOnlyToast();
            return;
        }
        this.selectedRecord = null;
        this.formMode = 'create';
        this.formTipo = this.tipoAtivo;
        this.showFormModal = true;
    }

    openEditForm(event) {
        if (this.readOnlyMode) {
            this.showReadOnlyToast();
            return;
        }
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
        if (this.readOnlyMode) {
            this.showReadOnlyToast();
            return;
        }
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

    funcLogs(){
        console.log('Logs:', this.registros);
        console.table(this.registros);
        // criar um log de tudo
        // criar um log de tudo em formato JSON
        console.log('JSON:', JSON.stringify(this.registros, null, 2));
        // fim dos logs
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

    showReadOnlyToast() {
        this.showToast('Somente visualização', 'Selecione um cliente específico para criar ou alterar registros.', 'info');
    }

    get newRecordLabel() {
        return getTipoConfig(this.tipoAtivo).newLabel;
    }
}